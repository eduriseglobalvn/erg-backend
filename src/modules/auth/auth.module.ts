import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule để dùng env

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

// Entities
import { User } from '@/modules/users/entities/user.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import { AuthActivityLog } from './entities/auth-activity-log.entity';
import { SessionsModule } from '@/modules/sessions/sessions.module';

@Module({
  imports: [
    ConfigModule, // Đảm bảo ConfigService hoạt động trong Strategy
    JwtModule.register({}), // Chúng ta sign token thủ công trong service nên để trống config ở đây

    // 1. Đăng ký Entity cho MySQL (User, Session)
    MikroOrmModule.forFeature([User, UserSession, Role]),

    // 2. Đăng ký Entity cho MongoDB (Log) - QUAN TRỌNG: contextName
    MikroOrmModule.forFeature([AuthActivityLog], 'mongo-connection'),
    SessionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy, RefreshTokenStrategy],
})
export class AuthModule { }
