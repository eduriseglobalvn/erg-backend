import { Entity, Property, PrimaryKey, Index } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

@Entity({ collection: 'job_activities' })
export class JobActivity {
    @PrimaryKey()
    _id!: ObjectId;

    @Index()
    @Property()
    queue!: string;

    @Index()
    @Property()
    jobId!: string;

    @Property()
    jobName!: string;

    @Property()
    state!: string; // waiting, active, completed, failed, delayed, stalled

    @Property({ default: 0 })
    progress!: number;

    @Property({ type: 'json', nullable: true })
    result?: any;

    @Property({ type: 'json', nullable: true })
    error?: any;

    @Property({ nullable: true })
    durationMs?: number;

    @Index()
    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    // TTL Index 7 days
    @Index({ options: { expireAfterSeconds: 7 * 24 * 3600 } })
    @Property({ nullable: true })
    expiresAt: Date = new Date(Date.now() + 7 * 24 * 3600 * 1000);
}
