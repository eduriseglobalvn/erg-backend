import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'auth_activity_logs' })
export class AuthActivityLog extends MongoBaseEntity {
  @Property()
  @Index()
  userId!: string; // Đổi từ number sang string (UUID)

  @Property()
  email!: string;

  @Property()
  action!: string; // 'LOGIN', 'REGISTER', ...

  @Property({ nullable: true })
  ipAddress?: string;

  @Property({ nullable: true })
  userAgent?: string;

  @Property({ type: 'json', nullable: true })
  metadata?: any;
}
