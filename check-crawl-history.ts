import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkCrawlHistory() {
    const client = new MongoClient(process.env.MONGO_URL!);

    try {
        await client.connect();
        const db = client.db(process.env.MONGO_DB_NAME);
        const collection = db.collection('crawl_histories');

        console.log('=== Recent Crawl History ===\n');

        // Get last 5 crawl attempts
        const results = await collection
            .find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();

        results.forEach((item, index) => {
            console.log(`${index + 1}. ${item.url}`);
            console.log(`   Status: ${item.status}`);
            console.log(`   Post ID: ${item.postId || 'N/A'}`);
            console.log(`   Error: ${item.errorMessage || 'N/A'}`);
            console.log(`   Time: ${item.createdAt}`);
            console.log('');
        });

        // Check specifically for the 3 URLs from the recent request
        console.log('\n=== Checking 3 Specific URLs ===\n');
        const urls = [
            'https://giaoducthoidai.vn/anh-co-sieu-dai-hoc-dau-tien-post766674.html',
            'https://giaoducthoidai.vn/thuoc-do-van-hoa-nghe-giao-post766648.html',
            'https://giaoducthoidai.vn/quy-tac-ung-xu-nha-giao-chuan-muc-moi-cho-van-hoa-hoc-duong-post766647.html'
        ];

        for (const url of urls) {
            const history = await collection.findOne({ url });
            console.log(`URL: ${url.split('/').pop()}`);
            if (history) {
                console.log(`  ✅ Found in history`);
                console.log(`  Status: ${history.status}`);
                console.log(`  Post ID: ${history.postId || 'N/A'}`);
                console.log(`  Error: ${history.errorMessage || 'N/A'}`);
            } else {
                console.log(`  ❌ NOT FOUND in crawl history`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkCrawlHistory();
