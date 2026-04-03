import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    Notification,
    NotificationType,
    NotificationStatus,
    NotificationPriority,
    NotificationChannel
} from './entities/notification.entity';
import { User } from '@/modules/users/entities/user.entity';

export interface CreateNotificationDto {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    channel?: NotificationChannel;
    metadata?: any;
    actionUrl?: string;
    actions?: any;
    groupKey?: string;
    source?: string;
    actorId?: string;
    actorName?: string;
    expiresAt?: Date;
}

import { SseService } from '@/shared/queue-monitor/sse.service';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification, 'mongo-connection')
        private readonly notificationRepo: EntityRepository<Notification>,
        private readonly em: EntityManager,
        private readonly sseService: SseService,
    ) { }

    /**
     * Tạo thông báo mới cho một user
     */
    async create(data: CreateNotificationDto): Promise<Notification> {
        const notification = this.notificationRepo.create({
            ...data,
            status: NotificationStatus.UNREAD,
            priority: data.priority || NotificationPriority.LOW,
            channel: data.channel || NotificationChannel.BOTH,
        } as any);

        await this.notificationRepo.getEntityManager().persistAndFlush(notification);
        this.logger.log(`Created notification for user ${data.userId}: ${data.title}`);

        // Push real-time via SSE
        this.sseService.emitToUser(data.userId, 'notification', notification);

        return notification;
    }

    /**
     * Tạo thông báo cho toàn bộ Admin
     */
    async createForAdmins(data: Omit<CreateNotificationDto, 'userId'>): Promise<void> {
        // Find all users with admin role from MySQL
        const admins = await this.em.find(User, { roles: { name: 'admin' } }, { populate: ['roles'] });

        if (admins.length === 0) {
            this.logger.warn('No admin users found to send notifications to.');
            return;
        }

        for (const admin of admins) {
            const notification = this.notificationRepo.create({
                ...data,
                userId: admin.id,
                status: NotificationStatus.UNREAD,
                priority: data.priority || NotificationPriority.LOW,
                channel: data.channel || NotificationChannel.BOTH,
            } as any);
            this.notificationRepo.getEntityManager().persist(notification);
        }

        await this.notificationRepo.getEntityManager().flush();
        this.logger.log(`Created notifications for ${admins.length} admins: ${data.title}`);

        // Push real-time to all admins via SSE
        this.sseService.emitToAdmins('notification', data);
    }

    /**
     * Cron 3h sáng — xóa đã đọc >30 ngày
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanupExpiredNotifications() {
        this.logger.log('Running cleanup of old read notifications...');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const count = await this.notificationRepo.nativeDelete({
            status: NotificationStatus.READ,
            readAt: { $lt: thirtyDaysAgo }
        } as any);

        if (count > 0) {
            this.logger.log(`Cleaned up ${count} old read notifications.`);
        }
    }

    /**
     * Lấy danh sách thông báo của user
     */
    async findByUser(userId: string, limit: number = 20, offset: number = 0) {
        const [items, total] = await this.notificationRepo.findAndCount(
            { userId },
            {
                limit,
                offset,
                orderBy: { createdAt: 'DESC' },
            }
        );

        const unreadCount = await this.countUnread(userId);

        return { items, total, unreadCount };
    }

    /**
     * Lấy theo Type
     */
    async findByType(userId: string, type: NotificationType, limit: number = 20, offset: number = 0) {
        return this.notificationRepo.findAndCount(
            { userId, type },
            { limit, offset, orderBy: { createdAt: 'DESC' } }
        );
    }

    /**
     * Lấy theo Source
     */
    async findBySource(userId: string, source: string, limit: number = 20, offset: number = 0) {
        return this.notificationRepo.findAndCount(
            { userId, source },
            { limit, offset, orderBy: { createdAt: 'DESC' } }
        );
    }

    /**
     * Lấy theo GroupKey
     */
    async findByGroup(userId: string, groupKey: string, limit: number = 20, offset: number = 0) {
        return this.notificationRepo.findAndCount(
            { userId, groupKey },
            { limit, offset, orderBy: { createdAt: 'DESC' } }
        );
    }

    /**
     * Đánh dấu đã đọc
     */
    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const notification = await this.notificationRepo.findOne({ id, userId } as any);
        if (!notification) return null;

        notification.status = NotificationStatus.READ;
        notification.readAt = new Date();
        await this.notificationRepo.getEntityManager().flush();

        return notification;
    }

    /**
     * Đánh dấu tất cả đã đọc
     */
    async markAllAsRead(userId: string): Promise<number> {
        const notifications = await this.notificationRepo.find({
            userId,
            status: NotificationStatus.UNREAD,
        });

        notifications.forEach(n => {
            n.status = NotificationStatus.READ;
            n.readAt = new Date();
        });

        await this.notificationRepo.getEntityManager().flush();
        return notifications.length;
    }

    /**
     * Xoá tất cả đã đọc
     */
    async deleteAllRead(userId: string): Promise<number> {
        const count = await this.notificationRepo.nativeDelete({
            userId,
            status: NotificationStatus.READ,
        } as any);

        return count;
    }

    /**
     * Đếm số thông báo chưa đọc
     */
    async countUnread(userId: string): Promise<number> {
        return this.notificationRepo.count({
            userId,
            status: NotificationStatus.UNREAD,
        });
    }

    /**
     * Xóa thông báo cụ thể
     */
    async delete(id: string, userId: string): Promise<boolean> {
        const notification = await this.notificationRepo.findOne({ id, userId } as any);
        if (!notification) return false;

        await this.notificationRepo.getEntityManager().removeAndFlush(notification);
        return true;
    }
}
