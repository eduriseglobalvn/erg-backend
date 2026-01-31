import {
    Controller,
    Post,
    Body,
    Req,
    Ip,
    Put,
    Param,
    Get,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { Permissions } from '../access-control/decorators/permissions.decorator';
import { JwtService } from '@nestjs/jwt';
import { TrackVisitDto, TrackEventDto, DashboardStatsResponse } from './dto/analytics.dto';

@Controller('insight')
export class AnalyticsController {
    constructor(
        private readonly analyticsService: AnalyticsService,
        private readonly jwtService: JwtService,
    ) { }

    /**
     * Trích xuất userId từ Authorization header (nếu có)
     * Dùng cho các API public mà vẫn muốn track user đã login
     */
    private extractUserIdFromRequest(req: Request): number | undefined {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return undefined;
            }

            const token = authHeader.split(' ')[1];
            const decoded = this.jwtService.decode(token) as any;

            if (!decoded || !decoded.sub) {
                return undefined;
            }

            const id = typeof decoded.sub === 'number' ? decoded.sub : parseInt(decoded.sub, 10);
            return isNaN(id) ? undefined : id;
        } catch (error) {
            return undefined;
        }
    }

    // ========== TRACKING APIS (Public - FE gọi từ mọi trang) ==========

    /**
     * POST /api/insight/session/begin
     * 
     * FE gọi API này khi user vào một trang mới.
     * - Nếu user đã login: Gửi kèm Authorization header để track userId.
     * - Backend tự động lấy IP, UserAgent, Location, Device.
     * 
     * @returns { visitId: string } - ID của visit để gọi update duration sau
     */
    @Post('session/begin')
    async startVisit(
        @Body() body: TrackVisitDto,
        @Req() req: Request,
        @Ip() ip: string,
    ) {
        // Validate URL
        if (!body.url) {
            throw new BadRequestException('URL is required');
        }

        // Lấy IP thực từ header (sau reverse proxy) hoặc fallback
        const realIp = this.extractRealIp(req, ip);
        const userAgent = req.headers['user-agent'] || '';
        const userId = this.extractUserIdFromRequest(req);

        return this.analyticsService.trackVisit({
            url: body.url,
            referrer: body.referrer,
            ip: realIp,
            userAgent: userAgent,
            userId: userId,
            entityId: body.entityId,
            entityType: body.entityType,
        });
    }

    /**
     * POST /api/insight/behavior
     * 
     * Track các sự kiện cụ thể (click button, xem video, submit form...)
     */
    @Post('behavior')
    async trackEvent(
        @Body() body: TrackEventDto,
        @Req() req: Request,
    ) {
        // Validate required fields
        if (!body.eventType) {
            throw new BadRequestException('eventType is required');
        }
        if (!body.sessionInternalId) {
            throw new BadRequestException('sessionInternalId is required');
        }

        const userId = this.extractUserIdFromRequest(req);

        return this.analyticsService.trackEvent({
            eventType: body.eventType,
            metadata: body.metadata || {},
            sessionInternalId: body.sessionInternalId,
            userId: userId,
        });
    }

    /**
     * PUT /api/insight/session/:id/finish
     * 
     * FE gọi khi user rời trang (beforeunload) để cập nhật thời gian ở lại.
     * Duration tính bằng giây.
     */
    @Put('session/:id/finish')
    async updateDuration(
        @Param('id') id: string,
        @Body('duration') duration: number,
    ) {
        if (!id) {
            throw new BadRequestException('Visit ID is required');
        }

        // Validate duration là số hợp lệ
        const durationSeconds = typeof duration === 'number' ? duration : parseInt(duration, 10);
        if (isNaN(durationSeconds) || durationSeconds < 0) {
            throw new BadRequestException('Duration must be a positive number');
        }

        // Cap duration at 1 hour (3600s) để tránh spam
        const cappedDuration = Math.min(durationSeconds, 3600);

        await this.analyticsService.updateVisitDuration(id, cappedDuration);
        return { success: true };
    }

    // ========== DASHBOARD API (Admin Only) ==========

    /**
     * GET /api/insight/stats
     * 
     * API chuyên biệt cho biểu đồ Traffic với bộ lọc thời gian tiện lợi.
     * 
     * @param range - '7d' | '30d' | '90d'. Default: '7d'
     * @param from - Optional custom start date (YYYY-MM-DD)
     * @param to - Optional custom end date (YYYY-MM-DD)
     */
    @Get('stats')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async getVisitors(
        @Query('range') range: string = '7d',
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        // Validate range preset
        const validRanges = ['7d', '30d', '90d'];
        if (!validRanges.includes(range) && !from) {
            throw new BadRequestException(`Invalid range. Must be one of: ${validRanges.join(', ')}`);
        }

        let fromDate: Date | undefined;
        let toDate: Date | undefined;

        if (from) {
            fromDate = new Date(from);
            if (isNaN(fromDate.getTime())) throw new BadRequestException('Invalid "from" date');
        }
        if (to) {
            toDate = new Date(to);
            if (isNaN(toDate.getTime())) throw new BadRequestException('Invalid "to" date');
            toDate.setHours(23, 59, 59, 999);
        }

        const stats = await this.analyticsService.getVisitorStats(range, fromDate, toDate);

        return {
            statusCode: 200,
            message: 'Get visitors analytics successfully',
            data: stats,
        };
    }

    /**
     * GET /api/insight/overview
     * 
     * API tổng hợp cho Dashboard.
     */
    @Get('overview')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async getDashboard(
        @Query('from') from?: string,
        @Query('to') to?: string,
    ): Promise<DashboardStatsResponse> {
        // Parse và validate dates
        const now = new Date();
        let fromDate: Date;
        let toDate: Date;

        // Parse 'to' date (default: end of today)
        if (to) {
            toDate = new Date(to);
            if (isNaN(toDate.getTime())) {
                throw new BadRequestException('Invalid "to" date format. Use YYYY-MM-DD.');
            }
            // Set to end of day
            toDate.setHours(23, 59, 59, 999);
        } else {
            toDate = new Date(now);
            toDate.setHours(23, 59, 59, 999);
        }

        // Parse 'from' date (default: 7 days ago)
        if (from) {
            fromDate = new Date(from);
            if (isNaN(fromDate.getTime())) {
                throw new BadRequestException('Invalid "from" date format. Use YYYY-MM-DD.');
            }
            // Set to start of day
            fromDate.setHours(0, 0, 0, 0);
        } else {
            fromDate = new Date(now);
            fromDate.setDate(fromDate.getDate() - 7);
            fromDate.setHours(0, 0, 0, 0);
        }

        // Validate: from phải trước to
        if (fromDate > toDate) {
            throw new BadRequestException('"from" date must be before "to" date.');
        }

        // Validate: Không cho phép query quá 1 năm để tránh query nặng
        const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days in ms
        if (toDate.getTime() - fromDate.getTime() > maxRange) {
            throw new BadRequestException('Date range cannot exceed 1 year.');
        }

        return this.analyticsService.getDashboardStats(fromDate, toDate);
    }

    /**
     * GET /api/insight/posts/summary
     * 
     * API chuyên biệt cho thống kê Bài viết (Post Analytics)
     */
    @Get('posts/summary')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async getPostSummary(@Query('range') range: string = '90d') {
        const stats = await this.analyticsService.getPostSummary(range);
        return {
            statusCode: 200,
            message: 'Get post analytics summary successfully',
            data: stats,
        };
    }

    // ========== HELPER METHODS ==========

    /**
     * Lấy IP thực của client qua các header phổ biến
     * (Hỗ trợ Nginx, Cloudflare, AWS ALB...)
     */
    private extractRealIp(req: Request, fallbackIp: string): string {
        // Cloudflare
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        if (cfConnectingIp) {
            return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
        }

        // X-Forwarded-For (Nginx, AWS ALB)
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            const ips = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor).split(',');
            return ips[0].trim();
        }

        // X-Real-IP (Alternative)
        const xRealIp = req.headers['x-real-ip'];
        if (xRealIp) {
            return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
        }

        // Fallback to direct connection IP
        return fallbackIp || '127.0.0.1';
    }
}
