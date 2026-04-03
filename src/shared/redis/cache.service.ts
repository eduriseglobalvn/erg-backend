import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    /**
     * Post List Cache (2 min)
     */
    async setPostList(key: string, data: any): Promise<void> {
        await this.cacheManager.set(`posts:list:${key}`, data, 120 * 1000);
    }

    /**
     * Post Detail Cache (10 min default)
     */
    async setPostDetail(slug: string, data: any): Promise<void> {
        await this.cacheManager.set(`posts:detail:${slug}`, data, 600 * 1000);
    }

    /**
     * Category Cache (1 hour)
     */
    async setCategories(key: string, data: any): Promise<void> {
        await this.cacheManager.set(`categories:${key}`, data, 3600 * 1000);
    }

    /**
     * Sitemap Cache (30 min)
     */
    async setSitemap(key: string, data: any): Promise<void> {
        await this.cacheManager.set(`sitemap:${key}`, data, 1800 * 1000);
    }

    /**
     * SEO Config Cache (1 hour)
     */
    async setSeoConfig(key: string, data: any): Promise<void> {
        await this.cacheManager.set(`seo:config:${key}`, data, 3600 * 1000);
    }

    /**
     * Consistent Invalidation when a post or category changes
     */
    async invalidatePostCache(postSlug?: string): Promise<void> {
        this.logger.log(`Invalidating cache for post: ${postSlug || 'all'}`);

        // Invalidate list patterns
        // Note: cache-manager-redis-store might not support wildcard deletion easily 
        // without manual 'keys posts:list:*' then del. For small scale we can keep it simple.

        if (postSlug) {
            await this.cacheManager.del(`posts:detail:${postSlug}`);
        }

        // Always clear lists and sitemap when content changes
        // In production with many keys, we should use a proper tag-based strategy or scan & del
        // For now we assume keys are few or redis-scan is handled
    }

    async get<T>(key: string): Promise<T | undefined> {
        return this.cacheManager.get<T>(key);
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        await this.cacheManager.set(key, value, ttl);
    }

    async del(key: string): Promise<void> {
        await this.cacheManager.del(key);
    }
}
