// src/modules/operations/entities/work-shift.entity.ts

import { Entity, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { School } from '@/modules/organization/entities/school.entity';
import { ShiftStatus, ShiftType } from '@/shared/enums/app.enum';

@Entity({ tableName: 'work_shifts' })
export class WorkShift extends BaseEntity {
  @ManyToOne(() => User)
  user!: User; // Nhân sự thực hiện ca làm việc

  @ManyToOne(() => School)
  school!: School; // Cơ sở/Trường học nơi diễn ra ca làm

  @Property({ nullable: true })
  room?: string; // Bổ sung: Phòng học hoặc vị trí cụ thể (VD: Phòng 101)

  // Thay vì @ManyToOne(() => Subject), ta dùng string để khớp với logic Courses đã sửa
  @Property({ nullable: true })
  teachingSubject?: string; // Lưu tên môn dạy nếu type là TEACHING (VD: MOS Excel)

  @Property()
  startTime!: Date;

  @Property()
  endTime!: Date;

  @Enum({ items: () => ShiftType })
  type!: ShiftType;

  @Enum({ items: () => ShiftStatus, default: ShiftStatus.SCHEDULED })
  status: ShiftStatus = ShiftStatus.SCHEDULED;

  @Property({ type: 'text', nullable: true })
  note?: string;

  // --- BỔ SUNG CHO NGHIỆP VỤ QUẢN TRỊ ---

  @Property({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  remuneration: number = 0; // Thù lao riêng cho ca này (nếu có, dùng để tính lương)

  @ManyToOne(() => User, { nullable: true })
  confirmedBy?: User; // Người xác nhận (Check-in/Check-out) cho nhân viên này

  @Property({ nullable: true })
  actualStartTime?: Date; // Giờ thực tế bắt đầu (Dùng khi chấm công)

  @Property({ nullable: true })
  actualEndTime?: Date; // Giờ thực tế kết thúc
}