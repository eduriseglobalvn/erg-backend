import { Entity, Property, ManyToOne, Index } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Course } from './course.entity';
import { CourseLesson } from './course-lesson.entity';

@Entity({ tableName: 'course_progress' })
@Index({ properties: ['user', 'course'] })
export class CourseProgress extends BaseEntity {
    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Course)
    course!: Course;

    @ManyToOne(() => CourseLesson)
    lesson!: CourseLesson;

    @Property({ type: 'boolean', default: false })
    isCompleted: boolean = false;

    @Property({ type: 'float', default: 0 })
    progressPercent: number = 0; // 0 to 100

    @Property({ nullable: true })
    completedAt?: Date;

    @Property({ nullable: true })
    lastAccessedAt?: Date;

    // Optional: For quizzes/exercises score
    @Property({ type: 'float', nullable: true })
    score?: number;
}
