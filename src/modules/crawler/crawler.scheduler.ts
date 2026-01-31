import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { RssFeed } from './entities/rss-feed.entity';
import { CrawlerService } from './crawler.service';
import { CronJob } from 'cron';

@Injectable()
export class CrawlerScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(CrawlerScheduler.name);

    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepo: EntityRepository<RssFeed>,
        private readonly crawlerService: CrawlerService,
        private readonly schedulerRegistry: SchedulerRegistry,
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
}
