import { Module, Global } from '@nestjs/common';
import { QueueEventsService } from './queue-events.service';
import { JobActivityService } from './job-activity.service';
import { JobActivity } from './entities/job-activity.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { BacklogWatcherService } from './backlog-watcher.service';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminAuditInterceptor } from '@/core/interceptors/admin-audit.interceptor';
import { QueueMonitorController } from './queue-monitor.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Global()
@Module({
    imports: [
        MikroOrmModule.forFeature([JobActivity], 'mongo-connection'),
        BullModule.registerQueue(
            { name: 'crawl_discovery' },
            { name: 'crawl_scrape' },
            { name: 'crawl_process' },
            { name: 'crawl_seo' },
            { name: 'crawl_publish' }
        ),
        NotificationsModule,
    ],
    providers: [
        QueueEventsService,
        JobActivityService,
        SseService,
        BacklogWatcherService,
        {
            provide: APP_INTERCEPTOR,
            useClass: AdminAuditInterceptor,
        },
    ],
    controllers: [SseController, QueueMonitorController],
    exports: [QueueEventsService, JobActivityService, SseService, BacklogWatcherService],
})
export class QueueMonitorModule { }
