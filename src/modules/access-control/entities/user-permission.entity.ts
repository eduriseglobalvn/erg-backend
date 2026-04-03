import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Permission } from './permission.entity';

export enum PermissionAction {
    GRANT = 'GRANT',
    DENY = 'DENY',
}

@Entity({ tableName: 'user_permissions' })
export class UserPermission extends BaseEntity {
    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Permission)
    permission!: Permission;

    @Enum({ items: () => PermissionAction })
    action!: PermissionAction;
}
