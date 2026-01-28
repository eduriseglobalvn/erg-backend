import { Entity, Property, ManyToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Permission } from '@/modules/access-control/entities/permission.entity';

@Entity({ tableName: 'roles' })
export class Role extends BaseEntity {
  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @ManyToMany(() => User, (user) => user.roles)
  users = new Collection<User>(this);

  @ManyToMany(() => Permission, 'roles', { owner: true })
  permissions = new Collection<Permission>(this);
}
