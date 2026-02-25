import { Injectable, Logger } from '@nestjs/common';
import { AiContentService } from '@/modules/ai-content/services/ai-content.service';
import { User } from '@/modules/users/entities/user.entity';
import * as cheerio from 'cheerio';

@Injectable()
export class SeoContentService {
    private readonly logger = new Logger(SeoContentService.name);

    constructor(private readonly aiContentService: AiContentService) { }

    /**
     * Rewrite content to be unique and highly optimized for specific keywords.
     * Essential for crawled content to avoid duplicate content penalties.
     */
    async paraphraseForSeo(content: string, keyword: string, user: User): Promise<string> {
        const instruction = `
Tối ưu hóa nội dung SEO bài viết với từ khóa mục tiêu: "${keyword}".

YÊU CẦU:
1. Viết lại các câu văn để đảm bảo tính độc nhất (Unique) nhưng vẫn giữ nguyên ý nghĩa gốc.
2. Tối ưu mật độ từ khóa "${keyword}" xuất hiện tự nhiên trong các đoạn văn.
3. Cải thiện cấu trúc Heading (Sử dụng các thẻ h2, h3 chứa từ khóa hoặc từ khóa liên quan).
4. Đảm bảo ngôn ngữ chuyên nghiệp, phù hợp với lĩnh vực giáo dục quốc tế của ERG.
5. Giữ nguyên toàn bộ các thẻ HTML như <img>, <table>, <iframe> và các links <a> quan trọng.
6. Kết quả trả về phải là mã HTML hoàn chỉnh.

QUY TẮC:
- Không thêm phần giới thiệu của AI.
- Chỉ trả về HTML.
        `;

        try {
            return await this.aiContentService.refineText(content, instruction, user);
        } catch (error) {
            this.logger.error(`Paraphrase failed: ${error.message}`);
            return content; // Fallback to original
        }
    }

    /**
     * Clean and optimize HTML structure (e.g., ensuring only one H1, proper nesting)
     */
    async optimizeHtmlStructure(html: string): Promise<string> {
        const $ = cheerio.load(html);

        // Ensure no multiple H1s (common in crawled content)
        const h1s = $('h1');
        if (h1s.length > 1) {
            h1s.slice(1).each((i, el) => {
                const text = $(el).text();
                $(el).replaceWith(`<h2>${text}</h2>`);
            });
        }

        // Remove empty paragraphs
        $('p:empty').remove();

        return $.html();
    }
}
