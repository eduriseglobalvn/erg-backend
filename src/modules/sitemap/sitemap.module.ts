import { Module } from '@nestjs/common';
import { SitemapController } from './sitemap.controller';
import { RobotsController } from './robots.controller';
import { PostsModule } from '@/modules/posts/posts.module';

@Module({
    imports: [PostsModule],
    controllers: [SitemapController, RobotsController],
})
export class SitemapModule { }
