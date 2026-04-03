/**
 * Seed script: Khởi tạo dữ liệu E-Learning vào MongoDB
 * Chạy: yarn seed:elearning
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RequestContext } from '@mikro-orm/core';
import { ElearningService } from '../modules/elearning/elearning.service';

const SEED_DATA = [
    {
        title: 'Tiểu học (Spark)',
        subtitle: 'Bám sát chương trình IC3 Spark',
        slug: 'primary',
        sortOrder: 0,
        levels: [
            {
                title: 'IC3 Spark Level 1',
                description: 'Làm quen với máy tính và công nghệ',
                slug: 'spark-level-1',
                sortOrder: 0,
                units: [
                    { title: 'Khám phá máy tính', description: 'Làm quen với các bộ phận và chức năng cơ bản của máy tính.', sortOrder: 0 },
                    { title: 'Phần cứng & Phần mềm', description: 'Phân biệt thiết bị ngoại vi và các chương trình máy tính.', sortOrder: 1 },
                    { title: 'Sử dụng bàn phím', description: 'Kỹ năng gõ phím 10 ngón và các phím chức năng.', sortOrder: 2 },
                    { title: 'Hệ điều hành cơ bản', description: 'Cách quản lý cửa sổ và thư mục đơn giản.', sortOrder: 3 },
                    { title: 'An toàn thiết bị', description: 'Bảo quản máy tính và sử dụng thiết bị đúng cách.', sortOrder: 4 },
                ],
            },
            {
                title: 'IC3 Spark Level 2',
                description: 'Ứng dụng máy tính trong học tập',
                slug: 'spark-level-2',
                sortOrder: 1,
                units: [
                    { title: 'Phần mềm ứng dụng', description: 'Tìm hiểu các loại phần mềm phục vụ học tập.', sortOrder: 0 },
                    { title: 'Soạn thảo văn bản', description: 'Kỹ năng trình bày văn bản đơn giản.', sortOrder: 1 },
                    { title: 'Bảng tính cơ bản', description: 'Làm quen với các ô dữ liệu và tính toán.', sortOrder: 2 },
                    { title: 'Trình chiếu sáng tạo', description: 'Thiết kế slide bài thuyết trình sinh động.', sortOrder: 3 },
                    { title: 'Quản lý tệp tin', description: 'Cách sắp xếp dữ liệu khoa học trên máy tính.', sortOrder: 4 },
                ],
            },
            {
                title: 'IC3 Spark Level 3',
                description: 'An toàn mạng cho trẻ em',
                slug: 'spark-level-3',
                sortOrder: 2,
                units: [
                    { title: 'Mạng máy tính', description: 'Cách các máy tính kết nối với nhau.', sortOrder: 0 },
                    { title: 'Internet & Web', description: 'Kỹ năng duyệt web và tìm kiếm thông tin.', sortOrder: 1 },
                    { title: 'Liên lạc trực tuyến', description: 'Sử dụng email và các công cụ nhắn tin.', sortOrder: 2 },
                    { title: 'An toàn thông tin', description: 'Bảo vệ mật khẩu và thông tin cá nhân.', sortOrder: 3 },
                    { title: 'Đạo đức số', description: 'Quy tắc ứng xử văn minh trên không gian mạng.', sortOrder: 4 },
                ],
            },
        ],
    },
    {
        title: 'THCS (GS6)',
        subtitle: 'Bám sát chương trình IC3 GS6',
        slug: 'secondary',
        sortOrder: 1,
        levels: [
            {
                title: 'IC3 GS6 Level 1',
                description: 'Nền tảng về thiết bị và hệ điều hành',
                slug: 'gs6-level-1',
                sortOrder: 0,
                units: [
                    { title: 'Thiết bị số', description: 'Cấu tạo và nguyên lý hoạt động của thiết bị.', sortOrder: 0 },
                    { title: 'Hệ điều hành', description: 'Quản trị hệ thống và cài đặt môi trường.', sortOrder: 1 },
                    { title: 'Tùy chỉnh máy tính', description: 'Cài đặt cá nhân hóa và quản lý người dùng.', sortOrder: 2 },
                    { title: 'Ứng dụng & Phần mềm', description: 'Quản lý vòng đời phần mềm trên PC.', sortOrder: 3 },
                    { title: 'Bảo mật cơ bản', description: 'Phòng chống mã độc và bảo mật thiết bị.', sortOrder: 4 },
                ],
            },
            {
                title: 'IC3 GS6 Level 2',
                description: 'Kỹ năng mạng và giao tiếp trực tuyến',
                slug: 'gs6-level-2',
                sortOrder: 1,
                units: [
                    { title: 'Kết nối mạng', description: 'Giao thức mạng và hạ tầng kết nối.', sortOrder: 0 },
                    { title: 'Trình duyệt Web', description: 'Tận dụng tối đa các công nghệ duyệt web.', sortOrder: 1 },
                    { title: 'Tìm kiếm thông tin', description: 'Kỹ khai thác thông tin trên Internet.', sortOrder: 2 },
                    { title: 'Giao tiếp số', description: 'Các hình thức trao đổi thông tin hiện đại.', sortOrder: 3 },
                    { title: 'Cộng tác trực tuyến', description: 'Làm việc nhóm trên các nền tảng Cloud.', sortOrder: 4 },
                ],
            },
            {
                title: 'IC3 GS6 Level 3',
                description: 'Xử lý văn bản và bảng tính nâng cao',
                slug: 'gs6-level-3',
                sortOrder: 2,
                units: [
                    { title: 'Soạn thảo chuyên nghiệp', description: 'Xử lý văn bản cấp độ nâng cao.', sortOrder: 0 },
                    { title: 'Bảng tính nâng cao', description: 'Phân tích dữ liệu và hàm phức tạp.', sortOrder: 1 },
                    { title: 'Quản lý dữ liệu', description: 'Tổ chức và bảo vệ an toàn dữ liệu số.', sortOrder: 2 },
                    { title: 'Giải quyết vấn đề', description: 'Kỹ năng xử lý sự cố công nghệ.', sortOrder: 3 },
                    { title: 'Tư duy lập trình', description: 'Nền tảng logic và thuật toán cơ bản.', sortOrder: 4 },
                ],
            },
        ],
    },
];

async function bootstrap() {
    console.log('🌱 [E-Learning Seed] Bắt đầu seed vào MongoDB...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const mongoOrm = app.get('MikroORM-mongo-connection');
    const elearningService = app.get(ElearningService);

    await RequestContext.create(mongoOrm.em, async () => {
        for (const catData of SEED_DATA) {
            try {
                // Kiểm tra đã tồn tại chưa
                await elearningService.getCategoryBySlug(catData.slug);
                console.log(`⏭️  Category "${catData.title}" đã tồn tại, bỏ qua.`);
                continue;
            } catch {
                // Chưa tồn tại → tạo mới
            }

            const category = await elearningService.createCategory({
                title: catData.title,
                subtitle: catData.subtitle,
                slug: catData.slug,
                sortOrder: catData.sortOrder,
            });
            console.log(`✅ Category: ${catData.title} (${category.id})`);

            for (const lvlData of catData.levels) {
                const level = await elearningService.createLevel({
                    categoryId: category.id,
                    title: lvlData.title,
                    description: lvlData.description,
                    slug: lvlData.slug,
                    sortOrder: lvlData.sortOrder,
                });
                console.log(`  ✅ Level: ${lvlData.title} (${level.id})`);

                for (const uData of lvlData.units) {
                    await elearningService.createUnit({
                        levelId: level.id,
                        title: uData.title,
                        description: uData.description,
                        sortOrder: uData.sortOrder,
                    });
                }
                console.log(`     📝 ${lvlData.units.length} units`);
            }
        }
    });

    console.log('\n🎉 [E-Learning Seed] Hoàn tất!');
    await app.close();
    process.exit(0);
}

bootstrap();
