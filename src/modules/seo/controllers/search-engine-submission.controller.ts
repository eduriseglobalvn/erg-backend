import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permissions } from '../../access-control/decorators/permissions.decorator';
import { SearchEngineSubmissionService } from '../services/search-engine-submission.service';

@ApiTags('SEO Search Engine Submission')
@Controller('seo/submission')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchEngineSubmissionController {
    constructor(private readonly submissionService: SearchEngineSubmissionService) { }

    @Post('submit')
    @Permissions('system.manage.settings')
    @ApiOperation({ summary: 'Submit a URL to Google & IndexNow explicitly' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                url: { type: 'string', example: 'https://erg.edu.vn/courses/excel-co-ban' },
                type: { type: 'string', enum: ['URL_UPDATED', 'URL_DELETED'], default: 'URL_UPDATED' }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Returns submission results' })
    async submitUrl(@Body() body: { url: string; type: 'URL_UPDATED' | 'URL_DELETED' }) {
        return this.submissionService.submitAll(body.url, body.type);
    }

    @Get('logs')
    @Permissions('system.manage.settings')
    @ApiOperation({ summary: 'Get URL submission history' })
    @ApiResponse({ status: 200, description: 'Paginated list of submission logs' })
    async getLogs(@Query('page') page: string = '1', @Query('limit') limit: string = '20') {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        return this.submissionService.getSubmissionLogs(p, l);
    }
}
