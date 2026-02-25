import { Controller, Get, Param, Query, NotFoundException, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { PagesService } from './pages.service';

@Controller('pages')
export class PagesController {
    constructor(private readonly pagesService: PagesService) { }

    @Get(':slug')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300)
    async getPage(@Param('slug') slug: string, @Query('domain') domain?: string) {
        const page = await this.pagesService.findOne({ slug, domain });
        if (!page) {
            throw new NotFoundException(`Page '${slug}' not found${domain ? ` for domain '${domain}'` : ''}`);
        }
        return {
            data: {
                title: page.title,
                content: page.content,
                meta_title: page.metaTitle,
                meta_description: page.metaDescription,
                thumbnail: page.thumbnail,
                faq: page.faq
            }
        };
    }
}
