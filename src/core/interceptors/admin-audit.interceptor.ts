import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SseService } from '@/shared/queue-monitor/sse.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AdminAuditInterceptor.name);

    constructor(private readonly sseService: SseService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, user } = request;

        // Track write operations only
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return next.handle();
        }

        // Skip if not an admin operation or no user
        if (!user || !url.includes('/admin')) {
            return next.handle();
        }

        return next.handle().pipe(
            tap(() => {
                const action = `${method} ${url}`;
                this.logger.log(`Admin ${user.email} performed action: ${action}`);

                this.sseService.emitToAdmins('admin_audit', {
                    userId: user.id,
                    userEmail: user.email,
                    method,
                    url,
                    timestamp: new Date(),
                });
            }),
        );
    }
}
