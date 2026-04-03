import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { RssFeed } from '../entities/rss-feed.entity';
import { CrawlerService } from '../crawler.service';

@Injectable()
export class AutoCrawlService {
    private readonly logger = new Logger(AutoCrawlService.name);

    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly feedRepo: EntityRepository<RssFeed>,
        private readonly crawlerService: CrawlerService,
    ) { }

    /**
     * Finds feeds configured for auto-crawling hidden categories and initiates crawls
     * based on their `autoKeywords` parameter using the global crawler logic.
     */
    async crawlHiddenCategories() {
        this.logger.log('Starting daily auto-crawl for hidden categories...');
        const feeds = await this.feedRepo.find({ isActive: true, isHiddenCrawl: true });

        for (const feed of feeds) {
            this.logger.log(`Processing hidden feed ID: ${feed.id}, name: ${feed.name}`);

            // If the URL is actually a search query format, we map keywords
            if (feed.autoKeywords) {
                const keywords = feed.autoKeywords.split(',').map(k => k.trim()).filter(Boolean);
                await this.crawlWithMultipleKeywords(feed, keywords);
            } else {
                // Regular RSS Feed parsing
                await this.crawlerService.triggerRssCrawl(feed.id);
            }
        }
    }

    async crawlWithMultipleKeywords(feedOrId: RssFeed | string, keywords?: string[]) {
        const feed = typeof feedOrId === 'string'
            ? await this.feedRepo.findOne({ id: feedOrId } as any)
            : feedOrId;

        if (!feed) {
            this.logger.error(`Feed not found for auto-crawl: ${feedOrId}`);
            return 0;
        }

        const actualKeywords = keywords && keywords.length > 0
            ? keywords
            : (feed.autoKeywords?.split(',').map(k => k.trim()).filter(Boolean) || []);

        if (actualKeywords.length === 0) {
            this.logger.warn(`No keywords found for feed "${feed.name}" auto-crawl.`);
            return 0;
        }

        let totalDiscovered = 0;
        for (const kw of actualKeywords) {
            try {
                this.logger.log(`Auto crawling keyword: "${kw}" for feed "${feed.name}"`);

                // Assuming feed.url is designed as a template for searches, e.g. "https://news.example.com/search?q={{keyword}}"
                let targetUrl = feed.url;
                if (targetUrl.includes('{{keyword}}')) {
                    targetUrl = targetUrl.replace('{{keyword}}', encodeURIComponent(kw));
                }

                // Call a generic start crawl API based on URLs directly if it's not a pure RSS feed but HTML Scraper
                // Since `startScrapeJob` handles single articles, we might need a custom discovery trigger
                // For now, we simulate sending a discovery job passing the dynamically constructed search URL
                const response = await this.crawlerService.triggerDiscoveryForUrl(targetUrl, feed.id) as { totalFound: number };
                totalDiscovered += response?.totalFound || 0;
            } catch (err) {
                this.logger.error(`Error auto crawling keyword "${kw}" on feed ID ${feed.id}: ${err.message}`);
            }
        }
        return totalDiscovered;
    }
}
