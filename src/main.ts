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
      // Cho phép các request không có origin (Postman, Mobile App, Server-to-Server)
      if (!origin) {
        return callback(null, true);
      }

      // Danh sách các pattern được phép
      const allowedPatterns = [
        /\.erg\.edu\.vn$/,                    // *.erg.edu.vn
        /^https:\/\/erg\.edu\.vn$/,           // https://erg.edu.vn
        /\.erg\.edu\.local(:\d+)?$/,          // *.erg.edu.local:* (với hoặc không có port)
        /^http:\/\/erg\.edu\.local(:\d+)?$/,  // http://erg.edu.local:* (với hoặc không có port)
        /\.vercel\.app$/,                     // *.vercel.app (Vercel deployments)
        /localhost/,                          // localhost:*
        /127\.0\.0\.1/,                       // 127.0.0.1:*
        /\.vuongtran\.io\.vn$/,               // *.vuongtran.io.vn (Coolify domain)
      ];

      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS Blocked]: Origin "${origin}" is not in allowed list.`);
        // Không throw Error, chỉ reject bằng cách return false
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    maxAge: 86400, // 24 giờ - Cache CORS preflight
  });

  await app.listen(process.env.PORT || 3003, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();