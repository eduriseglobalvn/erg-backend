import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'certificates' })
export class Certificate extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property()
  name!: string; // Tên bằng cấp (VD: Cử nhân Sư phạm, Chứng chỉ MOS)

  @Property({ nullable: true })
  issuedBy?: string; // Nơi cấp

  @Property({ nullable: true })
  issueDate?: Date;

  @Property({ nullable: true })
  expiryDate?: Date;

  @Property({ nullable: true })
  imageUrl?: string; // Ảnh chụp bằng cấp để đối soát
}