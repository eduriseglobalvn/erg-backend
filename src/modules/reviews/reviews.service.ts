import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Review, ReviewStatus, ReviewTargetType } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class ReviewsService {
    constructor(
        @InjectRepository(Review)
        private readonly reviewRepository: EntityRepository<Review>,
        private readonly em: EntityManager,
    ) { }

    async create(dto: CreateReviewDto, user?: User) {
        if (user) {
            const existing = await this.reviewRepository.findOne({
                user,
                targetId: dto.targetId
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
        review.status = ReviewStatus.APPROVED; // Auto-approve for now, or use filter

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
                populate: ['user'], // Load User to show avatar
                fields: ['rating', 'comment', 'userName', 'createdAt', 'user.avatarUrl', 'user.fullName'],
            }
        );

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
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
