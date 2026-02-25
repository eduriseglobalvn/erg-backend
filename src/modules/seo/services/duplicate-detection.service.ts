import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Post } from '@/modules/posts/entities/post.entity';
import * as fastestLevenshtein from 'fastest-levenshtein';

@Injectable()
export class DuplicateDetectionService {
    constructor(private readonly em: EntityManager) { }

    async checkDuplicate(content: string, currentPostId?: string) {
        // Fetch all published posts to compare
        const posts = await this.em.find(Post, {
            isPublished: true,
            id: { $ne: currentPostId },
        }, {
            fields: ['id', 'title', 'slug', 'content'],
        });

        const results = posts.map(post => {
            const similarity = this.calculateSimilarity(content, post.content || '');
            return {
                id: post.id,
                title: post.title,
                slug: post.slug,
                similarity: Math.round(similarity),
            };
        }).filter(r => r.similarity > 30)
            .sort((a, b) => b.similarity - a.similarity);

        return {
            similarity: results.length > 0 ? results[0].similarity : 0,
            duplicatePosts: results.slice(0, 5),
        };
    }

    private calculateSimilarity(s1: string, s2: string): number {
        if (!s1 || !s2) return 0;

        // Basic normalization: strip HTML and lowercase
        const t1 = s1.replace(/<[^>]*>?/gm, '').toLowerCase();
        const t2 = s2.replace(/<[^>]*>?/gm, '').toLowerCase();

        if (t1 === t2) return 100;

        const distance = fastestLevenshtein.distance(t1, t2);
        const maxLength = Math.max(t1.length, t2.length);

        if (maxLength === 0) return 100;
        return ((maxLength - distance) / maxLength) * 100;
    }
}
