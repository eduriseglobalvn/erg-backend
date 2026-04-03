import { Migration } from '@mikro-orm/migrations';

export class Migration20260227165136 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`course_lessons\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`syllabus_id\` varchar(255) not null, \`order_index\` int not null, \`title\` varchar(255) not null, \`content\` text null, \`video_url\` varchar(255) null, \`is_free_preview\` tinyint(1) not null default false, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`course_lessons\` add index \`course_lessons_syllabus_id_index\`(\`syllabus_id\`);`);

    this.addSql(`create table \`course_enrollments\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`course_id\` varchar(255) not null, \`user_id\` varchar(255) not null, \`status\` enum('active', 'completed', 'canceled', 'expired') not null default 'active', \`progress\` float not null default 0, \`enrolled_at\` datetime null, \`completed_at\` datetime null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`course_enrollments\` add index \`course_enrollments_course_id_index\`(\`course_id\`);`);
    this.addSql(`alter table \`course_enrollments\` add index \`course_enrollments_user_id_index\`(\`user_id\`);`);

    this.addSql(`alter table \`course_lessons\` add constraint \`course_lessons_syllabus_id_foreign\` foreign key (\`syllabus_id\`) references \`course_syllabus\` (\`id\`) on update cascade;`);

    this.addSql(`alter table \`course_enrollments\` add constraint \`course_enrollments_course_id_foreign\` foreign key (\`course_id\`) references \`courses\` (\`id\`) on update cascade;`);
    this.addSql(`alter table \`course_enrollments\` add constraint \`course_enrollments_user_id_foreign\` foreign key (\`user_id\`) references \`users\` (\`id\`) on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`course_lessons\`;`);

    this.addSql(`drop table if exists \`course_enrollments\`;`);
  }

}
