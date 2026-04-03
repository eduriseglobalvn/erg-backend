import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '@/modules/users/entities/user.entity';
import { UserPermission } from './entities/user-permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { UsersModule } from '@/modules/users/users.module';
import { ResourceOwnerService } from './services/resource-owner.service';
import { ResourceOwnerGuard } from './guards/resource-owner.guard';

@Global()
@Module({
    imports: [
        MikroOrmModule.forFeature([Role, Permission, User, UserPermission, PermissionGroup]),
        UsersModule, // Để có thể inject UserRepo trong service seeding
    ],
    controllers: [AccessControlController],
    providers: [AccessControlService, ResourceOwnerService, ResourceOwnerGuard],
    exports: [AccessControlService, ResourceOwnerService, ResourceOwnerGuard],
})
export class AccessControlModule { }
