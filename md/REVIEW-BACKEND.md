# ERG Backend - Review & Optimization Plan

> **Reviewer:** Senior Developer & PO
> **Ngày review:** 2026-03-02
> **Scope:** erg-backend (NestJS 11+)
> **File gốc:** REVIEW-OPTIMIZATION-PLAN.md

---

## MỤC LỤC

1. [Bảo mật API & Chống DDoS](#1-bảo-mật-api--chống-ddos)
2. [Tối ưu Crawl Post & AI Gen Post](#2-tối-ưu-crawl-post--ai-gen-post)
3. [Dịch vụ Crawl ẩn (Hidden Category)](#3-dịch-vụ-crawl-ẩn-hidden-category)
4. [AI tạo Post chuyên nghiệp](#4-ai-tạo-post-chuyên-nghiệp)
5. [SEO tự động không bị Rate Limit](#5-seo-tự-động-không-bị-rate-limit)
6. [Quản lý API Key thông minh](#6-quản-lý-api-key-thông-minh)
7. [AI Image Generation từ API Key hiện có](#7-ai-image-generation-từ-api-key-hiện-có)
8. [Cải thiện Notification cho Jobs](#8-cải-thiện-hệ-thống-notification-cho-jobs)

---

## 1. BẢO MẬT API & CHỐNG DDoS

### 1.1. Hiện trạng bảo mật (Đã có)

| Layer | Công nghệ | File | Đánh giá |
|-------|-----------|------|----------|
| HTTP Headers | Helmet (CSP disabled cho Swagger) | `main.ts` | **Trung bình** - CSP nên bật cho production |
| CORS | Whitelist domains (`*.erg.edu.vn`, localhost, vercel) | `main.ts` | **Tốt** - Đã restrict origins |
| Authentication | JWT (Access 3h + Refresh 7d) | `jwt-auth.guard.ts` | **Tốt** - Token rotation |
| Authorization | RBAC (Roles → Permissions) | `permissions.guard.ts` | **Tốt** - Granular permissions |
| Password | Argon2 hashing | `auth.service.ts` | **Tốt** - Best practice |
| Validation | class-validator + whitelist | `main.ts` (GlobalPipe) | **Tốt** - Strip unknown props |
| Rate Limit | ThrottlerModule (3 tiers) | `app.module.ts` | **Trung bình** - Cần cải thiện |
| SSRF | URL validation trong Crawler | `scrape.processor.ts` | **Tốt** - Block private IPs |

### 1.2. Lỗ hổng & Rủi ro hiện tại

#### A. Không có IP-based Rate Limiting
- **Vấn đề:** ThrottlerModule hiện tại dùng **default storage (in-memory)**, không scale được khi có nhiều instance.
- **Rủi ro:** Attacker dùng distributed IPs bypass throttle. Nếu chạy multi-instance (PM2/K8s), mỗi instance có counter riêng → throttle không chính xác.
- **Mức độ:** 🔴 **Cao**

#### B. Không có Request Size Limiting
- **Vấn đề:** Không giới hạn body size → kẻ tấn công gửi payload cực lớn (slowloris/large body attack).
- **Rủi ro:** Memory exhaustion, service crash.
- **Mức độ:** 🔴 **Cao**

#### C. Không có IP Blacklist/Whitelist
- **Vấn đề:** Không có cơ chế block IP đáng ngờ hoặc whitelist IP admin.
- **Rủi ro:** Không thể nhanh chóng block attacker.
- **Mức độ:** 🟡 **Trung bình**

#### D. CSP bị tắt hoàn toàn
- **Vấn đề:** `helmet({ contentSecurityPolicy: false })` → tắt CSP cho mọi route, không chỉ Swagger.
- **Rủi ro:** XSS attacks nếu có injection point.
- **Mức độ:** 🟡 **Trung bình**

#### E. Không có Abuse Detection
- **Vấn đề:** Không track pattern bất thường (sudden spike, repeated failed auth, sequential endpoint scanning).
- **Rủi ro:** Không phát hiện sớm tấn công.
- **Mức độ:** 🟡 **Trung bình**

#### F. Swagger exposed ở Production
- **Vấn đề:** Swagger UI (`/api-docs`) luôn bật → lộ toàn bộ API schema.
- **Rủi ro:** Attacker dễ dàng map toàn bộ endpoints.
- **Mức độ:** 🟡 **Trung bình**

### 1.3. Đề xuất cải thiện - Chi tiết triển khai

#### FIX 1: Chuyển Throttler sang Redis Storage (Ưu tiên 🔴)

```
File cần sửa: erg-backend/src/app.module.ts
Package cần cài: @nestjs/throttler (đã có), ioredis (đã có)
```

**Tại sao:** Redis-backed throttler đảm bảo rate limit hoạt động đúng khi chạy nhiều instances (PM2 cluster, Docker Swarm, K8s).

**Cách làm:**
```typescript
// app.module.ts - Thay đổi ThrottlerModule config
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'short', ttl: 1000, limit: 20 },
    { name: 'medium', ttl: 60000, limit: 200 },
    { name: 'long', ttl: 3600000, limit: 1000 },
    { name: 'auth-login', ttl: 900000, limit: 5 },
    { name: 'auth-register', ttl: 3600000, limit: 3 },
  ],
  // THÊM: Redis storage
  storage: new ThrottlerStorageRedisService(
    new Redis({
      host: process.env.REDIS_HOST,
      port: +process.env.REDIS_PORT,
      password: process.env.REDIS_PASS,
    })
  ),
})
```

**Package:** `@nest-lab/throttler-storage-redis` hoặc tự implement `ThrottlerStorage` interface với Redis.

---

#### FIX 2: Thêm Request Size Limit & Timeout (Ưu tiên 🔴)

```
File cần sửa: erg-backend/src/main.ts
```

**Cách làm:**
```typescript
// main.ts
import { json, urlencoded } from 'express';
import * as timeout from 'connect-timeout';

// Giới hạn body size
app.use(json({ limit: '5mb' }));
app.use(urlencoded({ extended: true, limit: '5mb' }));

// Upload endpoint cho phép lớn hơn
app.use('/api/upload', json({ limit: '50mb' }));

// Request timeout - 30 giây
app.use(timeout('30s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});
```

---

#### FIX 3: Tạo IP Blocking Middleware (Ưu tiên 🟡)

```
File mới: erg-backend/src/core/middlewares/ip-protection.middleware.ts
```

**Thiết kế:**
```typescript
@Injectable()
export class IpProtectionMiddleware implements NestMiddleware {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.headers['x-forwarded-for'];

    // 1. Check blacklist (manual block)
    const isBlocked = await this.cache.get(`ip_blocked:${ip}`);
    if (isBlocked) {
      return res.status(403).json({ message: 'ACCESS_DENIED' });
    }

    // 2. Track request count per IP (sliding window)
    const key = `ip_requests:${ip}`;
    const count = await this.cache.get<number>(key) || 0;

    if (count > 500) { // 500 req/min per IP
      // Auto-block for 10 minutes
      await this.cache.set(`ip_blocked:${ip}`, true, 600);
      return res.status(429).json({ message: 'TOO_MANY_REQUESTS' });
    }

    await this.cache.set(key, count + 1, 60); // 60s window
    next();
  }
}
```

**Admin API để quản lý:**
```
POST /api/admin/security/block-ip    { ip, duration, reason }
DELETE /api/admin/security/block-ip  { ip }
GET /api/admin/security/blocked-ips
GET /api/admin/security/request-stats  (top IPs, suspicious patterns)
```

---

#### FIX 4: Bật CSP cho Production, tắt Swagger ở Production (Ưu tiên 🟡)

```
File cần sửa: erg-backend/src/main.ts
```

**Cách làm:**
```typescript
// main.ts
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://media.erg.edu.vn"],
      connectSrc: ["'self'", "https://*.erg.edu.vn"],
    },
  } : false, // Tắt CSP chỉ ở dev (cho Swagger)
}));

// Swagger chỉ bật ở dev/staging
if (!isProduction) {
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
}
```

---

#### FIX 5: Abuse Detection Service (Ưu tiên 🟡)

```
File mới: erg-backend/src/core/services/abuse-detection.service.ts
```

**Thiết kế:**
```typescript
@Injectable()
export class AbuseDetectionService {
  // Track patterns per IP
  async trackRequest(ip: string, endpoint: string, statusCode: number) {
    // Pattern 1: Brute force login (>5 failed login/5min)
    if (endpoint === '/auth/login' && statusCode === 401) {
      await this.incrementCounter(`abuse:login_fail:${ip}`, 300);
    }

    // Pattern 2: Endpoint scanning (>50 404s/min)
    if (statusCode === 404) {
      await this.incrementCounter(`abuse:404:${ip}`, 60);
    }

    // Pattern 3: High frequency (>100 req/10s from same IP)
    await this.incrementCounter(`abuse:freq:${ip}`, 10);

    // Check thresholds
    await this.evaluateAndBlock(ip);
  }

  private async evaluateAndBlock(ip: string) {
    const loginFails = await this.getCounter(`abuse:login_fail:${ip}`);
    const notFounds = await this.getCounter(`abuse:404:${ip}`);
    const frequency = await this.getCounter(`abuse:freq:${ip}`);

    if (loginFails > 10 || notFounds > 50 || frequency > 100) {
      await this.blockIp(ip, 3600); // Block 1 hour
      await this.notifyAdmin(ip, { loginFails, notFounds, frequency });
    }
  }
}
```

---

#### FIX 6: Thêm Security Headers bổ sung (Ưu tiên 🟢)

```
File cần sửa: erg-backend/src/main.ts
```

```typescript
// Thêm custom headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers don't need this
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

### 1.4. Kiến trúc chống DDoS tổng thể (Khuyến nghị)

```
                    ┌─────────────────┐
                    │   Cloudflare    │  ← Layer 1: CDN + WAF + DDoS Protection
                    │   (WAF Rules)   │     - Rate limit 1000 req/10s per IP
                    │   (Bot Fight)   │     - Challenge suspicious traffic
                    └────────┬────────┘     - Block known bad IPs/ASNs
                             │
                    ┌────────▼────────┐
                    │   Nginx/LB      │  ← Layer 2: Reverse Proxy
                    │   (limit_req)   │     - Connection limit per IP
                    │   (limit_conn)  │     - Request buffering
                    └────────┬────────┘     - SSL termination
                             │
                    ┌────────▼────────┐
                    │   NestJS App    │  ← Layer 3: Application
                    │ ┌─────────────┐ │
                    │ │ IP Middleware│ │     - IP blacklist check
                    │ ├─────────────┤ │     - Request size limit
                    │ │ Throttler   │ │     - Redis-backed rate limit
                    │ │ (Redis)     │ │     - Abuse detection
                    │ ├─────────────┤ │     - JWT validation
                    │ │ Auth Guard  │ │     - Permission check
                    │ ├─────────────┤ │
                    │ │ Controller  │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

**Khuyến nghị mạnh:** Nếu đang dùng Cloudflare (đã thấy R2 storage), hãy bật:
- **Cloudflare WAF** (Free tier có OWASP rules)
- **Rate Limiting Rules** (ví dụ: Block nếu >1000 req/10s cùng IP)
- **Bot Fight Mode** (chặn automated traffic)
- **Under Attack Mode** (bật khi bị DDoS thực sự)

### 1.5. Checklist triển khai Mục 1

- [ ] Cài `@nest-lab/throttler-storage-redis`, cấu hình Redis storage cho Throttler
- [ ] Thêm body size limit (`5mb` default, `50mb` upload)
- [ ] Thêm request timeout (`30s`)
- [ ] Tạo `IpProtectionMiddleware` với Redis-backed blacklist
- [ ] Tạo Admin API quản lý IP block/unblock
- [ ] Bật CSP ở production, tắt Swagger ở production
- [ ] Tạo `AbuseDetectionService` track login failures, 404 scanning, high frequency
- [ ] Thêm security headers (HSTS, Permissions-Policy)
- [ ] Cấu hình Cloudflare WAF + Rate Limiting (nếu đang dùng CF)
- [ ] Viết unit tests cho IP middleware và abuse detection

---

## 2. TỐI ƯU CRAWL POST & AI GEN POST

### 2.1. Hiện trạng Pipeline Crawl (5 stages)

```
RSS Feed → [Discovery] → [Scrape] → [Process] → [SEO] → [Publish] → MySQL Post
           concurrency=2  conc=5     conc=3      conc=2   conc=1
           BullMQ queue   rate:5/s   upload img  AI calls  DB write
```

| Stage | Queue | Concurrency | Chức năng | Đánh giá |
|-------|-------|-------------|-----------|----------|
| Discovery | `crawl_discovery` | 2 | Parse RSS → extract URLs | **Tốt** |
| Scrape | `crawl_scrape` | 5, 5/1000ms | Cheerio/Playwright + SSRF check | **Tốt** - Có domain rate limit 3s |
| Process | `crawl_process` | 3 | Clean HTML, upload images | **Trung bình** - Xem bên dưới |
| SEO | `crawl_seo` | 2 | AI gen title, meta, alt, paraphrase | 🔴 **Bottleneck** |
| Publish | `crawl_publish` | 1 | Create Post + auto-link | **Tốt** - Concurrency=1 đúng |

### 2.2. Vấn đề phát hiện & Đề xuất tối ưu

#### ISSUE 1: SEO Processor là bottleneck nghiêm trọng 🔴

**Vấn đề:** `crawl_seo` concurrency=2 nhưng mỗi job gọi **4 lần AI liên tiếp** (title → meta → alt → paraphrase). Với 12 providers fallback chain, nếu provider đầu bị rate limit → timeout chain dài.

**Hệ quả:** Nếu crawl 50 bài/batch, SEO queue sẽ backlog nghiêm trọng vì AI calls chậm (2-10s mỗi call × 4 calls = 8-40s/bài).

**Đề xuất:**

```typescript
// HIỆN TẠI: 4 AI calls tuần tự trong 1 job
titles = await seoTitleService.generateTitles(...)      // Call 1
metas  = await seoMetaService.generateMetaDescriptions(...) // Call 2
alts   = await seoImageAltService.generateAltTexts(...)  // Call 3
content = await seoContentService.paraphraseForSeo(...)  // Call 4

// ĐỀ XUẤT A: Gộp prompt SEO thành 1 AI call duy nhất
// File: erg-backend/src/modules/seo/services/seo-batch.service.ts (MỚI)
async generateAllSeoData(title: string, content: string, user: User) {
  const prompt = `
    Bạn là chuyên gia SEO. Tối ưu bài viết sau:
    TIÊU ĐỀ: ${title}
    NỘI DUNG (500 ký tự đầu): ${content.substring(0, 500)}

    Trả về JSON:
    {
      "seoTitle": "Tiêu đề SEO tối ưu (50-60 ký tự)",
      "metaDescription": "Meta description (150-160 ký tự, có CTA)",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  `;
  // 1 AI call thay vì 4 → giảm 75% số lần gọi AI
  return JSON.parse(await this.aiContentService.generateWithFallback(prompt, user));
}

// ĐỀ XUẤT B: Chạy song song thay vì tuần tự
const [titles, metas, alts] = await Promise.all([
  seoTitleService.generateTitles(rawTitle, processedContent, admin),
  seoMetaService.generateMetaDescriptions(rawTitle, processedContent, admin),
  seoImageAltService.generateAltTexts(processedContent, rawTitle, admin),
]);
// Paraphrase phải chạy sau vì cần content đã có alt text
content = await seoContentService.paraphraseForSeo(finalContent, rawTitle, admin);
```

**Ưu tiên:** Đề xuất A (1 call gộp) tốt hơn vì giảm tổng số API calls.

---

#### ISSUE 2: Process Processor download ảnh tuần tự 🟡

**Vấn đề:** Trong `process.processor.ts`, ảnh được download và upload **tuần tự** bằng vòng `for...of`:
```typescript
// HIỆN TẠI (tuần tự)
for (const img of images) {
  const localUrl = await this.downloadAndUploadImage(src, 'blog');
  // ...
}
```

**Đề xuất:**
```typescript
// File: erg-backend/src/modules/crawler/processors/process.processor.ts
// TỐI ƯU: Download/upload song song (tối đa 5 ảnh cùng lúc)
const BATCH_SIZE = 5;
for (let i = 0; i < images.length; i += BATCH_SIZE) {
  const batch = images.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(async img => {
      const src = $img(img).attr('src');
      if (!src || !src.startsWith('http')) return null;
      try {
        const localUrl = await this.downloadAndUploadImage(src, 'blog');
        $img(img).attr('src', localUrl);
        $img(img).removeAttr('srcset');
        return { original: src, uploaded: localUrl, alt: $img(img).attr('alt') || '' };
      } catch (e) {
        this.logger.warn(`Failed to process image ${src}: ${e.message}`);
        return null;
      }
    })
  );
  imagesArray.push(...results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as any).value));
}
```

---

#### ISSUE 3: Duplicate detection gọi DB quá nhiều lần 🟡

**Vấn đề:** Trong `processRssFeed()` và `peekRss()`, mỗi RSS item đều query MongoDB + MySQL tuần tự:
```typescript
for (const item of parsed.items) {
  const history = await this.historyRepository.findOne({ url: item.link }); // Query 1
  const post = await this.postRepository.findOne({ id: history.postId });   // Query 2
}
```
Với 50 items → 100-150 queries.

**Đề xuất:**
```typescript
// File: erg-backend/src/modules/crawler/crawler.service.ts
// TỐI ƯU: Batch query thay vì N+1
async processRssFeed(rssId: string) {
  // ...parse RSS...

  const allLinks = parsed.items.map(item => item.link).filter(Boolean);

  // 1 query thay vì N queries
  const existingHistories = await this.historyRepository.find({
    url: { $in: allLinks }
  });
  const historyMap = new Map(existingHistories.map(h => [h.url, h]));

  // Batch check MySQL
  const postIds = existingHistories
    .map(h => h.postId)
    .filter(Boolean) as string[];
  const existingPosts = postIds.length > 0
    ? await this.postRepository.find({ id: { $in: postIds }, deletedAt: null })
    : [];
  const postIdSet = new Set(existingPosts.map(p => p.id));

  for (const item of parsed.items) {
    if (!item.link) continue;
    const history = historyMap.get(item.link);
    if (history?.postId && postIdSet.has(history.postId)) continue;

    await this.scrapeQueue.add('scrape_url', { /* ... */ });
  }
}
```

---

#### ISSUE 4: AI Gen Post - Image Generation chậm & tốn resource 🟡

**Vấn đề hiện tại trong `ai-generation.processor.ts`:**
- Tạo thumbnail + max 4 ảnh content = tối đa 5 ảnh/bài
- `imageGenService.generateImage()` mỗi call mất 5-15 giây
- Chạy song song 4 ảnh content (tốt) nhưng thumbnail tuần tự trước

**Đề xuất:**
```typescript
// File: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts

// TỐI ƯU: Chạy thumbnail + content images CÙNG LÚC
const allImagePromises: Promise<any>[] = [];

// Thumbnail
if (aiData.thumbnailPrompt) {
  allImagePromises.push(
    this.generateAndUpload(aiData.thumbnailPrompt, postSlug, 'thumbnail')
  );
}

// Content images (max 4)
const matches = [...processedHtml.matchAll(/<image-placeholder prompt=['"](.*?)['"]\s*\/?>/g)];
const imagesToProcess = matches.slice(0, 4);

for (const match of imagesToProcess) {
  allImagePromises.push(
    this.generateAndUpload(match[1], postSlug, 'content')
  );
}

// Tất cả chạy song song
const allResults = await Promise.allSettled(allImagePromises);
```

---

#### ISSUE 5: Không có Dead Letter Queue (DLQ) cho jobs thất bại 🟢

**Vấn đề:** Jobs thất bại sau 3 attempts chỉ nằm trong Redis 24h rồi bị xóa. Không có cơ chế retry thủ công hoặc alert admin.

**Đề xuất:**
```typescript
// File: erg-backend/src/modules/crawler/processors/scrape.processor.ts
// Thêm event listener cho failed jobs

// Hoặc tạo service riêng:
// File: erg-backend/src/modules/crawler/services/dead-letter.service.ts
@Injectable()
export class DeadLetterService {
  @OnQueueFailed('crawl_scrape')
  async handleFailedJob(job: Job, err: Error) {
    if (job.attemptsMade >= job.opts.attempts) {
      // Job đã retry hết → chuyển vào DLQ
      await this.dlqQueue.add('dead_letter', {
        originalQueue: 'crawl_scrape',
        jobData: job.data,
        error: err.message,
        failedAt: new Date(),
      });

      // Notify admin
      await this.notificationsService.create({
        userId: adminId,
        type: NotificationType.SYSTEM_ALERT,
        title: `Crawl job failed permanently`,
        message: `URL: ${job.data.url} - ${err.message}`,
      });
    }
  }
}
```

### 2.3. Hiện trạng AI Gen Post

| Thành phần | Hiện tại | Đánh giá |
|------------|----------|----------|
| Provider fallback | 12 providers, dynamic health-based order | **Tốt** |
| API key rotation | Priority → least used → least recent | **Tốt** |
| Image generation | Thumbnail + max 4 content images | **Trung bình** |
| SEO optimization | Gọi riêng SeoTitle + SeoMeta + AutoLink | **Tốt** |
| Error handling | Retry 3 times, fallback providers | **Tốt** |
| Queue management | BullMQ with concurrency control | **Tốt** |

### 2.4. Checklist triển khai Mục 2

- [ ] Tạo `SeoBatchService` gộp title + meta + keywords vào 1 AI call
- [ ] Hoặc chạy song song title + meta + alt bằng `Promise.all`
- [ ] Tối ưu image processing (batch download song song)
- [ ] Batch query duplicate detection thay vì N+1
- [ ] Chạy thumbnail + content images song song
- [ ] Tạo Dead Letter Queue service
- [ ] Thêm metrics tracking (thời gian xử lý mỗi stage)
- [ ] Cải thiện logging cho pipeline (trace job execution)

---

## 3. DỊCH VỤ CRAWL ẨN (HIDDEN CATEGORY)

### 3.1. Yêu cầu

- Crawl tips, mẹo, kiến thức từ bên ngoài
- Nội dung **KHÔNG** thuộc category công khai
- Chỉ Admin mới xem và quản lý được
- Mục đích: Thu thập tài liệu tham khảo, rewrite/reuse sau

### 3.2. Thiết kế Backend

#### A. Thêm `isHidden` vào PostCategory

```typescript
// File: erg-backend/src/modules/posts/entities/post-category.entity.ts
@Entity({ tableName: 'post_categories' })
export class PostCategory extends BaseEntity {
  @Property({ default: false })
  isHidden: boolean = false;

  @Property({ nullable: true })
  hiddenType?: string; // 'tips', 'reference', 'internal', 'scrape-pool'
}
```

#### B. Seed Hidden Categories

```typescript
// File mới: erg-backend/src/migrations/seed-hidden-categories.ts
const hiddenCategories = [
  { name: 'Kho Tips & Mẹo (Ẩn)', slug: '__hidden_tips', isHidden: true, hiddenType: 'tips' },
  { name: 'Tài liệu tham khảo (Ẩn)', slug: '__hidden_reference', isHidden: true, hiddenType: 'reference' },
  { name: 'Scrape Pool (Ẩn)', slug: '__hidden_scrape_pool', isHidden: true, hiddenType: 'scrape-pool' },
];
```

#### C. Filter Hidden Categories khỏi Public APIs

```typescript
// File: erg-backend/src/modules/posts/posts.service.ts
async findAll(query: FindAllPostsDto) {
  const qb = this.postRepo.createQueryBuilder('p')
    .leftJoinAndSelect('p.category', 'c')
    .where({ status: PostStatus.PUBLISHED, 'c.isHidden': { $ne: true } });
}

async getCategories() {
  return this.categoryRepo.find({ isHidden: { $ne: true } });
}
```

#### D. Thêm `isHiddenCrawl` vào RssFeed Entity

```typescript
// File: erg-backend/src/modules/crawler/entities/rss-feed.entity.ts
@Property({ default: false })
isHiddenCrawl: boolean = false;

@Property({ nullable: true })
hiddenCategorySlug?: string;
```

#### E. Logic tự động gán Hidden Category trong Publish

```typescript
// File: erg-backend/src/modules/crawler/processors/publish.processor.ts
let finalCategoryId = targetCategoryId;
if (isHiddenCrawl || !targetCategoryId) {
  const hiddenCategory = await em.findOne(PostCategory, {
    slug: job.data.hiddenCategorySlug || '__hidden_scrape_pool',
    isHidden: true,
  });
  if (hiddenCategory) finalCategoryId = hiddenCategory.id;
}
```

#### F. Admin API cho Hidden Content

```typescript
// File: erg-backend/src/modules/posts/posts.controller.ts
@Get('hidden')
@Permissions('posts.manage_hidden')
async getHiddenPosts(@Query('hiddenType') hiddenType?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
  return this.postsService.findHiddenPosts(hiddenType, page, limit);
}

@Post(':id/promote')
@Permissions('posts.manage_hidden')
async promoteHiddenPost(@Param('id') id: string, @Body() body: { targetCategoryId: string; rewrite?: boolean }) {
  return this.postsService.promoteToPublic(id, body);
}
```

### 3.3. Flow tổng thể

```
[Admin tạo RSS Feed]                    [Scheduler tự động]
  isHiddenCrawl: true          ──────►    triggerRssCrawl()
  hiddenCategorySlug: '__hidden_tips'          │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Pipeline 5 stages   │
                                    └──────────┬───────────┘
                                               ▼
                                    Post(category='__hidden_tips')
                                    status=DRAFT
                                               │
                               ┌───────────────┼───────────────┐
                               ▼               ▼               ▼
                         [Admin Review]  [Tự động tag]   [Archive]
```

### 3.4. Bảo mật

1. Route `/admin/hidden-content` chỉ hiển thị khi có permission `posts.manage_hidden`
2. Tất cả endpoints yêu cầu `@Permissions('posts.manage_hidden')`
3. Sitemap service loại bỏ hidden categories
4. Hidden crawl chạy ít hơn (1-2 lần/ngày)

### 3.5. Checklist triển khai Mục 3

- [ ] Thêm `isHidden`, `hiddenType` vào `PostCategory` entity + migration
- [ ] Tạo seed data cho 3 hidden categories
- [ ] Sửa public API endpoints loại bỏ hidden categories
- [ ] Thêm `isHiddenCrawl`, `hiddenCategorySlug` vào `RssFeed` entity
- [ ] Sửa `publish.processor.ts` để tự động gán hidden category
- [ ] Tạo Admin API: `GET /posts/hidden`, `POST /posts/:id/promote`
- [ ] Thêm permission `posts.manage_hidden` vào RBAC
- [ ] Sửa sitemap service loại bỏ hidden categories

---

## 4. AI TẠO POST CHUYÊN NGHIỆP

### 4.1. Hiện trạng

```
┌──────────────────────────────────────────────────────────────────┐
│                      AI Content Module                           │
├──────────────────┬───────────────────┬───────────────────────────┤
│  AiContentService│   ApiKeyService   │  ProviderHealthService    │
├──────────────────┴───────────────────┴───────────────────────────┤
│                    AIProviderFactory (12 providers)               │
├──────────────────────────────────────────────────────────────────┤
│  ImageGenService: Cloudflare AI (flux-1-schnell, free tier)      │
└──────────────────────────────────────────────────────────────────┘
```

| Thành phần | Đánh giá |
|------------|----------|
| API Key encryption (AES-256-CBC) | **Tốt** |
| Key rotation (Priority → least usage) | **Tốt** |
| Provider fallback (12 providers, dynamic health) | **Tốt** |
| Image generation (Cloudflare free, 1 model) | 🔴 **Cần cải thiện** |
| Prompt engineering (hardcoded) | 🟡 **Cần tách ra** |
| Error classification | 🟡 **Cần chi tiết hơn** |
| Key validation khi thêm mới | 🔴 **Thiếu** |

### 4.2. Đề xuất cải thiện

#### FIX 1: Validate API Key khi thêm mới (Ưu tiên 🔴)

```typescript
// File: erg-backend/src/modules/ai-content/services/api-key.service.ts
async upsertKey(user: User, keyData: { key: string; provider: AIProviderType }) {
  const isValid = await this.validateApiKey(keyData.key, keyData.provider);
  if (!isValid.success) throw new BadRequestException(`API Key không hợp lệ: ${isValid.error}`);
  // ... existing logic ...
}

private async validateApiKey(key: string, provider: AIProviderType) {
  try {
    const client = this.providerFactory.createClient(provider, key);
    await client.generateText('Say "OK"', { maxTokens: 5 });
    return { success: true };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Invalid')) {
      return { success: false, error: 'API Key không hợp lệ hoặc đã bị revoke' };
    }
    return { success: true }; // Network/rate limit → key vẫn có thể hợp lệ
  }
}
```

#### FIX 2: Tách Prompt Templates (Ưu tiên 🟡)

```typescript
// File mới: erg-backend/src/modules/ai-content/templates/post-generation.template.ts
export const POST_TEMPLATES = {
  informative: {
    name: 'Bài viết thông tin',
    systemPrompt: `Bạn là Senior Content Writer tại ERG...`,
    userPromptBuilder: (topic: string, category: string) => `Viết bài blog chuyên sâu về: "${topic}"...`,
    imageStyle: 'photorealistic, cinematic lighting, 8k',
    maxImages: 4,
    wordCount: { min: 800, max: 1200 },
  },
  howto: { name: 'Hướng dẫn thực hành', /* ... */ },
  listicle: { name: 'Danh sách Top N', /* ... */ },
  news: { name: 'Tin tức / Sự kiện', /* ... */ },
};
```

#### FIX 3: Nâng cấp Image Generation (Ưu tiên 🔴)

Xem chi tiết tại **Mục 7** - Multi-provider image generation.

#### FIX 4: Provider-specific Model Configuration (Ưu tiên 🟢)

```typescript
// File: erg-backend/src/modules/ai-content/entities/api-key.entity.ts
@Property({ nullable: true })
model?: string; // Override default model

@Property({ nullable: true })
customEndpoint?: string;

@Property({ default: 8192 })
maxTokensPerRequest: number = 8192;

// File: erg-backend/src/modules/ai-content/providers/ai-provider.factory.ts
createClient(provider: AIProviderType, apiKey: string, config?: { model?: string }) {
  switch (provider) {
    case AIProviderType.GEMINI:
      return new GeminiClient(apiKey, config?.model || 'gemini-2.0-flash');
    // ...
  }
}
```

### 4.3. Checklist triển khai Mục 4

- [ ] Thêm key validation khi thêm API key mới
- [ ] Tạo file `post-generation.template.ts` tách prompt templates
- [ ] Nâng cấp `ImageGenService` với multi-provider fallback (Mục 7)
- [ ] Thêm `model`, `customEndpoint`, `maxTokensPerRequest` vào `ApiKey` entity
- [ ] Sửa `AIProviderFactory` nhận dynamic model config

---

## 5. SEO TỰ ĐỘNG KHÔNG BỊ RATE LIMIT

### 5.1. Vấn đề hiện tại

```
T0:    AI Generate Post    → Provider X (RPM: 28/30)
T0+2s: AI Generate SEO     → Provider X (RPM: 29/30)
T0+5s: AI Generate Post 2  → Provider X → 429 RATE LIMITED!
```

**Nguyên nhân:** Cả AI tạo post + AI tạo SEO đều gọi chung `generateWithFallback()` → cùng pool API keys.

### 5.2. Giải pháp

#### Chiến lược A: Dedicated SEO Queue (Khuyến nghị)

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   AI Content Queue       │     │   SEO AI Queue (MỚI)    │
│   Rate: 3 jobs/min       │     │   Rate: 2 jobs/min      │
│   Priority: HIGH         │     │   Priority: LOW          │
│   Keys: ALL providers    │     │   Keys: Free providers   │
└─────────────────────────┘     └─────────────────────────┘
```

```typescript
// File mới: erg-backend/src/modules/seo/processors/seo-ai.processor.ts
@Processor('seo-ai-queue', {
  concurrency: 1,
  limiter: { max: 2, duration: 60000 },
})
export class SeoAiProcessor extends WorkerHost {
  private async generateSeoMetadata(job: Job) {
    const seoProviders = [AIProviderType.GROQ, AIProviderType.CEREBRAS, AIProviderType.SAMBANOVA];
    return this.aiContentService.generateWithFallback(prompt, adminUser, {
      preferredProviders: seoProviders,
    });
  }
}
```

#### Chiến lược B: Token Bucket chung

```typescript
// File mới: erg-backend/src/modules/ai-content/services/ai-rate-limiter.service.ts
@Injectable()
export class AiRateLimiterService {
  async acquireToken(purpose: string, provider: AIProviderType): Promise<boolean> {
    const priorityCost = { content: 1, refine: 1, seo: 2 };
    // Token bucket implementation with Redis...
  }

  async waitForToken(purpose: string, provider: AIProviderType, timeoutMs = 30000): Promise<void> {
    while (Date.now() - startTime < timeoutMs) {
      if (await this.acquireToken(purpose, provider)) return;
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`AI rate limit timeout for ${purpose}`);
  }
}
```

### 5.3. Tích hợp vào AiContentService

```typescript
// File: erg-backend/src/modules/ai-content/services/ai-content.service.ts
async generateWithFallback(prompt: string, user: User, options?: {
  purpose?: 'content' | 'seo' | 'refine';
  preferredProviders?: AIProviderType[];
}) {
  for (const provider of fallbackOrder) {
    await this.aiRateLimiter.waitForToken(purpose, provider, 15000);
    // ... existing logic ...
  }
}
```

### 5.4. Checklist triển khai Mục 5

- [ ] Tạo `seo-ai-queue` BullMQ queue với rate limiter riêng
- [ ] Tạo `SeoAiProcessor` gộp SEO AI calls vào 1 call
- [ ] Tạo `AiRateLimiterService` (Token Bucket)
- [ ] Sửa `AiContentService.generateWithFallback()` thêm `purpose`
- [ ] Thêm `preferredProviders` để SEO ưu tiên free providers
- [ ] Sửa `crawl_seo` processor đẩy job vào `seo-ai-queue`
- [ ] Thêm `CrawlStatus.SEO_PENDING` vào enum

---

## 6. QUẢN LÝ API KEY THÔNG MINH

### 6.1. Vấn đề phát hiện

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Key bị `ERROR` vĩnh viễn không dùng lại — không auto-recover | 🔴 |
| 2 | Không notification khi key bị ban/hết quota | 🔴 |
| 3 | Không validate key khi thêm mới | 🔴 |
| 4 | Không dashboard tổng quan sức khỏe keys | 🟡 |
| 5 | `checkAndResetDailyUsage()` gọi `persistAndFlush()` quá nhiều | 🟡 |
| 6 | Không track cost estimation | 🟢 |

### 6.2. Đề xuất

#### FIX 1: Auto-Recover cho Key bị ERROR (Ưu tiên 🔴)

```typescript
// File: erg-backend/src/modules/ai-content/services/api-key.service.ts

enum ApiKeyErrorType {
  INVALID_KEY = 'invalid_key',      // 401 → KHÔNG recover
  FORBIDDEN = 'forbidden',          // 403 → KHÔNG recover
  RATE_LIMITED = 'rate_limited',     // 429 → Auto recover sau cooldown
  QUOTA_EXCEEDED = 'quota_exceeded', // Hết quota → recover ngày mới
  SERVER_ERROR = 'server_error',     // 5xx → recover sau 5 phút
  NETWORK_ERROR = 'network_error',   // timeout → recover sau 2 phút
  UNKNOWN = 'unknown',              // Khác → recover sau 10 phút
}

async reportError(keyId: string, error: any) {
  // Phân loại chi tiết dựa trên error message
  if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
    key.status = ApiKeyStatus.ERROR;
    key.errorType = ApiKeyErrorType.INVALID_KEY;
    await this.notifyKeyDead(key); // ← Thông báo admin
  } else if (errorMsg.includes('500') || errorMsg.includes('502')) {
    key.status = ApiKeyStatus.RATE_LIMITED;
    key.cooldownUntil = new Date(Date.now() + 5 * 60 * 1000);
    key.errorType = ApiKeyErrorType.SERVER_ERROR;
  }
  // ... phân loại khác ...
}

async logUsage(keyId: string) {
  key.consecutiveErrors = 0; // Reset khi thành công
}
```

#### FIX 2: Notification khi Key bị ban (Ưu tiên 🔴)

```typescript
private async notifyKeyDead(key: ApiKey) {
  if (key.owner) {
    await this.notificationsService.create({
      userId: key.owner.id,
      type: NotificationType.KEY_EXPIRED,
      title: `API Key "${key.label}" không còn hoạt động`,
      message: `Key ${key.provider.toUpperCase()} bị ${key.errorType}. Vui lòng kiểm tra.`,
    });
  }
  const remainingKeys = await this.em.count(ApiKey, { provider: key.provider, status: ApiKeyStatus.ACTIVE });
  if (remainingKeys === 0) {
    await this.notificationsService.createForAdmins({
      type: NotificationType.SYSTEM_CRITICAL,
      title: `CẢNH BÁO: Provider ${key.provider.toUpperCase()} không còn API key!`,
    });
  }
}
```

#### FIX 3: Scheduled Health Check (Ưu tiên 🟡)

```typescript
// File mới: erg-backend/src/modules/ai-content/services/api-key-health.service.ts

@Cron('0 */6 * * *') // Mỗi 6 giờ
async healthCheckAllKeys() {
  const allKeys = await this.em.find(ApiKey, {});
  for (const key of allKeys) {
    if (key.errorType === 'invalid_key') continue; // Skip permanently dead
    // Test key → nếu OK thì PHỤC HỒI
    try {
      await client.generateText('Say OK', { maxTokens: 5 });
      key.status = ApiKeyStatus.ACTIVE;
      key.consecutiveErrors = 0;
    } catch { /* still down */ }
  }
}

@Cron('1 0 * * *') // Mỗi ngày lúc 00:01
async dailyReset() {
  await this.em.nativeUpdate(ApiKey, {}, { todayUsage: 0, todayRpmUsage: 0 });
  await this.em.nativeUpdate(ApiKey, { status: ApiKeyStatus.QUOTA_EXCEEDED }, { status: ApiKeyStatus.ACTIVE });
}
```

#### FIX 4: API Key Dashboard (Ưu tiên 🟡)

```typescript
// Endpoints mới:
GET  /api/ai-content/keys/dashboard     → Tổng quan sức khỏe keys
POST /api/ai-content/keys/:id/test      → Test key hoạt động
POST /api/ai-content/keys/:id/reactivate → Kích hoạt lại key
```

#### FIX 5: Thêm fields vào ApiKey Entity (Ưu tiên 🟡)

```typescript
// File: erg-backend/src/modules/ai-content/entities/api-key.entity.ts
@Property({ nullable: true })
errorType?: string;

@Property({ default: 0 })
consecutiveErrors: number = 0;

@Property({ nullable: true })
model?: string;

@Property({ nullable: true })
expiresAt?: Date;

@Property({ type: 'float', default: 0 })
estimatedCostUsd: number = 0;
```

#### FIX 6: Tối ưu `checkAndResetDailyUsage()` (Ưu tiên 🟡)

Batch flush thay vì individual writes cho mỗi key.

### 6.3. Checklist triển khai Mục 6

- [ ] Thêm `errorType`, `consecutiveErrors`, `model`, `expiresAt` vào ApiKey + migration
- [ ] Cải thiện `reportError()` phân loại lỗi chi tiết (6 loại)
- [ ] Tạo `notifyKeyDead()` gửi notification khi key bị ban
- [ ] Cảnh báo khi provider hết key (notify tất cả admin)
- [ ] Tạo `ApiKeyHealthService` health check mỗi 6h
- [ ] Tạo `dailyReset()` cron job lúc 00:01
- [ ] Tạo API endpoints dashboard/test/reactivate
- [ ] Tối ưu batch flush trong `getAvailableKey()`
- [ ] Thêm validate API key khi thêm mới

---

## 7. AI IMAGE GENERATION TỪ API KEY HIỆN CÓ

### 7.1. Ý tưởng

| Provider | Image API | Cùng API Key? | Chất lượng |
|----------|-----------|---------------|------------|
| **Gemini** | Imagen 3 | **Có** ✅ | Cao |
| **OpenAI** | DALL-E 3 | **Có** ✅ | Rất cao |
| **Together** | FLUX.1 | **Có** ✅ | Cao |
| **Cloudflare** | flux-1-schnell | Key riêng | Trung bình |
| **Pollinations** | Free HTTP | Không cần key | Trung bình |

### 7.2. Thiết kế

#### A. Mở rộng IAIClient interface

```typescript
// File: erg-backend/src/modules/ai-content/providers/ai-provider.interface.ts
export interface IAIClient {
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateImage?(prompt: string, options?: AIImageOptions): Promise<Buffer>;
  supportsImageGeneration?(): boolean;
}

export interface AIImageOptions {
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  model?: string;
}
```

#### B. GeminiClient - Imagen 3

```typescript
// File: erg-backend/src/modules/ai-content/providers/gemini.client.ts
async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
  const model = options?.model || 'imagen-3.0-generate-002';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'DONT_ALLOW' },
    }),
  });
  const result = await response.json();
  return Buffer.from(result.predictions?.[0]?.bytesBase64Encoded, 'base64');
}
```

#### C. OpenAIClient - DALL-E 3

```typescript
// File: erg-backend/src/modules/ai-content/providers/openai.client.ts
async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3', prompt, n: 1,
      size: `${options?.width || 1792}x${options?.height || 1024}`,
      response_format: 'b64_json',
    }),
  });
  const data = await response.json();
  return Buffer.from(data.data?.[0]?.b64_json, 'base64');
}
```

#### D. ImageGenService - Multi-Provider Chain

```typescript
// File: erg-backend/src/modules/ai-content/services/image-gen.service.ts
async generateImage(prompt: string, user: User, options?: AIImageOptions): Promise<Buffer> {
  // PHASE 1: AI providers có sẵn key (Gemini → OpenAI → Together)
  for (const provider of [AIProviderType.GEMINI, AIProviderType.OPENAI, AIProviderType.TOGETHER]) {
    try {
      const keyEntity = await this.apiKeyService.getAvailableKey(user, provider);
      const client = this.providerFactory.createClient(provider, keyEntity.key);
      if (!client.supportsImageGeneration?.()) continue;
      const buffer = await client.generateImage!(prompt, options);
      await this.apiKeyService.logUsage(keyEntity.id);
      return buffer;
    } catch (error) {
      this.logger.warn(`Image gen with ${provider} failed: ${error.message}`);
    }
  }
  // PHASE 2: Cloudflare AI (fallback)
  try { return await this.generateCloudflare(prompt); } catch {}
  // PHASE 3: Pollinations (miễn phí)
  return await this.generatePollinations(prompt);
}
```

### 7.3. Checklist triển khai Mục 7

- [ ] Mở rộng `IAIClient` thêm `generateImage()` + `supportsImageGeneration()`
- [ ] Implement `generateImage()` trong GeminiClient (Imagen 3)
- [ ] Implement `generateImage()` trong OpenAIClient (DALL-E 3)
- [ ] Tạo Together image gen support
- [ ] Nâng cấp `ImageGenService` với 5-level fallback
- [ ] Truyền `user` vào `ImageGenService.generateImage()`
- [ ] Cập nhật `ai-generation.processor.ts`

---

## 8. CẢI THIỆN HỆ THỐNG NOTIFICATION CHO JOBS

### 8.1. Vấn đề

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Không gửi noti khi thành công | 🔴 |
| 2 | Không có batch summary | 🔴 |
| 3 | Không có system-level alerts | 🟡 |
| 4 | Không có `createForAdmins()` | 🟡 |
| 5 | Thiếu notification types | 🟡 |
| 6 | Không có auto-cleanup | 🟢 |

### 8.2. Đề xuất Backend

#### FIX 1: Bổ sung Notification Types + Priority

```typescript
// File: erg-backend/src/modules/notifications/entities/notification.entity.ts

export enum NotificationType {
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',       // MỚI
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
    SYSTEM_ALERT = 'SYSTEM_ALERT',                   // MỚI
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',              // MỚI
    KEY_EXPIRED = 'KEY_EXPIRED',                      // MỚI
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',           // MỚI
    SEO_COMPLETED = 'SEO_COMPLETED',                  // MỚI
    SEO_FAILED = 'SEO_FAILED',                        // MỚI
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

// Thêm fields vào entity:
@Property({ default: 'LOW' })
priority: NotificationPriority = NotificationPriority.LOW;

@Property({ nullable: true })
actionUrl?: string;

@Property({ type: 'json', nullable: true })
actions?: { label: string; url: string; type: 'link' | 'api' }[];
```

#### FIX 2: Gửi Notification khi thành công

```typescript
// File: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts
// Thêm sau khi tạo post thành công:
await this.notificationsService.create({
  userId, type: NotificationType.AI_POST_COMPLETED,
  priority: NotificationPriority.LOW,
  title: 'Bài viết AI đã tạo thành công',
  message: `Bài "${aiData.title}" → ${autoPublish ? 'Published' : 'Draft'}`,
  actionUrl: `/admin/posts/${newPost.id}`,
  actions: [
    { label: 'Xem bài viết', url: `/admin/posts/${newPost.id}`, type: 'link' },
    { label: 'Chỉnh sửa', url: `/admin/posts/${newPost.id}/edit`, type: 'link' },
  ],
});

// File: erg-backend/src/modules/crawler/processors/publish.processor.ts
// Thêm sau khi publish thành công:
await this.notificationsService.create({
  userId: admin.id, type: NotificationType.CRAWL_COMPLETED,
  title: 'Cào bài viết thành công',
  message: `"${title}" từ ${new URL(url).hostname}`,
  actionUrl: `/admin/posts/${post.id}`,
});
```

#### FIX 3: Batch Summary với CrawlBatchTrackerService

```typescript
// File mới: erg-backend/src/modules/crawler/services/crawl-batch-tracker.service.ts
@Injectable()
export class CrawlBatchTrackerService {
  async registerBatch(rssId: string, totalJobs: number) { /* Redis tracking */ }
  async trackJobCompletion(rssId: string, result: { url, success, postId?, error? }) {
    // Khi tất cả jobs xong → gửi summary notification
    if (batch.completedJobs >= batch.totalJobs) {
      await this.sendBatchSummary(batch);
    }
  }
  private async sendBatchSummary(batch) {
    await this.notificationsService.create({
      type: NotificationType.CRAWL_BATCH_COMPLETED,
      title: `RSS Crawl hoàn tất: ${batch.successCount}/${batch.totalJobs} thành công`,
    });
  }
}
```

#### FIX 4: `createForAdmins()` + Auto-cleanup

```typescript
// File: erg-backend/src/modules/notifications/notifications.service.ts
async createForAdmins(data: { type, title, message, priority?, metadata? }) {
  const adminUsers = await em.find(User, { roles: { name: { $in: ['Admin', 'Super Admin'] } } });
  for (const admin of adminUsers) {
    await this.create({ userId: admin.id, ...data });
  }
}

@Cron('0 3 * * *') // 3h sáng mỗi ngày
async cleanupOldNotifications() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  // Xóa notifications đã đọc > 30 ngày
}
```

### 8.3. Notification Flow

```
┌──────────────┬──────────────┬──────────────┬────────────────────┐
│ AI Gen Post  │  Crawl       │  API Key     │  SEO Pipeline      │
│ ✅ Success   │  Pipeline    │  Manager     │                    │
│ ❌ Fail      │  ✅ per-URL  │  🔑 Expired  │  ✅ Optimized      │
│ 📊 Batch     │  ❌ per-URL  │  ⚠️ >80%     │  ❌ AI Failed      │
│              │  📊 Batch    │  🚨 No keys  │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬────────────┘
       ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                NotificationsService                              │
│  create()           → 1 user     │  Priority: LOW→CRITICAL      │
│  createForAdmins()  → all admins │  Actions: [{ label, url }]   │
│  cleanupOld()       → cron 3h    │  ActionUrl: navigate on click│
└─────────────────────────────────────────────────────────────────┘
```

### 8.4. Checklist triển khai Mục 8

- [ ] Thêm notification types mới (7 types)
- [ ] Thêm `NotificationPriority` enum
- [ ] Thêm `priority`, `actionUrl`, `actions` fields vào entity
- [ ] Gửi notification khi AI post + crawl **thành công**
- [ ] Tạo `CrawlBatchTrackerService` + batch summary
- [ ] Tạo `createForAdmins()` method
- [ ] Tạo `cleanupOldNotifications()` cron job
- [ ] Tích hợp notification vào `ApiKeyService.notifyKeyDead()`

---

## TỔNG KẾT ƯU TIÊN

### Ưu tiên CAO 🔴

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 1 | Chuyển Throttler sang Redis Storage | 1 | 1h |
| 2 | Thêm body size limit + request timeout | 1 | 30m |
| 3 | Validate API key khi thêm mới | 4 | 2h |
| 4 | Notification khi key bị ban/hết quota | 6 | 2h |
| 5 | Phân loại lỗi chi tiết + auto-recover | 6 | 3h |
| 6 | Tạo SEO AI queue riêng biệt | 5 | 4h |

### Ưu tiên TRUNG BÌNH 🟡

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 7 | IP Blocking Middleware | 1 | 3h |
| 8 | Gộp SEO AI calls thành 1 call | 2 | 2h |
| 9 | Batch query duplicate detection | 2 | 2h |
| 10 | Tách prompt templates | 4 | 3h |
| 11 | API Key Dashboard + Health Check | 6 | 4h |
| 12 | Token Bucket rate limiter | 5 | 3h |

### Ưu tiên THẤP 🟢

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 13 | Hidden Category system | 3 | 6h |
| 14 | Nâng cấp ImageGenService multi-provider | 7 | 6h |
| 15 | Abuse Detection Service | 1 | 4h |
| 16 | Dead Letter Queue | 2 | 2h |
| 17 | Notification improvements | 8 | 10h |

**Tổng estimated effort Backend: ~52 giờ**

### 2.2. Vấn đề & Đề xuất

#### ISSUE 1: SEO Processor là bottleneck nghiêm trọng 🔴

Mỗi job gọi **4 lần AI liên tiếp** (title → meta → alt → paraphrase).

```typescript
// ĐỀ XUẤT A: Gộp prompt SEO thành 1 AI call duy nhất
// File: erg-backend/src/modules/seo/services/seo-batch.service.ts (MỚI)
async generateAllSeoData(title: string, content: string, user: User) {
  const prompt = `
    Bạn là chuyên gia SEO. Tối ưu bài viết sau:
    TIÊU ĐỀ: ${title}
    NỘI DUNG (500 ký tự đầu): ${content.substring(0, 500)}
    Trả về JSON:
    {
      "seoTitle": "Tiêu đề SEO tối ưu (50-60 ký tự)",
      "metaDescription": "Meta description (150-160 ký tự, có CTA)",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  `;
  return JSON.parse(await this.aiContentService.generateWithFallback(prompt, user));
}

// ĐỀ XUẤT B: Chạy song song thay vì tuần tự
const [titles, metas, alts] = await Promise.all([
  seoTitleService.generateTitles(rawTitle, processedContent, admin),
  seoMetaService.generateMetaDescriptions(rawTitle, processedContent, admin),
  seoImageAltService.generateAltTexts(processedContent, rawTitle, admin),
]);
content = await seoContentService.paraphraseForSeo(finalContent, rawTitle, admin);
```

#### ISSUE 2: Process Processor download ảnh tuần tự 🟡

```typescript
// File: erg-backend/src/modules/crawler/processors/process.processor.ts
// TỐI ƯU: Download/upload song song (tối đa 5 ảnh cùng lúc)
const BATCH_SIZE = 5;
for (let i = 0; i < images.length; i += BATCH_SIZE) {
  const batch = images.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(async img => {
      const src = $img(img).attr('src');
      if (!src || !src.startsWith('http')) return null;
      try {
        const localUrl = await this.downloadAndUploadImage(src, 'blog');
        $img(img).attr('src', localUrl);
        $img(img).removeAttr('srcset');
        return { original: src, uploaded: localUrl, alt: $img(img).attr('alt') || '' };
      } catch (e) {
        this.logger.warn(`Failed to process image ${src}: ${e.message}`);
        return null;
      }
    })
  );
}
```

#### ISSUE 3: Duplicate detection gọi DB quá nhiều lần 🟡

```typescript
// File: erg-backend/src/modules/crawler/crawler.service.ts
// TỐI ƯU: Batch query thay vì N+1
const allLinks = parsed.items.map(item => item.link).filter(Boolean);
const existingHistories = await this.historyRepository.find({ url: { $in: allLinks } });
const historyMap = new Map(existingHistories.map(h => [h.url, h]));

const postIds = existingHistories.map(h => h.postId).filter(Boolean) as string[];
const existingPosts = postIds.length > 0
  ? await this.postRepository.find({ id: { $in: postIds }, deletedAt: null })
  : [];
const postIdSet = new Set(existingPosts.map(p => p.id));
```

#### ISSUE 4: AI Gen Post - Image Generation chậm 🟡

```typescript
// File: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts
// TỐI ƯU: Chạy thumbnail + content images CÙNG LÚC
const allImagePromises: Promise<any>[] = [];
if (aiData.thumbnailPrompt) {
  allImagePromises.push(this.generateAndUpload(aiData.thumbnailPrompt, postSlug, 'thumbnail'));
}
const matches = [...processedHtml.matchAll(/<image-placeholder prompt=['"](.*?)['"]\s*\/?>/g)];
for (const match of matches.slice(0, 4)) {
  allImagePromises.push(this.generateAndUpload(match[1], postSlug, 'content'));
}
const allResults = await Promise.allSettled(allImagePromises);
```

#### ISSUE 5: Không có Dead Letter Queue (DLQ) 🟢

```typescript
// File mới: erg-backend/src/modules/crawler/services/dead-letter.service.ts
@Injectable()
export class DeadLetterService {
  @OnQueueFailed('crawl_scrape')
  async handleFailedJob(job: Job, err: Error) {
    if (job.attemptsMade >= job.opts.attempts) {
      await this.dlqQueue.add('dead_letter', {
        originalQueue: 'crawl_scrape',
        jobData: job.data,
        error: err.message,
        failedAt: new Date(),
      });
      await this.notificationsService.create({ /* ... */ });
    }
  }
}
```

### 2.3. Checklist triển khai Mục 2

- [ ] Tạo `SeoBatchService` gộp title + meta + keywords vào 1 AI call
- [ ] Hoặc chạy song song title + meta + alt bằng `Promise.all`
- [ ] Tối ưu image processing (batch download song song)
- [ ] Batch query duplicate detection thay vì N+1
- [ ] Chạy thumbnail + content images song song
- [ ] Tạo Dead Letter Queue service
- [ ] Thêm metrics tracking (thời gian xử lý mỗi stage)

---

## 3. DỊCH VỤ CRAWL ẨN (HIDDEN CATEGORY)

### 3.1. Yêu cầu

- Crawl tips, mẹo, kiến thức từ bên ngoài
- Nội dung **KHÔNG** thuộc category công khai
- Chỉ Admin mới xem và quản lý được
- Mục đích: Thu thập tài liệu tham khảo, rewrite/reuse sau

### 3.2. Thiết kế Backend

#### A. Thêm `isHidden` vào PostCategory

```typescript
// File: erg-backend/src/modules/posts/entities/post-category.entity.ts
@Entity({ tableName: 'post_categories' })
export class PostCategory extends BaseEntity {
  @Property({ default: false })
  isHidden: boolean = false;

  @Property({ nullable: true })
  hiddenType?: string; // 'tips', 'reference', 'internal', 'scrape-pool'
}
```

#### B. Seed Hidden Categories

```typescript
// File mới: erg-backend/src/migrations/seed-hidden-categories.ts
const hiddenCategories = [
  { name: 'Kho Tips & Mẹo (Ẩn)', slug: '__hidden_tips', isHidden: true, hiddenType: 'tips' },
  { name: 'Tài liệu tham khảo (Ẩn)', slug: '__hidden_reference', isHidden: true, hiddenType: 'reference' },
  { name: 'Scrape Pool (Ẩn)', slug: '__hidden_scrape_pool', isHidden: true, hiddenType: 'scrape-pool' },
];
```

#### C. Filter Hidden Categories khỏi Public APIs

```typescript
// File: erg-backend/src/modules/posts/posts.service.ts
async findAll(query: FindAllPostsDto) {
  const qb = this.postRepo.createQueryBuilder('p')
    .leftJoinAndSelect('p.category', 'c')
    .where({ status: PostStatus.PUBLISHED, 'c.isHidden': { $ne: true } });
}

async getCategories() {
  return this.categoryRepo.find({ isHidden: { $ne: true } });
}
```

#### D. Thêm `isHiddenCrawl` vào RssFeed Entity

```typescript
// File: erg-backend/src/modules/crawler/entities/rss-feed.entity.ts
@Property({ default: false })
isHiddenCrawl: boolean = false;

@Property({ nullable: true })
hiddenCategorySlug?: string;
```

#### E. Logic tự động gán Hidden Category trong Publish

```typescript
// File: erg-backend/src/modules/crawler/processors/publish.processor.ts
let finalCategoryId = targetCategoryId;
if (isHiddenCrawl || !targetCategoryId) {
  const hiddenCategory = await em.findOne(PostCategory, {
    slug: job.data.hiddenCategorySlug || '__hidden_scrape_pool',
    isHidden: true,
  });
  if (hiddenCategory) finalCategoryId = hiddenCategory.id;
}
```

#### F. Admin API cho Hidden Content

```typescript
// File: erg-backend/src/modules/posts/posts.controller.ts
@Get('hidden')
@Permissions('posts.manage_hidden')
async getHiddenPosts(@Query('hiddenType') hiddenType?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
  return this.postsService.findHiddenPosts(hiddenType, page, limit);
}

@Post(':id/promote')
@Permissions('posts.manage_hidden')
async promoteHiddenPost(@Param('id') id: string, @Body() body: { targetCategoryId: string; rewrite?: boolean }) {
  return this.postsService.promoteToPublic(id, body);
}
```

### 3.3. Flow tổng thể

```
[Admin tạo RSS Feed]                    [Scheduler tự động]
  isHiddenCrawl: true          ──────►    triggerRssCrawl()
  hiddenCategorySlug: '__hidden_tips'          │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Pipeline 5 stages   │
                                    └──────────┬───────────┘
                                               ▼
                                    Post(category='__hidden_tips')
                                    status=DRAFT
                                               │
                               ┌───────────────┼───────────────┐
                               ▼               ▼               ▼
                         [Admin Review]  [Tự động tag]   [Archive]
```

### 3.4. Bảo mật

1. Route `/admin/hidden-content` chỉ hiển thị khi có permission `posts.manage_hidden`
2. Tất cả endpoints yêu cầu `@Permissions('posts.manage_hidden')`
3. Sitemap service loại bỏ hidden categories
4. Hidden crawl chạy ít hơn (1-2 lần/ngày)

### 3.5. Checklist triển khai Mục 3

- [ ] Thêm `isHidden`, `hiddenType` vào `PostCategory` entity + migration
- [ ] Tạo seed data cho 3 hidden categories
- [ ] Sửa public API endpoints loại bỏ hidden categories
- [ ] Thêm `isHiddenCrawl`, `hiddenCategorySlug` vào `RssFeed` entity
- [ ] Sửa `publish.processor.ts` để tự động gán hidden category
- [ ] Tạo Admin API: `GET /posts/hidden`, `POST /posts/:id/promote`
- [ ] Thêm permission `posts.manage_hidden` vào RBAC
- [ ] Sửa sitemap service loại bỏ hidden categories

---

## 4. AI TẠO POST CHUYÊN NGHIỆP

### 4.1. Hiện trạng

```
┌──────────────────────────────────────────────────────────────────┐
│                      AI Content Module                           │
├──────────────────┬───────────────────┬───────────────────────────┤
│  AiContentService│   ApiKeyService   │  ProviderHealthService    │
├──────────────────┴───────────────────┴───────────────────────────┤
│                    AIProviderFactory (12 providers)               │
├──────────────────────────────────────────────────────────────────┤
│  ImageGenService: Cloudflare AI (flux-1-schnell, free tier)      │
└──────────────────────────────────────────────────────────────────┘
```

| Thành phần | Đánh giá |
|------------|----------|
| API Key encryption (AES-256-CBC) | **Tốt** |
| Key rotation (Priority → least usage) | **Tốt** |
| Provider fallback (12 providers, dynamic health) | **Tốt** |
| Image generation (Cloudflare free, 1 model) | 🔴 **Cần cải thiện** |
| Prompt engineering (hardcoded) | 🟡 **Cần tách ra** |
| Error classification | 🟡 **Cần chi tiết hơn** |
| Key validation khi thêm mới | 🔴 **Thiếu** |

### 4.2. Đề xuất cải thiện

#### FIX 1: Validate API Key khi thêm mới (Ưu tiên 🔴)

```typescript
// File: erg-backend/src/modules/ai-content/services/api-key.service.ts
async upsertKey(user: User, keyData: { key: string; provider: AIProviderType }) {
  const isValid = await this.validateApiKey(keyData.key, keyData.provider);
  if (!isValid.success) throw new BadRequestException(`API Key không hợp lệ: ${isValid.error}`);
  // ... existing logic ...
}

private async validateApiKey(key: string, provider: AIProviderType) {
  try {
    const client = this.providerFactory.createClient(provider, key);
    await client.generateText('Say "OK"', { maxTokens: 5 });
    return { success: true };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Invalid')) {
      return { success: false, error: 'API Key không hợp lệ hoặc đã bị revoke' };
    }
    return { success: true }; // Network/rate limit → key vẫn có thể hợp lệ
  }
}
```

#### FIX 2: Tách Prompt Templates (Ưu tiên 🟡)

```typescript
// File mới: erg-backend/src/modules/ai-content/templates/post-generation.template.ts
export const POST_TEMPLATES = {
  informative: {
    name: 'Bài viết thông tin',
    systemPrompt: `Bạn là Senior Content Writer tại ERG...`,
    userPromptBuilder: (topic: string, category: string) => `Viết bài blog chuyên sâu về: "${topic}"...`,
    imageStyle: 'photorealistic, cinematic lighting, 8k',
    maxImages: 4,
    wordCount: { min: 800, max: 1200 },
  },
  howto: { name: 'Hướng dẫn thực hành', /* ... */ },
  listicle: { name: 'Danh sách Top N', /* ... */ },
  news: { name: 'Tin tức / Sự kiện', /* ... */ },
};
```

#### FIX 3: Nâng cấp Image Generation (Ưu tiên 🔴)

Xem chi tiết tại **Mục 7** - Multi-provider image generation.

#### FIX 4: Provider-specific Model Configuration (Ưu tiên 🟢)

```typescript
// File: erg-backend/src/modules/ai-content/entities/api-key.entity.ts
@Property({ nullable: true })
model?: string; // Override default model

@Property({ nullable: true })
customEndpoint?: string;

@Property({ default: 8192 })
maxTokensPerRequest: number = 8192;

// File: erg-backend/src/modules/ai-content/providers/ai-provider.factory.ts
createClient(provider: AIProviderType, apiKey: string, config?: { model?: string }) {
  switch (provider) {
    case AIProviderType.GEMINI:
      return new GeminiClient(apiKey, config?.model || 'gemini-2.0-flash');
    // ...
  }
}
```

### 4.3. Checklist triển khai Mục 4

- [ ] Thêm key validation khi thêm API key mới
- [ ] Tạo file `post-generation.template.ts` tách prompt templates
- [ ] Nâng cấp `ImageGenService` với multi-provider fallback (Mục 7)
- [ ] Thêm `model`, `customEndpoint`, `maxTokensPerRequest` vào `ApiKey` entity
- [ ] Sửa `AIProviderFactory` nhận dynamic model config

---

## 5. SEO TỰ ĐỘNG KHÔNG BỊ RATE LIMIT

### 5.1. Vấn đề hiện tại

```
T0:    AI Generate Post    → Provider X (RPM: 28/30)
T0+2s: AI Generate SEO     → Provider X (RPM: 29/30)
T0+5s: AI Generate Post 2  → Provider X → 429 RATE LIMITED!
```

**Nguyên nhân:** Cả AI tạo post + AI tạo SEO đều gọi chung `generateWithFallback()` → cùng pool API keys.

### 5.2. Giải pháp

#### Chiến lược A: Dedicated SEO Queue (Khuyến nghị)

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   AI Content Queue       │     │   SEO AI Queue (MỚI)    │
│   Rate: 3 jobs/min       │     │   Rate: 2 jobs/min      │
│   Priority: HIGH         │     │   Priority: LOW          │
│   Keys: ALL providers    │     │   Keys: Free providers   │
└─────────────────────────┘     └─────────────────────────┘
```

```typescript
// File mới: erg-backend/src/modules/seo/processors/seo-ai.processor.ts
@Processor('seo-ai-queue', {
  concurrency: 1,
  limiter: { max: 2, duration: 60000 },
})
export class SeoAiProcessor extends WorkerHost {
  private async generateSeoMetadata(job: Job) {
    const seoProviders = [AIProviderType.GROQ, AIProviderType.CEREBRAS, AIProviderType.SAMBANOVA];
    return this.aiContentService.generateWithFallback(prompt, adminUser, {
      preferredProviders: seoProviders,
    });
  }
}
```

#### Chiến lược B: Token Bucket chung

```typescript
// File mới: erg-backend/src/modules/ai-content/services/ai-rate-limiter.service.ts
@Injectable()
export class AiRateLimiterService {
  async acquireToken(purpose: string, provider: AIProviderType): Promise<boolean> {
    const priorityCost = { content: 1, refine: 1, seo: 2 };
    // Token bucket implementation with Redis...
  }

  async waitForToken(purpose: string, provider: AIProviderType, timeoutMs = 30000): Promise<void> {
    while (Date.now() - startTime < timeoutMs) {
      if (await this.acquireToken(purpose, provider)) return;
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`AI rate limit timeout for ${purpose}`);
  }
}
```

### 5.3. Tích hợp vào AiContentService

```typescript
// File: erg-backend/src/modules/ai-content/services/ai-content.service.ts
async generateWithFallback(prompt: string, user: User, options?: {
  purpose?: 'content' | 'seo' | 'refine';
  preferredProviders?: AIProviderType[];
}) {
  for (const provider of fallbackOrder) {
    await this.aiRateLimiter.waitForToken(purpose, provider, 15000);
    // ... existing logic ...
  }
}
```

### 5.4. Checklist triển khai Mục 5

- [ ] Tạo `seo-ai-queue` BullMQ queue với rate limiter riêng
- [ ] Tạo `SeoAiProcessor` gộp SEO AI calls vào 1 call
- [ ] Tạo `AiRateLimiterService` (Token Bucket)
- [ ] Sửa `AiContentService.generateWithFallback()` thêm `purpose`
- [ ] Thêm `preferredProviders` để SEO ưu tiên free providers
- [ ] Sửa `crawl_seo` processor đẩy job vào `seo-ai-queue`
- [ ] Thêm `CrawlStatus.SEO_PENDING` vào enum

---

## 6. QUẢN LÝ API KEY THÔNG MINH

### 6.1. Vấn đề phát hiện

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Key bị `ERROR` vĩnh viễn không dùng lại — không auto-recover | 🔴 |
| 2 | Không notification khi key bị ban/hết quota | 🔴 |
| 3 | Không validate key khi thêm mới | 🔴 |
| 4 | Không dashboard tổng quan sức khỏe keys | 🟡 |
| 5 | `checkAndResetDailyUsage()` gọi `persistAndFlush()` quá nhiều | 🟡 |
| 6 | Không track cost estimation | 🟢 |

### 6.2. Đề xuất

#### FIX 1: Auto-Recover cho Key bị ERROR (Ưu tiên 🔴)

```typescript
// File: erg-backend/src/modules/ai-content/services/api-key.service.ts

enum ApiKeyErrorType {
  INVALID_KEY = 'invalid_key',      // 401 → KHÔNG recover
  FORBIDDEN = 'forbidden',          // 403 → KHÔNG recover
  RATE_LIMITED = 'rate_limited',     // 429 → Auto recover sau cooldown
  QUOTA_EXCEEDED = 'quota_exceeded', // Hết quota → recover ngày mới
  SERVER_ERROR = 'server_error',     // 5xx → recover sau 5 phút
  NETWORK_ERROR = 'network_error',   // timeout → recover sau 2 phút
  UNKNOWN = 'unknown',              // Khác → recover sau 10 phút
}

async reportError(keyId: string, error: any) {
  // Phân loại chi tiết dựa trên error message
  if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
    key.status = ApiKeyStatus.ERROR;
    key.errorType = ApiKeyErrorType.INVALID_KEY;
    await this.notifyKeyDead(key); // ← Thông báo admin
  } else if (errorMsg.includes('500') || errorMsg.includes('502')) {
    key.status = ApiKeyStatus.RATE_LIMITED;
    key.cooldownUntil = new Date(Date.now() + 5 * 60 * 1000);
    key.errorType = ApiKeyErrorType.SERVER_ERROR;
  }
  // ... phân loại khác ...
}

async logUsage(keyId: string) {
  key.consecutiveErrors = 0; // Reset khi thành công
}
```

#### FIX 2: Notification khi Key bị ban (Ưu tiên 🔴)

```typescript
private async notifyKeyDead(key: ApiKey) {
  if (key.owner) {
    await this.notificationsService.create({
      userId: key.owner.id,
      type: NotificationType.KEY_EXPIRED,
      title: `API Key "${key.label}" không còn hoạt động`,
      message: `Key ${key.provider.toUpperCase()} bị ${key.errorType}. Vui lòng kiểm tra.`,
    });
  }
  const remainingKeys = await this.em.count(ApiKey, { provider: key.provider, status: ApiKeyStatus.ACTIVE });
  if (remainingKeys === 0) {
    await this.notificationsService.createForAdmins({
      type: NotificationType.SYSTEM_CRITICAL,
      title: `CẢNH BÁO: Provider ${key.provider.toUpperCase()} không còn API key!`,
    });
  }
}
```

#### FIX 3: Scheduled Health Check (Ưu tiên 🟡)

```typescript
// File mới: erg-backend/src/modules/ai-content/services/api-key-health.service.ts

@Cron('0 */6 * * *') // Mỗi 6 giờ
async healthCheckAllKeys() {
  const allKeys = await this.em.find(ApiKey, {});
  for (const key of allKeys) {
    if (key.errorType === 'invalid_key') continue; // Skip permanently dead
    // Test key → nếu OK thì PHỤC HỒI
    try {
      await client.generateText('Say OK', { maxTokens: 5 });
      key.status = ApiKeyStatus.ACTIVE;
      key.consecutiveErrors = 0;
    } catch { /* still down */ }
  }
}

@Cron('1 0 * * *') // Mỗi ngày lúc 00:01
async dailyReset() {
  await this.em.nativeUpdate(ApiKey, {}, { todayUsage: 0, todayRpmUsage: 0 });
  await this.em.nativeUpdate(ApiKey, { status: ApiKeyStatus.QUOTA_EXCEEDED }, { status: ApiKeyStatus.ACTIVE });
}
```

#### FIX 4: API Key Dashboard (Ưu tiên 🟡)

```typescript
// Endpoints mới:
GET  /api/ai-content/keys/dashboard     → Tổng quan sức khỏe keys
POST /api/ai-content/keys/:id/test      → Test key hoạt động
POST /api/ai-content/keys/:id/reactivate → Kích hoạt lại key
```

#### FIX 5: Thêm fields vào ApiKey Entity (Ưu tiên 🟡)

```typescript
// File: erg-backend/src/modules/ai-content/entities/api-key.entity.ts
@Property({ nullable: true })
errorType?: string;

@Property({ default: 0 })
consecutiveErrors: number = 0;

@Property({ nullable: true })
model?: string;

@Property({ nullable: true })
expiresAt?: Date;

@Property({ type: 'float', default: 0 })
estimatedCostUsd: number = 0;
```

#### FIX 6: Tối ưu `checkAndResetDailyUsage()` (Ưu tiên 🟡)

Batch flush thay vì individual writes cho mỗi key.

### 6.3. Checklist triển khai Mục 6

- [ ] Thêm `errorType`, `consecutiveErrors`, `model`, `expiresAt` vào ApiKey + migration
- [ ] Cải thiện `reportError()` phân loại lỗi chi tiết (6 loại)
- [ ] Tạo `notifyKeyDead()` gửi notification khi key bị ban
- [ ] Cảnh báo khi provider hết key (notify tất cả admin)
- [ ] Tạo `ApiKeyHealthService` health check mỗi 6h
- [ ] Tạo `dailyReset()` cron job lúc 00:01
- [ ] Tạo API endpoints dashboard/test/reactivate
- [ ] Tối ưu batch flush trong `getAvailableKey()`
- [ ] Thêm validate API key khi thêm mới

---

## 7. AI IMAGE GENERATION TỪ API KEY HIỆN CÓ

### 7.1. Ý tưởng

| Provider | Image API | Cùng API Key? | Chất lượng |
|----------|-----------|---------------|------------|
| **Gemini** | Imagen 3 | **Có** ✅ | Cao |
| **OpenAI** | DALL-E 3 | **Có** ✅ | Rất cao |
| **Together** | FLUX.1 | **Có** ✅ | Cao |
| **Cloudflare** | flux-1-schnell | Key riêng | Trung bình |
| **Pollinations** | Free HTTP | Không cần key | Trung bình |

### 7.2. Thiết kế

#### A. Mở rộng IAIClient interface

```typescript
// File: erg-backend/src/modules/ai-content/providers/ai-provider.interface.ts
export interface IAIClient {
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateImage?(prompt: string, options?: AIImageOptions): Promise<Buffer>;
  supportsImageGeneration?(): boolean;
}

export interface AIImageOptions {
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  model?: string;
}
```

#### B. GeminiClient - Imagen 3

```typescript
// File: erg-backend/src/modules/ai-content/providers/gemini.client.ts
async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
  const model = options?.model || 'imagen-3.0-generate-002';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'DONT_ALLOW' },
    }),
  });
  const result = await response.json();
  return Buffer.from(result.predictions?.[0]?.bytesBase64Encoded, 'base64');
}
```

#### C. OpenAIClient - DALL-E 3

```typescript
// File: erg-backend/src/modules/ai-content/providers/openai.client.ts
async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3', prompt, n: 1,
      size: `${options?.width || 1792}x${options?.height || 1024}`,
      response_format: 'b64_json',
    }),
  });
  const data = await response.json();
  return Buffer.from(data.data?.[0]?.b64_json, 'base64');
}
```

#### D. ImageGenService - Multi-Provider Chain

```typescript
// File: erg-backend/src/modules/ai-content/services/image-gen.service.ts
async generateImage(prompt: string, user: User, options?: AIImageOptions): Promise<Buffer> {
  // PHASE 1: AI providers có sẵn key (Gemini → OpenAI → Together)
  for (const provider of [AIProviderType.GEMINI, AIProviderType.OPENAI, AIProviderType.TOGETHER]) {
    try {
      const keyEntity = await this.apiKeyService.getAvailableKey(user, provider);
      const client = this.providerFactory.createClient(provider, keyEntity.key);
      if (!client.supportsImageGeneration?.()) continue;
      const buffer = await client.generateImage!(prompt, options);
      await this.apiKeyService.logUsage(keyEntity.id);
      return buffer;
    } catch (error) {
      this.logger.warn(`Image gen with ${provider} failed: ${error.message}`);
    }
  }
  // PHASE 2: Cloudflare AI (fallback)
  try { return await this.generateCloudflare(prompt); } catch {}
  // PHASE 3: Pollinations (miễn phí)
  return await this.generatePollinations(prompt);
}
```

### 7.3. Checklist triển khai Mục 7

- [ ] Mở rộng `IAIClient` thêm `generateImage()` + `supportsImageGeneration()`
- [ ] Implement `generateImage()` trong GeminiClient (Imagen 3)
- [ ] Implement `generateImage()` trong OpenAIClient (DALL-E 3)
- [ ] Tạo Together image gen support
- [ ] Nâng cấp `ImageGenService` với 5-level fallback
- [ ] Truyền `user` vào `ImageGenService.generateImage()`
- [ ] Cập nhật `ai-generation.processor.ts`

---

## 8. CẢI THIỆN HỆ THỐNG NOTIFICATION CHO JOBS

### 8.1. Vấn đề

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Không gửi noti khi thành công | 🔴 |
| 2 | Không có batch summary | 🔴 |
| 3 | Không có system-level alerts | 🟡 |
| 4 | Không có `createForAdmins()` | 🟡 |
| 5 | Thiếu notification types | 🟡 |
| 6 | Không có auto-cleanup | 🟢 |

### 8.2. Đề xuất Backend

#### FIX 1: Bổ sung Notification Types + Priority

```typescript
// File: erg-backend/src/modules/notifications/entities/notification.entity.ts

export enum NotificationType {
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',       // MỚI
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
    SYSTEM_ALERT = 'SYSTEM_ALERT',                   // MỚI
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',              // MỚI
    KEY_EXPIRED = 'KEY_EXPIRED',                      // MỚI
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',           // MỚI
    SEO_COMPLETED = 'SEO_COMPLETED',                  // MỚI
    SEO_FAILED = 'SEO_FAILED',                        // MỚI
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

// Thêm fields vào entity:
@Property({ default: 'LOW' })
priority: NotificationPriority = NotificationPriority.LOW;

@Property({ nullable: true })
actionUrl?: string;

@Property({ type: 'json', nullable: true })
actions?: { label: string; url: string; type: 'link' | 'api' }[];
```

#### FIX 2: Gửi Notification khi thành công

```typescript
// File: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts
// Thêm sau khi tạo post thành công:
await this.notificationsService.create({
  userId, type: NotificationType.AI_POST_COMPLETED,
  priority: NotificationPriority.LOW,
  title: 'Bài viết AI đã tạo thành công',
  message: `Bài "${aiData.title}" → ${autoPublish ? 'Published' : 'Draft'}`,
  actionUrl: `/admin/posts/${newPost.id}`,
  actions: [
    { label: 'Xem bài viết', url: `/admin/posts/${newPost.id}`, type: 'link' },
    { label: 'Chỉnh sửa', url: `/admin/posts/${newPost.id}/edit`, type: 'link' },
  ],
});

// File: erg-backend/src/modules/crawler/processors/publish.processor.ts
// Thêm sau khi publish thành công:
await this.notificationsService.create({
  userId: admin.id, type: NotificationType.CRAWL_COMPLETED,
  title: 'Cào bài viết thành công',
  message: `"${title}" từ ${new URL(url).hostname}`,
  actionUrl: `/admin/posts/${post.id}`,
});
```

#### FIX 3: Batch Summary với CrawlBatchTrackerService

```typescript
// File mới: erg-backend/src/modules/crawler/services/crawl-batch-tracker.service.ts
@Injectable()
export class CrawlBatchTrackerService {
  async registerBatch(rssId: string, totalJobs: number) { /* Redis tracking */ }
  async trackJobCompletion(rssId: string, result: { url, success, postId?, error? }) {
    // Khi tất cả jobs xong → gửi summary notification
    if (batch.completedJobs >= batch.totalJobs) {
      await this.sendBatchSummary(batch);
    }
  }
  private async sendBatchSummary(batch) {
    await this.notificationsService.create({
      type: NotificationType.CRAWL_BATCH_COMPLETED,
      title: `RSS Crawl hoàn tất: ${batch.successCount}/${batch.totalJobs} thành công`,
    });
  }
}
```

#### FIX 4: `createForAdmins()` + Auto-cleanup

```typescript
// File: erg-backend/src/modules/notifications/notifications.service.ts
async createForAdmins(data: { type, title, message, priority?, metadata? }) {
  const adminUsers = await em.find(User, { roles: { name: { $in: ['Admin', 'Super Admin'] } } });
  for (const admin of adminUsers) {
    await this.create({ userId: admin.id, ...data });
  }
}

@Cron('0 3 * * *') // 3h sáng mỗi ngày
async cleanupOldNotifications() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  // Xóa notifications đã đọc > 30 ngày
}
```

### 8.3. Notification Flow

```
┌──────────────┬──────────────┬──────────────┬────────────────────┐
│ AI Gen Post  │  Crawl       │  API Key     │  SEO Pipeline      │
│ ✅ Success   │  Pipeline    │  Manager     │                    │
│ ❌ Fail      │  ✅ per-URL  │  🔑 Expired  │  ✅ Optimized      │
│ 📊 Batch     │  ❌ per-URL  │  ⚠️ >80%     │  ❌ AI Failed      │
│              │  📊 Batch    │  🚨 No keys  │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬────────────┘
       ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                NotificationsService                              │
│  create()           → 1 user     │  Priority: LOW→CRITICAL      │
│  createForAdmins()  → all admins │  Actions: [{ label, url }]   │
│  cleanupOld()       → cron 3h    │  ActionUrl: navigate on click│
└─────────────────────────────────────────────────────────────────┘
```

### 8.4. Checklist triển khai Mục 8

- [ ] Thêm notification types mới (7 types)
- [ ] Thêm `NotificationPriority` enum
- [ ] Thêm `priority`, `actionUrl`, `actions` fields vào entity
- [ ] Gửi notification khi AI post + crawl **thành công**
- [ ] Tạo `CrawlBatchTrackerService` + batch summary
- [ ] Tạo `createForAdmins()` method
- [ ] Tạo `cleanupOldNotifications()` cron job
- [ ] Tích hợp notification vào `ApiKeyService.notifyKeyDead()`

---

## TỔNG KẾT ƯU TIÊN

### Ưu tiên CAO 🔴

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 1 | Chuyển Throttler sang Redis Storage | 1 | 1h |
| 2 | Thêm body size limit + request timeout | 1 | 30m |
| 3 | Validate API key khi thêm mới | 4 | 2h |
| 4 | Notification khi key bị ban/hết quota | 6 | 2h |
| 5 | Phân loại lỗi chi tiết + auto-recover | 6 | 3h |
| 6 | Tạo SEO AI queue riêng biệt | 5 | 4h |

### Ưu tiên TRUNG BÌNH 🟡

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 7 | IP Blocking Middleware | 1 | 3h |
| 8 | Gộp SEO AI calls thành 1 call | 2 | 2h |
| 9 | Batch query duplicate detection | 2 | 2h |
| 10 | Tách prompt templates | 4 | 3h |
| 11 | API Key Dashboard + Health Check | 6 | 4h |
| 12 | Token Bucket rate limiter | 5 | 3h |

### Ưu tiên THẤP 🟢

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 13 | Hidden Category system | 3 | 6h |
| 14 | Nâng cấp ImageGenService multi-provider | 7 | 6h |
| 15 | Abuse Detection Service | 1 | 4h |
| 16 | Dead Letter Queue | 2 | 2h |
| 17 | Notification improvements | 8 | 10h |

**Tổng estimated effort Backend: ~52 giờ**
