import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { SeoKeyword } from '../entities/seo-keyword.entity';
import { CreateKeywordDto } from '../dto/create-keyword.dto';

@Injectable()
export class SeoKeywordService {
    constructor(
        @InjectRepository(SeoKeyword)
        private readonly keywordRepository: EntityRepository<SeoKeyword>,
        private readonly em: EntityManager,
    ) { }

    async findAll(): Promise<SeoKeyword[]> {
        return this.keywordRepository.findAll({ orderBy: { createdAt: 'DESC' } });
    }

    async create(dto: CreateKeywordDto): Promise<SeoKeyword> {
        const keyword = this.keywordRepository.create(dto);
        await this.em.persistAndFlush(keyword);
        return keyword;
    }

    async delete(id: string): Promise<void> {
        const keyword = await this.keywordRepository.findOneOrFail(id);
        await this.em.removeAndFlush(keyword);
    }
}
