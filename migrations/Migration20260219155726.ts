import { Migration } from '@mikro-orm/migrations';

export class Migration20260219155726 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`jobs\` add \`is_hot\` tinyint(1) not null default false, add \`is_new\` tinyint(1) not null default false, add \`is_urgent\` tinyint(1) not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`jobs\` drop column \`is_hot\`, drop column \`is_new\`, drop column \`is_urgent\`;`);
  }

}
