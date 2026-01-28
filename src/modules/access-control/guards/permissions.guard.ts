import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            throw new ForbiddenException('User context not found');
        }

        // Logic: user (from JWT payload) -> roles -> permissions
        // TUY NHIÊN: Payload JWT thường chỉ có userId, roleName (string).
        // Ở đây chúng ta cần danh sách permission thực tế.
        // Cách 1: Query DB (chậm).
        // Cách 2: Lấy từ Session Context (đã cache Redis).
        // Cách 3 (Dùng đây): Check session response từ controller (nếu guard chạy sau) -> KHÔNG. Guard chạy trước.

        // => Giải pháp tốt nhất: Ở JwtStrategy hoặc SessionService đã load permission rồi.
        // NẾU JwtStrategy chưa load full, ta cần query nhanh hoặc check redis.

        // TẠM THỜI: Để đơn giản và chính xác, user trong request CẦN được populate quyền.
        // Ở JwtAuthGuard ta đã query user.
        // Hãy chắc chắn JwtStrategy trả về object user có roles -> permissions.
        // Nếu JwtStrategy chỉ trả về session đơn giản, ta cần check lại logic đó.

        // GIẢ SỬ: Object user trong request đã có thuộc tính permissions (string[])
        // Chúng ta sẽ update JwtStrategy sau để support việc này.

        const userPermissions = user.permissions || [];

        const hasPermission = requiredPermissions.every((permission) =>
            userPermissions.includes(permission),
        );

        if (!hasPermission) {
            throw new ForbiddenException('You do not have permission to access this resource');
        }

        return true;
    }
}
