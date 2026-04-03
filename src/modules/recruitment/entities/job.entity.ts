import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

export enum JobStatus {
    HOT = 'hot',
    NEW = 'new',
    URGENT = 'urgent',
    NORMAL = 'normal',
}

export enum EmploymentType {
    FULL_TIME = 'FULL_TIME',
    PART_TIME = 'PART_TIME',
    CONTRACT = 'CONTRACT',
    INTERN = 'INTERN',
}

@Entity({ tableName: 'jobs' })
export class Job {
    @PrimaryKey()
    id: string = uuidv4();

    @Property({ unique: true })
    slug: string;

    @Property()
    title: string;

    @Enum({ items: () => JobStatus, default: JobStatus.NORMAL })
    status: JobStatus = JobStatus.NORMAL;

    // --- Badge Flags ---
    @Property({ default: false })
    isHot: boolean = false;

    @Property({ default: false })
    isNew: boolean = false; // Có thể set tay hoặc tự động dựa vào createdAt

    @Property({ default: false })
    isUrgent: boolean = false; // Tuyển gấp

    @Property({ default: 'Thỏa thuận' })
    salary: string;

    @Property({ default: 1 })
    quantity: number;

    @Property({ default: 0 })
    viewCount: number = 0;

    @Property()
    workType: string; // 'Toàn thời gian', 'Part-time' - For filtering

    @Property({ nullable: true })
    workSchedule?: string; // 'Từ thứ 2 đến thứ 6' - For UI Display

    @Property({ nullable: true })
    postDate?: string; // Custom post date overriding createdAt if present

    @Property()
    deadline: string; // Stored as string for flexibility or Date if preferred

    @Property({ nullable: true })
    deadlineDate?: Date; // For schema.org validThrough

    @Property()
    location: string;

    // --- SCHEMA.ORG FIELDS ---
    @Enum({ items: () => EmploymentType, nullable: true })
    employmentType?: EmploymentType = EmploymentType.FULL_TIME;

    @Property({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    salaryMin?: number;

    @Property({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    salaryMax?: number;

    @Property({ default: 'VND' })
    salaryCurrency: string = 'VND';

    @Property({ nullable: true })
    streetAddress?: string;

    @Property({ nullable: true })
    city?: string;

    @Property({ default: 'VN' })
    country: string = 'VN';

    @Property({ type: 'text', nullable: true })
    summary: string;

    @Property({ type: 'json' })
    description: string[];

    @Property({ type: 'json' })
    requirements: string[];

    @Property({ type: 'json' })
    benefits: string[];

    @Property({ default: true })
    isActive: boolean = true;

    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
