import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express'; // Nhớ dùng import type nếu strict mode
import { ApiResponse } from '../interfaces/api-response.interface';
import { AbuseDetectionService } from '../../modules/operations/abuse-detection.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly abuseDetection?: AbuseDetectionService,
  ) { }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>(); // Ép kiểu Request

    // 1. Xác định Status Code
    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errors: any = null;

    // 2. Xử lý các loại lỗi khác nhau
    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const responseBody = exception.getResponse();

      // Xử lý lỗi từ class-validator (thường trả về mảng message)
      if (typeof responseBody === 'object' && responseBody !== null) {
        const resObj = responseBody as any;
        message = resObj.message || exception.message;
        errors = resObj.error || null;

        // Nếu message là array (lỗi validation), gán nó vào errors
        if (Array.isArray(message)) {
          errors = message;
          message = 'Validation Failed';
        }
      } else {
        message = exception.message;
      }
    }
    // Xử lý lỗi Database (Ví dụ Unique Constraint của MikroORM/MySQL)
    else if ((exception as any).code === 'ER_DUP_ENTRY') {
      httpStatus = HttpStatus.CONFLICT;
      message = 'Duplicate entry currently exists or another conflict occurred.';
      errors = null; // SECURITY: Không trả về sqlMessage để tránh lộ prefix table hay schema
    }
    else {
      // Log lỗi 500 ra console để dev fix (nhưng KHÔNG trả chi tiết cho user)
      this.logger.error(`Unhandled Exception: ${exception}`);
      if (exception instanceof Error) {
        this.logger.error(exception.stack);
      }

      // SECURITY: Ghi đè message về chung chung cho các lỗi không mong muốn
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected internal server error occurred. Please try again later.';
      errors = null;
    }

    // Abuse Detection: Track 404 Endpoint Scanning
    if (httpStatus === HttpStatus.NOT_FOUND && this.abuseDetection) {
      const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
      const ipString = Array.isArray(ip) ? ip[0] : ip;
      this.abuseDetection.track404Hit(ipString).catch((err) => {
        this.logger.error('Failed to track 404 abuse', err);
      });
    }

    // 3. Tạo cấu trúc Response chuẩn
    const responseBody: ApiResponse<null> = {
      statusCode: httpStatus,
      message: message,
      errors: errors,
      data: null,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
    };

    // 4. Gửi Response
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
