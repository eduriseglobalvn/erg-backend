import { Entity, Property } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'crawler_history' })
export class CrawlHistory extends MongoBaseEntity {
    @Property()
    url!: string;

    /** ID của RssFeed nếu bài này đến từ RSS */
    @Property({ nullable: true })
    sourceId?: string;

    @Property()
    status!: 'SUCCESS' | 'FAILED' | 'PENDING';

    @Property({ nullable: true })
    errorMessage?: string;

    /** ID bài viết sau khi crawl thành công (MySQL ID) */
    @Property({ nullable: true })
    postId?: string;

    @Property()
    crawledAt: Date = new Date();
}
