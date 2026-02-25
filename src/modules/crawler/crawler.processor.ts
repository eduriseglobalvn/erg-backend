import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
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
import { PostsService } from '../posts/posts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { SeoTitleService } from '../seo/services/seo-title.service';
import { SeoMetaService } from '../seo/services/seo-meta.service';
import { SeoImageAltService } from '../seo/services/seo-image-alt.service';
import { SeoContentService } from '../seo/services/seo-content.service';
import { AutoLinkingService } from '../seo/services/auto-linking.service';

@Processor('crawler', { concurrency: 5 })
export class CrawlerProcessor extends WorkerHost {
    private readonly logger = new Logger(CrawlerProcessor.name);

    constructor(
        private readonly crawlerService: CrawlerService,
        private readonly storageService: StorageService,
        private readonly aiService: AiContentService,
        private readonly postsService: PostsService,
        private readonly notificationsService: NotificationsService,
        private readonly seoTitleService: SeoTitleService,
        private readonly seoMetaService: SeoMetaService,
        private readonly seoImageAltService: SeoImageAltService,
        private readonly seoContentService: SeoContentService,
        private readonly autoLinkingService: AutoLinkingService,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        @InjectRepository(User)
        private readonly userRepo: EntityRepository<User>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
    ) {
        super();
    }

    async process(job: Job<any>): Promise<any> {
        this.logger.log(`[JOB START] ID: ${job.id} | Name: ${job.name} | URL: ${job.data.url || 'N/A'}`);
        switch (job.name) {
            case 'crawl_rss':
                return this.crawlerService.processRssFeed(job.data.rssId);
            case 'crawl_url':
                return await this.processUrlCrawl(job.data);
            default:
                this.logger.warn(`[JOB UNKNOWN] ID: ${job.id} | Name: ${job.name}`);
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }

    /**
     * Logic cào bài viết chi tiết
     */
    private async processUrlCrawl(data: any) {
        const { url, type, rssId, targetCategoryId, autoPublish, selectorConfig, manual } = data;
        this.logger.log(`Processing URL: ${url} (Type: ${type || 'AUTO'})`);

        // Fork EM để tránh tranh chấp dữ liệu giữa các job song song
        const em = this.postRepo.getEntityManager().fork();
        const mongoEm = this.historyRepo.getEntityManager().fork();

        // [CRITICAL FIX] Guard: Chỉ skip nếu KHÔNG phải manual VÀ bài thực sự tồn tại trong MySQL
        if (!manual) {
            const history = await mongoEm.findOne(CrawlHistory, { url });
            if (history && history.postId) {
                // Kiểm tra thực tế trong MySQL
                const post = await em.findOne(Post, { id: history.postId, deletedAt: null });
                if (post) {
                    this.logger.log(`✓ URL already has valid post in MySQL. Skipping: ${url}`);
                    return;
                }
            }
        } else {
            this.logger.log(`⚡ [MANUAL CRAWL] Forcing execution for: ${url}`);
        }

        this.logger.log(`[CRAWL BEGIN] URL: ${url}`);

        let title = '';
        let content = '';
        let originalThumbnail = '';

        const usePlaywright = type === ScraperType.DYNAMIC;

        try {
            if (!usePlaywright) {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const $ = cheerio.load(response.data);
                $('script, style, iframe, nav, header, footer, .ads, .comments, .related-posts, .menu').remove();

                title = $(selectorConfig?.titleSelector).first().text().trim() ||
                    $('h1').first().text().trim() ||
                    $('title').first().text().trim();

                content = $(selectorConfig?.contentSelector).html() ||
                    $('.article__body').first().html() ||
                    $('article').first().html() ||
                    '';

                originalThumbnail = $(selectorConfig?.thumbnailSelector || 'meta[property="og:image"]').attr('content') || '';
            } else {
                const crawler = new PlaywrightCrawler({
                    async requestHandler({ page }) {
                        title = await page.locator(selectorConfig?.titleSelector || 'h1').first().innerText();
                        if (selectorConfig?.contentSelector) {
                            content = await page.locator(selectorConfig.contentSelector).innerHTML();
                        } else {
                            const sel = ['article', '.post-content', '.entry-content', '#content'];
                            for (const s of sel) {
                                if (await page.locator(s).count() > 0) {
                                    content = await page.locator(s).first().innerHTML();
                                    break;
                                }
                            }
                        }
                        originalThumbnail = await page.getAttribute('meta[property="og:image"]', 'content') || '';
                    },
                });
                await crawler.run([url]);
            }

            if (!title) throw new Error('Empty title found');
            if (!content) throw new Error('Empty content found');

            // Clean content
            const $clean = cheerio.load(content);
            $clean('script, style, iframe').remove();
            $clean('a').each((i, el) => { $clean(el).removeAttr('href'); });
            content = $clean.html();

            let processedContent = await this.processImages(content);
            const thumbnailUrl = originalThumbnail ? await this.downloadAndUploadImage(originalThumbnail, 'thumbnails') : null;

            const admin = await em.findOne(User, { email: 'admin@erg.edu.vn' }) || await em.findOne(User, { id: { $ne: null } } as any);
            if (!admin) throw new Error('Admin user not found for AI optimization');

            // [BEST-PRACTICE] Use AI SEO Services for crawl optimization
            let seoData = { metaTitle: title, metaDescription: '', excerpt: '', keywords: '' };
            try {
                // 1. Generate SEO-optimized Title
                const titles = await this.seoTitleService.generateTitles(title, processedContent, admin);
                seoData.metaTitle = titles[0]?.title || title;

                // 2. Generate SEO-optimized Meta Description
                const metas = await this.seoMetaService.generateMetaDescriptions(title, processedContent, admin);
                seoData.metaDescription = metas[0]?.description || '';
                seoData.excerpt = seoData.metaDescription;

                // 3. Generate Alt Texts for all images automatically
                const altResults = await this.seoImageAltService.generateAltTexts(processedContent, title, admin);

                // Patch content with suggested alt texts
                const $alt = cheerio.load(processedContent);
                altResults.forEach(res => {
                    $alt(`img[src="${res.imageUrl}"]`).attr('alt', res.suggestedAlt);
                });
                processedContent = $alt.html();

                this.logger.log(`[AI SEO COMPLETED] Optimized Title, Meta and ${altResults.length} Alt texts for: ${url}`);

                // 4. Advanced Content Optimization: Paraphrasing for Uniqueness
                // This makes crawled content unique and better structured
                processedContent = await this.seoContentService.paraphraseForSeo(processedContent, title, admin);
                processedContent = await this.seoContentService.optimizeHtmlStructure(processedContent);

                this.logger.log(`[AI SEO COMPLETED] Optimized Title, Meta and ${altResults.length} Alt texts for: ${url}`);
            } catch (aiError) {
                this.logger.warn(`[AI SEO PARTIAL ERROR] ${aiError.message} - Using fallbacks`);
                const plainText = processedContent.replace(/<[^>]*>?/gm, '');
                seoData.excerpt = plainText.substring(0, 200) + '...';
                seoData.metaDescription = seoData.excerpt;
            }

            const post = await this.postsService.create({
                title,
                slug: this.slugify(title) + '-' + Math.random().toString(36).substring(2, 6),
                content: processedContent,
                excerpt: seoData.excerpt,
                thumbnailUrl: thumbnailUrl || undefined,
                status: autoPublish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
                categoryId: targetCategoryId,
                metaTitle: seoData.metaTitle,
                metaDescription: seoData.metaDescription,
                keywords: seoData.keywords,
                focusKeyword: title.split(' ').slice(0, 3).join(' '),
                // Pass AI-related data for notification detection
                isCreatedByAI: false,
                aiPrompt: `Crawled from: ${url}`,
                aiJobId: data.jobId,
            } as any, admin);

            // 5. Auto-linking keywords (Post-creation SEO Polish)
            try {
                const linkResult = await this.autoLinkingService.applyAutoLinks(post.content || '', post.id);
                post.content = linkResult.updatedContent;
                await em.flush();
                this.logger.log(`[AUTO-LINK] Applied ${linkResult.linksAdded} links to Post: ${post.id}`);
            } catch (linkError) {
                this.logger.warn(`[AUTO-LINK FAILED] ${linkError.message}`);
            }

            await this.saveHistory(mongoEm, url, rssId, 'SUCCESS', undefined, post.id);
            this.logger.log(`✅ [CRAWL SUCCESS] URL: ${url} | Post ID: ${post.id}`);

        } catch (error) {
            this.logger.error(`❌ [CRAWL FAILED] URL: ${url} | Error: ${error.message}`);
            this.logger.error(`[CRAWL ERROR STACK] ${error.stack}`);
            await this.saveHistory(mongoEm, url, rssId, 'FAILED', error.message);

            // Gửi thông báo lỗi
            const em = this.postRepo.getEntityManager();
            const admin = await em.findOne(User, { email: 'admin@erg.edu.vn' });
            if (admin) {
                await this.notificationsService.create({
                    userId: admin.id,
                    type: NotificationType.CRAWL_FAILED,
                    title: 'Cào bài viết thất bại',
                    message: `Không thể cào: ${url}. Lỗi: ${error.message}`,
                    metadata: {
                        url,
                        rssId,
                        error: error.message,
                    },
                });
            }
        }
    }

    private async saveHistory(mongoEm: any, url: string, sourceId: string | undefined | null, status: 'SUCCESS' | 'FAILED', errorMsg?: string, postId?: string) {
        if (!url) return;
        try {
            let history = await mongoEm.findOne(CrawlHistory, { url });
            if (!history) {
                history = mongoEm.create(CrawlHistory, {
                    url,
                    sourceId: sourceId || undefined,
                    status,
                    errorMessage: errorMsg,
                    postId,
                    crawledAt: new Date(),
                });
            } else {
                history.status = status;
                history.errorMessage = errorMsg;
                if (postId) history.postId = postId;
                history.crawledAt = new Date();
                if (sourceId) history.sourceId = sourceId;
            }
            await mongoEm.persistAndFlush(history);
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
    private async generateSeoMetadata(title: string, content: string, user?: User) {
        if (!user) return { metaTitle: title, metaDescription: '', excerpt: '', keywords: '' };

        const plainText = content.replace(/<[^>]*>?/gm, '').substring(0, 2000);
        const instruction = `Dựa trên tiêu đề "${title}" và nội dung sau, hãy tạo dữ liệu SEO chuẩn.
        Trả về kết quả dưới dạng JSON có các trường: metaTitle, metaDescription, excerpt, keywords.
        Lưu ý: Không giải thích gì thêm, chỉ trả về JSON raw.`;

        try {
            const result = await this.aiService.refineText(plainText, instruction, user);
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
