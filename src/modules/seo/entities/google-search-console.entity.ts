import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Post } from '@/modules/posts/entities/post.entity';

@Entity({ tableName: 'google_search_console' })
export class GoogleSearchConsole extends BaseEntity {
    @ManyToOne(() => Post)
    post!: Post;

    @Property({ length: 500 })
    url!: string; // Full URL of the page

    @Property({ default: 0 })
    clicks!: number; // Number of clicks from search results

    @Property({ default: 0 })
    impressions!: number; // Number of times shown in search results

    @Property({ type: 'decimal', precision: 5, scale: 4, default: 0 })
    ctr!: number; // Click-through rate (clicks / impressions)

    @Property({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    position!: number; // Average position in search results

    @Property({ type: 'date' })
    date!: Date; // Date of the data
}
