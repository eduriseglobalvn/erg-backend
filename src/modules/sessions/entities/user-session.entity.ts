import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'user_sessions' })
export class UserSession extends BaseEntity {
  // Quan hệ N-1: Một session thuộc về 1 User
  @ManyToOne(() => User)
  user!: User;

  // Token dùng để cấp lại Access Token mới.
  // Dùng type 'text' vì token có thể rất dài.
  @Property({ type: 'text' })
  refreshToken!: string;

  // Lưu thông tin thiết bị (Chrome, iPhone,...)
  @Property({ nullable: true })
  userAgent?: string;

  // Lưu IP để truy vết nếu có bất thường
  @Property({ nullable: true })
  ipAddress?: string;

  // Thời điểm cuối cùng user tương tác (để sắp xếp session gần nhất)
  @Property({ nullable: true })
  lastActiveAt?: Date = new Date();

  // Cờ đánh dấu: Nếu true = token này đã bị hủy/hack -> Cấm đăng nhập
  @Property({ default: false })
  isRevoked: boolean = false;

  // Thời gian hết hạn của Refresh Token (thường là 7 ngày hoặc 30 ngày)
  @Property()
  expiresAt!: Date;
}
