import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'comments' })
export class Comment extends MongoBaseEntity {
  @Property()
  @Index()
  entityType!: string; // 'post' | 'course' | 'lesson'

  @Property()
  @Index()
  entityId!: number; // ID từ MySQL

  @Property()
  userId!: number; // Người bình luận

  @Property({ type: 'text' })
  content!: string;

  @Property({ nullable: true })
  parentId?: string; // Để làm comment đa cấp (Reply)

  @Property({ default: false })
  isHidden: boolean = false;
}