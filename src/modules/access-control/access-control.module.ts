import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UsersModule } from '@/modules/users/users.module';

@Global()
@Module({
    imports: [
        MikroOrmModule.forFeature([Role, Permission, User]),
        UsersModule, // Để có thể inject UserRepo trong service seeding
    ],
    controllers: [AccessControlController],
    providers: [AccessControlService],
    exports: [AccessControlService],
})
export class AccessControlModule { }
