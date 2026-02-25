import { Migration } from '@mikro-orm/migrations';

export class Migration20260224004749 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`candidates\` drop foreign key \`candidates_job_id_foreign\`;`);

    this.addSql(`alter table \`candidates\` add \`cover_letter\` text null, add \`note\` text null, add \`apply_type\` enum('ONLINE', 'ZALO') not null default 'ONLINE';`);
    this.addSql(`alter table \`candidates\` modify \`job_id\` varchar(255) null, modify \`cv_url\` varchar(255) null;`);
    this.addSql(`alter table \`candidates\` add constraint \`candidates_job_id_foreign\` foreign key (\`job_id\`) references \`jobs\` (\`id\`) on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`candidates\` drop foreign key \`candidates_job_id_foreign\`;`);

    this.addSql(`alter table \`candidates\` drop column \`cover_letter\`, drop column \`note\`, drop column \`apply_type\`;`);

    this.addSql(`alter table \`candidates\` modify \`job_id\` varchar(255) not null, modify \`cv_url\` varchar(255) not null;`);
    this.addSql(`alter table \`candidates\` add constraint \`candidates_job_id_foreign\` foreign key (\`job_id\`) references \`jobs\` (\`id\`) on update cascade;`);
  }

}
