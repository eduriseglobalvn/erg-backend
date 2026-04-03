import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';

@Injectable()
export class DeadLetterService {
    private readonly logger = new Logger(DeadLetterService.name);

    constructor(
        private readonly notificationsService: NotificationsService,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        // Optional: Inject a specific DLQ if we want to move jobs there, but typically BullMQ keeps them in 'failed' state.
        // We'll process them from the failed state or log them here.
    ) { }

    /**
     * Called when a job permanently fails (all retries exhausted)
     * Tracks failure in database and notifies admins
     */
    async handlePermanentFailure(queueName: string, jobName: string, jobId: string, jobData: any, errorReason: string) {
        this.logger.error(`[DLQ] Job ${jobId} in queue ${queueName} permanently failed. Reason: ${errorReason}`);

        // Extract key info based on common job data formats we use
        const url = jobData?.url || 'Unknown URL';
        const rssId = jobData?.rssId || 'Unknown RSS';

        // 1. Notify Admins
        try {
            await this.notificationsService.createForAdmins({
                type: NotificationType.CRAWL_FAILED, // Fallback type, could be specific
                title: 'Công việc nền thất bại hoàn toàn',
                message: `Job ${jobName} trong queue ${queueName} đã thử lại tối đa và thất bại. Lỗi: ${errorReason?.substring(0, 100)}`,
                priority: NotificationPriority.HIGH,
                metadata: { queueName, jobName, jobId, url, error: errorReason },
                actionUrl: '/admin/monitor/dashboard', // Assuming we have a dashboard
            });
        } catch (e) {
            this.logger.error(`Failed to send DLQ notification: ${e.message}`);
        }

        // 2. Update Database States if it's a crawler job
        if (queueName.startsWith('crawl_') && url !== 'Unknown URL') {
            try {
                // Update History
                const em = this.historyRepo.getEntityManager().fork();
                let history = await em.findOne(CrawlHistory, { url });
                if (history) {
                    history.status = 'FAILED';
                    history.errorMessage = `[Permanent Failure] ${errorReason}`;
                    history.crawledAt = new Date();
                    await em.persistAndFlush(history);
                }

                // Update Raw Content
                const rawEm = this.rawRepo.getEntityManager().fork();
                let rawContent = await rawEm.findOne(CrawlRawContent, { url });
                if (rawContent) {
                    rawContent.status = CrawlStatus.FAILED;
                    rawContent.error = { step: queueName, message: `[Permanent Failure] ${errorReason}`, stack: '' };
                    await rawEm.persistAndFlush(rawContent);
                }
            } catch (dbError) {
                this.logger.error(`Failed to update DB states in DLQ for ${url}: ${dbError.message}`);
            }
        }
    }
}
