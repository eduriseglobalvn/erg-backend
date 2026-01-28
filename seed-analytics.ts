import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AnalyticsService } from './src/modules/analytics/analytics.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const analyticsService = app.get(AnalyticsService);
    const logger = new Logger('SeedAnalytics');

    logger.log('🚀 Starting analytics seeding...');

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

    // Helper to get random item
    const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const randomDate = (start: Date, end: Date) => {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    };

    // Seed 3000 visits in last 30 days
    const TOTAL_VISITS = 3000;
    const END_DATE = new Date();
    const START_DATE = new Date();
    START_DATE.setDate(START_DATE.getDate() - 30);

    // Note: Since trackVisit uses 'now' via new Date(), we can't easily backdate *via the service public API* 
    // without modifying the service. 
    // HOWEVER, AnalyticsService creates entity with new Date().
    // To seed historical data properly, we should use the Repository directly OR modify service to accept date.
    // Accessing repo is cleaner for seeding script but 'visitRepo' is private.

    // Wait! MikroORM entity allows setting createdAt. 
    // But AnalyticsService hardcodes `createdAt: new Date()` inside trackVisit.
    // So we must direct access the Repository to insert historical data.
    // We can get Repository via module? Or just cheat and cast service to any.

    // Let's use `visitRepo` directly via `analyticsService['visitRepo']` (hacky but works for script).

    const visitRepo = (analyticsService as any).visitRepo; // Access private repo

    logger.log(`Creating ${TOTAL_VISITS} visits...`);

    const batchSize = 100;
    let created = 0;

    for (let i = 0; i < TOTAL_VISITS; i++) {
        const isMobile = Math.random() < 0.6; // 60% Mobile
        const deviceType = isMobile ? (Math.random() < 0.8 ? 'mobile' : 'tablet') : 'desktop';
        const userAgent = USER_AGENTS[deviceType];
        const location = random(LOCATIONS);
        const createdAt = randomDate(START_DATE, END_DATE);
        const url = random(URLS);

        // Create Visit Entity Raw Object (since we bypass service)
        const visit = visitRepo.create({
            url: url,
            referrer: random(REFERRERS),
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            userAgent: userAgent,
            userId: Math.random() < 0.2 ? Math.floor(Math.random() * 100) : null, // 20% logged in
            durationSeconds: Math.floor(Math.random() * 600), // 0-10 mins
            createdAt: createdAt,
            updatedAt: createdAt,
            deviceType: deviceType,
            os: isMobile ? 'iOS' : 'Mac OS',
            browser: 'Chrome', // Simplification
            country: location.country,
            city: location.city,
            region: location.region,
            timezone: location.timezone,
        });

        visitRepo.persist(visit);

        if ((i + 1) % batchSize === 0) {
            await visitRepo.flush();
            created += batchSize;
            logger.log(`Seeded ${created}/${TOTAL_VISITS} visits`);
        }
    }

    // Flush remaining
    await visitRepo.flush();

    logger.log('✅ Seeding completed successfully!');
    await app.close();
}

bootstrap();
