import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SitemapService } from './services/sitemap.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('SEO')
@Controller('api/sitemap')
export class SitemapController {
    constructor(private readonly sitemapService: SitemapService) { }

    @Get('images.xml')
    @Header('Content-Type', 'application/xml')
    @ApiOperation({ summary: 'Generate Google Image Sitemap' })
    async getImageSitemap(@Res() res: Response) {
        const xml = await this.sitemapService.generateImageSitemap();
        return res.send(xml);
    }
}
