import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store'; // Cách import cho v3
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UserSession } from './entities/user-session.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([User, UserSession]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        // [FIX 1] Đổi 'auth_pass' thành 'password' (cho Redis v4+)
        auth_pass: configService.get('REDIS_PASS'),
        // [FIX 2] Tăng TTL lên (đơn vị là ms). 600000 = 10 phút.
        ttl: 600,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}