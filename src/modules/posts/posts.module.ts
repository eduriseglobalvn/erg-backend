import { Module, forwardRef } from '@nestjs/common';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CategoriesController } from './categories.controller';
import { Post } from './entities/post.entity';
import { PostCategory } from './entities/post-category.entity';
import { SeoModule } from '@/modules/seo/seo.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Post, PostCategory]),
    forwardRef(() => SeoModule),

    NotificationsModule,
    ReviewsModule, // Import to use ReviewsService
  ],
  controllers: [CategoriesController, PostsController],
  providers: [PostsService],
  exports: [PostsService], // Export để module khác (như AI) dùng lại service
})
export class PostsModule { }
