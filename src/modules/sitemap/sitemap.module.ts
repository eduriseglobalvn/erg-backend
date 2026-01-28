import { Module } from '@nestjs/common';
import { SitemapController } from './sitemap.controller';
import { PostsModule } from '@/modules/posts/posts.module';

@Module({
    imports: [PostsModule],
    controllers: [SitemapController],
})
export class SitemapModule { }
