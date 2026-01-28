import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';

@Controller('access-control')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessControlController {
    constructor(private readonly acService: AccessControlService) { }

    @Get('permissions')
    @Permissions('roles.read')
    @ResponseMessage('Get all permissions successfully')
    async findAllPermissions() {
        return this.acService.findAllPermissions();
    }

    @Get('roles')
    @Permissions('roles.read')
    @ResponseMessage('Get all roles successfully')
    async findAllRoles() {
        return this.acService.findAllRoles();
    }

    @Post('roles')
    @Permissions('roles.create')
    @ResponseMessage('Create role successfully')
    async createRole(@Body() dto: { name: string; description?: string; permissionIds?: string[] }) {
        return this.acService.createRole(dto);
    }

    @Put('roles/:id')
    @Permissions('roles.update')
    @ResponseMessage('Update role successfully')
    async updateRole(
        @Param('id') id: string,
        @Body() dto: { name?: string; description?: string; permissionIds?: string[] },
    ) {
        return this.acService.updateRole(id, dto);
    }

    @Patch('users/:userId/roles')
    @Permissions('roles.assign')
    @ResponseMessage('Assign roles to user successfully')
    async assignRolesToUser(
        @Param('userId') userId: string,
        @Body() dto: { roleIds: string[] },
    ) {
        return this.acService.assignRoles(userId, dto.roleIds);
    }
}
