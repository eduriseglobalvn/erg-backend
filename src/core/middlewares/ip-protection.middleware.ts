import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AbuseDetectionService } from '../../modules/operations/abuse-detection.service';

@Injectable()
export class IpProtectionMiddleware implements NestMiddleware {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly abuseDetection: AbuseDetectionService,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ipString = Array.isArray(ip) ? ip[0] : ip;

    // 1. Check blacklist (manual block)
    const isBlocked = await this.cache.get(`ip_blocked:${ipString}`);
    if (isBlocked) {
      return res.status(403).json({ message: 'ACCESS_DENIED' });
    }

    // High frequency abuse check (Pattern 3: >100 req/10s)
    const isAbusing = await this.abuseDetection.trackHighFrequency(ipString);
    if (isAbusing) {
      return res.status(429).json({ message: 'TOO_MANY_REQUESTS_ABUSE' });
    }

    // 2. Track request count per IP (sliding window)
    const key = `ip_requests:${ipString}`;
    const count = await this.cache.get<number>(key) || 0;

    if (count > 500) { // 500 req/min per IP
      // Auto-block for 10 minutes
      await this.cache.set(`ip_blocked:${ipString}`, true, 600 * 1000);
      return res.status(429).json({ message: 'TOO_MANY_REQUESTS' });
    }

    await this.cache.set(key, count + 1, 60 * 1000); // 60s window
    next();
  }
}
