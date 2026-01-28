import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus } from '@/shared/enums/app.enum';
import { ApiMessage } from '@/shared/enums/message.enum'; // Nhớ thêm ACCOUNT_NOT_ACTIVE vào Enum

@Injectable()
export class AccountStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Nếu chưa login thì JwtAuthGuard đã chặn rồi, ở đây ta assume user đã có
    if (!user) return true;
    // Logic kiểm tra status
    // Lưu ý: User trong req.user lấy từ JWT Payload.
    // Nếu JWT Payload của bạn chưa có status, bạn phải query DB hoặc thêm status vào payload lúc login/register.
    // TỐT NHẤT: Thêm status vào AccessToken payload ở AuthService.

    // Giả sử req.user có status (hoặc bạn query DB ở đây - tuy nhiên query DB ở Guard sẽ làm chậm API)
    // Cách nhanh nhất: Check payload JWT.

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException(
        'Tài khoản chưa kích hoạt. Vui lòng kiểm tra email.',
      );
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa.');
    }

    return true;
  }
}