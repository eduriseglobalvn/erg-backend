import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Ip,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// FIX LỖI 1 (TS1272): Dùng 'import type' để báo cho TS biết đây chỉ là kiểu dữ liệu, không phải value
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';
import { ApiMessage } from '@/shared/enums/message.enum';
import { ResendPinDto, VerifyPinDto } from '@/modules/auth/dto/verify-pin.dto';

// FIX LỖI 2 (ESLint): Định nghĩa Interface rõ ràng cho Request đã đăng nhập
// Giúp ESLint biết req.user có chứa gì, thay vì đoán mò là 'any'
interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    role: string;
    refreshToken?: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 1. Đăng ký
  @Post('register')
  @ResponseMessage(ApiMessage.REGISTER_SUCCESS)
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request, // Request thường thì chưa có user
  ) {
    const ua = req.headers['user-agent'] || 'unknown';
    return this.authService.register(dto, ip, ua);
  }

  // 2. Đăng nhập
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.LOGIN_SUCCESS)
  login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    const ua = req.headers['user-agent'] || 'unknown';
    return this.authService.login(dto, ip, ua);
  }

  // 3. Đăng xuất
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.LOGOUT_SUCCESS)
  // Sử dụng RequestWithUser thay vì Request thường hoặc any
  logout(@Req() req: RequestWithUser) {
    const userId = req.user.sub; // ESLint sẽ không báo lỗi nữa vì đã có type
    // Lấy refreshToken từ body nếu client gửi lên, hoặc xử lý logout session hiện tại
    const refreshToken = req.body.refreshToken;
    return this.authService.logout(userId, refreshToken);
  }

  // 4. Refresh Token
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.REFRESH_TOKEN_SUCCESS)
  refreshTokens(@Req() req: RequestWithUser, @Ip() ip: string) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken; // Đã định nghĩa trong interface
    const ua = req.headers['user-agent'] || 'unknown';

    // Thêm check an toàn nếu refreshToken undefined (dù Guard đã check rồi)
    if (!refreshToken) {
      throw new Error('Refresh token missing in request context');
    }

    return this.authService.refreshTokens(userId, refreshToken, ip, ua);
  }

  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.LOGIN_SUCCESS) // Đổi message thành Login success
  verifyPin(@Body() dto: VerifyPinDto, @Ip() ip: string, @Req() req: Request) {
    const ua = req.headers['user-agent'] || 'unknown';
    // Truyền thêm ip, ua vào service
    return this.authService.verifyPin(dto, ip, ua);
  }

  @Post('resend-pin')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.SUCCESS)
  resendPin(@Body() dto: ResendPinDto) {
    return this.authService.resendPin(dto);
  }

  // API Test
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @ResponseMessage(ApiMessage.GET_PROFILE_SUCCESS)
  getProfile(@Req() req: RequestWithUser) {
    return req.user;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.SUCCESS)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ApiMessage.SUCCESS)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
