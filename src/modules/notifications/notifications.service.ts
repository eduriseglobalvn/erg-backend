import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification, 'mongo-connection')
        private readonly notificationRepo: EntityRepository<Notification>,
    ) { }

    /**
     * Tạo thông báo mới
     */
    async create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        metadata?: any;
    }): Promise<Notification> {
        const notification = this.notificationRepo.create({
            ...data,
            status: NotificationStatus.UNREAD,
        } as any);

        await this.notificationRepo.getEntityManager().persistAndFlush(notification);
        this.logger.log(`Created notification for user ${data.userId}: ${data.title}`);

        return notification;
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
     * Đếm số thông báo chưa đọc
     */
    async countUnread(userId: string): Promise<number> {
        return this.notificationRepo.count({
            userId,
            status: NotificationStatus.UNREAD,
        });
    }

    /**
     * Xóa thông báo
     */
    async delete(id: string, userId: string): Promise<boolean> {
        const notification = await this.notificationRepo.findOne({ id, userId } as any);
        if (!notification) return false;

        await this.notificationRepo.getEntityManager().removeAndFlush(notification);
        return true;
    }
}
