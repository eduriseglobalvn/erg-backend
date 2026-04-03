import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IpProtectionService } from '../../modules/operations/ip-protection.service';

@Injectable()
export class AbuseDetectionService {
  private readonly logger = new Logger(AbuseDetectionService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private ipProtectionService: IpProtectionService,
  ) {}

  async trackFailedLogin(ip: string): Promise<boolean> {
    const key = `abuse:login:${ip}`;
    const count = await (this.cache.get<number>(key) || Promise.resolve(0));
    const newCount = (count || 0) + 1;
    
    if (newCount > 5) {
      this.logger.warn(`Brute force login detected from IP: ${ip}`);
      await this.evaluateAndBlock(ip, 'Brute force login');
      return true;
    }
    await this.cache.set(key, newCount, 5 * 60 * 1000); // 5 mins
    return false;
  }

  async track404Hit(ip: string): Promise<boolean> {
    const key = `abuse:404:${ip}`;
    const count = await (this.cache.get<number>(key) || Promise.resolve(0));
    const newCount = (count || 0) + 1;

    if (newCount > 50) { 
      this.logger.warn(`Endpoint scanning detected from IP: ${ip}`);
      await this.evaluateAndBlock(ip, 'Endpoint scanning');
      return true;
    }
    await this.cache.set(key, newCount, 60 * 1000); // 1 min
    return false;
  }

  async trackHighFrequency(ip: string): Promise<boolean> {
    const key = `abuse:freq:${ip}`;
    const count = await (this.cache.get<number>(key) || Promise.resolve(0));
    const newCount = (count || 0) + 1;

    if (newCount > 100) {
      this.logger.warn(`High frequency requests detected from IP: ${ip}`);
      await this.evaluateAndBlock(ip, 'High frequency requests');
      return true;
    }
    await this.cache.set(key, newCount, 10 * 1000); // 10 secs
    return false;
  }

  private async evaluateAndBlock(ip: string, reason: string) {
    await this.ipProtectionService.blockIp(ip, 10 * 60 * 1000); 
    this.logger.log(`IP ${ip} was blocked automatically due to abuse: ${reason}`);
  }
}
