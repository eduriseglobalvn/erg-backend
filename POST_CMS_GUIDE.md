# Hướng dẫn Tích hợp Quản lý Bài viết & Hình ảnh (CMS Workflow)

Tài liệu này mô tả chi tiết quy trình (flow) tích hợp giữa Frontend (FE) và Backend (BE) cho các chức năng: Cập nhật bài viết, Quản lý ảnh (Upload/Chèn/Xóa) và Xử lý nội dung Editor.

## 1. Quy trình Quản lý Hình ảnh (Image Workflow)

Vì ảnh trong nội dung bài viết chỉ là các đường dẫn (URL) nằm trong chuỗi HTML, nên quy trình xử lý sẽ gồm 2 bước: **Upload lấy URL** và **Chèn URL vào Editor**.

### 1.1. Upload ảnh (Khi người dùng kéo thả hoặc chọn ảnh trong Editor)
Khi người viết bài chọn một ảnh để chèn vào bài viết (ví dụ qua nút "Insert Image" của TinyMCE/CKEditor):

1.  **FE**: Gọi API Upload.
    *   **Endpoint**: `POST /api/posts/images/upload`
    *   **Header**: `Content-Type: multipart/form-data`
    *   **Body**: `file` (Binary Image Data)
2.  **BE**:
    *   Nhận file, validate (chỉ cho phép ảnh, max 5MB).
    *   Resize, nén sang WebP, upload lên Cloudflare R2.
    *   Trả về URL công khai.
3.  **FE**: Nhận URL từ response (ví dụ: `https://media.erg.edu.vn/posts/abc.webp`) và chèn thẻ `<img>` vào nội dung Editor.
    *   Code Editor: `<img src="https://media.erg.edu.vn/posts/abc.webp" alt="..." />`

### 1.2. Xóa ảnh (Clean up Storage)
Khi người dùng xóa một ảnh khỏi nội dung Editor hoặc xóa khỏi thư viện:

1.  **FE**: Lấy `src` của thẻ ảnh vừa bị xóa.
2.  **FE**: Gọi API Xóa (Optional - để tiết kiệm dung lượng Storage).
    *   **Endpoint**: `DELETE /api/posts/images`
    *   **Body (JSON)**: `{ "url": "https://media.erg.edu.vn/posts/abc.webp" }`
3.  **BE**: Xóa file vật lý trên Cloudflare R2.

---

## 2. Quy trình Cập nhật Bài viết (Post Update Flow)

Lưu ý: Nội dung bài viết (`content`) là một chuỗi HTML chứa cả text và các thẻ ảnh (`<img src="...">`).

### Workflow chỉnh sửa:
1.  **FE**: Gọi API Lấy chi tiết bài viết.
    *   **Endpoint**: `GET /api/posts/:id`
    *   **Action**: Hiển thị `title`, `slug`, `content` (HTML) vào các ô input và Editor.

2.  **FE (User Actions)**:
    *   Người dùng sửa tiêu đề -> FE cập nhật state `title`.
    *   Người dùng sửa nội dung (gõ text, chèn ảnh theo flow 1.1) -> FE cập nhật state `content` (chuỗi HTML đầy đủ).

3.  **FE**: Gọi API Lưu thay đổi (Save).
    *   **Endpoint**: `PUT /api/posts/:id`
    *   **Body (JSON)**:
        ```json
        {
          "title": "Tiêu đề mới đã sửa",
          "content": "<h1>Nội dung</h1><p>Text...</p><img src='https://media.../img.webp' />",
          "status": "PUBLISHED", // hoặc DRAFT
          "thumbnailUrl": "https://media.../thumb.webp" // (Nếu có thay đổi thumbnail)
        }
        ```

4.  **BE**:
    *   Cập nhật thông tin vào Database.
    *   Tự động tính toán lại SEO Score dựa trên content mới.
    *   Tự động generate lại Mục lục (TOC) từ các thẻ H2, H3 trong content.
    *   **Quan trọng**: Xóa Cache của bài viết và danh sách bài viết.
    *   Trả về object `Post` mới nhất sau khi update.

5.  **FE**:
    *   Nhận data mới từ BE response.
    *   **Quan trọng**: Update lại Local State / Redux Store bằng data này để UI phản hồi ngay lập tức (không cần gọi lại API list nếu không cần thiết).
    *   Nếu người dùng quay lại trang danh sách, API `GET /posts` sẽ trả về dữ liệu mới (do Cache đã được clear ở bước 4).

---

## 3. Các API Endpoint Chi tiết

### A. Upload Ảnh
- **URL**: `/api/posts/images/upload`
- **Method**: `POST`
- **Body**: Form-Data (`file`: binary)
- **Response**: `{ "url": "..." }`

### B. Xóa Ảnh
- **URL**: `/api/posts/images`
- **Method**: `DELETE`
- **Body**: `{ "url": "..." }`
- **Response**: `{ "success": true }`

### C. Cập nhật Bài viết
- **URL**: `/api/posts/:id`
- **Method**: `PUT`
- **Body**: Partial Object (chỉ gửi các trường cần update)
  ```json
  {
    "title": "...",
    "content": "...",
    "slug": "...",
    "thumbnailUrl": "...",
    "meta": { ... }
  }
  ```
