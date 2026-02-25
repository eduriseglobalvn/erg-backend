import { MikroORM } from '@mikro-orm/core';
import mikroOrmConfig from './src/config/mikro-orm-mysql.config';

async function checkApiKey() {
    const orm = await MikroORM.init(mikroOrmConfig);
    const em = orm.em.getConnection();

    try {
        const targetKey = 'AIzaSyCpEb1Ck9Fa6_NEC5XifjsYPHTNAQlfFUM';

        console.log(`🔍 Checking for API key: ${targetKey}\n`);

        const result = await em.execute(
            'SELECT * FROM api_keys WHERE `key` = ?',
            [targetKey]
        );

        if (result.length === 0) {
            console.log('❌ Key NOT FOUND in database - It has been completely deleted');
        } else {
            console.log('✅ Key FOUND in database:\n');
            const key = result[0];
            console.log(`  ID: ${key.id}`);
            console.log(`  Label: ${key.label || 'N/A'}`);
            console.log(`  Type: ${key.type}`);
            console.log(`  Status: ${key.status}`);
            console.log(`  Owner ID: ${key.owner_id || 'N/A'}`);
            console.log(`  Last error: ${key.last_error_message || 'N/A'}`);
            console.log(`  Cooldown until: ${key.cooldown_until || 'N/A'}`);
            console.log(`  Today usage: ${key.today_usage}`);
            console.log(`  Created at: ${key.created_at}`);
            console.log(`  Updated at: ${key.updated_at}`);
        }

        // Also check all keys to see what's available
        console.log('\n📋 All API keys in database:\n');
        const allKeys = await em.execute('SELECT `key`, `status`, `type`, `label` FROM api_keys');
        allKeys.forEach((k, i) => {
            console.log(`${i + 1}. [${k.type}] ${k.key.substring(0, 20)}... | Status: ${k.status} | Label: ${k.label || 'N/A'}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await orm.close();
    }
}

checkApiKey();
