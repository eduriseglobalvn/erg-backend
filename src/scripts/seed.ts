import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccessControlService } from '../modules/access-control/access-control.service';
import { RequestContext } from '@mikro-orm/core';
import { SystemConfigService } from '../modules/operations/system-config.service';

async function bootstrap() {
    console.log('🌱 Starting Seed Process...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const accessControlService = app.get(AccessControlService);
    const configService = app.get(SystemConfigService);

    console.log('Running seed script manually...');

    // Create ORM Context
    const orm = app.get('MikroORM'); // Get the main MySQL ORM

    await RequestContext.create(orm.em, async () => {
        try {
            console.log('🔄 [SEED] Bắt đầu khởi tạo dữ liệu Access Control...');
            await (accessControlService as any).seedPermissions();
            await (accessControlService as any).seedPermissionGroups();
            await (accessControlService as any).seedRoles();
            await (accessControlService as any).seedAdminUser();
            console.log('✅ [SEED] Khởi tạo dữ liệu Access Control hoàn tất.');

            console.log('🔄 [SEED] Khởi tạo dữ liệu System Config...');
            await configService.seedDefaults();
            console.log('✅ [SEED] Khởi tạo dữ liệu System Config hoàn tất.');
        } catch (error) {
            console.error('❌ [SEED] Lỗi khi khởi tạo dữ liệu:', error.stack);
        }
    });

    console.log('🌱 Seed Process Finished. Exiting...');
    await app.close();
    process.exit(0);
}

bootstrap();
