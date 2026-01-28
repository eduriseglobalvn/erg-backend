// src/modules/analytics/entities/event.entity.ts
import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'analytics_events' })
export class AnalyticsEvent extends MongoBaseEntity {
  @Property()
  @Index()
  eventType!: string; // 'click_syllabus', 'search', 'video_watch', 'lead_form'

  @Property({ type: 'json' })
  metadata!: any; // Lưu linh hoạt: { keyword: 'IELTS', duration: 45, courseId: 10 }

  @Property({ nullable: true })
  userId?: number; // MySQL ID nếu đã login

  @Property()
  sessionInternalId!: string; // Để liên kết các hành động trong cùng 1 lần vào web
}
