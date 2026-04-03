import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CrawlerConfigService } from './services/crawler-config.service';
import { CrawlerDiscoveryService } from './services/crawler-discovery.service';
import { CrawlerPreviewService } from './services/crawler-preview.service';
import { CrawlerStatsService } from './services/crawler-stats.service';
import { SmartConfigService } from './services/smart-config.service';
import { CrawlerScheduler } from './crawler.scheduler';
import { RssFeed } from './entities/rss-feed.entity';
import { ScraperConfig, ScraperType } from './entities/scraper-config.entity';

@Injectable()
export class CrawlerService {
    constructor(
        private readonly configService: CrawlerConfigService,
        private readonly discoveryService: CrawlerDiscoveryService,
        private readonly previewService: CrawlerPreviewService,
        private readonly statsService: CrawlerStatsService,
        private readonly smartConfigService: SmartConfigService,
        @Inject(forwardRef(() => CrawlerScheduler))
        private readonly crawlerScheduler: any,
    ) { }

    // Delegates to CrawlerConfigService
    async getRssFeeds() { return this.configService.getRssFeeds(); }
    async createRssFeed(data: Partial<RssFeed>) { return this.configService.createRssFeed(data); }
    async updateRssFeed(id: string, data: Partial<RssFeed>) { return this.configService.updateRssFeed(id, data); }
    async deleteRssFeed(id: string) { return this.configService.deleteRssFeed(id); }
    async getScraperConfigs() { return this.configService.getScraperConfigs(); }
    async createScraperConfig(data: Partial<ScraperConfig>) { return this.configService.createScraperConfig(data); }
    async updateScraperConfig(id: string, data: Partial<ScraperConfig>) { return this.configService.updateScraperConfig(id, data); }
    async deleteScraperConfig(id: string) { return this.configService.deleteScraperConfig(id); }

    // Delegates to CrawlerDiscoveryService
    async triggerRssCrawl(rssId: string) { return this.discoveryService.triggerRssCrawl(rssId); }
    async triggerDiscoveryForUrl(url: string, rssId?: string) { return this.discoveryService.triggerDiscoveryForUrl(url, rssId); }
    async triggerUrlCrawl(url: string, type?: ScraperType, targetCategoryId?: string) {
        return this.discoveryService.triggerUrlCrawl(url, type, targetCategoryId);
    }
    async processRssFeed(rssId: string) { return this.discoveryService.processRssFeed(rssId); }
    async processHtmlDiscovery(url: string, rssId?: string) { return this.discoveryService.processHtmlDiscovery(url, rssId); }

    // Delegates to CrawlerPreviewService
    async peekRss(rssId: string) { return this.previewService.peekRss(rssId); }
    async previewRssByUrl(url: string) { return this.previewService.previewRssByUrl(url); }
    async createRssWithSelection(dto: { feed: Partial<RssFeed>, selectedLinks: string[] }) {
        return this.previewService.createRssWithSelection(dto);
    }

    // Delegates to CrawlerStatsService
    async getStats() { return this.statsService.getStats(); }
    async getPipelineStatus() { return this.statsService.getPipelineStatus(); }
    async getCrawlHistory(page: number = 1, limit: number = 20) {
        return this.statsService.getCrawlHistory(page, limit);
    }

    // Complex coordination logic
    async quickAdd(url: string, categoryId: string): Promise<RssFeed> {
        const detectResult = await this.smartConfigService.autoDetectRss(url);

        // Find or create scrapper config
        let config = await this.getScraperConfigs().then(configs =>
            configs.find(c => c.domain === new URL(url).hostname)
        );

        if (!config) {
            config = await this.createScraperConfig({
                domain: new URL(url).hostname,
                type: detectResult.suggestedConfig.scraperType,
                ...detectResult.suggestedConfig.selectorConfig
            });
        }

        const feed = await this.createRssFeed({
            name: detectResult.feedName,
            url: detectResult.detectedFeedUrl || url,
            targetCategoryId: categoryId,
            cronExpression: detectResult.suggestedConfig.cronExpression,
            isActive: true,
            autoPublish: false,
        });

        this.crawlerScheduler.addCronJob(feed);
        return feed;
    }
}
