import { Migration } from '@mikro-orm/migrations';

export class Migration20260214155113 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`oauth_tokens\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`service\` varchar(50) not null, \`access_token\` text not null, \`refresh_token\` text not null, \`expires_at\` datetime null, \`updated_at\` datetime not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`oauth_tokens\` add unique \`oauth_tokens_service_unique\`(\`service\`);`);

    this.addSql(`create table \`seo_404_logs\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`url\` varchar(500) not null, \`referer\` varchar(500) null, \`user_agent\` text null, \`hit_count\` int not null default 1, \`last_seen\` datetime not null, \`first_seen\` datetime not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`seo_404_logs\` add unique \`seo_404_logs_url_unique\`(\`url\`);`);

    this.addSql(`create table \`seo_configs\` (\`key\` varchar(255) not null, \`value\` json not null, \`updated_at\` datetime not null, \`updated_by\` varchar(255) null, primary key (\`key\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`seo_redirects\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`from_pattern\` varchar(500) not null, \`to_url\` varchar(500) not null, \`type\` varchar(3) not null default '301', \`is_regex\` tinyint(1) not null default false, \`is_active\` tinyint(1) not null default true, \`hit_count\` int not null default 0, \`created_by_id\` varchar(255) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`seo_redirects\` add index \`seo_redirects_created_by_id_index\`(\`created_by_id\`);`);

    this.addSql(`create table \`schema_templates\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`name\` varchar(255) not null, \`schema_type\` enum('Article', 'BlogPosting', 'NewsArticle', 'FAQPage', 'HowTo', 'BreadcrumbList', 'Organization', 'WebPage', 'Product', 'Course', 'Event', 'JobPosting', 'VideoObject', 'ImageObject', 'Review') not null, \`template\` json not null, \`is_active\` tinyint(1) not null default true, \`created_by_id\` varchar(255) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`schema_templates\` add index \`schema_templates_created_by_id_index\`(\`created_by_id\`);`);

    this.addSql(`create table \`seo_history\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`post_id\` varchar(255) not null, \`seo_score\` int not null, \`readability_score\` int not null, \`keyword_density\` numeric(5,4) not null, \`word_count\` int not null, \`suggestions\` json not null, \`metadata\` json null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`seo_history\` add index \`seo_history_post_id_index\`(\`post_id\`);`);

    this.addSql(`create table \`google_search_console\` (\`id\` varchar(255) not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`post_id\` varchar(255) not null, \`url\` varchar(500) not null, \`clicks\` int not null default 0, \`impressions\` int not null default 0, \`ctr\` numeric(5,4) not null default 0, \`position\` numeric(5,2) not null default 0, \`date\` date not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`google_search_console\` add index \`google_search_console_post_id_index\`(\`post_id\`);`);

    this.addSql(`alter table \`seo_redirects\` add constraint \`seo_redirects_created_by_id_foreign\` foreign key (\`created_by_id\`) references \`users\` (\`id\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`schema_templates\` add constraint \`schema_templates_created_by_id_foreign\` foreign key (\`created_by_id\`) references \`users\` (\`id\`) on update cascade on delete set null;`);

    this.addSql(`alter table \`seo_history\` add constraint \`seo_history_post_id_foreign\` foreign key (\`post_id\`) references \`posts\` (\`id\`) on update cascade;`);

    this.addSql(`alter table \`google_search_console\` add constraint \`google_search_console_post_id_foreign\` foreign key (\`post_id\`) references \`posts\` (\`id\`) on update cascade;`);

    this.addSql(`alter table \`seo_keywords\` drop foreign key \`fk_seo_keywords_created_by\`;`);

    this.addSql(`alter table \`seo_keywords\` drop index \`fk_seo_keywords_created_by\`;`);
    this.addSql(`alter table \`seo_keywords\` drop index \`idx_seo_keywords_keyword\`;`);
    this.addSql(`alter table \`seo_keywords\` drop constraint seo_keywords_chk_1;`);

    this.addSql(`alter table \`seo_keywords\` modify \`link_limit\` int not null default 1, modify \`is_active\` tinyint(1) not null default true, modify \`created_at\` datetime not null, modify \`updated_at\` datetime not null;`);
    this.addSql(`alter table \`seo_keywords\` change \`created_by\` \`created_by_id\` varchar(255) null;`);
    this.addSql(`alter table \`seo_keywords\` add constraint \`seo_keywords_created_by_id_foreign\` foreign key (\`created_by_id\`) references \`users\` (\`id\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`seo_keywords\` add index \`seo_keywords_created_by_id_index\`(\`created_by_id\`);`);
    this.addSql(`alter table \`seo_keywords\` drop index \`keyword\`;`);
    this.addSql(`alter table \`seo_keywords\` add unique \`seo_keywords_keyword_unique\`(\`keyword\`);`);

    this.addSql(`alter table \`posts\` add \`primary_image_id\` varchar(255) null, add \`related_posts_ids\` json null, add \`intro_video\` json null;`);
    this.addSql(`alter table \`posts\` modify \`schema_type\` enum('Article', 'NewsArticle', 'BlogPosting', 'Course', 'JobPosting', 'Event', 'Product'), modify \`readability_score\` int not null default 0, modify \`keyword_density\` numeric(5,4) not null default 0, modify \`robots_index\` tinyint(1) not null default true, modify \`robots_follow\` tinyint(1) not null default true;`);

    this.addSql(`alter table \`courses\` modify \`price\` numeric(10,2) not null default 0;`);

    this.addSql(`alter table \`work_shifts\` modify \`remuneration\` numeric(10,2) not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`oauth_tokens\`;`);

    this.addSql(`drop table if exists \`seo_404_logs\`;`);

    this.addSql(`drop table if exists \`seo_configs\`;`);

    this.addSql(`drop table if exists \`seo_redirects\`;`);

    this.addSql(`drop table if exists \`schema_templates\`;`);

    this.addSql(`drop table if exists \`seo_history\`;`);

    this.addSql(`drop table if exists \`google_search_console\`;`);

    this.addSql(`alter table \`seo_keywords\` drop foreign key \`seo_keywords_created_by_id_foreign\`;`);

    this.addSql(`alter table \`courses\` modify \`price\` decimal(10,2) not null default 0.00;`);

    this.addSql(`alter table \`posts\` drop column \`primary_image_id\`, drop column \`related_posts_ids\`, drop column \`intro_video\`;`);

    this.addSql(`alter table \`posts\` modify \`schema_type\` enum('Article', 'NewsArticle', 'BlogPosting'), modify \`readability_score\` int null default 0, modify \`keyword_density\` decimal(5,4) null default 0.0000, modify \`robots_index\` tinyint(1) null default true, modify \`robots_follow\` tinyint(1) null default true;`);

    this.addSql(`alter table \`seo_keywords\` drop index \`seo_keywords_created_by_id_index\`;`);

    this.addSql(`alter table \`seo_keywords\` modify \`created_at\` datetime null default CURRENT_TIMESTAMP, modify \`updated_at\` datetime null default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP, modify \`link_limit\` int null default 1, modify \`is_active\` tinyint(1) null default true;`);
    this.addSql(`alter table \`seo_keywords\` change \`created_by_id\` \`created_by\` varchar(255) null;`);
    this.addSql(`alter table \`seo_keywords\` add constraint \`fk_seo_keywords_created_by\` foreign key (\`created_by\`) references \`users\` (\`id\`) on update no action on delete set null;`);
    this.addSql(`alter table \`seo_keywords\` add index \`fk_seo_keywords_created_by\`(\`created_by\`);`);
    this.addSql(`alter table \`seo_keywords\` add index \`idx_seo_keywords_keyword\`(\`keyword\`);`);
    this.addSql(`alter table \`seo_keywords\` drop index \`seo_keywords_keyword_unique\`;`);
    this.addSql(`alter table \`seo_keywords\` add unique \`keyword\`(\`keyword\`);`);
    this.addSql(`alter table \`seo_keywords\` add constraint seo_keywords_chk_1 check(\`link_limit\` >= 1);`);

    this.addSql(`alter table \`work_shifts\` modify \`remuneration\` decimal(10,2) not null default 0.00;`);
  }

}
