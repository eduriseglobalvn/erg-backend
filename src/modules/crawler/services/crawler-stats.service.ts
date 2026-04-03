import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';

@Injectable()
export class CrawlerStatsService {
    constructor(
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepository: EntityRepository<CrawlHistory>,
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
    ) { }

    async getStats() {
        const totalCrawled = await this.historyRepository.count();
        const successCount = await this.historyRepository.count({ status: 'SUCCESS' });
        const failedCount = await this.historyRepository.count({ status: 'FAILED' });

        return {
            totalCrawled,
            successRate: totalCrawled > 0 ? ((successCount / totalCrawled) * 100).toFixed(2) + '%' : '0%',
            successCount,
            failedCount,
        };
    }

    async getPipelineStatus() {
        const activeStatuses = [CrawlStatus.DISCOVERED, CrawlStatus.SCRAPED, CrawlStatus.PROCESSED, CrawlStatus.SEO_OPTIMIZED];

        const inProgressRaw = await this.rawRepo.find({ status: { $in: activeStatuses } }, { limit: 50, orderBy: { updatedAt: 'DESC' } });
        const inProgress = inProgressRaw.map(r => ({ url: r.url, currentStep: r.status, startedAt: r.createdAt }));

        const failedRaw = await this.rawRepo.find({ status: CrawlStatus.FAILED }, { limit: 50, orderBy: { updatedAt: 'DESC' } });
        const failed = failedRaw.map(r => ({ url: r.url, failedStep: r.error?.step || 'UNKNOWN', error: r.error?.message, lastAttemptAt: r.updatedAt }));

        const completedRaw = await this.rawRepo.find({ status: CrawlStatus.PUBLISHED }, { limit: 50, orderBy: { updatedAt: 'DESC' } });
        const completed = completedRaw.map(r => ({ url: r.url, completedAt: r.updatedAt }));

        return { inProgress, failed, completed };
    }

    async getCrawlHistory(page: number = 1, limit: number = 20) {
        const [items, total] = await this.historyRepository.findAndCount({}, {
            limit,
            offset: (page - 1) * limit,
            orderBy: { crawledAt: 'DESC' }
        });
        return { items, total, page, limit };
    }
}
