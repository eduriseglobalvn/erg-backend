import { Entity, Property, Index } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'elearning_levels' })
@Index({ properties: ['categoryId'] })
export class ElearningLevel extends MongoBaseEntity {
    /** Tham chiếu tới ElearningCategory._id (serialized string) */
    @Property()
    categoryId!: string;

    @Property()
    title!: string;

    @Property({ nullable: true })
    description?: string;

    @Property()
    slug!: string;

    @Property({ default: 0 })
    sortOrder: number = 0;

    @Property({ default: true })
    isActive: boolean = true;
}
