import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { RssFeed } from '../entities/rss-feed.entity';
import { AutoCrawlService } from '../services/auto-crawl.service';
import { CronJob } from 'cron';

@Injectable()
export class AutoCrawlScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(AutoCrawlScheduler.name);

    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly feedRepo: EntityRepository<RssFeed>,
        private readonly autoCrawlService: AutoCrawlService,
        private readonly schedulerRegistry: SchedulerRegistry,
    ) { }

    async onApplicationBootstrap() {
        await this.syncAutoSchedules();
    }

    /**
     * Daily global crawl for all feeds marked as isHiddenCrawl=true
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleDailyAutoCrawl() {
        this.logger.log('⏰ Triggering daily global auto-crawl for hidden categories');
        await this.autoCrawlService.crawlHiddenCategories();
    }

    /**
     * Periodically check for custom auto-schedules to keep memory in sync
     */
    @Cron(CronExpression.EVERY_30_MINUTES)
    async syncAutoSchedules() {
        this.logger.log('Syncing custom auto-crawling schedules...');

        // Clear previous auto-jobs
        const jobs = this.schedulerRegistry.getCronJobs();
        jobs.forEach((_, name) => {
            if (name.startsWith('auto_crawl_')) {
                this.schedulerRegistry.deleteCronJob(name);
            }
        });

        // Find feeds with custom auto-schedules
        const feeds = await this.feedRepo.find({
            isActive: true,
            autoSchedule: { $ne: null }
        });

        for (const feed of feeds) {
            if (!feed.autoSchedule) continue;

            const jobName = `auto_crawl_${feed.id}`;
            try {
                const job = new CronJob(feed.autoSchedule, async () => {
                    this.logger.log(`⏰ Executing custom auto-crawl for: ${feed.name}`);
                    if (feed.autoKeywords) {
                        const keywords = feed.autoKeywords.split(',').map(k => k.trim()).filter(Boolean);
                        await this.autoCrawlService.crawlWithMultipleKeywords(feed, keywords);
                    } else {
                        // Regular RSS / URL discovery
                        await this.autoCrawlService.crawlHiddenCategories();
                    }
                });

                this.schedulerRegistry.addCronJob(jobName, job);
                job.start();
            } catch (err) {
                this.logger.error(`Failed to schedule auto-crawl for ${feed.name}: ${err.message}`);
            }
        }

        this.logger.log(`Scheduled ${feeds.length} custom auto-crawling jobs.`);
    }
}
