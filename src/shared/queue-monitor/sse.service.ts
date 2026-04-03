import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SseEvent {
    type: string;
    data: any;
    userId?: string;
    roles?: string[];
}

@Injectable()
export class SseService {
    private readonly logger = new Logger(SseService.name);
    private readonly eventSubject = new Subject<SseEvent>();

    emit(event: SseEvent) {
        this.eventSubject.next(event);
    }

    emitToAdmins(type: string, data: any) {
        this.emit({ type, data, roles: ['admin', 'super_admin'] });
    }

    emitToUser(userId: string, type: string, data: any) {
        this.emit({ type, data, userId });
    }

    getEventStream(userId?: string, roles?: string[]): Observable<any> {
        return this.eventSubject.asObservable().pipe(
            filter(event => {
                // Filter by user ID if provided
                if (event.userId && event.userId !== userId) return false;

                // Filter by roles if provided
                if (event.roles && roles) {
                    const hasRole = event.roles.some(role => roles.includes(role));
                    if (!hasRole) return false;
                } else if (event.roles && !roles) {
                    return false;
                }

                return true;
            }),
            map(event => ({
                data: event.data,
                type: event.type,
            }))
        );
    }
}
