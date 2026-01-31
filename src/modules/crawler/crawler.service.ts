import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Parser from 'rss-parser';
import { RssFeed } from './entities/rss-feed.entity';
import { ScraperConfig } from './entities/scraper-config.entity';
import { CrawlHistory } from './entities/crawl-history.entity';
import { ScraperType } from './entities/scraper-config.entity';
import { Post } from '../posts/entities/post.entity';
import { PostCategory } from '../posts/entities/post-category.entity';

@Injectable()
export class CrawlerService {
    private readonly logger = new Logger(CrawlerService.name);
    private readonly rssParser = new Parser();

    constructor(
        @InjectQueue('crawler') private crawlerQueue: Queue,
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepo: EntityRepository<RssFeed>,
        @InjectRepository(ScraperConfig, 'mongo-connection')
        private readonly configRepo: EntityRepository<ScraperConfig>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        @InjectRepository(PostCategory)
        private readonly categoryRepo: EntityRepository<PostCategory>,
    ) { }

    /**
     * Trigger cào RSS thủ công hoặc từ Scheduler
     */
    async triggerRssCrawl(rssId: string) {
        const feed = await this.rssRepo.findOne({ id: rssId });
        if (!feed) throw new Error('RSS Feed not found');
        if (!feed.isActive) {
            this.logger.warn(`RSS Feed ${feed.name} is disabled. Skipping.`);
            return;
        }

        this.logger.log(`Triggering RSS crawl for: ${feed.name}`);
        await this.crawlerQueue.add('crawl_rss', { rssId: feed.id });
        return { message: 'RSS Crawl job added to queue' };
    }

    /**
     * Trigger cào 1 URL cụ thể (FE gửi lên test)
     */
    async triggerUrlCrawl(url: string, type?: ScraperType, targetCategoryId?: string) {
        this.logger.log(`Manual trigger for URL: ${url} (Cat: ${targetCategoryId})`);

        // Thử tìm cấu hình dựa trên Domain
        let selectorConfig: any = undefined;
        let scraperType = type || ScraperType.STATIC;

        try {
            const domain = new URL(url).hostname.replace('www.', '');
            const config = await this.configRepo.findOne({ domain } as any);
            if (config) {
                selectorConfig = config.selectorConfig;
                scraperType = type || config.type;
                this.logger.log(`Found scraper config for domain: ${domain}`);
            }
        } catch (e) {
            this.logger.warn(`Invalid URL provided: ${url}`);
        }

        await this.crawlerQueue.add('crawl_url', {
            url,
            type: scraperType,
            selectorConfig,
            targetCategoryId, // Pass category ID
            manual: true
        });
        return { message: 'URL Crawl job added to queue' };
    }

    /**
     * Logic chính: Parse RSS lấy danh sách link
     */
    async processRssFeed(rssId: string) {
        const feed = await this.rssRepo.findOne({ id: rssId });
        if (!feed) return;

        try {
            // Fix: Fetch raw XML and clean whitespace/BOM characters that cause parsing errors
            const response = await axios.get(feed.url, { responseType: 'text' });
            const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
            const parsed = await this.rssParser.parseString(xml);
            this.logger.log(`Found ${parsed.items.length} items in RSS: ${feed.name}`);

            for (const item of parsed.items) {
                if (!item.link) continue;

                // Check lịch sử xem cào chưa
                const exists = await this.historyRepo.findOne({ url: item.link });
                if (exists && exists.status === 'SUCCESS') {
                    continue; // Đã cào rồi -> Bỏ qua
                }

                // Đẩy job cào bài viết con
                await this.crawlerQueue.add('crawl_url', {
                    url: item.link,
                    rssId: feed.id,
                    targetCategoryId: feed.targetCategoryId,
                    autoPublish: feed.autoPublish, // Kế thừa quyền đăng
                    selectorConfig: feed.selectorConfig // Kế thừa config selector
                });
            }
        } catch (error) {
            this.logger.error(`Failed to parse RSS ${feed.url}`, error.stack);
        }
    }

    /**
     * Parse RSS và trả về danh sách để FE chọn (không cào ngay)
     */
    async peekRss(rssId: string) {
        const feed = await this.rssRepo.findOne({ id: rssId });
        if (!feed) throw new Error('RSS Feed not found');

        const response = await axios.get(feed.url, { responseType: 'text' });
        const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
        const parsed = await this.rssParser.parseString(xml);

        // Helper to extract image
        const getThumbnail = (item: any) => {
            if (item.enclosure && item.enclosure.url) return item.enclosure.url;
            if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
            const content = item['content:encoded'] || item.content || item.description || '';
            const match = content.match(/src="([^"]+)"/);
            return match ? match[1] : null;
        };

        // Map lại để trả về data sạch
        const items = await Promise.all(parsed.items.map(async item => {
            const exists = await this.historyRepo.findOne({ url: item.link });
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                guid: item.guid,
                thumbnail: getThumbnail(item), // Add thumbnail here
                isCrawled: !!exists,
                status: exists?.status
            };
        }));

        return {
            feedName: feed.name,
            items
        };
    }

    /**
     * Preview RSS từ URL (chưa cần lưu DB) - dùng cho luồng Add mới
     */
    async previewRssRaw(url: string) {
        try {
            const response = await axios.get(url, { responseType: 'text' });
            const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
            const parsed = await this.rssParser.parseString(xml);

            // Map items
            const items = await Promise.all(parsed.items.map(async item => {
                const exists = await this.historyRepo.findOne({ url: item.link });
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    guid: item.guid,
                    isCrawled: !!exists,
                    status: exists?.status
                };
            }));

            return {
                title: parsed.title,
                description: parsed.description,
                items
            };
        } catch (e) {
            this.logger.error(`Failed to preview RSS: ${url}`, e.message);
            throw new Error('Invalid RSS URL or network error');
        }
    }

    /**
     * Thống kê tổng quan cho Crawler Dashboard
     */
    async getStats() {
        const [totalRss, totalConfigs, totalHistory] = await Promise.all([
            this.rssRepo.count(),
            this.configRepo.count(),
            this.historyRepo.count()
        ]);

        const successCrawl = await this.historyRepo.count({ status: 'SUCCESS' });
        const failedCrawl = await this.historyRepo.count({ status: 'FAILED' });

        const totalPosts = await this.postRepo.count();
        const totalCategories = await this.categoryRepo.count();

        return {
            totalRss,
            totalConfigs,
            totalHistory,
            successCrawl,
            failedCrawl,
            totalPosts,
            totalCategories
        };
    }

    // --- CRUD RSS FEEDS (MongoDB) ---
    async getRssFeeds(): Promise<any[]> {
        const feeds = await this.rssRepo.findAll({
            orderBy: { createdAt: 'DESC' }
        } as any);

        // Enrich with Category Name from MySQL
        const categoryIds = feeds
            .map(f => f.targetCategoryId)
            .filter((id): id is string => !!id); // Filter undefined/null

        let categories: any[] = [];
        if (categoryIds.length > 0) {
            categories = await this.categoryRepo.find({
                id: { $in: categoryIds }
            });
        }

        return feeds.map(feed => {
            const category = categories.find(c => c.id === feed.targetCategoryId);
            return {
                ...feed,
                categoryName: category ? category.name : null
            };
        });
    }

    async createRssFeed(data: Partial<RssFeed>) {
        const feed = this.rssRepo.create(data as any);
        await this.rssRepo.getEntityManager().persistAndFlush(feed);
        return feed;
    }

    async updateRssFeed(id: string, data: Partial<RssFeed>) {
        const feed = await this.rssRepo.findOne({ id } as any);
        if (!feed) throw new Error('RSS Feed not found');
        wrap(feed).assign(data);
        await this.rssRepo.getEntityManager().persistAndFlush(feed);
        return feed;
    }

    async deleteRssFeed(id: string) {
        const feed = await this.rssRepo.findOne({ id } as any);
        if (feed) {
            await this.rssRepo.getEntityManager().removeAndFlush(feed);
        }
        return { success: true };
    }

    // --- CRUD SCRAPER CONFIGS (MongoDB) ---
    async getScraperConfigs() {
        return this.configRepo.findAll({
            orderBy: { createdAt: 'DESC' }
        } as any);
    }

    async createScraperConfig(data: Partial<ScraperConfig>) {
        const config = this.configRepo.create(data as any);
        await this.configRepo.getEntityManager().persistAndFlush(config);
        return config;
    }

    async updateScraperConfig(id: string, data: Partial<ScraperConfig>) {
        const config = await this.configRepo.findOne({ id } as any);
        if (!config) throw new Error('Scraper Config not found');
        wrap(config).assign(data);
        await this.configRepo.getEntityManager().persistAndFlush(config);
        return config;
    }

    async deleteScraperConfig(id: string) {
        const config = await this.configRepo.findOne({ id } as any);
        if (config) {
            await this.configRepo.getEntityManager().removeAndFlush(config);
        }
        return { success: true };
    }

    // --- CRAWL HISTORY ---
    async getCrawlHistory(page: number = 1, limit: number = 20) {
        const [items, total] = await this.historyRepo.findAndCount({}, {
            limit,
            offset: (page - 1) * limit,
            orderBy: { crawledAt: 'DESC' }
        });
        return { items, total, page, limit };
    }

    /**
     * Parse RSS từ URL (Preview trước khi lưu vào DB)
     */
    async previewRssByUrl(url: string) {
        try {
            const response = await axios.get(url, { responseType: 'text' });
            const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
            const parsed = await this.rssParser.parseString(xml);

            // Helper to extract image
            const getThumbnail = (item: any) => {
                if (item.enclosure && item.enclosure.url) return item.enclosure.url;
                if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
                const content = item['content:encoded'] || item.content || item.description || '';
                const match = content.match(/src="([^"]+)"/);
                return match ? match[1] : null;
            };

            // Map lại data để FE hiển thị
            const items = await Promise.all(parsed.items.map(async item => {
                const exists = await this.historyRepo.findOne({ url: item.link });
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    guid: item.guid,
                    thumbnail: getThumbnail(item),
                    isCrawled: !!exists,
                    status: exists?.status
                };
            }));

            return {
                feedTitle: parsed.title,
                feedUrl: url,
                items
            };
        } catch (error) {
            this.logger.error(`Failed to preview RSS ${url}`, error);
            throw new Error(`Failed to parse RSS URL: ${error.message}`);
        }
    }

    /**
     * Tạo RSS Feed và trigger cào các bài đã chọn ngay lập tức
     */
    async createRssWithSelection(dto: { feed: Partial<RssFeed>, selectedLinks: string[] }) {
        // 1. Tạo RSS Feed trong DB
        const feed = this.rssRepo.create(dto.feed as any);
        await this.rssRepo.getEntityManager().persistAndFlush(feed);

        // 2. Trigger cào các bài được chọn
        if (dto.selectedLinks && dto.selectedLinks.length > 0) {
            this.logger.log(`Triggering specific crawl for ${dto.selectedLinks.length} items from ${feed.name}`);

            for (const link of dto.selectedLinks) {
                await this.crawlerQueue.add('crawl_url', {
                    url: link,
                    rssId: feed.id,
                    targetCategoryId: feed.targetCategoryId,
                    autoPublish: feed.autoPublish,
                    selectorConfig: feed.selectorConfig,
                    manual: true
                });
            }
        }

        return feed;
    }
}
