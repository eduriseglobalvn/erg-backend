import { Injectable } from '@nestjs/common';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';

export interface MetaSuggestion {
    description: string;
    score: number;
    length: number;
    hasKeyword: boolean;
    hasCTA: boolean;
}

@Injectable()
export class SeoMetaService {
    constructor(
        private readonly aiContentService: AiContentService
    ) { }

    async generateMetaDescriptions(
        keyword: string,
        content: string,
        user: User
    ): Promise<MetaSuggestion[]> {
        const instruction = `
Tạo 3 meta description SEO cho bài viết về "${keyword}".

NỘI DUNG CHÍNH:
${content.substring(0, 1000)}

QUY TẮC:
1. Độ dài: 150-160 ký tự
2. Bao gồm từ khóa "${keyword}" tự nhiên
3. Tóm tắt giá trị chính của bài viết
4. Kết thúc bằng Call-to-Action (VD: "Tìm hiểu ngay!", "Xem chi tiết →")
5. Tránh keyword stuffing

FORMAT OUTPUT:
Mỗi dòng 1 description, không số thứ tự.
    `;

        const rawDescriptions = await this.aiContentService.refineText(
            content,
            instruction,
            user
        );

        const descriptions = rawDescriptions.split('\n').filter(d => d.trim());

        return descriptions.map(desc => this.scoreMetaDescription(desc.trim(), keyword));
    }

    private scoreMetaDescription(description: string, keyword: string): MetaSuggestion {
        let score = 100;
        const length = description.length;
        const lowerDesc = description.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();

        // Length check
        if (length < 120) score -= 20;
        else if (length < 150) score -= 5;
        else if (length > 160) score -= 30;

        // Keyword presence
        const hasKeyword = lowerDesc.includes(lowerKeyword);
        if (!hasKeyword) score -= 40;

        // Call-to-action detection
        const ctaPatterns = [
            'tìm hiểu', 'xem', 'đọc', 'khám phá', 'ngay',
            '→', '»', 'click', 'nhấn', 'truy cập'
        ];
        const hasCTA = ctaPatterns.some(pattern => lowerDesc.includes(pattern));
        if (!hasCTA) score -= 10;

        return {
            description,
            score: Math.max(0, score),
            length,
            hasKeyword,
            hasCTA
        };
    }
}
