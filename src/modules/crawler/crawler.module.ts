import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { CrawlerService } from './crawler.service';
import { CrawlerProcessor } from './crawler.processor';
import { CrawlerScheduler } from './crawler.scheduler';
import { CrawlerController } from './crawler.controller';
import { RssFeed } from './entities/rss-feed.entity';
import { ScraperConfig } from './entities/scraper-config.entity';
import { CrawlHistory } from './entities/crawl-history.entity';
import { Post } from '../posts/entities/post.entity';
import { PostCategory } from '../posts/entities/post-category.entity';
import { AiContentModule } from '../ai-content/ai-content.module';
import { PostsModule } from '../posts/posts.module';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeoModule } from '../seo/seo.module';

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
            CrawlHistory
        ], 'mongo-connection'),
        AiContentModule,
        PostsModule,

        NotificationsModule,
        SeoModule,
        BullModule.registerQueue({
            name: 'crawler',
        }),
        HttpModule,
    ],
    controllers: [CrawlerController],
    providers: [
        CrawlerService,
        CrawlerProcessor,
        CrawlerScheduler
    ],
    exports: [CrawlerService],
})
export class CrawlerModule { }
