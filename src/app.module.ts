import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SeoRedirectFilter } from '@/modules/seo/filters/seo-redirect.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from '@/config/env.validation';
import * as Joi from 'joi';
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
import { AuditModule } from '@/modules/audit/audit.module';
import { CoursesModule } from '@/modules/courses/courses.module';
import { OperationsModule } from '@/modules/operations/operations.module';
import { ElearningModule } from '@/modules/elearning/elearning.module';
import { IpProtectionMiddleware } from './core/middlewares/ip-protection.middleware';
import { QueueMonitorModule } from './shared/queue-monitor/queue-monitor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Để các module khác không cần import lại
      envFilePath: '.env',
      validate,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
        PORT: Joi.number().default(4000),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        // MySQL - thống nhất prefix DB_* (dùng bởi MikroORM)
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().allow(''),
        DB_NAME: Joi.string().required(),
        // MongoDB
        MONGO_URL: Joi.string().required(),
        MONGO_DB_NAME: Joi.string().optional(),
        // Redis
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().optional().default(6379),
        REDIS_PASS: Joi.string().optional().allow(''),
        REDIS_TLS: Joi.string().optional().default('false'),
        // Admin
        ADMIN_DEFAULT_PASSWORD: Joi.string().required(),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 20 },
          { name: 'medium', ttl: 60000, limit: 200 },
          { name: 'long', ttl: 3600000, limit: 1000 },
          { name: 'auth-login', ttl: 900000, limit: 5 }, // 5 lần / 15 phút
          { name: 'auth-register', ttl: 3600000, limit: 3 }, // 3 lần / giờ
        ],
        storage: new (require('@nest-lab/throttler-storage-redis').ThrottlerStorageRedisService)(
          new (require('ioredis').Redis)({
            host: config.get('REDIS_HOST') || 'localhost',
            port: Number(config.get('REDIS_PORT')) || 6379,
            password: config.get('REDIS_PASS'),
            tls: config.get('REDIS_TLS') === 'true' ? { rejectUnauthorized: false } : undefined,
          })
        ),
      }),
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
          if (configService.get('NODE_ENV') === 'production') {
            throw new Error('REDIS_HOST is required in production environments to prevent inconsistent distributed caching.');
          }
          return { store: 'memory', ttl: 600 };
        }

        return {
          store: redisStore,
          host,
          port,
          auth_pass: configService.get('REDIS_PASS'),
          ttl: 600,
          // Upstash / Redis Cloud đều yêu cầu TLS
          tls: isTls
            ? { rejectUnauthorized: false, servername: host }
            : undefined,
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
    AuditModule,
    CoursesModule,
    OperationsModule,
    ElearningModule,
    QueueMonitorModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SeoRedirectFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpProtectionMiddleware).forRoutes('*');
  }
}
