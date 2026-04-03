import { Entity, Property } from '@mikro-orm/core';
import { MongoBaseEntity } from '@/core/base/mongo-base.entity';

@Entity({ collection: 'elearning_categories' })
export class ElearningCategory extends MongoBaseEntity {
    @Property()
    title!: string;

    @Property({ nullable: true })
    subtitle?: string;

    @Property()
    slug!: string;

    @Property({ default: 0 })
    sortOrder: number = 0;

    @Property({ default: true })
    isActive: boolean = true;
}
