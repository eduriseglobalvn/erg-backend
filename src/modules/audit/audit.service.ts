import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/mongodb';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AdminAuditLog, 'mongo-connection')
        private readonly auditRepo: EntityRepository<AdminAuditLog>
    ) { }

    async logAction(data: {
        userId: string;
        userEmail?: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        oldValue?: any;
        newValue?: any;
        ipAddress: string;
        userAgent?: string;
    }): Promise<void> {
        try {
            const log = this.auditRepo.create({
                ...data,
                id: new Date().getTime().toString(),
                createdAt: new Date()
            });
            await this.auditRepo.getEntityManager().persistAndFlush(log);
        } catch (error) {
            this.logger.error('Failed to write audit log', error);
        }
    }

    async getLogs(page = 1, limit = 20) {
        const [items, total] = await this.auditRepo.findAndCount(
            {},
            {
                orderBy: { createdAt: 'DESC' },
                offset: (page - 1) * limit,
                limit
            }
        );

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
