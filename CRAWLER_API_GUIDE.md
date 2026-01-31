# Hướng dẫn Tích hợp Crawler API (Updated)

Tài liệu này tổng hợp toàn bộ các API Backend cung cấp cho module Crawler.

## 1. Dashboard & Thống kê
Dùng để hiển thị các con số tổng quan tại trang chủ của module Crawler.

### 1.1 Lấy thống kê tổng hợp
*   **Endpoint:** `GET /api/crawler/stats`
*   **Response:**
    ```json
    {
      "totalRss": 10,
      "totalConfigs": 5,
      "totalHistory": 1250,
      "successCrawl": 1200,
      "failedCrawl": 50,
      "totalPosts": 300,        // Tổng số bài viết trong hệ thống
      "totalCategories": 15     // Tổng số chuyên mục
    }
    ```

### 1.2 Lấy lịch sử cào (Logs)
Hiển thị bảng lịch sử hoạt động cào tin (Thành công/Thất bại).

*   **Endpoint:** `GET /api/crawler/history`
*   **Query Params:** `?page=1&limit=20`
*   **Response:**
    ```json
    {
      "items": [
        {
          "id": "...",
          "url": "https://dantri.com.vn/...",
          "status": "SUCCESS", // hoặc FAILED
          "errorMessage": null,
          "postId": "mysql_post_uuid", // <--- New field (nếu status = SUCCESS)
          "crawledAt": "2026-01-29T..."
        }
      ],
      "total": 100,
      "page": 1,
      "limit": 20
    }
    ```

---

## 2. Quản lý Nguồn tin (RSS Feeds)
Quản lý các nguồn RSS để hệ thống tự động cào hoặc cào thủ công từng bài.

### 2.1 Lấy danh sách nguồn RSS
*   **Endpoint:** `GET /api/crawler/rss`
*   **Response:** (Đã kèm tên chuyên mục)
    ```json
    [
      {
        "id": "rss_id_1",
        "name": "VnExpress Tin tức",
        "url": "https://vnexpress.net/rss/tin-moi-nhat.rss",
        "targetCategoryId": "cat_id_1",
        "categoryName": "Tin tức chung", // <--- Field mới để hiển thị
        "isActive": true,
        "autoPublish": false,
        "cronExpression": "0 */4 * * *"
      }
    ]
    ```

### 2.2 Thêm/Sửa nguồn RSS
*   **Endpoint:** 
    *   Tạo mới: `POST /api/crawler/rss`
    *   Cập nhật: `PATCH /api/crawler/rss/:id`
*   **Body:**
    ```json
    {
      "name": "Dân trí Giáo dục",
      "url": "https://dantri.com.vn/rss/giao-duc.rss",
      "targetCategoryId": "cat_id_mysql_uuid", // Bắt buộc ID chuyên mục từ MySQL
      "cronExpression": "0 7 * * *", // (Optional) Nếu muốn chạy tự động
      "isActive": true,
      "autoPublish": false // true = Đăng ngay, false = Lưu nháp
    }
    ```

### 2.3 Xóa nguồn RSS
*   **Endpoint:** `DELETE /api/crawler/rss/:id`

---

## 3. Cào tin có chọn lọc (Selective Crawling)

### 3.1 Quy trình A: Thêm RSS Mới & Chọn bài cào ngay
Dùng khi User muốn thêm nguồn RSS mới và chọn ngay những bài cần cào.

#### Bước 1: Xem trước từ URL (Preview Raw)
Ném URL vào để xem danh sách bài viết (Chưa cần lưu vào DB).
*   **Endpoint:** `POST /api/crawler/rss/preview`
*   **Body:** `{ "url": "https://url-rss-cua-ban.com/feed.rss" }`
*   **Response:**
    ```json
    {
      "feedTitle": "Tiêu đề Feed",
      "feedUrl": "https://...",
      "items": [
        { 
          "title": "Bản tin 1", 
          "link": "https://...", 
          "thumbnail": "https://image.url/...", // <-- New field
          "isCrawled": false 
        },
        { "title": "Bản tin 2", "link": "https://...", "thumbnail": null, "isCrawled": true }
      ]
    }
    ```

#### Bước 2: Lưu RSS & Trigger cào các bài đã chọn (QUAN TRỌNG)
API này thực hiện 2 việc cùng lúc:
1.  Lưu cấu hình RSS vào Database.
2.  **Deep Crawl:** Duyệt qua danh sách `selectedLinks`, với mỗi link sẽ truy cập vào trang chi tiết để lấy toàn bộ nội dung (Title, Content, Images, Thumbnail) chứ **không** chỉ lấy title từ RSS.

*   **Endpoint:** `POST /api/crawler/rss/create-selective`
*   **Body:**
    ```json
    {
      "feed": {
        "name": "Tên nguồn RSS",
        "url": "https://...",
        "targetCategoryId": "id_category_mysql", // UUID của chuyên mục muốn lưu bài vào
        "isActive": true
      },
      "selectedLinks": [
        "https://link-bai-viet-1.com/baiviet1.html",
        "https://link-bai-viet-2.com/baiviet2.html"
      ]
    }
    ```
*   **Response:** Trả về đối tượng RSS Feed vừa tạo.
    *   *Backend Background Process:* Hệ thống sẽ tạo N job cào (`crawl_url`) tương ứng với số link được chọn. Frontend có thể gọi API History để theo dõi tiến độ.

---

### 3.2 Quy trình B: Cào từ RSS Đã lưu
Dùng khi RSS đã có trong hệ thống, Admin muốn vào xem lại và cào bù các bài sót.

#### Bước 1: Xem trước (Peek - Khi đã có RSS ID)
Lấy danh sách bài viết thời gian thực từ RSS đã lưu.

*   **Endpoint:** `GET /api/crawler/rss/peek/:rssId`
*   **Response:** Tương tự như trên, nhưng trả về items của RSS có ID tương ứng.

### Bước 1 (BS): Xem trước từ URL (Preview Raw - Khi chưa lưu DB)
Dùng cho luồng "Thêm mới RSS" -> Paste link -> Preview -> Chọn bài -> Lưu.

*   **Endpoint:** `POST /api/crawler/rss/preview`
*   **Body:** `{ "url": "https://..." }`
*   **Response:** (Giống Peek) Trả về danh sách items.

#### Bước 2: Cào bài lẻ (Trigger URL)
Gọi API này cho từng bài user muốn cào thêm.
*   **Endpoint:** `POST /api/crawler/url/run`
*   **Body:**
    ```json
    {
      "url": "https://vnexpress.net/...",
      "type": "STATIC",
      "targetCategoryId": "id_category_mysql" // Bắt buộc nếu muốn lưu vào DB thành công
    }
    ```

---

## 4. Kích hoạt cào toàn bộ (Bulk Trigger)
Dùng khi muốn hệ thống cào ngay lập tức toàn bộ tin mới trong RSS (chạy ngầm).

*   **Endpoint:** `POST /api/crawler/rss/trigger`
*   **Body:** `{ "rssId": "list_id" }`

---

## 5. Cấu hình Scraper (Domain Configs)
Dùng để cấu hình Selector riêng cho từng trang báo (nếu chế độ Auto không lấy đúng).

### 5.1 Lấy danh sách Config
*   **Endpoint:** `GET /api/crawler/configs`

### 5.2 Thêm/Sửa Config
*   **Endpoint:** `POST` hoặc `PATCH /api/crawler/configs/:id`
*   **Body:**
    ```json
    {
      "domain": "baomoi.com",
      "type": "STATIC",
      "selectorConfig": {
        "titleSelector": "h1.post-title",
        "contentSelector": "div.article-body",
        "thumbnailSelector": "meta[property='og:image']"
      }
    }
    ```
