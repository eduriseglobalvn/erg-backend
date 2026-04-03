import { Controller, Get, Post, Param, Body, UseGuards, UnauthorizedException, Sse, MessageEvent } from '@nestjs/common';
import { QueueEventsService } from './queue-events.service';
import { JobActivityService } from './job-activity.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SseService } from '../sse/sse.service';
import { Observable, map } from 'rxjs';

@Controller('admin/monitor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QueueMonitorController {
    constructor(
        private readonly queueEventsService: QueueEventsService,
        private readonly jobActivityService: JobActivityService,
        private readonly sseService: SseService,
        @InjectQueue('crawl_discovery') private discoveryQueue: Queue,
        @InjectQueue('crawl_scrape') private scrapeQueue: Queue,
        @InjectQueue('crawl_process') private processQueue: Queue,
        @InjectQueue('crawl_seo') private seoQueue: Queue,
        @InjectQueue('crawl_publish') private publishQueue: Queue,
    ) { }

    @Sse('sse')
    @Permissions('system.monitor')
    sse(): Observable<MessageEvent> {
        return this.sseService.subscribe().pipe(
            map(event => ({
                data: event.data,
                type: event.type,
                id: event.id
            } as MessageEvent))
        );
    }

    @Get('dashboard')
    @Permissions('system.monitor')
    async getDashboard() {
        const metrics = await this.queueEventsService.getAllQueueMetrics();
        const recentActivities = await this.jobActivityService.getRecentActivities(10);
        const stats = await this.jobActivityService.getQueueStats();

        return {
            metrics,
            recentActivities,
            stats
        };
    }

    @Get('queues')
    @Permissions('system.monitor')
    async getQueueMetrics() {
        const queueList = [
            { name: 'crawl_discovery', queue: this.discoveryQueue },
            { name: 'crawl_scrape', queue: this.scrapeQueue },
            { name: 'crawl_process', queue: this.processQueue },
            { name: 'crawl_seo', queue: this.seoQueue },
            { name: 'crawl_publish', queue: this.publishQueue }
        ];

        const results = await Promise.all(queueList.map(async ({ name, queue }) => {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
                queue.getDelayedCount(),
            ]);

            return {
                name,
                counts: { waiting, active, completed, failed, delayed },
                isPaused: await queue.isPaused()
            };
        }));

        return results;
    }

    @Post('queues/:name/pause')
    @Permissions('system.monitor')
    async pauseQueue(@Param('name') name: string) {
        const queue = this.getQueueByName(name);
        await queue.pause();
        return { success: true, message: `Queue ${name} paused` };
    }

    @Post('queues/:name/resume')
    @Permissions('system.monitor')
    async resumeQueue(@Param('name') name: string) {
        const queue = this.getQueueByName(name);
        await queue.resume();
        return { success: true, message: `Queue ${name} resumed` };
    }

    @Post('jobs/:jobId/retry')
    @Permissions('system.monitor')
    async retryJob(@Param('jobId') jobId: string, @Body('queue') queueName: string) {
        const queue = this.getQueueByName(queueName);
        const job = await queue.getJob(jobId);
        if (!job) throw new Error('Job not found');
        await job.retry();
        return { success: true, message: `Job ${jobId} retried` };
    }

    private getQueueByName(name: string): Queue {
        const mapping: Record<string, Queue> = {
            crawl_discovery: this.discoveryQueue,
            crawl_scrape: this.scrapeQueue,
            crawl_process: this.processQueue,
            crawl_seo: this.seoQueue,
            crawl_publish: this.publishQueue,
        };
        const queue = mapping[name];
        if (!queue) throw new UnauthorizedException(`Queue ${name} not supported or not found`);
        return queue;
    }
}
