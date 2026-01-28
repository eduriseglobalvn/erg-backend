import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { AnalyticsController } from './src/modules/analytics/analytics.controller';
import { AnalyticsService } from './src/modules/analytics/analytics.service';

async function bootstrap() {
    console.log('🔍 Debugging Analytics Module Initialization...');
    try {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule], // Load toàn bộ App để test integration thật
        }).compile();

        const app = moduleRef.createNestApplication();
        await app.init();

        console.log('✅ App initialized successfully!');

        // Thử lấy Service
        const analyticsService = app.get(AnalyticsService);
        console.log('✅ AnalyticsService resolved:', !!analyticsService);

        // Thử gọi hàm getDashboard (giả lập request)
        console.log('🚀 Testing getDashboardStats...');
        try {
            const stats = await analyticsService.getDashboardStats(new Date(), new Date());
            console.log('✅ getDashboardStats success:', stats ? 'Data returned' : 'No data');
        } catch (e) {
            console.error('❌ getDashboardStats FAILED:', e);
        }

        await app.close();
    } catch (error) {
        console.error('❌ FAILED TO INITIALIZE APP:', error);
    }
}

bootstrap();
