import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get('logs')
    @Permissions('audit.read')
    @ResponseMessage('Get audit logs successfully')
    async getLogs(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.auditService.getLogs(Number(page), Number(limit));
    }
}
