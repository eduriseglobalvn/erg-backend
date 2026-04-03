import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Module({
    imports: [MikroOrmModule.forFeature([AdminAuditLog], 'mongo-connection')],
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService]
})
export class AuditModule { }

