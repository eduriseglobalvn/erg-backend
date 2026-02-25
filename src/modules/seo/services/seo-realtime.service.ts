import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DraftAnalysisDto } from '../dto/draft-analysis.dto';
import * as crypto from 'crypto';

@Injectable()
export class SeoRealtimeService {
    private readonly logger = new Logger(SeoRealtimeService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async analyzeDraft(dto: DraftAnalysisDto): Promise<any> {
        const cacheKey = this.generateCacheKey(dto);

        // 1. Check cache (TTL: 60s)
        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                if (typeof cached === 'string') return JSON.parse(cached);
                return cached;
            }
        } catch (error) {
            this.logger.warn('Cache get error', error);
        }

        // 2. Mock Analysis (Yoast logic moved to Frontend)
        const result = {
            score: 0,
            readabilityScore: 0,
            keywordDensity: 0,
            suggestions: [],
            details: { seo: [], readability: [] }
        };

        // 3. Cache result
        try {
            await this.cacheManager.set(cacheKey, result, 60);
        } catch (error) {
            this.logger.warn('Cache set error', error);
        }

        return result;
    }

    private generateCacheKey(dto: DraftAnalysisDto): string {
        // Hash content to keep key short
        const contentHash = crypto
            .createHash('md5')
            .update(dto.content || '')
            .update(dto.title || '')
            .update(dto.focusKeyword || '')
            .digest('hex');

        return `seo:draft:${contentHash}`;
    }
}
