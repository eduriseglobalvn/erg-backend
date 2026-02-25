import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AiContentController } from './ai-content.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { AiGenerationProcessor } from './processors/ai-generation.processor';
import { ApiKeyService } from './services/api-key.service';
import { AiContentService } from './services/ai-content.service';
// 1. IMPORT SERVICE NÀY VÀO
import { ImageGenService } from './services/image-gen.service';
import { ApiKey } from './entities/api-key.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UsersModule } from '@/modules/users/users.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { SharedModule } from '@/shared/shared.module';
import { SeoModule } from '@/modules/seo/seo.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([ApiKey, User]),
    BullModule.registerQueue({
      name: 'ai-content-queue',
    }),
    UsersModule,

    forwardRef(() => PostsModule),
    SharedModule,
    forwardRef(() => SeoModule),
    NotificationsModule,
  ],
  controllers: [AiContentController, ApiKeyController],
  providers: [
    AiGenerationProcessor,
    ApiKeyService,
    AiContentService,
    // 2. ĐĂNG KÝ NÓ Ở ĐÂY THÌ PROCESSOR MỚI DÙNG ĐƯỢC
    ImageGenService,
  ],
  exports: [ApiKeyService, AiContentService, ImageGenService],
})
export class AiContentModule { }