import { Controller, Post, Body, Get, Param, Patch, Delete, Query } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ScraperType, ScraperConfig } from './entities/scraper-config.entity';
import { RssFeed } from './entities/rss-feed.entity';

@Controller('crawler')
export class CrawlerController {
    constructor(private readonly crawlerService: CrawlerService) { }

    @Post('rss/trigger')
    async triggerRss(@Body('rssId') rssId: string) {
        return this.crawlerService.triggerRssCrawl(rssId);
    }

    @Get('rss/peek/:id')
    async peekRss(@Param('id') id: string) {
        return this.crawlerService.peekRss(id);
    }


    @Post('url/run')
    async runUrl(
        @Body('url') url: string,
        @Body('type') type?: ScraperType,
        @Body('targetCategoryId') targetCategoryId?: string
    ) {
        return this.crawlerService.triggerUrlCrawl(url, type, targetCategoryId);
    }

    // --- RSS FEEDS CRUD ---
    @Get('rss')
    async getRssFeeds() {
        return this.crawlerService.getRssFeeds();
    }

    @Post('rss/preview')
    async previewCustomRss(@Body('url') url: string) {
        return this.crawlerService.previewRssByUrl(url);
    }

    @Post('rss/create-selective')
    async createRssWithSelection(
        @Body() body: { feed: Partial<RssFeed>, selectedLinks: string[] }
    ) {
        return this.crawlerService.createRssWithSelection(body);
    }

    @Post('rss')
    async createRss(@Body() data: Partial<RssFeed>) {
        return this.crawlerService.createRssFeed(data);
    }

    @Patch('rss/:id')
    async updateRss(@Param('id') id: string, @Body() data: Partial<RssFeed>) {
        return this.crawlerService.updateRssFeed(id, data);
    }

    @Delete('rss/:id')
    async deleteRss(@Param('id') id: string) {
        return this.crawlerService.deleteRssFeed(id);
    }

    // --- SCRAPER CONFIGS CRUD ---
    @Get('configs')
    async getConfigs() {
        return this.crawlerService.getScraperConfigs();
    }

    @Post('configs')
    async createConfig(@Body() data: Partial<ScraperConfig>) {
        return this.crawlerService.createScraperConfig(data);
    }

    @Patch('configs/:id')
    async updateConfig(@Param('id') id: string, @Body() data: Partial<ScraperConfig>) {
        return this.crawlerService.updateScraperConfig(id, data);
    }

    @Delete('configs/:id')
    async deleteConfig(@Param('id') id: string) {
        return this.crawlerService.deleteScraperConfig(id);
    }

    // --- HISTORY ---
    @Get('history')
    async getHistory(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.crawlerService.getCrawlHistory(Number(page), Number(limit));
    }

    @Get('stats')
    async getStats() {
        return this.crawlerService.getStats();
    }
}
