import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { CrawlerService } from './crawler.service';
import { DiscoveryProcessor } from './processors/discovery.processor';
import { ScrapeProcessor } from './processors/scrape.processor';
import { ProcessProcessor } from './processors/process.processor';
import { SeoProcessor } from './processors/seo.processor';
import { PublishProcessor } from './processors/publish.processor';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { SmartConfigService } from './services/smart-config.service';
import { CrawlBatchTrackerService } from './services/crawl-batch-tracker.service';
import { DeadLetterService } from './services/dead-letter.service';
import { CrawlerScheduler } from './crawler.scheduler';
import { AutoCrawlScheduler } from './schedulers/auto-crawl.scheduler';
import { CrawlerController } from './crawler.controller';
import { RssFeed } from './entities/rss-feed.entity';
import { ScraperConfig } from './entities/scraper-config.entity';
import { CrawlHistory } from './entities/crawl-history.entity';
import { CrawlRawContent } from './entities/crawl-raw-content.entity';
import { Post } from '../posts/entities/post.entity';
import { PostCategory } from '../posts/entities/post-category.entity';
import { AiContentModule } from '../ai-content/ai-content.module';
import { PostsModule } from '../posts/posts.module';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeoModule } from '../seo/seo.module';
import { AutoCrawlService } from './services/auto-crawl.service';

import { CrawlerConfigService } from './services/crawler-config.service';
import { CrawlerDiscoveryService } from './services/crawler-discovery.service';
import { CrawlerPreviewService } from './services/crawler-preview.service';
import { CrawlerStatsService } from './services/crawler-stats.service';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            Post, // Để lưu bài viết
            PostCategory,
            User,
        ]),
        MikroOrmModule.forFeature([
            RssFeed,
            ScraperConfig,
            CrawlHistory,
            CrawlRawContent,
        ], 'mongo-connection'),
        AiContentModule,
        PostsModule,

        NotificationsModule,
        SeoModule,
        BullModule.registerQueue(
            {
                name: 'crawl_discovery',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
            {
                name: 'crawl_scrape',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
            {
                name: 'crawl_process',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
            {
                name: 'crawl_seo',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
            {
                name: 'crawl_publish',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
            {
                name: 'seo-ai-queue',
                defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 }
            },
        ),
        HttpModule,
    ],
    controllers: [CrawlerController],
    providers: [
        CrawlerService,
        CrawlerConfigService,
        CrawlerDiscoveryService,
        CrawlerPreviewService,
        CrawlerStatsService,
        AutoCrawlService,
        DuplicateDetectorService, // Fixed: Added missing provider
        SmartConfigService,
        CrawlBatchTrackerService,
        DeadLetterService,
        DiscoveryProcessor,
        ScrapeProcessor,
        ProcessProcessor,
        SeoProcessor,
        PublishProcessor,
        CrawlerScheduler,
        AutoCrawlScheduler
    ],
    exports: [
        CrawlerService,
        CrawlerConfigService,
        CrawlerDiscoveryService,
        CrawlerPreviewService,
        CrawlerStatsService,
        AutoCrawlService,
        DuplicateDetectorService,
        SmartConfigService,
        CrawlBatchTrackerService,
        DeadLetterService
    ],
})
export class CrawlerModule { }
