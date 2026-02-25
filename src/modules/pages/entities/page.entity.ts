import { Entity, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'pages' })
@Unique({ properties: ['slug', 'domain'] }) // Slug should be unique per domain
export class Page extends BaseEntity {
    @Property()
    title!: string;

    @Property()
    slug!: string; // 'mos', 'gioi-thieu', 'ic3-gs6'

    @Property({ type: 'text', nullable: true })
    content?: string;

    @Property({ nullable: true })
    domain?: string; // 'tinhocquocte.erg.edu.vn', etc.

    @Property({ nullable: true })
    thumbnail?: string;

    // SEO Metadata
    @Property({ nullable: true })
    metaTitle?: string;

    @Property({ type: 'text', nullable: true })
    metaDescription?: string;

    @Property({ type: 'json', nullable: true })
    faq?: Array<{ question: string; answer: string }>;

    @Property({ type: 'json', nullable: true })
    introVideo?: {
        name: string;
        description: string;
        thumbnailUrl: string;
        uploadDate: string;
        contentUrl: string;
    };
}
