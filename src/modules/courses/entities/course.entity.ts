import {
  Entity,
  Property,
  OneToMany,
  Collection,
  Enum,
  Cascade,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import type { User } from '@/modules/users/entities/user.entity';
import { CourseStatus } from '@/shared/enums/app.enum';
import type { CourseSyllabus } from '@/modules/courses/entities/course-syllabus.entity';
import { IsUrl, IsOptional } from 'class-validator';

@Entity({ tableName: 'courses' })
@Index({ properties: ['status', 'subdomain'] })
export class Course extends BaseEntity {
  @Property()
  title!: string;

  @Property({ unique: true })
  slug!: string;

  @Property({ unique: true })
  code!: string;

  // Thay vì @ManyToOne Subject, ta dùng cột category trực tiếp
  @Property({ default: 'General' })
  category!: string; // Ví dụ: 'MOS', 'IC3', 'English'

  @Property({ type: 'text', nullable: true })
  summary?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number = 0;

  @Enum(() => CourseStatus)
  status: CourseStatus = CourseStatus.DRAFT;

  @Property({ type: 'float', default: 0 })
  averageRating: number = 0;

  @Property({ default: 0 })
  totalReviews: number = 0;

  @Property({ default: 0 })
  viewCount: number = 0;

  // --- SUBDOMAIN & THEMING ---
  @Property({ nullable: true })
  subdomain?: string; // Ví dụ: 'mos', 'ielts' => mos.domain.com

  @Property({ type: 'json', nullable: true })
  themeConfig?: {
    primaryColor?: string;
    logoUrl?: string;
    bannerUrl?: string;
    fontFamily?: string;
  };

  // --- SCHEMA.ORG FIELDS ---
  @Property({ nullable: true })
  courseMode?: string; // 'Online', 'Onsite', 'Blended'

  @Property({ nullable: true })
  courseWorkload?: string; // e.g. 'PT40H'

  @Property({ nullable: true })
  educationalLevel?: string; // e.g. 'Beginner', 'Advanced'

  @Property({ default: 'vi-VN' })
  inLanguage: string = 'vi-VN';

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  offersPrice?: number;

  @Property({ default: 'VND' })
  offersCurrency: string = 'VND';

  @Property({ nullable: true })
  instructorName?: string;

  // --- SEO ---
  @Property({ nullable: true })
  metaTitle?: string;

  @Property({ type: 'text', nullable: true })
  metaDescription?: string;

  @Property({ type: 'json', nullable: true })
  seoKeywords?: string[];

  @Property({ nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Canonical URL must be a valid URL' })
  canonicalUrl?: string;

  @ManyToOne('User')
  createdBy!: User;

  @OneToMany('CourseSyllabus', (item: any) => item.course, {
    cascade: [Cascade.ALL],
  })
  syllabus = new Collection<CourseSyllabus>(this);
}
