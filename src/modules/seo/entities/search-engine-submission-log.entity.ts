import { Entity, Property, Enum } from '@mikro-orm/core';
import { MongoBaseEntity } from '../../../core/base/mongo-base.entity';

export enum SubmissionStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
}

@Entity({ collection: 'seo_submission_logs' })
export class SearchEngineSubmissionLog extends MongoBaseEntity {
    @Property()
    url!: string;

    @Property()
    engine!: string; // e.g: 'Google', 'Bing', 'Yandex', 'Naver'

    @Enum(() => SubmissionStatus)
    status: SubmissionStatus = SubmissionStatus.PENDING;

    @Property({ nullable: true })
    errorMessage?: string;

    @Property({ nullable: true })
    responsePayload?: any;

    @Property()
    submittedAt: Date = new Date();
}
