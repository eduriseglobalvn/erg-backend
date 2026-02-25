import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

export enum JobStatus {
    HOT = 'hot',
    NEW = 'new',
    URGENT = 'urgent',
    NORMAL = 'normal',
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

    @Property()
    location: string;

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
