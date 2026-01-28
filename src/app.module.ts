import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisStore = require('cache-manager-redis-store');
import { DatabaseModule } from '@/shared/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from '@/shared/mail/mail.module';
import { AiContentModule } from '@/modules/ai-content/ai-content.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { SitemapModule } from '@/modules/sitemap/sitemap.module';
import { SeoModule } from '@/modules/seo/seo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Để các module khác không cần import lại
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST');
        if (!host) {
          // If no Redis, BullMQ won't work properly, but we can return a dummy config or localhost
          // For now, return localhost to avoid crash if env is missing
          return {
            connection: { host: '127.0.0.1', port: 6379 }
          };
        }
        const port = configService.get<number>('REDIS_PORT');
        const isTls = port !== 6379;

        return {
          connection: {
            host,
            port,
            password: configService.get('REDIS_PASS'),
            // Thêm các options giúp ổn định kết nối với Valkey/Redis
            retryStrategy: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: null,
            tls: isTls ? {} : undefined,
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
        const port = configService.get<number>('REDIS_PORT');
        const isTls = port !== 6379;

        // NẾU KHÔNG CÓ REDIS_HOST HOẶC MUỐN DÙNG MEMORY (VALKEY FALLBACK)
        if (!host || host === 'memory' || host === 'none') {
          return { store: 'memory', ttl: 600 };
        }

        return {
          store: redisStore,
          host,
          port,
          auth_pass: configService.get('REDIS_PASS'),
          ttl: 600,
          tls: isTls ? {} : undefined,
          no_ready_check: true, // Thêm cái này để tránh Ready check failed trên Cloud
          // Quan trọng: Tránh crash app khi mất kết nối Redis/Valkey
          retry_strategy: (options: any) => {
            if (options.attempt > 10) return undefined; // Dừng retry sau 10 lần
            return Math.min(options.attempt * 100, 3000);
          },
        };
      },
      inject: [ConfigService],
    }),
    // 1. Module Database (Global)
    DatabaseModule,

    // 2. Module Nghiệp vụ (QUAN TRỌNG: Phải khai báo ở đây thì autoLoadEntities mới thấy)
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
  ],
})
export class AppModule { }
