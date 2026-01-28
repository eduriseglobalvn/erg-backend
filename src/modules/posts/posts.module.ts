import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CategoriesController } from './categories.controller';
import { Post } from './entities/post.entity';
import { PostCategory } from './entities/post-category.entity';
import { SeoModule } from '@/modules/seo/seo.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Post, PostCategory]),
    SeoModule,
  ],
  controllers: [CategoriesController, PostsController],
  providers: [PostsService],
  exports: [PostsService], // Export để module khác (như AI) dùng lại service
})
export class PostsModule { }
