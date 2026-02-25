import { Migration } from '@mikro-orm/migrations';

export class Migration20260210_AddAdvancedSeoFields extends Migration {

    async up(): Promise<void> {
        // Add advanced SEO fields to posts table
        this.addSql(`
      ALTER TABLE \`posts\` 
      ADD COLUMN \`schema_markup\` JSON NULL COMMENT 'Full JSON-LD schema graph',
      ADD COLUMN \`enabled_schema_types\` JSON NULL COMMENT 'Array of enabled schema types',
      ADD COLUMN \`robots_meta\` JSON NULL COMMENT 'Robots meta directives',
      ADD COLUMN \`open_graph\` JSON NULL COMMENT 'Open Graph metadata (Facebook, LinkedIn, Zalo)',
      ADD COLUMN \`twitter_card\` JSON NULL COMMENT 'Twitter Card metadata',
      ADD COLUMN \`breadcrumb_title\` VARCHAR(255) NULL COMMENT 'Custom breadcrumb title',
      ADD COLUMN \`faq_items\` JSON NULL COMMENT 'FAQ schema items',
      ADD COLUMN \`how_to_steps\` JSON NULL COMMENT 'HowTo schema steps',
      ADD COLUMN \`readability_score\` INT DEFAULT 0 COMMENT 'Content readability score (0-100)',
      ADD COLUMN \`keyword_density\` DECIMAL(5,4) DEFAULT 0 COMMENT 'Focus keyword density'
    `);

        // Create SEO history table
        this.addSql(`
      CREATE TABLE \`seo_history\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`post_id\` VARCHAR(36) NOT NULL,
        \`seo_score\` INT NOT NULL,
        \`readability_score\` INT NOT NULL,
        \`keyword_density\` DECIMAL(5,4) NOT NULL,
        \`word_count\` INT NOT NULL,
        \`suggestions\` JSON NOT NULL,
        \`metadata\` JSON NULL COMMENT 'Links, images, headings analysis',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
        INDEX \`idx_seo_history_post_id\` (\`post_id\`),
        INDEX \`idx_seo_history_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        // Create schema templates table
        this.addSql(`
      CREATE TABLE \`schema_templates\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`schema_type\` VARCHAR(50) NOT NULL,
        \`template\` JSON NOT NULL,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_by_id\` VARCHAR(36) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`created_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
        INDEX \`idx_schema_templates_type\` (\`schema_type\`),
        INDEX \`idx_schema_templates_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        // Create Google Search Console integration table
        this.addSql(`
      CREATE TABLE \`google_search_console\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`post_id\` VARCHAR(36) NOT NULL,
        \`url\` VARCHAR(500) NOT NULL,
        \`clicks\` INT DEFAULT 0,
        \`impressions\` INT DEFAULT 0,
        \`ctr\` DECIMAL(5,4) DEFAULT 0 COMMENT 'Click-through rate',
        \`position\` DECIMAL(5,2) DEFAULT 0 COMMENT 'Average position in search results',
        \`date\` DATE NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`unique_post_date\` (\`post_id\`, \`date\`),
        INDEX \`idx_gsc_post_id\` (\`post_id\`),
        INDEX \`idx_gsc_date\` (\`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        // Add indexes for better query performance
        this.addSql(`
      CREATE INDEX \`idx_posts_seo_score\` ON \`posts\` (\`seo_score\`);
    `);

        this.addSql(`
      CREATE INDEX \`idx_posts_readability_score\` ON \`posts\` (\`readability_score\`);
    `);
    }

    async down(): Promise<void> {
        // Drop tables
        this.addSql('DROP TABLE IF EXISTS `google_search_console`');
        this.addSql('DROP TABLE IF EXISTS `schema_templates`');
        this.addSql('DROP TABLE IF EXISTS `seo_history`');

        // Remove columns from posts
        this.addSql(`
      ALTER TABLE \`posts\`
      DROP COLUMN \`schema_markup\`,
      DROP COLUMN \`enabled_schema_types\`,
      DROP COLUMN \`robots_meta\`,
      DROP COLUMN \`open_graph\`,
      DROP COLUMN \`twitter_card\`,
      DROP COLUMN \`breadcrumb_title\`,
      DROP COLUMN \`faq_items\`,
      DROP COLUMN \`how_to_steps\`,
      DROP COLUMN \`readability_score\`,
      DROP COLUMN \`keyword_density\`
    `);

        // Drop indexes
        this.addSql('DROP INDEX `idx_posts_readability_score` ON `posts`');
        this.addSql('DROP INDEX `idx_posts_seo_score` ON `posts`');
    }
}
