import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Seo404Log } from '../entities/seo-404-log.entity';

@Injectable()
export class MonitoringService {
    constructor(private readonly em: EntityManager) { }

    async get404Logs() {
        return this.em.find(Seo404Log, {}, { orderBy: { hitCount: 'DESC', lastSeen: 'DESC' } });
    }

    async log404(url: string, referer?: string, userAgent?: string) {
        const existing = await this.em.findOne(Seo404Log, { url });
        if (existing) {
            existing.hitCount++;
            existing.lastSeen = new Date();
            if (referer) existing.referer = referer;
            if (userAgent) existing.userAgent = userAgent;
        } else {
            const log = this.em.create(Seo404Log, {
                url,
                referer,
                userAgent,
                hitCount: 1,
            });
            this.em.persist(log);
        }
        await this.em.flush();
    }
}
