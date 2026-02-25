import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Page } from './entities/page.entity';
import { ReviewsService } from '@/modules/reviews/reviews.service';

@Injectable()
export class PagesService {
    constructor(
        @InjectRepository(Page)
        private readonly pageRepository: EntityRepository<Page>,
        private readonly reviewsService: ReviewsService,
    ) { }

    async findOne(filter: { slug: string; domain?: string }): Promise<Page | null> {
        const { slug, domain } = filter;

        if (domain) {
            // Find page specific to domain OR fallback to no domain (shared)
            const candidates = await this.pageRepository.find({
                slug,
                $or: [{ domain }, { domain: null }]
            });

            if (candidates.length === 0) return null;

            // Prefer domain match over null (Global fallback)
            const exactMatch = candidates.find(p => p.domain === domain);
            return exactMatch || candidates.find(p => !p.domain) || null;
        } else {
            // No domain provided -> Find page with no domain restriction
            // No domain provided -> Find page with no domain restriction
            const page = await this.pageRepository.findOne({ slug, domain: null });
            if (page) {
                // [NEW] Append Rating
                try {
                    const rating = await this.reviewsService.getStats(page.id);
                    (page as any).rating = rating;
                } catch (e) {
                    // Ignore error
                }

                // [NEW] Hreflang Alternates
                (page as any).alternates = {
                    vi: `https://erg.edu.vn/${page.slug}`,
                    en: `https://en.erg.edu.vn/${page.slug}`
                };
            }
            return page;
        }
    }
}
