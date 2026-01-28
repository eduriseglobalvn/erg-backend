import { Entity, Property, ManyToOne, Enum, PrimaryKey } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum ApiKeyType {
  SHARED = 'shared',
  PRIVATE = 'private',
}

export enum ApiKeyStatus {
  ACTIVE = 'active',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RATE_LIMITED = 'rate_limited',
  ERROR = 'error',
}

@Entity({ tableName: 'api_keys' })
export class ApiKey extends BaseEntity {
  @PrimaryKey()
  declare id: string; // Đồng bộ kiểu string với BaseEntity của bạn

  @Property({ nullable: true })
  label?: string; // Tên gợi nhớ cho Key (ví dụ: Project A - Account 1)

  @Property({ nullable: true })
  projectId?: string; // ID của Project trên Google Cloud để cảnh báo trùng Quota

  @Property({ type: 'text' })
  key!: string;

  @Enum({ items: () => ApiKeyType, default: ApiKeyType.PRIVATE })
  type: ApiKeyType = ApiKeyType.PRIVATE;

  @Enum({ items: () => ApiKeyStatus, default: ApiKeyStatus.ACTIVE })
  status: ApiKeyStatus = ApiKeyStatus.ACTIVE;

  @ManyToOne(() => User, { nullable: true })
  owner?: User;

  @Property({ nullable: true })
  lastErrorAt?: Date;

  @Property({ nullable: true })
  lastErrorMessage?: string;

  @Property({ nullable: true })
  cooldownUntil?: Date; // Dùng cho Rate Limit (hết giây/phút)

  @Property({ nullable: true })
  lastUsedAt?: Date;

  @Property({ default: 0 })
  usageCount: number = 0;

  @Property({ default: 0 })
  todayUsage: number = 0;

  @Property({ default: 1500 })
  maxDailyQuota: number = 1500;
}