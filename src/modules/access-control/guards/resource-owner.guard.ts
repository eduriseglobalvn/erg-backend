import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESOURCE_OWNER_KEY } from '../decorators/resource-owner.decorator';
import { ResourceOwnerService } from '../services/resource-owner.service';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private resourceOwnerService: ResourceOwnerService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const resourceType = this.reflector.getAllAndOverride<string>(RESOURCE_OWNER_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!resourceType) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        const roles = user.roles || [];
        const isAdmin = roles.some((r: any) =>
            (typeof r === 'string' && r === 'admin') ||
            (r && typeof r === 'object' && r.name === 'admin')
        );

        if (isAdmin) {
            return true;
        }

        const resourceId = request.params.id;

        if (!resourceId) {
            return false;
        }

        const isOwner = await this.resourceOwnerService.isOwner(resourceType, resourceId, user.id);

        if (!isOwner) {
            throw new ForbiddenException(`You do not have ownership access to this ${resourceType}`);
        }

        return true;
    }
}
