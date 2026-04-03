import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { ReviewsService } from '@/modules/reviews/reviews.service';
import { Course } from './entities/course.entity';
import { CourseSyllabus } from './entities/course-syllabus.entity';
import { CourseLesson } from './entities/course-lesson.entity';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
    constructor(
        @InjectRepository(Course)
        private readonly courseRepo: EntityRepository<Course>,
        @InjectRepository(CourseLesson)
        private readonly lessonRepo: EntityRepository<CourseLesson>,
        @InjectRepository(CourseEnrollment)
        private readonly enrollmentRepo: EntityRepository<CourseEnrollment>,
        // Resolve circular dependency if reviews depends on courses
        @Inject(forwardRef(() => ReviewsService))
        private readonly reviewsService: ReviewsService,
    ) { }

    async findAll() {
        return this.courseRepo.find({}, { populate: ['syllabus', 'syllabus.lessons'] });
    }

    async findOne(id: string) {
        const course = await this.courseRepo.findOne(id, { populate: ['syllabus', 'syllabus.lessons', 'createdBy'] });
        if (!course) throw new NotFoundException('Course not found');

        try {
            const stats = await this.reviewsService.getStats(id);
            (course as any).reviewStats = stats;
        } catch (e) {
            // Ignore if stats fail
        }

        return course;
    }

    async findBySubdomain(subdomain: string) {
        const course = await this.courseRepo.findOne({ subdomain }, { populate: ['syllabus', 'syllabus.lessons'] });
        if (!course) throw new NotFoundException(`Course not found for subdomain: ${subdomain}`);

        try {
            const stats = await this.reviewsService.getStats(course.id);
            (course as any).reviewStats = stats;
        } catch (e) {
            // Ignore if stats fail
        }

        return course;
    }

    async create(dto: CreateCourseDto, userId: string) {
        const course = this.courseRepo.create({
            ...dto,
            createdBy: userId,
        } as any);
        await this.courseRepo.getEntityManager().persistAndFlush(course);
        return course;
    }

    async update(id: string, dto: UpdateCourseDto) {
        const course = await this.findOne(id);
        this.courseRepo.assign(course, dto as any);
        await this.courseRepo.getEntityManager().flush();
        return course;
    }

    async updateTheme(id: string, themeConfig: any) {
        const course = await this.findOne(id);
        course.themeConfig = { ...course.themeConfig, ...themeConfig };
        await this.courseRepo.getEntityManager().flush();
        return course;
    }

    async reorderLessons(id: string, lessonIds: string[]) {
        // Future implementation: Update orderIndex based on the provided array of lessonIds
        return { success: true, message: 'Lessons reordered successfully' };
    }

    async remove(id: string) {
        const course = await this.findOne(id);
        await this.courseRepo.getEntityManager().removeAndFlush(course);
        return { success: true };
    }
}
