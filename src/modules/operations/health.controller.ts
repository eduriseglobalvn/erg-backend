import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MikroORM } from '@mikro-orm/core';
import { InjectMikroORM } from '@mikro-orm/nestjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Operations')
@Controller('health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(
        private readonly orm: MikroORM,
        @InjectMikroORM('mongo-connection') private readonly mongoOrm: MikroORM,
        @InjectQueue('ai-content-queue') private aiQueue: Queue,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Health Check' })
    @ApiResponse({ status: 200, description: 'System is healthy' })
    @ApiResponse({ status: 503, description: 'Service unavailable' })
    async check() {
        const health: any = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {},
        };

        let isHealthy = true;

        // 1. MySQL Health
        try {
            const isConnected = await this.orm.isConnected();
            health.services.mysql = isConnected ? 'up' : 'down';
            if (!isConnected) isHealthy = false;
        } catch (e) {
            health.services.mysql = 'down';
            health.services.mysql_error = e.message;
            isHealthy = false;
        }

        // 2. MongoDB Health
        try {
            const isConnected = await this.mongoOrm.isConnected();
            health.services.mongodb = isConnected ? 'up' : 'down';
            if (!isConnected) isHealthy = false;
        } catch (e) {
            health.services.mongodb = 'down';
            health.services.mongodb_error = e.message;
            isHealthy = false;
        }

        // 3. Redis/BullMQ Health
        try {
            const client = await this.aiQueue.client;
            const redisStatus = client.status;
            health.services.redis = redisStatus === 'ready' ? 'up' : 'down';
            if (redisStatus !== 'ready') isHealthy = false;
        } catch (e) {
            health.services.redis = 'down';
            isHealthy = false;
        }

        if (!isHealthy) {
            health.status = 'error';
            this.logger.error('Health Check Failed', health);
            throw new ServiceUnavailableException(health);
        }

        return health;
    }
}

