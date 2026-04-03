import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

// Entities
import { Course } from './entities/course.entity';
import { CourseSyllabus } from './entities/course-syllabus.entity';
import { CourseInstructor } from './entities/course-instructor.entity';
import { CourseLesson } from './entities/course-lesson.entity';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { SeoModule } from '@/modules/seo/seo.module';
import { ReviewsModule } from '@/modules/reviews/reviews.module';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            Course,
            CourseSyllabus,
            CourseInstructor,
            CourseLesson,
            CourseEnrollment,
        ]),
        SeoModule,
        ReviewsModule,
    ],
    controllers: [CoursesController],
    providers: [CoursesService],
    exports: [CoursesService],
})
export class CoursesModule { }
