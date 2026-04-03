import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Response, Request } from 'express';
import { PostsService } from '@/modules/posts/posts.service';
import { STATIC_URLS } from './sitemap.constants';

@Controller()
export class SitemapController {
    constructor(private readonly postsService: PostsService) { }

    @Get('sitemap/data')
    // Giữ nguyên cache cũ nếu FE vẫn dùng nó
    // Removed cache interceptors here for clarity, they can be added back if strongly needed.
    // Or just rely on fast DB queries.
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

    @Get('sitemap_index.xml')
    getSitemapIndex(@Req() req: Request, @Res() res: Response) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host || 'erg.edu.vn';
        const baseUrl = `${protocol}://${host}`;

        const domains = [
            'erg.edu.vn',
            'ai.erg.edu.vn',
            'tinhocquocte.erg.edu.vn',
            'tinhocquocgia.erg.edu.vn',
            'tinhocthieunhi.erg.edu.vn',
            'congdanso.erg.edu.vn',
            'dientoandammay.erg.edu.vn',
            'elearning.erg.edu.vn',
            'tuyendung.erg.edu.vn',
            'ielts.erg.edu.vn',
            'toeic.erg.edu.vn',
            'kids.erg.edu.vn'
        ];

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        domains.forEach(domain => {
            // Chỉ trả sub sitemap cho chính domain đang route nếu muốn, hoặc trả hết cho root domain
            xml += `  <sitemap>\n`;
            xml += `    <loc>${baseUrl}/sitemap-${domain.split('.')[0]}.xml</loc>\n`;
            xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
            xml += `  </sitemap>\n`;
        });

        xml += '</sitemapindex>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    }

    @Get('sitemap.xml')
    async getRootSitemap(@Req() req: Request, @Res() res: Response) {
        // Fallback root sitemap
        const host = req.headers.host || 'erg.edu.vn';
        return this.generateSitemapXmlForDomain(host, res);
    }

    @Get('sitemap-:sub.xml')
    async getSubSitemap(@Req() req: Request, @Res() res: Response, @Query('sub') subParam?: string) {
        // Tùy thuộc vào rule của Nest, có thể route matching sẽ lấy :sub qua @Param('sub') thay vì Query
        let sub = req.url.match(/sitemap-(.*)\.xml/)?.[1];
        if (!sub) sub = 'main';

        const domainMap: Record<string, string> = {
            'main': 'erg.edu.vn',
            'ai': 'ai.erg.edu.vn',
            'tinhocquocte': 'tinhocquocte.erg.edu.vn',
            'tinhocquocgia': 'tinhocquocgia.erg.edu.vn',
            'tinhocthieunhi': 'tinhocthieunhi.erg.edu.vn',
            'congdanso': 'congdanso.erg.edu.vn',
            'dientoandammay': 'dientoandammay.erg.edu.vn',
            'elearning': 'elearning.erg.edu.vn',
            'tuyendung': 'tuyendung.erg.edu.vn',
            'ielts': 'ielts.erg.edu.vn',
            'toeic': 'toeic.erg.edu.vn',
            'kids': 'kids.erg.edu.vn',
            'erg': 'erg.edu.vn'
        };

        const targetDomain = domainMap[sub] || 'erg.edu.vn';
        return this.generateSitemapXmlForDomain(targetDomain, res);
    }

    private async generateSitemapXmlForDomain(domain: string, res: Response) {
        try {
            const dataResponse = await this.getSitemapData(domain);
            const urls = dataResponse.data.urls;

            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

            urls.forEach((u: any) => {
                if (!u) return;
                xml += `  <url>\n`;
                xml += `    <loc>${u.loc}</loc>\n`;
                if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
                if (u.changefreq) xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
                if (u.priority) xml += `    <priority>${u.priority}</priority>\n`;
                xml += `  </url>\n`;
            });

            xml += '</urlset>';

            res.header('Content-Type', 'application/xml');
            res.send(xml);
        } catch (e) {
            res.status(500).send('Error generating sitemap');
        }
    }
}
