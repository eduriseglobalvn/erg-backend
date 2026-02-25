import { Controller, Get, Post, Param, Query, UseGuards, Body, Delete, Put, Req } from '@nestjs/common';
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
// Removed CurrentUser import
import { User } from '@/modules/users/entities/user.entity';

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
        private readonly em: EntityManager,
    ) { }

    @Get('analyze/:postId')
    @ApiOperation({ summary: 'Get comprehensive SEO analysis for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to analyze' })
    @ApiResponse({ status: 200, description: 'SEO analysis completed successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async analyzePost(@Param('postId') postId: string) {
        // Populate singular 'category' if needed, check Post entity definition.
        // Assuming 'category' is ManyToOne relation name.
        const post = await this.em.findOneOrFail(PostEntity, postId, { populate: ['author', 'category'] });
        return this.seoAnalyzerService.analyzeComprehensive(post);
    }

    @Get('schema/:postId')
    @ApiOperation({ summary: 'Get schema markup for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to analyze' })
    @ApiResponse({ status: 200, description: 'Schema markup retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async getSchema(@Param('postId') postId: string) {
        const post = await this.em.findOneOrFail(PostEntity, postId);
        return {
            type: post.schemaType || 'Article',
            data: this.schemaMarkupService.generateSchemaGraph(post),
        };
    }

    @Post('schema/:postId/validate')
    @ApiOperation({ summary: 'Validate schema markup for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post to validate' })
    @ApiResponse({ status: 200, description: 'Schema validation result' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async validateSchema(@Param('postId') postId: string) {
        const post = await this.em.findOneOrFail(PostEntity, postId);
        const schema = this.schemaMarkupService.generateSchemaGraph(post);
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
        const post = await this.em.findOneOrFail(PostEntity, postId);
        post.schemaData = { type: dto.type, data: dto.data };
        await this.em.flush();
        return { success: true, schema: post.schemaData };
    }

    @Get('history/:postId')
    @ApiOperation({ summary: 'Get SEO history for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back' })
    @ApiResponse({ status: 200, description: 'SEO history retrieved successfully' })
    async getHistory(@Param('postId') postId: string, @Query('days') days: number = 30) {
        return this.seoHistoryService.getHistory(postId, days);
    }

    @Get('trends/:postId')
    @ApiOperation({ summary: 'Get SEO trends for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to analyze trends' })
    @ApiResponse({ status: 200, description: 'SEO trends retrieved successfully' })
    async getTrends(@Param('postId') postId: string, @Query('days') days: number = 30) {
        return this.seoHistoryService.getTrends(postId, days);
    }

    @Get('gsc/:postId')
    @ApiOperation({ summary: 'Get Google Search Console data for a post' })
    @ApiParam({ name: 'postId', description: 'UUID of the post' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days of data to retrieve' })
    @ApiResponse({ status: 200, description: 'GSC data retrieved successfully' })
    async getGSCData(@Param('postId') postId: string, @Query('days') days: number = 30) {
        const gscLogs = await this.googleSearchConsoleService.getPostData(postId, days);

        const clicks = gscLogs.reduce((sum, log) => sum + log.clicks, 0);
        const impressions = gscLogs.reduce((sum, log) => sum + log.impressions, 0);
        const avgCtr = gscLogs.length > 0 ? gscLogs.reduce((sum, log) => sum + log.ctr, 0) / gscLogs.length : 0;
        const avgPosition = gscLogs.length > 0 ? gscLogs.reduce((sum, log) => sum + log.position, 0) / gscLogs.length : 0;

        return {
            clicks,
            impressions,
            ctr: avgCtr * 100, // percentage
            position: avgPosition,
            topQueries: [], // This would require specific GSC query dimensioned by 'query'
            devices: {
                mobile: 0,
                desktop: 0,
                tablet: 0
            }
        };
    }

    @Get('gsc/auth/url')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get Google Search Console Auth URL' })
    async getGscAuthUrl() {
        return { authUrl: await this.googleSearchConsoleService.getAuthUrl() };
    }

    @Post('gsc/auth/callback')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Handle Google Search Console Auth Callback' })
    async handleGscCallback(@Body('code') code: string) {
        await this.googleSearchConsoleService.handleCallback(code);
        return { success: true };
    }

    @Post('gsc/sync')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sync Google Search Console data' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to sync (default: 7)' })
    @ApiResponse({ status: 200, description: 'GSC data sync initiated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async syncGSC(@Query('days') days: number = 7) {
        await this.googleSearchConsoleService.syncData(days);
        return {
            success: true,
            syncedPosts: 0, // Should be actual count if synchronous, or 'pending'
            errors: []
        };
    }

    @Get('gsc/top-posts')
    @ApiOperation({ summary: 'Get top performing posts from GSC' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of posts to return (default: 10)' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'Time period in days (default: 30)' })
    @ApiResponse({ status: 200, description: 'List of top performing posts' })
    async getTopPosts(@Query('limit') limit: number = 10, @Query('days') days: number = 30) {
        const posts = await this.googleSearchConsoleService.getTopPosts(limit, days);
        return posts.map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            seoScore: p.seo_score || 0,
            clicks: parseInt(p.total_clicks) || 0,
            impressions: parseInt(p.total_impressions) || 0,
            ctr: (parseFloat(p.avg_ctr) || 0) * 100,
            position: parseFloat(p.avg_position) || 0,
            trend: 'stable' // Simplified version
        }));
    }

    @Get('health')
    @ApiOperation({ summary: 'Get overall SEO health metrics' })
    @ApiResponse({ status: 200, description: 'SEO health metrics' })
    async getHealth() {
        const posts = await this.em.find(PostEntity, {});

        const totalPosts = posts.length;
        const postsAbove80 = posts.filter(p => (p.seoScore || 0) >= 80).length;
        const avgScore = totalPosts > 0
            ? Math.round(posts.reduce((sum, p) => sum + (p.seoScore || 0), 0) / totalPosts)
            : 0;

        return {
            avgScore,
            totalPosts,
            postsAbove80,
            needImprovement: totalPosts - postsAbove80,
        };
    }

    @Get('performance')
    @ApiOperation({ summary: 'Get SEO performance report' })
    @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'], required: false })
    @ApiResponse({ status: 200, type: SeoPerformanceReportDto })
    async getPerformanceReport(@Query('period') period: 'week' | 'month' | 'year' = 'month'): Promise<SeoPerformanceReportDto> {
        const days = period === 'week' ? 7 : period === 'year' ? 365 : 30;

        const overview = await this.googleSearchConsoleService.getOverviewStats(days);
        const topPosts = await this.googleSearchConsoleService.getTopPosts(5, days);

        const posts = await this.em.find(PostEntity, {});
        const health = this.calculateHealth(posts);

        return {
            period,
            overview: {
                ...overview,
                keywordRankingsMap: {}, // Placeholder
            },
            topPerformingPosts: topPosts.map(p => ({
                title: p.title,
                slug: p.slug,
                clicks: parseInt(p.total_clicks) || 0,
                impressions: parseInt(p.total_impressions) || 0,
                ctr: parseFloat(p.avg_ctr) || 0,
                position: parseFloat(p.avg_position) || 0,
            })),
            seoHealth: health,
        };
    }

    private calculateHealth(posts: PostEntity[]) {
        const total = posts.length;
        if (total === 0) return { score: 0, issues: { critical: 0, warnings: 0, good: 0 } };

        const good = posts.filter(p => (p.seoScore || 0) >= 80).length;
        const warnings = posts.filter(p => (p.seoScore || 0) >= 50 && (p.seoScore || 0) < 80).length;
        const critical = total - good - warnings;

        const avgScore = Math.round(posts.reduce((sum, p) => sum + (p.seoScore || 0), 0) / total);

        return {
            score: avgScore,
            issues: { critical, warnings, good }
        };
    }

    @Get('performance/queries')
    @ApiOperation({ summary: 'Get top performing search queries from GSC' })
    @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'], required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of top queries' })
    async getTopQueries(
        @Query('period') period: 'week' | 'month' | 'year' = 'month',
        @Query('limit') limit: number = 20
    ) {
        const days = period === 'week' ? 7 : period === 'year' ? 365 : 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const rows = await this.googleSearchConsoleService.getTopQueries(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            limit
        );

        return rows.map(r => ({
            query: r.keys[0],
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: r.position
        }));
    }

    // --- Auto-Linking Endpoints ---

    @Get('keywords')
    @ApiOperation({ summary: 'Get all SEO keywords' })
    async getKeywords() {
        return this.em.find(SeoKeyword, {}, { orderBy: { createdAt: 'DESC' } });
    }

    @Post('keywords')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create SEO keyword' })
    async createKeyword(@Body() dto: CreateKeywordDto) {
        const keyword = this.em.create(SeoKeyword, dto);
        await this.em.persistAndFlush(keyword);
        return keyword;
    }

    @Delete('keywords/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete SEO keyword' })
    async deleteKeyword(@Param('id') id: string) {
        const keyword = await this.em.findOneOrFail(SeoKeyword, id);
        await this.em.removeAndFlush(keyword);
        return { success: true };
    }

    @Put('apply-autolinks/:postId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Apply auto-links to a post' })
    async applyAutoLinks(@Param('postId') postId: string) {
        const post = await this.em.findOneOrFail(PostEntity, postId);
        if (!post.content) return { updatedContent: '', linksAdded: 0, keywords: [] };

        const result = await this.autoLinkingService.applyAutoLinks(post.content, postId);

        if (result.linksAdded > 0) {
            post.content = result.updatedContent;
            await this.em.flush();
        }

        return result;
    }

    @Put('apply-autolinks/bulk')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Apply auto-links to multiple posts' })
    async applyAutoLinksBulk(@Body() dto: BulkAutoLinkDto) {
        return this.autoLinkingService.bulkApplyAutoLinks(dto.postIds);
    }

    // --- Technical SEO Endpoints ---

    @Get('redirects')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all SEO redirects' })
    async getRedirects() {
        return this.redirectService.findAll();
    }

    @Post('redirects')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create new SEO redirect' })
    async createRedirect(@Body() dto: any) {
        return this.redirectService.create(dto);
    }

    @Put('redirects/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update existing SEO redirect' })
    async updateRedirect(@Param('id') id: string, @Body() dto: any) {
        return this.redirectService.update(id, dto);
    }

    @Delete('redirects/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete SEO redirect' })
    async deleteRedirect(@Param('id') id: string) {
        return this.redirectService.delete(id);
    }

    @Get('404-logs')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get 404 error logs' })
    async get404Logs() {
        return this.monitoringService.get404Logs();
    }

    @Post('404')
    @ApiOperation({ summary: 'Report a 404 error from frontend' })
    async report404(@Body() dto: { url: string; referrer?: string; userAgent?: string }) {
        await this.monitoringService.log404(dto.url, dto.referrer, dto.userAgent);
        return { success: true };
    }

    @Post('posts/:postId/robots')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update robots meta for a post' })
    async updatePostRobots(
        @Param('postId') postId: string,
        @Body() dto: { index: boolean; follow: boolean; advanced?: string },
    ) {
        const post = await this.em.findOneOrFail(PostEntity, postId);
        post.robotsIndex = dto.index;
        post.robotsFollow = dto.follow;
        if (dto.advanced !== undefined) post.robotsAdvanced = dto.advanced;
        await this.em.flush();
        return {
            success: true,
            robots: {
                index: post.robotsIndex,
                follow: post.robotsFollow,
                advanced: post.robotsAdvanced
            }
        };
    }

    @Post('check-duplicate')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Check for duplicate or similar content' })
    async checkDuplicate(@Body() dto: { content: string; currentPostId?: string }) {
        return this.duplicateDetectionService.checkDuplicate(dto.content, dto.currentPostId);
    }

    // ==================== REAL-TIME ANALYSIS ====================

    @Post('analyze-draft')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Real-time SEO analysis for draft content (Cached)' })
    @ApiResponse({ status: 200, description: 'Yoast SEO analysis result' })
    async analyzeDraft(@Body() dto: DraftAnalysisDto) {
        return this.seoRealtimeService.analyzeDraft(dto);
    }

    // ==================== AI-POWERED SEO SUGGESTIONS ====================

    @Post('suggest-titles')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Generate AI-powered SEO title suggestions' })
    @ApiResponse({ status: 200, description: 'Returns 5 title variations with scores' })
    async suggestTitles(
        @Body() dto: SuggestTitlesDto,
        @Req() req: any
    ) {
        return this.seoTitleService.generateTitles(dto.keyword, dto.content, req.user);
    }

    @Post('suggest-meta')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Generate AI-powered meta description suggestions' })
    @ApiResponse({ status: 200, description: 'Returns 3 meta description variations with scores' })
    async suggestMeta(
        @Body() dto: SuggestMetaDto,
        @Req() req: any
    ) {
        return this.seoMetaService.generateMetaDescriptions(dto.keyword, dto.content, req.user);
    }

    @Post('generate-alt-texts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Generate AI-powered image alt texts' })
    @ApiResponse({ status: 200, description: 'Returns suggested alt texts for images without alt tags' })
    async generateAltTexts(
        @Body() dto: GenerateAltTextsDto,
        @Req() req: any
    ) {
        return this.seoImageAltService.generateAltTexts(dto.content, dto.focusKeyword, req.user);
    }

    @Get('keyword-research')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Research keywords and get search volume/suggestions' })
    @ApiResponse({ status: 200, description: 'Returns keyword metrics and related suggestions' })
    @ApiQuery({ name: 'seed', required: true, description: 'Seed keyword to research' })
    async researchKeyword(
        @Query('seed') seed: string
    ) {
        return this.keywordResearchService.researchKeyword(seed);
    }

    // --- Global Config Endpoints ---

    @Get('config/:key')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get global SEO config by key' })
    @ApiParam({ name: 'key', description: 'Config key (e.g. organization, robots, social)' })
    async getConfig(@Param('key') key: string) {
        return this.seoConfigService.getConfig(key);
    }

    @Put('config/:key')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update global SEO config' })
    @ApiParam({ name: 'key', description: 'Config key' })
    async updateConfig(@Param('key') key: string, @Body() body: any, @Req() req: any) {
        return this.seoConfigService.setConfig(key, body, req.user?.id);
    }
}
