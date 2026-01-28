import { Injectable } from '@nestjs/common';
import slugify from 'slugify';

export interface SeoAnalysisResult {
    score: number;
    readabilityScore: number;
    keywordDensity: number;
    wordCount: number;
    suggestions: string[];
}

@Injectable()
export class SeoAnalyzerService {
    /**
     * Tính điểm SEO tổng thể (0-100)
     */
    analyze(content: string, focusKeyword?: string): SeoAnalysisResult {
        const cleanText = this.stripHtml(content);
        const wordCount = cleanText.split(/\s+/).length;
        const suggestions: string[] = [];
        let score = 0;

        // 1. Content Length (20 points)
        if (wordCount >= 600) score += 20;
        else if (wordCount >= 300) score += 10;
        else suggestions.push('Nội dung quá ngắn (dưới 300 từ). Hãy viết thêm.');

        // 2. Keyword Analysis (30 points)
        let density = 0;
        if (focusKeyword) {
            const lowerText = cleanText.toLowerCase();
            const lowerKeyword = focusKeyword.toLowerCase();
            const matches = lowerText.split(lowerKeyword).length - 1;
            density = (matches * lowerKeyword.split(' ').length) / wordCount;

            if (density >= 0.005 && density <= 0.025) {
                score += 30; // 0.5% - 2.5% is good
            } else if (density > 0.025) {
                score += 10;
                suggestions.push(`Mật độ từ khóa '${focusKeyword}' quá cao (${(density * 100).toFixed(2)}%). Có thể bị đánh dấu spam.`);
            } else {
                score += 10;
                suggestions.push(`Mật độ từ khóa '${focusKeyword}' thấp (${(density * 100).toFixed(2)}%). Hãy nhắc lại từ khóa nhiều hơn.`);
            }

            // Check Heading (Simplified)
            if (content.toLowerCase().includes(`>${lowerKeyword}<`) || content.toLowerCase().includes(`>${lowerKeyword} `)) {
                // This is a naive check. Better regex needed for H1-H6
                score += 5; // Bonus
            }
        } else {
            suggestions.push('Chưa xác định từ khóa chính (Focus Keyword).');
        }

        // 3. Structure Analysis (25 points)
        const headings = (content.match(/<h[1-6]/g) || []).length;
        const images = (content.match(/<img/g) || []).length;

        if (headings >= 2) score += 15;
        else suggestions.push('Bài viết thiếu các thẻ Heading (H2, H3) để phân chia cấu trúc.');

        if (images >= 1) score += 10;
        else suggestions.push('Bài viết nên có ít nhất 1 hình ảnh minh họa.');

        // 4. Readability (Basic) (25 points)
        // Giả lập điểm readability dựa trên độ dài câu trung bình (naive for VN)
        const sentences = cleanText.split(/[.?!]+/).length;
        const avgWordsPerSentence = wordCount / (sentences || 1);
        let readabilityScore = 100;

        if (avgWordsPerSentence > 25) {
            readabilityScore = 60;
            suggestions.push('Nhiều câu quá dài. Hãy ngắt câu ngắn gọn hơn.');
        } else if (avgWordsPerSentence > 20) {
            readabilityScore = 80;
        }

        score += Math.round(readabilityScore * 0.25);

        return {
            score: Math.min(100, score),
            readabilityScore,
            keywordDensity: density,
            wordCount,
            suggestions,
        };
    }

    /**
     * Tự động tạo Meta Title & Description từ nội dung
     */
    generateMeta(title: string, content: string): { metaTitle: string; metaDescription: string } {
        const cleanText = this.stripHtml(content);

        // Meta Title: Title + Suffix (could be configurable)
        let metaTitle = title;
        if (metaTitle.length > 60) metaTitle = metaTitle.substring(0, 57) + '...';

        // Meta Description: First 150-160 chars
        let metaDescription = cleanText.substring(0, 160).trim();
        if (cleanText.length > 160) metaDescription += '...';

        return { metaTitle, metaDescription };
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>?/gm, '');
    }
}
