import { Migration } from '@mikro-orm/migrations';

export class Migration20260219160357 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`jobs\` add \`view_count\` int not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`jobs\` drop column \`view_count\`;`);
  }

}
