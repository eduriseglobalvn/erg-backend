import { Controller, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class RobotsController {
    constructor(private configService: ConfigService) { }

    @Get('robots.txt')
    @Header('Content-Type', 'text/plain')
    getRobots(@Req() req: Request): string {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host || this.configService.get('SITE_URL', 'erg.edu.vn').replace(/^https?:\/\//, '');
        const sitemapUrl = `${protocol}://${host}/sitemap.xml`;

        // Cơ bản nhất: cho phép crawl public, chặn API admin
        return `User-agent: *
Allow: /
Disallow: /api/admin/
Disallow: /auth/
Disallow: /preview/

Sitemap: ${sitemapUrl}
`;
    }
}
