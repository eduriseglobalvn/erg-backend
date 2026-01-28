import { Entity, Property, ManyToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Role } from '@/modules/access-control/entities/role.entity';

@Entity({ tableName: 'permissions' })
export class Permission extends BaseEntity {
  @Property({ unique: true })
  name!: string; // ex: 'post:create'

  @Property({ nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles = new Collection<Role>(this);
}
