import { MikroORM } from '@mikro-orm/core';
import config from './src/config/mikro-orm-mysql.config';
import { Post } from './src/modules/posts/entities/post.entity';

async function run() {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();
    const searchId = 'b2325b5b-3a81-4a0b-96f8-17304fed8dd9';

    console.log(`Searching for ID: ${searchId}`);

    const byId = await em.findOne(Post, { id: searchId });
    console.log('Found by Primary Key (id):', !!byId);

    const byJobId = await em.findOne(Post, { aiJobId: searchId });
    console.log('Found by aiJobId column:', !!byJobId);

    if (byJobId) {
        console.log('Matched Post ID:', byJobId.id);
        console.log('Matched Post Title:', byJobId.title);
    }

    const recent = await em.find(Post, {}, { limit: 50, orderBy: { createdAt: 'DESC' } });
    console.log('Last 50 posts info:');
    recent.forEach(p => {
        console.log(`- ID: ${p.id} | Slug: ${p.slug} | CreatedAt: ${p.createdAt}`);
    });

    await orm.close();
}

run().catch(console.error);
