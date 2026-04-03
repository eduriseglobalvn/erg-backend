import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import type { CourseSyllabus } from './course-syllabus.entity';

@Entity({ tableName: 'course_lessons' })
export class CourseLesson extends BaseEntity {
    @ManyToOne('CourseSyllabus')
    syllabus!: CourseSyllabus;

    @Property()
    orderIndex!: number;

    @Property()
    title!: string; // Tên bài học (VD: Bài 1 - Giới thiệu IF)

    @Property({ type: 'text', nullable: true })
    content?: string; // Nội dung bài giảng (có thể là HTML hoặc Markdown)

    @Property({ nullable: true })
    videoUrl?: string; // Link video (nếu có)

    @Property({ type: 'boolean', default: false })
    isFreePreview: boolean = false; // Học thử miễn phí
}
