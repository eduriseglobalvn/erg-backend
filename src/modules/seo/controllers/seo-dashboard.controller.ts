import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permissions } from '../../access-control/decorators/permissions.decorator';
import { SeoDashboardService } from '../services/seo-dashboard.service';

@ApiTags('SEO Dashboard')
@Controller('seo/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SeoDashboardController {
    constructor(private readonly seoDashboardService: SeoDashboardService) { }

    @Get()
    @Permissions('system.manage.settings')
    @ApiOperation({ summary: 'Get overall SEO dashboard statistics' })
    @ApiResponse({ status: 200, description: 'Returns SEO statistics across all posts.' })
    async getDashboardStats() {
        return this.seoDashboardService.getDashboardStats();
    }

    @Post('batch-analyze')
    @Permissions('system.manage.settings')
    @ApiOperation({ summary: 'Run batch SEO analysis on multiple posts' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                postIds: { type: 'array', items: { type: 'string' }, nullable: true, description: 'Nếu null sẽ phân tích tất cả bài viết' }
            }
        }
    })
    @ApiResponse({ status: 202, description: 'Batch analysis has started' })
    async runBatchAnalysis(@Body() dto: { postIds?: string[] }) {
        // Trigger background job or directly run processing
        // Since we don't have a BullMQ queue specifically initialized for this inside this PR yet,
        // we will trigger an asynchronous processing call.
        this.seoDashboardService.runBatchAnalysis(dto.postIds);
        return { message: 'Batch anaylsis started in the background.', status: 'processing' };
    }
}
