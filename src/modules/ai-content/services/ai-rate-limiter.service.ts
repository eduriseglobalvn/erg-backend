import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface RateLimitStatus {
    allowed: boolean;
    retryAfterMs?: number;
}

@Injectable()
export class AiRateLimiterService {
    private readonly logger = new Logger(AiRateLimiterService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    /**
     * Checks if an AI operation is allowed based on the queue name / context.
     * Implements a simple sliding window or token bucket using cache.
     * @param contextIdentifier E.g. 'seo_ai'
     * @param maxRequests Maximum requests allowed
     * @param windowMs Time window in milliseconds
     */
    async checkLimit(contextIdentifier: string, maxRequests: number, windowMs: number): Promise<RateLimitStatus> {
        const key = `ai_rate_limit:${contextIdentifier}`;

        // This is a simplified counter-based rate limit for Redis
        // For production Token Bucket, a Lua script would be more robust.
        let countStr = await this.cacheManager.get<string>(key);
        let count = countStr ? parseInt(countStr, 10) : 0;

        if (count >= maxRequests) {
            this.logger.warn(`AI Rate Limit exceeded for [${contextIdentifier}]. Max: ${maxRequests}/${windowMs}ms`);
            return { allowed: false, retryAfterMs: windowMs }; // Simplification: wait full window
        }

        count++;
        // If it's the first request, set the TTL to the window duration
        if (count === 1) {
            await this.cacheManager.set(key, count.toString(), windowMs);
        } else {
            // Nest Cache manager doesn't naturally support 'keep-ttl' increment without losing TTL in standard configurations.
            // Using a simple set here resets TTL, which acts as a sliding window extension.
            // In a real Redis client, we'd use INCR and EXPIRE.
            await this.cacheManager.set(key, count.toString(), windowMs);
        }

        return { allowed: true };
    }

    /**
     * Resets the limit for a specific context
     */
    async resetLimit(contextIdentifier: string): Promise<void> {
        const key = `ai_rate_limit:${contextIdentifier}`;
        await this.cacheManager.del(key);
    }
}
