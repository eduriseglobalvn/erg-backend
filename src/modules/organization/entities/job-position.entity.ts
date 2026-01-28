import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Department } from '@/modules/organization/entities/department.entity';

@Entity({ tableName: 'job_positions' })
export class JobPosition extends BaseEntity {
  @Property()
  title!: string;

  @Property({ default: 1 })
  level: number = 1;

  @ManyToOne(() => Department)
  department!: Department;
}
