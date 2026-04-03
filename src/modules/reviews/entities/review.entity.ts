import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum ReviewStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export enum ReviewTargetType {
    POST = 'post',
    COURSE = 'course',
    PAGE = 'page',
}

@Entity({ tableName: 'reviews' })
export class Review extends BaseEntity {
    @Property()
    targetId!: string; // ID of Post/Course/Page

    @Enum({ items: () => ReviewTargetType, default: ReviewTargetType.POST })
    targetType: ReviewTargetType = ReviewTargetType.POST;

    @ManyToOne(() => User, { nullable: true })
    user?: User;

    @Property()
    userName?: string; // Cache name if guest or user deleted

    @Property()
    rating!: number; // 1-5

    @Property({ type: 'text', nullable: true })
    comment?: string;

    @Property({ default: false })
    isVerifiedPurchase: boolean = false;

    @Enum({ items: () => ReviewStatus, default: ReviewStatus.PENDING })
    status: ReviewStatus = ReviewStatus.PENDING;

    // --- Moderation fields ---
    @Property({ type: 'text', nullable: true })
    adminNote?: string;

    @Property({ nullable: true })
    reviewedBy?: string;

    @Property({ nullable: true })
    reviewedAt?: Date;

    @Property({ type: 'text', nullable: true })
    replyContent?: string;

    @Property({ nullable: true })
    replyBy?: string;

    @Property({ nullable: true })
    replyAt?: Date;

    // --- Presentation fields ---
    @Property({ default: false })
    isFeatured: boolean = false;

    @Property({ default: 0 })
    helpfulCount: number = 0;

    // --- Anti-spam fields ---
    @Property({ nullable: true })
    ipAddress?: string;

    @Property({ type: 'text', nullable: true })
    userAgent?: string;

    // --- Public user data backup ---
    @Property({ nullable: true })
    userEmail?: string;

    @Property({ nullable: true })
    userAvatar?: string;
}
