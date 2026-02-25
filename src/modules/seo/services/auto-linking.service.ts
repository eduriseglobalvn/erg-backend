import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SeoKeyword } from '../entities/seo-keyword.entity';
import * as cheerio from 'cheerio';
import { Post } from '@/modules/posts/entities/post.entity';

@Injectable()
export class AutoLinkingService {
    constructor(private readonly em: EntityManager) { }

    /**
     * Finds active SEO keywords and wraps them with <a> tags in content.
     * Respects existing <a> tags and link limits.
     */
    async applyAutoLinks(content: string, postId: string): Promise<{
        updatedContent: string;
        linksAdded: number;
        keywords: string[];
    }> {
        // Fetch active keywords
        const keywords = await this.em.find(SeoKeyword, { isActive: true });
        if (!keywords.length) {
            return { updatedContent: content, linksAdded: 0, keywords: [] };
        }

        // Sanitize content: remove empty keywords
        const validKeywords = keywords.filter(kw => kw.keyword.trim().length > 0);
        if (!validKeywords.length) return { updatedContent: content, linksAdded: 0, keywords: [] };

        const $ = cheerio.load(content, { xmlMode: false });
        let linksAdded = 0;
        const linkedKeywords = new Set<string>();

        // Map keyword constraints and sort by length descending
        validKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

        const keywordMap = new Map<string, { url: string; limit: number; count: number }>();
        validKeywords.forEach(kw => {
            keywordMap.set(kw.keyword.toLowerCase(), {
                url: kw.targetUrl,
                limit: kw.linkLimit,
                count: 0
            });
        });

        // Create a single regex for all keywords
        const pattern = validKeywords
            .map(kw => this.escapeRegExp(kw.keyword))
            .join('|');

        // Use word boundary to match whole words only
        const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

        // Traverse all elements to find text nodes
        $('body').find('*').contents().each((index, element) => {
            // Check if node is text node (nodeType 3)
            if (element.nodeType === 3) {
                const parent = $(element).parent();
                const parentTag = parent.prop('tagName')?.toLowerCase();

                // Skip if inside existing link or restricted tags
                if (['a', 'script', 'style', 'code', 'pre', 'textarea'].includes(parentTag || '')) {
                    return;
                }

                const text = $(element).text();

                // Check if text contains any keyword
                if (!regex.test(text)) return;

                // Reset regex lastIndex to ensure correct replacement
                regex.lastIndex = 0;

                // Replace content
                const newText = text.replace(regex, (match) => {
                    const lowerMatch = match.toLowerCase();
                    const config = keywordMap.get(lowerMatch);

                    if (config && config.count < config.limit) {
                        config.count++;
                        linksAdded++;
                        linkedKeywords.add(match);
                        return `<a href="${config.url}" title="${match}" target="_blank" rel="noopener noreferrer" class="auto-link">${match}</a>`;
                    }
                    return match;
                });

                if (newText !== text) {
                    $(element).replaceWith(newText);
                }
            }
        });

        const updatedContent = $('body').html() || '';

        return {
            updatedContent,
            linksAdded,
            keywords: Array.from(linkedKeywords),
        };
    }

    async bulkApplyAutoLinks(postIds?: string[]): Promise<{
        totalProcessed: number;
        totalLinksAdded: number;
        errors: Array<{ postId: string; error: string }>;
    }> {
        const query = postIds && postIds.length > 0 ? { id: { $in: postIds } } : {};
        const posts = await this.em.find(Post, query);

        let totalLinksAdded = 0;
        const errors: Array<{ postId: string; error: string }> = [];

        for (const post of posts) {
            try {
                if (!post.content) continue;

                const result = await this.applyAutoLinks(post.content, post.id);
                if (result.linksAdded > 0) {
                    post.content = result.updatedContent;
                    totalLinksAdded += result.linksAdded;
                }
            } catch (error) {
                errors.push({ postId: post.id, error: error.message });
            }
        }

        if (totalLinksAdded > 0) {
            await this.em.flush();
        }

        return {
            totalProcessed: posts.length,
            totalLinksAdded,
            errors
        };
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
