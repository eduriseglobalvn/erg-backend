import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';
import { AIProviderType } from '@/modules/ai-content/entities/api-key.entity';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface SeoBatchResult {
    title: string;
    metaDescription: string;
    keywords: string[];
}

@Injectable()
export class SeoBatchService {
    private readonly logger = new Logger(SeoBatchService.name);

    constructor(
        private readonly aiContentService: AiContentService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    async generateSeoBatch(htmlContent: string, currentTitle: string, user: User): Promise<SeoBatchResult> {
        // Sprint 41: Implement caching for AI expensive operations
        const contentHash = crypto.createHash('sha256').update(htmlContent + currentTitle).digest('hex');
        const cacheKey = `seo:batch:${contentHash}`;

        const cached = await this.cacheManager.get<SeoBatchResult>(cacheKey);
        if (cached) {
            this.logger.debug(`[CACHE HIT] SEO Batch for hash: ${contentHash.substring(0, 8)}`);
            return cached;
        }

        const $ = cheerio.load(htmlContent);
        let textContent = $.text().replace(/\s+/g, ' ').trim();
        if (textContent.length > 5000) {
            textContent = textContent.substring(0, 5000) + '...';
        }

        const prompt = `
Bạn là một chuyên gia SEO Backend. Dựa vào nội dung bài viết và tiêu đề hiện tại, hãy tạo Title, Meta Description, và Keywords tối ưu SEO nhất.
Chỉ trả về ĐÚNG MỘT khối JSON hợp lệ theo định dạng sau, tuyệt đối KHÔNG bao gồm markdown \`\`\`json hay bất kỳ văn bản nào khác:
{
  "title": "Tiêu đề tối ưu (dưới 60 ký tự)",
  "metaDescription": "Mô tả meta tối ưu (dưới 160 ký tự)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Tiêu đề hiện tại: ${currentTitle}
Nội dung bài viết (trích xuất):
${textContent}
        `.trim();

        try {
            const resultText = await this.aiContentService.generateWithFallback(prompt, user, {
                temperature: 0.7,
                maxTokens: 500,
                preferredProviders: [
                    AIProviderType.GROQ,
                    AIProviderType.CEREBRAS,
                    AIProviderType.TOGETHER
                ]
            });

            const cleanJson = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            const result = {
                title: parsed.title || currentTitle,
                metaDescription: parsed.metaDescription || '',
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
            };

            // Cache result for 7 days
            await this.cacheManager.set(cacheKey, result, 7 * 24 * 3600 * 1000);
            return result;

        } catch (error) {
            this.logger.error(`Failed to generate SEO batch: ${error.message}`);
            return {
                title: currentTitle,
                metaDescription: textContent.substring(0, 160),
                keywords: []
            };
        }
    }
}
