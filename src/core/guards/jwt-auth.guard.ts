import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiMessage } from '@/shared/enums/message.enum';
// Import các class lỗi từ thư viện jsonwebtoken để check kiểu lỗi
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // 1. Trường hợp có lỗi hệ thống (System Error) -> Ném lỗi gốc
    if (err) {
      throw err;
    }

    // 2. Trường hợp không lấy được User (Do token lỗi, hết hạn, hoặc không có token)
    if (!user) {
      // a. Kiểm tra nếu Token hết hạn (Expired)
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException(ApiMessage.TOKEN_EXPIRED);
      }

      // b. Kiểm tra nếu Token sai định dạng, bị sửa đổi (Invalid)
      if (info instanceof JsonWebTokenError) {
        throw new UnauthorizedException(ApiMessage.TOKEN_INVALID);
      }

      // c. Trường hợp không gửi Token lên (No Auth Header)
      // info lúc này thường là: Error: No auth token
      throw new UnauthorizedException(ApiMessage.LOGIN_REQUIRED);
    }

    // 3. Nếu mọi thứ ok -> Trả về user để Controller dùng
    return user;
  }
}