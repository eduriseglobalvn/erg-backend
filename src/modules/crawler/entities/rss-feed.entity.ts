import { Entity, Property } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'crawler_rss_feeds' })
export class RssFeed extends MongoBaseEntity {
    @Property()
    url!: string;

    @Property()
    name!: string;

    /** Lịch chạy Cron (VD: 0 2 * * *) */
    @Property({ nullable: true })
    cronExpression?: string;

    /** ID Chuyên mục (PostCategory) để đăng bài vào */
    @Property({ nullable: true })
    targetCategoryId?: string;

    /** Selector CSS tùy chỉnh (JSON) để lấy Title, Content, Thumbnail */
    @Property({ type: 'json', nullable: true })
    selectorConfig?: {
        articleSelector?: string;
        titleSelector?: string;
        contentSelector?: string;
        thumbnailSelector?: string;
    };

    /** Quyền chạy: Bật/Tắt cào tự động */
    @Property({ default: true })
    isActive: boolean = true;

    /** Quyền đăng: true = PUBLISHED, false = DRAFT */
    @Property({ default: false })
    autoPublish: boolean = false;
}
