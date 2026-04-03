import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';

export interface BatchInfo {
    batchId: string;
    totalJobs: number;
    completedCount: number;
    failedCount: number;
    rssId?: string;
    feedName?: string;
    createdAt: number;
}

@Injectable()
export class CrawlBatchTrackerService {
    private readonly logger = new Logger(CrawlBatchTrackerService.name);
    private readonly BATCH_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly notificationsService: NotificationsService
    ) { }

    private getBatchKey(batchId: string): string {
        return `crawl_batch:${batchId}`;
    }

    /**
     * Khởi tạo tracking một batch (có N bài báo cần cào)
     */
    async registerBatch(batchId: string, totalJobs: number, rssId?: string, feedName?: string): Promise<void> {
        const batchInfo: BatchInfo = {
            batchId,
            totalJobs,
            completedCount: 0,
            failedCount: 0,
            rssId,
            feedName,
            createdAt: Date.now()
        };

        await this.cacheManager.set(this.getBatchKey(batchId), batchInfo, this.BATCH_TTL_MS);
        this.logger.log(`[Batch Tracker] Registered batch ${batchId} with ${totalJobs} jobs.`);
    }

    /**
     * Theo dõi tiến độ giữa các stage (Khám phá -> Cào -> Render -> SEO -> Xuất bản)
     */
    async trackStageProgress(batchId: string, stage: string, jobId: string, url: string): Promise<void> {
        this.logger.debug(`[Batch Tracker] Batch ${batchId} | Job ${jobId} | URL ${url} | Stage: ${stage}`);
        // Có thể bắn SSE ở đây để FE hiển thị progress bar per URL
        // this.pubSub.publish('crawlProgress', { batchId, jobId, url, stage });
    }

    /**
     * Ghi nhận 1 job trong batch đã hoàn thành hoặc thất bại ở bước publish/failed
     */
    async trackJobCompletion(batchId: string, status: 'success' | 'failed', jobId: string, url: string): Promise<void> {
        const key = this.getBatchKey(batchId);
        const batchInfo = await this.cacheManager.get<BatchInfo>(key);

        if (!batchInfo) {
            this.logger.warn(`[Batch Tracker] Batch ${batchId} not found in cache for job completion.`);
            return;
        }

        if (status === 'success') {
            batchInfo.completedCount++;
        } else {
            batchInfo.failedCount++;
        }

        await this.cacheManager.set(key, batchInfo, this.BATCH_TTL_MS);

        // Cập nhật progress ra FE
        // this.pubSub.publish('batchProgress', { batchId, completed: batchInfo.completedCount, failed: batchInfo.failedCount, total: batchInfo.totalJobs });

        // Nếu tất cả jobs trong batch đã chạy xong
        if (batchInfo.completedCount + batchInfo.failedCount >= batchInfo.totalJobs) {
            await this.sendBatchSummary(batchInfo);
            // Có thể xóa cache nếu muốn hoặc giữ cache để FE get lại
        }
    }

    /**
     * Tổng hợp và gửi thông báo Batch Report
     */
    private async sendBatchSummary(batchInfo: BatchInfo): Promise<void> {
        const durationSeconds = Math.round((Date.now() - batchInfo.createdAt) / 1000);
        this.logger.log(`[Batch Tracker] Batch ${batchInfo.batchId} COMPLETED in ${durationSeconds}s. Success: ${batchInfo.completedCount} | Failed: ${batchInfo.failedCount}`);

        const message = `${batchInfo.feedName ? 'RSS ' + batchInfo.feedName : 'Manual Batch'} hoàn thành cào ${batchInfo.totalJobs} bài. 
Thành công: ${batchInfo.completedCount}. 
Thất bại: ${batchInfo.failedCount}. 
Thời gian: ${durationSeconds}s.`;

        await this.notificationsService.createForAdmins({
            type: NotificationType.CRAWL_COMPLETED, // Sử dụng NotificationType phù hợp
            title: 'Hoàn thành Batch Cào Bài',
            message: message,
            priority: batchInfo.failedCount > 0 ? NotificationPriority.MEDIUM : NotificationPriority.LOW,
            actionUrl: '/admin/crawler/pipeline',
            metadata: {
                batchId: batchInfo.batchId,
                total: batchInfo.totalJobs,
                success: batchInfo.completedCount,
                failed: batchInfo.failedCount
            },
        });
    }
}
