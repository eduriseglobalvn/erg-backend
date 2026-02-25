import { Entity, PrimaryKey, Property, Enum, ManyToOne } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Job } from './job.entity';

export enum CandidateStatus {
    PENDING = 'PENDING',
    REVIEWING = 'REVIEWING',
    INTERVIEW = 'INTERVIEW',
    OFFER = 'OFFER',
    HIRED = 'HIRED',
    REJECTED = 'REJECTED',
}

export enum ApplyType {
    ONLINE = 'ONLINE',   // Ứng tuyển qua form website
    ZALO = 'ZALO',       // Admin nhập tay từ Zalo
}

@Entity({ tableName: 'candidates' })
export class Candidate {
    @PrimaryKey()
    id: string = uuidv4();

    @ManyToOne(() => Job, { nullable: true })
    job?: Job;              // nullable: hỗ trợ gửi CV chung không gắn job

    @Property()
    fullName: string;

    @Property()
    email: string;

    @Property()
    phone: string;

    @Property({ nullable: true })
    cvUrl?: string;         // nullable: Zalo apply không cần CV file

    @Property({ type: 'text', nullable: true })
    coverLetter?: string;   // Thư xin việc (form online)

    @Property({ type: 'text', nullable: true })
    note?: string;          // Ghi chú nội bộ (Admin nhập khi dùng Zalo)

    @Property({ type: 'text', nullable: true })
    publicNote?: string;    // Thông tin hiển thị công khai cho ứng viên (vd: Lịch hẹn phỏng vấn)

    @Enum({ items: () => ApplyType, default: ApplyType.ONLINE })
    applyType: ApplyType = ApplyType.ONLINE;

    @Enum({ items: () => CandidateStatus, default: CandidateStatus.PENDING })
    status: CandidateStatus = CandidateStatus.PENDING;

    @Property({ unique: true })
    trackingCode: string = uuidv4();

    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
