import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EntityManager } from '@mikro-orm/core';
import { PostCategory } from './modules/posts/entities/post-category.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const em = app.get(EntityManager).fork();

    console.log('START SEEDING HIDDEN CATEGORIES...');

    const hiddenCategories = [
        { name: 'Crawler Tips (Hidden)', slug: '__hidden_tips', isHidden: true, hiddenType: 'tips', description: 'Used internally for AI generation guidelines' },
        { name: 'Reference Materials (Hidden)', slug: '__hidden_reference', isHidden: true, hiddenType: 'reference', description: 'Used internally for AI referencing' },
        { name: 'Scrape Pool (Hidden)', slug: '__hidden_scrape_pool', isHidden: true, hiddenType: 'scrape-pool', description: 'Temporary pool for unclassified crawled articles' },
    ];

    for (const data of hiddenCategories) {
        let category = await em.findOne(PostCategory, { slug: data.slug });

        if (!category) {
            category = em.create(PostCategory, data);
            em.persist(category);
            console.log(`✅ Added: ${data.name}`);
        } else {
            console.log(`ℹ️ Skipped: ${data.name} (Already exists)`);
        }
    }

    await em.flush();
    console.log('FINISHED SEEDING HIDDEN CATEGORIES.');

    await app.close();
}

bootstrap();
