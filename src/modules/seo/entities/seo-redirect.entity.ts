import { Entity, Property, ManyToOne, OptionalProps } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity({ tableName: 'seo_redirects' })
export class SeoRedirect extends BaseEntity {
    @Property({ length: 500 })
    fromPattern!: string;

    @Property({ length: 500 })
    toUrl!: string;

    @Property({ length: 3, default: '301' })
    type: string = '301';

    @Property({ default: false })
    isRegex: boolean = false;

    @Property({ default: true })
    isActive: boolean = true;

    @Property({ default: 0 })
    hitCount: number = 0;

    @ManyToOne(() => User, { nullable: true })
    createdBy?: User;

    [OptionalProps]?: 'type' | 'isActive' | 'hitCount' | 'createdAt' | 'updatedAt' | 'isRegex';
}
