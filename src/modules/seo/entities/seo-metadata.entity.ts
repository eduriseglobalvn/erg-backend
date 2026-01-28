import { Entity, Property, Index, Unique } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'seo_metadata' })
@Unique({ properties: ['entityType', 'entityId'] }) // Đảm bảo mỗi thực thể chỉ có 1 bộ SEO
export class SeoMetadata extends BaseEntity {
  @Property()
  @Index()
  entityType!: string; // Ví dụ: 'post', 'course', 'user'

  @Property()
  @Index()
  entityId!: number; // ID tương ứng của post_id, course_id...

  @Property({ nullable: true })
  metaTitle?: string;

  @Property({ type: 'text', nullable: true })
  metaDescription?: string;

  @Property({ nullable: true })
  metaKeywords?: string;

  @Property({ nullable: true })
  ogImage?: string; // Ảnh hiển thị khi share Facebook/Zalo

  @Property({ nullable: true })
  canonicalUrl?: string;
}
