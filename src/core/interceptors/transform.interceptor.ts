import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ApiResponse } from '../interfaces/api-response.interface';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const statusCode = response.statusCode;

        // 1. Lấy message từ Decorator @ResponseMessage
        const decoratorMessage = this.reflector.getAllAndOverride<string>(
          RESPONSE_MESSAGE_KEY,
          [context.getHandler(), context.getClass()],
        );

        // 2. Ưu tiên: Decorator > Data.message > 'Success'
        const message = decoratorMessage || data?.message || 'Success';

        // 3. Nếu data trả về có dạng { message, data } (kiểu cũ) thì lấy phần data
        // Nếu không thì lấy nguyên cục data
        const finalData = data && data.data ? data.data : data;

        return {
          statusCode,
          message,
          data: finalData, // Dữ liệu sạch
          errors: null,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}