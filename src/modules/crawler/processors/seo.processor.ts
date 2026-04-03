import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';
import { CrawlBatchTrackerService } from '../services/crawl-batch-tracker.service';
import { DeadLetterService } from '../services/dead-letter.service';

@Processor('crawl_seo', { concurrency: 2 })
export class SeoProcessor extends WorkerHost {
    private readonly logger = new Logger(SeoProcessor.name);

    constructor(
        @InjectQueue('seo-ai-queue') private seoAiQueue: Queue,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        private readonly deadLetterService: DeadLetterService,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('crawl_seo', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        const { rawId, url, rssId, targetCategoryId, autoPublish, manual, jobId, batchId } = job.data;
        this.logger.log(`[SEO DELEGATION JOB START] RawID: ${rawId} | URL: ${url}`);

        const rawContent = await this.rawRepo.findOne({ id: rawId });
        if (!rawContent) {
            this.logger.error(`RawContent not found for ID: ${rawId}`);
            return;
        }

        // Set status to PENDING
        rawContent.status = CrawlStatus.SEO_PENDING;
        await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

        // Fast pass-through to AI Queue
        await this.seoAiQueue.add('seo_html_ai', {
            rawId, url, rssId, targetCategoryId, autoPublish, manual, jobId, batchId
        });

        this.logger.log(`[SEO DELEGATED] URL: ${url}`);
        // We don't mark SEO_COMPLETED here. It will be marked in SeoAiProcessor
    }
}
