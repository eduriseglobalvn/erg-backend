import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY, AUDIT_RESOURCE_KEY } from './decorators/auditable.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditInterceptor.name);

    constructor(
        private reflector: Reflector,
        private auditService: AuditService
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
        const resourceType = this.reflector.get<string>(AUDIT_RESOURCE_KEY, context.getHandler());

        if (!action || !resourceType) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const ipAddress = request.ip || request.connection?.remoteAddress || 'unknown';
        const userAgent = request.headers['user-agent'] || 'unknown';

        // Capture request body/params as 'newValue' or identify 'resourceId'
        const resourceId = request.params.id;
        const newValue = request.body;

        return next.handle().pipe(
            tap((response) => {
                // Log action asynchronously after successful response
                if (user) {
                    this.auditService.logAction({
                        userId: user.sub || user.id,
                        userEmail: user.email,
                        action,
                        resourceType,
                        resourceId,
                        newValue, // Intentionally simplified for MVP; could be refined to diffing later
                        ipAddress,
                        userAgent
                    }).catch(err => this.logger.error('Audit async log failed', err));
                }
            })
        );
    }
}
