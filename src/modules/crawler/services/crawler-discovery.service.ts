import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { RssFeed } from '../entities/rss-feed.entity';
import { ScraperConfig, ScraperType } from '../entities/scraper-config.entity';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { Post } from '../../posts/entities/post.entity';
import { CrawlBatchTrackerService } from './crawl-batch-tracker.service';

@Injectable()
export class CrawlerDiscoveryService {
    private readonly logger = new Logger(CrawlerDiscoveryService.name);
    private readonly rssParser = new Parser();

    constructor(
        @InjectQueue('crawl_discovery') private discoveryQueue: Queue,
        @InjectQueue('crawl_scrape') private scrapeQueue: Queue,
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepository: EntityRepository<RssFeed>,
        @InjectRepository(ScraperConfig, 'mongo-connection')
        private readonly configRepository: EntityRepository<ScraperConfig>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepository: EntityRepository<CrawlHistory>,
        @InjectRepository(Post)
        private readonly postRepository: EntityRepository<Post>,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
    ) { }

    async triggerRssCrawl(rssId: string): Promise<{ message: string }> {
        const feed = await this.rssRepository.findOne({ id: rssId });
        if (!feed) throw new NotFoundException('RSS Feed not found');
        if (!feed.isActive) {
            this.logger.warn(`RSS Feed ${feed.name} is disabled. Skipping.`);
            return { message: 'Feed is disabled' };
        }

        this.logger.log(`Triggering RSS crawl for: ${feed.name}`);
        await this.discoveryQueue.add('process_rss', { rssId: feed.id });
        return { message: 'RSS Crawl job added to queue' };
    }

    async triggerDiscoveryForUrl(url: string, rssId?: string): Promise<{ totalFound: number; message: string }> {
        this.logger.log(`Triggering URL-based discovery for: ${url}`);
        await this.discoveryQueue.add('process_html_discovery', { url, rssId });
        return { totalFound: 0, message: 'Discovery job added to queue' };
    }

    async triggerUrlCrawl(url: string, type?: ScraperType, targetCategoryId?: string) {
        this.logger.log(`Manual trigger for URL: ${url} (Cat: ${targetCategoryId})`);

        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname;

            const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');
            const isPrivateIp = /^10\.|^127\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
            const isInternalHost = hostname.includes('internal') || hostname.includes('corp');

            if (isLocalhost || isPrivateIp || isInternalHost || parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new ForbiddenException('Forbidden URL');
            }
        } catch (error) {
            if (error instanceof ForbiddenException) throw error;
            throw new BadRequestException('Invalid or forbidden URL provided for crawling');
        }

        let selectorConfig: any = undefined;
        let scraperType = type || ScraperType.STATIC;

        try {
            const domain = new URL(url).hostname.replace('www.', '');
            const config = await this.configRepository.findOne({ domain } as any);
            if (config) {
                selectorConfig = config.selectorConfig;
                scraperType = type || config.type;
                this.logger.log(`Found scraper config for domain: ${domain}`);
            }
        } catch (e) {
            this.logger.warn(`Invalid URL provided: ${url}`);
        }

        await this.scrapeQueue.add('scrape_url', {
            url,
            type: scraperType,
            selectorConfig,
            targetCategoryId,
            manual: true
        });
        return { message: 'URL Crawl job added to queue' };
    }

    async processRssFeed(rssId: string) {
        const feed = await this.rssRepository.findOne({ id: rssId });
        if (!feed) return;

        try {
            const response = await axios.get(feed.url, { responseType: 'text' });
            const xml = response.data.toString().trim().replace(/^\uFEFF/, '');
            const parsed = await this.rssParser.parseString(xml);
            this.logger.log(`Found ${parsed.items.length} items in RSS: ${feed.name}`);

            const links = parsed.items.map(item => item.link).filter((link): link is string => !!link);

            const histories = await this.historyRepository.find({ url: { $in: links } });
            const historyMap = new Map(histories.map(h => [h.url, h]));

            const validPostIds = histories.map(h => h.postId).filter((id): id is string => !!id);
            let postMap = new Map();
            if (validPostIds.length > 0) {
                const posts = await this.postRepository.find({ id: { $in: validPostIds }, deletedAt: null });
                postMap = new Map(posts.map(p => [p.id, p]));
            }

            for (const item of parsed.items) {
                if (!item.link) continue;

                const history = historyMap.get(item.link);
                let postExists = false;
                if (history && history.postId) {
                    if (postMap.has(history.postId)) {
                        postExists = true;
                    }
                }

                if (postExists) continue;

                await this.scrapeQueue.add('scrape_url', {
                    url: item.link,
                    rssId: feed.id,
                    targetCategoryId: feed.targetCategoryId,
                    autoPublish: feed.autoPublish,
                    selectorConfig: feed.selectorConfig,
                    manual: false
                });
            }
        } catch (error) {
            this.logger.error(`Failed to parse RSS ${feed.url}`, error.stack);
        }
    }

    async processHtmlDiscovery(url: string, rssId?: string) {
        this.logger.log(`Processing HTML discovery for: ${url}`);
        let feed: any = null;
        if (rssId) {
            feed = await this.rssRepository.findOne({ id: rssId });
        }

        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 15000
            });
            const $ = cheerio.load(response.data);

            const links: string[] = [];
            $('a').each((_, el) => {
                let href = $(el).attr('href');
                if (href) {
                    try {
                        const absoluteUrl = new URL(href, url).href;
                        if (absoluteUrl.startsWith('http') && absoluteUrl.length > url.length + 5) {
                            links.push(absoluteUrl);
                        }
                    } catch (e) { }
                }
            });

            const uniqueLinks = [...new Set(links)].slice(0, 50);
            this.logger.log(`Found ${uniqueLinks.length} candidate links on ${url}`);

            let totalAdded = 0;
            for (const link of uniqueLinks) {
                const exists = await this.historyRepository.findOne({ url: link });
                if (exists) continue;

                await this.scrapeQueue.add('scrape_url', {
                    url: link,
                    rssId: feed?.id,
                    targetCategoryId: feed?.targetCategoryId,
                    autoPublish: feed?.autoPublish || false,
                    manual: false
                });
                totalAdded++;
            }

            return { totalFound: uniqueLinks.length, totalAdded };
        } catch (error) {
            this.logger.error(`HTML Discovery failed for ${url}: ${error.message}`);
            throw error;
        }
    }
}
