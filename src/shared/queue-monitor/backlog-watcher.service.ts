import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';

@Injectable()
export class BacklogWatcherService {
    private readonly logger = new Logger(BacklogWatcherService.name);
    private readonly BACKLOG_THRESHOLD = 100;
    private lastAlertTime: Map<string, number> = new Map();

    constructor(
        @InjectQueue('crawl_discovery') private discoveryQueue: Queue,
        @InjectQueue('crawl_scrape') private scrapeQueue: Queue,
        @InjectQueue('crawl_process') private processQueue: Queue,
        @InjectQueue('crawl_seo') private seoQueue: Queue,
        @InjectQueue('crawl_publish') private publishQueue: Queue,
        private readonly notificationsService: NotificationsService,
    ) { }

    @Cron('*/2 * * * *')
    async checkBacklogs() {
        const queues = [
            { name: 'crawl_discovery', queue: this.discoveryQueue },
            { name: 'crawl_scrape', queue: this.scrapeQueue },
            { name: 'crawl_process', queue: this.processQueue },
            { name: 'crawl_seo', queue: this.seoQueue },
            { name: 'crawl_publish', queue: this.publishQueue }
        ];

        for (const { name, queue } of queues) {
            const waiting = await queue.getWaitingCount();
            if (waiting > this.BACKLOG_THRESHOLD) {
                await this.triggerAlert(name, waiting, 'BACKLOG_HIGH');
            }
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkStalled() {
        // Check for paused queues or stalled jobs
        const queues = [
            { name: 'crawl_discovery', queue: this.discoveryQueue },
            { name: 'crawl_scrape', queue: this.scrapeQueue },
            { name: 'crawl_process', queue: this.processQueue },
            { name: 'crawl_seo', queue: this.seoQueue },
            { name: 'crawl_publish', queue: this.publishQueue }
        ];

        for (const { name, queue } of queues) {
            if (await queue.isPaused()) {
                await this.triggerAlert(name, 0, 'QUEUE_PAUSED');
            }
        }
    }

    private async triggerAlert(queueName: string, count: number, type: 'BACKLOG_HIGH' | 'QUEUE_PAUSED' = 'BACKLOG_HIGH') {
        const now = Date.now();
        const lastAlert = this.lastAlertTime.get(`${queueName}:${type}`) || 0;

        // Throttle 30 minutes
        if (now - lastAlert < 30 * 60 * 1000) return;

        this.logger.warn(`Queue Alert [${queueName}]: ${type} (${count} items)`);
        this.lastAlertTime.set(`${queueName}:${type}`, now);

        const notificationType = type === 'BACKLOG_HIGH' ? NotificationType.QUEUE_BACKLOG : NotificationType.SYSTEM_ALERT;

        await this.notificationsService.createForAdmins({
            type: notificationType,
            title: `Cảnh báo Queue: ${queueName}`,
            message: type === 'BACKLOG_HIGH'
                ? `Hàng đợi ${queueName} đang quá tải với ${count} items đang chờ.`
                : `Hàng đợi ${queueName} đang bị tạm dừng (Paused).`,
            priority: NotificationPriority.HIGH,
            source: 'BacklogWatcher'
        });
    }
}
