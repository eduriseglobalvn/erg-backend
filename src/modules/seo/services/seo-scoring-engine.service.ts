import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { SeoScoreHistory } from '../entities/seo-score-history.entity';
import { Post } from '../../posts/entities/post.entity';
import * as cheerio from 'cheerio';
import { AiContentService } from '../../ai-content/services/ai-content.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class SeoScoringEngineService {
    private readonly logger = new Logger(SeoScoringEngineService.name);

    constructor(
        @InjectRepository(SeoScoreHistory, 'mongo-connection')
        private readonly historyRepository: EntityRepository<SeoScoreHistory>,
        private readonly aiContentService: AiContentService
    ) { }

    /**
     * Chấm điểm SEO toàn diện một bài viết
     */
    async calculateScore(post: Post, keyword?: string): Promise<SeoScoreHistory> {
        this.logger.log(`Calculating SEO score for post ${post.id}...`);

        const $ = cheerio.load(post.content || '');
        const textContent = $.text().toLowerCase();
        const mainKeyword = (keyword || post.title).toLowerCase();

        // 1. Keyword Density (Tần suất xuất hiện từ khóa)
        const densityScore = this.calculateDensityScore(textContent, mainKeyword);

        // 2. Readability (Độ dễ đọc: độ dài câu, từ ngữ)
        const readabilityScore = this.calculateReadabilityScore(textContent);

        // 3. Meta Tags (Title, Description, Keyword presence)
        const metaScore = this.calculateMetaScore(post, mainKeyword);

        // 4. Internal Links (Sự liên kết nội bộ)
        const internalLinksScore = this.calculateInternalLinksScore($);

        // 5. Tính toán overall
        const overallScore = Math.round(
            (densityScore * 0.3) +
            (readabilityScore * 0.2) +
            (metaScore * 0.4) +
            (internalLinksScore * 0.1)
        );

        // 6. AI Optimization Rating (Asynchronous enhancement)
        const { rating, recommendations } = await this.getAiDetailedAnalysis(post, mainKeyword);

        const record = this.historyRepository.create({
            postId: post.id,
            date: new Date(),
            overallScore,
            keywordDensityScore: densityScore,
            readabilityScore,
            metaTagsScore: metaScore,
            internalLinksScore: internalLinksScore,
            aiContentOptimizationRating: rating,
            recommendations: recommendations
        } as any);

        await this.historyRepository.getEntityManager().persistAndFlush(record);
        return record;
    }

    private calculateDensityScore(text: string, keyword: string): number {
        if (!text || !keyword) return 0;

        // Count occurrences
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        const count = matches ? matches.length : 0;

        const wordsCount = text.split(/\s+/).length || 1;
        const density = (count / wordsCount) * 100;

        // Ideal density: 1% to 2.5%
        if (density >= 1 && density <= 2.5) return 100;
        if (density > 0 && density < 1) return 60 + (density * 40); // 0.5% = 80
        if (density > 2.5 && density <= 4) return 80; // Keyword stuffing risk
        if (density > 4) return 30; // High keyword stuffing
        return 0; // Not found at all
    }

    private calculateReadabilityScore(text: string): number {
        if (!text || text.length < 50) return 30; // Quá ngắn

        const sentences = text.split(/[.!?]+/).length || 1;
        const words = text.split(/\s+/).length || 1;
        const avgWordsPerSentence = words / sentences;

        // Câu nên ngắn gọn: ~ 15-20 từ
        if (avgWordsPerSentence <= 20) return 100;
        if (avgWordsPerSentence <= 25) return 80;
        if (avgWordsPerSentence <= 35) return 50;
        return 30; // Rất khó đọc
    }

    private calculateMetaScore(post: Post, keyword: string): number {
        let score = 0;
        const hasTitle = !!post.metaTitle;
        const hasDesc = !!post.metaDescription;

        if (hasTitle) score += 30;
        if (hasDesc) score += 30;

        if (hasTitle && post.metaTitle?.toLowerCase().includes(keyword)) score += 20;
        if (hasDesc && post.metaDescription?.toLowerCase().includes(keyword)) score += 20;

        return score;
    }

    private calculateInternalLinksScore($: cheerio.CheerioAPI): number {
        let score = 0;
        const links = $('a');

        links.each((_, el) => {
            const href = $(el).attr('href');
            // Assuming ERG domain links or relative paths
            if (href && (href.startsWith('/') || href.includes('erg.edu.vn'))) {
                score += 25;
            }
        });

        // Cap at 100 (4 or more internal links = max score)
        return Math.min(score, 100);
    }

    private async getAiDetailedAnalysis(post: Post, keyword: string): Promise<{ rating: string, recommendations: string[] }> {
        const systemUser = { id: 'system', email: 'system@erg.edu.vn' } as User;
        const prompt = `Bạn là chuyên gia SEO tiếng Việt phân tích bài viết.
        Tiêu đề: ${post.title}
        Từ khóa chính: ${keyword}
        
        1. Đánh giá Letter Rating của SEO (A+, A, B, C, D).
        2. Đưa ra chính xác 3 gạch đầu dòng ngắn gọn về điều cần cải thiện.
        
        Output Format STRICT JSON:
        {
           "rating": "A",
           "recommendations": ["Thêm alt image", "H2 chưa chứa từ khóa", "Nội dung hơi ngắn"]
        }`;

        try {
            const aiResponseStr = await this.aiContentService.generateWithFallback(prompt, systemUser, { systemPrompt: 'Chuyên gia SEO', maxTokens: 400 });
            const cleanStr = aiResponseStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanStr);
            return {
                rating: result.rating || 'N/A',
                recommendations: result.recommendations || []
            };
        } catch (e) {
            this.logger.error(`AI Analysis Failed: ${e.message}`);
            return { rating: 'N/A', recommendations: ['Lỗi khi gọi AI Rating'] };
        }
    }
}
