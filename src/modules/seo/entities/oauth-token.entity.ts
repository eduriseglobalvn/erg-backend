import { Entity, Property, OptionalProps } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';

@Entity({ tableName: 'oauth_tokens' })
export class OAuthToken extends BaseEntity {
    @Property({ length: 50, unique: true })
    service!: string; // e.g., 'google_search_console'

    @Property({ type: 'text' })
    accessToken!: string;

    @Property({ type: 'text' })
    refreshToken!: string;

    @Property({ nullable: true })
    expiresAt?: Date;

    @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    [OptionalProps]?: 'updatedAt' | 'expiresAt' | 'createdAt';
}
