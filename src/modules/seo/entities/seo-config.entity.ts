import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'seo_configs' })
export class SeoConfig {
    @PrimaryKey()
    key!: string; // e.g. 'organization', 'robots', 'social', 'defaults'

    @Property({ type: 'json' })
    value!: any;

    @Property()
    updatedAt: Date = new Date();

    @Property({ nullable: true })
    updatedBy?: string; // User ID
}
