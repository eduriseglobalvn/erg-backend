import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum SchemaType {
    ARTICLE = 'Article',
    BLOG_POSTING = 'BlogPosting',
    NEWS_ARTICLE = 'NewsArticle',
    FAQ_PAGE = 'FAQPage',
    HOW_TO = 'HowTo',
    BREADCRUMB = 'BreadcrumbList',
    ORGANIZATION = 'Organization',
    WEB_PAGE = 'WebPage',
    PRODUCT = 'Product',
    COURSE = 'Course',
    EVENT = 'Event',
    JOB_POSTING = 'JobPosting',
    VIDEO_OBJECT = 'VideoObject',
    IMAGE_OBJECT = 'ImageObject',
    REVIEW = 'Review',
}

@Entity({ tableName: 'schema_templates' })
export class SchemaTemplate extends BaseEntity {
    @Property()
    name!: string; // "Default Article Schema"

    @Enum({ items: () => SchemaType })
    schemaType!: SchemaType;

    @Property({ type: 'json' })
    template!: object; // JSON template with {{placeholders}}

    @Property({ default: true })
    isActive!: boolean;

    @ManyToOne(() => User, { nullable: true })
    createdBy?: User;
}
