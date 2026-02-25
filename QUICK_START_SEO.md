# 🚀 QUICK START - Backend SEO System

## ⚡ 3 BƯỚC BẮT ĐẦU

### 1️⃣ Restart Server
```bash
cd /Users/vuong/ERG.Workspace/erg-backend
yarn start:dev
```

### 2️⃣ Mở Swagger UI
```
http://localhost:3003/api-docs
```

### 3️⃣ Test API
Click vào `GET /seo/health` → Try it out → Execute

---

## 📚 TÀI LIỆU CHI TIẾT

1. **BACKEND_SEO_COMPLETED.md** - Tổng kết backend đã làm
2. **FRONTEND_SEO_INTEGRATION_GUIDE.md** - Hướng dẫn FE tích hợp
3. **SWAGGER_GUIDE.md** - Hướng dẫn dùng Swagger
4. **BACKEND_SEO_FINAL_SUMMARY.md** - Tổng kết cuối cùng

---

## 🔌 API ENDPOINTS

```
GET    /api/seo/health              - Health metrics
GET    /api/seo/analyze/:postId     - SEO analysis
GET    /api/seo/schema/:postId      - Schema markup
GET    /api/seo/history/:postId     - SEO history
GET    /api/seo/trends/:postId      - SEO trends
GET    /api/seo/gsc/:postId         - GSC data
POST   /api/seo/gsc/sync            - Sync GSC (auth)
GET    /api/seo/gsc/top-posts       - Top posts
POST   /api/seo/schema/:postId/validate - Validate
```

---

## 🎯 TÍNH NĂNG TỰ ĐỘNG

Khi tạo/update post, hệ thống TỰ ĐỘNG:
- ✅ Tính SEO score, readability, keyword density
- ✅ Generate Schema Markup
- ✅ Generate Open Graph metadata
- ✅ Generate Twitter Cards
- ✅ Lưu SEO history

---

## 📊 FRONTEND INTEGRATION

```typescript
// 1. API Client
import { seoApi } from '@/lib/api/seo.api';
const analysis = await seoApi.analyzePost(postId);

// 2. React Hook
import { useSeoAnalysis } from '@/hooks/useSeoAnalysis';
const { data } = useSeoAnalysis(postId);

// 3. Component
import { SeoScoreCard } from '@/components/admin/seo/SeoScoreCard';
<SeoScoreCard postId={postId} />
```

---

## ⚠️ LƯU Ý

**Migration**: Cần Node.js >= 20.19.0
```bash
nvm install 20.19.0
nvm use 20.19.0
yarn mikro-orm migration:up
```

---

**Status**: ✅ READY  
**Swagger**: http://localhost:3003/api-docs
