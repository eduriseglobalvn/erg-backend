import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { distance } from 'fastest-levenshtein';

@Injectable()
export class DuplicateDetectorService {
    private readonly logger = new Logger(DuplicateDetectorService.name);

    constructor(
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
    ) { }

    /**
     * Check if a URL has already been crawled and exists as a valid post.
     * Returns an object explaining the exact duplicate reason.
     */
    async isDuplicate(url: string, titleToCheck?: string): Promise<{ isDuplicate: boolean; reason?: string; existingPostId?: string }> {
        const normalizedUrl = this.normalizeUrl(url);

        // 1. Check exact or normalized URL match in CrawlHistory
        const history = await this.historyRepo.findOne({
            $or: [
                { url },
                { url: normalizedUrl }
            ]
        });

        if (history && history.postId) {
            const post = await this.postRepo.findOne({ id: history.postId, deletedAt: null });
            if (post) {
                return { isDuplicate: true, reason: 'Exact URL match found in database', existingPostId: post.id };
            }
        }

        // Fallback: search raw Post data by URL in AI Prompt
        const postByUrlPrompt = await this.postRepo.findOne({
            aiPrompt: { $like: `%${normalizedUrl}%` },
            deletedAt: null
        });
        if (postByUrlPrompt) {
            return { isDuplicate: true, reason: 'URL found inside existing post metadata', existingPostId: postByUrlPrompt.id };
        }

        // 2. Title Similarity Check (Levenshtein distance > 85%)
        if (titleToCheck && titleToCheck.length > 10) {
            // Find recent posts (last 100) to avoid slow queries across thousands of posts
            const recentPosts = await this.postRepo.find({ deletedAt: null }, { limit: 100, orderBy: { createdAt: 'DESC' } });

            for (const p of recentPosts) {
                if (!p.title) continue;
                const similarity = this.calculateSimilarity(titleToCheck, p.title);
                if (similarity > 0.85) {
                    this.logger.warn(`Duplicate detected by title similarity! (${(similarity * 100).toFixed(2)}%) Check: "${titleToCheck}" vs "${p.title}"`);
                    return { isDuplicate: true, reason: 'Title similarity > 85%', existingPostId: p.id };
                }
            }
        }

        return { isDuplicate: false };
    }

    /**
     * Normalize URL (remove trailing slashes, www, hash, query params)
     */
    private normalizeUrl(urlStr: string): string {
        try {
            const parsed = new URL(urlStr);
            let hostname = parsed.hostname.replace(/^www\./, '');
            let pathname = parsed.pathname.replace(/\/$/, '');
            return `${hostname}${pathname}`;
        } catch (e) {
            return urlStr.replace(/\/$/, ''); // fallback string manip
        }
    }

    /**
     * Calculate string similarity percentage using Levenshtein distance
     */
    private calculateSimilarity(s1: string, s2: string): number {
        const longer = s1.length >= s2.length ? s1 : s2;
        const shorter = s1.length < s2.length ? s1 : s2;
        const maxLen = longer.length;
        if (maxLen === 0) return 1.0;
        const dist = distance(longer.toLowerCase(), shorter.toLowerCase());
        return (maxLen - dist) / maxLen;
    }
}
