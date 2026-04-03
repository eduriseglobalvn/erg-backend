import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Course } from './course.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum EnrollmentStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    CANCELED = 'canceled',
    EXPIRED = 'expired',
}

@Entity({ tableName: 'course_enrollments' })
export class CourseEnrollment extends BaseEntity {
    @ManyToOne(() => Course)
    course!: Course;

    @ManyToOne(() => User)
    user!: User;

    @Enum(() => EnrollmentStatus)
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE;

    @Property({ type: 'float', default: 0 })
    progress: number = 0; // % hoàn thành khóa học

    @Property({ nullable: true })
    enrolledAt?: Date = new Date(); // Ngày đăng ký

    @Property({ nullable: true })
    completedAt?: Date; // Ngày hoàn thành
}
