# ERG Backend - Hệ thống Notification toàn diện & Background Task Monitor

> **Reviewer:** Senior Developer & PO
> **Ngày:** 2026-03-03
> **Scope:** erg-backend (NestJS 11+)
> **Mục tiêu:** Mọi hoạt động trên admin đều được thông báo. Tác vụ nền có monitoring dashboard.

---

## MỤC LỤC

1. [Hiện trạng & Gap Analysis](#1-hiện-trạng--gap-analysis)
2. [Thiết kế Notification System toàn diện](#2-thiết-kế-notification-system-toàn-diện)
3. [Global Queue Event Listener](#3-global-queue-event-listener)
4. [Job Activity Tracker (Background Task Monitor)](#4-job-activity-tracker-background-task-monitor)
5. [Real-time Events (SSE)](#5-real-time-events-sse)
6. [Notification cho từng Module cụ thể](#6-notification-cho-từng-module-cụ-thể)
7. [Batch & Aggregation Notifications](#7-batch--aggregation-notifications)
8. [System Health Notifications](#8-system-health-notifications)
9. [API Endpoints mới](#9-api-endpoints-mới)
10. [Checklist tổng hợp](#10-checklist-tổng-hợp)

---

## 1. HIỆN TRẠNG & GAP ANALYSIS

### 1.1. Inventory tất cả tác vụ nền hiện tại

| # | Queue/Service | Processor | Jobs | Notification? |
|---|---------------|-----------|------|---------------|
| 1 | `crawl_discovery` | DiscoveryProcessor | `process_rss` | ❌ Không |
| 2 | `crawl_scrape` | ScrapeProcessor | `scrape_url` | ❌ Không |
| 3 | `crawl_process` | ProcessProcessor | `process_html` | ❌ Không |
| 4 | `crawl_seo` | SeoProcessor | `seo_html` | ❌ Không |
| 5 | `crawl_publish` | PublishProcessor | `publish_post` | ⚠️ Chỉ khi FAIL |
| 6 | `ai-content-queue` | AiGenerationProcessor | `generate-post` | ⚠️ Chỉ khi FAIL |
| 7 | `ai-content-queue` | AiGenerationProcessor | `refine-content` | ❌ Không |
| 8 | `mail_queue` | MailProcessor | `send_confirmation` | ❌ Không |
| 9 | CrawlerScheduler | Cron dynamic | RSS triggers | ❌ Không |
| 10 | CrawlerScheduler | `@Cron(EVERY_5_MIN)` | healthCheck | ❌ Không |
| 11 | PostsService | Direct call | Tạo/sửa/xoá post | ⚠️ Chỉ khi tạo AI/Crawl |
| 12 | AuthService | Direct call | Login/register | ❌ Không |
| 13 | UsersService | Direct call | CRUD users | ❌ Không |
| 14 | AccessControlService | Direct call | Roles/permissions | ❌ Không |
| 15 | SeoMetaService | Direct call | Generate SEO | ❌ Không |
| 16 | ApiKeyService | Direct call | Key management | ❌ Không |

### 1.2. Gap phát hiện

| # | Gap | Mức độ |
|---|-----|--------|
| 1 | **Không có @OnWorkerEvent listeners** — Không bắt được completed/failed/stalled events tự động | 🔴 |
| 2 | **Không có SSE/WebSocket** — Frontend phải polling, delay 3-30 giây | 🔴 |
| 3 | **Không track job lifecycle** — Không biết job nào đang chạy, bao lâu, ở stage nào | 🔴 |
| 4 | **Notification chỉ khi FAIL** — Admin không biết khi nào thành công | 🔴 |
| 5 | **Không có system alerts** — Redis down, DB disconnect, queue stalled → ai biết? | 🟡 |
| 6 | **Không track admin actions** — Ai đã xóa bài, ai đã sửa quyền → không log | 🟡 |
| 7 | **Không batch summary** — Crawl 50 bài → 50 noti riêng lẻ vs 1 tổng kết | 🟡 |
| 8 | **Không auto-cleanup** — Notifications cũ tích lũy mãi trong MongoDB | 🟢 |

---

## 2. THIẾT KẾ NOTIFICATION SYSTEM TOÀN DIỆN

### 2.1. Notification Types mở rộng

```typescript
// File cần sửa: erg-backend/src/modules/notifications/entities/notification.entity.ts

export enum NotificationType {
    // ══════════════ AI CONTENT ══════════════
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    AI_POST_PROGRESS = 'AI_POST_PROGRESS',           // MỚI: Progress update (30%, 60%, 90%)
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',       // MỚI: Batch tổng kết
    AI_REFINE_COMPLETED = 'AI_REFINE_COMPLETED',     // MỚI: Refine xong
    AI_REFINE_FAILED = 'AI_REFINE_FAILED',           // MỚI: Refine lỗi

    // ══════════════ CRAWLER ══════════════
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
    CRAWL_BATCH_STARTED = 'CRAWL_BATCH_STARTED',    // MỚI: Batch bắt đầu
    CRAWL_STAGE_FAILED = 'CRAWL_STAGE_FAILED',      // MỚI: Lỗi ở 1 stage cụ thể
    CRAWL_SCHEDULER_EVENT = 'CRAWL_SCHEDULER_EVENT', // MỚI: Scheduler start/stop/error

    // ══════════════ SYSTEM & INFRASTRUCTURE ══════════════
    SYSTEM_ALERT = 'SYSTEM_ALERT',                   // MỚI: Cảnh báo hệ thống
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',             // MỚI: Sự cố nghiêm trọng
    SYSTEM_RECOVERY = 'SYSTEM_RECOVERY',             // MỚI: Hệ thống phục hồi
    QUEUE_STALLED = 'QUEUE_STALLED',                 // MỚI: Queue bị treo
    QUEUE_BACKLOG = 'QUEUE_BACKLOG',                 // MỚI: Queue tồn đọng nhiều

    // ══════════════ API KEY ══════════════
    KEY_EXPIRED = 'KEY_EXPIRED',                     // MỚI
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',          // MỚI: >80% quota
    KEY_ALL_DOWN = 'KEY_ALL_DOWN',                   // MỚI: Provider hết key
    KEY_RECOVERED = 'KEY_RECOVERED',                 // MỚI: Key phục hồi

    // ══════════════ SEO ══════════════
    SEO_COMPLETED = 'SEO_COMPLETED',                 // MỚI
    SEO_FAILED = 'SEO_FAILED',                       // MỚI

    // ══════════════ ADMIN ACTIONS ══════════════
    ADMIN_POST_PUBLISHED = 'ADMIN_POST_PUBLISHED',   // MỚI: Admin publish bài
    ADMIN_POST_DELETED = 'ADMIN_POST_DELETED',        // MỚI: Admin xóa bài
    ADMIN_USER_CREATED = 'ADMIN_USER_CREATED',        // MỚI: Tạo user mới
    ADMIN_ROLE_CHANGED = 'ADMIN_ROLE_CHANGED',        // MỚI: Đổi role/permission
    ADMIN_SETTINGS_CHANGED = 'ADMIN_SETTINGS_CHANGED',// MỚI: Thay đổi cài đặt

    // ══════════════ MAIL ══════════════
    MAIL_SENT = 'MAIL_SENT',                         // MỚI: Email gửi thành công
    MAIL_FAILED = 'MAIL_FAILED',                     // MỚI: Email gửi thất bại
}
```

### 2.2. Notification Priority & Entity mở rộng

```typescript
export enum NotificationPriority {
    LOW = 'LOW',           // Info: thành công, progress
    MEDIUM = 'MEDIUM',     // Warning: partial failure, quota warning
    HIGH = 'HIGH',         // Error: job failed, key expired
    CRITICAL = 'CRITICAL', // Emergency: provider down, system crash
}

export enum NotificationChannel {
    IN_APP = 'IN_APP',       // Hiển thị trong NotificationBell
    SSE = 'SSE',             // Push real-time qua SSE
    BOTH = 'BOTH',           // Cả hai
}

@Entity({ collection: 'notifications' })
export class Notification extends MongoBaseEntity {
    @Property()
    userId!: string;

    @Property()
    type!: NotificationType;

    @Property()
    status: NotificationStatus = NotificationStatus.UNREAD;

    @Property({ default: 'LOW' })
    priority: NotificationPriority = NotificationPriority.LOW;

    @Property({ default: 'BOTH' })
    channel: NotificationChannel = NotificationChannel.BOTH;

    @Property()
    title!: string;

    @Property()
    message!: string;

    @Property({ type: 'json', nullable: true })
    metadata?: Record<string, any>;

    @Property({ nullable: true })
    readAt?: Date;

    // ═══ MỚI ═══

    /** URL navigate khi click */
    @Property({ nullable: true })
    actionUrl?: string;

    /** Action buttons */
    @Property({ type: 'json', nullable: true })
    actions?: { label: string; url: string; type: 'link' | 'api' }[];

    /** Nhóm notification (để aggregate) */
    @Property({ nullable: true })
    groupKey?: string; // VD: 'crawl_batch:rssId123', 'ai_batch:userId_timestamp'

    /** Source module */
    @Property({ nullable: true })
    source?: string; // 'crawler', 'ai-content', 'system', 'admin', 'mail'

    /** Actor — ai đã trigger action này */
    @Property({ nullable: true })
    actorId?: string;

    @Property({ nullable: true })
    actorName?: string;

    /** TTL — tự xóa sau N ngày (null = giữ mãi) */
    @Property({ nullable: true })
    expiresAt?: Date;
}
```

### 2.3. Index cho MongoDB

```typescript
// Thêm indexes để query nhanh
@Entity({ collection: 'notifications' })
@Index({ properties: ['userId', 'status', 'createdAt'] })
@Index({ properties: ['userId', 'type'] })
@Index({ properties: ['groupKey'] })
@Index({ properties: ['expiresAt'], options: { expireAfterSeconds: 0 } }) // TTL Index
export class Notification extends MongoBaseEntity { ... }
```

---

## 3. GLOBAL QUEUE EVENT LISTENER

### 3.1. Tại sao cần?

Hiện tại mỗi processor phải tự gọi `notificationsService.create()` trong try-catch. Điều này:
- Dễ quên (5/7 processors không gửi noti)
- Code trùng lặp
- Không bắt được `stalled`, `delayed`, `drained` events

### 3.2. Tạo Global Queue Events Service

```typescript
// File mới: erg-backend/src/shared/queue-monitor/queue-events.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { JobActivityService } from './job-activity.service';

@Injectable()
export class QueueEventsService implements OnModuleInit {
    private readonly logger = new Logger(QueueEventsService.name);
    private queueEventsMap = new Map<string, QueueEvents>();

    constructor(
        @InjectQueue('crawl_discovery') private discoveryQueue: Queue,
        @InjectQueue('crawl_scrape') private scrapeQueue: Queue,
        @InjectQueue('crawl_process') private processQueue: Queue,
        @InjectQueue('crawl_seo') private seoQueue: Queue,
        @InjectQueue('crawl_publish') private publishQueue: Queue,
        @InjectQueue('ai-content-queue') private aiQueue: Queue,
        @InjectQueue('mail_queue') private mailQueue: Queue,
        private readonly notificationsService: NotificationsService,
        private readonly jobActivityService: JobActivityService,
        private readonly sseService: SseService,
    ) {}

    async onModuleInit() {
        const queues: [string, Queue][] = [
            ['crawl_discovery', this.discoveryQueue],
            ['crawl_scrape', this.scrapeQueue],
            ['crawl_process', this.processQueue],
            ['crawl_seo', this.seoQueue],
            ['crawl_publish', this.publishQueue],
            ['ai-content-queue', this.aiQueue],
            ['mail_queue', this.mailQueue],
        ];

        for (const [name, queue] of queues) {
            await this.setupQueueEvents(name, queue);
        }

        this.logger.log(`Queue events listeners attached to ${queues.length} queues`);
    }

    private async setupQueueEvents(queueName: string, queue: Queue) {
        const queueEvents = new QueueEvents(queueName, {
            connection: queue.opts.connection,
        });

        // ═══ JOB COMPLETED ═══
        queueEvents.on('completed', async ({ jobId, returnvalue }) => {
            await this.jobActivityService.recordCompleted(queueName, jobId, returnvalue);
            await this.sseService.emitToAdmins('job:completed', {
                queue: queueName, jobId, result: returnvalue,
            });
            this.logger.debug(`[${queueName}] Job ${jobId} completed`);
        });

        // ═══ JOB FAILED ═══
        queueEvents.on('failed', async ({ jobId, failedReason }) => {
            await this.jobActivityService.recordFailed(queueName, jobId, failedReason);
            await this.sseService.emitToAdmins('job:failed', {
                queue: queueName, jobId, error: failedReason,
            });

            // Gửi notification cho admin nếu job failed permanently (hết retries)
            const job = await queue.getJob(jobId);
            if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
                await this.notifyJobPermanentlyFailed(queueName, job, failedReason);
            }

            this.logger.warn(`[${queueName}] Job ${jobId} failed: ${failedReason}`);
        });

        // ═══ JOB ACTIVE (started processing) ═══
        queueEvents.on('active', async ({ jobId }) => {
            await this.jobActivityService.recordActive(queueName, jobId);
            await this.sseService.emitToAdmins('job:active', {
                queue: queueName, jobId,
            });
        });

        // ═══ JOB PROGRESS ═══
        queueEvents.on('progress', async ({ jobId, data }) => {
            await this.jobActivityService.recordProgress(queueName, jobId, data);
            await this.sseService.emitToAdmins('job:progress', {
                queue: queueName, jobId, progress: data,
            });
        });

        // ═══ JOB STALLED (worker bị treo) ═══
        queueEvents.on('stalled', async ({ jobId }) => {
            await this.jobActivityService.recordStalled(queueName, jobId);
            this.logger.error(`[${queueName}] Job ${jobId} STALLED!`);

            // Thông báo khẩn cho admin
            await this.notificationsService.createForAdmins({
                type: NotificationType.QUEUE_STALLED,
                priority: NotificationPriority.HIGH,
                title: `Job bị treo trong queue "${queueName}"`,
                message: `Job #${jobId} không phản hồi. Có thể worker bị crash hoặc deadlock.`,
                source: 'system',
                actionUrl: '/admin/monitor/queues',
                metadata: { queue: queueName, jobId },
            });
        });

        // ═══ JOB DELAYED ═══
        queueEvents.on('delayed', async ({ jobId, delay }) => {
            await this.jobActivityService.recordDelayed(queueName, jobId, delay);
        });

        // ═══ JOB WAITING ═══
        queueEvents.on('waiting', async ({ jobId }) => {
            await this.jobActivityService.recordWaiting(queueName, jobId);
        });

        this.queueEventsMap.set(queueName, queueEvents);
    }

    private async notifyJobPermanentlyFailed(queueName: string, job: any, error: string) {
        const typeMap: Record<string, NotificationType> = {
            'crawl_discovery': NotificationType.CRAWL_STAGE_FAILED,
            'crawl_scrape': NotificationType.CRAWL_STAGE_FAILED,
            'crawl_process': NotificationType.CRAWL_STAGE_FAILED,
            'crawl_seo': NotificationType.SEO_FAILED,
            'crawl_publish': NotificationType.CRAWL_FAILED,
            'ai-content-queue': NotificationType.AI_POST_FAILED,
            'mail_queue': NotificationType.MAIL_FAILED,
        };

        const stageNames: Record<string, string> = {
            'crawl_discovery': 'Discovery (Phát hiện URL)',
            'crawl_scrape': 'Scrape (Cào nội dung)',
            'crawl_process': 'Process (Xử lý HTML)',
            'crawl_seo': 'SEO (Tối ưu SEO)',
            'crawl_publish': 'Publish (Đăng bài)',
            'ai-content-queue': 'AI Generation',
            'mail_queue': 'Gửi Email',
        };

        await this.notificationsService.createForAdmins({
            type: typeMap[queueName] || NotificationType.SYSTEM_ALERT,
            priority: NotificationPriority.HIGH,
            title: `Job thất bại vĩnh viễn: ${stageNames[queueName] || queueName}`,
            message: `Job #${job.id} đã retry ${job.attemptsMade} lần và vẫn lỗi: ${error}`,
            source: 'queue-monitor',
            actionUrl: '/admin/monitor/queues',
            metadata: {
                queue: queueName,
                jobId: job.id,
                jobName: job.name,
                jobData: this.sanitizeJobData(job.data),
                error,
                attemptsMade: job.attemptsMade,
                maxAttempts: job.opts.attempts,
            },
            actions: [
                { label: 'Xem chi tiết', url: '/admin/monitor/queues', type: 'link' },
                { label: 'Retry', url: `/api/admin/monitor/jobs/${job.id}/retry`, type: 'api' },
            ],
        });
    }

    /** Loại bỏ sensitive data trước khi lưu vào notification */
    private sanitizeJobData(data: any): any {
        if (!data) return {};
        const sanitized = { ...data };
        delete sanitized.apiKey;
        delete sanitized.password;
        delete sanitized.token;
        if (sanitized.content && sanitized.content.length > 200) {
            sanitized.content = sanitized.content.substring(0, 200) + '...';
        }
        return sanitized;
    }

    /** Lấy metrics từ tất cả queues */
    async getAllQueueMetrics() {
        const metrics: Record<string, any> = {};

        for (const [name, queue] of [
            ['crawl_discovery', this.discoveryQueue],
            ['crawl_scrape', this.scrapeQueue],
            ['crawl_process', this.processQueue],
            ['crawl_seo', this.seoQueue],
            ['crawl_publish', this.publishQueue],
            ['ai-content-queue', this.aiQueue],
            ['mail_queue', this.mailQueue],
        ] as [string, Queue][]) {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
                queue.getDelayedCount(),
            ]);

            metrics[name] = {
                waiting, active, completed, failed, delayed,
                total: waiting + active + delayed,
                isPaused: await queue.isPaused(),
            };
        }

        return metrics;
    }
}
```

### 3.3. Module Registration

```typescript
// File mới: erg-backend/src/shared/queue-monitor/queue-monitor.module.ts

@Module({
    imports: [
        BullModule.registerQueue(
            { name: 'crawl_discovery' },
            { name: 'crawl_scrape' },
            { name: 'crawl_process' },
            { name: 'crawl_seo' },
            { name: 'crawl_publish' },
            { name: 'ai-content-queue' },
            { name: 'mail_queue' },
        ),
        NotificationsModule,
    ],
    providers: [
        QueueEventsService,
        JobActivityService,
        SseService,
        QueueMonitorService,
        BacklogWatcherService,
    ],
    controllers: [
        QueueMonitorController,
        SseController,
    ],
    exports: [
        QueueEventsService,
        JobActivityService,
        SseService,
    ],
})
export class QueueMonitorModule {}
```

---

## 4. JOB ACTIVITY TRACKER (BACKGROUND TASK MONITOR)

### 4.1. Job Activity Entity (MongoDB)

```typescript
// File mới: erg-backend/src/shared/queue-monitor/entities/job-activity.entity.ts

export enum JobState {
    WAITING = 'waiting',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    FAILED = 'failed',
    DELAYED = 'delayed',
    STALLED = 'stalled',
}

@Entity({ collection: 'job_activities' })
@Index({ properties: ['queue', 'state', 'createdAt'] })
@Index({ properties: ['groupKey'] })
@Index({ properties: ['createdAt'], options: { expireAfterSeconds: 7 * 24 * 3600 } }) // TTL 7 ngày
export class JobActivity {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    /** Tên queue */
    @Property()
    queue!: string; // 'crawl_scrape', 'ai-content-queue', etc.

    /** BullMQ Job ID */
    @Property()
    jobId!: string;

    /** Job name */
    @Property()
    jobName!: string; // 'scrape_url', 'generate-post', etc.

    /** Trạng thái hiện tại */
    @Enum(() => JobState)
    state: JobState = JobState.WAITING;

    /** Progress (0-100) */
    @Property({ default: 0 })
    progress: number = 0;

    /** Mô tả ngắn về job */
    @Property({ nullable: true })
    description?: string; // VD: "Crawl: https://example.com/article"

    /** Data job (sanitized) */
    @Property({ type: 'json', nullable: true })
    jobData?: Record<string, any>;

    /** Kết quả (nếu completed) */
    @Property({ type: 'json', nullable: true })
    result?: Record<string, any>;

    /** Lỗi (nếu failed) */
    @Property({ nullable: true })
    error?: string;

    /** Số lần retry */
    @Property({ default: 0 })
    attemptsMade: number = 0;

    /** Group key — để batch tracking */
    @Property({ nullable: true })
    groupKey?: string; // 'rss:feedId123', 'ai_batch:userId_1709...'

    /** Timestamps */
    @Property()
    createdAt: Date = new Date();

    @Property({ nullable: true })
    startedAt?: Date;

    @Property({ nullable: true })
    completedAt?: Date;

    /** Duration ms (auto-calculated) */
    @Property({ nullable: true })
    durationMs?: number;
}
```

### 4.2. Job Activity Service

```typescript
// File mới: erg-backend/src/shared/queue-monitor/job-activity.service.ts

@Injectable()
export class JobActivityService {
    private readonly logger = new Logger(JobActivityService.name);

    constructor(
        @InjectRepository(JobActivity, 'mongo-connection')
        private readonly activityRepo: EntityRepository<JobActivity>,
    ) {}

    /** Ghi nhận job vào hàng chờ */
    async recordWaiting(queue: string, jobId: string, jobData?: any) {
        const activity = this.activityRepo.create({
            queue,
            jobId,
            jobName: jobData?.name || 'unknown',
            state: JobState.WAITING,
            description: this.buildDescription(queue, jobData),
            jobData: this.sanitize(jobData),
            groupKey: jobData?.groupKey,
        });
        await this.activityRepo.getEntityManager().persistAndFlush(activity);
    }

    /** Ghi nhận job bắt đầu xử lý */
    async recordActive(queue: string, jobId: string) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.state = JobState.ACTIVE;
            activity.startedAt = new Date();
            await this.activityRepo.getEntityManager().flush();
        }
    }

    /** Ghi nhận progress */
    async recordProgress(queue: string, jobId: string, progress: any) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.progress = typeof progress === 'number' ? progress : progress?.progress || 0;
            await this.activityRepo.getEntityManager().flush();
        }
    }

    /** Ghi nhận hoàn thành */
    async recordCompleted(queue: string, jobId: string, result?: any) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.state = JobState.COMPLETED;
            activity.progress = 100;
            activity.completedAt = new Date();
            activity.durationMs = activity.startedAt
                ? Date.now() - activity.startedAt.getTime()
                : undefined;
            activity.result = typeof result === 'string' ? { raw: result.substring(0, 500) } : result;
            await this.activityRepo.getEntityManager().flush();
        }
    }

    /** Ghi nhận thất bại */
    async recordFailed(queue: string, jobId: string, error: string) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.state = JobState.FAILED;
            activity.completedAt = new Date();
            activity.durationMs = activity.startedAt
                ? Date.now() - activity.startedAt.getTime()
                : undefined;
            activity.error = error?.substring(0, 1000);
            await this.activityRepo.getEntityManager().flush();
        }
    }

    /** Ghi nhận stalled */
    async recordStalled(queue: string, jobId: string) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.state = JobState.STALLED;
            await this.activityRepo.getEntityManager().flush();
        }
    }

    /** Ghi nhận delayed */
    async recordDelayed(queue: string, jobId: string, delay: number) {
        const activity = await this.findByJobId(queue, jobId);
        if (activity) {
            activity.state = JobState.DELAYED;
            await this.activityRepo.getEntityManager().flush();
        }
    }

    // ═══════════ QUERY METHODS ═══════════

    /** Lấy danh sách jobs đang active */
    async getActiveJobs(): Promise<JobActivity[]> {
        return this.activityRepo.find(
            { state: JobState.ACTIVE },
            { orderBy: { startedAt: 'DESC' } },
        );
    }

    /** Lấy lịch sử jobs (phân trang) */
    async getJobHistory(filters: {
        queue?: string;
        state?: JobState;
        groupKey?: string;
        page?: number;
        limit?: number;
    }) {
        const { queue, state, groupKey, page = 1, limit = 50 } = filters;
        const where: any = {};
        if (queue) where.queue = queue;
        if (state) where.state = state;
        if (groupKey) where.groupKey = groupKey;

        const [items, total] = await Promise.all([
            this.activityRepo.find(where, {
                orderBy: { createdAt: 'DESC' },
                limit,
                offset: (page - 1) * limit,
            }),
            this.activityRepo.count(where),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /** Dashboard metrics */
    async getDashboardMetrics() {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 3600 * 1000);
        const lastHour = new Date(now.getTime() - 3600 * 1000);

        const [
            activeCount,
            last24hTotal,
            last24hCompleted,
            last24hFailed,
            lastHourTotal,
            stalledCount,
        ] = await Promise.all([
            this.activityRepo.count({ state: JobState.ACTIVE }),
            this.activityRepo.count({ createdAt: { $gte: last24h } }),
            this.activityRepo.count({ state: JobState.COMPLETED, completedAt: { $gte: last24h } }),
            this.activityRepo.count({ state: JobState.FAILED, completedAt: { $gte: last24h } }),
            this.activityRepo.count({ createdAt: { $gte: lastHour } }),
            this.activityRepo.count({ state: JobState.STALLED }),
        ]);

        // Avg duration per queue (last 24h)
        const avgDurations = await this.activityRepo.getEntityManager().aggregate(JobActivity, [
            { $match: { state: 'completed', completedAt: { $gte: last24h }, durationMs: { $ne: null } } },
            { $group: { _id: '$queue', avgDuration: { $avg: '$durationMs' }, count: { $sum: 1 } } },
        ]);

        return {
            activeJobs: activeCount,
            stalledJobs: stalledCount,
            last24h: {
                total: last24hTotal,
                completed: last24hCompleted,
                failed: last24hFailed,
                successRate: last24hTotal > 0
                    ? Math.round((last24hCompleted / last24hTotal) * 100)
                    : 100,
            },
            lastHour: { total: lastHourTotal },
            avgDurationByQueue: avgDurations.reduce((acc, item) => {
                acc[item._id] = { avgMs: Math.round(item.avgDuration), count: item.count };
                return acc;
            }, {} as Record<string, any>),
        };
    }

    /** Thống kê theo queue (cho chart) */
    async getQueueStats(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);

        return this.activityRepo.getEntityManager().aggregate(JobActivity, [
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        queue: '$queue',
                        state: '$state',
                        hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.hour': 1 } },
        ]);
    }

    // ═══════════ HELPERS ═══════════

    private async findByJobId(queue: string, jobId: string) {
        return this.activityRepo.findOne({ queue, jobId }, { orderBy: { createdAt: 'DESC' } });
    }

    private buildDescription(queue: string, data?: any): string {
        if (!data) return queue;
        switch (queue) {
            case 'crawl_discovery': return `RSS Feed: ${data.rssId || 'unknown'}`;
            case 'crawl_scrape': return `Crawl: ${data.url || 'unknown'}`;
            case 'crawl_process': return `Process: ${data.rawId || 'unknown'}`;
            case 'crawl_seo': return `SEO: ${data.rawId || 'unknown'}`;
            case 'crawl_publish': return `Publish: ${data.rawId || 'unknown'}`;
            case 'ai-content-queue':
                return data.topic ? `AI: "${data.topic}"` : `AI: ${data.jobName || 'generate'}`;
            case 'mail_queue': return `Email: ${data.email || 'unknown'}`;
            default: return queue;
        }
    }

    private sanitize(data: any): any {
        if (!data) return {};
        const clean = { ...data };
        delete clean.apiKey;
        delete clean.password;
        delete clean.token;
        return clean;
    }
}
```

---

## 5. REAL-TIME EVENTS (SSE)

### 5.1. Tại sao SSE thay vì WebSocket?

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Hướng giao tiếp | Server → Client (1 chiều) | 2 chiều |
| Complexity | Thấp | Cao |
| Auto-reconnect | **Có (built-in)** | Phải tự implement |
| NestJS support | **Built-in (@Sse)** | Cần gateway riêng |
| Phù hợp cho | Notifications, monitoring | Chat, real-time collab |
| Load balancer | Dễ (HTTP) | Phức tạp (upgrade) |

→ **SSE phù hợp nhất** vì chỉ cần server push notifications/events xuống client.

### 5.2. SSE Service

```typescript
// File mới: erg-backend/src/shared/queue-monitor/sse.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, filter } from 'rxjs';

export interface SseEvent {
    type: string;           // 'job:completed', 'notification:new', 'queue:metrics'
    data: any;
    targetUserIds?: string[]; // null = broadcast to all admins
}

@Injectable()
export class SseService {
    private readonly logger = new Logger(SseService.name);
    private readonly eventSubject = new Subject<SseEvent>();

    /** Emit event cho tất cả admin */
    async emitToAdmins(type: string, data: any) {
        this.eventSubject.next({ type, data, targetUserIds: undefined });
    }

    /** Emit event cho user cụ thể */
    async emitToUser(userId: string, type: string, data: any) {
        this.eventSubject.next({ type, data, targetUserIds: [userId] });
    }

    /** Emit event cho danh sách users */
    async emitToUsers(userIds: string[], type: string, data: any) {
        this.eventSubject.next({ type, data, targetUserIds: userIds });
    }

    /** Subscribe stream cho 1 user — Controller sẽ gọi method này */
    getEventStream(userId: string): Observable<SseEvent> {
        return this.eventSubject.asObservable().pipe(
            filter(event =>
                !event.targetUserIds || event.targetUserIds.includes(userId)
            ),
        );
    }
}
```

### 5.3. SSE Controller

```typescript
// File mới: erg-backend/src/shared/queue-monitor/sse.controller.ts

import { Controller, Sse, Req, UseGuards } from '@nestjs/common';
import { Observable, map, interval, merge } from 'rxjs';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';

@Controller('admin/events')
@UseGuards(JwtAuthGuard)
export class SseController {
    constructor(
        private readonly sseService: SseService,
        private readonly queueEventsService: QueueEventsService,
    ) {}

    /**
     * SSE endpoint: GET /api/admin/events/stream
     * Client kết nối 1 lần, nhận real-time events liên tục
     */
    @Sse('stream')
    stream(@Req() req: any): Observable<MessageEvent> {
        const userId = req.user.id;

        // Merge 2 streams:
        // 1. User-specific events (notifications, job updates)
        // 2. Periodic queue metrics heartbeat (mỗi 10 giây)
        const userEvents$ = this.sseService.getEventStream(userId).pipe(
            map(event => ({
                data: JSON.stringify({ type: event.type, payload: event.data }),
            } as MessageEvent)),
        );

        const heartbeat$ = interval(10000).pipe(
            map(async () => {
                const metrics = await this.queueEventsService.getAllQueueMetrics();
                return {
                    data: JSON.stringify({ type: 'queue:metrics', payload: metrics }),
                } as MessageEvent;
            }),
            // switchMap for async
        );

        // Simplified: chỉ user events, metrics qua endpoint riêng
        return userEvents$;
    }
}
```

### 5.4. Tích hợp SSE vào NotificationsService

```typescript
// File cần sửa: erg-backend/src/modules/notifications/notifications.service.ts

@Injectable()
export class NotificationsService {
    constructor(
        private readonly sseService: SseService, // ← THÊM
        // ... existing deps
    ) {}

    async create(data: CreateNotificationDto): Promise<Notification> {
        // ... existing create logic ...
        const notification = /* create entity */;
        await this.repo.getEntityManager().persistAndFlush(notification);

        // ═══ MỚI: Push real-time qua SSE ═══
        if (data.channel !== NotificationChannel.IN_APP) {
            await this.sseService.emitToUser(data.userId, 'notification:new', {
                id: notification.id,
                type: notification.type,
                priority: notification.priority,
                title: notification.title,
                message: notification.message,
                actionUrl: notification.actionUrl,
                actions: notification.actions,
                createdAt: notification.createdAt,
            });
        }

        return notification;
    }

    async createForAdmins(data: CreateNotificationDto): Promise<Notification[]> {
        // ... find admin users ...
        const notifications = [];
        for (const admin of adminUsers) {
            notifications.push(await this.create({ ...data, userId: admin.id }));
        }
        return notifications;
    }

    // ═══ MỚI: Auto-cleanup ═══
    @Cron('0 3 * * *')
    async cleanupExpiredNotifications() {
        // TTL index trên MongoDB sẽ tự xóa nếu dùng expiresAt
        // Ngoài ra, xóa notifications đã đọc > 30 ngày
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const em = this.repo.getEntityManager().fork();
        const count = await em.nativeDelete(Notification, {
            status: NotificationStatus.READ,
            createdAt: { $lt: thirtyDaysAgo },
        });
        if (count > 0) this.logger.log(`Cleaned up ${count} old notifications`);
    }
}
```

---

## 6. NOTIFICATION CHO TỪNG MODULE CỤ THỂ

### 6.1. Crawler Module — Tất cả 5 stages

```typescript
// ═══ Discovery Processor ═══
// File: erg-backend/src/modules/crawler/processors/discovery.processor.ts
// THÊM vào process() method:

async process(job: Job<any>): Promise<any> {
    const { rssId } = job.data;
    try {
        const result = await this.crawlerService.processRssFeed(rssId);

        // Gửi event batch started
        await this.sseService.emitToAdmins('crawl:batch_started', {
            rssId, urlCount: result.addedCount,
        });

        // Register batch tracking
        if (result.addedCount > 0) {
            await this.batchTracker.registerBatch(rssId, result.addedCount);
        }

        return result;
    } catch (error) {
        await this.notificationsService.createForAdmins({
            type: NotificationType.CRAWL_STAGE_FAILED,
            priority: NotificationPriority.HIGH,
            title: `Discovery thất bại cho RSS Feed`,
            message: `Không thể parse RSS feed: ${error.message}`,
            source: 'crawler',
            metadata: { rssId, stage: 'DISCOVERY', error: error.message },
        });
        throw error;
    }
}

// ═══ Scrape Processor ═══
// File: erg-backend/src/modules/crawler/processors/scrape.processor.ts
// Thêm ở cuối process() khi thành công:
await this.batchTracker.trackStageCompleted(rssId, job.data.url, 'SCRAPE');

// ═══ Process Processor ═══
// Tương tự: trackStageCompleted(rssId, url, 'PROCESS')

// ═══ SEO Processor ═══
// Tương tự: trackStageCompleted(rssId, url, 'SEO')

// ═══ Publish Processor ═══
// File: erg-backend/src/modules/crawler/processors/publish.processor.ts
// Thêm khi thành công:
await this.batchTracker.trackJobCompletion(rssId, {
    url, success: true, postId: post.id,
});
await this.notificationsService.create({
    userId: admin.id,
    type: NotificationType.CRAWL_COMPLETED,
    priority: NotificationPriority.LOW,
    title: 'Bài viết crawl thành công',
    message: `"${title}" → ${autoPublish ? 'Published' : 'Draft'}`,
    actionUrl: `/admin/posts/${post.id}`,
    source: 'crawler',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // TTL 7 ngày
});
```

### 6.2. AI Content Module

```typescript
// File: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts

// ═══ generate-post thành công ═══
await this.notificationsService.create({
    userId,
    type: NotificationType.AI_POST_COMPLETED,
    priority: NotificationPriority.LOW,
    title: 'Bài viết AI hoàn tất',
    message: `"${aiData.title}" (${usedProvider}) — ${totalTime}ms`,
    actionUrl: `/admin/posts/${newPost.id}`,
    source: 'ai-content',
    metadata: {
        postId: newPost.id, slug: newPost.slug, topic,
        provider: usedProvider, durationMs: totalTime,
        imageCount: generatedImages.length,
    },
    actions: [
        { label: 'Xem bài', url: `/admin/posts/${newPost.id}`, type: 'link' },
        { label: 'Chỉnh sửa', url: `/admin/posts/${newPost.id}/edit`, type: 'link' },
    ],
});

// ═══ generate-post thất bại (cải thiện noti hiện tại) ═══
await this.notificationsService.create({
    userId,
    type: NotificationType.AI_POST_FAILED,
    priority: NotificationPriority.HIGH,
    title: 'Tạo bài AI thất bại',
    message: `"${topic}": ${error.message}`,
    actionUrl: '/admin/posts/ai-batch',
    source: 'ai-content',
    metadata: { jobId: job.id, topic, error: error.message, attemptsMade: job.attemptsMade },
    actions: [
        { label: 'Thử lại', url: '/admin/posts/ai-batch', type: 'link' },
    ],
});

// ═══ refine-content ═══
// Thành công:
await this.notificationsService.create({
    userId,
    type: NotificationType.AI_REFINE_COMPLETED,
    priority: NotificationPriority.LOW,
    title: 'Nội dung đã được tinh chỉnh',
    message: `AI đã hoàn tất refine nội dung theo yêu cầu.`,
    source: 'ai-content',
});
// Thất bại:
await this.notificationsService.create({
    userId,
    type: NotificationType.AI_REFINE_FAILED,
    priority: NotificationPriority.MEDIUM,
    title: 'Tinh chỉnh nội dung thất bại',
    message: `Lỗi: ${error.message}`,
    source: 'ai-content',
});
```

### 6.3. Mail Module

```typescript
// File: erg-backend/src/shared/mail/mail.processor.ts

// ═══ Gửi email thất bại ═══
// Thêm vào catch block:
await this.notificationsService.createForAdmins({
    type: NotificationType.MAIL_FAILED,
    priority: NotificationPriority.MEDIUM,
    title: `Gửi email thất bại`,
    message: `Không thể gửi email tới ${job.data.email}: ${error.message}`,
    source: 'mail',
    metadata: { email: job.data.email, error: error.message },
    expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), // TTL 3 ngày
});
```

### 6.4. Admin Actions — Audit Trail Notifications

```typescript
// File mới: erg-backend/src/core/interceptors/admin-audit.interceptor.ts

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly sseService: SseService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const path = request.route?.path || request.url;
        const user = request.user;

        // Chỉ track write operations trên admin routes
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();
        if (!path.includes('/admin/') && !path.includes('/posts/') && !path.includes('/users/')) {
            return next.handle();
        }

        return next.handle().pipe(
            tap(async (response) => {
                const action = this.classifyAction(method, path, request.body);
                if (!action) return;

                // Broadcast cho tất cả admin (trừ người thực hiện)
                await this.sseService.emitToAdmins('admin:action', {
                    actor: { id: user.id, name: user.fullName || user.email },
                    action: action.type,
                    description: action.description,
                    path,
                    timestamp: new Date(),
                });

                // Notification cho những action quan trọng
                if (action.notifyLevel) {
                    await this.notificationsService.createForAdmins({
                        type: action.notifyType,
                        priority: action.notifyLevel,
                        title: action.description,
                        message: `${user.fullName || user.email} đã thực hiện: ${action.description}`,
                        source: 'admin',
                        actorId: user.id,
                        actorName: user.fullName || user.email,
                        expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
                    });
                }
            }),
        );
    }

    private classifyAction(method: string, path: string, body: any) {
        // Posts
        if (path.match(/\/posts$/) && method === 'POST') {
            return { type: 'post_created', description: `Tạo bài viết mới`, notifyType: NotificationType.ADMIN_POST_PUBLISHED };
        }
        if (path.match(/\/posts\/\w+$/) && method === 'DELETE') {
            return { type: 'post_deleted', description: `Xóa bài viết`, notifyType: NotificationType.ADMIN_POST_DELETED, notifyLevel: NotificationPriority.MEDIUM };
        }
        // Users
        if (path.match(/\/users$/) && method === 'POST') {
            return { type: 'user_created', description: `Tạo tài khoản mới`, notifyType: NotificationType.ADMIN_USER_CREATED, notifyLevel: NotificationPriority.LOW };
        }
        // Roles
        if (path.match(/\/roles/) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return { type: 'role_changed', description: `Thay đổi phân quyền`, notifyType: NotificationType.ADMIN_ROLE_CHANGED, notifyLevel: NotificationPriority.MEDIUM };
        }
        // API Keys
        if (path.match(/\/ai-content\/keys/) && ['POST', 'PUT', 'DELETE'].includes(method)) {
            return { type: 'settings_changed', description: `Cập nhật cấu hình AI Keys`, notifyType: NotificationType.ADMIN_SETTINGS_CHANGED };
        }
        return null;
    }
}
```

### 6.5. Crawler Scheduler Events

```typescript
// File cần sửa: erg-backend/src/modules/crawler/crawler.scheduler.ts

// THÊM notification khi scheduler có sự kiện:

async addCronJob(feed: RssFeed) {
    // ... existing logic ...
    this.logger.log(`Scheduled RSS ${feed.name} (${feed.cronExpression})`);

    await this.sseService.emitToAdmins('scheduler:job_added', {
        feedId: feed.id, feedName: feed.name, cron: feed.cronExpression,
    });
}

async stopCronJob(rssId: string) {
    // ... existing logic ...
    await this.sseService.emitToAdmins('scheduler:job_stopped', { feedId: rssId });
}

// Trong healthCheck():
@Cron(CronExpression.EVERY_5_MINUTES)
async healthCheck() {
    // ... existing check ...
    if (missingFeeds.length > 0) {
        await this.notificationsService.createForAdmins({
            type: NotificationType.CRAWL_SCHEDULER_EVENT,
            priority: NotificationPriority.MEDIUM,
            title: `Scheduler auto-healed: ${missingFeeds.length} feeds re-scheduled`,
            message: `Health check phát hiện ${missingFeeds.length} feeds bị miss và đã tự động khôi phục.`,
            source: 'scheduler',
            metadata: { missingFeeds: missingFeeds.map(f => f.name) },
        });
    }
}
```

---

## 7. BATCH & AGGREGATION NOTIFICATIONS

### 7.1. CrawlBatchTrackerService (chi tiết)

```typescript
// File mới: erg-backend/src/modules/crawler/services/crawl-batch-tracker.service.ts

interface BatchState {
    rssId: string;
    feedName: string;
    startedAt: number;
    totalJobs: number;
    completedJobs: number;
    successCount: number;
    failedCount: number;
    stages: Record<string, { completed: number; failed: number }>; // per stage tracking
    results: { url: string; success: boolean; postId?: string; error?: string; stage?: string }[];
}

@Injectable()
export class CrawlBatchTrackerService {
    constructor(
        @Inject(CACHE_MANAGER) private cache: Cache,
        private readonly notificationsService: NotificationsService,
        private readonly sseService: SseService,
    ) {}

    async registerBatch(rssId: string, totalJobs: number, feedName?: string) {
        const batchKey = `crawl_batch:${rssId}:${Date.now()}`;
        const state: BatchState = {
            rssId, feedName: feedName || rssId,
            startedAt: Date.now(), totalJobs,
            completedJobs: 0, successCount: 0, failedCount: 0,
            stages: {}, results: [],
        };
        await this.cache.set(batchKey, state, 2 * 3600 * 1000); // TTL 2h

        // Notify batch started
        await this.notificationsService.createForAdmins({
            type: NotificationType.CRAWL_BATCH_STARTED,
            priority: NotificationPriority.LOW,
            title: `Bắt đầu crawl: ${feedName || rssId}`,
            message: `Đã phát hiện ${totalJobs} URLs cần xử lý`,
            source: 'crawler',
            groupKey: batchKey,
            actionUrl: '/admin/crawler',
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        });

        return batchKey;
    }

    async trackStageCompleted(batchKey: string, url: string, stage: string) {
        const batch = await this.cache.get<BatchState>(batchKey);
        if (!batch) return;

        if (!batch.stages[stage]) batch.stages[stage] = { completed: 0, failed: 0 };
        batch.stages[stage].completed++;
        await this.cache.set(batchKey, batch, 2 * 3600 * 1000);

        // Emit progress qua SSE
        const progress = Math.round(
            (Object.values(batch.stages).reduce((sum, s) => sum + s.completed, 0) /
            (batch.totalJobs * 5)) * 100 // 5 stages
        );

        await this.sseService.emitToAdmins('crawl:batch_progress', {
            batchKey, rssId: batch.rssId, progress,
            stages: batch.stages, totalJobs: batch.totalJobs,
        });
    }

    async trackJobCompletion(batchKey: string, result: {
        url: string; success: boolean; postId?: string; error?: string;
    }) {
        const batch = await this.cache.get<BatchState>(batchKey);
        if (!batch) return;

        batch.completedJobs++;
        if (result.success) batch.successCount++;
        else batch.failedCount++;
        batch.results.push(result);
        await this.cache.set(batchKey, batch, 2 * 3600 * 1000);

        // Khi tất cả xong → gửi summary
        if (batch.completedJobs >= batch.totalJobs) {
            await this.sendBatchSummary(batch, batchKey);
        }
    }

    private async sendBatchSummary(batch: BatchState, batchKey: string) {
        const durationSec = Math.round((Date.now() - batch.startedAt) / 1000);
        const durationStr = durationSec > 60
            ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
            : `${durationSec}s`;

        const priority = batch.failedCount === 0
            ? NotificationPriority.LOW
            : batch.failedCount > batch.successCount
                ? NotificationPriority.HIGH
                : NotificationPriority.MEDIUM;

        await this.notificationsService.createForAdmins({
            type: NotificationType.CRAWL_BATCH_COMPLETED,
            priority,
            title: `Crawl hoàn tất: ${batch.feedName}`,
            message: `✅ ${batch.successCount} thành công | ❌ ${batch.failedCount} thất bại | ⏱ ${durationStr}`,
            source: 'crawler',
            groupKey: batchKey,
            actionUrl: '/admin/crawler/history',
            metadata: {
                rssId: batch.rssId,
                totalJobs: batch.totalJobs,
                successCount: batch.successCount,
                failedCount: batch.failedCount,
                durationSeconds: durationSec,
                failedUrls: batch.results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error })),
                successPosts: batch.results.filter(r => r.success).map(r => ({ url: r.url, postId: r.postId })),
            },
            actions: [
                { label: 'Xem lịch sử', url: '/admin/crawler/history', type: 'link' },
                batch.failedCount > 0
                    ? { label: `Retry ${batch.failedCount} lỗi`, url: `/api/crawler/batch/${batchKey}/retry`, type: 'api' }
                    : null,
            ].filter(Boolean) as any,
        });

        // Cleanup
        await this.cache.del(batchKey);
    }
}
```

---

## 8. SYSTEM HEALTH NOTIFICATIONS

### 8.1. Backlog Watcher — Cảnh báo queue tồn đọng

```typescript
// File mới: erg-backend/src/shared/queue-monitor/backlog-watcher.service.ts

@Injectable()
export class BacklogWatcherService {
    private readonly logger = new Logger(BacklogWatcherService.name);

    constructor(
        private readonly queueEventsService: QueueEventsService,
        private readonly notificationsService: NotificationsService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    /** Chạy mỗi 2 phút — kiểm tra backlog */
    @Cron('*/2 * * * *')
    async checkBacklog() {
        const metrics = await this.queueEventsService.getAllQueueMetrics();

        const thresholds: Record<string, number> = {
            'crawl_discovery': 10,
            'crawl_scrape': 50,
            'crawl_process': 30,
            'crawl_seo': 20,
            'crawl_publish': 15,
            'ai-content-queue': 10,
            'mail_queue': 50,
        };

        for (const [queueName, data] of Object.entries(metrics)) {
            const threshold = thresholds[queueName] || 20;
            const totalPending = data.waiting + data.delayed;

            if (totalPending > threshold) {
                // Chỉ alert nếu chưa alert gần đây (throttle 30 phút)
                const alertKey = `backlog_alert:${queueName}`;
                const alerted = await this.cache.get(alertKey);
                if (alerted) continue;

                await this.notificationsService.createForAdmins({
                    type: NotificationType.QUEUE_BACKLOG,
                    priority: totalPending > threshold * 3
                        ? NotificationPriority.HIGH
                        : NotificationPriority.MEDIUM,
                    title: `Queue "${queueName}" tồn đọng ${totalPending} jobs`,
                    message: `Waiting: ${data.waiting} | Delayed: ${data.delayed} | Active: ${data.active}. Threshold: ${threshold}`,
                    source: 'system',
                    actionUrl: '/admin/monitor/queues',
                    metadata: { queue: queueName, ...data },
                    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
                });

                await this.cache.set(alertKey, true, 30 * 60 * 1000); // Throttle 30 phút
            }
        }
    }

    /** Chạy mỗi 5 phút — kiểm tra system health */
    @Cron('*/5 * * * *')
    async checkSystemHealth() {
        const metrics = await this.queueEventsService.getAllQueueMetrics();

        // Kiểm tra queue bị paused
        for (const [name, data] of Object.entries(metrics)) {
            if (data.isPaused) {
                const alertKey = `paused_alert:${name}`;
                const alerted = await this.cache.get(alertKey);
                if (!alerted) {
                    await this.notificationsService.createForAdmins({
                        type: NotificationType.SYSTEM_ALERT,
                        priority: NotificationPriority.HIGH,
                        title: `Queue "${name}" đã bị PAUSE`,
                        message: `Queue ${name} đang bị pause. Jobs mới sẽ không được xử lý.`,
                        source: 'system',
                        actionUrl: '/admin/monitor/queues',
                    });
                    await this.cache.set(alertKey, true, 60 * 60 * 1000);
                }
            }
        }

        // Kiểm tra stalled jobs
        const stalledCount = Object.values(metrics).reduce(
            (sum, m: any) => sum + (m.stalled || 0), 0
        );
        if (stalledCount > 0) {
            await this.notificationsService.createForAdmins({
                type: NotificationType.QUEUE_STALLED,
                priority: NotificationPriority.CRITICAL,
                title: `${stalledCount} jobs bị STALLED`,
                message: `Có ${stalledCount} jobs không phản hồi. Kiểm tra workers ngay.`,
                source: 'system',
            });
        }
    }
}
```

---

## 9. API ENDPOINTS MỚI

### 9.1. Queue Monitor Controller

```typescript
// File mới: erg-backend/src/shared/queue-monitor/queue-monitor.controller.ts

@Controller('admin/monitor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('system.admin')
export class QueueMonitorController {
    constructor(
        private readonly queueEventsService: QueueEventsService,
        private readonly jobActivityService: JobActivityService,
    ) {}

    /** Dashboard tổng quan */
    @Get('dashboard')
    async getDashboard() {
        const [queueMetrics, jobMetrics] = await Promise.all([
            this.queueEventsService.getAllQueueMetrics(),
            this.jobActivityService.getDashboardMetrics(),
        ]);
        return { queues: queueMetrics, jobs: jobMetrics };
    }

    /** Metrics từng queue */
    @Get('queues')
    async getQueueMetrics() {
        return this.queueEventsService.getAllQueueMetrics();
    }

    /** Jobs đang active */
    @Get('jobs/active')
    async getActiveJobs() {
        return this.jobActivityService.getActiveJobs();
    }

    /** Lịch sử jobs (phân trang, filter) */
    @Get('jobs/history')
    async getJobHistory(
        @Query('queue') queue?: string,
        @Query('state') state?: JobState,
        @Query('groupKey') groupKey?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 50,
    ) {
        return this.jobActivityService.getJobHistory({ queue, state, groupKey, page, limit });
    }

    /** Thống kê theo thời gian (cho chart) */
    @Get('jobs/stats')
    async getJobStats(@Query('hours') hours = 24) {
        return this.jobActivityService.getQueueStats(hours);
    }

    /** Retry 1 job failed */
    @Post('jobs/:jobId/retry')
    async retryJob(
        @Param('jobId') jobId: string,
        @Query('queue') queueName: string,
    ) {
        // Lấy queue và retry job
        const queue = this.getQueueByName(queueName);
        const job = await queue.getJob(jobId);
        if (!job) throw new NotFoundException('Job not found');
        await job.retry();
        return { message: `Job ${jobId} đã được retry`, jobId };
    }

    /** Pause/Resume queue */
    @Post('queues/:name/pause')
    async pauseQueue(@Param('name') name: string) {
        const queue = this.getQueueByName(name);
        await queue.pause();
        return { message: `Queue ${name} đã pause` };
    }

    @Post('queues/:name/resume')
    async resumeQueue(@Param('name') name: string) {
        const queue = this.getQueueByName(name);
        await queue.resume();
        return { message: `Queue ${name} đã resume` };
    }

    /** Clean completed/failed jobs */
    @Post('queues/:name/clean')
    async cleanQueue(
        @Param('name') name: string,
        @Query('status') status: 'completed' | 'failed' = 'completed',
        @Query('grace') grace = 3600000, // 1 hour
    ) {
        const queue = this.getQueueByName(name);
        const cleaned = await queue.clean(grace, 1000, status);
        return { message: `Cleaned ${cleaned.length} ${status} jobs from ${name}` };
    }

    /** Scheduler status */
    @Get('scheduler')
    async getSchedulerStatus() {
        return this.crawlerScheduler.getSchedulerStatus();
    }
}
```

### 9.2. Notification Endpoints mở rộng

```typescript
// File cần sửa: erg-backend/src/modules/notifications/notifications.controller.ts

// THÊM endpoints:

/** Lấy notifications theo type */
@Get('by-type/:type')
async getByType(@Req() req, @Param('type') type: NotificationType, @Query('limit') limit = 20) {
    return this.service.findByType(req.user.id, type, limit);
}

/** Lấy notifications theo source */
@Get('by-source/:source')
async getBySource(@Req() req, @Param('source') source: string, @Query('limit') limit = 20) {
    return this.service.findBySource(req.user.id, source, limit);
}

/** Lấy notifications theo group */
@Get('group/:groupKey')
async getByGroup(@Req() req, @Param('groupKey') groupKey: string) {
    return this.service.findByGroup(req.user.id, groupKey);
}

/** Xóa tất cả đã đọc */
@Delete('read')
async deleteAllRead(@Req() req) {
    return this.service.deleteAllRead(req.user.id);
}

/** Notification preferences (user config) */
@Get('preferences')
async getPreferences(@Req() req) {
    return this.service.getPreferences(req.user.id);
}

@Put('preferences')
async updatePreferences(@Req() req, @Body() body: NotificationPreferencesDto) {
    return this.service.updatePreferences(req.user.id, body);
}
```

---

## 10. CHECKLIST TỔNG HỢP

### Ưu tiên CAO 🔴

- [ ] Mở rộng `NotificationType` enum (thêm ~20 types mới)
- [ ] Thêm `NotificationPriority`, `NotificationChannel` enums
- [ ] Thêm fields mới vào Notification entity (`actionUrl`, `actions`, `groupKey`, `source`, `actorId`, `expiresAt`)
- [ ] Thêm MongoDB indexes + TTL index cho `expiresAt`
- [ ] Tạo `QueueMonitorModule` với tất cả services
- [ ] Tạo `QueueEventsService` — global listener cho 7 queues
- [ ] Tạo `JobActivityService` + `JobActivity` entity (MongoDB)
- [ ] Tạo `SseService` + `SseController` (GET `/admin/events/stream`)
- [ ] Tích hợp SSE vào `NotificationsService.create()`
- [ ] Tạo `createForAdmins()` method trong NotificationsService
- [ ] Gửi notification khi AI post / crawl **thành công**

### Ưu tiên TRUNG BÌNH 🟡

- [ ] Tạo `CrawlBatchTrackerService` + batch summary
- [ ] Tạo `BacklogWatcherService` — cảnh báo queue tồn đọng (cron 2 phút)
- [ ] Tạo `AdminAuditInterceptor` — log admin actions
- [ ] Thêm notification cho mail failed, scheduler events
- [ ] Tạo `QueueMonitorController` — API dashboard, retry, pause/resume, clean
- [ ] Thêm scheduler status endpoint
- [ ] Notification cho refine-content success/fail
- [ ] Auto-cleanup cron (3h sáng, xóa noti đã đọc > 30 ngày)

### Ưu tiên THẤP 🟢

- [ ] Notification preferences per user (cho phép tắt/bật từng loại)
- [ ] Queue stats aggregation (cho charts)
- [ ] Endpoints lọc notification theo type, source, group
- [ ] Xóa batch notifications đã đọc

### Effort ước tính

| Module | Effort |
|--------|--------|
| Notification Entity + Types mở rộng | 2h |
| QueueEventsService (global listener) | 4h |
| JobActivityService + Entity | 4h |
| SSE Service + Controller | 3h |
| CrawlBatchTrackerService | 3h |
| BacklogWatcherService | 2h |
| AdminAuditInterceptor | 3h |
| QueueMonitorController (API) | 3h |
| Tích hợp notifications vào từng processor | 4h |
| NotificationsService mở rộng | 2h |
| **TỔNG** | **~30h** |
