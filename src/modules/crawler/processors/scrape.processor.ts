import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { DuplicateDetectorService } from '../services/duplicate-detector.service';
import { CrawlBatchTrackerService } from '../services/crawl-batch-tracker.service';
import { DeadLetterService } from '../services/dead-letter.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Rate Limit: 5 requests per second
@Processor('crawl_scrape', {
    concurrency: 5,
    limiter: {
        max: 5,
        duration: 1000
    }
})
export class ScrapeProcessor extends WorkerHost {
    private readonly logger = new Logger(ScrapeProcessor.name);

    constructor(
        @InjectQueue('crawl_process') private processQueue: Queue,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        private readonly duplicateDetector: DuplicateDetectorService,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        private readonly deadLetterService: DeadLetterService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('crawl_scrape', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        const { url, type, rssId, targetCategoryId, autoPublish, selectorConfig, manual, batchId } = job.data;
        this.logger.log(`[SCRAPE JOB START] URL: ${url}`);

        // A-M10: Domain-based Rate Limiting (3 seconds per domain)
        try {
            const domain = new URL(url).hostname;
            const rateLimitKey = `scrape_limit:${domain}`;
            const lastAccessStr = await this.cacheManager.get<string>(rateLimitKey);

            if (lastAccessStr) {
                const timeSinceLastAccess = Date.now() - parseInt(lastAccessStr, 10);
                const minimumDelayMs = 3000;
                if (timeSinceLastAccess < minimumDelayMs) {
                    const waitTime = minimumDelayMs - timeSinceLastAccess;
                    this.logger.debug(`Rate limiting domain ${domain} for ${waitTime}ms`);
                    await new Promise(r => setTimeout(r, waitTime));
                }
            }
            await this.cacheManager.set(rateLimitKey, Date.now().toString(), 10000); // Valid config for v4 & v5
        } catch (e) {
            this.logger.warn(`Failed to apply domain rate limit: ${e.message}`);
        }

        const em = this.postRepo.getEntityManager().fork();
        const mongoEm = this.historyRepo.getEntityManager().fork();

        // Guard: Check if post already exists using intelligent detector
        if (!manual) {
            const { isDuplicate, reason, existingPostId } = await this.duplicateDetector.isDuplicate(url);
            if (isDuplicate) {
                this.logger.log(`✓ Skipping Scrape: ${url} (Reason: ${reason} | PostID: ${existingPostId})`);
                if (batchId) {
                    await this.crawlBatchTracker.trackJobCompletion(batchId, 'success', job.id!, url);
                }
                return;
            }
        }

        // Sprint 41: Yield event loop after guard check
        await new Promise(resolve => setImmediate(resolve));

        let title = '';
        let content = '';
        let originalThumbnail = '';
        try {
            // SSRF Protection: Validate URL before attempting fetch/scrape
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname;
            const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');
            const isPrivateIp = /^10\.|^127\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
            const isInternalHost = hostname.includes('internal') || hostname.includes('corp');

            if (isLocalhost || isPrivateIp || isInternalHost || parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new Error('SSRF blocked: Invalid or forbidden URL provided for scraping');
            }

            const response = await axios.get(url, {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Yield before heavy cheerio parse
            await new Promise(resolve => setImmediate(resolve));

            const $ = cheerio.load(response.data);
            $('script, style, iframe, nav, header, footer, .ads, .comments, .related-posts, .menu').remove();

            title = $(selectorConfig?.titleSelector).first().text().trim() ||
                $('h1').first().text().trim() ||
                $('title').first().text().trim();

            content = $(selectorConfig?.contentSelector).html() ||
                $('.article__body').first().html() ||
                $('article').first().html() ||
                '';

            originalThumbnail = $(selectorConfig?.thumbnailSelector || 'meta[property="og:image"]').attr('content') || '';


            if (!title) throw new Error('Empty title found');
            if (!content) throw new Error('Empty content found');

            // Setup Raw Entity
            let rawContent = await this.rawRepo.findOne({ url });
            if (!rawContent) {
                rawContent = this.rawRepo.create({
                    url,
                    sourceId: rssId || 'manual',
                    status: CrawlStatus.DISCOVERED,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            rawContent.rawTitle = title;
            rawContent.rawContent = content;
            rawContent.thumbnailUrl = originalThumbnail;
            rawContent.categoryId = targetCategoryId;
            rawContent.status = CrawlStatus.SCRAPED;
            rawContent.error = undefined; // clear old errors

            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            this.logger.log(`[SCRAPE SUCCESS] Title: ${title}. Pushing to Process Queue.`);

            // Pass the job state down the pipeline
            await this.processQueue.add('process_html', {
                rawId: rawContent.id,
                url,
                rssId,
                targetCategoryId,
                autoPublish,
                manual,
                jobId: job.id,
                batchId
            });

            if (batchId) {
                await this.crawlBatchTracker.trackStageProgress(batchId, 'SCRAPE_COMPLETED', job.id!, url);
            }

        } catch (error) {
            this.logger.error(`❌ [SCRAPE FAILED] URL: ${url} | Error: ${error.message}`);

            let rawContent = await this.rawRepo.findOne({ url });
            if (!rawContent) {
                rawContent = this.rawRepo.create({
                    url,
                    sourceId: rssId || 'manual',
                    status: CrawlStatus.FAILED,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            rawContent.status = CrawlStatus.FAILED;
            rawContent.error = { step: 'SCRAPE', message: error.message, stack: error.stack };
            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            // Update History as well
            let history = await mongoEm.findOne(CrawlHistory, { url });
            if (!history) {
                history = mongoEm.create(CrawlHistory, {
                    url,
                    sourceId: rssId,
                    status: 'FAILED',
                    errorMessage: error.message,
                    crawledAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            } else {
                history.status = 'FAILED';
                history.errorMessage = error.message;
                history.crawledAt = new Date();
            }
            await mongoEm.persistAndFlush(history);

            if (batchId) {
                await this.crawlBatchTracker.trackJobCompletion(batchId, 'failed', job.id!, url);
            }
        }
    }
}
