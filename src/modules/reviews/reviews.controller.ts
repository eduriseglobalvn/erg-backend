import { Controller, Get, Post, Body, Query, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { Request } from 'express';
import { Public } from '@/shared/decorators/public.decorator';
import { ReviewStatus, ReviewTargetType } from './entities/review.entity';
import { Auditable } from '@/modules/audit/decorators/auditable.decorator';

interface RequestWithUser extends Request {
    user?: any;
}

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    @Post()
    @ApiOperation({ summary: 'Submit a new review' })
    @ApiResponse({ status: 201, description: 'Review created successfully.' })
    @Public()
    async create(@Body() dto: CreateReviewDto, @Req() req: RequestWithUser) {
        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'] as string;
        return this.reviewsService.create(dto, req.user, ipAddress, userAgent);
    }

    @Get()
    @ApiOperation({ summary: 'Get reviews for a target' })
    @ApiQuery({ name: 'targetId', required: true })
    @ApiQuery({ name: 'page', required: false })
    @Public()
    async findAll(
        @Query('targetId') targetId: string,
        @Query('page') page: number = 1,
    ) {
        return this.reviewsService.findAll(targetId, page);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get review statistics for a target' })
    @ApiQuery({ name: 'targetId', required: true })
    @Public()
    async getStats(@Query('targetId') targetId: string) {
        return this.reviewsService.getStats(targetId);
    }

    // --- ADMIN ENDPOINTS ---

    @Get('admin')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('reviews.manage')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all reviews (Admin only)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'status', enum: ReviewStatus, required: false })
    @ApiQuery({ name: 'targetType', enum: ReviewTargetType, required: false })
    async findAllAdmin(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('status') status?: ReviewStatus,
        @Query('targetType') targetType?: ReviewTargetType,
    ) {
        return this.reviewsService.findAllAdmin(page, limit, status, targetType);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('reviews.manage')
    @ApiBearerAuth()
    @Auditable({ action: 'UPDATE_STATUS', resourceType: 'Review' })
    @ApiOperation({ summary: 'Update review status (Approve/Reject)' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: { status: ReviewStatus; adminNote?: string },
        @Req() req: RequestWithUser,
    ) {
        return this.reviewsService.updateStatus(id, dto.status, dto.adminNote || '', req.user);
    }

    @Post('batch/status')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('reviews.manage')
    @ApiBearerAuth()
    @Auditable({ action: 'BULK_UPDATE_STATUS', resourceType: 'Review' })
    @ApiOperation({ summary: 'Bulk update review status' })
    async bulkUpdateStatus(
        @Body() dto: { ids: string[]; status: ReviewStatus },
        @Req() req: RequestWithUser,
    ) {
        return this.reviewsService.bulkUpdateStatus(dto.ids, dto.status, req.user);
    }

    @Post(':id/reply')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('reviews.manage')
    @ApiBearerAuth()
    @Auditable({ action: 'REPLY', resourceType: 'Review' })
    @ApiOperation({ summary: 'Reply to a review' })
    async reply(
        @Param('id') id: string,
        @Body() dto: { replyContent: string },
        @Req() req: RequestWithUser,
    ) {
        return this.reviewsService.reply(id, dto.replyContent, req.user);
    }

    @Patch(':id/feature')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('reviews.manage')
    @ApiBearerAuth()
    @Auditable({ action: 'TOGGLE_FEATURE', resourceType: 'Review' })
    @ApiOperation({ summary: 'Toggle featured status' })
    async toggleFeature(
        @Param('id') id: string,
        @Body() dto: { isFeatured: boolean },
    ) {
        return this.reviewsService.toggleFeature(id, dto.isFeatured);
    }
}
