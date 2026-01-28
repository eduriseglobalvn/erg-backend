import { Injectable } from '@nestjs/common';
import { CreateRequestContext, EntityManager, MikroORM } from '@mikro-orm/core';
import { ApiKey, ApiKeyStatus, ApiKeyType } from '../entities/api-key.entity';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly em: EntityManager,
    private readonly orm: MikroORM,
  ) { }

  @CreateRequestContext()
  async getAvailableKey(user: User): Promise<ApiKey> {
    const now = new Date();

    // 1. Tìm TẤT CẢ Key của User này
    const myKeys = await this.em.find(ApiKey, {
      owner: user,
      type: ApiKeyType.PRIVATE,
      status: { $ne: ApiKeyStatus.ERROR }, // Không lấy key hỏng hoàn toàn
    } as any, { orderBy: { todayUsage: 'ASC' } });

    for (const key of myKeys) {
      await this.checkAndResetDailyUsage(key);

      // Bỏ qua nếu Key đang trong thời gian Cooldown (RPM) hoặc hết Quota (RPD)
      if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) continue;
      if (key.status === ApiKeyStatus.RATE_LIMITED && key.cooldownUntil && key.cooldownUntil > now) continue;

      // Nếu trạng thái là RATE_LIMITED nhưng đã hết thời gian cooldown thì tự động ACTIVE lại
      if (key.status === ApiKeyStatus.RATE_LIMITED && (!key.cooldownUntil || key.cooldownUntil <= now)) {
        key.status = ApiKeyStatus.ACTIVE;
        await this.em.persistAndFlush(key);
      }

      return key;
    }

    // 2. Nếu hết Key Private, tìm TẤT CẢ Key Shared
    const sharedKeys = await this.em.find(ApiKey, {
      type: ApiKeyType.SHARED,
      status: { $ne: ApiKeyStatus.ERROR },
    } as any, { orderBy: { todayUsage: 'ASC' } });

    for (const key of sharedKeys) {
      await this.checkAndResetDailyUsage(key);
      if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) continue;
      if (key.status === ApiKeyStatus.RATE_LIMITED && key.cooldownUntil && key.cooldownUntil > now) continue;

      return key;
    }

    throw new Error('All available AI API Keys are currently unavailable (Rate Limited or Quota Exceeded). Please add keys from DIFFERENT Google Cloud Projects to increase limits.');
  }

  async checkAndResetDailyUsage(key: ApiKey) {
    const now = new Date();
    const lastUsed = key.lastUsedAt || new Date(0);

    // Nếu qua ngày mới thì reset todayUsage
    if (now.toDateString() !== lastUsed.toDateString()) {
      key.todayUsage = 0;
      if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) {
        key.status = ApiKeyStatus.ACTIVE;
      }
      await this.em.persistAndFlush(key);
    }

    if (key.todayUsage >= key.maxDailyQuota) {
      key.status = ApiKeyStatus.QUOTA_EXCEEDED;
      await this.em.persistAndFlush(key);
      throw new Error('Quota exceeded');
    }
  }

  @CreateRequestContext()
  async logUsage(keyId: string) {
    const key = await this.em.findOne(ApiKey, { id: keyId } as any);
    if (key) {
      key.usageCount++;
      key.todayUsage++;
      key.lastUsedAt = new Date();
      // Nếu dùng thành công thì reset status về Active (đề phòng trước đó bị Rate Limit)
      if (key.status === ApiKeyStatus.RATE_LIMITED) {
        key.status = ApiKeyStatus.ACTIVE;
      }
      await this.em.persistAndFlush(key);
    }
  }

  @CreateRequestContext()
  async reportError(keyString: string, error: any) {
    const key = await this.em.findOne(ApiKey, { key: keyString } as any);
    if (!key) return;

    key.lastErrorAt = new Date();
    const errorMsg = error?.message || String(error);
    key.lastErrorMessage = errorMsg;

    // Phân loại lỗi
    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('RPM')) {
      // Lỗi Rate Limit (Theo phút/giây) - khóa 1 phút
      key.status = ApiKeyStatus.RATE_LIMITED;
      key.cooldownUntil = new Date(Date.now() + 60 * 1000);
    } else if (errorMsg.includes('Quota') || errorMsg.includes('RPD') || errorMsg.includes('403')) {
      // Lỗi Hết Quota (Theo ngày) - khóa đến hết ngày
      key.status = ApiKeyStatus.QUOTA_EXCEEDED;
    } else {
      // Các lỗi khác (Invalid Key, v.v.)
      key.status = ApiKeyStatus.ERROR;
    }

    // [QUAN TRỌNG] Nếu có ProjectId, cập nhật trạng thái cho TẤT CẢ các Key cùng Project
    if (key.projectId) {
      const allKeysInProject = await this.em.find(ApiKey, { projectId: key.projectId } as any);
      for (const pKey of allKeysInProject) {
        pKey.status = key.status;
        if (key.cooldownUntil) pKey.cooldownUntil = key.cooldownUntil;
        pKey.lastErrorAt = key.lastErrorAt;
        pKey.lastErrorMessage = `Project limit hit: ${errorMsg}`;
      }
    }

    await this.em.persistAndFlush(key);
  }

  // --- QUẢN LÝ KEY ---

  @CreateRequestContext()
  async getMyKeys(user: User) {
    return this.em.find(ApiKey, { owner: user } as any);
  }

  @CreateRequestContext()
  async upsertKey(user: User, keyData: { key: string; label?: string; projectId?: string; type?: ApiKeyType; maxDailyQuota?: number }) {
    // Kiểm tra xem Key này đã tồn tại của User này chưa
    let apiKey = await this.em.findOne(ApiKey, { owner: user, key: keyData.key } as any);

    if (apiKey) {
      if (keyData.maxDailyQuota) apiKey.maxDailyQuota = keyData.maxDailyQuota;
      if (keyData.label) apiKey.label = keyData.label;
      if (keyData.projectId) apiKey.projectId = keyData.projectId;
      apiKey.status = ApiKeyStatus.ACTIVE; // Reset status khi cập nhật
    } else {
      apiKey = this.em.create(ApiKey, {
        key: keyData.key,
        label: keyData.label,
        projectId: keyData.projectId,
        owner: user,
        type: keyData.type || ApiKeyType.PRIVATE,
        maxDailyQuota: keyData.maxDailyQuota || 1500,
        status: ApiKeyStatus.ACTIVE,
      } as any);
    }

    await this.em.persistAndFlush(apiKey);
    return apiKey;
  }

  @CreateRequestContext()
  async removeKey(user: User, id: string) {
    const key = await this.em.findOne(ApiKey, { id, owner: user } as any);
    if (key) {
      await this.em.removeAndFlush(key);
    }
  }
}