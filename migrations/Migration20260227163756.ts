import { Migration } from '@mikro-orm/migrations';

export class Migration20260227163756 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`permission_groups\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`name\` varchar(255) not null, \`label\` varchar(255) not null, \`icon\` varchar(255) null, \`sort_order\` int not null default 0, \`feature_flags\` json null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`permission_groups\` add unique \`permission_groups_name_unique\`(\`name\`);`);

    this.addSql(`create table \`permission_groups_permissions\` (\`permission_group_id\` varchar(255) not null, \`permission_id\` varchar(255) not null, primary key (\`permission_group_id\`, \`permission_id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`permission_groups_permissions\` add index \`permission_groups_permissions_permission_group_id_index\`(\`permission_group_id\`);`);
    this.addSql(`alter table \`permission_groups_permissions\` add index \`permission_groups_permissions_permission_id_index\`(\`permission_id\`);`);

    this.addSql(`create table \`user_permissions\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_id\` varchar(255) not null, \`permission_id\` varchar(255) not null, \`action\` enum('GRANT', 'DENY') not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`user_permissions\` add index \`user_permissions_user_id_index\`(\`user_id\`);`);
    this.addSql(`alter table \`user_permissions\` add index \`user_permissions_permission_id_index\`(\`permission_id\`);`);

    this.addSql(`alter table \`permission_groups_permissions\` add constraint \`permission_groups_permissions_permission_group_id_foreign\` foreign key (\`permission_group_id\`) references \`permission_groups\` (\`id\`) on update cascade on delete cascade;`);
    this.addSql(`alter table \`permission_groups_permissions\` add constraint \`permission_groups_permissions_permission_id_foreign\` foreign key (\`permission_id\`) references \`permissions\` (\`id\`) on update cascade on delete cascade;`);

    this.addSql(`alter table \`user_permissions\` add constraint \`user_permissions_user_id_foreign\` foreign key (\`user_id\`) references \`users\` (\`id\`) on update cascade;`);
    this.addSql(`alter table \`user_permissions\` add constraint \`user_permissions_permission_id_foreign\` foreign key (\`permission_id\`) references \`permissions\` (\`id\`) on update cascade;`);

    this.addSql(`alter table \`users\` add \`date_of_birth\` datetime null, add \`gender\` varchar(255) null, add \`address\` varchar(255) null, add \`city\` varchar(255) null, add \`district\` varchar(255) null, add \`social_links\` json null, add \`last_login_at\` datetime null, add \`login_count\` int not null default 0, add \`notes\` text null, add \`preferences\` json null;`);

    this.addSql(`alter table \`posts\` add index \`posts_is_published_index\`(\`is_published\`);`);
    this.addSql(`alter table \`posts\` add index \`posts_published_at_index\`(\`published_at\`);`);
    this.addSql(`alter table \`posts\` add index \`posts_ai_job_id_index\`(\`ai_job_id\`);`);
    this.addSql(`alter table \`posts\` add index \`posts_deleted_at_index\`(\`deleted_at\`);`);

    this.addSql(`alter table \`api_keys\` add \`provider\` enum('gemini', 'openai', 'groq', 'claude') not null default 'gemini';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`permission_groups_permissions\` drop foreign key \`permission_groups_permissions_permission_group_id_foreign\`;`);

    this.addSql(`drop table if exists \`permission_groups\`;`);

    this.addSql(`drop table if exists \`permission_groups_permissions\`;`);

    this.addSql(`drop table if exists \`user_permissions\`;`);

    this.addSql(`alter table \`users\` drop column \`date_of_birth\`, drop column \`gender\`, drop column \`address\`, drop column \`city\`, drop column \`district\`, drop column \`social_links\`, drop column \`last_login_at\`, drop column \`login_count\`, drop column \`notes\`, drop column \`preferences\`;`);

    this.addSql(`alter table \`posts\` drop index \`posts_is_published_index\`;`);
    this.addSql(`alter table \`posts\` drop index \`posts_published_at_index\`;`);
    this.addSql(`alter table \`posts\` drop index \`posts_ai_job_id_index\`;`);
    this.addSql(`alter table \`posts\` drop index \`posts_deleted_at_index\`;`);

    this.addSql(`alter table \`api_keys\` drop column \`provider\`;`);
  }

}
