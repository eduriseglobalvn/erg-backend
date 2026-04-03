import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/mongodb';
import { AuthActivityLog } from '@/modules/auth/entities/auth-activity-log.entity';

export enum ActivityAction {
    PROFILE_UPDATE = 'PROFILE_UPDATE',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    POST_CREATE = 'POST_CREATE',
    POST_UPDATE = 'POST_UPDATE',
    POST_DELETE = 'POST_DELETE',
    COURSE_ENROLL = 'COURSE_ENROLL',
    ROLE_CHANGED = 'ROLE_CHANGED',
    STATUS_CHANGED = 'STATUS_CHANGED',
}

@Injectable()
export class UserActivityService {
    private readonly logger = new Logger(UserActivityService.name);

    constructor(
        @InjectEntityManager('mongo-connection')
        private readonly mongoEm: EntityManager,
    ) { }

    async logActivity(
        userId: string,
        email: string,
        action: ActivityAction,
        ip: string,
        ua: string,
        metadata: any = {},
    ) {
        try {
            const log = new AuthActivityLog();
            log.userId = userId;
            log.email = email;
            log.action = action;
            log.ipAddress = ip;
            log.userAgent = ua;
            log.metadata = metadata;
            log.createdAt = new Date();

            await this.mongoEm.fork().persistAndFlush(log);
        } catch (e) {
            this.logger.error('Failed to write user activity log', e);
        }
    }

    async getUserActivity(userId: string, page: number = 1, limit: number = 10, action?: string) {
        const filter: any = { userId };
        if (action) filter.action = action;

        const [logs, count] = await this.mongoEm.findAndCount(
            AuthActivityLog,
            filter,
            {
                limit,
                offset: (page - 1) * limit,
                orderBy: { createdAt: 'DESC' },
            },
        );

        return {
            data: logs,
            meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
        };
    }
}
