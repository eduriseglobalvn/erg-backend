import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Post } from '@/modules/posts/entities/post.entity';

@Entity({ tableName: 'seo_history' })
export class SeoHistory extends BaseEntity {
    @ManyToOne(() => Post)
    post!: Post;

    @Property()
    seoScore!: number;

    @Property()
    readabilityScore!: number;

    @Property({ type: 'decimal', precision: 5, scale: 4 })
    keywordDensity!: number;

    @Property()
    wordCount!: number;

    @Property({ type: 'json' })
    suggestions!: string[];

    @Property({ type: 'json', nullable: true })
    metadata?: {
        focusKeyword?: string;
        internalLinks?: number;
        externalLinks?: number;
        images?: number;
        imagesWithoutAlt?: number;
        headings?: {
            h1?: number;
            h2?: number;
            h3?: number;
            h4?: number;
            h5?: number;
            h6?: number;
        };
    };
}
