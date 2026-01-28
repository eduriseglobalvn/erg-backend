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
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASS'),
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        auth_pass: configService.get('REDIS_PASS'),
        ttl: 600,
      }),
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
