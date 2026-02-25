import { MikroORM } from '@mikro-orm/core';
import config from './src/config/mikro-orm-mysql.config';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();

    try {
        console.log('Running OAuth tokens migration...');
        const sql = fs.readFileSync(path.join(__dirname, 'migrations/manual-oauth-tokens.sql'), 'utf8');
        await em.execute(sql);
        console.log('Migration successful!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await orm.close();
    }
}

runMigration();
