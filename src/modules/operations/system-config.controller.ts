import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { Auditable } from '@/modules/audit/decorators/auditable.decorator';

@ApiTags('Operations')
@Controller('operations/config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('system.manage')
@ApiBearerAuth()
export class SystemConfigController {
    constructor(private readonly configService: SystemConfigService) { }

    @Get()
    @ApiOperation({ summary: 'Get all system configurations' })
    async getAll() {
        return this.configService.getAll();
    }

    @Get(':key')
    @ApiOperation({ summary: 'Get configuration by key' })
    async get(@Param('key') key: string) {
        return { key, value: await this.configService.get(key) };
    }

    @Put(':key')
    @ApiOperation({ summary: 'Set configuration' })
    @Auditable({ action: 'set_config', resourceType: 'system_config' })
    async set(
        @Param('key') key: string,
        @Body() body: { value: any, description?: string },
        @Req() req: any
    ) {
        return this.configService.set(key, body.value, req.user?.id, body.description);
    }

    @Delete(':key')
    @ApiOperation({ summary: 'Delete configuration' })
    @Auditable({ action: 'delete_config', resourceType: 'system_config' })
    async delete(@Param('key') key: string) {
        await this.configService.delete(key);
        return { success: true };
    }
}
