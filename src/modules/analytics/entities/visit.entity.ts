import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity'; // Kiểm tra lại đường dẫn này

@Entity({ collection: 'analytics_visits' }) // QUAN TRỌNG: Phải có Decorator này
export class Visit extends MongoBaseEntity {
  @Property({ nullable: true })
  @Index()
  userId?: number;

  @Property()
  url!: string;

  @Property({ nullable: true })
  ipAddress?: string;

  @Property({ nullable: true })
  userAgent?: string;

  @Property({ nullable: true })
  referrer?: string;

  // --- LOCATION INFO ---
  @Property({ nullable: true })
  country?: string;

  @Property({ nullable: true })
  city?: string;

  @Property({ nullable: true })
  region?: string;

  @Property({ nullable: true })
  timezone?: string;

  // --- DEVICE INFO ---
  @Property({ nullable: true })
  deviceType?: string; // mobile, tablet, console, smarttv, wearable, embedded

  @Property({ nullable: true })
  os?: string; // iOS, Android, Windows, ...

  @Property({ nullable: true })
  browser?: string; // Chrome, Safari, ...

  @Property({ nullable: true })
  screenResolution?: string; // 1920x1080

  @Property({ nullable: true })
  entityType?: string; // 'post', 'course', 'page'

  @Property({ nullable: true })
  entityId?: string; // slug

  @Property({ default: 0 })
  durationSeconds: number = 0;
}
