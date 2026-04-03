import { Entity, Property, Enum, PrimaryKey, SerializedPrimaryKey } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

export enum CrawlStatus {
    DISCOVERED = 'DISCOVERED',
    SCRAPED = 'SCRAPED',
    PROCESSED = 'PROCESSED',
    SEO_PENDING = 'SEO_PENDING',
    SEO_OPTIMIZED = 'SEO_OPTIMIZED',
    PUBLISHED = 'PUBLISHED',
    FAILED = 'FAILED',
}

@Entity({ tableName: 'crawl_raw_contents' })
export class CrawlRawContent {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property({ unique: true })
    url!: string;

    @Property()
    sourceId!: string; // RSS Feed ID (MongoDB ObjectID string)

    @Enum(() => CrawlStatus)
    status: CrawlStatus = CrawlStatus.DISCOVERED;

    @Property({ nullable: true })
    rawTitle?: string;

    @Property({ nullable: true })
    rawContent?: string;

    @Property({ nullable: true })
    processedContent?: string;

    @Property({ nullable: true })
    seoContent?: string;

    @Property({ nullable: true })
    thumbnailUrl?: string;

    @Property({ type: 'json', nullable: true })
    images?: { original: string; uploaded: string; alt: string }[];

    @Property({ type: 'json', nullable: true })
    seoData?: { metaTitle: string; metaDescription: string; keywords: string[] };

    @Property({ type: 'json', nullable: true })
    error?: { step: string; message: string; stack: string };

    @Property({ nullable: true })
    categoryId?: string; // MySQL Category ID

    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
