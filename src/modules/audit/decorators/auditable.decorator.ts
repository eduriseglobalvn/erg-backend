import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '../audit.interceptor';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_RESOURCE_KEY = 'audit_resource';

export interface AuditConfig {
    action: string;
    resourceType: string;
}

export function Auditable(config: AuditConfig) {
    return applyDecorators(
        SetMetadata(AUDIT_ACTION_KEY, config.action),
        SetMetadata(AUDIT_RESOURCE_KEY, config.resourceType),
        UseInterceptors(AuditInterceptor)
    );
}
