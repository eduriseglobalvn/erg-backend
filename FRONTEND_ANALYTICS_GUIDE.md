# Hướng dẫn Tích hợp Analytics API (ERG Insight)

Hệ thống Insight giúp theo dõi hành vi người dùng, lượt xem bài viết/khóa học và hiệu quả của các nút tương tác (CTA).

## 1. Luồng hoạt động chính
1. **Khi vào trang**: Gọi API `session/begin` để lấy `visitId`.
2. **Khi tương tác**: Gọi API `behavior` để track các hành động (click, submit...).
3. **Khi rời trang**: Gọi API `session/:id/finish` để cập nhật thời gian ở lại trang (Duration).

---

## 2. Chi tiết các API

### API 1: Bắt đầu phiên truy cập (Tracking Page View)
Gọi API này ngay khi trang vừa load xong (`useEffect` hoặc `onMounted`).

- **Endpoint**: `POST /api/insight/session/begin`
- **Body**:
```json
{
  "url": "https://erg.edu.vn/posts/hoc-ai-can-ban", // URL hiện tại
  "referrer": "https://google.com", // Trang trước đó (document.referrer)
  "entityType": "post", // Loại nội dung: 'post', 'course', hoặc 'page'
  "entityId": "hoc-ai-can-ban" // Slug hoặc ID của nội dung
}
```
- **Response**: `{ "visitId": "uuid-v4-string" }`
- **Lưu ý**: Hãy lưu `visitId` này vào biến toàn cục hoặc `sessionStorage` để dùng cho API kết thúc trang.

---

### API 2: Theo dõi hành vi (Event Tracking)
Dùng để track các nút nhấn quan trọng, lượt tải tài liệu, hoặc xem video.

- **Endpoint**: `POST /api/insight/behavior`
- **Body**:
```json
{
  "eventType": "click_register_button", // Tên sự kiện (viết liền, snake_case)
  "sessionInternalId": "visitId_tu_api_tren", // Truyền visitId lấy từ session/begin
  "metadata": {
    "section": "footer",
    "courseName": "IELTS 7.0",
    "buttonColor": "red"
  } // Dữ liệu bổ sung tùy ý (JSON)
}
```

---

### API 3: Kết thúc trang (Duration Tracking)
Gọi khi người dùng rời khỏi trang hoặc chuyển trang.

- **Endpoint**: `PUT /api/insight/session/:id/finish`
- **Body**:
```json
{
  "duration": 45 // Số giây người dùng đã ở trên trang
}
```
- **Mẹo**: Sử dụng sự kiện `visibilitychange` hoặc `beforeunload` để tính toán thời gian `startTime` và `endTime`.

---

## 3. Mã mẫu tích hợp (React/Next.js Example)

```javascript
import axios from 'axios';

const useAnalytics = (entityType, entityId) => {
  const visitIdRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // 1. Gửi page view khi vào trang
    const trackBegin = async () => {
      try {
        const res = await axios.post('/api/insight/session/begin', {
          url: window.location.href,
          referrer: document.referrer,
          entityType: entityType, // 'post' / 'course'
          entityId: entityId     // slug
        });
        visitIdRef.current = res.data.visitId;
      } catch (e) {
        console.error('Analytics Error', e);
      }
    };

    trackBegin();

    // 2. Gửi duration khi rời trang
    return () => {
      if (visitIdRef.current) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        // Dùng navigator.sendBeacon để đảm bảo request gửi đi ngay cả khi đóng tab
        const url = `/api/insight/session/${visitIdRef.current}/finish`;
        const blob = new Blob([JSON.stringify({ duration })], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    };
  }, [entityType, entityId]);

  // Hàm để gọi thủ công cho các nút nhấn
  const trackEvent = (eventName, metadata = {}) => {
    if (visitIdRef.current) {
       axios.post('/api/insight/behavior', {
         eventType: eventName,
         sessionInternalId: visitIdRef.current,
         metadata
       });
    }
  };

  return { trackEvent };
};
```

---

## 4. Danh sách các Entity Type gợi ý
| Type | Khi nào dùng |
| :--- | :--- |
| `post` | Trang chi tiết bài viết blog/tin tức |
| `course` | Trang chi tiết khóa học |
| `category` | Trang danh sách chuyên mục |
| `page` | Các trang tĩnh (Liên hệ, Giới thiệu) |
