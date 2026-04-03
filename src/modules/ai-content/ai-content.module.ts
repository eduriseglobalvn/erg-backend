import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AiContentController } from './ai-content.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { AiGenerationProcessor } from './processors/ai-generation.processor';
import { ApiKeyService } from './services/api-key.service';
import { AiContentService } from './services/ai-content.service';
import { AiImageService } from './services/ai-image.service';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { ProviderHealthService } from './services/provider-health.service';
import { ApiKeyHealthService } from './services/api-key-health.service';
import { AiRateLimiterService } from './services/ai-rate-limiter.service';
import { ApiKey } from './entities/api-key.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';
import { UsersModule } from '@/modules/users/users.module';
import { SharedModule } from '@/shared/shared.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiKeyCryptoService } from './services/api-key-crypto.service';
import { ApiKeyRotationService } from './services/api-key-rotation.service';
import { SeoCoreModule } from '@/modules/seo/seo-core.module';
import { SeoTitleService } from '@/modules/seo/services/seo-title.service';
import { SeoMetaService } from '@/modules/seo/services/seo-meta.service';
import { SeoImageAltService } from '@/modules/seo/services/seo-image-alt.service';
import { SeoBatchService } from '@/modules/seo/services/seo-batch.service';
import { KeywordSuggestionService } from '@/modules/seo/services/keyword-suggestion.service';

const isWorkerOrLocal = process.env.START_MODE === 'worker' || !process.env.START_MODE;

@Module({
  imports: [
    CacheModule.register(),
    MikroOrmModule.forFeature([ApiKey, User, Post, PostCategory]),
    BullModule.registerQueue({
      name: 'ai-content-queue',
    }),
    UsersModule,
    SharedModule,
    SeoCoreModule,
    NotificationsModule,
  ],
  controllers: [AiContentController, ApiKeyController],
  providers: [
    ...(isWorkerOrLocal ? [AiGenerationProcessor] : []),
    ApiKeyService,
    ApiKeyCryptoService,
    ApiKeyRotationService,
    AiContentService,
    AiImageService,
    AIProviderFactory,
    ProviderHealthService,
    ApiKeyHealthService,
    AiRateLimiterService,
    SeoTitleService,
    SeoMetaService,
    SeoImageAltService,
    SeoBatchService,
    KeywordSuggestionService,
  ],
  exports: [
    ApiKeyService,
    ApiKeyCryptoService,
    ApiKeyRotationService,
    AiContentService,
    AiImageService,
    ProviderHealthService,
    AIProviderFactory,
    ApiKeyHealthService,
    AiRateLimiterService,
    SeoTitleService,
    SeoMetaService,
    SeoImageAltService,
    SeoBatchService,
    KeywordSuggestionService,
  ],
})
export class AiContentModule { }