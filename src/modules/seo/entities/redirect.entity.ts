import { Entity, Property, Enum } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'redirects' })
export class Redirect extends BaseEntity {
    @Property({ unique: true })
    fromPath!: string;

    @Property()
    toPath!: string;

    @Property({ default: 301 })
    statusCode: number = 301;
}
