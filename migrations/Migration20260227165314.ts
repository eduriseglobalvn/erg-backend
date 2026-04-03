import { Migration } from '@mikro-orm/migrations';

export class Migration20260227165314 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`courses\` add \`subdomain\` varchar(255) null, add \`theme_config\` json null, add \`meta_title\` varchar(255) null, add \`meta_description\` text null, add \`seo_keywords\` json null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`courses\` drop column \`subdomain\`, drop column \`theme_config\`, drop column \`meta_title\`, drop column \`meta_description\`, drop column \`seo_keywords\`;`);
  }

}
