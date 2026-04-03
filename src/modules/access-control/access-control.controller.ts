import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';
import { Auditable } from '@/modules/audit/decorators/auditable.decorator';
import { CreateRoleDto, UpdateRoleDto, AssignRolesDto, AssignDirectPermissionsDto } from './dto/access-control.dto';

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

    @Get('permission-groups')
    @Permissions('roles.read')
    @ResponseMessage('Get all permission groups successfully')
    async findAllPermissionGroups() {
        return this.acService.findAllPermissionGroups();
    }

    @Get('feature-config')
    @ResponseMessage('Get UI feature configuration successfully')
    async getFeatureConfig(@Req() req: any) {
        return this.acService.getUserPermissionsAndFeatures(req.user.sub);
    }

    @Post('roles')
    @Permissions('roles.create')
    @Auditable({ action: 'CREATE_ROLE', resourceType: 'Role' })
    @ResponseMessage('Create role successfully')
    async createRole(@Body() dto: CreateRoleDto) {
        return this.acService.createRole(dto);
    }

    @Put('roles/:id')
    @Permissions('roles.update')
    @Auditable({ action: 'UPDATE_ROLE', resourceType: 'Role' })
    @ResponseMessage('Update role successfully')
    async updateRole(
        @Param('id') id: string,
        @Body() dto: UpdateRoleDto,
    ) {
        return this.acService.updateRole(id, dto);
    }

    @Patch('users/:userId/roles')
    @Permissions('roles.assign')
    @Auditable({ action: 'ASSIGN_ROLES', resourceType: 'User' })
    @ResponseMessage('Assign roles to user successfully')
    async assignRolesToUser(
        @Param('userId') userId: string,
        @Body() dto: AssignRolesDto,
    ) {
        return this.acService.assignRoles(userId, dto.roleIds);
    }

    @Get('users/:userId/effective-permissions')
    @Permissions('users.read', 'roles.read')
    @ResponseMessage('Get user effective permissions successfully')
    async getEffectivePermissions(@Param('userId') userId: string) {
        return this.acService.getUserPermissionsAndFeatures(userId);
    }

    @Get('users/:userId/permission-overrides')
    @Permissions('roles.assign')
    @ResponseMessage('Get user permission overrides successfully')
    async getPermissionOverrides(@Param('userId') userId: string) {
        // We will create a method to fetch overrides in the service, or just return them here if we have it
        return this.acService.getUserPermissionOverrides(userId);
    }

    @Post('users/:userId/permissions')
    @Permissions('roles.assign')
    @Auditable({ action: 'ASSIGN_PERMISSIONS', resourceType: 'User' })
    @ResponseMessage('Assign direct permissions to user successfully')
    async assignDirectPermissions(
        @Param('userId') userId: string,
        @Body() dto: AssignDirectPermissionsDto,
        @Req() req: any
    ) {
        const grantList = dto.grantIds || [];
        const denyList = dto.denyIds || [];
        return this.acService.assignDirectPermissions(req.user.sub, userId, grantList, denyList);
    }
}
