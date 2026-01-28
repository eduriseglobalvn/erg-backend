import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Region } from '@/modules/organization/entities/region.entity';

@Entity({ tableName: 'schools' })
export class School extends BaseEntity {
  @Property()
  name!: string;

  @Property({ nullable: true })
  address?: string;

  @Property({ nullable: true })
  type?: string;

  @ManyToOne(() => Region)
  region!: Region;
}
