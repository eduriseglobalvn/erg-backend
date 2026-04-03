import { Module, forwardRef } from '@nestjs/common';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CategoriesController } from './categories.controller';
import { Post } from './entities/post.entity';
import { PostCategory } from './entities/post-category.entity';
import { AuthModule } from '@/modules/auth/auth.module';
import { SeoModule } from '@/modules/seo/seo.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Post, PostCategory]),
    forwardRef(() => SeoModule),


    AuthModule, // Added AuthModule
    NotificationsModule,
    ReviewsModule, // Import to use ReviewsService
  ],
  controllers: [CategoriesController, PostsController],
  providers: [PostsService],
  exports: [PostsService, MikroOrmModule], // Export MikroOrmModule to share PostRepository
})
export class PostsModule { }
