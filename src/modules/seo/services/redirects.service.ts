import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Redirect } from '../entities/redirect.entity';

@Injectable()
export class RedirectsService {
    constructor(
        @InjectRepository(Redirect)
        private readonly redirectRepo: EntityRepository<Redirect>,
    ) { }

    async findAll(page = 1, limit = 10) {
        const [items, total] = await this.redirectRepo.findAndCount({}, {
            limit,
            offset: (page - 1) * limit,
        });
        return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    async create(data: { fromPath: string; toPath: string; statusCode?: number }) {
        const redirect = this.redirectRepo.create({
            ...data,
            statusCode: data.statusCode || 301,
        });
        await this.redirectRepo.getEntityManager().persistAndFlush(redirect);
        return redirect;
    }

    async findByFromPath(path: string) {
        return this.redirectRepo.findOne({ fromPath: path });
    }

    async delete(id: string) {
        const redirect = await this.redirectRepo.findOne({ id });
        if (!redirect) throw new NotFoundException('Redirect not found');
        await this.redirectRepo.getEntityManager().removeAndFlush(redirect);
    }
}
