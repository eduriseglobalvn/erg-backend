import { Injectable, InternalServerErrorException, ForbiddenException, Logger } from '@nestjs/common';
import { CreateRequestContext, EntityManager } from '@mikro-orm/core';
import { ApiKey, ApiKeyStatus, ApiKeyType, AIProviderType } from '../entities/api-key.entity';
import { User } from '@/modules/users/entities/user.entity';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { ApiKeyCryptoService } from './api-key-crypto.service';
import { ApiKeyRotationService } from './api-key-rotation.service';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly aiProviderFactory: AIProviderFactory,
    private readonly cryptoService: ApiKeyCryptoService,
    private readonly rotationService: ApiKeyRotationService,
  ) { }

  // Delegates to RotationService
  async getAvailableKey(user: User, provider: AIProviderType = AIProviderType.GEMINI) {
    return this.rotationService.getAvailableKey(user, provider);
  }

  async logUsage(keyId: string) {
    return this.rotationService.logUsage(keyId);
  }

  async reportError(keyId: string, error: any) {
    return this.rotationService.reportError(keyId, error);
  }

  // Crypto delegation for backward compatibility or direct use if needed
  encrypt(text: string) { return this.cryptoService.encrypt(text); }
  decrypt(text: string) { return this.cryptoService.decrypt(text); }

  // Management logic
  @CreateRequestContext()
  async getMyKeys(user: User) {
    return this.em.find(ApiKey, { owner: user } as any);
  }

  @CreateRequestContext()
  async upsertKey(user: User, keyData: { key: string; label?: string; projectId?: string; type?: ApiKeyType; maxDailyQuota?: number; provider?: AIProviderType }) {
    const provider = keyData.provider || AIProviderType.GEMINI;

    const isValid = await this.validateApiKey(keyData.key, provider);
    if (!isValid) throw new ForbiddenException(`Invalid API Key for provider ${provider}.`);

    let apiKey = await this.em.findOne(ApiKey, { owner: user, key: keyData.key } as any);

    if (apiKey) {
      if (keyData.maxDailyQuota) apiKey.maxDailyQuota = keyData.maxDailyQuota;
      if (keyData.label) apiKey.label = keyData.label;
      if (keyData.projectId) apiKey.projectId = keyData.projectId;
      apiKey.key = this.cryptoService.encrypt(keyData.key);
      apiKey.status = ApiKeyStatus.ACTIVE;
    } else {
      apiKey = this.em.create(ApiKey, {
        key: this.cryptoService.encrypt(keyData.key),
        label: keyData.label,
        projectId: keyData.projectId,
        owner: user,
        type: keyData.type || ApiKeyType.PRIVATE,
        provider: provider,
        maxDailyQuota: keyData.maxDailyQuota || 1500,
        status: ApiKeyStatus.ACTIVE,
      } as any);
    }

    await this.em.persistAndFlush(apiKey);
    return apiKey;
  }

  private async validateApiKey(key: string, provider: AIProviderType): Promise<boolean> {
    try {
      const client = this.aiProviderFactory.createClient(provider, key);
      await client.generateText('Hello', { maxTokens: 1, temperature: 0 });
      return true;
    } catch (error) {
      this.logger.warn(`API Key validation failed for ${provider}: ${error.message}`);
      return false;
    }
  }

  @CreateRequestContext()
  async removeKey(user: User, id: string) {
    const key = await this.em.findOne(ApiKey, { id, owner: user } as any);
    if (key) await this.em.removeAndFlush(key);
  }

  @CreateRequestContext()
  async getDashboard() {
    const keys = await this.em.find(ApiKey, {});
    const dashboard: Record<string, any> = {};
    const alerts: string[] = [];

    for (const key of keys) {
      if (!dashboard[key.provider]) {
        dashboard[key.provider] = {
          provider: key.provider, totalKeys: 0, activeKeys: 0,
          errorKeys: 0, quotaExceededKeys: 0, rateLimitedKeys: 0,
          todayUsage: 0, maxDailyQuota: 0,
        };
      }
      const stats = dashboard[key.provider];
      stats.totalKeys++;
      stats.todayUsage += key.todayUsage;
      stats.maxDailyQuota += key.maxDailyQuota;
      if (key.status === ApiKeyStatus.ACTIVE) stats.activeKeys++;
      else if (key.status === ApiKeyStatus.ERROR) stats.errorKeys++;
      else if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) stats.quotaExceededKeys++;
      else if (key.status === ApiKeyStatus.RATE_LIMITED) stats.rateLimitedKeys++;
    }

    for (const p in dashboard) {
      const stats = dashboard[p];
      if (stats.activeKeys === 0) alerts.push(`CRITICAL: All keys for ${p} are down!`);
      else if (stats.todayUsage > stats.maxDailyQuota * 0.9) alerts.push(`WARNING: ${p} usage > 90%!`);
    }
    return { stats: Object.values(dashboard), alerts };
  }

  @CreateRequestContext()
  async testKey(id: string) {
    const key = await this.em.findOne(ApiKey, { id } as any);
    if (!key) throw new InternalServerErrorException('Key not found');
    const startTime = Date.now();
    try {
      const decryptedKey = this.cryptoService.decrypt(key.key);
      const client = this.aiProviderFactory.createClient(key.provider, decryptedKey);
      await client.generateText('Hello', { maxTokens: 1, temperature: 0 });
      return { success: true, latencyMs: Date.now() - startTime };
    } catch (error) {
      await this.rotationService.reportError(id, error);
      return { success: false, error: error.message, latencyMs: Date.now() - startTime };
    }
  }

  @CreateRequestContext()
  async reactivateKey(id: string) {
    const result = await this.testKey(id);
    if (result.success) {
      const key = await this.em.findOne(ApiKey, { id } as any);
      if (key) {
        key.status = ApiKeyStatus.ACTIVE;
        key.errorType = undefined;
        key.consecutiveErrors = 0;
        await this.em.persistAndFlush(key);
      }
    }
    return result;
  }
}