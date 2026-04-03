import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class IpProtectionService implements OnModuleDestroy {
  private redisClient: Redis;

  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private configService: ConfigService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = Number(this.configService.get<string>('REDIS_PORT')) || 6379;
    const password = this.configService.get<string>('REDIS_PASS');
    const isTls = this.configService.get<string>('REDIS_TLS') === 'true';

    this.redisClient = new Redis({
      host,
      port,
      password,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async blockIp(ip: string, ttlMs?: number) {
    if (ttlMs) {
      await this.cache.set(`ip_blocked:${ip}`, true, ttlMs);
    } else {
      await this.cache.set(`ip_blocked:${ip}`, true, 31536000000); // 1 year manual
    }
    return { success: true, ip, status: 'blocked' };
  }

  async unblockIp(ip: string) {
    await this.cache.del(`ip_blocked:${ip}`);
    await this.cache.del(`ip_requests:${ip}`); // Reset counter just in case
    return { success: true, ip, status: 'unblocked' };
  }

  async isBlocked(ip: string): Promise<boolean> {
    const isBlocked = await this.cache.get(`ip_blocked:${ip}`);
    return !!isBlocked;
  }

  async getBlockedIps() {
    // pattern match ip_blocked:*
    const keys = await this.redisClient.keys('ip_blocked:*');
    const records: any[] = [];
    for (const key of keys) {
      const ttl = await this.redisClient.pttl(key);
      const ip = key.replace('ip_blocked:', '');
      records.push({
        ip,
        ttlRemainingMs: ttl > 0 ? ttl : 'permanent',
      });
    }
    return records;
  }

  async getRequestStats() {
    // pattern match ip_requests:*
    const keys = await this.redisClient.keys('ip_requests:*');
    const records: any[] = [];
    for (const key of keys) {
      const count = await this.redisClient.get(key);
      const ip = key.replace('ip_requests:', '');
      records.push({
        ip,
        count: Number(count),
      });
    }
    return records;
  }
}
