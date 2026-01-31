import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { PostCategory } from '../posts/entities/post-category.entity';
import { PostStatus } from '@/shared/enums/app.enum';
import { CheerioCrawler, PlaywrightCrawler } from 'crawlee';
import { CrawlHistory } from './entities/crawl-history.entity';
import { ScraperType } from './entities/scraper-config.entity';
import { StorageService } from '@/shared/services/storage.service';
import { AiContentService } from '../ai-content/services/ai-content.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Processor('crawler')
export class CrawlerProcessor extends WorkerHost {
    private readonly logger = new Logger(CrawlerProcessor.name);

    constructor(
        private readonly crawlerService: CrawlerService,
        private readonly storageService: StorageService,
        private readonly aiService: AiContentService,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        switch (job.name) {
            case 'crawl_rss':
                return this.crawlerService.processRssFeed(job.data.rssId);
            case 'crawl_url':
                return this.processUrlCrawl(job.data);
            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }

    /**
     * Logic cào bài viết chi tiết (Strategy Pattern: Cheerio vs Playwright)
     */
    private async processUrlCrawl(data: any) {
        const { url, type, rssId, targetCategoryId, autoPublish, selectorConfig } = data;
        this.logger.log(`Processing URL: ${url} (Type: ${type || 'AUTO'})`);

        let title = '';
        let content = '';
        let originalThumbnail = '';

        const usePlaywright = type === ScraperType.DYNAMIC;

        try {
            if (!usePlaywright) {
                // Use Axios to fetch raw HTML -> Handle encoding/compression better than default CheerioCrawler
                try {
                    const response = await axios.get(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    const $ = cheerio.load(response.data);

                    // Clean unwanted elements
                    $('script, style, iframe, nav, header, footer, .ads, .comments, .related-posts, .menu').remove();

                    title = $(selectorConfig?.titleSelector).first().text().trim() ||
                        $('h1').first().text().trim() ||
                        $('title').first().text().trim();

                    // Heuristic: Content extraction
                    let bestDiv = '';
                    let maxScore = 0;

                    // ... (keep scoring logic if needed or simplify to selectors)
                    content = $(selectorConfig?.contentSelector).html() ||
                        $('.article__body').first().html() ||
                        $('.cms-body').first().html() ||
                        $('article').first().html() ||
                        $('.post-content').first().html() ||
                        $('.entry-content').first().html() ||
                        $('.detail-content').first().html() ||
                        $('.content-detail').first().html() ||
                        $('#content').first().html() ||
                        '';

                    originalThumbnail = $(selectorConfig?.thumbnailSelector || 'meta[property="og:image"]').attr('content') || '';

                } catch (err) {
                    this.logger.error(`Static crawl failed: ${err.message}`);
                    throw err;
                }
            } else {
                const crawler = new PlaywrightCrawler({
                    async requestHandler({ page, request }) {
                        title = await page.locator(selectorConfig?.titleSelector || 'h1').first().innerText();

                        if (selectorConfig?.contentSelector) {
                            content = await page.locator(selectorConfig.contentSelector).innerHTML();
                        } else {
                            // Playwright clean up
                            await page.evaluate(() => {
                                const elementsToRemove = document.querySelectorAll('script, style, iframe, nav, header, footer, .ads, .comments');
                                elementsToRemove.forEach(el => el.remove());
                            });

                            const selectors = ['article', '.post-content', '.entry-content', '#content'];
                            let found = false;
                            for (const sel of selectors) {
                                if (await page.locator(sel).count() > 0) {
                                    content = await page.locator(sel).first().innerHTML();
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                content = await page.evaluate(() => {
                                    const divs = document.querySelectorAll('div, section, article');
                                    let maxP = 0;
                                    let bestHtml = '';
                                    divs.forEach(div => {
                                        const pCount = div.querySelectorAll('p').length;
                                        let bonus = 0;
                                        if (div.tagName.toLowerCase() === 'article' || div.className.includes('content')) bonus = 5;

                                        if ((pCount + bonus) > maxP) {
                                            maxP = pCount + bonus;
                                            bestHtml = div.innerHTML;
                                        }
                                    });
                                    return bestHtml;
                                });
                            }
                        }
                        originalThumbnail = await page.getAttribute('meta[property="og:image"]', 'content') || '';
                    },
                });
                await crawler.run([url]);
            }

            if (!title) throw new Error('Empty title found');
            if (!content) throw new Error('Empty content found');

            // Final cleaning of content
            const $clean = cheerio.load(content);
            $clean('script, style, iframe').remove(); // Double check
            $clean('a').each((i, el) => { $clean(el).removeAttr('href'); }); // Remove links to avoid navigating away
            content = $clean.html();

            this.logger.log(`Processing images for: ${title}`);
            const processedContent = await this.processImages(content);
            const thumbnailUrl = originalThumbnail ? await this.downloadAndUploadImage(originalThumbnail, 'thumbnails') : null;

            this.logger.log(`Generating AI Metadata for: ${title}`);
            const seoData = await this.generateSeoMetadata(title, processedContent);

            this.logger.log(`Crawled success: ${title}`);

            const em = this.postRepo.getEntityManager();
            const admin = await this.userRepo.findOne({ email: 'admin@erg.edu.vn' }) || await this.userRepo.findOne({ id: { $ne: null } } as any);

            const post = this.postRepo.create({
                title,
                slug: this.slugify(title),
                content: processedContent,
                excerpt: seoData.excerpt,
                thumbnailUrl: thumbnailUrl,
                status: autoPublish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
                category: targetCategoryId ? em.getReference(PostCategory, targetCategoryId) : undefined,
                author: admin ? em.getReference(User, admin.id) : em.getReference(User, '1' as any),
                createdBy: admin ? em.getReference(User, admin.id) : em.getReference(User, '1' as any),
                isPublished: autoPublish,
                publishedAt: autoPublish ? new Date() : undefined,
                metaTitle: seoData.metaTitle,
                metaDescription: seoData.metaDescription,
                keywords: seoData.keywords,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);

            await em.persistAndFlush(post);
            await this.saveHistory(url, rssId, 'SUCCESS', undefined, post.id);

        } catch (error) {
            this.logger.error(`Crawl failed for ${url}: ${error.message}`);
            await this.saveHistory(url, rssId, 'FAILED', error.message);
        }

    }

    private async saveHistory(url: string, sourceId: string | undefined | null, status: 'SUCCESS' | 'FAILED', errorMsg?: string, postId?: string) {
        if (!url) return;
        try {
            let history = await this.historyRepo.findOne({ url });
            if (!history) {
                history = this.historyRepo.create({
                    url,
                    sourceId: sourceId || undefined,
                    status: status as any,
                    errorMessage: errorMsg,
                    postId,
                    crawledAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            } else {
                history.status = status;
                history.errorMessage = errorMsg;
                if (postId) history.postId = postId;
                history.crawledAt = new Date();
                // Update sourceId if we have it now
                if (sourceId && !history.sourceId) {
                    history.sourceId = sourceId;
                }
            }
            await this.historyRepo.getEntityManager().persistAndFlush(history);
            this.logger.log(`History saved for ${url} - Status: ${status} - PostID: ${postId}`);
        } catch (e) {
            this.logger.error(`Failed to save history for ${url}: ${e.message}`);
        }
    }

    // ... (helper methods below)

    /**
     * Download tất cả ảnh trong content và upload lên R2
     */
    private async processImages(html: string): Promise<string> {
        const $ = cheerio.load(html);
        const images = $('img').toArray();

        for (const img of images) {
            const src = $(img).attr('src');
            if (src && src.startsWith('http')) {
                try {
                    const localUrl = await this.downloadAndUploadImage(src, 'blog');
                    $(img).attr('src', localUrl);
                    $(img).removeAttr('srcset'); // Xóa srcset của web cũ
                } catch (e) {
                    this.logger.warn(`Failed to process image ${src}: ${e.message}`);
                }
            }
        }
        return $.html();
    }

    private async downloadAndUploadImage(url: string, folder: string): Promise<string> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        return await this.storageService.processAndUpload(buffer, folder);
    }

    /**
     * Dùng Gemini AI để tạo SEO Meta
     */
    private async generateSeoMetadata(title: string, content: string) {
        const admin = await this.userRepo.findOne({ id: { $ne: null } } as any);
        if (!admin) return { metaTitle: title, metaDescription: '', excerpt: '', keywords: '' };

        const plainText = content.replace(/<[^>]*>?/gm, '').substring(0, 2000);
        const instruction = `Dựa trên tiêu đề "${title}" và nội dung sau, hãy tạo dữ liệu SEO chuẩn.
        Trả về kết quả dưới dạng JSON có các trường: metaTitle, metaDescription, excerpt, keywords.
        Lưu ý: Không giải thích gì thêm, chỉ trả về JSON raw.`;

        try {
            const result = await this.aiService.refineText(plainText, instruction, admin);
            // Parse JSON từ AI
            const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            this.logger.error(`AI SEO Generation failed: ${error.message}`);
            return { metaTitle: title, metaDescription: '', excerpt: '', keywords: '' };
        }
    }

    private slugify(text: string) {
        return text.toString().toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-\u00C0-\u1EF9]+/g, '') // Giữ lại tiếng Việt
            .replace(/\-\-+/g, '-');
    }
}
