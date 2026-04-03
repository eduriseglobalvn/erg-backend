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
    Res,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Request, Response } from 'express';
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

    @Post('session/begin')
    async startVisit(
        @Body() body: TrackVisitDto,
        @Req() req: Request,
        @Ip() ip: string,
    ) {
        if (!body.url) {
            throw new BadRequestException('URL is required');
        }

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

    @Post('behavior')
    async trackEvent(
        @Body() body: TrackEventDto,
        @Req() req: Request,
    ) {
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

    @Put('session/:id/finish')
    async updateDuration(
        @Param('id') id: string,
        @Body('duration') duration: number,
    ) {
        if (!id) {
            throw new BadRequestException('Visit ID is required');
        }

        const durationSeconds = typeof duration === 'number' ? duration : parseInt(duration, 10);
        if (isNaN(durationSeconds) || durationSeconds < 0) {
            throw new BadRequestException('Duration must be a positive number');
        }

        const cappedDuration = Math.min(durationSeconds, 3600);

        await this.analyticsService.updateVisitDuration(id, cappedDuration);
        return { success: true };
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async getVisitors(
        @Query('range') range: string = '7d',
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
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

    @Get('overview')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async getDashboard(
        @Query('from') from?: string,
        @Query('to') to?: string,
    ): Promise<DashboardStatsResponse> {
        const now = new Date();
        let fromDate: Date;
        let toDate: Date;

        if (to) {
            toDate = new Date(to);
            if (isNaN(toDate.getTime())) {
                throw new BadRequestException('Invalid "to" date format. Use YYYY-MM-DD.');
            }
            toDate.setHours(23, 59, 59, 999);
        } else {
            toDate = new Date(now);
            toDate.setHours(23, 59, 59, 999);
        }

        if (from) {
            fromDate = new Date(from);
            if (isNaN(fromDate.getTime())) {
                throw new BadRequestException('Invalid "from" date format. Use YYYY-MM-DD.');
            }
            fromDate.setHours(0, 0, 0, 0);
        } else {
            fromDate = new Date(now);
            fromDate.setDate(fromDate.getDate() - 7);
            fromDate.setHours(0, 0, 0, 0);
        }

        if (fromDate > toDate) {
            throw new BadRequestException('"from" date must be before "to" date.');
        }

        const maxRange = 365 * 24 * 60 * 60 * 1000;
        if (toDate.getTime() - fromDate.getTime() > maxRange) {
            throw new BadRequestException('Date range cannot exceed 1 year.');
        }

        return this.analyticsService.getDashboardStats(fromDate, toDate);
    }

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

    @Get('export')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.logs')
    async exportData(
        @Query('from') from: string,
        @Query('to') to: string,
        @Res() res: Response
    ) {
        if (!from || !to) {
            throw new BadRequestException('Both "from" and "to" dates are required for export.');
        }

        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new BadRequestException('Invalid date format.');
        }

        const csv = await this.analyticsService.generateExportData(fromDate, toDate);

        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="traffic-report-${from}-to-${to}.csv"`,
        });

        return res.status(200).send(csv);
    }

    private extractRealIp(req: Request, fallbackIp: string): string {
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        if (cfConnectingIp) {
            return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
        }

        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            const ips = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor).split(',');
            return ips[0].trim();
        }

        const xRealIp = req.headers['x-real-ip'];
        if (xRealIp) {
            return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
        }

        return fallbackIp || '127.0.0.1';
    }
}
