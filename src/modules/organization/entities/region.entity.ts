import {
  Entity,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
} from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { School } from '@/modules/organization/entities/school.entity';

@Entity({ tableName: 'regions' })
export class Region extends BaseEntity {
  @Property()
  name!: string;

  @Property({ unique: true })
  code!: string;

  @ManyToOne(() => User, { nullable: true })
  manager?: User; // Giám đốc vùng

  @OneToMany(() => School, (school) => school.region)
  schools = new Collection<School>(this);
}