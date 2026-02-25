import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SeoRedirectFilter } from '@/modules/seo/filters/seo-redirect.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisStore = require('cache-manager-redis-store');
import { DatabaseModule } from '@/shared/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from '@/shared/mail/mail.module';
import { AiContentModule } from '@/modules/ai-content/ai-content.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { SitemapModule } from '@/modules/sitemap/sitemap.module';
import { SeoModule } from '@/modules/seo/seo.module';
import { CrawlerModule } from '@/modules/crawler/crawler.module';
import { RecruitmentModule } from '@/modules/recruitment/recruitment.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { MenusModule } from '@/modules/menus/menus.module';
import { PagesModule } from '@/modules/pages/pages.module';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Để các module khác không cần import lại
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST');
        if (!host || host === 'memory' || host === 'none') {
          // Fallback to localhost if no redis, effectively disabling bull if not running
          return {
            connection: { host: '127.0.0.1', port: 6379 }
          };
        }
        const port = Number(configService.get('REDIS_PORT') || 6379);
        const isTls = configService.get('REDIS_TLS') === 'true';

        return {
          connection: {
            host,
            port,
            password: configService.get('REDIS_PASS'),
            retryStrategy: (times) => Math.min(times * 100, 3000),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            connectTimeout: 10000,
            tls: isTls ? { rejectUnauthorized: false } : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST');
        const port = Number(configService.get('REDIS_PORT') || 6379);
        const isTls = configService.get('REDIS_TLS') === 'true';

        if (!host || host === 'memory' || host === 'none') {
          return { store: 'memory', ttl: 600 };
        }

        return {
          store: redisStore,
          host,
          port,
          auth_pass: configService.get('REDIS_PASS'),
          ttl: 600,
          tls: isTls ? { rejectUnauthorized: false } : undefined,
          no_ready_check: true,
          retry_strategy: (options: any) => {
            if (options.total_retry_time > 1000 * 60 * 60) return undefined;
            return Math.min(options.attempt * 100, 3000);
          },
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    MailModule,
    AiContentModule,
    PostsModule,
    AccessControlModule,
    AnalyticsModule,
    SitemapModule,
    SeoModule,
    CrawlerModule,
    RecruitmentModule,
    NotificationsModule,
    MenusModule,
    PagesModule,
    ReviewsModule,
    SharedModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SeoRedirectFilter,
    },
  ],
})
export class AppModule { }
