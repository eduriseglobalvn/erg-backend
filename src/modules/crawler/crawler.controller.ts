import { Controller, Post, Body, Get, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ScraperType, ScraperConfig } from './entities/scraper-config.entity';
import { RssFeed } from './entities/rss-feed.entity';
import { CrawlerScheduler } from './crawler.scheduler';
import { SmartConfigService } from './services/smart-config.service';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

import { AutoCrawlService } from './services/auto-crawl.service';

import { Auditable } from '@/modules/audit/decorators/auditable.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('crawler.manage')
@Controller('crawler')
export class CrawlerController {
    constructor(
        private readonly crawlerService: CrawlerService,
        private readonly crawlerScheduler: CrawlerScheduler,
        private readonly smartConfigService: SmartConfigService,
        private readonly autoCrawlService: AutoCrawlService
    ) { }

    @Post('auto-crawl')
    @Permissions('crawler.auto_crawl', 'crawler.manage')
    @Auditable({ action: 'trigger_auto_crawl', resourceType: 'crawler' })
    async triggerAutoCrawl(@Body() body?: { rssId?: string, keywords?: string[] }) {
        if (body?.rssId) {
            await this.autoCrawlService.crawlWithMultipleKeywords(body.rssId, body.keywords);
            return { message: `Auto-crawl discovery triggered for feed ${body.rssId}` };
        }

        await this.autoCrawlService.crawlHiddenCategories();
        return { message: 'Global auto-crawl triggered for all hidden categories' };
    }

    @Get('rss/peek/:id')
    @Get('rss/:id/peek')
    async peekRss(@Param('id') id: string) {
        return this.crawlerService.peekRss(id);
    }

    @Post('rss/trigger')
    @Post('rss/sync/:id')
    @Post('rss/:id/sync')
    @Auditable({ action: 'sync_rss', resourceType: 'crawler' })
    async syncRss(@Body('rssId') rssId: string, @Body('id') bodyId: string, @Param('id') paramId: string) {
        const targetId = paramId || rssId || bodyId;
        return this.crawlerService.triggerRssCrawl(targetId);
    }

    @Post('url/run')
    @Auditable({ action: 'run_url_crawl', resourceType: 'crawler' })
    async runUrl(
        @Body('url') url: string,
        @Body('type') type?: ScraperType,
        @Body('targetCategoryId') targetCategoryId?: string
    ) {
        return this.crawlerService.triggerUrlCrawl(url, type, targetCategoryId);
    }

    // --- SMART CONFIG FEEDS ---
    @Post('smart-detect')
    async smartDetect(@Body('url') url: string) {
        return this.smartConfigService.autoDetectRss(url);
    }

    @Get('cron-presets')
    getCronPresets() {
        return this.smartConfigService.getCronPresets();
    }

    @Post('quick-add')
    @Auditable({ action: 'quick_add_feed', resourceType: 'crawler' })
    async quickAdd(@Body() body: { url: string, categoryId: string }) {
        return this.crawlerService.quickAdd(body.url, body.categoryId);
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
    @Auditable({ action: 'create_rss_selective', resourceType: 'crawler' })
    async createRssWithSelection(
        @Body() body: { feed: Partial<RssFeed>, selectedLinks: string[] }
    ) {
        return this.crawlerService.createRssWithSelection(body);
    }

    @Post('rss')
    @Auditable({ action: 'create_rss', resourceType: 'crawler' })
    async createRss(@Body() data: Partial<RssFeed>) {
        const feed = await this.crawlerService.createRssFeed(data);
        if (feed.isActive) this.crawlerScheduler.addCronJob(feed);
        return feed;
    }

    @Patch('rss/:id')
    @Auditable({ action: 'update_rss', resourceType: 'crawler' })
    async updateRss(@Param('id') id: string, @Body() data: Partial<RssFeed>) {
        const feed = await this.crawlerService.updateRssFeed(id, data);
        await this.crawlerScheduler.restartCronJob(feed);
        return feed;
    }

    @Delete('rss/:id')
    @Auditable({ action: 'delete_rss', resourceType: 'crawler' })
    async deleteRss(@Param('id') id: string) {
        this.crawlerScheduler.stopCronJob(id);
        return this.crawlerService.deleteRssFeed(id);
    }

    // --- SCRAPER CONFIGS CRUD ---
    @Get('configs')
    async getConfigs() {
        return this.crawlerService.getScraperConfigs();
    }

    @Post('configs')
    @Auditable({ action: 'create_config', resourceType: 'crawler' })
    async createConfig(@Body() data: Partial<ScraperConfig>) {
        return this.crawlerService.createScraperConfig(data);
    }

    @Patch('configs/:id')
    @Auditable({ action: 'update_config', resourceType: 'crawler' })
    async updateConfig(@Param('id') id: string, @Body() data: Partial<ScraperConfig>) {
        return this.crawlerService.updateScraperConfig(id, data);
    }

    @Delete('configs/:id')
    @Auditable({ action: 'delete_config', resourceType: 'crawler' })
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

    @Get('pipeline-status')
    async getPipelineStatus() {
        return this.crawlerService.getPipelineStatus();
    }

    @Get('stats')
    async getStats() {
        return this.crawlerService.getStats();
    }

    @Get('scheduler-status')
    getSchedulerStatus() {
        return this.crawlerScheduler.getSchedulerStatus();
    }
}
