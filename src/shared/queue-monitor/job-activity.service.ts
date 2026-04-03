import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { InjectEntityManager } from '@mikro-orm/nestjs';
import { JobActivity } from './entities/job-activity.entity';

@Injectable()
export class JobActivityService {
    private readonly logger = new Logger(JobActivityService.name);

    constructor(
        @InjectEntityManager('mongo-connection')
        private readonly em: EntityManager
    ) { }

    async recordActivity(data: { queue: string; jobId: string } & Partial<JobActivity>) {
        const em = this.em.fork();
        try {
            const activity = em.create(JobActivity, {
                ...data,
                state: data.state || 'active',
                jobName: data.jobName || 'unknown',
                progress: data.progress || 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            });
            await em.persistAndFlush(activity);
        } catch (err) {
            this.logger.error(`Failed to record job activity: ${err.message}`);
        }
    }

    async updateProgress(queue: string, jobId: string, progress: number) {
        const em = this.em.fork();
        try {
            const activity = await em.findOne(JobActivity, { queue, jobId }, { orderBy: { createdAt: 'DESC' } });
            if (activity) {
                activity.progress = progress;
                await em.flush();
            }
        } catch (err) {
            this.logger.error(`Failed to update job progress: ${err.message}`);
        }
    }

    async getRecentActivities(limit = 50) {
        return this.em.find(JobActivity, {}, { limit, orderBy: { createdAt: 'DESC' } });
    }

    async getQueueStats() {
        return this.em.aggregate(JobActivity, [
            { $group: { _id: { queue: '$queue', state: '$state' }, count: { $sum: 1 } } }
        ]);
    }
}
