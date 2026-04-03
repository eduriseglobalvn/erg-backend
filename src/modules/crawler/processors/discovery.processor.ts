import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrawlerService } from '../crawler.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';
import { DeadLetterService } from '../services/dead-letter.service';

@Processor('crawl_discovery', { concurrency: 2 })
export class DiscoveryProcessor extends WorkerHost {
    private readonly logger = new Logger(DiscoveryProcessor.name);

    constructor(
        private readonly crawlerService: CrawlerService,
        private readonly notificationsService: NotificationsService,
        private readonly deadLetterService: DeadLetterService,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('crawl_discovery', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        this.logger.log(`[DISCOVERY JOB START] ID: ${job.id} | Name: ${job.name} | RSS: ${job.data.rssId}`);

        if (job.name === 'process_rss') {
            try {
                return await this.crawlerService.processRssFeed(job.data.rssId);
            } catch (error) {
                this.logger.error(`[DISCOVERY FAILED] RSS: ${job.data.rssId} - ${error.message}`);
                await this.notificationsService.createForAdmins({
                    type: NotificationType.CRAWL_STAGE_FAILED,
                    title: 'Lỗi Crawler Discovery',
                    message: `Không thể crawl RSS feed ID ${job.data.rssId}. Lỗi: ${error.message}`,
                    priority: NotificationPriority.HIGH,
                    metadata: { rssId: job.data.rssId, error: error.message },
                });
                throw error;
            }
        } else if (job.name === 'process_html_discovery') {
            try {
                return await this.crawlerService.processHtmlDiscovery(job.data.url, job.data.rssId);
            } catch (error) {
                this.logger.error(`[HTML DISCOVERY FAILED] URL: ${job.data.url} - ${error.message}`);
                throw error;
            }
        } else {
            this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }
}
