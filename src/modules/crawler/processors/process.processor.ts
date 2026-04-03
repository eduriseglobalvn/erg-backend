import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';
import { StorageService } from '@/shared/services/storage.service';
import { CrawlBatchTrackerService } from '../services/crawl-batch-tracker.service';
import { DeadLetterService } from '../services/dead-letter.service';
import * as cheerio from 'cheerio';
import axios from 'axios';
import * as crypto from 'crypto';

@Processor('crawl_process', { concurrency: 3 })
export class ProcessProcessor extends WorkerHost {
    private readonly logger = new Logger(ProcessProcessor.name);

    constructor(
        @InjectQueue('crawl_seo') private seoQueue: Queue,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        private readonly storageService: StorageService,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        private readonly deadLetterService: DeadLetterService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('crawl_process', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        const { rawId, url, rssId, targetCategoryId, autoPublish, manual, jobId, batchId } = job.data;
        this.logger.log(`[PROCESS JOB START] RawID: ${rawId} | URL: ${url}`);

        const rawContent = await this.rawRepo.findOne({ id: rawId });
        if (!rawContent) {
            this.logger.error(`RawContent not found for ID: ${rawId}`);
            return;
        }

        try {
            // Yield back to event loop if content is large to prevent blocking
            await new Promise(resolve => setImmediate(resolve));

            // Clean content
            const $clean = cheerio.load(rawContent.rawContent || '');
            $clean('script, style, iframe').remove();

            const originUrl = new URL(url);
            const originHostname = originUrl.hostname;

            $clean('a').each((i, el) => {
                const href = $clean(el).attr('href');
                if (!href) return;

                if (href.startsWith('javascript:')) {
                    $clean(el).removeAttr('href');
                    return;
                }

                if (href.startsWith('http')) {
                    try {
                        const linkHostname = new URL(href).hostname;
                        if (linkHostname !== originHostname && !linkHostname.endsWith(originHostname)) {
                            // External link -> add nofollow and blank target
                            $clean(el).attr('rel', 'nofollow noopener noreferrer');
                            $clean(el).attr('target', '_blank');
                        }
                    } catch (e) { }
                } else if (href.startsWith('/')) {
                    // Make relative links absolute
                    $clean(el).attr('href', `${originUrl.protocol}//${originHostname}${href}`);
                }
            });

            // Yield again before image processing
            await new Promise(resolve => setImmediate(resolve));

            let processedContent = $clean.html() || '';
            const imagesArray: { original: string; uploaded: string; alt: string }[] = [];

            // Process Images in batches of 5 concurrently
            const $img = cheerio.load(processedContent);
            const images = $img('img').toArray();
            const validImages = images.filter(img => {
                const src = $img(img).attr('src');
                return src && src.startsWith('http');
            });

            // Chunk array into batches of 5
            const chunkSize = 5;
            const imageChunks = Array.from({ length: Math.ceil(validImages.length / chunkSize) }, (v, i) =>
                validImages.slice(i * chunkSize, i * chunkSize + chunkSize)
            );

            for (const chunk of imageChunks) {
                const chunkResults = await Promise.allSettled(chunk.map(async (img) => {
                    const src = $img(img).attr('src') as string;
                    const localUrl = await this.downloadAndUploadImage(src, 'blog');
                    return { img, src, localUrl };
                }));

                for (const result of chunkResults) {
                    if (result.status === 'fulfilled') {
                        const { img, src, localUrl } = result.value;
                        $img(img).attr('src', localUrl);
                        $img(img).removeAttr('srcset');

                        imagesArray.push({
                            original: src,
                            uploaded: localUrl,
                            alt: $img(img).attr('alt') || ''
                        });
                    } else {
                        this.logger.warn(`Failed to process image: ${result.reason}`);
                    }
                }
                // Yield between chunks
                await new Promise(resolve => setImmediate(resolve));
            }
            processedContent = $img.html() || '';

            // Upload thumbnail if it exists
            if (rawContent.thumbnailUrl && rawContent.thumbnailUrl.startsWith('http')) {
                rawContent.thumbnailUrl = await this.downloadAndUploadImage(rawContent.thumbnailUrl, 'thumbnails');
            }

            rawContent.processedContent = processedContent;
            rawContent.images = imagesArray;
            rawContent.status = CrawlStatus.PROCESSED;

            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            this.logger.log(`[PROCESS SUCCESS] Processed ${imagesArray.length} images. Pushing to SEO Queue.`);

            await this.seoQueue.add('seo_html', {
                rawId: rawContent.id,
                url,
                rssId,
                targetCategoryId,
                autoPublish,
                manual,
                jobId,
                batchId
            });

            if (batchId) {
                await this.crawlBatchTracker.trackStageProgress(batchId, 'PROCESS_COMPLETED', job.id!, url);
            }

        } catch (error) {
            this.logger.error(`❌ [PROCESS FAILED] URL: ${url} | Error: ${error.message}`);
            rawContent.status = CrawlStatus.FAILED;
            rawContent.error = { step: 'PROCESS', message: error.message, stack: error.stack };
            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            if (batchId) {
                await this.crawlBatchTracker.trackJobCompletion(batchId, 'failed', job.id!, url);
            }
        }
    }

    private async downloadAndUploadImage(url: string, folder: string): Promise<string> {
        // Sprint 41: Cache image mapping to avoid duplicate uploads
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const cacheKey = `img:map:${urlHash}`;

        const cachedUrl = await this.cacheManager.get<string>(cacheKey);
        if (cachedUrl) {
            this.logger.debug(`[IMAGE CACHE HIT] Reusing uploaded image for: ${url.substring(0, 30)}...`);
            return cachedUrl;
        }

        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        const buffer = Buffer.from(response.data);
        const uploadedUrl = await this.storageService.processAndUpload(buffer, folder);

        // Cache for 7 days
        await this.cacheManager.set(cacheKey, uploadedUrl, 7 * 24 * 3600 * 1000);
        return uploadedUrl;
    }
}
