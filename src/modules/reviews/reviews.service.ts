import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Review, ReviewStatus, ReviewTargetType } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class ReviewsService {
    constructor(
        @InjectRepository(Review)
        private readonly reviewRepository: EntityRepository<Review>,
        private readonly em: EntityManager,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) { }

    async create(dto: CreateReviewDto, user?: User, ipAddress?: string, userAgent?: string) {
        // F6.2: Review rate limiting (max 5/hour per IP)
        if (ipAddress) {
            const cacheKey = `review_rate_limit:${ipAddress}`;
            const currentCount = await this.cacheManager.get<number>(cacheKey) || 0;
            if (currentCount >= 5) {
                throw new BadRequestException('Bạn đã đạt giới hạn đánh giá (5 lần/giờ). Vui lòng thử lại sau.');
            }
            await this.cacheManager.set(cacheKey, currentCount + 1, 60 * 60 * 1000); // 1 hour
        }

        if (user) {
            // F6.1: Review duplicate check — add targetType
            const existing = await this.reviewRepository.findOne({
                user,
                targetId: dto.targetId,
                targetType: dto.targetType || ReviewTargetType.POST
            });
            if (existing) {
                throw new BadRequestException('You have already reviewed this item.');
            }
        }

        const review = new Review();
        review.targetId = dto.targetId;
        review.targetType = dto.targetType || ReviewTargetType.POST;
        review.rating = dto.rating;
        review.comment = dto.comment;
        review.user = user;
        review.userName = dto.userName || user?.fullName || 'Anonymous';
        review.status = ReviewStatus.PENDING; // Needs moderation
        review.ipAddress = ipAddress;
        review.userAgent = userAgent;

        await this.em.persistAndFlush(review);
        return review;
    }

    async findAll(targetId: string, page = 1, limit = 10) {
        const [items, total] = await this.reviewRepository.findAndCount(
            { targetId, status: ReviewStatus.APPROVED },
            {
                limit,
                offset: (page - 1) * limit,
                orderBy: { createdAt: 'DESC' },
                populate: ['user'],
            }
        );

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    // --- ADMIN METHODS ---

    async findAllAdmin(page = 1, limit = 20, status?: ReviewStatus, targetType?: ReviewTargetType) {
        const filter: any = {};
        if (status) filter.status = status;
        if (targetType) filter.targetType = targetType;

        const [items, total] = await this.reviewRepository.findAndCount(filter, {
            limit,
            offset: (page - 1) * limit,
            orderBy: { createdAt: 'DESC' },
            populate: ['user'],
        });

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async updateStatus(id: string, status: ReviewStatus, adminNote: string, adminUser: User) {
        const review = await this.reviewRepository.findOne({ id });
        if (!review) throw new NotFoundException('Review not found');

        review.status = status;
        if (adminNote) review.adminNote = adminNote;
        review.reviewedBy = adminUser.id;
        review.reviewedAt = new Date();

        await this.em.persistAndFlush(review);
        return review;
    }

    async bulkUpdateStatus(ids: string[], status: ReviewStatus, adminUser: User) {
        const reviews = await this.reviewRepository.find({ id: { $in: ids } });
        reviews.forEach(review => {
            review.status = status;
            review.reviewedBy = adminUser.id;
            review.reviewedAt = new Date();
        });
        await this.em.flush();
        return { updatedCount: reviews.length };
    }

    async reply(id: string, replyContent: string, adminUser: User) {
        const review = await this.reviewRepository.findOne({ id });
        if (!review) throw new NotFoundException('Review not found');

        review.replyContent = replyContent;
        review.replyBy = adminUser.id;
        review.replyAt = new Date();

        await this.em.persistAndFlush(review);
        return review;
    }

    async toggleFeature(id: string, isFeatured: boolean) {
        const review = await this.reviewRepository.findOne({ id });
        if (!review) throw new NotFoundException('Review not found');

        review.isFeatured = isFeatured;
        await this.em.persistAndFlush(review);
        return review;
    }

    async getStats(targetId: string) {
        // Calculate average rating using QueryBuilder (cast to any for generic repository)
        const qb = (this.reviewRepository as any).createQueryBuilder('r');
        const result = await qb
            .select(['count(*) as count', 'avg(r.rating) as value'])
            .where({ targetId, status: ReviewStatus.APPROVED })
            .execute();

        const stats = result[0];
        return {
            average: parseFloat(parseFloat(stats.value || '0').toFixed(1)), // Return number
            count: parseInt(stats.count || '0'),
        };
    }
}
