import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Course } from '@/modules/courses/entities/course.entity';

@Entity({ tableName: 'course_syllabus' })
export class CourseSyllabus extends BaseEntity {
  @ManyToOne(() => Course)
  course!: Course;

  @Property()
  orderIndex!: number;

  @Property()
  topicTitle!: string; // Tên chủ đề buổi học (VD: Buổi 1 - Làm quen hàm IF)

  @Property({ type: 'text', nullable: true })
  topicDescription?: string; // Mô tả giáo trình buổi đó dạy gì
}