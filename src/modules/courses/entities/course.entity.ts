import {
  Entity,
  Property,
  OneToMany,
  Collection,
  Enum,
  Cascade,
  ManyToOne,
} from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { CourseStatus } from '@/shared/enums/app.enum';
import { CourseSyllabus } from '@/modules/courses/entities/course-syllabus.entity';

@Entity({ tableName: 'courses' })
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

  @ManyToOne(() => User)
  createdBy!: User;

  @OneToMany(() => CourseSyllabus, (item) => item.course, {
    cascade: [Cascade.ALL],
  })
  syllabus = new Collection<CourseSyllabus>(this);
}
