import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SeoRedirect } from '../entities/seo-redirect.entity';

@Injectable()
export class RedirectService {
    constructor(private readonly em: EntityManager) { }

    async findAll() {
        return this.em.find(SeoRedirect, {}, { orderBy: { createdAt: 'DESC' } });
    }

    async findMatch(url: string): Promise<SeoRedirect | null> {
        // 1. Try exact match first (Fast)
        const exactMatch = await this.em.findOne(SeoRedirect, {
            fromPattern: url,
            isActive: true,
            isRegex: false
        });
        if (exactMatch) return exactMatch;

        // 2. Try regex match (Slower, need scan)
        // Cache this results if performance becomes issue
        const regexRedirects = await this.em.find(SeoRedirect, {
            isActive: true,
            isRegex: true
        });

        for (const redirect of regexRedirects) {
            try {
                if (new RegExp(redirect.fromPattern).test(url)) {
                    return redirect;
                }
            } catch (e) {
                // Ignore invalid regex
            }
        }

        return null;
    }

    async create(data: { fromPattern: string; toUrl: string; type?: string; isActive?: boolean }) {
        const redirect = this.em.create(SeoRedirect, data);
        await this.em.persistAndFlush(redirect);
        return redirect;
    }

    async update(id: string, data: Partial<{ fromPattern: string; toUrl: string; type: string; isActive: boolean }>) {
        const redirect = await this.em.findOneOrFail(SeoRedirect, id);
        Object.assign(redirect, data);
        await this.em.flush();
        return redirect;
    }

    async delete(id: string) {
        const redirect = await this.em.findOneOrFail(SeoRedirect, id);
        await this.em.removeAndFlush(redirect);
        return { success: true };
    }
}
