import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express'; // Nhớ import type

import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto, OnboardingDto } from './dto/user.dto';
import { UpdateUserStatusDto, AssignRolesDto } from './dto/admin-user.dto';
import { ResponseMessage } from '@/core/decorators/response-message.decorator';
import { ApiMessage } from '@/shared/enums/message.enum';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

// Interface mở rộng để tránh lỗi ESLint (Copy lại từ AuthController hoặc đưa vào file shared)
interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // 1. Xem hồ sơ cá nhân
  // GET /users/me
  @Get('me')
  @ResponseMessage(ApiMessage.GET_PROFILE_SUCCESS)
  getMe(@Req() req: RequestWithUser) {
    return this.usersService.getMe(req.user.sub);
  }

  // 2. Cập nhật hồ sơ
  // PATCH /users/me
  @Patch('me')
  @ResponseMessage(ApiMessage.UPDATE_PROFILE_SUCCESS)
  updateProfile(@Req() req: RequestWithUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(
      req.user.sub,
      req.user.sessionId,
      dto,
    );
  }

  // 2.1 Onboarding (Cập nhật hồ sơ + Avatar)
  @Post('onboarding')
  @UseInterceptors(FileInterceptor('avatar'))
  @ResponseMessage(ApiMessage.UPDATE_PROFILE_SUCCESS)
  onboarding(
    @Req() req: RequestWithUser,
    @Body() dto: OnboardingDto,
    @UploadedFile() avatarFile?: any, // Sử dụng any vì thiếu @types/multer
  ) {
    return this.usersService.onboarding(
      req.user.sub,
      req.user.sessionId,
      dto,
      avatarFile,
    );
  }

  // 3. Đổi mật khẩu
  // PUT /users/me/password
  @Put('me/password')
  @ResponseMessage(ApiMessage.CHANGE_PASSWORD_SUCCESS)
  changePassword(@Req() req: RequestWithUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.sub, dto);
  }

  // 4. Xem danh sách phiên đăng nhập
  // GET /users/me/sessions
  @Get('me/sessions')
  @ResponseMessage(ApiMessage.GET_SESSIONS_SUCCESS)
  getMySessions(@Req() req: RequestWithUser) {
    return this.usersService.getMySessions(req.user.sub);
  }

  // 5. Đăng xuất một thiết bị cụ thể (Revoke)
  // DELETE /users/me/sessions/:id
  @Delete('me/sessions/:id')
  @ResponseMessage(ApiMessage.REVOKE_SESSION_SUCCESS)
  revokeSession(@Req() req: RequestWithUser, @Param('id') sessionId: string) {
    return this.usersService.revokeSession(req.user.sub, sessionId);
  }

  // --- ADMIN AREA ---

  // 6. Lấy danh sách users (Có phân trang) - Chỉ Admin
  // GET /users?page=1&limit=10
  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('users.read')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAllUsers(page, limit);
  }

  // 7. Admin: Update User Status (Block/Ban/Active)
  // PUT /users/:id/status
  @Put(':id/status')
  @UseGuards(PermissionsGuard)
  @Permissions('users.update')
  @ResponseMessage(ApiMessage.UPDATE_PROFILE_SUCCESS)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateUserStatus(id, dto);
  }

  // 8. Admin: Assign Roles
  // POST /users/:id/roles
  @Post(':id/roles')
  @UseGuards(PermissionsGuard)
  @Permissions('users.update') // Hoặc permission riêng: roles.assign
  @ResponseMessage('Roles assigned successfully')
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    return this.usersService.assignRoles(id, dto);
  }

  // 9. Admin: Delete User (Hard Delete)
  // DELETE /users/:id
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.delete')
  @ResponseMessage('User deleted successfully')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}