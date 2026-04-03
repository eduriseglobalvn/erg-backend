import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { SystemConfig } from './entities/system-config.entity';

@Injectable()
export class SystemConfigService {
    private readonly logger = new Logger(SystemConfigService.name);

    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepository: EntityRepository<SystemConfig>,
        private readonly em: EntityManager,
    ) { }

    async get(key: string, defaultValue: any = null): Promise<any> {
        const config = await this.configRepository.findOne({ key });
        return config ? config.value : defaultValue;
    }

    async set(key: string, value: any, userId?: string, description?: string): Promise<SystemConfig> {
        let config = await this.configRepository.findOne({ key });

        if (config) {
            config.value = value;
            if (description) config.description = description;
            config.updatedBy = userId;
        } else {
            config = this.configRepository.create({
                key,
                value,
                description,
                updatedBy: userId,
            });
            this.em.persist(config);
        }

        await this.em.flush();
        return config;
    }

    async getAll(): Promise<SystemConfig[]> {
        return this.configRepository.findAll();
    }

    async delete(key: string): Promise<void> {
        const config = await this.configRepository.findOne({ key });
        if (config) {
            await this.em.removeAndFlush(config);
        }
    }

    async seedDefaults(): Promise<void> {
        const defaults = [
            { key: 'api.maintenance_mode', value: false, description: 'Bật/tắt chế độ bảo trì toàn hệ thống' },
            { key: 'ai.post_generation_limit', value: 50, description: 'Giới hạn số bài viết AI tạo mỗi giờ' },
            { key: 'ai.image_generation_limit', value: 20, description: 'Giới hạn số ảnh AI tạo mỗi giờ' },
            { key: 'crawler.concurrency', value: 3, description: 'Số lượng link cào đồng thời tối đa' },
            { key: 'seo.auto_linking_enabled', value: true, description: 'Tự động gắn link từ kho từ khóa vào nội dung' },
        ];

        for (const item of defaults) {
            const exists = await this.configRepository.findOne({ key: item.key });
            if (!exists) {
                const config = this.configRepository.create(item);
                this.em.persist(config);
                this.logger.log(`Seeded default config: ${item.key}`);
            }
        }

        await this.em.flush();
    }
}

