import { Entity, Property, Enum } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

export enum ScraperType {
    STATIC = 'STATIC', // Cheerio
    DYNAMIC = 'DYNAMIC', // Playwright
}

@Entity({ collection: 'crawler_scraper_configs' })
export class ScraperConfig extends MongoBaseEntity {
    @Property({ unique: true })
    domain!: string; // VD: iigvietnam.com

    @Enum(() => ScraperType)
    type: ScraperType = ScraperType.STATIC;

    /** Tên file handler custom nếu có (VD: iig.handler.ts) */
    @Property({ nullable: true })
    handler?: string;

    /** Lịch chạy Cron riêng cho domain này (nếu khác RSS) */
    @Property({ nullable: true })
    schedule?: string;

    /** Selector CSS tùy chỉnh cho domain này */
    @Property({ type: 'json', nullable: true })
    selectorConfig?: {
        titleSelector?: string;
        contentSelector?: string;
        thumbnailSelector?: string;
    };

    @Property({ default: true })
    isActive: boolean = true;

    @Property({ default: false })
    autoPublish: boolean = false;
}
