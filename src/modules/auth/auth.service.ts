import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@mikro-orm/nestjs';
import { InjectEntityManager } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/mongodb';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

import { User } from '@/modules/users/entities/user.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import { AuthActivityLog } from './entities/auth-activity-log.entity';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { AuthProvider, UserStatus } from '@/shared/enums/app.enum';
import { ResendPinDto, VerifyPinDto } from '@/modules/auth/dto/verify-pin.dto';
import { MailService } from '@/shared/mail/mail.service';
// [UPDATE] Import SessionsService
import { SessionsService } from '@/modules/sessions/sessions.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepo: EntityRepository<UserSession>,
    @InjectRepository(Role)
    private readonly roleRepo: EntityRepository<Role>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectEntityManager('mongo-connection')
    private readonly mongoEm: EntityManager,

    // [UPDATE] Inject SessionsService để xử lý Redis Cache
    private readonly sessionsService: SessionsService,
  ) { }

  // --- 1. ĐĂNG KÝ ---
  async register(dto: RegisterDto, ip: string, ua: string) {
    const exists = await this.userRepo.findOne({ email: dto.email });
    if (exists) throw new ConflictException('Email already exists');

    const hashedPassword = await argon2.hash(dto.password);
    const pin = this.generatePin();
    const pinExpires = new Date(Date.now() + 15 * 60 * 1000);

    // [RBAC] Tìm Role 'user' mặc định
    const userRole = await this.roleRepo.findOne({ name: 'user' });

    const user = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      provider: AuthProvider.LOCAL,
      status: UserStatus.PENDING,
      activationPin: pin,
      pinExpiresAt: pinExpires,
      isProfileCompleted: false,
      tokenVersion: 0,
    });

    // [RBAC] Gán Role User
    if (userRole) {
      user.roles.add(userRole);
    }

    await this.userRepo.getEntityManager().persistAndFlush(user);

    // Gửi mail verify
    await this.mailService.sendUserConfirmation(
      {
        email: user.email,
        name: user.fullName || 'User',
      },
      pin,
    );

    this.logActivity(user.id, user.email, 'REGISTER', ip, ua);

    // Gọi hàm generateTokens (đã bao gồm logic tạo session DB)
    return this.generateTokens(user, ip, ua);
  }

  // --- 2. ĐĂNG NHẬP ---
  async login(dto: LoginDto, ip: string, ua: string) {
    const user = await this.userRepo.findOne({ email: dto.email });

    if (!user) {
      this.logActivity('unknown', dto.email, 'FAILED_LOGIN', ip, ua, {
        reason: 'User not found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.password!, dto.password);
    if (!isPasswordValid) {
      this.logActivity(user.id, dto.email, 'FAILED_LOGIN', ip, ua, {
        reason: 'Wrong password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Account is not activated. Please verify your email.');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Account has been banned.');
    }

    this.logActivity(user.id, user.email, 'LOGIN', ip, ua);

    // Gọi hàm generateTokens (đã bao gồm logic tạo session DB)
    return this.generateTokens(user, ip, ua);
  }

  // --- 3. LOGOUT (CÓ UPDATE REDIS) ---
  async logout(userId: string, refreshToken: string) {
    const session = await this.sessionRepo.findOne({
      user: userId,
      refreshToken,
    });

    if (session) {
      // 1. Revoke trong DB
      session.isRevoked = true;
      await this.sessionRepo.getEntityManager().flush();

      // 2. [UPDATE] Xóa Cache Redis ngay lập tức
      // Để đảm bảo nếu user F5 lại trang, API getCurrentSession sẽ không lấy dữ liệu cũ từ Redis
      await this.sessionsService.clearSessionCache(userId, session.id);
    }

    this.logActivity(userId, 'unknown', 'LOGOUT', 'unknown', 'unknown');
    return { message: 'Logged out successfully' };
  }

  // --- 4. REFRESH TOKEN (CÓ UPDATE REDIS) ---
  async refreshTokens(
    userId: string,
    oldRefreshToken: string,
    ip: string,
    ua: string,
  ) {
    const user = await this.userRepo.findOne(userId);
    if (!user) throw new ForbiddenException('Access Denied');

    const session = await this.sessionRepo.findOne({ refreshToken: oldRefreshToken });

    // Kiểm tra token cũ có bị thu hồi chưa (Reuse Detection)
    if (session && session.isRevoked) {
      await this.sessionRepo.nativeDelete({ user: userId }); // Xóa hết session của user để bảo mật

      // [UPDATE] Có thể clear toàn bộ cache của user nếu muốn chặt chẽ hơn
      // await this.sessionsService.clearAllUserSessions(userId);

      this.logActivity(userId, user.email, 'FAILED_LOGIN', ip, ua, {
        reason: 'Reuse Revoked Token - Possible Attack',
      });
      throw new ForbiddenException('Security Alert: Please login again');
    }

    if (!session) throw new ForbiddenException('Invalid Refresh Token');

    // 1. Thu hồi token cũ
    session.isRevoked = true;

    // 2. [UPDATE] Xóa Cache Redis của session cũ
    await this.sessionsService.clearSessionCache(userId, session.id);

    // 3. Tạo session mới và token mới
    // Hàm generateTokens sẽ tự động tạo session mới -> lấy ID -> tạo JWT -> lưu DB
    const tokens = await this.generateTokens(user, ip, ua);

    // Lưu session cũ (đã revoked) và session mới (được tạo trong generateTokens)
    await this.sessionRepo.getEntityManager().flush();

    this.logActivity(userId, user.email, 'REFRESH_TOKEN', ip, ua);

    return tokens;
  }

  // --- 5. XÁC THỰC PIN ---
  async verifyPin(dto: VerifyPinDto, ip: string, ua: string) {
    const user = await this.userRepo.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('User not found');

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Tài khoản đã được kích hoạt trước đó');
    } else {
      if (user.activationPin !== dto.pin) throw new BadRequestException('Invalid PIN');
      if (user.pinExpiresAt && user.pinExpiresAt < new Date()) throw new BadRequestException('PIN Expired');

      // Kích hoạt user
      user.status = UserStatus.ACTIVE;
      user.activationPin = undefined;
      user.pinExpiresAt = undefined;
      await this.userRepo.getEntityManager().flush();
    }

    // [QUAN TRỌNG] Tự động đăng nhập: Sinh Token & Session luôn
    return this.generateTokens(user, ip, ua);
  }

  // --- 6. GỬI LẠI PIN ---
  async resendPin(dto: ResendPinDto) {
    const user = await this.userRepo.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('User not found');

    if (user.status === UserStatus.ACTIVE) {
      return { message: 'Tài khoản đã kích hoạt, không cần gửi lại' };
    }

    const pin = this.generatePin();
    user.activationPin = pin;
    user.pinExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.userRepo.getEntityManager().flush();

    await this.mailService.sendUserConfirmation(
      {
        email: user.email,
        name: user.fullName || 'User',
      },
      pin,
    );

    return { message: 'Mã PIN mới đã được gửi tới email của bạn' };
  }

  // --- 7. QUÊN MẬT KHẨU (Gửi PIN) ---
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ email: dto.email });
    if (!user) throw new NotFoundException('User not found');

    // Sinh PIN mới để reset
    const pin = this.generatePin();
    user.activationPin = pin;
    user.pinExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await this.userRepo.getEntityManager().flush();

    // Gửi mail (Bạn cần implement thêm template mail reset password nhé)
    // Tạm thời dùng lại hàm sendUserConfirmation hoặc viết hàm mới sendResetPasswordEmail
    await this.mailService.sendUserConfirmation({ email: user.email, name: user.fullName || 'User' }, pin);

    return { message: 'Reset PIN has been sent to your email' };
  }

  // --- 8. ĐẶT LẠI MẬT KHẨU (Dùng PIN) ---
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepo.findOne({ email: dto.email });
    if (!user) throw new NotFoundException('User not found');

    // Validate PIN
    if (user.activationPin !== dto.pin) {
      throw new BadRequestException('Invalid PIN');
    }
    if (user.pinExpiresAt && user.pinExpiresAt < new Date()) {
      throw new BadRequestException('PIN expired');
    }

    // Hash mật khẩu mới
    user.password = await argon2.hash(dto.newPassword);

    // Reset PIN
    user.activationPin = undefined;
    user.pinExpiresAt = undefined;

    // Thu hồi tất cả session cũ để bảo mật
    await this.sessionRepo.nativeDelete({ user: user.id });

    // [QUAN TRỌNG] Xóa cache Redis (nếu có hàm clearAllUserSessions)
    // await this.sessionsService.clearAllUserSessions(user.id);

    await this.userRepo.getEntityManager().flush();

    return { message: 'Password reset successfully. Please login with new password.' };
  }

  // --- HELPER: Sinh mã PIN ---
  private generatePin(): string {
    return randomInt(100000, 999999).toString();
  }

  // --- HELPER: Tính thời gian hết hạn ---
  private getRefreshTokenExpiry(): Date {
    const refreshTimeConfig = this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME', '7d');
    let msValue = 0;
    if (refreshTimeConfig.endsWith('d')) {
      const days = parseInt(refreshTimeConfig.replace('d', ''));
      msValue = days * 24 * 60 * 60 * 1000;
    } else if (refreshTimeConfig.endsWith('h')) {
      const hours = parseInt(refreshTimeConfig.replace('h', ''));
      msValue = hours * 60 * 60 * 1000;
    } else {
      msValue = 7 * 24 * 60 * 60 * 1000; // Default 7d
    }
    return new Date(Date.now() + msValue);
  }

  // --- INTERNAL HELPERS (CORE LOGIC) ---

  /**
   * Quy trình tạo Token chuẩn:
   * 1. Tạo Session DB (để lấy ID)
   * 2. Tạo JWT (nhét Session ID vào)
   * 3. Update lại Session DB với RefreshToken thật
   */
  private async generateTokens(user: User, ip: string, ua: string) {
    const expiresAt = this.getRefreshTokenExpiry();

    // 1. Tạo session object
    const session = this.sessionRepo.create({
      user: user,
      refreshToken: 'pending...', // Placeholder
      userAgent: ua,
      ipAddress: ip,
      expiresAt: expiresAt,
      isRevoked: false,
    });

    // 2. Lưu vào DB để có ID (UUID/MongoID)
    await this.sessionRepo.getEntityManager().persistAndFlush(session);

    // 3. Tạo Token với ID của session vừa tạo
    const tokens = await this.generateJwtPair(user, session.id);

    // 4. Cập nhật refreshToken thật vào session
    session.refreshToken = tokens.refreshToken;
    await this.sessionRepo.getEntityManager().flush();

    return tokens;
  }

  private async generateJwtPair(user: User, sessionId: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      sessionId: sessionId, // <-- Session ID đã được truyền vào
      role: 'user',
      status: user.status,
    };

    const accessTime = this.configService.get<string>('JWT_ACCESS_EXPIRATION_TIME', '3h');
    const refreshTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME', '7d');

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: accessTime as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshTime as any,
      }),
    ]);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }

  private async logActivity(
    userId: string,
    email: string,
    action: string,
    ip: string,
    ua: string,
    metadata: any = {},
  ) {
    try {
      const log = new AuthActivityLog();
      log.userId = userId;
      log.email = email;
      log.action = action;
      log.ipAddress = ip;
      log.userAgent = ua;
      log.metadata = metadata;
      log.createdAt = new Date();

      await this.mongoEm.fork().persistAndFlush(log);
    } catch (e) {
      console.error('Failed to write auth log', e);
    }
  }
}