import { NestFactory, Reflector, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './core/interceptors/transform.interceptor'; // Import mới
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter'; // Import mới

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Logger
  // app.useLogger(...) -> Code cũ của bạn

  // 2. Global Validation Pipe (Giữ nguyên)
  app.setGlobalPrefix('api'); // <--- Thêm dòng này để chuẩn hóa
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // trick này giúp class-validator ném lỗi về Filter xử lý đẹp hơn
      exceptionFactory: (errors) => {
        const messages = errors.map(
          (error) =>
            `${error.property} has wrong value ${error.value}, ${Object.values(error.constraints || {}).join(', ')}`
        );
        // Ném ra HttpException để Filter bắt được
        const { BadRequestException } = require('@nestjs/common');
        return new BadRequestException(messages);
      }
    }),
  );

  // 3. GLOBAL INTERCEPTOR (Chuẩn hóa Success Response)
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  // 4. GLOBAL FILTER (Chuẩn hóa Error Response)
  // HttpAdapterHost giúp Filter hoạt động tốt với cả Express và Fastify (nếu sau này đổi ý)
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // 5. TỐI ƯU CORS (Bảo mật & Hiệu suất)
  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép các request không có origin (như Postman hoặc Mobile App)
      // Hoặc các domain thuộc hệ sinh thái erg.edu.vn, erg.edu.local (Dev)
      if (
        !origin ||
        origin.endsWith('.erg.edu.vn') ||
        origin === 'https://erg.edu.vn' ||
        origin.endsWith('.erg.edu.local') || // Cho phép các subdomain local
        origin === 'http://erg.edu.local' || // Host local chính
        origin.endsWith('.vercel.app') || // Cho phép các bản preview/deploy từ Vercel
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') // Cho phép gọi bằng IP local
      ) {
        callback(null, true);
      } else {
        console.warn(`[CORS Blocked]: Origin "${origin}" is not allowed.`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    maxAge: 86400, // 24 giờ - Trình duyệt sẽ cache kết quả CORS, giảm request OPTIONS dư thừa
  });

  await app.listen(process.env.PORT || 3003, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();