import { Entity, Property, ManyToOne, Ref } from '@mikro-orm/core';
import { MongoBaseEntity } from '../../../core/base/mongo-base.entity';

@Entity({ collection: 'seo_score_histories' })
export class SeoScoreHistory extends MongoBaseEntity {
    @Property()
    postId!: string;

    @Property()
    date: Date = new Date();

    @Property()
    overallScore!: number; // 0-100

    @Property()
    keywordDensityScore!: number; // 0-100

    @Property()
    readabilityScore!: number; // 0-100

    @Property()
    metaTagsScore!: number; // 0-100

    @Property()
    internalLinksScore!: number; // 0-100

    @Property({ nullable: true })
    aiContentOptimizationRating?: string; // e.g: 'A+', 'B', 'Needs Improvement'

    @Property({ type: 'json', nullable: true })
    recommendations?: string[]; // Danh sách các gợi ý cải thiện (ví dụ: "Thêm keyword vào thẻ H2")
}
