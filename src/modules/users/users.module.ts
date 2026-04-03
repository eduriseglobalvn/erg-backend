import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserActivityService } from './services/user-activity.service';

// Entities
import { User } from './entities/user.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { SessionsModule } from '@/modules/sessions/sessions.module';

@Module({
  imports: [
    // Đăng ký Entity MySQL
    MikroOrmModule.forFeature([User, UserSession, Role]),
    SessionsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserActivityService],
  exports: [UsersService, UserActivityService], // Export để AuthModule hoặc các module khác dùng lại
})
export class UsersModule { }