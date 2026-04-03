import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { BullModule } from '@nestjs/bullmq';
import { IpProtectionService } from './ip-protection.service';
import { IpAdminController } from './ip-admin.controller';
import { AbuseDetectionService } from './abuse-detection.service';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigService } from './system-config.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { SystemConfigController } from './system-config.controller';

@Module({
    imports: [
        MikroOrmModule.forFeature([SystemConfig]),
        BullModule.registerQueue({
            name: 'ai-content-queue',
        }),
    ],
    controllers: [HealthController, IpAdminController, SystemConfigController],
    providers: [IpProtectionService, AbuseDetectionService, SystemConfigService],
    exports: [IpProtectionService, AbuseDetectionService, SystemConfigService],
})

export class OperationsModule { }
