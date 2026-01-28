import { Entity, Property, OneToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'profiles' })
export class TeacherProfile extends BaseEntity {
  @OneToOne(() => User, (user) => user.teacherProfile, { owner: true })
  user!: User;

  @Property({ type: 'text', nullable: true })
  bio?: string; // Giới thiệu bản thân

  @Property({ type: 'text', nullable: true })
  teachingPhilosophy?: string; // Triết lý giảng dạy

  // Thay vì Subject, ta lưu danh sách chuyên môn dạng mảng (JSON trong MySQL)
  @Property({ type: 'json', nullable: true })
  specialties?: string[]; // Ví dụ: ['MOS Excel', 'IC3 GS6', 'IELTS Writing']

  @Property({ type: 'float', default: 0 })
  rating: number = 0;

  @Property({ type: 'text', nullable: true })
  internalNote?: string; // Ghi chú nội bộ dành cho HR
}