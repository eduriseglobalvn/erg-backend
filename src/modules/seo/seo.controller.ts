import { Controller, Get, Post, Param, Query, UseGuards, Body, Delete, Put, Req, Inject, UseInterceptors } from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { SeoAnalyzerService } from './services/seo-analyzer.service';
import { SchemaMarkupService } from './services/schema-markup.service';
import { SeoHistoryService } from './services/seo-history.service';
import { GoogleSearchConsoleService } from './services/google-search-console.service';
import { AutoLinkingService } from './services/auto-linking.service';
import { EntityManager } from '@mikro-orm/core';
import { SeoKeyword } from './entities/seo-keyword.entity';
import { RedirectService } from './services/redirect.service';
import { MonitoringService } from './services/monitoring.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { Post as PostEntity } from '@/modules/posts/entities/post.entity';
import { CreateKeywordDto, BulkAutoLinkDto } from './dto/create-keyword.dto';
import { SaveSchemaDto } from './dto/save-schema.dto';
import { CreateRedirectDto, UpdateRedirectDto } from './dto/seo-redirect.dto';
import { Report404Dto } from './dto/report-404.dto';
import { UpdateSeoConfigDto } from './dto/seo-config.dto';
import { SuggestTitlesDto, SuggestMetaDto, GenerateAltTextsDto } from './dto/seo-ai-suggestions.dto';
import { KeywordResearchQueryDto } from './dto/keyword-research.dto';
import { SeoTitleService } from './services/seo-title.service';
import { SeoMetaService } from './services/seo-meta.service';
import { SeoImageAltService } from './services/seo-image-alt.service';
import { KeywordResearchService } from './services/keyword-research.service';
import { SeoRealtimeService } from './services/seo-realtime.service';
import { DraftAnalysisDto } from './dto/draft-analysis.dto';
import { SeoPerformanceReportDto } from './dto/seo-performance.dto';
import { SeoConfigService } from './services/seo-config.service';
import { User } from '@/modules/users/entities/user.entity';
import { ReviewsService } from '@/modules/reviews/reviews.service';
import { PostsService } from '@/modules/posts/posts.service';
import { SeoKeywordService } from './services/seo-keyword.service';

@ApiTags('SEO')
@Controller('seo')
export class SeoController {
    constructor(
        private readonly seoAnalyzerService: SeoAnalyzerService,
        private readonly schemaMarkupService: SchemaMarkupService,
        private readonly seoHistoryService: SeoHistoryService,
        private readonly googleSearchConsoleService: GoogleSearchConsoleService,
        private readonly autoLinkingService: AutoLinkingService,
        private readonly redirectService: RedirectService,
        private readonly monitoringService: MonitoringService,
        private readonly duplicateDetectionService: DuplicateDetectionService,
        private readonly seoTitleService: SeoTitleService,
        private readonly seoMetaService: SeoMetaService,
        private readonly seoImageAltService: SeoImageAltService,
        private readonly keywordResearchService: KeywordResearchService,
        private readonly seoRealtimeService: SeoRealtimeService,
        private readonly seoConfigService: SeoConfigService,
        private readonly postsService: PostsService,
        private readonly seoKeywordService: SeoKeywordService,
        private readonly em: EntityManager,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly reviewsService: ReviewsService,
    ) { }

    @Get('analyze/:postId')
    @ApiOperation({ summary: 'Get comprehensive SEO analysis for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to analyze' })
    @ApiResponse({ status: 200, description: 'SEO analysis completed successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async analyzePost(@Param('postId') postId: string) {
        const post = await this.postsService.findOne(postId);
        return this.seoAnalyzerService.analyzeComprehensive(post);
    }

    @Get('schema/:postId')
    @ApiOperation({ summary: 'Get schema markup for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to analyze' })
    @ApiResponse({ status: 200, description: 'Schema markup retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async getSchema(@Param('postId') postId: string, @Req() req: any) {
        const cacheKey = `schema:${postId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const post = await this.postsService.findOne(postId);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host || 'erg.edu.vn';
        const baseUrl = `${protocol}://${host}`;

        try {
            const stats = await this.reviewsService.getStats(postId);
            if (stats && stats.count > 0) {
                const recentReviews = await this.reviewsService.findAll(postId, 1, 5);
                (post as any).rating = { average: stats.average, count: stats.count };
                (post as any).recentReviews = recentReviews.items;
            }
        } catch (err) { }

        const schema = {
            type: post.schemaType || 'Article',
            data: this.schemaMarkupService.generateSchemaGraph(post, baseUrl),
        };
        await this.cacheManager.set(cacheKey, schema, 60 * 60 * 1000);
        return schema;
    }

    @Post('schema/:postId/validate')
    @ApiOperation({ summary: 'Validate schema markup for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to validate' })
    @ApiResponse({ status: 200, description: 'Schema validation result' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async validateSchema(@Param('postId') postId: string, @Req() req: any) {
        const post = await this.postsService.findOne(postId);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host || 'erg.edu.vn';
        const baseUrl = `${protocol}://${host}`;
        const schema = this.schemaMarkupService.generateSchemaGraph(post, baseUrl);
        return this.schemaMarkupService.validateSchema(schema);
    }

    @Post('schema/:postId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Save custom advanced schema data' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    @ApiResponse({ status: 200, description: 'Schema data saved successfully' })
    async saveSchema(
        @Param('postId') postId: string,
        @Body() dto: SaveSchemaDto,
    ) {
        const post = await this.postsService.findOne(postId);
        post.schemaData = { type: dto.type, data: dto.data };
        await this.em.flush();
        return { success: true, schema: post.schemaData };
    }

    @Get('history/:postId')
    @ApiOperation({ summary: 'Get SEO history for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    async getHistory(@Param('postId') postId: string, @Query('days') days: number = 30) {
        return this.seoHistoryService.getHistory(postId, days);
    }

    @Get('trends/:postId')
    @ApiOperation({ summary: 'Get SEO trends for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    async getTrends(@Param('postId') postId: string, @Query('days') days: number = 30) {
        return this.seoHistoryService.getTrends(postId, days);
    }

    @Get('gsc/:postId')
    @ApiOperation({ summary: 'Get Google Search Console data for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    async getGSCData(@Param('postId') postId: string, @Query('days') days: number = 30) {
        const gscLogs = await this.googleSearchConsoleService.getPostData(postId, days);
        const clicks = gscLogs.reduce((sum, log) => sum + log.clicks, 0);
        const impressions = gscLogs.reduce((sum, log) => sum + log.impressions, 0);
        const avgCtr = gscLogs.length > 0 ? gscLogs.reduce((sum, log) => sum + log.ctr, 0) / gscLogs.length : 0;
        const avgPosition = gscLogs.length > 0 ? gscLogs.reduce((sum, log) => sum + log.position, 0) / gscLogs.length : 0;
        return { clicks, impressions, ctr: avgCtr * 100, position: avgPosition, topQueries: [], devices: { mobile: 0, desktop: 0, tablet: 0 } };
    }

    @Get('gsc/auth/url')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getGscAuthUrl() {
        return { authUrl: await this.googleSearchConsoleService.getAuthUrl() };
    }

    @Post('gsc/auth/callback')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async handleGscCallback(@Body('code') code: string) {
        await this.googleSearchConsoleService.handleCallback(code);
        return { success: true };
    }

    @Post('gsc/sync')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async syncGSC(@Query('days') days: number = 7) {
        await this.googleSearchConsoleService.syncData(days);
        return { success: true, syncedPosts: 0, errors: [] };
    }

    @Get('gsc/top-posts')
    async getTopPosts(@Query('limit') limit: number = 10, @Query('days') days: number = 30) {
        const posts = await this.googleSearchConsoleService.getTopPosts(limit, days);
        return posts.map(p => ({
            id: p.id, title: p.title, slug: p.slug, seoScore: p.seo_score || 0, clicks: parseInt(p.total_clicks) || 0,
            impressions: parseInt(p.total_impressions) || 0, ctr: (parseFloat(p.avg_ctr) || 0) * 100,
            position: parseFloat(p.avg_position) || 0, trend: 'stable'
        }));
    }

    @Get('health')
    async getHealth() {
        const posts = await this.em.find(PostEntity, {});
        const totalPosts = posts.length;
        const postsAbove80 = posts.filter(p => (p.seoScore || 0) >= 80).length;
        const avgScore = totalPosts > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.seoScore || 0), 0) / totalPosts) : 0;
        return { avgScore, totalPosts, postsAbove80, needImprovement: totalPosts - postsAbove80 };
    }

    @Get('performance')
    async getPerformanceReport(@Query('period') period: 'week' | 'month' | 'year' = 'month'): Promise<SeoPerformanceReportDto> {
        const days = period === 'week' ? 7 : period === 'year' ? 365 : 30;
        const overview = await this.googleSearchConsoleService.getOverviewStats(days);
        const topPosts = await this.googleSearchConsoleService.getTopPosts(5, days);
        const posts = await this.em.find(PostEntity, {});
        const health = this.calculateHealth(posts);
        return {
            period, overview: { ...overview, keywordRankingsMap: {} }, topPerformingPosts: topPosts.map(p => ({
                title: p.title, slug: p.slug, clicks: parseInt(p.total_clicks) || 0, impressions: parseInt(p.total_impressions) || 0,
                ctr: parseFloat(p.avg_ctr) || 0, position: parseFloat(p.avg_position) || 0,
            })), seoHealth: health
        };
    }

    private calculateHealth(posts: PostEntity[]) {
        const total = posts.length;
        if (total === 0) return { score: 0, issues: { critical: 0, warnings: 0, good: 0 } };
        const good = posts.filter(p => (p.seoScore || 0) >= 80).length;
        const warnings = posts.filter(p => (p.seoScore || 0) >= 50 && (p.seoScore || 0) < 80).length;
        const critical = total - good - warnings;
        const avgScore = Math.round(posts.reduce((sum, p) => sum + (p.seoScore || 0), 0) / total);
        return { score: avgScore, issues: { critical, warnings, good } };
    }

    @Get('performance/queries')
    async getTopQueries(@Query('period') period: 'week' | 'month' | 'year' = 'month', @Query('limit') limit: number = 20) {
        const days = period === 'week' ? 7 : period === 'year' ? 365 : 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const rows = await this.googleSearchConsoleService.getTopQueries(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], limit);
        return rows.map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
    }

    @Get('keywords')
    async getKeywords() {
        return this.seoKeywordService.findAll();
    }

    @Post('keywords')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async createKeyword(@Body() dto: CreateKeywordDto) {
        return this.seoKeywordService.create(dto);
    }

    @Delete('keywords/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async deleteKeyword(@Param('id') id: string) {
        await this.seoKeywordService.delete(id);
        return { success: true };
    }

    @Put('apply-autolinks/:postId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async applyAutoLinks(@Param('postId') postId: string) {
        const post = await this.postsService.findOne(postId);
        if (!post.content) return { updatedContent: '', linksAdded: 0, keywords: [] };
        const result = await this.autoLinkingService.applyAutoLinks(post.content, postId);
        if (result.linksAdded > 0) {
            post.content = result.updatedContent;
            await this.em.flush();
        }
        return result;
    }

    @Get('redirects')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getRedirects() {
        return this.redirectService.findAll();
    }

    @Post('redirects')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async createRedirect(@Body() dto: CreateRedirectDto) {
        return this.redirectService.create(dto);
    }

    @Put('redirects/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async updateRedirect(@Param('id') id: string, @Body() dto: UpdateRedirectDto) {
        return this.redirectService.update(id, dto);
    }

    @Delete('redirects/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async deleteRedirect(@Param('id') id: string) {
        return this.redirectService.delete(id);
    }

    @Get('404-logs')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async get404Logs() {
        return this.monitoringService.get404Logs();
    }

    @Post('404')
    async report404(@Body() dto: { url: string; referrer?: string; userAgent?: string }) {
        await this.monitoringService.log404(dto.url, dto.referrer, dto.userAgent);
        return { success: true };
    }

    @Post('posts/:postId/robots')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async updatePostRobots(@Param('postId') postId: string, @Body() dto: { index: boolean; follow: boolean; advanced?: string }) {
        const post = await this.postsService.findOne(postId);
        post.robotsIndex = dto.index;
        post.robotsFollow = dto.follow;
        if (dto.advanced !== undefined) post.robotsAdvanced = dto.advanced;
        await this.em.flush();
        return { success: true, robots: { index: post.robotsIndex, follow: post.robotsFollow, advanced: post.robotsAdvanced } };
    }

    @Post('check-duplicate')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async checkDuplicate(@Body() dto: { content: string; currentPostId?: string }) {
        return this.duplicateDetectionService.checkDuplicate(dto.content, dto.currentPostId);
    }

    @Post('analyze-draft')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async analyzeDraft(@Body() dto: DraftAnalysisDto) {
        return this.seoRealtimeService.analyzeDraft(dto);
    }

    @Post('suggest-titles')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async suggestTitles(@Body() dto: SuggestTitlesDto, @Req() req: any) {
        return this.seoTitleService.generateTitles(dto.keyword, dto.content, req.user);
    }

    @Post('suggest-meta')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async suggestMeta(@Body() dto: SuggestMetaDto, @Req() req: any) {
        return this.seoMetaService.generateMetaDescriptions(dto.keyword, dto.content, req.user);
    }

    @Post('generate-alt-texts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async generateAltTexts(@Body() dto: GenerateAltTextsDto, @Req() req: any) {
        return this.seoImageAltService.generateAltTexts(dto.content, dto.focusKeyword, req.user);
    }

    @Get('keyword-research')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async researchKeyword(@Query('seed') seed: string) {
        return this.keywordResearchService.researchKeyword(seed);
    }

    @Get('config/:key')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(3600)
    async getConfig(@Param('key') key: string) {
        return this.seoConfigService.getConfig(key);
    }

    @Put('config/:key')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async updateConfig(@Param('key') key: string, @Body() dto: UpdateSeoConfigDto, @Req() req: any) {
        return this.seoConfigService.setConfig(key, dto.value, req.user?.id);
    }
}
