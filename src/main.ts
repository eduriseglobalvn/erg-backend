import { NestFactory, Reflector, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import compression from 'compression';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { AbuseDetectionService } from './modules/operations/abuse-detection.service';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ═══ SECURITY: Body Size Limits ═══
  // Default: 5MB cho tất cả requests
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  // Upload endpoints cho phép lớn hơn (50MB)
  app.use('/api/upload', json({ limit: '50mb' }));

  // ═══ SECURITY: Request Timeout (30s) ═══
  app.use((req: any, res: any, next: any) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          statusCode: 408,
          message: 'Request Timeout — quá 30 giây xử lý',
          error: 'Request Timeout',
        });
      }
    }, 30000);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    next();
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // ═══ SECURITY: Custom Headers ═══
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Modern browsers don't need this
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // 0. Compression (gzip) — giảm 70-80% bandwidth
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://meida.erg.edu.vn"], // allow media domain
        connectSrc: ["'self'", "https://*.erg.edu.vn"],
      },
    } : false, // Tắt CSP ở dev để Swagger hoạt động
  }));

  // 1. Logger
  // app.useLogger(...) -> Code cũ của bạn

  // 2. Global Validation Pipe (Giữ nguyên)
  app.setGlobalPrefix('api'); // <--- Thêm dòng này để chuẩn hóa
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // SECURITY: Reject requests with unexpected properties
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
  const abuseDetectionService = app.get(AbuseDetectionService, { strict: false });
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter, abuseDetectionService));

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
        logger.warn(`[CORS Blocked]: Origin "${origin}" is not in allowed list.`);
        // Không throw Error, chỉ reject bằng cách return false
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    maxAge: 86400, // 24 giờ - Cache CORS preflight
  });

  // 6. SWAGGER API DOCUMENTATION
  const config = new DocumentBuilder()
    .setTitle('ERG Backend API')
    .setDescription('EDURISE GLOBAL - Advanced SEO & Content Management System')
    .setVersion('1.0')
    .addTag('SEO', 'SEO Analysis & Optimization endpoints')
    .addTag('Posts', 'Content Management endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Analytics', 'Analytics & Tracking endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  if (!isProduction) {
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // 7. Khởi động Server hoặc Worker
  if (process.env.START_MODE === 'worker') {
    // Chế độ Worker: Chỉ khởi tạo các module (bao gồm Queue Consumers), KHÔNG mở port HTTP
    await app.init();
    logger.log('Background Worker is running... (HTTP Server disabled)');
  } else {
    // Chế độ API hoặc mặc định: Mở port HTTP
    const port = process.env.PORT || 3003;
    await app.listen(port, '0.0.0.0');
    logger.log(`API Server is listening on port ${port}`);
    logger.log(`Application is running on: ${await app.getUrl()}`);
    logger.log(`Swagger API Docs: ${await app.getUrl()}/api-docs`);
  }
}
bootstrap();