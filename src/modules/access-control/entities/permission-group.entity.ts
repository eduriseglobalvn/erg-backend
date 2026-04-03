import { Entity, Property, ManyToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Permission } from './permission.entity';

@Entity({ tableName: 'permission_groups' })
export class PermissionGroup extends BaseEntity {
    @Property({ unique: true })
    name!: string;

    @Property()
    label!: string;

    @Property({ nullable: true })
    icon?: string;

    @ManyToMany(() => Permission)
    permissions = new Collection<Permission>(this);

    @Property({ default: 0 })
    sortOrder: number = 0;

    @Property({ type: 'json', nullable: true })
    featureFlags?: {
        sidebarItems?: string[];
        dashboardWidgets?: string[];
        quickActions?: string[];
    };
}
