import { MikroORM } from '@mikro-orm/core';
import config from './src/config/mikro-orm-mysql.config';

async function run() {
    console.log('Initializing ORM...');
    const orm = await MikroORM.init(config);
    const em = orm.em.getConnection();

    try {
        console.log('🚀 Running SEO Phase 2 Migration...');

        // 1. Create table seo_keywords
        console.log('Creating table seo_keywords...');
        await em.execute(`
            CREATE TABLE IF NOT EXISTS seo_keywords (
                id VARCHAR(255) NOT NULL PRIMARY KEY,
                keyword VARCHAR(100) NOT NULL UNIQUE,
                target_url VARCHAR(500) NOT NULL,
                link_limit INT DEFAULT 1 CHECK (link_limit >= 1),
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_by VARCHAR(255) NULL,
                CONSTRAINT fk_seo_keywords_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
        `);

        // Index (Check if exists first or ignore error)
        try {
            await em.execute(`CREATE INDEX idx_seo_keywords_keyword ON seo_keywords(keyword);`);
            console.log('Index created.');
        } catch (e) {
            console.log('Index creation skipped (might exist).');
        }

        // 2. Add column schema_data to posts
        console.log('Adding column schema_data to posts table...');
        try {
            await em.execute(`ALTER TABLE posts ADD COLUMN schema_data JSON NULL;`);
            console.log('Column schema_data added.');
        } catch (e: any) {
            if (e.message && e.message.includes('Duplicate column name')) {
                console.log('Column schema_data already exists.');
            } else {
                console.error('Error adding column:', e.message);
            }
        }

        console.log('🎉 Migration completed successfully!');
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await orm.close();
    }
}

run();
