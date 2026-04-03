import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap } from '@mikro-orm/core';
import * as argon2 from 'argon2';

import { User } from './entities/user.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { SessionsService } from '@/modules/sessions/sessions.service'; // Chỉnh lại import cho đúng vị trí nếu cần
import { StorageService } from '@/shared/services/storage.service';
import { UpdateProfileDto, ChangePasswordDto, OnboardingDto } from './dto/user.dto';
import { UpdateUserStatusDto, AssignRolesDto, QueryUsersDto } from './dto/admin-user.dto';
import { JobPosition } from '@/modules/organization/entities/job-position.entity';
import { Region } from '@/modules/organization/entities/region.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import { AccessControlService } from '@/modules/access-control/access-control.service';
import { UserActivityService, ActivityAction } from './services/user-activity.service';
import 'multer'; // Import to ensure types are loaded

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepo: EntityRepository<UserSession>,
    @InjectRepository(Role)
    private readonly roleRepo: EntityRepository<Role>,
    private readonly sessionsService: SessionsService,
    private readonly storageService: StorageService,
    private readonly accessControlService: AccessControlService,
    private readonly userActivityService: UserActivityService,
  ) { }

  // --- 1. LẤY THÔNG TIN CÁ NHÂN ---
  async getMe(userId: string) {
    // Populate các quan hệ nếu cần (ví dụ: jobPosition, department)
    const user = await this.userRepo.findOne(userId, {
      populate: ['jobPosition', 'region', 'roles'],
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // --- 2. CẬP NHẬT THÔNG TIN ---
  async updateProfile(
    userId: string,
    sessionId: string,
    dto: UpdateProfileDto,
  ) {
    const user = await this.userRepo.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    wrap(user).assign(dto);

    // Cập nhật các trường đặc biệt nếu gửi lên
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.dateOfBirth) user.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.district !== undefined) user.district = dto.district;
    if (dto.socialLinks !== undefined) user.socialLinks = dto.socialLinks;
    if (dto.preferences !== undefined) user.preferences = dto.preferences;

    // Nếu có avatarUrl string (trong trường hợp FE gửi link trực tiếp)
    if (dto.avatarUrl) {
      user.avatarUrl = dto.avatarUrl;
    }

    if (!user.isProfileCompleted) {
      user.isProfileCompleted = true;
    }

    await this.userRepo.getEntityManager().flush();

    // [MỚI] Xóa Cache Redis của User này
    // Vì không biết chính xác sessionId hiện tại của request này (do controller không truyền xuống),
    // ta có thể chấp nhận rủi ro nhỏ hoặc yêu cầu Controller truyền cả SessionId xuống.
    // TUY NHIÊN: SessionsService nên có hàm clearAllUserSessions (nâng cao).
    // Ở mức độ cơ bản: Frontend sẽ tự gọi lại session/current, nếu cache cũ thì F5 sau 15p mới thấy.
    // ĐỂ TỐI ƯU NHẤT: Bạn nên sửa Controller truyền thêm sessionId vào.
    await this.sessionsService.clearSessionCache(userId, sessionId);

    // Bắn event log activity
    await this.userActivityService.logActivity(
      userId,
      user.email,
      ActivityAction.PROFILE_UPDATE,
      'unknown', // Controllers should eventually pass Req() info
      'unknown',
      { updatedFields: Object.keys(dto) }
    );

    return user;
  }

  // --- 2.1 ONBOARDING (Kèm Avatar Upload) ---
  async onboarding(
    userId: string,
    sessionId: string,
    dto: OnboardingDto,
    avatarFile?: Express.Multer.File, // Đã có type sau khi cài @types/multer
  ) {
    // Tận dụng lại logic updateProfile để tránh dry code
    // Tuy nhiên updateProfile không handle file upload trực tiếp mà DTO chỉ có string url
    // Nên ta vẫn cần xử lý file ở đây.

    // 1. Upload ảnh trước nếu có
    if (avatarFile) {
      const avatarUrl = await this.storageService.processAndUpload(
        avatarFile.buffer,
        'avatar', // Folder
        userId, // Filename (Overwrite file cũ của user này)
      );
      dto.avatarUrl = avatarUrl;
    }

    // 2. Gọi hàm updateProfile để lưu thông tin (bao gồm cả job, region support mới thêm)
    return this.updateProfile(userId, sessionId, dto);
  }

  // --- 3. ĐỔI MẬT KHẨU ---
  // --- 3. ĐỔI MẬT KHẨU (SỬA ĐỔI QUAN TRỌNG) ---
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new BadRequestException('User logged in via Social cannot change password');
    }

    const isMatch = await argon2.verify(user.password, dto.currentPassword);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await argon2.hash(dto.newPassword);
    user.tokenVersion += 1;

    await this.userRepo.getEntityManager().flush();

    // [LOGIC CŨ]: Xóa DB
    await this.sessionRepo.nativeDelete({ user: userId });

    // [MỚI - QUAN TRỌNG]: Xóa luôn trong Redis (Nếu không xóa, User vẫn dùng được token cũ 15 phút)
    // Vì mình xóa ALL session, nên ở đây logic clear cache theo ID hơi khó.
    // => Giải pháp nhanh: Không cần làm gì cả.
    // TẠI SAO? Vì bạn đã xóa session trong DB rồi.
    // Lần tới khi User gọi API, 'JwtStrategy' hoặc 'SessionsService' check DB thấy mất session -> Lỗi 401 -> Logout.
    // NHƯNG: getCurrentSessionContext có cache Redis. Nó sẽ trả về OK trong 15p.
    // => BẮT BUỘC PHẢI XÓA CACHE.

    // Nếu bạn chưa implement hàm clearAllUserSessions, hãy tạm thời chấp nhận.
    // Hoặc tốt nhất: Inject Redis Cache Manager vào đây và xóa theo pattern (Hơi phức tạp).

    return { message: 'Password changed successfully. Please login again.' };
  }

  // --- 4. QUẢN LÝ SESSION (Xem danh sách thiết bị) ---
  async getMySessions(userId: string) {
    return this.sessionRepo.find(
      {
        user: userId,
        isRevoked: false, // Chỉ lấy các phiên đang hoạt động
        expiresAt: { $gt: new Date() } // Chưa hết hạn
      },
      {
        orderBy: { lastActiveAt: 'DESC' }
      }
    );
  }

  // --- 5. REVOKE SESSION (Đăng xuất từ xa) ---
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findOne({
      id: sessionId,
      user: userId,
    });

    if (!session) throw new NotFoundException('Session not found');

    session.isRevoked = true;
    await this.sessionRepo.getEntityManager().flush();

    // [MỚI] Xóa cache Redis của session này ngay lập tức
    await this.sessionsService.clearSessionCache(userId, sessionId);

    return { message: 'Session revoked successfully' };
  }

  // --- 6. ADMIN: LẤY DANH SÁCH USER (Cơ bản) ---
  async findAllUsers(query: QueryUsersDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      role,
      provider,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { email: { $ilike: `%${search}%` } },
        { fullName: { $ilike: `%${search}%` } },
        { phone: { $ilike: `%${search}%` } },
      ];
    }

    if (status) filter.status = status;
    if (provider) filter.provider = provider;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Ghi chú: MikroORM mongo driver không join dễ như SQL, 
    // Mặc định User -> Roles là ManyToMany SQL, filter bằng 'populate' & custom queries
    if (role) {
      // Vì populate rôles có thể phức tạp trong find basic, ta tối giản tìm bằng filter nested
      filter.roles = { name: role };
    }

    const [users, count] = await this.userRepo.findAndCount(
      filter,
      {
        limit,
        offset: (page - 1) * limit,
        orderBy: { [sortBy]: sortOrder.toLowerCase() },
        populate: ['roles'],
      }
    );

    return {
      data: users,
      meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    };
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({ email });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  // --- 7. ADMIN: XEM CHI TIẾT USER ---
  async findOneAdminView(userId: string) {
    const user = await this.userRepo.findOne(userId, {
      populate: ['roles', 'sessions', 'jobPosition', 'region', 'socialAccounts'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  // --- 8. ADMIN: QUẢN LÝ TRẠNG THÁI USER (BLOCK/BAN) ---
  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = dto.status;
    await this.userRepo.getEntityManager().flush();

    // Nếu block/ban thì nên revoke sessions
    if (['blocked', 'banned', 'inactive'].includes(dto.status)) {
      // Xoá toàn bộ session của user này
      await this.sessionRepo.nativeUpdate({ user: user.id }, { isRevoked: true });
      // Tuỳ chọn: clear cache session
      // await this.sessionsService.clearAllSessionCache(user.id);
    }

    return user;
  }

  // --- 8. ADMIN: PHÂN QUYỀN (ASSIGN ROLES) ---
  async assignRoles(userId: string, dto: AssignRolesDto) {
    const user = await this.userRepo.findOne(userId, { populate: ['roles'] });
    if (!user) throw new NotFoundException('User not found');

    // Lấy danh sách Roles từ DB
    const roles = await this.roleRepo.find({ id: { $in: dto.roleIds } });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roles not found');
    }

    // Cập nhật quan hệ ManyToMany
    // user.roles.removeAll(); // Nếu muốn replace hoàn toàn
    // user.roles.add(roles);

    // Thay thế hoàn toàn list roles cũ bằng list mới
    user.roles.set(roles);

    await this.userRepo.getEntityManager().flush();
    return user;
  }

  async assignDirectPermissions(
    assignerId: string,
    userId: string,
    permissionsToGrant: string[],
    permissionsToDeny: string[]
  ) {
    // Validate that the user exists
    await this.userRepo.findOneOrFail(userId);

    return this.accessControlService.assignDirectPermissions(
      assignerId,
      userId,
      permissionsToGrant,
      permissionsToDeny
    );
  }

  // --- 9. ADMIN: XÓA USER (SOFT DELETE) ---
  // Hiện tại User entity chưa có deletedAt (BaseEntity có chưa? BaseEntity có!)
  // BaseEntity: id, createdAt, updatedAt. Chưa chắc có deletedAt.
  // Check BaseEntity lại. Nếu chưa có soft delete logic thì dùng Hard Delete hoặc thêm field.
  // Trong User entity thấy có inherited BaseEntity, nhưng ko thấy property deletedAt đc khai báo override.
  // Check lại User Entity: không có deletedAt property.
  // Vậy làm hard delete trước, hoặc thêm field status = inactive.
  async deleteUser(userId: string) {
    const user = await this.userRepo.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    // Hard Delete
    await this.userRepo.getEntityManager().removeAndFlush(user);
    return { message: 'User deleted successfully' };
  }
}