import { Injectable } from '@nestjs/common';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { SeoConfig } from '../entities/seo-config.entity';

@Injectable()
export class SeoConfigService {
    constructor(
        @InjectRepository(SeoConfig)
        private readonly configRepository: EntityRepository<SeoConfig>,
        private readonly em: EntityManager,
    ) { }

    async getConfig(key: string) {
        const config = await this.configRepository.findOne({ key });
        return config ? config.value : null;
    }

    async setConfig(key: string, value: any, userId?: string) {
        let config = await this.configRepository.findOne({ key });
        if (!config) {
            config = new SeoConfig();
            config.key = key;
        }
        config.value = value;
        config.updatedAt = new Date();
        if (userId) config.updatedBy = userId;

        await this.em.persistAndFlush(config);
        return config;
    }

    async getAllConfigs() {
        return this.configRepository.findAll();
    }
}
