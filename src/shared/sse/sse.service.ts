import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, map } from 'rxjs';

export interface SseEvent {
    data: any;
    type?: string;
    id?: string;
}

export interface MessageData {
    data: string | object;
    id?: string;
    type?: string;
    retry?: number;
}

@Injectable()
export class SseService {
    private readonly logger = new Logger(SseService.name);
    private readonly eventSubject = new Subject<MessageData>();

    /**
     * Subscribe to the global event stream
     */
    subscribe(): Observable<MessageData> {
        return this.eventSubject.asObservable();
    }

    /**
     * Emit a new event to all subscribers
     */
    emit(event: MessageData) {
        this.logger.debug(`Broadcasting SSE event: ${event.type || 'message'}`);
        this.eventSubject.next(event);
    }

    /**
     * Convenience method for job status updates
     */
    emitJobProgress(jobId: string, progress: number, data?: any) {
        this.emit({
            type: 'job_progress',
            data: { jobId, progress, ...data },
        });
    }

    emitJobCompleted(jobId: string, result: any) {
        this.emit({
            type: 'job_completed',
            data: { jobId, result },
        });
    }

    emitJobFailed(jobId: string, error: string) {
        this.emit({
            type: 'job_failed',
            data: { jobId, error },
        });
    }
}
