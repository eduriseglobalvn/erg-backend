import { Entity, PrimaryKey, Property, Unique, OptionalProps } from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity()
export class SystemConfig {
    [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

    @PrimaryKey()
    id: string = v4();


    @Property()
    @Unique()
    key: string;

    @Property({ type: 'json' })
    value: any;

    @Property({ nullable: true })
    description?: string;

    @Property({ nullable: true })
    updatedBy?: string;

    @Property({ onCreate: () => new Date() })
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
