import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MonitoringService } from '../services/monitoring.service';

@Injectable()
export class Seo404Interceptor implements NestInterceptor {
    private readonly logger = new Logger(Seo404Interceptor.name);

    constructor(private readonly monitoringService: MonitoringService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            catchError((error) => {
                if (error instanceof NotFoundException) {
                    const request = context.switchToHttp().getRequest();
                    // Log the 404 hit in the background
                    this.monitoringService.log404(
                        request.url,
                        request.headers['referer'] as string,
                        request.headers['user-agent'] as string,
                    ).catch(err => {
                        // Silent fail for logging
                        this.logger.error('Failed to log 404 event', err);
                    });
                }
                return throwError(() => error);
            }),
        );
    }
}
