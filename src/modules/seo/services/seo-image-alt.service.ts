import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';
import { AIProviderType } from '@/modules/ai-content/entities/api-key.entity';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface ImageAltSuggestion {
    imageUrl: string;
    originalAlt: string;
    suggestedAlt: string;
    context: string; // Surrounding text for context
}

@Injectable()
export class SeoImageAltService {
    private readonly logger = new Logger(SeoImageAltService.name);

    constructor(
        private readonly aiContentService: AiContentService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    async generateAltTexts(
        content: string,
        focusKeyword: string,
        user: User
    ): Promise<ImageAltSuggestion[]> {
        const $ = cheerio.load(content);
        const images: ImageAltSuggestion[] = [];

        $('img').each((index, element) => {
            const img = $(element);
            const src = img.attr('src') || '';
            const alt = img.attr('alt') || '';

            // Get surrounding text for context
            const parent = img.parent();
            const context = parent.text().substring(0, 200);

            images.push({
                imageUrl: src,
                originalAlt: alt,
                suggestedAlt: '', // Will be filled by AI
                context
            });
        });

        // Sprint 41: Optimize with parallel processing (Promise.all) instead of sequential
        await Promise.all(images.map(async (img) => {
            if (!img.originalAlt) { // Only generate if missing
                img.suggestedAlt = await this.generateSingleAltText(
                    img.context,
                    focusKeyword,
                    img.imageUrl,
                    user
                );
            }
        }));

        return images.filter(img => img.suggestedAlt); // Return only images with suggestions
    }

    async generateSingleAltText(
        context: string,
        keyword: string,
        imageUrl: string,
        user: User
    ): Promise<string> {
        // Sprint 41: Cache expensive AI operations
        const contextHash = crypto.createHash('sha256').update(context + keyword + imageUrl).digest('hex');
        const cacheKey = `seo:alt:${contextHash}`;

        const cached = await this.cacheManager.get<string>(cacheKey);
        if (cached) return cached;

        // Try to extract meaningful info from filename
        const filename = imageUrl.split('/').pop()?.split('?')[0] || '';
        const filenameContext = filename.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');

        const instruction = `
Tạo alt text SEO cho một hình ảnh.

NGỮNH CẢNH BÀI VIẾT: ${context}
TỪ KHÓA CHÍNH: ${keyword}
TÊN FILE ẢNH: ${filenameContext}

QUY TẮC:
1. Mô tả chính xác nội dung ảnh (dựa vào context và filename)
2. Tự nhiên đưa từ khóa "${keyword}" vào nếu phù hợp
3. Độ dài: 80-125 ký tự
4. Tránh "hình ảnh", "ảnh", "picture" (Google đã biết đó là ảnh)
5. Cụ thể, mô tả chi tiết

FORMAT OUTPUT:
Chỉ trả về alt text, không giải thích.
    `;

        try {
            const prompt = `\n${instruction}\n\n[Original Content]\n${context}`;
            const altText = await this.aiContentService.generateWithFallback(prompt, user, {
                systemPrompt: "You are an expert SEO specialist creating compact alt text suitable for visually impaired users.",
                temperature: 0.6,
                maxTokens: 50,
                preferredProviders: [
                    AIProviderType.GROQ,
                    AIProviderType.CEREBRAS,
                    AIProviderType.TOGETHER
                ]
            });

            const finalAlt = altText.trim().substring(0, 125);
            await this.cacheManager.set(cacheKey, finalAlt, 7 * 24 * 3600 * 1000); // 7 days cache
            return finalAlt;
        } catch (error) {
            this.logger.error(`Alt text generation failed for ${imageUrl}: ${error.message}`);
            return filenameContext.substring(0, 125);
        }
    }
}
