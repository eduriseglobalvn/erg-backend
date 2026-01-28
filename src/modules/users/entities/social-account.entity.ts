import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { AuthProvider } from '@/shared/enums/app.enum';

@Entity({ tableName: 'social_accounts' })
export class SocialAccount extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Enum(() => AuthProvider)
  provider!: AuthProvider;

  @Property()
  providerId!: string;

  @Property({ nullable: true })
  email?: string;
}