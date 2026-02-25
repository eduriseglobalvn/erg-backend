import { Entity, Property, ManyToOne, Enum, OptionalProps } from '@mikro-orm/core';
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

  @Property({ default: 0 })
  readabilityScore: number = 0;

  @Property({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  keywordDensity: number = 0;

  // --- ADVANCED SEO ---

  // Schema Markup (JSON-LD)
  @Property({ type: 'json', nullable: true })
  schemaMarkup?: any; // Full JSON-LD schema graph

  @Property({ type: 'json', nullable: true })
  schemaData?: { type: string; data: any };

  @Property({ type: 'json', nullable: true })
  enabledSchemaTypes?: string[]; // ['Article', 'FAQ', 'HowTo', 'Breadcrumb']

  @Property({ nullable: true })
  primaryImageId?: string; // ID của ảnh đại diện chính (cho Google Discover)

  @Property({ type: 'json', nullable: true })
  relatedPostsIds?: string[]; // Danh sách ID bài viết liên quan (JSON array for simplicity)


  // Robots Meta
  @Property({ type: 'json', nullable: true })
  robotsMeta?: {
    index: boolean;
    follow: boolean;
    noarchive?: boolean;
    nosnippet?: boolean;
    maxSnippet?: number;
    maxImagePreview?: string; // 'none' | 'standard' | 'large'
    maxVideoPreview?: number;
  };

  @Property({ default: true })
  robotsIndex: boolean = true;

  @Property({ default: true })
  robotsFollow: boolean = true;

  @Property({ length: 200, nullable: true })
  robotsAdvanced?: string;

  // Open Graph (Facebook, LinkedIn, Zalo, WhatsApp, Telegram)
  @Property({ type: 'json', nullable: true })
  openGraph?: {
    // Basic OG Tags
    title?: string;
    description?: string;
    type?: string; // 'article' | 'website' | 'video.movie' | 'music.song'
    url?: string;
    siteName?: string;
    locale?: string; // 'vi_VN'
    localeAlternate?: string[]; // ['en_US', 'th_TH']
    determiner?: string; // 'a' | 'an' | 'the' | '' | 'auto'

    // Primary Image
    image?: string;
    imageSecureUrl?: string;
    imageType?: string; // 'image/jpeg' | 'image/png' | 'image/webp'
    imageWidth?: number;
    imageHeight?: number;
    imageAlt?: string;

    // Multiple Images
    images?: Array<{
      url: string;
      secureUrl?: string;
      type?: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;

    // Video
    video?: {
      url: string;
      secureUrl?: string;
      type?: string; // 'video/mp4'
      width?: number;
      height?: number;
    };

    // Audio
    audio?: {
      url: string;
      secureUrl?: string;
      type?: string; // 'audio/mpeg'
    };

    // Article metadata
    article?: {
      publishedTime?: string;
      modifiedTime?: string;
      expirationTime?: string;
      author?: string[];
      section?: string;
      tags?: string[];
    };

    // Facebook Integration
    fbAppId?: string;
    fbAdmins?: string[];
  };

  // Twitter Card
  @Property({ type: 'json', nullable: true })
  twitterCard?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    site?: string; // @ergvietnam
    creator?: string; // @authorhandle
    title?: string;
    description?: string;
    image?: string;
    imageAlt?: string;
    player?: {
      url?: string;
      width?: number;
      height?: number;
    };
  };

  // Advanced Schema Data
  @Property({ nullable: true })
  breadcrumbTitle?: string; // Custom title for breadcrumbs

  @Property({ type: 'json', nullable: true })
  faqItems?: Array<{
    question: string;
    answer: string;
  }>;

  @Property({ type: 'json', nullable: true })
  howToSteps?: Array<{
    name: string;
    text: string;
    image?: string;
    url?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  introVideo?: {
    name: string;
    description: string;
    thumbnailUrl: string;
    uploadDate: string;
    contentUrl: string;
  };

  // --- SOFT DELETE ---
  @Property({ nullable: true })
  deletedAt?: Date;

  [OptionalProps]?: 'seoScore' | 'readabilityScore' | 'keywordDensity' | 'viewCount' | 'commentCount' | 'isCreatedByAI' | 'isPublished' | 'robotsIndex' | 'robotsFollow' | 'robotsAdvanced';
}

export enum SchemaType {
  ARTICLE = 'Article',
  NEWS_ARTICLE = 'NewsArticle',
  BLOG_POSTING = 'BlogPosting',
  COURSE = 'Course',
  JOB_POSTING = 'JobPosting',
  EVENT = 'Event',
  PRODUCT = 'Product',
}
