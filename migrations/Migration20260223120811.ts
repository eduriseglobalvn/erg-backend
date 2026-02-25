import { Migration } from '@mikro-orm/migrations';

export class Migration20260223120811 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`jobs\` add \`work_schedule\` varchar(255) null, add \`post_date\` varchar(255) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`jobs\` drop column \`work_schedule\`, drop column \`post_date\`;`);
  }

}
