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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

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
      message = 'Duplicate entry exists';
      errors = (exception as any).sqlMessage;
    }
    else {
      // Log lỗi 500 ra console để dev fix (nhưng không trả stack trace cho user)
      this.logger.error(`Exception: ${JSON.stringify(exception)}`);
      // Nếu có stack trace
      if (exception instanceof Error) {
        this.logger.error(exception.stack);
      }
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
