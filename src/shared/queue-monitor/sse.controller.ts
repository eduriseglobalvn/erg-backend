import { Controller, Get, Sse, UseGuards, Request } from '@nestjs/common';
import { SseService } from './sse.service';
import { Observable, interval, map, merge } from 'rxjs';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SseController {
    constructor(private readonly sseService: SseService) { }

    @Sse('stream')
    @Permissions('system.monitor')
    stream(@Request() req): Observable<any> {
        const user = req.user;
        const userId = user.id;
        const userRoles = user.roles || [];

        const heartbeat = interval(30000).pipe(
            map(() => ({ type: 'heartbeat', data: { timestamp: new Date() } }))
        );

        const eventStream = this.sseService.getEventStream(userId, userRoles);

        return merge(heartbeat, eventStream);
    }
}
