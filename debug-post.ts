import { MikroORM } from '@mikro-orm/core';
import config from './src/config/mikro-orm-mysql.config';
import { Post } from './src/modules/posts/entities/post.entity';

async function run() {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();
    const id = 'b2325b5b-3a81-4a0b-96f8-17304fed8dd9';

    console.log(`Checking post by ID: ${id}`);

    // 1. Check without joins
    const postRaw = await em.findOne(Post, { id }, { populate: [] as any });
    if (postRaw) {
        console.log('✅ Post found in primary table!');
        console.log('Title:', postRaw.title);
        // Accessing raw properties to see what's in the DB
        const raw = postRaw as any;
        console.log('Category ID (raw):', raw.category?.id || raw.category);
        console.log('Author ID (raw):', raw.author?.id || raw.author);
        console.log('CreatedBy ID (raw):', raw.createdBy?.id || raw.createdBy);

        // Try to find the related entities individually
        const cat = await em.findOne('PostCategory', { id: raw.category?.id || raw.category });
        const aut = await em.findOne('User', { id: raw.author?.id || raw.author });
        console.log('Category exists in DB:', !!cat);
        console.log('Author exists in DB:', !!aut);
    } else {
        console.log('❌ Post NOT found in primary table.');
    }

    await orm.close();
}

run().catch(console.error);
