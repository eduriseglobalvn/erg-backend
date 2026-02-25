import { Migration } from '@mikro-orm/migrations';

export class Migration20260224020425 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`candidates\` add \`public_note\` text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`candidates\` drop column \`public_note\`;`);
  }

}
