import { Entity, Property, PrimaryKey, OptionalProps } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

@Entity({ tableName: 'admin_audit_logs' })
export class AdminAuditLog {
    @PrimaryKey()
    _id!: ObjectId;

    @Property()
    id!: string;

    @Property()
    userId!: string; // Admin who performed the action

    @Property({ nullable: true })
    userEmail?: string;

    @Property()
    action!: string; // e.g., 'UPDATE_ROLE', 'DELETE_USER', 'ASSIGN_PERMISSION'

    @Property()
    resourceType!: string; // e.g., 'Role', 'User'

    @Property({ nullable: true })
    resourceId?: string;

    // Store the state before the change (if applicable)
    @Property({ type: 'json', nullable: true })
    oldValue?: any;

    // Store the state after the change
    @Property({ type: 'json', nullable: true })
    newValue?: any;

    @Property()
    ipAddress!: string;

    @Property({ nullable: true })
    userAgent?: string;

    @Property({ defaultRaw: 'now()' })
    createdAt: Date = new Date();
}
