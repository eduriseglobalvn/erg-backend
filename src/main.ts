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

  app.enableCors();
  await app.listen(process.env.PORT || 7860, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();