import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mysqlConfig from '@/config/mikro-orm-mysql.config';
import mongoConfig from '@/config/mikro-orm-mongo.config';

// Organization entities (no dedicated module)
import { Department } from '@/modules/organization/entities/department.entity';
import { JobPosition } from '@/modules/organization/entities/job-position.entity';
import { Region } from '@/modules/organization/entities/region.entity';
import { School } from '@/modules/organization/entities/school.entity';

// Profile & Social entities
import { TeacherProfile } from '@/modules/profiles/entities/profile.entity';
import { Certificate } from '@/modules/profiles/entities/certificate.entity';
import { SocialAccount } from '@/modules/users/entities/social-account.entity';

// Operations entities missing from OperationsModule
import { WorkShift } from '@/modules/operations/entities/work-shift.entity';

// Course entities missing from CoursesModule
import { CourseProgress } from '@/modules/courses/entities/course-progress.entity';

// SEO entities missing from SeoModule
import { Redirect } from '@/modules/seo/entities/redirect.entity';
import { SeoMetadata } from '@/modules/seo/entities/seo-metadata.entity';

@Global()
@Module({
  imports: [
    // 1. Kết nối MySQL
    MikroOrmModule.forRoot({
      ...mysqlConfig,
      autoLoadEntities: true,
    }),

    // 2. Register entities that have no dedicated feature module
    MikroOrmModule.forFeature([
      Department, JobPosition, Region, School,
      TeacherProfile, Certificate, SocialAccount,
      WorkShift,
      CourseProgress,
      Redirect, SeoMetadata,
    ]),

    // 3. Kết nối MongoDB
    MikroOrmModule.forRoot({
      ...mongoConfig,
      contextName: 'mongo-connection',
      autoLoadEntities: false,
    }),
  ],
  // Export repositories of globally-needed entities
  exports: [MikroOrmModule],
})
export class DatabaseModule { }
