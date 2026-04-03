// src/modules/users/entities/user.entity.ts

import {
  Entity,
  Property,
  Enum,
  OneToMany,
  ManyToOne,
  OneToOne,
  Collection,
  Cascade,
  ManyToMany,
  Index,
} from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { AuthProvider, UserStatus } from '@/shared/enums/app.enum';
import type { JobPosition } from '@/modules/organization/entities/job-position.entity';
import type { Region } from '@/modules/organization/entities/region.entity';
import { UserSession } from '@/modules/sessions/entities/user-session.entity';
import { SocialAccount } from './social-account.entity';
import { Role } from '@/modules/access-control/entities/role.entity';
import type { TeacherProfile } from '@/modules/profiles/entities/profile.entity';
import type { Post } from '@/modules/posts/entities/post.entity';
import type { WorkShift } from '@/modules/operations/entities/work-shift.entity';

@Entity({ tableName: 'users' })
@Index({ properties: ['status', 'createdAt'] })
export class User extends BaseEntity {
  @Property({ unique: true })
  email!: string;

  @Property({ nullable: true, hidden: true })
  password?: string;

  @Property({ nullable: true, index: true })
  fullName?: string;

  @Property({ nullable: true, index: true })
  phone?: string;

  @Property({ nullable: true })
  avatarUrl?: string;

  @Property({ type: 'text', nullable: true })
  bio?: string;

  @Enum({ items: () => AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider = AuthProvider.LOCAL;

  // SỬA: Mặc định là PENDING thay vì ACTIVE
  @Enum({ items: () => UserStatus, default: UserStatus.PENDING })
  status: UserStatus = UserStatus.PENDING;

  // THÊM: Mã PIN kích hoạt (Lưu chuỗi 6 số)
  @Property({ nullable: true, hidden: true })
  activationPin?: string;

  // THÊM: Thời gian hết hạn của PIN
  @Property({ nullable: true })
  pinExpiresAt?: Date;

  // THÊM: Cờ đánh dấu đã hoàn thiện profile chưa (cho luồng Optional Profile)
  @Property({ default: false })
  isProfileCompleted: boolean = false;

  @Property({ default: 0 })
  tokenVersion: number = 0;

  // --- THÊM THEO PHASE 2 ---
  @Property({ nullable: true })
  dateOfBirth?: Date;

  @Property({ nullable: true })
  gender?: string; // e.g., 'male', 'female', 'other'

  @Property({ nullable: true })
  address?: string;

  @Property({ nullable: true })
  city?: string;

  @Property({ nullable: true })
  district?: string;

  @Property({ type: 'json', nullable: true })
  socialLinks?: { facebook?: string; linkedin?: string; github?: string; };

  @Property({ nullable: true })
  lastLoginAt?: Date;

  @Property({ default: 0 })
  loginCount: number = 0;

  @Property({ type: 'text', nullable: true })
  notes?: string; // Admin notes about user

  @Property({ type: 'json', nullable: true })
  preferences?: { language?: string; timezone?: string; emailNotifications?: boolean; };

  // --- QUAN HỆ CƠ CẤU TỔ CHỨC ---

  @ManyToOne('JobPosition', { nullable: true })
  jobPosition?: JobPosition;

  @ManyToOne(() => User, { nullable: true })
  manager?: User;

  @ManyToOne('Region', { nullable: true })
  region?: Region;

  // --- QUAN HỆ AUTH & SESSION ---

  @OneToMany(() => SocialAccount, (account) => account.user, {
    cascade: [Cascade.ALL],
  })
  socialAccounts = new Collection<SocialAccount>(this);

  @OneToMany(() => UserSession, (session) => session.user, {
    cascade: [Cascade.ALL],
  })
  sessions = new Collection<UserSession>(this);

  @ManyToMany(() => Role, 'users', { owner: true })
  roles = new Collection<Role>(this);

  // --- QUAN HỆ PROFILE & NGHIỆP VỤ ---

  @OneToOne('TeacherProfile', (profile: any) => profile.user, { nullable: true })
  teacherProfile?: TeacherProfile;

  // Quan hệ ngược để biết User này đã tạo những bài viết nào (bao gồm cả AI user)
  @OneToMany('Post', (post: any) => post.createdBy)
  createdPosts = new Collection<Post>(this);

  // Quan hệ ngược để biết Admin/Editor này đã duyệt những bài nào
  @OneToMany('Post', (post: any) => post.publishedBy)
  publishedPosts = new Collection<Post>(this);

  // Lịch làm việc của nhân sự này
  @OneToMany('WorkShift', (shift: any) => shift.user)
  workShifts = new Collection<WorkShift>(this);
}
