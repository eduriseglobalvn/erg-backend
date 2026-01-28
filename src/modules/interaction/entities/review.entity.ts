import { Entity, Property, Enum, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';
import { ReviewStatus } from '@/shared/enums/app.enum';

@Entity({ collection: 'reviews' })
export class Review extends MongoBaseEntity {
  @Property()
  @Index()
  courseId!: number;

  @Property({ nullable: true })
  userId?: number; // Null nếu khách vãng lai review bằng email

  @Property()
  reviewerEmail!: string; // Định danh bằng email để kiểm soát spam

  @Property()
  reviewerName!: string;

  @Property()
  rating!: number; // 1-5 sao

  @Property({ type: 'text' })
  content!: string;

  @Enum({ items: () => ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus = ReviewStatus.PENDING;

  @Property({ type: 'json', nullable: true })
  mediaUrls?: string[]; // Ảnh/Video feedback
}