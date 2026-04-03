import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlRawContent, CrawlStatus } from '@/modules/crawler/entities/crawl-raw-content.entity';
import { User } from '@/modules/users/entities/user.entity';
import { SeoBatchService } from '@/modules/seo/services/seo-batch.service';
import { SeoImageAltService } from '@/modules/seo/services/seo-image-alt.service';
import { SeoContentService } from '@/modules/seo/services/seo-content.service';
import { AiRateLimiterService } from '@/modules/ai-content/services/ai-rate-limiter.service';
import { CrawlBatchTrackerService } from '@/modules/crawler/services/crawl-batch-tracker.service';
import { DeadLetterService } from '@/modules/crawler/services/dead-letter.service';
import { Role } from '@/modules/access-control/entities/role.entity';
import * as cheerio from 'cheerio';

@Processor('seo-ai-queue', { concurrency: 1 }) // Only 1 job at a time for SEO AI
export class SeoAiProcessor extends WorkerHost {
    private readonly logger = new Logger(SeoAiProcessor.name);
    private adminCache: User | null = null;

    constructor(
        @InjectQueue('crawl_publish') private publishQueue: Queue,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        private readonly seoBatchService: SeoBatchService,
        private readonly seoImageAltService: SeoImageAltService,
        private readonly seoContentService: SeoContentService,
        private readonly aiRateLimiter: AiRateLimiterService,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        private readonly deadLetterService: DeadLetterService,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('seo-ai-queue', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        const { rawId, url, rssId, targetCategoryId, autoPublish, manual, jobId, batchId } = job.data;
        this.logger.log(`[SEO AI JOB START] RawID: ${rawId} | URL: ${url}`);

        // Rate limiting check: 2 requests per minute max to prevent API bans on free tiers
        const rateLimit = await this.aiRateLimiter.checkLimit('seo_ai_generation', 2, 60 * 1000);
        if (!rateLimit.allowed) {
            this.logger.warn(`Rate limit hit for SEO AI queue. Delaying job...`);
            // Throwing a particular error so it can be retried automatically by BullMQ
            // Or use an actual BullMQ delayed retry if configured.
            await job.moveToDelayed(Date.now() + (rateLimit.retryAfterMs || 60000), job.token);
            // MoveToDelayed finishes the process for now.
            return;
        }

        const rawContent = await this.rawRepo.findOne({ id: rawId });
        if (!rawContent) {
            this.logger.error(`RawContent not found for ID: ${rawId}`);
            return;
        }

        const em = this.userRepo.getEntityManager().fork();

        if (!this.adminCache) {
            this.logger.debug('Admin cache empty, performing lookup...');
            const adminEmail = process.env.ADMIN_DEFAULT_EMAIL;

            if (adminEmail) {
                this.adminCache = await em.findOne(User, { email: adminEmail });
            }

            if (!this.adminCache) {
                const baseRoles = await em.find(Role, { name: 'Super Admin' });
                if (baseRoles.length > 0) {
                    this.adminCache = await em.findOne(User, { roles: { $in: baseRoles.map(r => r.id) } }, { orderBy: { createdAt: 'ASC' } });
                }
            }

            if (!this.adminCache) {
                this.adminCache = await em.findOne(User, {}, { orderBy: { createdAt: 'ASC' } });
            }
        }

        const admin = this.adminCache ? em.merge(this.adminCache) : null;

        if (!admin) {
            this.logger.error('No admin user found. Cannot call AI SEO services.');
            return;
        }

        let { rawTitle, processedContent } = rawContent;
        let seoData = { metaTitle: rawTitle || '', metaDescription: '', keywords: [] as string[] };
        let finalContent = processedContent || '';

        try {
            if (!rawTitle || !processedContent) throw new Error('Missing title or content in Raw DB');

            // Generate using preferred free providers (Groq, Cerebras, SambaNova) implicitly via provider factory config
            const [batchResult, altResults] = await Promise.all([
                this.seoBatchService.generateSeoBatch(processedContent, rawTitle, admin),
                this.seoImageAltService.generateAltTexts(processedContent, rawTitle, admin)
            ]);

            seoData.metaTitle = batchResult.title;
            seoData.metaDescription = batchResult.metaDescription;
            seoData.keywords = batchResult.keywords;
            const $alt = cheerio.load(processedContent);
            altResults.forEach(res => {
                $alt(`img[src="${res.imageUrl}"]`).attr('alt', res.suggestedAlt);

                if (rawContent.images) {
                    const imgObj = rawContent.images.find(i => i.uploaded === res.imageUrl);
                    if (imgObj) imgObj.alt = res.suggestedAlt;
                }
            });
            finalContent = $alt.html() || processedContent;

            finalContent = await this.seoContentService.paraphraseForSeo(finalContent, rawTitle, admin);
            finalContent = await this.seoContentService.optimizeHtmlStructure(finalContent);

            this.logger.log(`[SEO SUCCESS] Optimized Meta, Alt texts and Content for: ${url}`);

        } catch (aiError) {
            this.logger.warn(`[AI SEO ERROR] ${aiError.message} - Using fallbacks`);
            const plainText = (processedContent || '').replace(/<[^>]*>?/gm, '');
            seoData.metaDescription = plainText.substring(0, 200) + '...';
            finalContent = processedContent || '';
        }

        rawContent.seoContent = finalContent;
        rawContent.seoData = seoData;
        rawContent.status = CrawlStatus.SEO_OPTIMIZED;

        await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

        await this.publishQueue.add('publish_post', {
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
            await this.crawlBatchTracker.trackStageProgress(batchId, 'SEO_COMPLETED', job.id!, url);
        }
    }
}
