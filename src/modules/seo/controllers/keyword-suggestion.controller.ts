import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permissions } from '../../access-control/decorators/permissions.decorator';
import { KeywordSuggestionService } from '../services/keyword-suggestion.service';
import type { KeywordSuggestionQuery } from '../services/keyword-suggestion.service';

@ApiTags('SEO Keyword Suggestions')
@Controller('seo/keyword-suggestions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KeywordSuggestionController {
    constructor(private readonly keywordSuggestionService: KeywordSuggestionService) { }

    @Get()
    @Permissions('system.manage.settings') // Example permission, adjustable
    @ApiOperation({ summary: 'Get SEO keyword suggestions from Google & AI' })
    @ApiQuery({ name: 'keyword', required: true, description: 'Bản thân từ khóa gốc cần check' })
    @ApiQuery({ name: 'category', required: false, description: 'Lĩnh vực hiện tại của bài viết/khóa học' })
    @ApiQuery({ name: 'type', required: false, enum: ['post', 'course'], description: 'Đang tạo post hay course' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Returns an array of keyword suggestions' })
    async getSuggestions(@Query() query: KeywordSuggestionQuery) {
        if (!query.keyword) {
            throw new BadRequestException('Keyword is required');
        }
        return this.keywordSuggestionService.getSuggestions(query);
    }
}
