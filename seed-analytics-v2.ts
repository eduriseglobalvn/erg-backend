import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Visit } from './src/modules/analytics/entities/visit.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log('🚀 Starting analytics seeding (Direct Mongo)...');

    const orm = await MikroORM.init({
        driver: MongoDriver,
        clientUrl: process.env.MONGO_URL,
        dbName: process.env.MONGO_DB_NAME || 'erg_analytics',
        entities: [Visit], // Chỉ load entity Visit
        debug: true,
    });

    const em = orm.em.fork();

    // Clear old data (optional, but good for testing)
    // await em.nativeDelete(Visit, {});
    // console.log('🧹 Cleared old visits');

    const URLS = [
        'https://erg.edu.vn/',
        'https://erg.edu.vn/courses/ielts-7-0',
        'https://erg.edu.vn/courses/toeic-600',
        'https://erg.edu.vn/posts/bi-quyet-hoc-ngu-phap',
        'https://erg.edu.vn/posts/lo-trinh-ielts-cho-nguoi-mat-goc',
        'https://erg.edu.vn/login',
        'https://erg.edu.vn/register',
    ];

    const REFERRERS = [
        'https://google.com',
        'https://facebook.com',
        'https://youtube.com',
        '', // Direct
    ];

    const USER_AGENTS = {
        desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        tablet: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };

    const LOCATIONS = [
        { country: 'VN', city: 'Ho Chi Minh City', region: 'SG', timezone: 'Asia/Ho_Chi_Minh' },
        { country: 'VN', city: 'Hanoi', region: 'HN', timezone: 'Asia/Ho_Chi_Minh' },
        { country: 'VN', city: 'Da Nang', region: 'DN', timezone: 'Asia/Ho_Chi_Minh' },
        { country: 'US', city: 'New York', region: 'NY', timezone: 'America/New_York' },
    ];

    const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const randomDate = (start: Date, end: Date) => {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    };

    const TOTAL_VISITS = 3000;
    const END_DATE = new Date();
    const START_DATE = new Date();
    START_DATE.setDate(START_DATE.getDate() - 30);

    console.log(`Creating ${TOTAL_VISITS} visits...`);
    const batchSize = 500;

    for (let i = 0; i < TOTAL_VISITS; i += batchSize) {
        const batch: Visit[] = [];
        for (let j = 0; j < batchSize && (i + j) < TOTAL_VISITS; j++) {
            const isMobile = Math.random() < 0.6;
            const deviceType = isMobile ? (Math.random() < 0.8 ? 'mobile' : 'tablet') : 'desktop';
            const userAgent = USER_AGENTS[deviceType];
            const location = random(LOCATIONS);
            const createdAt = randomDate(START_DATE, END_DATE);

            const visit = em.create(Visit, {
                url: random(URLS),
                referrer: random(REFERRERS),
                ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                userAgent: userAgent,
                userId: Math.random() < 0.2 ? Math.floor(Math.random() * 100) : undefined,
                durationSeconds: Math.floor(Math.random() * 600),
                createdAt: createdAt,
                updatedAt: createdAt,
                deviceType: deviceType,
                os: isMobile ? 'iOS' : 'Mac OS',
                browser: 'Chrome',
                country: location.country,
                city: location.city,
                region: location.region,
                timezone: location.timezone,
            });
            batch.push(visit);
        }

        await em.persistAndFlush(batch);
        console.log(`Seeded ${Math.min(i + batchSize, TOTAL_VISITS)}/${TOTAL_VISITS} visits`);
    }

    console.log('✅ Seeding completed successfully!');
    await orm.close();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
