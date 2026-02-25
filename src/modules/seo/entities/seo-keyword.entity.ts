import { Entity, Property, ManyToOne, OptionalProps } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'seo_keywords' })
export class SeoKeyword extends BaseEntity {
    @Property({ length: 100, unique: true })
    keyword!: string;

    @Property({ length: 500 })
    targetUrl!: string;

    @Property({ default: 1 })
    linkLimit: number = 1;

    @Property({ default: true })
    isActive: boolean = true;

    @ManyToOne(() => User, { nullable: true })
    createdBy?: User;

    [OptionalProps]?: 'isActive' | 'linkLimit' | 'createdAt' | 'updatedAt';
}
