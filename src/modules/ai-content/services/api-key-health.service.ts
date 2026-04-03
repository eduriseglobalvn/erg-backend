import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EntityManager, CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { ApiKey, ApiKeyStatus, ApiKeyErrorType } from '../entities/api-key.entity';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { ApiKeyCryptoService } from './api-key-crypto.service';

@Injectable()
export class ApiKeyHealthService {
    private readonly logger = new Logger(ApiKeyHealthService.name);

    static classifyError(error: any): { status: ApiKeyStatus; type: ApiKeyErrorType; cooldownSeconds?: number } {
        const errorMsgLower = error?.message?.toLowerCase() || String(error).toLowerCase();

        if (errorMsgLower.includes('401') || errorMsgLower.includes('unauthorized') || errorMsgLower.includes('invalid api key')) {
            return { status: ApiKeyStatus.ERROR, type: ApiKeyErrorType.INVALID_KEY };
        }
        if (errorMsgLower.includes('403') || errorMsgLower.includes('forbidden')) {
            return { status: ApiKeyStatus.ERROR, type: ApiKeyErrorType.FORBIDDEN };
        }
        if (errorMsgLower.includes('429') || errorMsgLower.includes('too many requests') || errorMsgLower.includes('rpm')) {
            return { status: ApiKeyStatus.RATE_LIMITED, type: ApiKeyErrorType.RATE_LIMITED, cooldownSeconds: 60 };
        }
        if (errorMsgLower.includes('quota') || errorMsgLower.includes('rpd') || errorMsgLower.includes('insufficient_quota')) {
            return { status: ApiKeyStatus.QUOTA_EXCEEDED, type: ApiKeyErrorType.QUOTA_EXCEEDED };
        }
        if (errorMsgLower.includes('500') || errorMsgLower.includes('502') || errorMsgLower.includes('503') || errorMsgLower.includes('504')) {
            return { status: ApiKeyStatus.ERROR, type: ApiKeyErrorType.SERVER_ERROR, cooldownSeconds: 300 };
        }
        if (errorMsgLower.includes('timeout') || errorMsgLower.includes('econnrefused') || errorMsgLower.includes('network')) {
            return { status: ApiKeyStatus.ERROR, type: ApiKeyErrorType.NETWORK_ERROR, cooldownSeconds: 120 };
        }

        return { status: ApiKeyStatus.ERROR, type: ApiKeyErrorType.SERVER_ERROR };
    }

    constructor(
        private readonly em: EntityManager,
        private readonly orm: MikroORM,
        private readonly aiProviderFactory: AIProviderFactory,
        private readonly cryptoService: ApiKeyCryptoService,
    ) { }

    @Cron('0 */6 * * *')
    @CreateRequestContext()
    async healthCheckAllKeys() {
        this.logger.log('Running health check on ERROR/RATE_LIMITED API Keys...');

        const keys = await this.em.find(ApiKey, {
            status: { $in: [ApiKeyStatus.ERROR, ApiKeyStatus.RATE_LIMITED] }
        });

        let recoveredCount = 0;

        for (const key of keys) {
            try {
                const decryptedKey = this.cryptoService.decrypt(key.key);
                const client = this.aiProviderFactory.createClient(key.provider, decryptedKey);

                // Test light call
                await client.generateText('Hello', { maxTokens: 1, temperature: 0 } as any);

                // If success, recover the key
                key.status = ApiKeyStatus.ACTIVE;
                key.errorType = undefined;
                key.consecutiveErrors = 0;
                await this.em.persistAndFlush(key);
                recoveredCount++;
                this.logger.log(`Key ${key.id} (Provider: ${key.provider}) has been recovered by health check.`);
            } catch (error) {
                this.logger.warn(`Key ${key.id} still failing: ${error.message}`);
            }
        }

        if (recoveredCount > 0) {
            this.logger.log(`Health check completed. Recovered ${recoveredCount} keys.`);
        }
    }

    @Cron('1 0 * * *') // 00:01 daily
    @CreateRequestContext()
    async dailyReset() {
        this.logger.log('Running daily reset for API Keys...');

        await this.em.nativeUpdate(ApiKey, {
            $or: [
                { status: ApiKeyStatus.QUOTA_EXCEEDED },
                { todayUsage: { $gt: 0 } },
                { todayRpmUsage: { $gt: 0 } }
            ]
        } as any, {
            todayUsage: 0,
            todayRpmUsage: 0,
            status: ApiKeyStatus.ACTIVE,
            errorType: undefined
        });

        this.logger.log(`Daily reset completed.`);
    }
}
