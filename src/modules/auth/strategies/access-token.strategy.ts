import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { User } from '@/modules/users/entities/user.entity';
import { UserPermission } from '@/modules/access-control/entities/user-permission.entity';
import { EntityManager } from '@mikro-orm/core';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    // Fetch full user with roles and permissions
    const user = await this.userRepo.findOne(
      { id: payload.sub },
      { populate: ['roles', 'roles.permissions'] },
    );

    if (!user) {
      throw new UnauthorizedException();
    }

    // Flatten permissions for easier checking in Guard
    const permissions = new Set<string>();
    user.roles.getItems().forEach((role) => {
      role.permissions.getItems().forEach((p) => permissions.add(p.name));
    });

    // Apply UserPermission overrides (GRANT/DENY)
    const userPermissions = await this.em.find(
      UserPermission,
      { user: user.id },
      { populate: ['permission'] }
    );
    userPermissions.forEach(override => {
      if (override.action === 'GRANT') {
        permissions.add(override.permission.name);
      }
      if (override.action === 'DENY') {
        permissions.delete(override.permission.name);
      }
    });

    // Return extended user object (Plain object to avoid MikroORM internal type leak)
    return {
      id: user.id,
      sub: user.id, // For compatibility
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      isProfileCompleted: user.isProfileCompleted,
      roles: user.roles.getItems().map((r) => r.name),
      permissions: Array.from(permissions),
      sessionId: (payload as any).sessionId, // Forward sessionId for session-based logic
    };
  }
}
