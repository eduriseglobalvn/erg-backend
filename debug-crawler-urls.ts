import { MikroORM } from '@mikro-orm/core';
import mysqlConfig from './src/config/mikro-orm-mysql.config';
import mongoConfig from './src/config/mikro-orm-mongo.config';
import { Post } from './src/modules/posts/entities/post.entity';
import { CrawlHistory } from './src/modules/crawler/entities/crawl-history.entity';

async function run() {
    const mysqlOrm = await MikroORM.init(mysqlConfig);
    const mongoOrm = await MikroORM.init(mongoConfig);

    const em = mysqlOrm.em.fork();
    const mongoEm = mongoOrm.em.fork();

    const urls = [
        "https://giaoducthoidai.vn/dai-hoc-thai-nguyen-thanh-lap-phan-hieu-tai-dien-bien-post766738.html",
        "https://giaoducthoidai.vn/lai-chau-kien-nghi-bo-sung-nguon-von-de-xay-dung-truong-noi-tru-lien-cap-post766728.html",
        "https://giaoducthoidai.vn/tinh-son-la-quyet-tam-som-hoan-thanh-xay-dung-cac-truong-lien-cap-post766716.html"
    ];

    console.log('--- Checking Crawl History (MongoDB) ---');
    for (const url of urls) {
        const history = await mongoEm.findOne(CrawlHistory, { url });
        console.log(`URL: ${url}`);
        console.log(`- Status: ${history?.status || 'NOT FOUND'}`);
        console.log(`- PostID: ${history?.postId || 'N/A'}`);
        console.log(`- Error: ${history?.errorMessage || 'None'}`);

        if (history?.postId) {
            const post = await em.findOne(Post, { id: history.postId });
            console.log(`- Post in MySQL: ${post ? 'YES (' + post.title + ')' : 'NO'}`);
        }
    }

    console.log('\n--- Checking Recent Posts (MySQL) ---');
    const recent = await em.find(Post, {}, { limit: 10, orderBy: { createdAt: 'DESC' } });
    recent.forEach(p => {
        console.log(`- ID: ${p.id} | Title: ${p.title} | CreatedAt: ${p.createdAt} | Slug: ${p.slug}`);
    });

    await mysqlOrm.close();
    await mongoOrm.close();
}

run().catch(console.error);
