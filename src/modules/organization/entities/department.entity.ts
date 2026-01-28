import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'departments' })
export class Department extends BaseEntity {
  @Property()
  name!: string;

  @ManyToOne(() => User, { nullable: true })
  headUser?: User; // Trưởng phòng
}
