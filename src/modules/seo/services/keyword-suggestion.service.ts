import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AiContentService } from '../../ai-content/services/ai-content.service';
import { PostCategory } from '../../posts/entities/post-category.entity';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/entities/user.entity';

export interface KeywordSuggestion {
    keyword: string;
    type: 'related' | 'long-tail' | 'question' | 'comparison' | 'autocomplete';
    intent?: string;
    searchVolume?: string; // Optional indicator (high, medium, low)
}

export interface KeywordSuggestionQuery {
    keyword: string;
    category?: string;
    type?: 'post' | 'course';
    limit?: number;
}

export interface KeywordSuggestionResult {
    originalKeyword: string;
    suggestions: KeywordSuggestion[];
}

@Injectable()
export class KeywordSuggestionService {
    private readonly logger = new Logger(KeywordSuggestionService.name);

    constructor(
        private readonly aiContentService: AiContentService,
        private readonly configService: ConfigService
    ) { }

    /**
     * Source 1: Google Autocomplete (miễn phí, real-time)
     */
    async getGoogleSuggestions(keyword: string, language: string = 'vi'): Promise<KeywordSuggestion[]> {
        this.logger.debug(`Fetching Google Suggestions for keyword: ${keyword}`);
        try {
            const response = await axios.get(`https://suggestqueries.google.com/complete/search`, {
                params: {
                    client: 'firefox',
                    q: keyword,
                    hl: language
                },
                timeout: 5000,
            });

            // Google returns: [ "original_keyword", ["suggestion1", "suggestion2", ...] ]
            const suggestionsArr: string[] = response.data[1] || [];

            return suggestionsArr.map(s => ({
                keyword: s,
                type: 'autocomplete',
                intent: 'navigational/informational'
            }));
        } catch (error) {
            this.logger.error(`Error fetching Google autocomplete: ${error.message}`);
            return []; // Fallback empty if Google blocks/fails
        }
    }

    /**
     * Source 3: AI-Powered Keyword Expansion
     */
    async getAiKeywordExpansion(
        keyword: string,
        category: string = 'General',
        type: 'post' | 'course' = 'post'
    ): Promise<KeywordSuggestion[]> {
        this.logger.debug(`Fetching AI Keyword Expansion for: ${keyword}`);

        const prompt = `Bạn là chuyên gia SEO tiếng Việt. Cho keyword chính là "${keyword}" trong lĩnh vực "${category}" (dùng cho ${type === 'post' ? 'bài viết blog' : 'khóa học online'}).
Hãy đề xuất các nhóm từ khóa SEO quan trọng bằng định dạng JSON strict array như sau, KHÔNG output markdown code block, CHỈ JSON:
[
  { "keyword": "từ khóa 1", "type": "related", "intent": "informational", "searchVolume": "high" },
  { "keyword": "cách làm từ khóa 2", "type": "long-tail", "intent": "informational", "searchVolume": "medium" },
  { "keyword": "tại sao từ khóa 3", "type": "question", "intent": "informational", "searchVolume": "low" },
  { "keyword": "từ khóa 4 vs từ khóa 5", "type": "comparison", "intent": "commercial", "searchVolume": "medium" }
]

Yêu cầu:
- generate 5 "related" keywords
- generate 5 "long-tail" keywords (cụm từ dài 3-5+ từ)
- generate 3 "question" keywords ("cách...", "làm sao...", "tại sao...")
- generate 2 "comparison" keywords ("... vs ...", "... hay ...", "... tốt hơn ...")
Tổng cộng đúng 15 kết quả nội dung tiếng Việt. Intent có thể là: informational, commercial, txa, navigational.`;

        try {
            // Using existing AiContentService internally!
            const systemUser = { id: 'system', email: 'system@erg.edu.vn' } as User;
            const aiResponseStr = await this.aiContentService.generateWithFallback(prompt, systemUser, { systemPrompt: 'Chuyên gia SEO tiếng Việt', maxTokens: 8000 }); // Pass mock user as this is internal system
            const cleanStr = aiResponseStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const suggestions: KeywordSuggestion[] = JSON.parse(cleanStr);
            return suggestions;
        } catch (error) {
            this.logger.error(`Failed to generate AI keywords: ${error.message}`);
            return [];
        }
    }

    /**
     * AGGREGATED ENDPOINT (dùng cho FE Admin)
     */
    async getSuggestions(query: KeywordSuggestionQuery): Promise<KeywordSuggestionResult> {
        const [googleResults, aiResults] = await Promise.all([
            this.getGoogleSuggestions(query.keyword),
            this.getAiKeywordExpansion(query.keyword, query.category, query.type)
        ]);

        // Merge & deduplicate
        const merged = [...googleResults, ...aiResults];
        const uniqueSuggestions: KeywordSuggestion[] = [];
        const seen = new Set();

        for (const item of merged) {
            if (!seen.has(item.keyword.toLowerCase())) {
                uniqueSuggestions.push(item);
                seen.add(item.keyword.toLowerCase());
            }
        }

        return {
            originalKeyword: query.keyword,
            suggestions: uniqueSuggestions.slice(0, query.limit || 30)
        };
    }
}
