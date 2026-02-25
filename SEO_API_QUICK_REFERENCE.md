# 🚀 SEO API - QUICK REFERENCE

## 📍 Base URLs

```
Development: http://localhost:3003/api
Production:  https://api.erg.edu.vn/api
Swagger:     http://localhost:3003/api-docs
```

---

## 📊 API ENDPOINTS SUMMARY

### 1. GET /seo/health
**Tổng quan SEO toàn website**

```bash
curl http://localhost:3003/api/seo/health
```

**Response**: `{ totalPosts, postsAbove80, averageSeoScore, postsNeedImprovement }`

---

### 2. GET /seo/analyze/:postId
**Phân tích SEO chi tiết**

```bash
curl http://localhost:3003/api/seo/analyze/POST_ID
```

**Response**: `{ overallScore, basic, links, images, headings, freshness, recommendations }`

**Dimensions**:
- ✅ Basic (score, readability, keyword density, word count)
- ✅ Links (internal, external, nofollow)
- ✅ Images (total, with alt, without alt)
- ✅ Headings (H1-H6 count, hierarchy)
- ✅ Freshness (days since published/updated)

---

### 3. GET /seo/schema/:postId
**Lấy Schema Markup (JSON-LD)**

```bash
curl http://localhost:3003/api/seo/schema/POST_ID
```

**Response**: `{ "@context": "https://schema.org", "@graph": [...] }`

**Schema Types**: Article, Organization, WebPage, BreadcrumbList, FAQPage, HowTo

---

### 4. POST /seo/schema/:postId/validate
**Validate Schema**

```bash
curl -X POST http://localhost:3003/api/seo/schema/POST_ID/validate
```

**Response**: `{ valid: true/false, errors: [] }`

---

### 5. GET /seo/history/:postId?days=30
**Lịch sử SEO**

```bash
curl http://localhost:3003/api/seo/history/POST_ID?days=30
```

**Response**: Array of `{ id, postId, seoScore, readabilityScore, keywordDensity, wordCount, createdAt }`

---

### 6. GET /seo/trends/:postId?days=30
**Xu hướng SEO (đã tính toán)**

```bash
curl http://localhost:3003/api/seo/trends/POST_ID?days=30
```

**Response**: `{ currentScore, previousScore, change, changePercent, trend, dataPoints, insights }`

**Trend Values**: `"improving"` | `"declining"` | `"stable"`

---

### 7. GET /seo/gsc/:postId?days=30
**Google Search Console Data**

```bash
curl http://localhost:3003/api/seo/gsc/POST_ID?days=30
```

**Response**: Array of `{ clicks, impressions, ctr, position, date, country, device, query }`

---

### 8. POST /seo/gsc/sync?days=7
**Sync GSC Data (Auth Required)**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3003/api/seo/gsc/sync?days=7
```

**Response**: `{ message, synced, duration }`

---

### 9. GET /seo/gsc/top-posts?limit=10&days=30
**Top Performing Posts**

```bash
curl http://localhost:3003/api/seo/gsc/top-posts?limit=10&days=30
```

**Response**: Array of `{ postId, title, slug, totalClicks, totalImpressions, avgCtr, avgPosition, trend }`

---

## 🎯 COMMON USE CASES

### Use Case 1: Post Editor Sidebar
**Hiển thị SEO score real-time khi edit bài**

```typescript
// 1. Get analysis
const { data } = useSeoAnalysis(postId);

// 2. Display score
<SeoScoreCard postId={postId} />

// 3. Show recommendations
{data.recommendations.map(r => <li>{r}</li>)}
```

**APIs Used**: 
- `GET /seo/analyze/:postId`

---

### Use Case 2: SEO Dashboard
**Tổng quan SEO toàn website**

```typescript
// 1. Get health metrics
const { data: health } = useSeoHealth();

// 2. Get top posts
const { data: topPosts } = useTopPosts(10, 30);

// 3. Display cards
<HealthMetricsCards data={health} />
<TopPostsTable data={topPosts} />
```

**APIs Used**:
- `GET /seo/health`
- `GET /seo/gsc/top-posts`

---

### Use Case 3: SEO Trend Chart
**Hiển thị xu hướng SEO theo thời gian**

```typescript
// 1. Get trends
const { data: trends } = useSeoTrends(postId, 30);

// 2. Display chart
<LineChart data={trends.dataPoints}>
  <Line dataKey="score" />
</LineChart>

// 3. Show insights
{trends.insights.map(i => <li>{i}</li>)}
```

**APIs Used**:
- `GET /seo/trends/:postId`

---

### Use Case 4: GSC Performance
**Hiển thị hiệu suất Google Search**

```typescript
// 1. Get GSC data
const { data: gscData } = useGSCData(postId, 30);

// 2. Calculate totals
const totalClicks = gscData.reduce((sum, d) => sum + d.clicks, 0);
const totalImpressions = gscData.reduce((sum, d) => sum + d.impressions, 0);

// 3. Display metrics
<GSCMetrics clicks={totalClicks} impressions={totalImpressions} />
```

**APIs Used**:
- `GET /seo/gsc/:postId`

---

## 📦 TYPESCRIPT QUICK TYPES

```typescript
// Health
interface SeoHealth {
  totalPosts: number;
  postsAbove80: number;
  averageSeoScore: number;
  postsNeedImprovement: number;
}

// Analysis
interface SeoAnalysis {
  overallScore: number;
  basic: { score, readabilityScore, keywordDensity, wordCount, suggestions };
  links: { internalLinks, externalLinks, nofollowLinks, suggestions };
  images: { totalImages, imagesWithAlt, imagesWithoutAlt, suggestions };
  headings: { h1Count, h2Count, h3Count, hierarchy, suggestions };
  freshness: { score, daysSincePublished, daysSinceUpdated, suggestion };
  recommendations: string[];
}

// Trends
interface SeoTrends {
  currentScore: number;
  previousScore: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'declining' | 'stable';
  dataPoints: { date: string; score: number }[];
  insights: string[];
}

// GSC
interface GSCData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
  query?: string;
}
```

---

## 🔧 REACT HOOKS QUICK REFERENCE

```typescript
// Import
import { 
  useSeoHealth, 
  useSeoAnalysis, 
  useSeoTrends,
  useGSCData,
  useTopPosts 
} from '@/hooks/useSeo';

// Usage
const { data, isLoading, error } = useSeoAnalysis(postId);
const { data: health } = useSeoHealth();
const { data: trends } = useSeoTrends(postId, 30);
const { data: gsc } = useGSCData(postId, 30);
const { data: topPosts } = useTopPosts(10, 30);
```

---

## 🎨 COMPONENT QUICK REFERENCE

```typescript
// SEO Score Card
<SeoScoreCard postId={postId} />

// SEO Trend Chart
<SeoTrendChart postId={postId} days={30} />

// GSC Performance
<GSCPerformanceCard postId={postId} days={30} />
```

---

## ⚡ QUICK START

### 1. Test API
```bash
# Health check
curl http://localhost:3003/api/seo/health

# Analyze a post (replace POST_ID)
curl http://localhost:3003/api/seo/analyze/YOUR_POST_ID
```

### 2. Setup Frontend
```typescript
// 1. Create API client
// File: lib/api/seo.api.ts
export const seoApi = {
  getHealth: () => api.get('/seo/health'),
  analyzePost: (id) => api.get(`/seo/analyze/${id}`),
  // ... other methods
};

// 2. Create hooks
// File: hooks/useSeo.ts
export function useSeoAnalysis(postId) {
  return useQuery({
    queryKey: ['seo-analysis', postId],
    queryFn: () => seoApi.analyzePost(postId),
  });
}

// 3. Use in component
function PostEditor({ postId }) {
  const { data } = useSeoAnalysis(postId);
  return <div>Score: {data?.overallScore}</div>;
}
```

---

## 📚 DOCUMENTATION

- **Complete Guide**: `FRONTEND_SEO_COMPLETE_GUIDE.md`
- **Swagger UI**: http://localhost:3003/api-docs
- **Postman Collection**: `postman/SEO_API_Collection.json`

---

## 🐛 TROUBLESHOOTING

### API returns 404
- ✅ Check server is running: `yarn start:dev`
- ✅ Check URL: `http://localhost:3003/api/seo/...`
- ✅ Check postId is valid UUID

### CORS errors
- ✅ Backend already configured for localhost
- ✅ Check frontend URL matches allowed origins

### Empty data
- ✅ Make sure post exists in database
- ✅ Check post has content (for analysis)
- ✅ GSC data requires sync first

---

**Quick Links**:
- Swagger: http://localhost:3003/api-docs
- Health: http://localhost:3003/api/seo/health
