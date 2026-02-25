import { Entity, Property } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

export enum NotificationType {
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
}

export enum NotificationStatus {
    UNREAD = 'UNREAD',
    READ = 'READ',
}

@Entity({ collection: 'notifications' })
export class Notification extends MongoBaseEntity {
    @Property()
    userId!: string; // ID của user nhận thông báo

    @Property()
    type!: NotificationType;

    @Property()
    status: NotificationStatus = NotificationStatus.UNREAD;

    @Property()
    title!: string;

    @Property()
    message!: string;

    @Property({ nullable: true })
    metadata?: any; // Lưu thông tin chi tiết (postId, jobId, url, etc.)

    @Property({ nullable: true })
    readAt?: Date;
}
