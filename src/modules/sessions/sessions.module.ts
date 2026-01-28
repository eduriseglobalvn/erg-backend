import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UserSession } from './entities/user-session.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([User, UserSession]),
    CacheModule.register(),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule { }