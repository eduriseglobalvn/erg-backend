import { Injectable, Logger, OnApplicationBootstrap, Inject, forwardRef } from '@nestjs/common';
import { SchedulerRegistry, Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { RssFeed } from './entities/rss-feed.entity';
import { CrawlerService } from './crawler.service';
import { CronJob } from 'cron';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';

@Injectable()
export class CrawlerScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(CrawlerScheduler.name);

    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepo: EntityRepository<RssFeed>,
        @Inject(forwardRef(() => CrawlerService))
        private readonly crawlerService: any,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly notificationsService: NotificationsService,
    ) { }

    async onApplicationBootstrap() {
        await this.syncAllSchedules();
    }

    /**
     * Đồng bộ toàn bộ lịch cào từ Database vào Worker Memory
     * Giúp hệ thống không cần Query DB mỗi phút.
     */
    async syncAllSchedules() {
        this.logger.log('Initializing dynamic crawler schedules...');

        // 1. Xóa các job cũ nếu có (để tránh trùng lặp khi gọi lại hàm này)
        const jobs = this.schedulerRegistry.getCronJobs();
        jobs.forEach((_, name) => {
            if (name.startsWith('rss_crawl_')) {
                this.schedulerRegistry.deleteCronJob(name);
            }
        });

        // 2. Lấy các Feed đang active
        const feeds = await this.rssRepo.findAll({
            where: { isActive: true }
        });

        for (const feed of feeds) {
            this.addCronJob(feed);
        }

        this.logger.log(`Successfully scheduled ${feeds.length} RSS feeds.`);
    }

    /**
     * Đăng ký một dynamic Cron Job cho 1 Feed cụ thể
     */
    addCronJob(feed: RssFeed) {
        if (!feed.cronExpression) return;

        const jobName = `rss_crawl_${feed.id}`;

        try {
            const job = new CronJob(feed.cronExpression, () => {
                this.logger.log(`⏰ Executing scheduled crawl: ${feed.name}`);
                this.crawlerService.triggerRssCrawl(feed.id);
            });

            this.schedulerRegistry.addCronJob(jobName, job);
            job.start();
        } catch (err) {
            this.logger.error(`Failed to schedule feed ${feed.name}: ${err.message}`);
        }
    }

    /**
     * Lấy danh sách các jobs đang chạy
     */
    getSchedulerStatus() {
        const jobs = this.schedulerRegistry.getCronJobs();
        const statusList: { name: string; nextTime: Date | string }[] = [];
        jobs.forEach((job, key) => {
            let nextDate: Date | string = 'Invalid Date';
            try {
                // job.nextDate() returns a luxon object if valid
                const next = job.nextDate();
                if (next && typeof next.toJSDate === 'function') {
                    nextDate = next.toJSDate();
                } else {
                    nextDate = typeof next === 'string' ? next : new Date().toISOString();
                }
            } catch (e) {
                this.logger.warn(`Could not determine next run date for job ${key}`);
            }

            statusList.push({
                name: key,
                nextTime: nextDate
            });
        });
        return {
            totalActive: jobs.size,
            jobs: statusList
        };
    }

    /**
     * Tạm dừng job khi deactivate
     */
    stopCronJob(rssId: string) {
        const jobName = `rss_crawl_${rssId}`;
        try {
            if (this.schedulerRegistry.doesExist('cron', jobName)) {
                const job = this.schedulerRegistry.getCronJob(jobName);
                job.stop();
                this.schedulerRegistry.deleteCronJob(jobName);
                this.logger.log(`Stopped schedule for feed ID: ${rssId}`);
            }
        } catch (e) {
            this.logger.warn(`Could not stop job ${jobName}: ${e.message}`);
        }
    }

    /**
     * Khởi động lại khi update cron expression
     */
    async restartCronJob(feed: RssFeed) {
        this.stopCronJob(feed.id);
        if (feed.isActive && feed.cronExpression) {
            this.addCronJob(feed);
        }
    }

    /**
     * Health check định kỳ để đảm bảo cron jobs đồng bộ với DB (Auto-healing)
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async healthCheck() {
        this.logger.log('Running Crawler Scheduler Health Check...');
        const activeFeeds = await this.rssRepo.find({ isActive: true });
        const runningJobNames = Array.from(this.schedulerRegistry.getCronJobs().keys());

        let syncedCount = 0;
        for (const feed of activeFeeds) {
            const jobName = `rss_crawl_${feed.id}`;
            if (!runningJobNames.includes(jobName) && feed.cronExpression) {
                this.logger.warn(`HealthCheck: Found active feed ${feed.name} not scheduled. Scheduling now.`);
                this.addCronJob(feed);
                syncedCount++;
                try {
                    await this.notificationsService.createForAdmins({
                        type: NotificationType.CRAWL_SCHEDULER_EVENT,
                        title: 'Auto-healing: Lập lịch bổ sung',
                        message: `Phát hiện RSS feed "${feed.name}" đang active nhưng chưa được xếp lịch cào. Đã tự động khôi phục.`,
                        priority: NotificationPriority.MEDIUM,
                        metadata: { feedId: feed.id }
                    });
                } catch (e) { }
            }
        }

        // Dọn dẹp các job đang chạy nhưng feed đã inactive hoặc bị xóa
        const inActiveIds = Array.from(await this.rssRepo.find({ isActive: false })).map(f => f.id);
        for (const jobName of runningJobNames) {
            const extractId = jobName.replace('rss_crawl_', '');
            if (inActiveIds.includes(extractId)) {
                this.logger.warn(`HealthCheck: Found running job for inactive feed ${extractId}. Stopping.`);
                this.stopCronJob(extractId);
            }
        }

        if (syncedCount === 0) {
            this.logger.log('Crawler Scheduler Health Check passed: All jobs are perfectly synced.');
        }
    }
}
