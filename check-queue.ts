import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASS,
});

async function checkQueue() {
    try {
        console.log('=== Checking BullMQ Queue Status ===\n');

        // Check waiting jobs
        const waitingCount = await redis.llen('bull:crawler:wait');
        console.log(`📋 Waiting jobs: ${waitingCount}`);

        // Check active jobs  
        const activeCount = await redis.llen('bull:crawler:active');
        console.log(`⚡ Active jobs: ${activeCount}`);

        // Check failed jobs
        const failedCount = await redis.zcard('bull:crawler:failed');
        console.log(`❌ Failed jobs: ${failedCount}`);

        // Check completed jobs
        const completedCount = await redis.zcard('bull:crawler:completed');
        console.log(`✅ Completed jobs: ${completedCount}`);

        // Check delayed jobs
        const delayedCount = await redis.zcard('bull:crawler:delayed');
        console.log(`⏰ Delayed jobs: ${delayedCount}`);

        // Get some job details
        console.log('\n=== Recent Job Details ===');
        const keys = await redis.keys('bull:crawler:*manual-crawl-*');
        console.log(`Found ${keys.length} manual crawl job keys`);

        for (const key of keys.slice(0, 5)) {
            const data = await redis.get(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`\n${key}:`);
                    console.log(`  Status: ${parsed.finishedOn ? 'COMPLETED' : parsed.failedReason ? 'FAILED' : 'ACTIVE'}`);
                    console.log(`  URL: ${parsed.data?.url || 'N/A'}`);
                } catch (e) {
                    console.log(`  [Cannot parse]`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        redis.disconnect();
    }
}

checkQueue();
