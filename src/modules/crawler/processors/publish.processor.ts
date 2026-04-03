import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CrawlRawContent, CrawlStatus } from '../entities/crawl-raw-content.entity';
import { Post } from '@/modules/posts/entities/post.entity';
import { User } from '@/modules/users/entities/user.entity';
import { CrawlHistory } from '../entities/crawl-history.entity';
import { PostsService } from '@/modules/posts/posts.service';
import { PostCategory } from '@/modules/posts/entities/post-category.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationType, NotificationPriority } from '@/modules/notifications/entities/notification.entity';
import { AutoLinkingService } from '@/modules/seo/services/auto-linking.service';
import { PostStatus } from '@/shared/enums/app.enum';
import { Role } from '@/modules/access-control/entities/role.entity';
import { RssFeed } from '../entities/rss-feed.entity';
import { CrawlBatchTrackerService } from '../services/crawl-batch-tracker.service';
import { DeadLetterService } from '../services/dead-letter.service';

@Processor('crawl_publish', { concurrency: 1 }) // Concurrency = 1 for safe DB writes
export class PublishProcessor extends WorkerHost {
    private readonly logger = new Logger(PublishProcessor.name);

    constructor(
        @InjectRepository(CrawlRawContent, 'mongo-connection')
        private readonly rawRepo: EntityRepository<CrawlRawContent>,
        @InjectRepository(CrawlHistory, 'mongo-connection')
        private readonly historyRepo: EntityRepository<CrawlHistory>,
        @InjectRepository(RssFeed, 'mongo-connection')
        private readonly feedRepo: EntityRepository<RssFeed>,
        @InjectRepository(Post)
        private readonly postRepo: EntityRepository<Post>,
        @InjectRepository(PostCategory)
        private readonly categoryRepo: EntityRepository<PostCategory>,
        private readonly postsService: PostsService,
        private readonly notificationsService: NotificationsService,
        private readonly autoLinkingService: AutoLinkingService,
        private readonly crawlBatchTracker: CrawlBatchTrackerService,
        private readonly deadLetterService: DeadLetterService,
    ) {
        super();
        this.worker.on('failed', async (job: Job | undefined, error: Error) => {
            if (job && job.attemptsMade >= job.opts.attempts!) {
                await this.deadLetterService.handlePermanentFailure('crawl_publish', job.name, job.id!, job.data, error.message);
            }
        });
    }

    async process(job: Job<any>): Promise<any> {
        const { rawId, url, rssId, targetCategoryId, autoPublish, manual, jobId, batchId } = job.data;
        this.logger.log(`[PUBLISH JOB START] RawID: ${rawId} | URL: ${url}`);

        const rawContent = await this.rawRepo.findOne({ id: rawId });
        if (!rawContent) {
            this.logger.error(`RawContent not found for ID: ${rawId}`);
            return;
        }

        const em = this.postRepo.getEntityManager().fork();
        const adminEmail = process.env.ADMIN_DEFAULT_EMAIL;

        let admin: any = null;
        if (adminEmail) {
            admin = await em.findOne(User, { email: adminEmail });
        }

        if (!admin) {
            const baseRoles = await em.find(Role, { name: 'Super Admin' });
            if (baseRoles.length > 0) {
                admin = await em.findOne(User, { roles: { $in: baseRoles.map(r => r.id) } }, { orderBy: { createdAt: 'ASC' } });
            }
        }

        if (!admin) {
            admin = await em.findOne(User, {}, { orderBy: { createdAt: 'ASC' } });
        }

        if (!admin) {
            this.logger.error('No admin user found. Cannot create Post.');
            return;
        }

        try {
            let finalCategoryId = targetCategoryId;

            // Validate RSS Feed Hidden Config
            if (rssId) {
                const feed = await this.feedRepo.findOne({ id: rssId });
                if (feed?.isHiddenCrawl) {
                    const targetSlug = feed.hiddenCategorySlug || '__hidden_scrape_pool';
                    const hiddenCat = await this.categoryRepo.findOne({ slug: targetSlug });
                    if (hiddenCat) {
                        finalCategoryId = hiddenCat.id;
                    } else {
                        this.logger.warn(`Fallback: Hidden Category slug '${targetSlug}' not found.`);
                    }
                }
            }

            const title = rawContent.rawTitle || 'Untitled Post';
            const seoData = rawContent.seoData || { metaTitle: title, metaDescription: '', keywords: [] as string[] };
            const content = rawContent.seoContent || rawContent.processedContent || rawContent.rawContent || '';

            const post = await this.postsService.create({
                title,
                slug: this.slugify(title) + '-' + Math.random().toString(36).substring(2, 6),
                content,
                excerpt: seoData.metaDescription || '',
                thumbnailUrl: rawContent.thumbnailUrl || undefined,
                status: autoPublish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
                categoryId: finalCategoryId,
                metaTitle: seoData.metaTitle,
                metaDescription: seoData.metaDescription,
                keywords: seoData.keywords,
                focusKeyword: title.split(' ').slice(0, 3).join(' '),
                // Pass AI-related data
                isCreatedByAI: false,
                aiPrompt: `Crawled from: ${url}`,
                aiJobId: jobId,
            } as any, admin);

            // Auto-linking keywords
            try {
                const linkResult = await this.autoLinkingService.applyAutoLinks(post.content || '', post.id);
                post.content = linkResult.updatedContent;
                await em.flush();
                this.logger.log(`[AUTO-LINK] Applied ${linkResult.linksAdded} links to Post: ${post.id}`);
            } catch (linkError) {
                this.logger.warn(`[AUTO-LINK FAILED] ${linkError.message}`);
            }

            // Update states
            rawContent.status = CrawlStatus.PUBLISHED;
            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            const mongoEm = this.historyRepo.getEntityManager().fork();
            await this.saveHistory(mongoEm, url, rssId, 'SUCCESS', undefined, post.id);
            this.logger.log(`✅ [PUBLISH SUCCESS] URL: ${url} | Post ID: ${post.id}`);

            await this.notificationsService.createForAdmins({
                type: NotificationType.CRAWL_COMPLETED,
                title: 'Cào bài viết thành công',
                message: `Đã xuất bản bài viết: "${title}".`,
                actionUrl: `/admin/posts/${post.id}/edit`,
                metadata: { url, rssId, postId: post.id }
            });

            if (batchId) {
                await this.crawlBatchTracker.trackJobCompletion(batchId, 'success', job.id!, url);
            }

        } catch (error) {
            this.logger.error(`❌ [PUBLISH FAILED] URL: ${url} | Error: ${error.message}`);
            rawContent.status = CrawlStatus.FAILED;
            rawContent.error = { step: 'PUBLISH', message: error.message, stack: error.stack };
            await this.rawRepo.getEntityManager().persistAndFlush(rawContent);

            const mongoEm = this.historyRepo.getEntityManager().fork();
            await this.saveHistory(mongoEm, url, rssId, 'FAILED', error.message);

            // Notifications
            try {
                await this.notificationsService.createForAdmins({
                    type: NotificationType.CRAWL_FAILED,
                    title: 'Cào bài viết thất bại',
                    message: `Không thể publish cào tin: ${url}. Lỗi: ${error.message}`,
                    priority: NotificationPriority.HIGH,
                    metadata: { url, rssId, error: error.message },
                });
            } catch (e) { }

            if (batchId) {
                await this.crawlBatchTracker.trackJobCompletion(batchId, 'failed', job.id!, url);
            }
        }
    }

    private slugify(text: string) {
        return text.toString().toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-\u00C0-\u1EF9]+/g, '')
            .replace(/\-\-+/g, '-');
    }

    private async saveHistory(mongoEm: any, url: string, sourceId: string | undefined | null, status: 'SUCCESS' | 'FAILED', errorMsg?: string, postId?: string) {
        if (!url) return;
        try {
            let history = await mongoEm.findOne(CrawlHistory, { url });
            if (!history) {
                history = mongoEm.create(CrawlHistory, { url, sourceId: sourceId || undefined, status, errorMessage: errorMsg, postId, crawledAt: new Date() });
            } else {
                history.status = status;
                history.errorMessage = errorMsg;
                if (postId) history.postId = postId;
                history.crawledAt = new Date();
                if (sourceId) history.sourceId = sourceId;
            }
            await mongoEm.persistAndFlush(history);
        } catch (e) {
            this.logger.error(`Failed to save history for ${url}: ${e.message}`);
        }
    }
}
