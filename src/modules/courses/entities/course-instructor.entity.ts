import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Course } from '@/modules/courses/entities/course.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'course_instructors' })
export class CourseInstructor extends BaseEntity {
  @ManyToOne(() => Course)
  course!: Course;

  @ManyToOne(() => User)
  instructor!: User;

  @Property({ default: false })
  isMain: boolean = false;
}
