import { Injectable } from '@nestjs/common';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';

export interface TitleSuggestion {
    title: string;
    score: number; // 0-100 based on SEO best practices
    length: number;
    hasKeyword: boolean;
    reasoning: string;
}

@Injectable()
export class SeoTitleService {
    constructor(
        private readonly aiContentService: AiContentService
    ) { }

    async generateTitles(keyword: string, content: string, user: User): Promise<TitleSuggestion[]> {
        const instruction = `
Tạo 5 tiêu đề SEO tối ưu cho từ khóa "${keyword}".

QUY TẮC:
1. Độ dài: 50-60 ký tự
2. Bắt đầu bằng từ khóa chính
3. Thêm số liệu hoặc năm hiện tại nếu phù hợp
4. Tạo cảm giác khẩn cấp/tò mò
5. Tránh clickbait quá đà

FORMAT OUTPUT:
Mỗi dòng 1 tiêu đề, không có số thứ tự, không có dấu gạch đầu dòng.
    `;

        const rawTitles = await this.aiContentService.refineText(
            content.substring(0, 500), // First 500 chars for context
            instruction,
            user
        );

        const titles = rawTitles.split('\n').filter(t => t.trim());

        return titles.map(title => this.scoreTitle(title.trim(), keyword));
    }

    private scoreTitle(title: string, keyword: string): TitleSuggestion {
        let score = 100;
        const length = title.length;
        const lowerTitle = title.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();

        // Length check
        if (length < 30) score -= 30;
        else if (length < 50) score -= 10;
        else if (length > 60) score -= 20;

        // Keyword position (earlier = better)
        const keywordIndex = lowerTitle.indexOf(lowerKeyword);
        const hasKeyword = keywordIndex !== -1;
        if (!hasKeyword) score -= 40;
        else if (keywordIndex > 20) score -= 10;

        // Presence of numbers (bonus)
        if (/\d/.test(title)) score += 5;

        // Year mention (bonus)
        if (/202[4-9]/.test(title)) score += 5;

        const reasoning = this.generateReasoning(length, hasKeyword, keywordIndex);

        return {
            title,
            score: Math.max(0, score),
            length,
            hasKeyword,
            reasoning
        };
    }

    private generateReasoning(length: number, hasKeyword: boolean, keywordIndex: number): string {
        const reasons: string[] = [];

        if (length < 30) reasons.push('Tiêu đề quá ngắn');
        if (length > 60) reasons.push('Tiêu đề quá dài');
        if (!hasKeyword) reasons.push('Thiếu từ khóa chính');
        if (hasKeyword && keywordIndex > 20) reasons.push('Từ khóa nên ở gần đầu hơn');

        return reasons.length > 0 ? reasons.join(', ') : 'Tiêu đề tốt';
    }
}
