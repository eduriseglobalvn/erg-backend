import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'elearning_units' })
@Index({ properties: ['levelId'] })
export class ElearningUnit extends MongoBaseEntity {
    /** Tham chiếu tới ElearningLevel._id (serialized string) */
    @Property()
    levelId!: string;

    @Property()
    title!: string;

    @Property({ nullable: true })
    description?: string;

    @Property({ nullable: true })
    studyLink?: string;

    @Property({ nullable: true })
    testLink?: string;

    @Property({ default: 0 })
    sortOrder: number = 0;

    @Property({ default: true })
    isActive: boolean = true;
}
