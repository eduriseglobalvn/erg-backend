import { Entity, Property, ManyToOne, Enum, PrimaryKey } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum ApiKeyType {
  SHARED = 'shared',
  PRIVATE = 'private',
}

export enum AIProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  GROQ = 'groq',
  CLAUDE = 'claude',
  MISTRAL = 'mistral',
  DEEPSEEK = 'deepseek',
  TOGETHER = 'together',
  COHERE = 'cohere',
  SAMBANOVA = 'sambanova',
  CEREBRAS = 'cerebras',
  OPENROUTER = 'openrouter',
  HYPERBOLIC = 'hyperbolic'
}

export enum ApiKeyStatus {
  ACTIVE = 'active',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RATE_LIMITED = 'rate_limited',
  ERROR = 'error',
}

export enum ApiKeyErrorType {
  INVALID_KEY = 'invalid_key',
  FORBIDDEN = 'forbidden',
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
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

  @Enum({ items: () => AIProviderType, default: AIProviderType.GEMINI })
  provider: AIProviderType = AIProviderType.GEMINI;

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

  @Enum({ items: () => ApiKeyErrorType, nullable: true })
  errorType?: ApiKeyErrorType;

  @Property({ default: 0 })
  consecutiveErrors: number = 0;

  @Property({ nullable: true })
  model?: string;

  @Property({ nullable: true })
  customEndpoint?: string;

  @Property({ default: 8192 })
  maxTokensPerRequest: number = 8192;

  @Property({ type: 'float', default: 0.7 })
  defaultTemperature: number = 0.7;

  @Property({ nullable: true })
  expiresAt?: Date;

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'float', default: 0 })
  estimatedCostUsd: number = 0;

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

  @Property({ default: 1 })
  priority: number = 1;

  @Property({ default: 30 })
  rpmLimit: number = 30; // Requests per minute

  @Property({ default: 1500 })
  rpdLimit: number = 1500; // Requests per day

  @Property({ default: 0 })
  todayRpmUsage: number = 0;

  @Property({ nullable: true })
  lastMinuteReset?: Date;
}