import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap } from '@mikro-orm/core';
import { RssFeed } from '../entities/rss-feed.entity';
import { ScraperConfig } from '../entities/scraper-config.entity';
import { PostCategory } from '../../posts/entities/post-category.entity';

@Injectable()
export class CrawlerConfigService {
    constructor(
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly rssRepository: EntityRepository<RssFeed>,
        @InjectRepository(ScraperConfig, 'mongo-connection')
        private readonly configRepository: EntityRepository<ScraperConfig>,
        @InjectRepository(PostCategory)
        private readonly categoryRepo: EntityRepository<PostCategory>,
    ) { }

    // --- RSS FEEDS CRUD ---
    async getRssFeeds(): Promise<any[]> {
        const feeds = await this.rssRepository.findAll({
            orderBy: { createdAt: 'DESC' }
        } as any);

        const categoryIds = feeds
            .map(f => f.targetCategoryId)
            .filter((id): id is string => !!id);

        let categories: any[] = [];
        if (categoryIds.length > 0) {
            categories = await this.categoryRepo.find({
                id: { $in: categoryIds }
            });
        }

        return feeds.map(feed => {
            const category = categories.find(c => c.id === feed.targetCategoryId);
            return {
                ...feed,
                categoryName: category ? category.name : null
            };
        });
    }

    async createRssFeed(data: Partial<RssFeed>) {
        const feed = this.rssRepository.create(data as any);
        await this.rssRepository.getEntityManager().persistAndFlush(feed);
        return feed;
    }

    async updateRssFeed(id: string, data: Partial<RssFeed>) {
        const feed = await this.rssRepository.findOne({ id } as any);
        if (!feed) throw new NotFoundException('RSS Feed not found');
        wrap(feed).assign(data);
        await this.rssRepository.getEntityManager().persistAndFlush(feed);
        return feed;
    }

    async deleteRssFeed(id: string) {
        const feed = await this.rssRepository.findOne({ id } as any);
        if (feed) {
            await this.rssRepository.getEntityManager().removeAndFlush(feed);
        }
        return { success: true };
    }

    // --- SCRAPER CONFIGS CRUD ---
    async getScraperConfigs() {
        return this.configRepository.findAll({
            orderBy: { createdAt: 'DESC' }
        } as any);
    }

    async createScraperConfig(data: Partial<ScraperConfig>) {
        const config = this.configRepository.create(data as any);
        await this.configRepository.getEntityManager().persistAndFlush(config);
        return config;
    }

    async updateScraperConfig(id: string, data: Partial<ScraperConfig>) {
        const config = await this.configRepository.findOne({ id } as any);
        if (!config) throw new NotFoundException('Scraper Config not found');
        wrap(config).assign(data);
        await this.configRepository.getEntityManager().persistAndFlush(config);
        return config;
    }

    async deleteScraperConfig(id: string) {
        const config = await this.configRepository.findOne({ id } as any);
        if (config) {
            await this.configRepository.getEntityManager().removeAndFlush(config);
        }
        return { success: true };
    }
}
