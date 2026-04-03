import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AIProviderType } from '../entities/api-key.entity';

export interface ProviderHealthReport {
    providers: {
        name: string;
        status: 'healthy' | 'degraded' | 'down';
        avgLatencyMs: number;
        successRate: number;
        lastError?: string;
        lastErrorAt?: Date;
    }[];
    fallbackOrder: AIProviderType[];
    recommendation: string;
}

@Injectable()
export class ProviderHealthService {
    private readonly logger = new Logger(ProviderHealthService.name);

    // Default fallback chain
    private readonly defaultFallback: AIProviderType[] = [
        AIProviderType.GROQ,
        AIProviderType.CEREBRAS,
        AIProviderType.SAMBANOVA,
        AIProviderType.GEMINI,
        AIProviderType.DEEPSEEK,
        AIProviderType.MISTRAL,
        AIProviderType.TOGETHER,
        AIProviderType.COHERE,
        AIProviderType.CLAUDE,
        AIProviderType.OPENAI,
        AIProviderType.OPENROUTER,
        AIProviderType.HYPERBOLIC
    ];

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async recordSuccess(provider: AIProviderType, latencyMs: number): Promise<void> {
        await this.recordMetric(provider, 'success', latencyMs);
    }

    async recordFailure(provider: AIProviderType, error: string): Promise<void> {
        await this.recordMetric(provider, 'failure', 0, error);

        // Cập nhật last error
        await this.cacheManager.set(`ai_health_${provider}_last_error`, {
            message: error,
            timestamp: new Date()
        }, 86400 * 1000); // Lưu 24h
    }

    private async recordMetric(provider: AIProviderType, type: 'success' | 'failure', latencyMs: number = 0, error?: string): Promise<void> {
        const hourKey = `ai_health_${provider}_${new Date().getHours()}`;
        const data = await this.cacheManager.get<{ success: number, failure: number, totalLatency: number }>(hourKey) || { success: 0, failure: 0, totalLatency: 0 };

        if (type === 'success') {
            data.success++;
            data.totalLatency += latencyMs;
        } else {
            data.failure++;
        }

        await this.cacheManager.set(hourKey, data, 3600 * 1000); // Expires in 1 hour
    }

    async getOptimalFallbackOrder(): Promise<AIProviderType[]> {
        const healthStats = await Promise.all(this.defaultFallback.map(async (provider) => {
            const hourKey = `ai_health_${provider}_${new Date().getHours()}`;
            const data = await this.cacheManager.get<{ success: number, failure: number, totalLatency: number }>(hourKey);

            if (!data || (data.success + data.failure) === 0) {
                // Not enough data => default priority 
                return { provider, score: 50 };
            }

            const total = data.success + data.failure;
            const successRate = (data.success / total) * 100;
            const avgLatency = data.success > 0 ? (data.totalLatency / data.success) : 10000;

            // Score formula: Higher success rate is better, lower latency is better
            // If success rate < 50%, penalize heavily
            let score = successRate;
            if (successRate < 50) score -= 50;

            // Latency bonus: If under 1500ms, add some score
            if (avgLatency < 1500) score += 10;
            else if (avgLatency > 5000) score -= 10;

            return { provider, score };
        }));

        // Sort by score descending (highest score first)
        healthStats.sort((a, b) => b.score - a.score);

        return healthStats.map(stat => stat.provider);
    }

    async getHealthStatus(): Promise<ProviderHealthReport> {
        const fallbackOrder = await this.getOptimalFallbackOrder();
        const providers: Array<{
            name: AIProviderType;
            status: 'healthy' | 'degraded' | 'down';
            successRate: number;
            avgLatencyMs: number;
            lastError?: string;
            lastErrorAt?: Date;
        }> = [];

        for (const provider of this.defaultFallback) {
            const hourKey = `ai_health_${provider}_${new Date().getHours()}`;
            const data = await this.cacheManager.get<{ success: number, failure: number, totalLatency: number }>(hourKey);
            const lastError = await this.cacheManager.get<{ message: string, timestamp: Date }>(`ai_health_${provider}_last_error`);

            let status: 'healthy' | 'degraded' | 'down' = 'healthy';
            let successRate = 100;
            let avgLatencyMs = 0;

            if (data && (data.success + data.failure) > 0) {
                const total = data.success + data.failure;
                successRate = (data.success / total) * 100;
                avgLatencyMs = data.success > 0 ? (data.totalLatency / data.success) : 0;

                if (successRate < 50) status = 'down';
                else if (successRate < 90) status = 'degraded';
            }

            providers.push({
                name: provider,
                status,
                successRate: Math.round(successRate * 100) / 100,
                avgLatencyMs: Math.round(avgLatencyMs),
                lastError: lastError?.message,
                lastErrorAt: lastError?.timestamp ? new Date(lastError.timestamp) : undefined,
            });
        }

        return {
            providers,
            fallbackOrder,
            recommendation: `Optimal provider recommended is ${fallbackOrder[0]} based on recent latency and success rates.`,
        };
    }
}
