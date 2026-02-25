import { Controller, Get, Query } from '@nestjs/common';
import { PostsService } from '@/modules/posts/posts.service';
import { STATIC_URLS } from './sitemap.constants';

@Controller('sitemap')
export class SitemapController {
    constructor(private readonly postsService: PostsService) { }

    @Get('data')
    async getSitemapData(@Query('domain') domain?: string) {
        // 1. Get filtered Posts
        const posts = await this.postsService.getSitemapUrls(domain);

        // 2. Filter Static Pages
        const targetDomain = domain ? (domain.startsWith('http') ? domain : `https://${domain}`) : null;

        let staticPages = STATIC_URLS;
        if (targetDomain) {
            staticPages = STATIC_URLS.filter(page => page.loc.startsWith(targetDomain));
        }

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
