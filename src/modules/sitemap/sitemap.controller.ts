import { Controller, Get, Query } from '@nestjs/common';
import { PostsService } from '@/modules/posts/posts.service';
import { STATIC_URLS } from './sitemap.constants';

@Controller('sitemap')
export class SitemapController {
    constructor(private readonly postsService: PostsService) { }

    @Get('data')
    async getSitemapData() {
        // 1. Get Posts
        const posts = await this.postsService.getSitemapUrls();

        // 2. Static Pages (From Constants)
        const staticPages = STATIC_URLS;

        return {
            data: {
                urls: [
                    ...staticPages,
                    ...posts
                ]
            }
        };
    }
}
