import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Post } from '@/modules/posts/entities/post.entity';
import * as cheerio from 'cheerio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SitemapService {
    private siteUrl: string;

    constructor(
        private readonly em: EntityManager,
        private readonly configService: ConfigService,
    ) {
        this.siteUrl = this.configService.get('SITE_URL', 'https://erg.edu.vn');
    }

    async generateImageSitemap(): Promise<string> {
        const posts = await this.em.find(Post, {
            isPublished: true,
            robotsIndex: true,
        }, {
            fields: ['slug', 'content', 'title'],
        });

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
        xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

        for (const post of posts) {
            const images = this.extractImages(post.content || '');
            if (images.length === 0) continue;

            const loc = this.siteUrl.endsWith('/') ? `${this.siteUrl}${post.slug}` : `${this.siteUrl}/${post.slug}`;

            xml += '  <url>\n';
            xml += `    <loc>${loc}</loc>\n`;
            for (const img of images) {
                xml += '    <image:image>\n';
                xml += `      <image:loc>${img.url}</image:loc>\n`;
                if (img.title) {
                    xml += `      <image:title>${this.escapeXml(img.title)}</image:title>\n`;
                }
                if (img.caption) {
                    xml += `      <image:caption>${this.escapeXml(img.caption)}</image:caption>\n`;
                }
                xml += '    </image:image>\n';
            }
            xml += '  </url>\n';
        }

        xml += '</urlset>';
        return xml;
    }

    private extractImages(html: string): Array<{ url: string; title?: string; caption?: string }> {
        const $ = cheerio.load(html);
        const images: Array<{ url: string; title?: string; caption?: string }> = [];

        $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (src && (src.startsWith('http') || src.startsWith('/'))) {
                const fullUrl = src.startsWith('/')
                    ? (this.siteUrl.endsWith('/') ? `${this.siteUrl.slice(0, -1)}${src}` : `${this.siteUrl}${src}`)
                    : src;

                images.push({
                    url: fullUrl,
                    title: $(el).attr('alt') || $(el).attr('title'),
                    caption: $(el).attr('alt'),
                });
            }
        });

        return images;
    }

    private escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&"']/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
                default: return c;
            }
        });
    }
}
