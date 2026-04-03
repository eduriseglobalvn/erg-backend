import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

export enum NotificationType {
    // ══════════════ AI CONTENT ══════════════
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    AI_POST_PROGRESS = 'AI_POST_PROGRESS',
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',
    AI_REFINE_COMPLETED = 'AI_REFINE_COMPLETED',
    AI_REFINE_FAILED = 'AI_REFINE_FAILED',

    // ══════════════ CRAWLER ══════════════
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
    CRAWL_BATCH_STARTED = 'CRAWL_BATCH_STARTED',
    CRAWL_STAGE_FAILED = 'CRAWL_STAGE_FAILED',
    CRAWL_SCHEDULER_EVENT = 'CRAWL_SCHEDULER_EVENT',

    // ══════════════ SYSTEM & INFRASTRUCTURE ══════════════
    SYSTEM_ALERT = 'SYSTEM_ALERT',
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',
    SYSTEM_RECOVERY = 'SYSTEM_RECOVERY',
    QUEUE_STALLED = 'QUEUE_STALLED',
    QUEUE_BACKLOG = 'QUEUE_BACKLOG',

    // ══════════════ API KEY ══════════════
    KEY_EXPIRED = 'KEY_EXPIRED',
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',
    KEY_ALL_DOWN = 'KEY_ALL_DOWN',
    KEY_RECOVERED = 'KEY_RECOVERED',

    // ══════════════ SEO ══════════════
    SEO_COMPLETED = 'SEO_COMPLETED',
    SEO_FAILED = 'SEO_FAILED',

    // ══════════════ ADMIN ACTIONS ══════════════
    ADMIN_POST_PUBLISHED = 'ADMIN_POST_PUBLISHED',
    ADMIN_POST_DELETED = 'ADMIN_POST_DELETED',
    ADMIN_USER_CREATED = 'ADMIN_USER_CREATED',
    ADMIN_ROLE_CHANGED = 'ADMIN_ROLE_CHANGED',
    ADMIN_SETTINGS_CHANGED = 'ADMIN_SETTINGS_CHANGED',

    // ══════════════ MAIL ══════════════
    MAIL_SENT = 'MAIL_SENT',
    MAIL_FAILED = 'MAIL_FAILED',
}

export enum NotificationStatus {
    UNREAD = 'UNREAD',
    READ = 'READ',
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum NotificationChannel {
    IN_APP = 'IN_APP',
    SSE = 'SSE',
    BOTH = 'BOTH',
}

@Entity({ collection: 'notifications' })
@Index({ properties: ['userId', 'status', 'createdAt'] })
@Index({ properties: ['userId', 'type'] })
@Index({ properties: ['groupKey'] })
@Index({ properties: ['expiresAt'], options: { expireAfterSeconds: 0 } })
export class Notification extends MongoBaseEntity {
    @Property()
    userId!: string;

    @Property()
    type!: NotificationType;

    @Property()
    status: NotificationStatus = NotificationStatus.UNREAD;

    @Property()
    priority: NotificationPriority = NotificationPriority.LOW;

    @Property()
    channel: NotificationChannel = NotificationChannel.BOTH;

    @Property()
    title!: string;

    @Property()
    message!: string;

    @Property({ nullable: true })
    metadata?: any;

    @Property({ nullable: true })
    readAt?: Date;

    @Property({ nullable: true })
    actionUrl?: string;

    @Property({ nullable: true })
    actions?: any;

    @Property({ nullable: true })
    groupKey?: string;

    @Property({ nullable: true })
    source?: string;

    @Property({ nullable: true })
    actorId?: string;

    @Property({ nullable: true })
    actorName?: string;

    @Property({ nullable: true })
    expiresAt?: Date;
}
