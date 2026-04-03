import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JobActivityService } from './job-activity.service';
import { SseService } from '../sse/sse.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';

@Injectable()
export class QueueEventsService implements OnModuleInit {
    private readonly logger = new Logger(QueueEventsService.name);
    private queueNames = [
        'crawl_discovery',
        'crawl_scrape',
        'crawl_process',
        'crawl_seo',
        'crawl_publish',
        'seo-ai-queue',
        'ai-content-queue',
        'mail-queue'
    ];
    private eventListeners: Map<string, QueueEvents> = new Map();

    constructor(
        private readonly configService: ConfigService,
        private readonly jobActivityService: JobActivityService,
        private readonly sseService: SseService,
        private readonly notificationsService: NotificationsService,
    ) { }

    onModuleInit() {
        this.initializeQueueListeners();
    }

    private sanitizeJobData(data: any): any {
        if (!data) return data;
        const sanitized = { ...data };
        const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'key'];

        for (const key of sensitiveKeys) {
            if (sanitized[key]) sanitized[key] = '***';
        }

        // Handle nested data if necessary, but for job metrics shallow is usually enough
        return sanitized;
    }

    private initializeQueueListeners() {
        const redisConfig = {
            host: this.configService.get('REDIS_HOST', 'localhost'),
            port: Number(this.configService.get('REDIS_PORT', 6379)),
        };

        for (const queueName of this.queueNames) {
            try {
                const events = new QueueEvents(queueName, { connection: redisConfig });

                events.on('active', async ({ jobId }) => {
                    this.logger.debug(`[Queue: ${queueName}] Job ${jobId} is now active`);
                    await this.jobActivityService.recordActivity({
                        queue: queueName,
                        jobId,
                        state: 'active',
                    });
                    this.sseService.emit({
                        type: 'job_active',
                        data: { queue: queueName, jobId }
                    });
                });

                events.on('progress', async ({ jobId, data }) => {
                    const progressNum = typeof data === 'number' ? data : parseInt(String(data));
                    if (!isNaN(progressNum)) {
                        await this.jobActivityService.updateProgress(queueName, jobId, progressNum);
                        this.sseService.emitJobProgress(jobId, progressNum, { queue: queueName });
                    }
                });

                events.on('completed', async ({ jobId, returnvalue }) => {
                    this.logger.debug(`[Queue: ${queueName}] Job ${jobId} completed`);
                    const sanitizedResult = this.sanitizeJobData(returnvalue);

                    await this.jobActivityService.recordActivity({
                        queue: queueName,
                        jobId,
                        state: 'completed',
                        result: sanitizedResult,
                    });
                    this.sseService.emitJobCompleted(jobId, sanitizedResult);
                });

                events.on('failed', async ({ jobId, failedReason }) => {
                    this.logger.error(`[Queue: ${queueName}] Job ${jobId} failed: ${failedReason}`);
                    await this.jobActivityService.recordActivity({
                        queue: queueName,
                        jobId,
                        state: 'failed',
                        error: failedReason,
                    });
                    this.sseService.emitJobFailed(jobId, failedReason);

                    // High priority notification for admins on failure
                    await this.notificationsService.createForAdmins({
                        type: NotificationType.SYSTEM_ALERT,
                        title: `Job Failure: ${queueName}`,
                        message: `Job ${jobId} failed in queue ${queueName}. Error: ${failedReason}`,
                        priority: NotificationPriority.HIGH,
                        metadata: { queue: queueName, jobId, error: failedReason }
                    });
                });

                events.on('stalled', async ({ jobId }) => {
                    this.logger.warn(`[Queue: ${queueName}] Job ${jobId} stalled`);
                    this.sseService.emit({
                        type: 'job_stalled',
                        data: { queue: queueName, jobId }
                    });
                });

                this.eventListeners.set(queueName, events);
            } catch (err) {
                this.logger.error(`Failed to initialize listener for queue ${queueName}: ${err.message}`);
            }
        }
    }

    async getQueueMetrics(queueName: string) {
        return { name: queueName, status: this.eventListeners.has(queueName) ? 'active' : 'error' };
    }

    async getAllQueueMetrics() {
        return Promise.all(this.queueNames.map(name => this.getQueueMetrics(name)));
    }
}
