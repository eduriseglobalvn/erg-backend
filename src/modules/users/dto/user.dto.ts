import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';

// 1. DTO Cập nhật thông tin cá nhân
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string; // Tạm thời gửi string URL, sau này làm upload ảnh sau

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string; // Dùng chuỗi ISO cho API

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  socialLinks?: { facebook?: string; linkedin?: string; github?: string; };

  @IsOptional()
  preferences?: { language?: string; timezone?: string; emailNotifications?: boolean; };
}

export class OnboardingDto extends UpdateProfileDto { }

// 2. DTO Đổi mật khẩu
export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}