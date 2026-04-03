import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Post } from '../../posts/entities/post.entity';
import { SeoScoreHistory } from '../entities/seo-score-history.entity';
import { SeoScoringEngineService } from './seo-scoring-engine.service';

@Injectable()
export class SeoDashboardService {
    private readonly logger = new Logger(SeoDashboardService.name);

    constructor(
        @InjectRepository(Post)
        private readonly postRepository: EntityRepository<Post>,
        @InjectRepository(SeoScoreHistory, 'mongo-connection')
        private readonly historyRepository: EntityRepository<SeoScoreHistory>,
        private readonly seoScoringEngineService: SeoScoringEngineService,
    ) { }

    async getDashboardStats() {
        const posts = await this.postRepository.find(
            { deletedAt: null },
            { fields: ['id', 'title', 'slug', 'seoScore', 'createdAt', 'updatedAt'] }
        );

        const totalPosts = posts.length;
        if (totalPosts === 0) {
            return {
                averageScore: 0,
                scoreDistribution: { bad: 0, ok: 0, good: 0, excellent: 0 },
                worstPosts: [],
                bestPosts: []
            };
        }

        let totalScore = 0;
        const distribution = { bad: 0, ok: 0, good: 0, excellent: 0 }; // 0-30, 31-60, 61-80, 81-100

        posts.forEach(post => {
            const score = post.seoScore || 0;
            totalScore += score;

            if (score <= 30) distribution.bad++;
            else if (score <= 60) distribution.ok++;
            else if (score <= 80) distribution.good++;
            else distribution.excellent++;
        });

        // Sort posts to find worst and best
        posts.sort((a, b) => (a.seoScore || 0) - (b.seoScore || 0));

        const worstPosts = posts.slice(0, 10).map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            score: p.seoScore || 0,
        }));

        const bestPosts = posts.slice().reverse().slice(0, 10).map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            score: p.seoScore || 0,
        }));

        return {
            averageScore: Math.round(totalScore / totalPosts),
            scoreDistribution: distribution,
            worstPosts,
            bestPosts,
            totalAnalyzedPosts: totalPosts
        };
    }

    async runBatchAnalysis(postIds?: string[]) {
        this.logger.log(`Starting batch analysis for ${postIds?.length || 'all'} posts...`);
        // We use background process without awaiting the final results directly for the response.
        setImmediate(async () => {
            try {
                const whereClause = postIds && postIds.length > 0 ? { id: { $in: postIds } } : { deletedAt: null };
                const posts = await this.postRepository.find(whereClause);
                let count = 0;

                for (const post of posts) {
                    try {
                        const scoreHistory = await this.seoScoringEngineService.calculateScore(post, post.focusKeyword);
                        // Cập nhật điểm gốc của bài viết
                        post.seoScore = scoreHistory.overallScore;
                        await this.postRepository.getEntityManager().flush();
                        count++;
                        // Tránh overload AI API
                        await new Promise(res => setTimeout(res, 2000));
                    } catch (e) {
                        this.logger.warn(`Failed to process post ${post.id} during batch: ${e.message}`);
                    }
                }
                this.logger.log(`Batch analysis completed. Analyzed ${count}/${posts.length} posts.`);
            } catch (error) {
                this.logger.error(`Batch analysis failed entirely! ${error.message}`);
            }
        });
    }
}
