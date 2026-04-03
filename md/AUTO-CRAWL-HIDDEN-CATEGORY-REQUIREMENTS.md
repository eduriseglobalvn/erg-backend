# DỊCH VỤ CRAWL ẨN (HIDDEN CATEGORY) - YÊU CẦU PHÁT TRIỂN MỚI

> **Reviewer:** Senior Developer & PO
> **Ngày:** 2026-03-03
> **Scope:** erg-backend (NestJS 11+)
> **Mục tiêu:** Tự động hóa quá trình crawl nội dung ẩn theo keyword và lịch trình

---

## 1. YÊU CẦU HỆ THỐNG

### 1.1. Tổng quan
Hệ thống cần hỗ trợ tự động crawl nội dung từ các nguồn bên ngoài theo keyword và lịch trình định sẵn, thay vì chỉ phân loại bài viết đã crawl vào category ẩn.

### 1.2. Mục tiêu
- Tự động crawl nội dung tips, mẹo, kiến thức từ các trang bên ngoài
- Hỗ trợ crawl theo keyword cụ thể
- Tự động hóa quá trình crawl theo lịch trình (cron job)
- Bảo mật và kiểm soát quyền truy cập
- Tích hợp với hệ thống quản lý nội dung hiện có

### 1.3. Đặc điểm kỹ thuật
- Sử dụng cron job để chạy định kỳ
- Hỗ trợ nhiều keyword trên một feed
- Tự động phân loại vào category ẩn
- Quản lý lịch trình crawl linh hoạt

---

## 2. YÊU CẦU KỸ THUẬT

### 2.1. Cập nhật Entity

#### RssFeed Entity
```typescript
// File: erg-backend/src/modules/crawler/entities/rss-feed.entity.ts

@Entity({ collection: 'crawler_rss_feeds' })
export class RssFeed extends MongoBaseEntity {
  // ... existing fields ...

  /** Đánh dấu RSS này phục vụ crawl ẩn */
  @Property({ default: false })
  isHiddenCrawl: boolean = false;

  /** Nếu isHiddenCrawl=true, tự động gán category ẩn thay vì targetCategoryId */
  @Property({ nullable: true })
  hiddenCategorySlug?: string; // '__hidden_tips', '__hidden_reference', etc.

  /** Keywords để crawl tự động (phân tách bằng dấu phẩy) */
  @Property({ nullable: true })
  autoKeywords?: string;

  /** Cron schedule cho việc crawl tự động */
  @Property({ nullable: true })
  autoSchedule?: string; // Ví dụ: "0 0 * * *" (mỗi ngày lúc 00:00)
}
```

### 2.2. Tạo Auto Crawl Scheduler

```typescript
// File: erg-backend/src/modules/crawler/schedulers/auto-crawl.scheduler.ts

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RssFeedService } from '../services/rss-feed.service';
import { CrawlService } from '../services/crawl.service';

@Injectable()
export class AutoCrawlScheduler {
  constructor(
    private readonly rssFeedService: RssFeedService,
    private readonly crawlService: CrawlService,
  ) {}

  /**
   * Cron job chạy hàng ngày để crawl các feed tự động
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyAutoCrawl() {
    const feeds = await this.rssFeedService.findAutoCrawlFeeds();

    for (const feed of feeds) {
      if (feed.autoSchedule && feed.autoKeywords) {
        const keywords = feed.autoKeywords.split(',').map(k => k.trim());
        for (const keyword of keywords) {
          await this.crawlService.crawlWithKeyword(feed.id, keyword);
        }
      }
    }
  }

  /**
   * Cron job chạy theo lịch trình tùy chỉnh
   */
  @Cron('*/30 * * * *') // Mỗi 30 phút
  async handleScheduledAutoCrawl() {
    const feeds = await this.rssFeedService.findScheduledAutoCrawlFeeds();

    for (const feed of feeds) {
      if (feed.autoSchedule) {
        // Kiểm tra xem có cần chạy không dựa vào cron schedule
        if (this.shouldRun(feed.autoSchedule)) {
          const keywords = feed.autoKeywords?.split(',').map(k => k.trim()) || [''];
          for (const keyword of keywords) {
            await this.crawlService.crawlWithKeyword(feed.id, keyword);
          }
        }
      }
    }
  }

  private shouldRun(schedule: string): boolean {
    // Implementation để kiểm tra cron schedule
    // Có thể dùng thư viện node-cron hoặc viết logic riêng
    return true;
  }
}
```

### 2.3. Tạo Auto Crawl Service

```typescript
// File: erg-backend/src/modules/crawler/services/auto-crawl.service.ts

import { Injectable } from '@nestjs/common';
import { CrawlService } from './crawl.service';
import { RssFeedService } from './rss-feed.service';

@Injectable()
export class AutoCrawlService {
  constructor(
    private readonly crawlService: CrawlService,
    private readonly rssFeedService: RssFeedService,
  ) {}

  /**
   * Crawl tự động với keyword cụ thể
   */
  async crawlWithKeyword(feedId: string, keyword: string) {
    try {
      // Tìm feed phù hợp
      const feed = await this.rssFeedService.findById(feedId);

      if (!feed || !feed.isHiddenCrawl) {
        throw new Error('Feed không tồn tại hoặc không phải feed crawl ẩn');
      }

      // Thực hiện crawl với keyword
      const results = await this.crawlService.searchAndCrawl(feed, keyword);

      // Gửi vào queue publish để xử lý
      for (const result of results) {
        await this.crawlService.enqueuePublishJob({
          ...result,
          rssId: feed.id,
          isHiddenCrawl: true,
          hiddenCategorySlug: feed.hiddenCategorySlug || '__hidden_scrape_pool',
          autoKeywords: keyword,
        });
      }

      return { success: true, count: results.length };
    } catch (error) {
      console.error('Auto crawl failed:', error);
      throw error;
    }
  }

  /**
   * Crawl tự động với nhiều keyword
   */
  async crawlWithMultipleKeywords(feedId: string, keywords: string[]) {
    const results = [];

    for (const keyword of keywords) {
      const result = await this.crawlWithKeyword(feedId, keyword);
      results.push(result);
    }

    return results;
  }
}
```

### 2.4. Cập nhật Publish Processor

```typescript
// File: erg-backend/src/modules/crawler/processors/publish.processor.ts

async process(job: Job<any>): Promise<any> {
  const { rawId, url, rssId, targetCategoryId, autoPublish, isHiddenCrawl, autoKeywords } = job.data;

  // Nếu là hidden crawl → tìm hidden category
  let finalCategoryId = targetCategoryId;
  if (isHiddenCrawl || !targetCategoryId) {
    const hiddenCategory = await em.findOne(PostCategory, {
      slug: job.data.hiddenCategorySlug || '__hidden_scrape_pool',
      isHidden: true,
    });
    if (hiddenCategory) {
      finalCategoryId = hiddenCategory.id;
    }
  }

  // Tạo post với category ẩn
  const post = await this.postsService.create({
    // ...
    categoryId: finalCategoryId,
    status: PostStatus.DRAFT, // Hidden crawl luôn là DRAFT
    isCreatedByAI: false,
    aiPrompt: `[HIDDEN CRAWL] Source: ${url} | Keywords: ${autoKeywords || 'N/A'}`,
  } as any, admin);
}
```

### 2.5. Cập nhật Controller

```typescript
// File: erg-backend/src/modules/posts/posts.controller.ts

// Endpoint mới: Crawl tự động theo keyword
@Post('auto-crawl')
@Permissions('crawler.auto_crawl')
async startAutoCrawl(
  @Body() body: { feedId: string; keywords: string[] },
) {
  const { feedId, keywords } = body;
  return await this.autoCrawlService.crawlWithMultipleKeywords(feedId, keywords);
}
```

---

## 3. YÊU CẦU PHÂN QUYỀN

### 3.1. Permission mới
- `crawler.auto_crawl`: Cho phép thực hiện crawl tự động

### 3.2. Bảo mật
- Các endpoint auto crawl đều yêu cầu permission đặc biệt
- Chỉ admin có quyền mới có thể khởi chạy crawl tự động
- Kiểm tra quyền truy cập trước khi thực hiện crawl

---

## 4. FLOW HỆ THỐNG

```
[Admin tạo RSS Feed với auto crawl]    [Scheduler tự động]
  isHiddenCrawl: true,                  ──────►    triggerAutoCrawl()
  autoKeywords: 'giải pháp, mẹo vặt'     │
  autoSchedule: '0 0 * * *'              │
                                        ▼
                             ┌────────────────────────────────────┐
                             │  Auto Crawl Scheduler              │
                             │  (Cron job)                        │
                             └──────────┬─────────────────────────┘
                                        │
                                        ▼
                   ┌──────────────────────────────────────────────────┐
                   │  Crawl Service with Keyword Search               │
                   │  (Tìm kiếm và crawl theo keyword)                │
                   └──────────┬───────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────────────────────┐
                    │  Publish Processor (gán category ẩn)        │
                    │  (Tạo bài viết DRAFT trong category ẩn)     │
                    └──────────┬───────────────────────────────────┘
                               │
                               ▼
                    Post(category='__hidden_scrape_pool')
                    status=DRAFT
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         [Admin Review]  [Tự động tag]   [Archive]
         Rewrite + Move  keywords/labels  Lưu tham khảo
         → Public post   cho tìm kiếm     → Không dùng
```

---

## 5. CHECKLIST TRIỂN KHAI

### 5.1. Backend Requirements
- [ ] Cập nhật entity `RssFeed` với các trường mới
- [ ] Tạo `AutoCrawlScheduler` với cron jobs
- [ ] Tạo `AutoCrawlService` cho crawl tự động
- [ ] Cập nhật `publish.processor.ts` để xử lý crawl tự động
- [ ] Thêm endpoint `POST /crawler/auto-crawl`
- [ ] Cập nhật permission `crawler.auto_crawl`

### 5.2. Testing Checklist
- [ ] Kiểm tra cron job chạy đúng lịch trình
- [ ] Kiểm tra crawl tự động theo keyword
- [ ] Kiểm tra phân loại vào category ẩn
- [ ] Kiểm tra permission và bảo mật
- [ ] Kiểm tra xử lý lỗi khi crawl thất bại

### 5.3. Deployment Checklist
- [ ] Cấu hình cron job trên server
- [ ] Kiểm tra permission hệ thống
- [ ] Test với các feed crawl ẩn
- [ ] Giám sát hiệu suất crawl
- [ ] Log và monitoring các hoạt động crawl

---