import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { PostCategory } from './post-category.entity';
import { PostStatus } from '@/shared/enums/app.enum';

@Entity({ tableName: 'posts' })
export class Post extends BaseEntity {
  @Property()
  title!: string;

  @Property({ unique: true })
  slug!: string;

  @Property({ type: 'text', nullable: true })
  excerpt?: string; // Mô tả ngắn (Sapo)

  @Property({ type: 'text', nullable: true })
  content?: string; // Nội dung bài viết

  // Chứa TOC, SEO meta, hoặc cấu hình riêng của bài
  @Property({ type: 'json', nullable: true })
  meta?: any;

  @Property({ nullable: true })
  thumbnailUrl?: string;

  @Enum({ items: () => PostStatus, default: PostStatus.DRAFT })
  status: PostStatus = PostStatus.DRAFT;

  @Property({ default: false })
  isPublished: boolean = false;

  @Property({ nullable: true })
  publishedAt?: Date;

  // --- QUẢN LÝ NGƯỜI DÙNG ---

  // Người tạo bản ghi này (Admin hoặc AI)
  @ManyToOne(() => User)
  createdBy!: User;

  // Người duyệt đăng (Admin bấm nút Publish)
  @ManyToOne(() => User, { nullable: true })
  publishedBy?: User;

  // Tác giả hiển thị trên bài viết (Có thể set là người khác)
  @ManyToOne(() => User)
  author!: User;

  @Property({ default: false })
  isCreatedByAI: boolean = false;

  // --- THỐNG KÊ & PHÂN LOẠI ---

  @Property({ default: 0 })
  viewCount: number = 0;

  @Property({ default: 0 })
  commentCount: number = 0;

  @ManyToOne(() => PostCategory)
  category!: PostCategory;

  // --- AI METADATA ---

  @Property({ type: 'text', nullable: true })
  aiPrompt?: string;

  @Property({ nullable: true })
  aiJobId?: string;

  // --- SEO METADATA ---
  @Property({ nullable: true })
  metaTitle?: string;

  @Property({ type: 'text', nullable: true })
  metaDescription?: string;

  @Property({ nullable: true })
  focusKeyword?: string;

  @Property({ nullable: true })
  keywords?: string;

  @Property({ nullable: true })
  canonicalUrl?: string;

  @Enum({ items: () => SchemaType, nullable: true })
  schemaType?: SchemaType;

  @Property({ default: 0 })
  seoScore: number = 0;

  // --- SOFT DELETE ---
  @Property({ nullable: true })
  deletedAt?: Date;
}

export enum SchemaType {
  ARTICLE = 'Article',
  NEWS_ARTICLE = 'NewsArticle',
  BLOG_POSTING = 'BlogPosting',
}
