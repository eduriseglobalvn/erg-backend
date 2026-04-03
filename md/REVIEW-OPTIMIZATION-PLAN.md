# ERG Platform - Review & Optimization Plan

> **Reviewer:** Senior Developer & PO
> **Ngày review:** 2026-03-02
> **Scope:** erg-backend + erg (frontend)

---

## MỤC LỤC

1. [Bảo mật API & Chống DDoS](#1-bảo-mật-api--chống-ddos)
2. [Tối ưu Crawl Post & AI Gen Post](#2-tối-ưu-crawl-post--ai-gen-post)
3. [Dịch vụ Crawl ẩn (Hidden Category)](#3-dịch-vụ-crawl-ẩn-hidden-category)
4. [AI tạo Post chuyên nghiệp](#4-ai-tạo-post-chuyên-nghiệp)
5. [SEO tự động không bị Rate Limit](#5-seo-tự-động-không-bị-rate-limit)
6. [Quản lý API Key thông minh](#6-quản-lý-api-key-thông-minh)
7. [AI Image Generation từ API Key hiện có (Bổ sung)](#7-ai-image-generation-từ-api-key-hiện-có-bổ-sung)
8. [Cải thiện Notification cho Jobs (Bổ sung)](#8-cải-thiện-hệ-thống-notification-cho-jobs-bổ-sung)

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
| Error handling | Notification khi fail, retry 3 lần | **Tốt** |
| Queue config | removeOnComplete: 1h/100 jobs, removeOnFail: 24h | **Tốt** |

### 2.4. Checklist triển khai Mục 2

- [ ] Tạo `SeoBatchService` gộp title + meta + keywords vào 1 AI call
- [ ] Hoặc chạy song song title + meta + alt bằng `Promise.all` trong SEO processor
- [ ] Tối ưu image processing trong `process.processor.ts` (batch download song song)
- [ ] Batch query duplicate detection thay vì N+1 trong `processRssFeed()`
- [ ] Chạy thumbnail + content images song song trong AI gen processor
- [ ] Tạo Dead Letter Queue service cho failed jobs
- [ ] Thêm metrics tracking (thời gian xử lý mỗi stage, tỉ lệ thành công)

---

## 3. DỊCH VỤ CRAWL ẨN (HIDDEN CATEGORY)

### 3.1. Yêu cầu

- Crawl thông tin tips, mẹo, kiến thức từ các trang bên ngoài
- Nội dung **KHÔNG** thuộc bất kỳ category công khai nào
- Thuộc một dạng **category ẩn** — không hiển thị trên menu, sitemap, hay trang tin tức chính
- Chỉ Admin mới có thể xem và quản lý nội dung này
- Mục đích: Thu thập tài liệu tham khảo, tips nội bộ, hoặc nguồn content để rewrite/reuse sau

### 3.2. Thiết kế giải pháp

#### A. Thêm trường `isHidden` vào PostCategory

```typescript
// File cần sửa: erg-backend/src/modules/posts/entities/post-category.entity.ts

@Entity({ tableName: 'post_categories' })
export class PostCategory extends BaseEntity {
  // ... existing fields ...

  /** Category ẩn: Không hiển thị trên FE, sitemap, menu */
  @Property({ default: false })
  isHidden: boolean = false;

  /** Loại category ẩn (nếu cần phân biệt) */
  @Property({ nullable: true })
  hiddenType?: string; // 'tips', 'reference', 'internal', 'scrape-pool'
}
```

#### B. Tạo Hidden Category qua Migration/Seed

```typescript
// File mới: erg-backend/src/migrations/seed-hidden-categories.ts

// Tạo sẵn 1 category ẩn mặc định
const hiddenCategories = [
  {
    name: 'Kho Tips & Mẹo (Ẩn)',
    slug: '__hidden_tips',
    description: 'Category ẩn chứa tips, mẹo cào được từ các nguồn bên ngoài',
    isHidden: true,
    hiddenType: 'tips',
  },
  {
    name: 'Tài liệu tham khảo (Ẩn)',
    slug: '__hidden_reference',
    description: 'Category ẩn chứa tài liệu tham khảo nội bộ',
    isHidden: true,
    hiddenType: 'reference',
  },
  {
    name: 'Scrape Pool (Ẩn)',
    slug: '__hidden_scrape_pool',
    description: 'Nội dung cào tự động chưa phân loại',
    isHidden: true,
    hiddenType: 'scrape-pool',
  },
];
```

#### C. Filter Hidden Categories khỏi Public APIs

```typescript
// File cần sửa: erg-backend/src/modules/posts/posts.service.ts

// GET /posts (public) - Loại bỏ posts thuộc hidden categories
async findAll(query: FindAllPostsDto) {
  const qb = this.postRepo.createQueryBuilder('p')
    .leftJoinAndSelect('p.category', 'c')
    .where({
      status: PostStatus.PUBLISHED,
      'c.isHidden': { $ne: true },  // ← THÊM: Exclude hidden categories
    });
  // ...
}

// GET /categories (public) - Loại bỏ hidden categories
async getCategories() {
  return this.categoryRepo.find({
    isHidden: { $ne: true },  // ← THÊM: Exclude hidden
  });
}
```

#### D. Thêm `isHiddenCrawl` vào RssFeed Entity

```typescript
// File cần sửa: erg-backend/src/modules/crawler/entities/rss-feed.entity.ts

@Entity({ collection: 'crawler_rss_feeds' })
export class RssFeed extends MongoBaseEntity {
  // ... existing fields ...

  /** Đánh dấu RSS này phục vụ crawl ẩn */
  @Property({ default: false })
  isHiddenCrawl: boolean = false;

  /** Nếu isHiddenCrawl=true, tự động gán category ẩn thay vì targetCategoryId */
  @Property({ nullable: true })
  hiddenCategorySlug?: string; // '__hidden_tips', '__hidden_reference', etc.
}
```

#### E. Logic tự động gán Hidden Category trong Pipeline

```typescript
// File cần sửa: erg-backend/src/modules/crawler/processors/publish.processor.ts

async process(job: Job<any>): Promise<any> {
  const { rawId, url, rssId, targetCategoryId, autoPublish, isHiddenCrawl } = job.data;

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
    aiPrompt: `[HIDDEN CRAWL] Source: ${url}`,
  } as any, admin);
}
```

#### F. Admin Dashboard cho Hidden Content

```
Trang Admin: /admin/hidden-content
├── Tabs:
│   ├── Tips & Mẹo        (filter: hiddenType='tips')
│   ├── Tài liệu TK       (filter: hiddenType='reference')
│   └── Scrape Pool        (filter: hiddenType='scrape-pool')
├── Actions:
│   ├── Xem nội dung gốc
│   ├── Chuyển sang Category công khai (rewrite + publish)
│   ├── Xóa vĩnh viễn
│   └── Đánh dấu đã dùng / chưa dùng
└── Filters: Theo nguồn, theo ngày, theo trạng thái
```

```typescript
// File mới: erg-backend/src/modules/posts/posts.controller.ts (thêm endpoint)

@Get('hidden')
@Permissions('posts.manage_hidden')
async getHiddenPosts(
  @Query('hiddenType') hiddenType?: string,
  @Query('page') page = 1,
  @Query('limit') limit = 20,
) {
  return this.postsService.findHiddenPosts(hiddenType, page, limit);
}

@Post(':id/promote')
@Permissions('posts.manage_hidden')
async promoteHiddenPost(
  @Param('id') id: string,
  @Body() body: { targetCategoryId: string; rewrite?: boolean },
) {
  // Chuyển post từ hidden category → public category
  // Nếu rewrite=true → gọi AI rewrite content trước
  return this.postsService.promoteToPublic(id, body);
}
```

### 3.3. Flow tổng thể dịch vụ Crawl ẩn

```
[Admin tạo RSS Feed]                    [Scheduler tự động]
  isHiddenCrawl: true          ──────►    triggerRssCrawl()
  hiddenCategorySlug: '__hidden_tips'          │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Pipeline 5 stages   │
                                    │  (Discovery → ... →  │
                                    │   Publish)           │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    Post(category='__hidden_tips')
                                    status=DRAFT
                                               │
                               ┌───────────────┼───────────────┐
                               ▼               ▼               ▼
                         [Admin Review]  [Tự động tag]   [Archive]
                         Rewrite + Move  keywords/labels  Lưu tham khảo
                         → Public post   cho tìm kiếm     → Không dùng
```

### 3.4. Bảo mật & Quy tắc

1. **Frontend:** Route `/admin/hidden-content` chỉ hiển thị khi user có permission `posts.manage_hidden`
2. **API:** Tất cả endpoints hidden posts đều yêu cầu `@Permissions('posts.manage_hidden')`
3. **SEO:** Hidden posts **KHÔNG** được index bởi search engines:
   - Sitemap service loại bỏ hidden categories
   - Schema markup không áp dụng cho hidden posts
   - `robots: noindex, nofollow` cho hidden post URLs (nếu có)
4. **Crawl frequency:** Hidden crawl nên chạy ít hơn (1-2 lần/ngày) để tránh overload

### 3.5. Checklist triển khai Mục 3

- [ ] Thêm `isHidden`, `hiddenType` vào `PostCategory` entity + migration
- [ ] Tạo seed data cho 3 hidden categories mặc định
- [ ] Sửa public API endpoints loại bỏ hidden categories (posts, categories, sitemap)
- [ ] Thêm `isHiddenCrawl`, `hiddenCategorySlug` vào `RssFeed` entity
- [ ] Sửa `publish.processor.ts` để tự động gán hidden category
- [ ] Tạo Admin API: `GET /posts/hidden`, `POST /posts/:id/promote`
- [ ] Thêm permission `posts.manage_hidden` vào hệ thống RBAC
- [ ] Tạo Frontend page `/admin/hidden-content`
- [ ] Sửa sitemap service loại bỏ hidden categories

---

## 4. AI TẠO POST CHUYÊN NGHIỆP

### 4.1. Hiện trạng hệ thống AI

#### A. Kiến trúc hiện tại

```
┌──────────────────────────────────────────────────────────────────┐
│                      AI Content Module                           │
├──────────────────┬───────────────────┬───────────────────────────┤
│  AiContentService│   ApiKeyService   │  ProviderHealthService    │
│  (Orchestrator)  │   (Key rotation)  │  (Health monitoring)      │
├──────────────────┴───────────────────┴───────────────────────────┤
│                    AIProviderFactory                              │
│  ┌─────────┬──────────┬──────────┬─────────┬──────────────────┐ │
│  │ Gemini  │  Groq    │  Claude  │ OpenAI  │ 8 OpenAI-compat  │ │
│  │ Client  │  Client  │  Client  │ Client  │ clients          │ │
│  └─────────┴──────────┴──────────┴─────────┴──────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                    ImageGenService                                │
│  Cloudflare AI (flux-1-schnell, free tier)                       │
└──────────────────────────────────────────────────────────────────┘
```

#### B. Đánh giá chi tiết

| Thành phần | Hiện trạng | Đánh giá |
|------------|-----------|----------|
| **API Key encryption** | AES-256-CBC, random IV | **Tốt** - Industry standard |
| **Key rotation** | Priority → least usage → least recent | **Tốt** |
| **Provider fallback** | 12 providers, dynamic health scoring | **Tốt** |
| **Rate limit tracking** | RPM (30/min), RPD (1500/day) per key | **Tốt** |
| **Cooldown mechanism** | 60s cho rate limit, end of day cho quota | **Tốt** |
| **Project-level update** | Bulk update tất cả keys cùng projectId | **Tốt** |
| **Image generation** | Cloudflare AI free tier, 1 model duy nhất | 🔴 **Cần cải thiện** |
| **Prompt engineering** | Hardcoded prompt trong processor | 🟡 **Cần tách ra** |
| **Error classification** | 429→RATE_LIMITED, Quota→EXCEEDED, else→ERROR | 🟡 **Cần chi tiết hơn** |
| **Key validation** | Không validate key khi thêm mới | 🔴 **Thiếu** |

### 4.2. Đề xuất cải thiện chi tiết

#### FIX 1: Validate API Key khi thêm mới (Ưu tiên 🔴)

**Vấn đề:** `upsertKey()` hiện tại encrypt và lưu key mà không kiểm tra key có hợp lệ không.

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/api-key.service.ts

async upsertKey(user: User, keyData: { key: string; provider: AIProviderType; label?: string; ... }) {
  // THÊM: Validate key trước khi lưu
  const isValid = await this.validateApiKey(keyData.key, keyData.provider);
  if (!isValid.success) {
    throw new BadRequestException(`API Key không hợp lệ: ${isValid.error}`);
  }

  // ... existing logic ...
}

private async validateApiKey(key: string, provider: AIProviderType): Promise<{ success: boolean; error?: string }> {
  try {
    const client = this.providerFactory.createClient(provider, key);
    // Gửi 1 request nhỏ nhất để test
    await client.generateText('Say "OK"', { maxTokens: 5 });
    return { success: true };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Invalid')) {
      return { success: false, error: 'API Key không hợp lệ hoặc đã bị revoke' };
    }
    if (error.message.includes('403')) {
      return { success: false, error: 'API Key bị cấm hoặc chưa kích hoạt' };
    }
    // Nếu lỗi khác (network, rate limit) → key vẫn có thể hợp lệ
    return { success: true };
  }
}
```

---

#### FIX 2: Tách Prompt Templates ra khỏi Processor (Ưu tiên 🟡)

**Vấn đề:** Prompt tạo bài viết (~40 dòng) được hardcode trong `ai-generation.processor.ts`. Khó maintain, không thể customize theo category hoặc A/B test.

```typescript
// File mới: erg-backend/src/modules/ai-content/templates/post-generation.template.ts

export const POST_TEMPLATES = {
  informative: {
    name: 'Bài viết thông tin',
    systemPrompt: `Bạn là Senior Content Writer tại ERG (Education Rise Global)...`,
    userPromptBuilder: (topic: string, category: string) => `
      Viết bài blog chuyên sâu về: "${topic}"
      Chuyên mục: ${category}
      ...
    `,
    imageStyle: 'photorealistic, cinematic lighting, 8k, professional photography',
    maxImages: 4,
    wordCount: { min: 800, max: 1200 },
  },

  howto: {
    name: 'Hướng dẫn thực hành',
    systemPrompt: `Bạn là chuyên gia hướng dẫn...`,
    userPromptBuilder: (topic: string) => `
      Viết bài hướng dẫn step-by-step về: "${topic}"
      ...
    `,
    imageStyle: 'clean infographic, step-by-step diagram, flat design',
    maxImages: 6,
    wordCount: { min: 1000, max: 1500 },
  },

  listicle: {
    name: 'Danh sách Top N',
    systemPrompt: `Bạn là curator nội dung...`,
    userPromptBuilder: (topic: string) => `
      Viết bài dạng "Top N" về: "${topic}"
      ...
    `,
    imageStyle: 'modern, clean, vibrant colors, editorial photography',
    maxImages: 3,
    wordCount: { min: 600, max: 1000 },
  },

  news: {
    name: 'Tin tức / Sự kiện',
    systemPrompt: `Bạn là nhà báo giáo dục...`,
    userPromptBuilder: (topic: string) => `
      Viết bài tin tức về: "${topic}"
      ...
    `,
    imageStyle: 'photojournalism, documentary style, real event',
    maxImages: 2,
    wordCount: { min: 500, max: 800 },
  },
};

// Cho phép lưu custom templates vào DB sau này
export interface PostTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string; // Dùng {{topic}}, {{category}} placeholders
  imageStyle: string;
  maxImages: number;
  wordCount: { min: number; max: number };
}
```

---

#### FIX 3: Nâng cấp Image Generation (Ưu tiên 🔴)

**Vấn đề hiện tại:**
- Chỉ dùng **Cloudflare AI free tier** → giới hạn chất lượng và số lượng
- 1 model duy nhất (`flux-1-schnell`) → không có fallback
- Không có cơ chế retry hoặc fallback khi Cloudflare down
- `num_steps: 4` → chất lượng thấp (recommend 8-12 cho sản phẩm)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/image-gen.service.ts

@Injectable()
export class ImageGenService {
  private readonly logger = new Logger(ImageGenService.name);

  // Danh sách providers hình ảnh với fallback
  private readonly imageProviders = [
    {
      name: 'cloudflare-flux',
      generate: (prompt: string) => this.generateCloudflare(prompt),
      isAvailable: true,
    },
    {
      name: 'pollinations-free',  // Dịch vụ miễn phí, không cần API key
      generate: (prompt: string) => this.generatePollinations(prompt),
      isAvailable: true,
    },
  ];

  constructor(private configService: ConfigService) {}

  // MAIN: Generate với fallback chain
  async generateImage(prompt: string): Promise<Buffer> {
    for (const provider of this.imageProviders) {
      if (!provider.isAvailable) continue;
      try {
        return await provider.generate(prompt);
      } catch (error) {
        this.logger.warn(`Image provider ${provider.name} failed: ${error.message}`);
        // Tạm disable provider 5 phút nếu fail
        provider.isAvailable = false;
        setTimeout(() => { provider.isAvailable = true; }, 300000);
      }
    }
    throw new Error('All image generation providers are unavailable');
  }

  // Provider 1: Cloudflare AI (hiện tại)
  private async generateCloudflare(prompt: string): Promise<Buffer> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    const model = '@cf/black-forest-labs/flux-1-schnell';

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          num_steps: 8, // Tăng từ 4 → 8 để cải thiện chất lượng
        }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare: ${response.statusText}`);
    const result = await response.json();
    if (result.success && result.result?.image) {
      return Buffer.from(result.result.image, 'base64');
    }
    throw new Error('Cloudflare response missing image data');
  }

  // Provider 2: Pollinations.ai (miễn phí, không cần key)
  private async generatePollinations(prompt: string): Promise<Buffer> {
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&nologo=true`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pollinations: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

---

#### FIX 4: Cải thiện Post Generation Flow (Ưu tiên 🟡)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts

// HIỆN TẠI: Flow cứng nhắc
// 1. Generate content → 2. Parse JSON → 3. Thumbnail → 4. Content images (tuần tự) → 5. SEO → 6. Save

// ĐỀ XUẤT: Flow linh hoạt hơn
private async handleGeneratePost(job: Job<any>): Promise<any> {
  const { topic, userId, categoryId, template = 'informative', autoPublish } = job.data;
  const em = this.em.fork();

  // 1. Load template
  const tmpl = POST_TEMPLATES[template] || POST_TEMPLATES.informative;

  // 2. Generate content với AI
  await job.updateProgress(10);
  const rawResult = await this.aiContentService.generateWithFallback(
    tmpl.userPromptBuilder(topic, category.name),
    user,
    { maxTokens: 8192, systemPrompt: tmpl.systemPrompt }
  );
  await job.updateProgress(30);

  // 3. Parse + Validate JSON output
  const aiData = this.parseAiResponse(rawResult);
  if (!aiData.title || !aiData.htmlContent) {
    throw new Error('AI response missing required fields');
  }

  // 4. Generate ALL images song song (thumbnail + content)
  await job.updateProgress(40);
  const { thumbnailUrl, processedHtml } = await this.processAllImages(
    aiData, postSlug, tmpl.imageStyle, tmpl.maxImages
  );
  await job.updateProgress(80);

  // 5. SEO optimization (gộp 1 call)
  const seoData = await this.generateSeoData(topic, processedHtml, user);
  await job.updateProgress(90);

  // 6. Save to DB
  const post = await this.postsService.create({ ... });
  await job.updateProgress(100);

  return { postId: post.id, slug: post.slug, status: 'completed' };
}

// Helper: Parse AI response với retry
private parseAiResponse(raw: string, retries = 0): any {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Thử fix common JSON errors
    const fixed = clean
      .replace(/,\s*}/g, '}')     // Trailing comma
      .replace(/,\s*]/g, ']')     // Trailing comma in array
      .replace(/'/g, '"');         // Single quotes → double quotes
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error('AI Response JSON Syntax Error');
    }
  }
}
```

---

#### FIX 5: Provider-specific Model Configuration (Ưu tiên 🟢)

**Vấn đề:** Model names đang hardcode trong factory. Nên cho phép config từ DB hoặc env.

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/entities/api-key.entity.ts

@Entity({ tableName: 'api_keys' })
export class ApiKey extends BaseEntity {
  // ... existing fields ...

  /** Model cụ thể cho key này (override default) */
  @Property({ nullable: true })
  model?: string; // VD: 'gemini-2.0-flash', 'gpt-4o-mini', 'claude-haiku-4-5-20251001'

  /** Custom endpoint (cho self-hosted hoặc proxy) */
  @Property({ nullable: true })
  customEndpoint?: string;

  /** Max tokens per request cho key này */
  @Property({ default: 8192 })
  maxTokensPerRequest: number = 8192;

  /** Temperature mặc định */
  @Property({ type: 'float', default: 0.7 })
  defaultTemperature: number = 0.7;
}

// File cần sửa: erg-backend/src/modules/ai-content/providers/ai-provider.factory.ts
createClient(provider: AIProviderType, apiKey: string, config?: { model?: string; endpoint?: string }): IAIClient {
  switch (provider) {
    case AIProviderType.GEMINI:
      return new GeminiClient(apiKey, config?.model || 'gemini-2.0-flash');
    case AIProviderType.CLAUDE:
      return new ClaudeClient(apiKey, config?.model || 'claude-haiku-4-5-20251001');
    // ... dynamic model selection
  }
}
```

### 4.3. Tổng quan flow AI tạo Post sau tối ưu

```
[User nhập keyword + chọn template]
              │
              ▼
    ┌─────────────────┐
    │ Validate Input   │  ← Check category, user permissions
    │ Select Template  │  ← informative/howto/listicle/news
    └────────┬────────┘
              │
              ▼
    ┌─────────────────┐
    │ BullMQ Queue     │  ← Retry 3x, backoff 60s
    │ ai-content-queue │
    └────────┬────────┘
              │
              ▼
    ┌─────────────────┐
    │ Generate Content │  ← AI provider with dynamic fallback
    │ (1 API call)     │     Groq → Cerebras → Gemini → ...
    └────────┬────────┘
              │
              ▼
    ┌─────────────────┐
    │ Parse & Validate │  ← JSON parse with auto-fix
    │ AI Response      │     Validate required fields
    └────────┬────────┘
              │
              ▼
    ┌─────────────────────────────────────┐
    │ Generate Images (SONG SONG)          │
    │ ┌──────────┐  ┌──────────────────┐  │
    │ │Thumbnail │  │Content Images x4 │  │
    │ │Cloudflare│  │Cloudflare/Pollin │  │
    │ └──────────┘  └──────────────────┘  │
    │        Upload to R2 Storage          │
    └────────────────┬────────────────────┘
                     │
                     ▼
    ┌─────────────────┐
    │ SEO Optimization │  ← 1 gộp AI call (title + meta + keywords)
    │ + Auto-linking   │
    └────────┬────────┘
              │
              ▼
    ┌─────────────────┐
    │ Save to MySQL    │  ← Post(status=DRAFT/PUBLISHED)
    │ + Notification   │     Notify user khi hoàn tất
    └─────────────────┘
```

### 4.4. Checklist triển khai Mục 4

- [ ] Thêm key validation khi thêm API key mới (test call nhẹ)
- [ ] Tạo file `post-generation.template.ts` tách prompt templates
- [ ] Nâng cấp `ImageGenService` với multi-provider fallback
- [ ] Tăng `num_steps` Cloudflare từ 4 → 8
- [ ] Thêm Pollinations.ai làm image gen fallback miễn phí
- [ ] Cải thiện JSON parsing với auto-fix common errors
- [ ] Thêm `model`, `customEndpoint`, `maxTokensPerRequest` vào `ApiKey` entity
- [ ] Sửa `AIProviderFactory` nhận dynamic model config
- [ ] Thêm frontend UI cho chọn template khi tạo AI post
- [ ] Thêm provider field khi upsertKey (hiện tại thiếu trong DTO)

---

## 5. SEO TỰ ĐỘNG KHÔNG BỊ RATE LIMIT

### 5.1. Vấn đề hiện tại

**Xung đột rate limit giữa AI tạo post và AI tạo SEO:**

```
Thời điểm T0:  AI Generate Post    → gọi Provider X (RPM: 28/30)
Thời điểm T0+2s: AI Generate SEO   → gọi Provider X (RPM: 29/30)
Thời điểm T0+5s: AI Generate Post 2 → gọi Provider X → 429 RATE LIMITED!
```

**Nguyên nhân gốc:** Cả 2 tác vụ (AI tạo post + AI tạo SEO) đều gọi chung `AiContentService.generateWithFallback()` → cùng chia sẻ pool API keys → cùng tiêu thụ RPM quota.

**Tình huống tệ nhất:** Khi chạy batch AI (10 bài) + SEO processor (10 bài crawl) cùng lúc → 20 AI calls trong thời gian ngắn → rate limit tất cả keys.

### 5.2. Giải pháp: Tách biệt AI Pool cho SEO vs Content

#### Chiến lược A: Dedicated SEO Queue với Rate Limiting riêng (Khuyến nghị)

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   AI Content Queue       │     │   SEO AI Queue           │
│   (ai-content-queue)     │     │   (seo-ai-queue) ← MỚI  │
│                          │     │                          │
│ Rate: 3 jobs/min         │     │ Rate: 2 jobs/min         │
│ Priority: HIGH           │     │ Priority: LOW            │
│ Keys: ALL providers      │     │ Keys: Free providers     │
│                          │     │ (Groq, Cerebras, OpenRT) │
└─────────────────────────┘     └─────────────────────────┘
           │                                │
           ▼                                ▼
    ┌─────────────┐                  ┌─────────────┐
    │ API Key Pool │                  │ API Key Pool │
    │ (Full)       │                  │ (SEO-only)   │
    └─────────────┘                  └─────────────┘
```

```typescript
// File mới: erg-backend/src/modules/seo/processors/seo-ai.processor.ts

@Processor('seo-ai-queue', {
  concurrency: 1,          // Chỉ 1 job cùng lúc
  limiter: {
    max: 2,                // Tối đa 2 jobs
    duration: 60000,       // Mỗi phút → ~2 AI calls/min cho SEO
  },
})
export class SeoAiProcessor extends WorkerHost {
  async process(job: Job<any>): Promise<any> {
    switch (job.name) {
      case 'generate_seo_metadata':
        return this.generateSeoMetadata(job);
      case 'paraphrase_content':
        return this.paraphraseContent(job);
    }
  }

  private async generateSeoMetadata(job: Job) {
    const { rawId, title, content } = job.data;
    // Gộp tất cả SEO metadata vào 1 AI call
    const prompt = `
      Phân tích bài viết sau và tạo SEO metadata:
      TIÊU ĐỀ: ${title}
      NỘI DUNG (500 chars): ${content.substring(0, 500)}

      Trả về JSON:
      {
        "seoTitle": "Tiêu đề SEO (50-60 ký tự)",
        "metaDescription": "Meta description (150-160 ký tự, có CTA)",
        "keywords": ["kw1", "kw2", "kw3"],
        "altTexts": { "img_url": "alt text tương ứng" }
      }
    `;

    // Ưu tiên dùng free providers cho SEO
    const seoProviders = [
      AIProviderType.GROQ,
      AIProviderType.CEREBRAS,
      AIProviderType.SAMBANOVA,
      AIProviderType.OPENROUTER,
    ];
    return this.aiContentService.generateWithFallback(prompt, adminUser, {
      preferredProviders: seoProviders,
    });
  }
}
```

#### Chiến lược B: Delay Queue cho SEO tasks

```typescript
// File cần sửa: erg-backend/src/modules/crawler/processors/seo.processor.ts

// THAY ĐỔI: Không gọi AI trực tiếp, đẩy vào queue riêng có delay
@Processor('crawl_seo', { concurrency: 2 })
export class SeoProcessor extends WorkerHost {
  async process(job: Job<any>): Promise<any> {
    const { rawId } = job.data;
    const rawContent = await this.rawRepo.findOne({ id: rawId });

    // Thay vì gọi AI trực tiếp, đẩy vào SEO AI queue với delay
    await this.seoAiQueue.add('generate_seo_metadata', {
      rawId,
      title: rawContent.rawTitle,
      content: rawContent.processedContent,
    }, {
      delay: 30000,  // Delay 30 giây → tránh xung đột với AI content
      priority: 10,  // Priority thấp hơn AI content (default=0)
    });

    // Đánh dấu trạng thái chờ SEO
    rawContent.status = CrawlStatus.SEO_PENDING;
    await this.rawRepo.getEntityManager().persistAndFlush(rawContent);
  }
}
```

#### Chiến lược C: Token Bucket chung (Singleton)

```typescript
// File mới: erg-backend/src/modules/ai-content/services/ai-rate-limiter.service.ts

@Injectable()
export class AiRateLimiterService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  /**
   * Kiểm tra và tiêu thụ 1 token từ bucket
   * @param purpose 'content' | 'seo' | 'refine'
   * @param provider Provider đang dùng
   */
  async acquireToken(purpose: string, provider: AIProviderType): Promise<boolean> {
    const bucketKey = `ai_bucket:${provider}`;
    const now = Date.now();

    // Lấy trạng thái bucket hiện tại
    const bucket = await this.cache.get<{
      tokens: number;
      lastRefill: number;
    }>(bucketKey) || { tokens: 25, lastRefill: now }; // 25 RPM default

    // Refill tokens (1 token mỗi 2.4 giây = 25/phút)
    const elapsed = now - bucket.lastRefill;
    const refillRate = 25 / 60; // tokens per second
    const newTokens = Math.min(25, bucket.tokens + (elapsed / 1000) * refillRate);

    // Priority: Content > Refine > SEO
    const priorityCost = {
      content: 1,    // 1 token
      refine: 1,     // 1 token
      seo: 2,        // 2 tokens (để giảm frequency)
    };

    const cost = priorityCost[purpose] || 1;

    if (newTokens < cost) {
      return false; // Không đủ tokens → chờ
    }

    // Tiêu thụ token
    await this.cache.set(bucketKey, {
      tokens: newTokens - cost,
      lastRefill: now,
    }, 120000); // TTL 2 phút

    return true;
  }

  /**
   * Chờ đến khi có token (với timeout)
   */
  async waitForToken(purpose: string, provider: AIProviderType, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.acquireToken(purpose, provider)) return;
      await new Promise(r => setTimeout(r, 2000)); // Poll mỗi 2s
    }
    throw new Error(`AI rate limit timeout for ${purpose}`);
  }
}
```

### 5.3. Tích hợp vào `AiContentService`

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/ai-content.service.ts

async generateWithFallback(
  prompt: string,
  user: User,
  options?: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    purpose?: 'content' | 'seo' | 'refine';  // ← THÊM
    preferredProviders?: AIProviderType[];     // ← THÊM
  }
): Promise<string> {
  const purpose = options?.purpose || 'content';

  // Lấy thứ tự ưu tiên
  let fallbackOrder = options?.preferredProviders
    || await this.providerHealthService.getOptimalFallbackOrder();

  for (const provider of fallbackOrder) {
    // THÊM: Chờ rate limit token
    try {
      await this.aiRateLimiter.waitForToken(purpose, provider, 15000);
    } catch {
      this.logger.warn(`Rate limiter timeout for ${provider}, trying next...`);
      continue;
    }

    // ... existing key selection + generation logic ...
  }
}
```

### 5.4. Kịch bản sau tối ưu

```
Batch AI tạo 10 bài viết:
  T0-T30:   Content gen (3 calls/min, dùng Groq/Gemini)     ← Token bucket: cost=1

Crawler xử lý 10 bài:
  T0:       Crawl pipeline → SEO queue (delay 30s)
  T30-T60:  SEO AI calls (2 calls/min, dùng OpenRouter/Cerebras) ← Token bucket: cost=2

  → Không xung đột vì:
  1. SEO có delay 30s
  2. SEO dùng provider khác (free tier)
  3. Token bucket điều phối tổng lượng calls
  4. SEO priority thấp hơn → tự động nhường Content
```

### 5.5. Checklist triển khai Mục 5

- [ ] Tạo `seo-ai-queue` BullMQ queue với rate limiter riêng (2 jobs/min)
- [ ] Tạo `SeoAiProcessor` gộp tất cả SEO AI calls vào 1 call
- [ ] Tạo `AiRateLimiterService` (Token Bucket) điều phối chung
- [ ] Sửa `AiContentService.generateWithFallback()` thêm `purpose` parameter
- [ ] Thêm `preferredProviders` để SEO ưu tiên free providers
- [ ] Sửa `crawl_seo` processor đẩy job vào `seo-ai-queue` thay vì gọi AI trực tiếp
- [ ] Thêm delay 30s cho SEO AI jobs (tránh xung đột với content gen)
- [ ] Thêm `CrawlStatus.SEO_PENDING` vào enum
- [ ] Test scenario: Chạy batch 10 AI posts + 10 crawl cùng lúc

---

## 6. QUẢN LÝ API KEY THÔNG MINH

### 6.1. Hiện trạng hệ thống quản lý Key

#### Đã có (Tốt):
- Encryption AES-256-CBC cho key storage
- 4 trạng thái: `ACTIVE`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `ERROR`
- Cooldown 60s cho rate limit, end-of-day reset cho quota
- RPM limit (30/min), RPD limit (1500/day) per key
- Project-level bulk update khi 1 key trong project bị limit
- Priority-based key rotation (priority → least usage → least recent)

#### Vấn đề phát hiện:

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Key bị `ERROR` sẽ **vĩnh viễn không dùng lại** được — không có cơ chế auto-recover | 🔴 |
| 2 | Không có **notification** khi key bị ban/hết quota | 🔴 |
| 3 | Không **validate key** khi user thêm vào hệ thống | 🔴 |
| 4 | Không có **dashboard** tổng quan sức khỏe tất cả keys | 🟡 |
| 5 | `checkAndResetDailyUsage()` gọi `persistAndFlush()` quá nhiều lần (mỗi lần check = 1-2 DB writes) | 🟡 |
| 6 | Không có cơ chế **auto-rotate** key bị ban → thay key mới | 🟢 |
| 7 | Không track **cost estimation** cho mỗi key/provider | 🟢 |

### 6.2. Đề xuất cải thiện

#### FIX 1: Cơ chế Auto-Recover cho Key bị ERROR (Ưu tiên 🔴)

**Vấn đề:** Key status = `ERROR` → bị bỏ qua mãi mãi. Nhưng nhiều lỗi chỉ tạm thời (network timeout, server 500).

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/api-key.service.ts

// THÊM: Phân loại ERROR chi tiết hơn
enum ApiKeyErrorType {
  INVALID_KEY = 'invalid_key',        // 401 - Key sai hoặc bị revoke → KHÔNG recover
  FORBIDDEN = 'forbidden',            // 403 - Không có quyền → KHÔNG recover
  RATE_LIMITED = 'rate_limited',      // 429 - Quá nhiều request → Auto recover sau cooldown
  QUOTA_EXCEEDED = 'quota_exceeded',  // Hết quota ngày → Auto recover ngày mới
  SERVER_ERROR = 'server_error',      // 500, 502, 503 → Auto recover sau 5 phút
  NETWORK_ERROR = 'network_error',    // Timeout, DNS fail → Auto recover sau 2 phút
  UNKNOWN = 'unknown',               // Lỗi khác → Auto recover sau 10 phút
}

// THÊM: Phân loại lỗi thông minh hơn
@CreateRequestContext()
async reportError(keyId: string, error: any) {
  const key = await this.em.findOne(ApiKey, { id: keyId } as any);
  if (!key) return;

  key.lastErrorAt = new Date();
  key.consecutiveErrors = (key.consecutiveErrors || 0) + 1;
  const errorMsg = error?.message || String(error);
  key.lastErrorMessage = errorMsg;

  // Phân loại chi tiết
  if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
    key.status = ApiKeyStatus.RATE_LIMITED;
    key.cooldownUntil = new Date(Date.now() + 60 * 1000);
    key.errorType = ApiKeyErrorType.RATE_LIMITED;
  } else if (errorMsg.includes('401') || errorMsg.includes('Invalid API') || errorMsg.includes('Unauthorized')) {
    key.status = ApiKeyStatus.ERROR;
    key.errorType = ApiKeyErrorType.INVALID_KEY;
    // KEY BỊ REVOKE → THÔNG BÁO ADMIN
    await this.notifyKeyDead(key);
  } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
    key.status = ApiKeyStatus.ERROR;
    key.errorType = ApiKeyErrorType.FORBIDDEN;
    await this.notifyKeyDead(key);
  } else if (errorMsg.includes('Quota') || errorMsg.includes('RPD')) {
    key.status = ApiKeyStatus.QUOTA_EXCEEDED;
    key.errorType = ApiKeyErrorType.QUOTA_EXCEEDED;
  } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
    key.status = ApiKeyStatus.RATE_LIMITED; // Dùng RATE_LIMITED để auto recover
    key.cooldownUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
    key.errorType = ApiKeyErrorType.SERVER_ERROR;
  } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED')) {
    key.status = ApiKeyStatus.RATE_LIMITED;
    key.cooldownUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 phút
    key.errorType = ApiKeyErrorType.NETWORK_ERROR;
  } else {
    // Lỗi không xác định
    if (key.consecutiveErrors >= 5) {
      key.status = ApiKeyStatus.ERROR;
      key.errorType = ApiKeyErrorType.UNKNOWN;
      await this.notifyKeyDead(key);
    } else {
      key.status = ApiKeyStatus.RATE_LIMITED;
      key.cooldownUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
      key.errorType = ApiKeyErrorType.UNKNOWN;
    }
  }

  // Bulk update project keys nếu cần
  if (key.projectId && [ApiKeyErrorType.RATE_LIMITED, ApiKeyErrorType.QUOTA_EXCEEDED].includes(key.errorType)) {
    await this.em.nativeUpdate(ApiKey, { projectId: key.projectId } as any, {
      status: key.status,
      cooldownUntil: key.cooldownUntil,
      lastErrorMessage: `Project limit: ${errorMsg}`,
    });
    this.em.clear();
  }

  await this.em.persistAndFlush(key);
}

// Reset consecutive errors khi success
@CreateRequestContext()
async logUsage(keyId: string) {
  const key = await this.em.findOne(ApiKey, { id: keyId } as any);
  if (key) {
    key.usageCount++;
    key.todayUsage++;
    key.todayRpmUsage++;
    key.lastUsedAt = new Date();
    key.consecutiveErrors = 0; // ← THÊM: Reset khi thành công
    if (key.status === ApiKeyStatus.RATE_LIMITED) {
      key.status = ApiKeyStatus.ACTIVE;
    }
    await this.em.persistAndFlush(key);
  }
}
```

---

#### FIX 2: Notification khi Key bị ban/hết hạn (Ưu tiên 🔴)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/api-key.service.ts

private async notifyKeyDead(key: ApiKey) {
  // 1. Thông báo cho owner
  if (key.owner) {
    await this.notificationsService.create({
      userId: key.owner.id,
      type: NotificationType.SYSTEM_ALERT,
      title: `API Key "${key.label || key.provider}" không còn hoạt động`,
      message: `Key ${key.provider.toUpperCase()} của bạn đã bị ${
        key.errorType === 'invalid_key' ? 'vô hiệu hóa/revoke'
        : key.errorType === 'forbidden' ? 'cấm truy cập (403)'
        : 'lỗi nghiêm trọng'
      }. Lỗi: ${key.lastErrorMessage}. Vui lòng kiểm tra và cập nhật key tại /admin/settings/ai-keys`,
      metadata: {
        keyId: key.id,
        provider: key.provider,
        errorType: key.errorType,
      },
    });
  }

  // 2. Kiểm tra xem còn key nào khả dụng cho provider này không
  const remainingKeys = await this.em.count(ApiKey, {
    provider: key.provider,
    status: ApiKeyStatus.ACTIVE,
  } as any);

  if (remainingKeys === 0) {
    // CẢNH BÁO KHẨN: Provider này không còn key nào!
    // Gửi cho tất cả admin
    await this.notificationsService.createForAdmins({
      type: NotificationType.SYSTEM_CRITICAL,
      title: `⚠️ CẢNH BÁO: Provider ${key.provider.toUpperCase()} không còn API key khả dụng!`,
      message: `Tất cả API keys cho ${key.provider} đã bị vô hiệu hóa. Hệ thống AI sẽ tự động chuyển sang provider khác, nhưng cần bổ sung key mới sớm.`,
      metadata: { provider: key.provider },
    });
  }
}
```

---

#### FIX 3: Scheduled Health Check cho tất cả Keys (Ưu tiên 🟡)

```typescript
// File mới: erg-backend/src/modules/ai-content/services/api-key-health.service.ts

@Injectable()
export class ApiKeyHealthService {
  private readonly logger = new Logger(ApiKeyHealthService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly orm: MikroORM,
    private readonly providerFactory: AIProviderFactory,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Chạy mỗi 6 giờ: Kiểm tra sức khỏe tất cả API keys
   */
  @Cron('0 */6 * * *')
  @CreateRequestContext()
  async healthCheckAllKeys() {
    this.logger.log('Starting API Key Health Check...');

    const allKeys = await this.em.find(ApiKey, {} as any);
    const report: any[] = [];

    for (const key of allKeys) {
      // Skip keys đã bị đánh dấu INVALID/FORBIDDEN vĩnh viễn
      if (key.errorType === 'invalid_key' || key.errorType === 'forbidden') {
        report.push({ key: key.label, status: 'PERMANENTLY_DEAD', provider: key.provider });
        continue;
      }

      // Test key nếu đang ERROR hoặc đã lâu không dùng (>24h)
      const shouldTest = key.status === ApiKeyStatus.ERROR
        || !key.lastUsedAt
        || (Date.now() - key.lastUsedAt.getTime() > 24 * 3600 * 1000);

      if (shouldTest) {
        try {
          const decryptedKey = this.decrypt(key.key);
          const client = this.providerFactory.createClient(key.provider, decryptedKey);
          await client.generateText('Say OK', { maxTokens: 5 });

          // Key hoạt động → PHỤC HỒI
          if (key.status !== ApiKeyStatus.ACTIVE) {
            key.status = ApiKeyStatus.ACTIVE;
            key.consecutiveErrors = 0;
            key.lastErrorMessage = null;
            await this.em.persistAndFlush(key);
            this.logger.log(`Key "${key.label}" RECOVERED from ${key.status} → ACTIVE`);

            report.push({ key: key.label, status: 'RECOVERED', provider: key.provider });
          } else {
            report.push({ key: key.label, status: 'HEALTHY', provider: key.provider });
          }
        } catch (error) {
          report.push({ key: key.label, status: 'STILL_DOWN', error: error.message, provider: key.provider });
        }
      } else {
        report.push({ key: key.label, status: key.status, provider: key.provider });
      }
    }

    // Tổng hợp báo cáo
    const deadKeys = report.filter(r => ['PERMANENTLY_DEAD', 'STILL_DOWN'].includes(r.status));
    const recoveredKeys = report.filter(r => r.status === 'RECOVERED');

    if (deadKeys.length > 0) {
      this.logger.warn(`Health Check: ${deadKeys.length} keys still down.`);
    }
    if (recoveredKeys.length > 0) {
      this.logger.log(`Health Check: ${recoveredKeys.length} keys recovered!`);
    }

    return report;
  }

  /**
   * Daily reset: Chạy lúc 00:01 mỗi ngày
   */
  @Cron('1 0 * * *')
  @CreateRequestContext()
  async dailyReset() {
    this.logger.log('Running daily API key usage reset...');

    // Reset todayUsage cho tất cả keys
    await this.em.nativeUpdate(ApiKey, {} as any, {
      todayUsage: 0,
      todayRpmUsage: 0,
    });

    // Reset QUOTA_EXCEEDED → ACTIVE (quota mới mỗi ngày)
    await this.em.nativeUpdate(
      ApiKey,
      { status: ApiKeyStatus.QUOTA_EXCEEDED } as any,
      { status: ApiKeyStatus.ACTIVE }
    );

    this.logger.log('Daily reset completed.');
  }
}
```

---

#### FIX 4: API Key Dashboard (Ưu tiên 🟡)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/ai-content.controller.ts (thêm endpoints)

@Get('keys/dashboard')
@Permissions('system.admin')
async getKeyDashboard() {
  return this.apiKeyService.getDashboard();
}

@Post('keys/:id/test')
@Permissions('system.admin')
async testKey(@Param('id') id: string) {
  return this.apiKeyService.testKey(id);
}

@Post('keys/:id/reactivate')
@Permissions('system.admin')
async reactivateKey(@Param('id') id: string) {
  return this.apiKeyService.reactivateKey(id);
}
```

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/api-key.service.ts (thêm methods)

@CreateRequestContext()
async getDashboard() {
  const allKeys = await this.em.find(ApiKey, {} as any, {
    fields: ['id', 'label', 'provider', 'type', 'status', 'errorType',
             'usageCount', 'todayUsage', 'todayRpmUsage', 'rpmLimit', 'rpdLimit',
             'lastUsedAt', 'lastErrorAt', 'lastErrorMessage', 'cooldownUntil',
             'priority', 'consecutiveErrors'],
    orderBy: { provider: 'ASC', priority: 'DESC' },
  });

  // Group by provider
  const byProvider = {};
  for (const key of allKeys) {
    if (!byProvider[key.provider]) {
      byProvider[key.provider] = { keys: [], totalUsage: 0, activeCount: 0, deadCount: 0 };
    }
    byProvider[key.provider].keys.push(key);
    byProvider[key.provider].totalUsage += key.todayUsage;
    if (key.status === ApiKeyStatus.ACTIVE) byProvider[key.provider].activeCount++;
    else byProvider[key.provider].deadCount++;
  }

  return {
    totalKeys: allKeys.length,
    activeKeys: allKeys.filter(k => k.status === ApiKeyStatus.ACTIVE).length,
    rateLimitedKeys: allKeys.filter(k => k.status === ApiKeyStatus.RATE_LIMITED).length,
    quotaExceededKeys: allKeys.filter(k => k.status === ApiKeyStatus.QUOTA_EXCEEDED).length,
    errorKeys: allKeys.filter(k => k.status === ApiKeyStatus.ERROR).length,
    byProvider,
    alerts: this.generateAlerts(allKeys),
  };
}

private generateAlerts(keys: ApiKey[]) {
  const alerts: string[] = [];

  // Cảnh báo provider không còn key
  const providers = [...new Set(keys.map(k => k.provider))];
  for (const provider of providers) {
    const activeKeys = keys.filter(k => k.provider === provider && k.status === ApiKeyStatus.ACTIVE);
    if (activeKeys.length === 0) {
      alerts.push(`⚠️ Provider ${provider.toUpperCase()} không còn key khả dụng!`);
    } else if (activeKeys.length === 1) {
      alerts.push(`⚡ Provider ${provider.toUpperCase()} chỉ còn 1 key hoạt động.`);
    }
  }

  // Cảnh báo key gần hết quota
  for (const key of keys) {
    if (key.status === ApiKeyStatus.ACTIVE && key.todayUsage > key.rpdLimit * 0.8) {
      alerts.push(`📊 Key "${key.label}" (${key.provider}) đã dùng ${key.todayUsage}/${key.rpdLimit} RPD (${Math.round(key.todayUsage/key.rpdLimit*100)}%)`);
    }
  }

  return alerts;
}

@CreateRequestContext()
async testKey(keyId: string) {
  const key = await this.em.findOne(ApiKey, { id: keyId } as any);
  if (!key) throw new NotFoundException('Key not found');

  try {
    const decryptedKey = this.decrypt(key.key);
    const client = this.providerFactory.createClient(key.provider, decryptedKey);
    const startTime = Date.now();
    await client.generateText('Say OK', { maxTokens: 5 });
    const latency = Date.now() - startTime;

    return {
      success: true,
      latencyMs: latency,
      message: `Key hoạt động bình thường (${latency}ms)`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Key không hoạt động: ${error.message}`,
    };
  }
}

@CreateRequestContext()
async reactivateKey(keyId: string) {
  const key = await this.em.findOne(ApiKey, { id: keyId } as any);
  if (!key) throw new NotFoundException('Key not found');

  // Test trước khi reactivate
  const testResult = await this.testKey(keyId);
  if (!testResult.success) {
    throw new BadRequestException(`Không thể kích hoạt lại: ${testResult.error}`);
  }

  key.status = ApiKeyStatus.ACTIVE;
  key.consecutiveErrors = 0;
  key.lastErrorMessage = null;
  key.cooldownUntil = null;
  await this.em.persistAndFlush(key);

  return { message: 'Key đã được kích hoạt lại thành công', key };
}
```

---

#### FIX 5: Thêm fields mới vào ApiKey Entity (Ưu tiên 🟡)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/entities/api-key.entity.ts

@Entity({ tableName: 'api_keys' })
export class ApiKey extends BaseEntity {
  // ... existing fields ...

  /** Loại lỗi chi tiết */
  @Property({ nullable: true })
  errorType?: string; // 'invalid_key', 'forbidden', 'server_error', 'network_error', 'unknown'

  /** Số lần lỗi liên tiếp */
  @Property({ default: 0 })
  consecutiveErrors: number = 0;

  /** Model cụ thể (override default) */
  @Property({ nullable: true })
  model?: string;

  /** Custom endpoint */
  @Property({ nullable: true })
  customEndpoint?: string;

  /** Ngày hết hạn key (nếu có) */
  @Property({ nullable: true })
  expiresAt?: Date;

  /** Ghi chú nội bộ */
  @Property({ type: 'text', nullable: true })
  notes?: string;

  /** Chi phí ước tính (USD) tích lũy */
  @Property({ type: 'float', default: 0 })
  estimatedCostUsd: number = 0;
}
```

---

#### FIX 6: Tối ưu `checkAndResetDailyUsage()` (Ưu tiên 🟡)

**Vấn đề:** Hiện tại mỗi lần `getAvailableKey()` gọi `checkAndResetDailyUsage()` cho từng key → mỗi key có thể gây 1-2 DB writes.

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/api-key.service.ts

// THAY ĐỔI: Dùng batch update thay vì individual writes
async checkAndResetDailyUsage(key: ApiKey): Promise<boolean> {
  const now = new Date();
  let needsFlush = false;

  // RPM reset (60s)
  const lastMinute = key.lastMinuteReset || new Date(0);
  if (now.getTime() - lastMinute.getTime() > 60000) {
    key.todayRpmUsage = 0;
    key.lastMinuteReset = now;
    needsFlush = true;
  }

  // Daily reset
  const lastUsed = key.lastUsedAt || new Date(0);
  if (now.toDateString() !== lastUsed.toDateString()) {
    key.todayUsage = 0;
    if (key.status === ApiKeyStatus.QUOTA_EXCEEDED) {
      key.status = ApiKeyStatus.ACTIVE;
    }
    needsFlush = true;
  }

  // KHÔNG flush ngay — để caller quyết định
  // Trả về flag để caller biết cần flush
  return needsFlush;
}

// Trong getAvailableKey():
async getAvailableKey(user: User, provider: AIProviderType): Promise<ApiKey> {
  const keys = await this.em.find(ApiKey, { /* ... */ });

  let dirtyKeys: ApiKey[] = [];

  for (const key of keys) {
    const needsFlush = await this.checkAndResetDailyUsage(key);
    if (needsFlush) dirtyKeys.push(key);
    // ... check conditions ...
  }

  // Flush tất cả dirty keys 1 lần duy nhất
  if (dirtyKeys.length > 0) {
    await this.em.flush();
  }

  // ... return available key ...
}
```

### 6.3. Kiến trúc tổng thể sau tối ưu

```
                    ┌──────────────────────────────────────┐
                    │        API Key Dashboard              │
                    │  ┌──────┐ ┌──────┐ ┌──────┐         │
                    │  │Active│ │R.Lim │ │Error │ Alerts   │
                    │  │  12  │ │   3  │ │   1  │ ⚠️ 2    │
                    │  └──────┘ └──────┘ └──────┘         │
                    └──────────────────┬───────────────────┘
                                       │
    ┌──────────────────────────────────┼──────────────────────────────────┐
    │                                  │                                  │
    ▼                                  ▼                                  ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ Content Pool │              │   SEO Pool   │              │ Health Check │
│ (all keys)   │              │ (free keys)  │              │ (every 6h)   │
│              │              │              │              │              │
│ Token Bucket │              │ Token Bucket │              │ Test & Recover│
│ cost=1       │              │ cost=2       │              │ keys          │
│ 25 RPM       │              │ 10 RPM       │              │              │
└──────┬───────┘              └──────┬───────┘              └──────┬───────┘
       │                              │                              │
       ▼                              ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         ApiKeyService                                    │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ Smart Error      │  │ Auto-Recover    │  │ Notification           │ │
│  │ Classification   │  │ (network/server)│  │ (key dead, no keys)    │ │
│  │ 401→DEAD         │  │ 500→retry 5min  │  │ Alert admin            │ │
│  │ 429→cooldown 60s │  │ timeout→2min    │  │ Dashboard alerts       │ │
│  │ 5xx→cooldown 5m  │  │ 5 fails→ERROR   │  │ Usage warnings (>80%) │ │
│  └──────────────────┘  └─────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.4. Checklist triển khai Mục 6

- [ ] Thêm `errorType`, `consecutiveErrors`, `model`, `expiresAt`, `notes`, `estimatedCostUsd` vào ApiKey entity + migration
- [ ] Cải thiện `reportError()` với phân loại lỗi chi tiết (6 loại)
- [ ] Tạo `notifyKeyDead()` gửi notification khi key bị ban/vô hiệu
- [ ] Cảnh báo khi provider hết key khả dụng (notify tất cả admin)
- [ ] Tạo `ApiKeyHealthService` với scheduled health check (mỗi 6h)
- [ ] Tạo `dailyReset()` cron job lúc 00:01 reset usage + quota
- [ ] Tạo API endpoints: `/keys/dashboard`, `/keys/:id/test`, `/keys/:id/reactivate`
- [ ] Tối ưu `checkAndResetDailyUsage()` → batch flush thay vì individual writes
- [ ] Reset `consecutiveErrors` khi `logUsage()` thành công
- [ ] Tạo Frontend dashboard page `/admin/settings/ai-keys/dashboard`
- [ ] Thêm validate API key khi thêm mới (test call nhẹ)

---

## TỔNG KẾT ƯU TIÊN TRIỂN KHAI

### Ưu tiên CAO (Nên làm ngay) 🔴

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 1 | Chuyển Throttler sang Redis Storage | Mục 1 | 1h |
| 2 | Thêm body size limit + request timeout | Mục 1 | 30m |
| 3 | Validate API key khi thêm mới | Mục 4 | 2h |
| 4 | Notification khi key bị ban/hết quota | Mục 6 | 2h |
| 5 | Phân loại lỗi chi tiết + auto-recover | Mục 6 | 3h |
| 6 | Tạo SEO AI queue riêng biệt | Mục 5 | 4h |

### Ưu tiên TRUNG BÌNH (Sprint sau) 🟡

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 7 | IP Blocking Middleware | Mục 1 | 3h |
| 8 | Gộp SEO AI calls thành 1 call | Mục 2 | 2h |
| 9 | Batch query duplicate detection | Mục 2 | 2h |
| 10 | Tách prompt templates | Mục 4 | 3h |
| 11 | API Key Dashboard + Health Check | Mục 6 | 4h |
| 12 | Tạo Token Bucket rate limiter | Mục 5 | 3h |
| 13 | Image processing song song | Mục 2 | 2h |

### Ưu tiên THẤP (Backlog) 🟢

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 14 | Hidden Category system | Mục 3 | 6h |
| 15 | Nâng cấp ImageGenService multi-provider | Mục 4 | 3h |
| 16 | Abuse Detection Service | Mục 1 | 4h |
| 17 | Dead Letter Queue | Mục 2 | 2h |
| 18 | CSP + Swagger ẩn ở production | Mục 1 | 1h |
| 19 | Cost estimation tracking | Mục 6 | 2h |

**Tổng estimated effort: ~47 giờ (~6 ngày dev)**

---

## 7. AI IMAGE GENERATION TỪ API KEY HIỆN CÓ (BỔ SUNG)

### 7.1. Ý tưởng

Hiện tại `ImageGenService` **chỉ dùng Cloudflare AI** (free tier, model `flux-1-schnell`). Nhưng nhiều provider AI mà hệ thống đã có key cũng hỗ trợ tạo ảnh:

| Provider | Image API | Model | Cùng API Key? | Chất lượng |
|----------|-----------|-------|---------------|------------|
| **Gemini** | `generateContent` với `imagen-3.0-generate-002` | Imagen 3 | **Có** ✅ | Cao |
| **OpenAI** | `/v1/images/generations` | DALL-E 3 | **Có** ✅ | Rất cao |
| **Groq** | Không hỗ trợ | - | - | - |
| **Claude** | Không hỗ trợ image gen | - | - | - |
| **Together** | `/v1/images/generations` | FLUX.1 | **Có** ✅ | Cao |
| **DeepSeek** | Không hỗ trợ | - | - | - |
| **Cloudflare** | Workers AI | flux-1-schnell | Key riêng | Trung bình |
| **Pollinations** | Free HTTP API | FLUX | Không cần key | Trung bình |

**Kết luận:** Gemini, OpenAI, Together đều dùng được **cùng API key hiện tại** cho image gen. Cloudflare chỉ là fallback cuối.

### 7.2. Thiết kế mới cho ImageGenService

#### A. Mở rộng interface `IAIClient`

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/providers/ai-provider.interface.ts

export interface IAIClient {
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;

  // THÊM: Image generation (optional - không phải provider nào cũng có)
  generateImage?(prompt: string, options?: AIImageOptions): Promise<Buffer>;

  // THÊM: Check xem provider có hỗ trợ image không
  supportsImageGeneration?(): boolean;
}

export interface AIImageOptions {
  width?: number;   // default 1200
  height?: number;  // default 630 (blog thumbnail ratio)
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  model?: string;   // override model
}
```

#### B. Thêm Image Gen vào GeminiClient

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/providers/gemini.client.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIClient, AIGenerateOptions, AIImageOptions } from './ai-provider.interface';

export class GeminiClient implements IAIClient {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.apiKey = apiKey;
  }

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    // ... existing code ...
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
    // Gemini Imagen 3 API
    // Dùng REST API trực tiếp vì SDK chưa hỗ trợ đầy đủ imagen
    const model = options?.model || 'imagen-3.0-generate-002';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',       // Blog-friendly ratio
          safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE',
          personGeneration: 'DONT_ALLOW', // Tránh vấn đề bản quyền khuôn mặt
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Imagen failed: ${response.status} - ${err}`);
    }

    const result = await response.json();
    const imageData = result.predictions?.[0]?.bytesBase64Encoded;
    if (!imageData) throw new Error('Gemini Imagen: No image data returned');

    return Buffer.from(imageData, 'base64');
  }
}
```

#### C. Thêm Image Gen vào OpenAIClient

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/providers/openai.client.ts

export class OpenAIClient implements IAIClient {
  private apiKey: string;
  // ... existing ...

  supportsImageGeneration(): boolean {
    return true;
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<Buffer> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'dall-e-3',
        prompt,
        n: 1,
        size: `${options?.width || 1792}x${options?.height || 1024}`,
        quality: options?.quality || 'standard',
        style: options?.style || 'natural',
        response_format: 'b64_json', // Trả về base64 thay vì URL
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI DALL-E failed: ${err?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI DALL-E: No image data');

    return Buffer.from(b64, 'base64');
  }
}
```

#### D. Nâng cấp ImageGenService với Multi-Provider Chain

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/services/image-gen.service.ts

@Injectable()
export class ImageGenService {
  private readonly logger = new Logger(ImageGenService.name);

  constructor(
    private configService: ConfigService,
    private apiKeyService: ApiKeyService,
    private providerFactory: AIProviderFactory,
    private providerHealthService: ProviderHealthService,
  ) {}

  /**
   * Generate image với fallback chain:
   * 1. AI Provider hiện có (Gemini/OpenAI/Together) — cùng key pool
   * 2. Cloudflare AI — key riêng
   * 3. Pollinations — miễn phí, không cần key
   */
  async generateImage(prompt: string, user: User, options?: AIImageOptions): Promise<Buffer> {
    // ===== PHASE 1: Thử các AI provider có sẵn key =====
    const imageCapableProviders = [
      AIProviderType.GEMINI,    // Imagen 3
      AIProviderType.OPENAI,    // DALL-E 3
      AIProviderType.TOGETHER,  // FLUX.1
    ];

    for (const provider of imageCapableProviders) {
      try {
        const keyEntity = await this.apiKeyService.getAvailableKey(user, provider);
        const client = this.providerFactory.createClient(provider, keyEntity.key);

        if (!client.supportsImageGeneration?.()) continue;

        this.logger.log(`Generating image with ${provider}...`);
        const startTime = Date.now();
        const buffer = await client.generateImage!(prompt, options);

        // Track usage
        await this.apiKeyService.logUsage(keyEntity.id);
        await this.providerHealthService.recordSuccess(provider, Date.now() - startTime);

        this.logger.log(`Image generated by ${provider} in ${Date.now() - startTime}ms`);
        return buffer;

      } catch (error) {
        this.logger.warn(`Image gen with ${provider} failed: ${error.message}`);
        // Không report error cho key vì image gen fail không ảnh hưởng text gen
      }
    }

    // ===== PHASE 2: Fallback Cloudflare AI =====
    try {
      this.logger.log('Falling back to Cloudflare AI for image...');
      return await this.generateCloudflare(prompt);
    } catch (cfError) {
      this.logger.warn(`Cloudflare image gen failed: ${cfError.message}`);
    }

    // ===== PHASE 3: Fallback Pollinations (miễn phí) =====
    try {
      this.logger.log('Falling back to Pollinations.ai for image...');
      return await this.generatePollinations(prompt);
    } catch (pollError) {
      this.logger.error(`All image providers failed: ${pollError.message}`);
      throw new Error('All image generation providers are unavailable');
    }
  }

  private async generateCloudflare(prompt: string): Promise<Buffer> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const token = this.configService.get<string>('CLOUDFLARE_API_TOKEN');

    if (!accountId || !token) throw new Error('Cloudflare credentials not configured');

    const model = '@cf/black-forest-labs/flux-1-schnell';
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, num_steps: 8 }),
      }
    );

    if (!response.ok) throw new Error(`Cloudflare: ${response.statusText}`);
    const result = await response.json();
    if (result.success && result.result?.image) {
      return Buffer.from(result.result.image, 'base64');
    }
    throw new Error('Cloudflare response missing image data');
  }

  private async generatePollinations(prompt: string): Promise<Buffer> {
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&nologo=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pollinations: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

#### E. Cập nhật AI Generation Processor

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts

// TRƯỚC:
const thumbBuffer = await this.imageGenService.generateImage(finalThumbPrompt);

// SAU: Truyền thêm user để ImageGenService dùng key pool của user
const thumbBuffer = await this.imageGenService.generateImage(
  finalThumbPrompt,
  user,              // ← User để lấy API key
  { width: 1200, height: 630, quality: 'standard' }
);
```

### 7.3. Thứ tự ưu tiên Image Provider

```
┌──────────────────────────────────────────────────────┐
│              Image Generation Chain                    │
│                                                        │
│  Priority 1: Gemini Imagen 3                           │
│  ├── Dùng chung API key pool                          │
│  ├── Chất lượng cao, nhanh                            │
│  └── Free tier: 50 ảnh/ngày                           │
│                                                        │
│  Priority 2: OpenAI DALL-E 3                           │
│  ├── Dùng chung API key pool                          │
│  ├── Chất lượng rất cao                               │
│  └── Tốn phí: ~$0.04/ảnh (standard)                  │
│                                                        │
│  Priority 3: Together AI (FLUX.1)                      │
│  ├── Dùng chung API key pool                          │
│  ├── Chất lượng cao                                   │
│  └── Giá tốt: ~$0.01/ảnh                             │
│                                                        │
│  Fallback 1: Cloudflare AI (flux-1-schnell)            │
│  ├── Key riêng (CLOUDFLARE_API_TOKEN)                 │
│  ├── Free tier                                         │
│  └── Chất lượng trung bình                            │
│                                                        │
│  Fallback 2: Pollinations.ai                           │
│  ├── Hoàn toàn miễn phí, không cần key                │
│  ├── Chất lượng trung bình                            │
│  └── Rate limit không rõ ràng                          │
└──────────────────────────────────────────────────────┘
```

### 7.4. Checklist triển khai Mục 7

- [ ] Mở rộng `IAIClient` interface thêm `generateImage()` và `supportsImageGeneration()`
- [ ] Thêm `AIImageOptions` interface
- [ ] Implement `generateImage()` trong `GeminiClient` (Imagen 3 API)
- [ ] Implement `generateImage()` trong `OpenAIClient` (DALL-E 3)
- [ ] Tạo `TogetherImageClient` hoặc thêm vào `OpenAICompatibleClient`
- [ ] Nâng cấp `ImageGenService` với 5-level fallback chain
- [ ] Truyền `user` vào `ImageGenService.generateImage()` để dùng key pool
- [ ] Cập nhật `ai-generation.processor.ts` truyền user cho image gen
- [ ] Thêm Pollinations.ai làm fallback cuối cùng (miễn phí)
- [ ] Test: Tạo bài với ảnh từ Gemini, fallback sang Cloudflare

---

## 8. CẢI THIỆN HỆ THỐNG NOTIFICATION CHO JOBS (BỔ SUNG)

### 8.1. Hiện trạng

#### Đã có:
- **Entity:** `Notification` (MongoDB) với 5 types: `AI_POST_COMPLETED`, `AI_POST_FAILED`, `CRAWL_COMPLETED`, `CRAWL_FAILED`, `CRAWL_BATCH_COMPLETED`
- **Service:** CRUD cơ bản (create, findByUser, markAsRead, markAllAsRead, delete)
- **Frontend:** `NotificationBell` dropdown với icon theo type, polling 30s
- **Sử dụng:** Chỉ gửi notification khi **AI post failed** và **crawl publish failed**

#### Vấn đề:

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | **Không gửi noti khi thành công** — user không biết bài AI/crawl đã xong | 🔴 |
| 2 | **Không có batch summary** — crawl 50 bài → không có tổng kết | 🔴 |
| 3 | **Không có system-level alerts** — key hết quota, provider down → ai biết? | 🟡 |
| 4 | **Không có `createForAdmins()`** — chỉ gửi cho 1 user cụ thể | 🟡 |
| 5 | **Thiếu notification types** — không có SYSTEM_ALERT, SYSTEM_CRITICAL, KEY_EXPIRED | 🟡 |
| 6 | **Không có action buttons** — click noti chỉ navigate tới post, không có "Retry", "View Log" | 🟢 |
| 7 | **Không có auto-cleanup** — notifications cũ không bị xóa → MongoDB phình to | 🟢 |

### 8.2. Đề xuất cải thiện

#### FIX 1: Bổ sung Notification Types (Ưu tiên 🔴)

```typescript
// File cần sửa: erg-backend/src/modules/notifications/entities/notification.entity.ts

export enum NotificationType {
    // === AI Content ===
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',       // Tạo bài AI thành công
    AI_POST_FAILED = 'AI_POST_FAILED',             // Tạo bài AI thất bại
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',     // ← MỚI: Batch AI hoàn tất

    // === Crawler ===
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',           // Crawl 1 bài thành công
    CRAWL_FAILED = 'CRAWL_FAILED',                 // Crawl 1 bài thất bại
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED', // Batch crawl RSS hoàn tất

    // === System Alerts === (MỚI)
    SYSTEM_ALERT = 'SYSTEM_ALERT',                 // Cảnh báo hệ thống (key gần hết quota)
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',           // Cảnh báo khẩn (provider down, hết key)
    KEY_EXPIRED = 'KEY_EXPIRED',                   // API Key hết hạn/bị ban
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',        // Key dùng >80% quota

    // === SEO === (MỚI)
    SEO_COMPLETED = 'SEO_COMPLETED',               // SEO optimization xong
    SEO_FAILED = 'SEO_FAILED',                     // SEO optimization thất bại
}

// THÊM: Priority levels
export enum NotificationPriority {
    LOW = 'LOW',           // Info, thành công bình thường
    MEDIUM = 'MEDIUM',     // Cảnh báo, partial failure
    HIGH = 'HIGH',         // Lỗi quan trọng
    CRITICAL = 'CRITICAL', // Hệ thống gặp sự cố nghiêm trọng
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
    priority: NotificationPriority = NotificationPriority.LOW;  // ← MỚI

    @Property()
    title!: string;

    @Property()
    message!: string;

    @Property({ nullable: true })
    metadata?: any;

    @Property({ nullable: true })
    readAt?: Date;

    /** Action URL — click notification sẽ navigate tới đây */
    @Property({ nullable: true })
    actionUrl?: string;  // ← MỚI: VD: '/admin/posts/123', '/admin/crawler'

    /** Actions có thể thực hiện */
    @Property({ type: 'json', nullable: true })
    actions?: { label: string; url: string; type: 'link' | 'api' }[];  // ← MỚI
}
```

#### FIX 2: Gửi Notification khi Job thành công (Ưu tiên 🔴)

```typescript
// File cần sửa: erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts

private async handleGeneratePost(job: Job<any>): Promise<any> {
  // ... existing generate logic ...

  // KHI THÀNH CÔNG:
  await this.notificationsService.create({
    userId: userId,
    type: NotificationType.AI_POST_COMPLETED,
    priority: NotificationPriority.LOW,
    title: 'Bài viết AI đã tạo thành công',
    message: `Bài "${aiData.title}" đã được tạo và lưu dưới dạng ${autoPublish ? 'Published' : 'Draft'}.`,
    actionUrl: `/admin/posts/${newPost.id}`,
    metadata: {
      postId: newPost.id,
      title: aiData.title,
      slug: newPost.slug,
      topic,
      categoryId,
      provider: usedProvider,      // Provider nào đã dùng
      generationTimeMs: totalTime, // Thời gian tạo
      imageCount: imageResults.filter(r => r.imgHtml).length,
    },
    actions: [
      { label: 'Xem bài viết', url: `/admin/posts/${newPost.id}`, type: 'link' },
      { label: 'Chỉnh sửa', url: `/admin/posts/${newPost.id}/edit`, type: 'link' },
    ],
  });

  // KHI THẤT BẠI (đã có, nhưng cải thiện):
  // ... catch block ...
  await this.notificationsService.create({
    userId: userId,
    type: NotificationType.AI_POST_FAILED,
    priority: NotificationPriority.HIGH,
    title: 'Tạo bài viết AI thất bại',
    message: `Không thể tạo bài về "${topic}": ${error.message}`,
    actionUrl: '/admin/posts/ai-batch',
    metadata: {
      jobId: job.id,
      topic,
      error: error.message,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    },
    actions: [
      { label: 'Thử lại', url: '/admin/posts/ai-batch', type: 'link' },
      { label: 'Xem logs', url: `/admin/system/jobs/${job.id}`, type: 'link' },
    ],
  });
}
```

#### FIX 3: Notification cho Crawl Pipeline (Ưu tiên 🔴)

```typescript
// File cần sửa: erg-backend/src/modules/crawler/processors/publish.processor.ts

async process(job: Job<any>): Promise<any> {
  // ... existing publish logic ...

  // KHI THÀNH CÔNG:
  await this.notificationsService.create({
    userId: admin.id,
    type: NotificationType.CRAWL_COMPLETED,
    priority: NotificationPriority.LOW,
    title: 'Cào bài viết thành công',
    message: `"${title}" từ ${new URL(url).hostname} → ${autoPublish ? 'Published' : 'Draft'}`,
    actionUrl: `/admin/posts/${post.id}`,
    metadata: {
      postId: post.id,
      title,
      sourceUrl: url,
      rssId,
      autoPublish,
      pipelineStages: ['DISCOVERY', 'SCRAPE', 'PROCESS', 'SEO', 'PUBLISH'],
    },
    actions: [
      { label: 'Xem bài viết', url: `/admin/posts/${post.id}`, type: 'link' },
    ],
  });

  // KHI THẤT BẠI (cải thiện notification hiện tại):
  await this.notificationsService.create({
    userId: admin.id,
    type: NotificationType.CRAWL_FAILED,
    priority: NotificationPriority.HIGH,
    title: 'Cào bài viết thất bại',
    message: `Không thể crawl: ${url}. Lỗi ở bước ${rawContent.error?.step || 'PUBLISH'}: ${error.message}`,
    actionUrl: '/admin/crawler',
    metadata: {
      url,
      rssId,
      failedStep: rawContent.error?.step || 'PUBLISH',
      error: error.message,
      rawId,
    },
    actions: [
      { label: 'Xem Pipeline', url: '/admin/crawler', type: 'link' },
      { label: 'Thử lại URL', url: `/admin/crawler?retry=${encodeURIComponent(url)}`, type: 'link' },
    ],
  });
}
```

#### FIX 4: Batch Summary Notification (Ưu tiên 🔴)

```typescript
// File mới: erg-backend/src/modules/crawler/services/crawl-batch-tracker.service.ts

@Injectable()
export class CrawlBatchTrackerService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Ghi nhận 1 job hoàn thành trong batch
   */
  async trackJobCompletion(rssId: string, result: {
    url: string;
    success: boolean;
    postId?: string;
    error?: string;
  }) {
    const batchKey = `crawl_batch:${rssId}`;
    const batch = await this.cache.get<CrawlBatchState>(batchKey) || {
      rssId,
      startedAt: Date.now(),
      totalJobs: 0,
      completedJobs: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
    };

    batch.completedJobs++;
    if (result.success) batch.successCount++;
    else batch.failedCount++;
    batch.results.push(result);

    await this.cache.set(batchKey, batch, 3600 * 1000); // TTL 1 giờ

    // Nếu tất cả jobs đã xong → gửi summary notification
    if (batch.completedJobs >= batch.totalJobs && batch.totalJobs > 0) {
      await this.sendBatchSummary(batch);
    }
  }

  /**
   * Đăng ký số lượng jobs trong batch
   */
  async registerBatch(rssId: string, totalJobs: number) {
    const batchKey = `crawl_batch:${rssId}`;
    await this.cache.set(batchKey, {
      rssId,
      startedAt: Date.now(),
      totalJobs,
      completedJobs: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
    }, 3600 * 1000);
  }

  private async sendBatchSummary(batch: CrawlBatchState) {
    const duration = Math.round((Date.now() - batch.startedAt) / 1000);

    await this.notificationsService.create({
      userId: 'admin', // TODO: Lấy admin ID thực
      type: NotificationType.CRAWL_BATCH_COMPLETED,
      priority: batch.failedCount > 0
        ? NotificationPriority.MEDIUM
        : NotificationPriority.LOW,
      title: `RSS Crawl hoàn tất: ${batch.successCount}/${batch.totalJobs} thành công`,
      message: [
        `Thành công: ${batch.successCount} bài`,
        batch.failedCount > 0 ? `Thất bại: ${batch.failedCount} bài` : null,
        `Thời gian: ${duration}s`,
      ].filter(Boolean).join(' | '),
      actionUrl: '/admin/crawler',
      metadata: {
        rssId: batch.rssId,
        totalJobs: batch.totalJobs,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        durationSeconds: duration,
        failedUrls: batch.results.filter(r => !r.success).map(r => ({
          url: r.url,
          error: r.error,
        })),
        successPosts: batch.results.filter(r => r.success).map(r => ({
          url: r.url,
          postId: r.postId,
        })),
      },
    });
  }
}

interface CrawlBatchState {
  rssId: string;
  startedAt: number;
  totalJobs: number;
  completedJobs: number;
  successCount: number;
  failedCount: number;
  results: { url: string; success: boolean; postId?: string; error?: string }[];
}
```

#### FIX 5: Thêm `createForAdmins()` vào NotificationsService (Ưu tiên 🟡)

```typescript
// File cần sửa: erg-backend/src/modules/notifications/notifications.service.ts

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification, 'mongo-connection')
    private readonly notificationRepo: EntityRepository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: EntityRepository<User>,
  ) {}

  // ... existing methods ...

  /**
   * MỚI: Gửi notification cho tất cả admin/super-admin
   */
  async createForAdmins(data: {
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    metadata?: any;
    actionUrl?: string;
    actions?: { label: string; url: string; type: 'link' | 'api' }[];
  }): Promise<Notification[]> {
    const em = this.userRepo.getEntityManager().fork();

    // Tìm tất cả users có role Admin hoặc Super Admin
    const adminUsers = await em.find(User, {
      roles: { name: { $in: ['Admin', 'Super Admin'] } },
    }, { populate: ['roles'] });

    const notifications: Notification[] = [];

    for (const admin of adminUsers) {
      const noti = await this.create({
        userId: admin.id,
        ...data,
      });
      notifications.push(noti);
    }

    this.logger.log(`Created ${notifications.length} admin notifications: ${data.title}`);
    return notifications;
  }

  /**
   * MỚI: Auto-cleanup notifications cũ hơn 30 ngày
   */
  @Cron('0 3 * * *') // Chạy lúc 3h sáng mỗi ngày
  async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const oldNotifications = await this.notificationRepo.find({
      createdAt: { $lt: thirtyDaysAgo },
      status: NotificationStatus.READ,
    });

    if (oldNotifications.length > 0) {
      await this.notificationRepo.getEntityManager().removeAndFlush(oldNotifications);
      this.logger.log(`Cleaned up ${oldNotifications.length} old notifications`);
    }
  }
}
```

#### FIX 6: Cập nhật Frontend NotificationBell (Ưu tiên 🟡)

```typescript
// File cần sửa: erg/src/components/admin/NotificationBell.tsx

// Thêm icons cho notification types mới
import { Bell, CheckCircle, XCircle, Globe, AlertTriangle, X, Check,
         Shield, Key, Search, Zap } from "lucide-react"

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case NotificationType.AI_POST_COMPLETED:
            return <CheckCircle className="h-5 w-5 text-green-500" />
        case NotificationType.AI_POST_FAILED:
            return <XCircle className="h-5 w-5 text-red-500" />
        case NotificationType.AI_BATCH_COMPLETED:
            return <Zap className="h-5 w-5 text-purple-500" />
        case NotificationType.CRAWL_COMPLETED:
            return <Globe className="h-5 w-5 text-blue-500" />
        case NotificationType.CRAWL_FAILED:
            return <AlertTriangle className="h-5 w-5 text-orange-500" />
        case NotificationType.CRAWL_BATCH_COMPLETED:
            return <CheckCircle className="h-5 w-5 text-blue-500" />
        case NotificationType.SYSTEM_ALERT:
            return <Shield className="h-5 w-5 text-yellow-500" />
        case NotificationType.SYSTEM_CRITICAL:
            return <Shield className="h-5 w-5 text-red-600 animate-pulse" />
        case NotificationType.KEY_EXPIRED:
        case NotificationType.KEY_QUOTA_WARNING:
            return <Key className="h-5 w-5 text-orange-500" />
        case NotificationType.SEO_COMPLETED:
            return <Search className="h-5 w-5 text-green-500" />
        case NotificationType.SEO_FAILED:
            return <Search className="h-5 w-5 text-red-500" />
        default:
            return <Bell className="h-5 w-5 text-gray-500" />
    }
}

// Thêm priority indicator
const getPriorityBorder = (priority?: string) => {
    switch (priority) {
        case 'CRITICAL': return 'border-l-4 border-l-red-500'
        case 'HIGH': return 'border-l-4 border-l-orange-500'
        case 'MEDIUM': return 'border-l-4 border-l-yellow-400'
        default: return ''
    }
}

// Thêm action buttons vào NotificationItem
const NotificationItem = ({ notification, ... }: NotificationItemProps) => {
    return (
        <div className={cn(
            "group relative p-4 border-b transition-all hover:bg-muted/50 cursor-pointer",
            isUnread ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200",
            getPriorityBorder(notification.priority),  // ← MỚI
        )}>
            {/* ... existing content ... */}

            {/* MỚI: Action buttons */}
            {notification.actions && notification.actions.length > 0 && (
                <div className="flex gap-2 mt-2">
                    {notification.actions.map((action, idx) => (
                        <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                                e.stopPropagation()
                                router.push(action.url)
                            }}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    )
}
```

#### FIX 7: Frontend types cập nhật

```typescript
// File cần sửa: erg/src/types/notification.ts

export enum NotificationType {
    AI_POST_COMPLETED = 'AI_POST_COMPLETED',
    AI_POST_FAILED = 'AI_POST_FAILED',
    AI_BATCH_COMPLETED = 'AI_BATCH_COMPLETED',
    CRAWL_COMPLETED = 'CRAWL_COMPLETED',
    CRAWL_FAILED = 'CRAWL_FAILED',
    CRAWL_BATCH_COMPLETED = 'CRAWL_BATCH_COMPLETED',
    SYSTEM_ALERT = 'SYSTEM_ALERT',
    SYSTEM_CRITICAL = 'SYSTEM_CRITICAL',
    KEY_EXPIRED = 'KEY_EXPIRED',
    KEY_QUOTA_WARNING = 'KEY_QUOTA_WARNING',
    SEO_COMPLETED = 'SEO_COMPLETED',
    SEO_FAILED = 'SEO_FAILED',
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export interface Notification {
    id: string
    userId: string
    type: NotificationType
    status: NotificationStatus
    priority: NotificationPriority
    title: string
    message: string
    metadata?: Record<string, any>
    actionUrl?: string
    actions?: { label: string; url: string; type: 'link' | 'api' }[]
    readAt?: string
    createdAt: string
    updatedAt: string
}
```

### 8.3. Tổng quan Notification Flow sau cải thiện

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT SOURCES                                 │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ AI Gen Post  │  Crawl       │  API Key     │  SEO Pipeline      │
│ ✅ Success   │  Pipeline    │  Manager     │                    │
│ ❌ Fail      │  ✅ per-URL  │  🔑 Expired  │  ✅ Optimized      │
│ 📊 Batch     │  ❌ per-URL  │  ⚠️ >80%     │  ❌ AI Failed      │
│              │  📊 Batch    │  🚨 No keys  │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴───────┬────────────┘
       │              │              │               │
       ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                NotificationsService                              │
│                                                                  │
│  create()           → Gửi cho 1 user cụ thể                    │
│  createForAdmins()  → Gửi cho tất cả admin/super-admin         │
│  cleanupOld()       → Auto xóa noti đã đọc >30 ngày            │
│                                                                  │
│  Priority: LOW → MEDIUM → HIGH → CRITICAL                       │
│  Actions: [{ label, url, type }]                                 │
│  ActionUrl: Navigate khi click notification                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Frontend NotificationBell                          │
│                                                                  │
│  🔴 CRITICAL  → Viền đỏ + pulse animation                      │
│  🟠 HIGH      → Viền cam                                        │
│  🟡 MEDIUM    → Viền vàng                                       │
│  ⚪ LOW       → Không viền đặc biệt                             │
│                                                                  │
│  Action Buttons: [Xem bài] [Thử lại] [Xem logs]                │
│  Polling: 30 giây                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4. Checklist triển khai Mục 8

- [ ] Thêm notification types mới: `AI_BATCH_COMPLETED`, `SYSTEM_ALERT`, `SYSTEM_CRITICAL`, `KEY_EXPIRED`, `KEY_QUOTA_WARNING`, `SEO_COMPLETED`, `SEO_FAILED`
- [ ] Thêm `NotificationPriority` enum (LOW, MEDIUM, HIGH, CRITICAL)
- [ ] Thêm `priority`, `actionUrl`, `actions` fields vào Notification entity
- [ ] Gửi notification khi AI post **thành công** (hiện chỉ gửi khi fail)
- [ ] Gửi notification khi crawl **thành công** trong publish processor
- [ ] Tạo `CrawlBatchTrackerService` theo dõi batch và gửi summary
- [ ] Tạo `createForAdmins()` method gửi noti cho tất cả admin
- [ ] Tạo `cleanupOldNotifications()` cron job (3h sáng, xóa >30 ngày)
- [ ] Cập nhật frontend `NotificationBell` thêm icon, priority border, action buttons
- [ ] Cập nhật frontend `notification.ts` types
- [ ] Tích hợp notification vào `ApiKeyService.notifyKeyDead()` (Mục 6)
- [ ] Test: Tạo AI post → nhận noti thành công, crawl batch → nhận summary

---

## TỔNG KẾT CẬP NHẬT

### Bảng ưu tiên bổ sung (Mục 7 + 8)

| # | Task | Mục | Effort |
|---|------|-----|--------|
| 20 | Implement `generateImage()` trong GeminiClient | Mục 7 | 2h |
| 21 | Implement `generateImage()` trong OpenAIClient | Mục 7 | 1h |
| 22 | Nâng cấp ImageGenService với 5-level fallback | Mục 7 | 3h |
| 23 | Bổ sung notification types + priority | Mục 8 | 1h |
| 24 | Gửi noti thành công cho AI post + Crawl | Mục 8 | 2h |
| 25 | Tạo CrawlBatchTrackerService + batch summary | Mục 8 | 3h |
| 26 | createForAdmins() + auto-cleanup | Mục 8 | 2h |
| 27 | Cập nhật frontend NotificationBell | Mục 8 | 2h |

**Effort bổ sung: ~16 giờ**
**Tổng effort toàn bộ: ~63 giờ (~8 ngày dev)**

