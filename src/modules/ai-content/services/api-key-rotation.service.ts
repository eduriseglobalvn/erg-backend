import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, CreateRequestContext } from '@mikro-orm/core';
import { ApiKey, ApiKeyStatus, ApiKeyType, AIProviderType } from '../entities/api-key.entity';
import { User } from '@/modules/users/entities/user.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';
import { ApiKeyHealthService } from './api-key-health.service';
import { ApiKeyCryptoService } from './api-key-crypto.service';

@Injectable()
export class ApiKeyRotationService {
    private readonly logger = new Logger(ApiKeyRotationService.name);

    constructor(
        private readonly em: EntityManager,
        private readonly notificationsService: NotificationsService,
        private readonly cryptoService: ApiKeyCryptoService,
    ) { }

    @CreateRequestContext()
    async getAvailableKey(user: User, provider: AIProviderType = AIProviderType.GEMINI): Promise<ApiKey> {
        const now = new Date();

        // 1. Private Keys
        const myKeys = await this.em.find(ApiKey, {
            owner: user,
            type: ApiKeyType.PRIVATE,
            provider,
            status: { $ne: ApiKeyStatus.ERROR },
        } as any, {
            orderBy: [{ priority: 'DESC' }, { todayUsage: 'ASC' }, { lastUsedAt: 'ASC' }]
        });

        for (const key of myKeys) {
            this.checkAndResetDailyUsage(key);
            if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) continue;
            if (key.status === ApiKeyStatus.RATE_LIMITED && key.cooldownUntil && key.cooldownUntil > now) continue;

            if (key.status === ApiKeyStatus.RATE_LIMITED && (!key.cooldownUntil || key.cooldownUntil <= now)) {
                key.status = ApiKeyStatus.ACTIVE;
                this.em.persist(key);
            }

            if (key.todayRpmUsage >= key.rpmLimit) continue;

            key.key = this.cryptoService.decrypt(key.key); // Use crypto service
            await this.em.flush();
            return key;
        }

        // 2. Shared Keys
        const sharedKeys = await this.em.find(ApiKey, {
            type: ApiKeyType.SHARED,
            provider,
            status: { $ne: ApiKeyStatus.ERROR },
        } as any, {
            orderBy: [{ priority: 'DESC' }, { todayUsage: 'ASC' }, { lastUsedAt: 'ASC' }]
        });

        for (const key of sharedKeys) {
            this.checkAndResetDailyUsage(key);
            if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) continue;
            if (key.status === ApiKeyStatus.RATE_LIMITED && key.cooldownUntil && key.cooldownUntil > now) continue;

            if (key.status === ApiKeyStatus.RATE_LIMITED && (!key.cooldownUntil || key.cooldownUntil <= now)) {
                key.status = ApiKeyStatus.ACTIVE;
                this.em.persist(key);
            }

            if (key.todayRpmUsage >= key.rpmLimit) continue;

            key.key = this.cryptoService.decrypt(key.key); // Use crypto service
            await this.em.flush();
            return key;
        }

        try {
            await this.notificationsService.createForAdmins({
                type: NotificationType.KEY_ALL_DOWN,
                title: 'Cảnh báo: Hết API Key khả dụng',
                message: `Hệ thống không còn API Key khả dụng cho provider: ${provider}.`,
                priority: NotificationPriority.CRITICAL,
                metadata: { provider }
            });
        } catch (e) { }

        throw new ServiceUnavailableException(`All available AI API Keys for ${provider} are currently unavailable.`);
    }

    checkAndResetDailyUsage(key: ApiKey) {
        const now = new Date();
        const lastUsed = key.lastUsedAt || new Date(0);
        const lastMinute = key.lastMinuteReset || new Date(0);

        if (now.getTime() - lastMinute.getTime() > 60000) {
            key.todayRpmUsage = 0;
            key.lastMinuteReset = now;
            this.em.persist(key);
        }

        if (now.toDateString() !== lastUsed.toDateString()) {
            key.todayUsage = 0;
            if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) key.status = ApiKeyStatus.ACTIVE;
            this.em.persist(key);
        }

        const limit = key.rpdLimit || key.maxDailyQuota;
        if (key.todayUsage >= limit && key.status !== ApiKeyStatus.QUOTA_EXCEEDED) {
            key.status = ApiKeyStatus.QUOTA_EXCEEDED;
            this.em.persist(key);
        }
    }

    @CreateRequestContext()
    async logUsage(keyId: string) {
        const key = await this.em.findOne(ApiKey, { id: keyId } as any);
        if (key) {
            key.usageCount++;
            key.todayUsage++;
            key.todayRpmUsage++;
            key.lastUsedAt = new Date();
            key.consecutiveErrors = 0;

            if (key.status === ApiKeyStatus.RATE_LIMITED || key.status === ApiKeyStatus.ERROR) {
                key.status = ApiKeyStatus.ACTIVE;
                key.errorType = undefined;
            }
            await this.em.persistAndFlush(key);
        }
    }

    @CreateRequestContext()
    async reportError(keyId: string, error: any) {
        const key = await this.em.findOne(ApiKey, { id: keyId } as any);
        if (!key) return;

        key.lastErrorAt = new Date();
        const errorMsg = error?.message || String(error);
        key.lastErrorMessage = errorMsg;
        key.consecutiveErrors = (key.consecutiveErrors || 0) + 1;

        const classification = ApiKeyHealthService.classifyError(error);
        key.status = classification.status;
        key.errorType = classification.type;

        if (classification.cooldownSeconds) {
            key.cooldownUntil = new Date(Date.now() + classification.cooldownSeconds * 1000);
        }

        if (key.projectId) {
            const updateData: any = {
                status: key.status,
                errorType: key.errorType,
                lastErrorAt: key.lastErrorAt,
                lastErrorMessage: `Project limit hit: ${errorMsg}`,
                consecutiveErrors: key.consecutiveErrors
            };
            if (key.cooldownUntil) updateData.cooldownUntil = key.cooldownUntil;
            await this.em.nativeUpdate(ApiKey, { projectId: key.projectId } as any, updateData);
            this.em.clear();
        }

        await this.em.persistAndFlush(key);

        if (key.status === ApiKeyStatus.QUOTA_EXCEEDED || key.status === ApiKeyStatus.ERROR) {
            this.notifyKeyDead(key).catch(e => this.logger.error('Failed to notify key dead:', e));
        }
    }

    private async notifyKeyDead(key: ApiKey) {
        if (!key.owner) return;
        const isError = key.status === ApiKeyStatus.ERROR;
        const type = isError ? NotificationType.SYSTEM_ALERT : NotificationType.KEY_QUOTA_WARNING;
        const title = isError ? 'API Key bị lỗi hoặc vô hiệu hóa' : 'API Key hết Quota';

        await this.notificationsService.create({
            userId: key.owner.id,
            type,
            title,
            message: `Key "${key.label || 'Không tên'}" của bạn đã báo lỗi: ${key.lastErrorMessage}.`,
            priority: NotificationPriority.HIGH,
            metadata: { keyId: key.id, status: key.status }
        }).catch(e => this.logger.error('Failed to create key dead notification:', e));
    }
}
