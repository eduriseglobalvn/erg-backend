# Kế Hoạch Triển Khai SEO (SEO Implementation Plan)

## Mục Tiêu
Tối ưu hóa cấu trúc blog cho SEO bằng cách bổ sung các trường siêu dữ liệu (metadata) cần thiết và tạo sitemap động. Tích hợp các kỹ năng SEO từ repo `antigravity-awesome-skills` để tự động hóa việc tối ưu nội dung.

## Yêu Cầu Review Từ Người Dùng
> [!NOTE]
> Cần chạy migration cơ sở dữ liệu để thêm các cột mới vào bảng `posts` và `post_categories`.

## Các Thay Đổi Đề Xuất

### Cơ Sở Dữ Liệu & Thực Thể (Database & Entities)
#### [MODIFY] [post.entity.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/posts/entities/post.entity.ts)
Dựa trên JSON hiện tại, Entity cần bổ sung các trường sau để "lên Top":
- `metaTitle` (string): Tiêu đề tối ưu cho Google (khác với title bài viết).
- `metaDescription` (text): Mô tả hiển thị trên Google (CTR optimization).
- `focusKeyword` (string): Từ khóa chính mục tiêu của bài viết (để chấm điểm SEO).
- `keywords` (string): Meta keywords (hỗ trợ các search engine khác).
- `canonicalUrl` (string): URL gốc (tránh duplicate content).
- `schemaType` (enum): `Article`, `NewsArticle`, `BlogPosting` (cho Rich Snippets).
- `seoScore` (number): Điểm số tối ưu (0-100), tính toán khi save.

#### [REMOVE] User Entity Changes
- (Theo yêu cầu: Bỏ phần E-E-A-T update cho User).

#### [NEW] [redirect.entity.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/seo/entities/redirect.entity.ts)
- `fromPath` (string, index)
- `toPath` (string)
- `statusCode` (301/302)
- *Mục đích*: Giữ thứ hạng khi đổi slug hoặc di chuyển bài viết.

#### [MODIFY] [post-category.entity.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/posts/entities/post-category.entity.ts)
- Thêm `metaTitle`, `metaDescription`, `keywords`

### Tự Động Hóa & Phân Tích SEO (Mới)
#### [NEW] [seo-analyzer.service.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/ai-content/services/seo-analyzer.service.ts)
- Chuyển đổi logic từ `seo_optimizer.py` sang TypeScript:
    - `analyze(content: string, keyword?: string)`: Tính điểm SEO, mật độ từ khóa, và độ dễ đọc.
    - `generateMeta(content: string, keyword?: string)`: Tự động gợi ý tiêu đề và mô tả chuẩn SEO.
- Triển khai thuật toán tính điểm (0-100) dựa trên độ dài nội dung, cấu trúc heading, và từ khóa.

#### [MODIFY] [ai-content.module.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/ai-content/ai-content.module.ts)
- Đăng ký `SeoAnalyzerService`.

#### [MODIFY] [ai-generation.processor.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/ai-content/processors/ai-generation.processor.ts)
- Tích hợp `SeoAnalyzerService` để:
    - Tự động tạo `metaTitle` và `metaDescription` cho bài viết mới do AI tạo.
    - Tính toán và lưu `seoScore` ban đầu (có thể log ra hoặc lưu vào DB nếu cần).

### DTOs
#### [MODIFY] [create-post.dto.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/posts/dto/create-post.dto.ts)
#### [MODIFY] [update-post.dto.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/posts/dto/update-post.dto.ts)
- Thêm các trường SEO vào validation.

### Logic & Validate
#### [MODIFY] [posts.service.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/posts/posts.service.ts)
- Cập nhật `create`/`update` để lưu các trường mới.
- **Auto-Generate Meta**: Nếu người dùng không nhập, tự động lấy `title` -> `metaTitle`, `excerpt` -> `metaDescription`.
- **Rank Math Logic**: Tích hợp `SeoAnalyzerService` để chấm điểm bài viết trước khi lưu.

#### [NEW] [seo-analyzer.service.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/ai-content/services/seo-analyzer.service.ts)
Port logic "xịn" từ `seo_optimizer.py`:
- `calculateSeoScore(content, focusKeyword)`: Trả về điểm 0-100.
- Check density từ khóa, độ dài, heading structure, alt ảnh.

### Sitemap Support API
#### [NEW] [sitemap.controller.ts](file:///Users/vuong/ERG.Workspace/erg-backend/src/modules/sitemap/sitemap.controller.ts)
- **Mục tiêu**: Cung cấp dữ liệu thô cho Frontend tự generate `sitemap.xml`.
- **Endpoint**: `GET /sitemap/data`
- **Logic**:
    - Aggregator Pattern: Service sẽ gọi đến các module con (Posts, Jobs, Courses...).
    - Trả về danh sách URL thống nhất: `{ loc: string, lastmod: date, type: 'post' | 'job' | 'course' }`.
    - Hỗ trợ phân trang hoặc streaming nếu dữ liệu quá lớn.
    - Modules cần integration ban đầu:
        - `PostsService` (lấy bài viết).
        - (Mở rộng sau): Các service khác như `Jobs`, `Courses` sẽ implement interface `SitemapContinuable`.

## Kế Hoạch Kiểm Tra (Verification Plan)

### Kiểm Tra Tự Động
- Chạy migration và kiểm tra schema: `npx mikro-orm schema:update --run`
- Test API `POST /posts` với các trường SEO.

### Kiểm Tra Thủ Công
- Tạo bài viết với đầy đủ dữ liệu SEO qua Postman hoặc Swagger.
- Gọi `GET /posts/:id` để kiểm tra dữ liệu trả về.
- Truy cập `http://localhost:3000/sitemap.xml` và kiểm tra cấu trúc XML.
