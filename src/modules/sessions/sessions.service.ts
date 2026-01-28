import { Inject, Injectable, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
// [FIX 1] Thêm 'type' vào đây để sửa lỗi TS1272
import type { Cache } from 'cache-manager';

import { User } from '@/modules/users/entities/user.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { SessionResponseDto } from './dto/session-response.dto';
import { UserStatus } from '@/shared/enums/app.enum';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepo: EntityRepository<UserSession>,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }
  async onModuleInit() {
    try {
      console.log('🔄 Đang thử kết nối Redis...');
      await this.cacheManager.set('test_redis_connection', 'OK', 10000); // 10s
      const value = await this.cacheManager.get('test_redis_connection');

      if (value === 'OK') {
        console.log('✅ KẾT NỐI REDIS THÀNH CÔNG! Cache đang hoạt động.');
      } else {
        console.error(
          '❌ Redis không lưu được dữ liệu (Có thể đang fallback về Memory)',
        );
      }
    } catch (e) {
      console.error('❌ Lỗi kết nối Redis:', e);
    }
  }
  async getCurrentSessionContext(
    userId: string,
    sessionId: string,
  ): Promise<SessionResponseDto> {
    const cacheKey = `session_ctx:${userId}:${sessionId}`;

    // 1. CHECK REDIS
    const cachedData = await this.cacheManager.get<SessionResponseDto>(cacheKey);

    if (cachedData) {
      // [FIX 2] Thêm fallback "|| new Date()" để đảm bảo không truyền undefined vào new Date()
      return {
        ...cachedData,
        session: {
          ...cachedData.session,
          // Nếu lastActiveAt có giá trị thì dùng, nếu null/undefined thì lấy giờ hiện tại
          lastActiveAt: new Date(cachedData.session.lastActiveAt || new Date()),
          expiresAt: new Date(cachedData.session.expiresAt || new Date()),
        },
        system: {
          ...cachedData.system,
          serverTime: new Date(),
        }
      };
    }

    // --- LOGIC DATABASE (FALLBACK) ---

    // 2. Lấy User
    const user = await this.userRepo.findOne(userId, {
      populate: ['roles', 'roles.permissions'],
    });



    if (!user) throw new NotFoundException('User context not found');

    // [CHECK STATUS] Chặn ngay nếu rạng trạng thái không hợp lệ
    // Để đảm bảo user đang dùng dở mà bị khóa thì sẽ bị đá ra ở lần request tiếp theo
    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Account is not activated. Please verify your email.');
    }
    if (user.status === UserStatus.BANNED || user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException('Account has been banned or blocked.');
    }

    // 3. Lấy Session
    const session = await this.sessionRepo.findOne({
      id: sessionId,
      user: userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    // 4. Aggregate Permissions
    const permissions = new Set<string>();
    const roles: string[] = [];

    user.roles.getItems().forEach((role) => {
      roles.push(role.name || role.name);
      role.permissions.getItems().forEach((perm) => {
        permissions.add(perm.name || perm.name);
      });
    });

    // 5. Build DTO
    const responseDto: SessionResponseDto = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName || 'Unknown',
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      accessControl: {
        roles: roles,
        permissions: Array.from(permissions),
      },
      session: {
        id: session.id,
        ipAddress: session.ipAddress,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
      },
      system: {
        serverTime: new Date(),
        version: '1.0.0',
      },
    };

    // 6. SET REDIS (TTL: 15 phút)
    await this.cacheManager.set(cacheKey, responseDto, { ttl: 900 }); // 900 giây

    return responseDto;
  }

  // Helper xóa cache
  async clearSessionCache(userId: string, sessionId: string) {
    const key = `session_ctx:${userId}:${sessionId}`;
    await this.cacheManager.del(key);
  }
}