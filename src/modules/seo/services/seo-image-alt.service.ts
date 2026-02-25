import { Injectable } from '@nestjs/common';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';
import * as cheerio from 'cheerio';

export interface ImageAltSuggestion {
    imageUrl: string;
    originalAlt: string;
    suggestedAlt: string;
    context: string; // Surrounding text for context
}

@Injectable()
export class SeoImageAltService {
    constructor(
        private readonly aiContentService: AiContentService
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

        // Generate alt text for each image without alt
        for (const img of images) {
            if (!img.originalAlt) { // Only generate if missing
                img.suggestedAlt = await this.generateSingleAltText(
                    img.context,
                    focusKeyword,
                    img.imageUrl,
                    user
                );
            }
        }

        return images.filter(img => img.suggestedAlt); // Return only images with suggestions
    }

    async generateSingleAltText(
        context: string,
        keyword: string,
        imageUrl: string,
        user: User
    ): Promise<string> {
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
            const altText = await this.aiContentService.refineText(
                context,
                instruction,
                user
            );
            return altText.trim().substring(0, 125); // Enforce max length
        } catch (error) {
            // Fallback to filename-based alt if AI fails
            return filenameContext.substring(0, 125);
        }
    }
}
