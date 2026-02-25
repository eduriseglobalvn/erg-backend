import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SeoHistory } from '../entities/seo-history.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { ComprehensiveSeoAnalysis } from './seo-analyzer.service';

@Injectable()
export class SeoHistoryService {
    constructor(private readonly em: EntityManager) { }

    /**
     * Record SEO analysis snapshot
     */
    async recordSnapshot(post: Post, analysis: ComprehensiveSeoAnalysis, metadata?: any): Promise<SeoHistory> {
        const history = this.em.create(SeoHistory, {
            post,
            seoScore: analysis.overallScore,
            readabilityScore: analysis.contentAnalysis.readabilityScore,
            keywordDensity: analysis.contentAnalysis.keywordDensity,
            wordCount: analysis.contentAnalysis.wordCount,
            suggestions: analysis.suggestions,
            metadata,
        });

        await this.em.persistAndFlush(history);
        return history;
    }

    /**
     * Get SEO history for a post
     */
    async getHistory(postId: string, days: number = 30): Promise<SeoHistory[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        return this.em.find(SeoHistory, {
            post: postId,
            createdAt: { $gte: since },
        }, {
            orderBy: { createdAt: 'DESC' },
        });
    }

    /**
     * Get latest SEO snapshot for a post
     */
    async getLatest(postId: string): Promise<SeoHistory | null> {
        return this.em.findOne(SeoHistory, {
            post: postId,
        }, {
            orderBy: { createdAt: 'DESC' },
        });
    }

    /**
     * Get SEO trends (score over time)
     */
    async getTrends(postId: string, days: number = 30): Promise<Array<{
        date: Date;
        seoScore: number;
        readabilityScore: number;
        wordCount: number;
    }>> {
        const history = await this.getHistory(postId, days);

        return history.map(h => ({
            date: h.createdAt,
            seoScore: h.seoScore,
            readabilityScore: h.readabilityScore,
            wordCount: h.wordCount,
        }));
    }
}
