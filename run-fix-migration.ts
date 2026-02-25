import { MikroORM } from '@mikro-orm/core';
import config from './src/config/mikro-orm-mysql.config';
import * as fs from 'fs';
import * as path from 'path';

async function runFixMigration() {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();

    try {
        console.log('Running FIX for posts table columns...');

        const commands = [
            "ALTER TABLE posts ADD COLUMN readability_score INT DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN keyword_density DECIMAL(5,4) DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN schema_data JSON NULL",
            "ALTER TABLE posts ADD COLUMN enabled_schema_types JSON NULL",
            "ALTER TABLE posts ADD COLUMN robots_index BOOLEAN DEFAULT TRUE",
            "ALTER TABLE posts ADD COLUMN robots_follow BOOLEAN DEFAULT TRUE",
            "ALTER TABLE posts ADD COLUMN robots_advanced VARCHAR(200) NULL",
            "ALTER TABLE posts ADD COLUMN breadcrumb_title VARCHAR(255) NULL",
            "ALTER TABLE posts ADD COLUMN faq_items JSON NULL",
            "ALTER TABLE posts ADD COLUMN how_to_steps JSON NULL",
            "ALTER TABLE posts ADD COLUMN schema_type ENUM('Article', 'NewsArticle', 'BlogPosting') NULL",
            "ALTER TABLE posts ADD COLUMN seo_score INT DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN schema_markup JSON NULL",
            "ALTER TABLE posts ADD COLUMN open_graph JSON NULL",
            "ALTER TABLE posts ADD COLUMN twitter_card JSON NULL",
            "ALTER TABLE posts ADD COLUMN robots_meta JSON NULL"
        ];

        for (const cmd of commands) {
            try {
                await em.execute(cmd);
                console.log(`Executed: ${cmd}`);
            } catch (err) {
                // Ignore "Column already exists" (error 1060)
                if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Skipped (exists): ${cmd}`);
                } else {
                    console.error(`Error executing ${cmd}:`, err.message);
                }
            }
        }

        console.log('Fix migration completed!');
    } catch (error) {

        console.error('Fix migration failed:', error);
    } finally {
        await orm.close();
    }
}

runFixMigration();
