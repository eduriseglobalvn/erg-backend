import { Entity, Property, OptionalProps } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'seo_404_logs' })
export class Seo404Log extends BaseEntity {
    @Property({ length: 500, unique: true })
    url!: string;

    @Property({ length: 500, nullable: true })
    referer?: string;

    @Property({ type: 'text', nullable: true })
    userAgent?: string;

    @Property({ default: 1 })
    hitCount: number = 1;

    @Property({ onCreate: () => new Date() })
    lastSeen: Date = new Date();

    @Property({ onCreate: () => new Date() })
    firstSeen: Date = new Date();

    [OptionalProps]?: 'hitCount' | 'lastSeen' | 'firstSeen' | 'createdAt' | 'updatedAt';
}
