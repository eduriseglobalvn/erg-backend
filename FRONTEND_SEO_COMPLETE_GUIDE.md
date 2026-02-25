# 🎨 FRONTEND SEO INTEGRATION - COMPLETE GUIDE

## 📋 MỤC LỤC

1. [Tổng quan hệ thống](#tổng-quan-hệ-thống)
2. [API Endpoints chi tiết](#api-endpoints-chi-tiết)
3. [Data Models & TypeScript Interfaces](#data-models--typescript-interfaces)
4. [API Client Implementation](#api-client-implementation)
5. [React Hooks & State Management](#react-hooks--state-management)
6. [UI Components](#ui-components)
7. [Page Implementations](#page-implementations)
8. [Testing & Validation](#testing--validation)
9. [Timeline & Effort Estimation](#timeline--effort-estimation)

---

## 🎯 TỔNG QUAN HỆ THỐNG

### Mục tiêu
Tích hợp hệ thống SEO nâng cao vào Admin CMS, cho phép:
- ✅ Phân tích SEO real-time khi viết bài
- ✅ Tự động generate metadata (OG, Twitter, Schema)
- ✅ Theo dõi lịch sử SEO score
- ✅ Tích hợp Google Search Console
- ✅ Dashboard tổng quan SEO

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **UI Library**: Shadcn/UI
- **State Management**: React Query (TanStack Query)
- **Charts**: Recharts hoặc Chart.js
- **Backend API**: http://localhost:3003/api

---

## 📡 API ENDPOINTS CHI TIẾT

### Base URL
```
Development: http://localhost:3003/api
Production: https://api.erg.edu.vn/api
```

### 1. GET /seo/health
**Mục đích**: Lấy tổng quan về tình trạng SEO của toàn bộ website

**Request**: Không cần parameters

**Response**:
```typescript
{
  "totalPosts": 150,           // Tổng số bài viết
  "postsAbove80": 45,          // Số bài có SEO score >= 80
  "averageSeoScore": 72,       // Điểm SEO trung bình
  "postsNeedImprovement": 105  // Số bài cần cải thiện (< 80)
}
```

**Use Case**: Dashboard overview, SEO health widget

**Example**:
```bash
curl http://localhost:3003/api/seo/health
```

---

### 2. GET /seo/analyze/:postId
**Mục đích**: Phân tích SEO chi tiết cho một bài viết

**Request**:
- Path param: `postId` (UUID)

**Response**:
```typescript
{
  "overallScore": 85,          // Điểm tổng (0-100)
  "basic": {
    "score": 90,               // Điểm SEO cơ bản
    "readabilityScore": 75,    // Điểm dễ đọc
    "keywordDensity": 0.025,   // Mật độ từ khóa (2.5%)
    "wordCount": 1500,         // Số từ
    "suggestions": [
      "Content length is good (1500 words)",
      "Keyword density is optimal (2.5%)"
    ]
  },
  "links": {
    "internalLinks": 5,        // Số link nội bộ
    "externalLinks": 3,        // Số link ngoài
    "nofollowLinks": 1,        // Số link nofollow
    "suggestions": [
      "Add more internal links (recommended: 5-10)",
      "Good balance of external links"
    ]
  },
  "images": {
    "totalImages": 8,          // Tổng số ảnh
    "imagesWithAlt": 6,        // Số ảnh có alt text
    "imagesWithoutAlt": [      // Danh sách ảnh thiếu alt
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "suggestions": [
      "2 images missing alt text",
      "Alt text coverage: 75%"
    ]
  },
  "headings": {
    "h1Count": 1,              // Số heading H1
    "h2Count": 5,              // Số heading H2
    "h3Count": 8,              // Số heading H3
    "hierarchy": true,         // Có đúng thứ bậc không
    "suggestions": [
      "Good heading structure",
      "H1 count is correct (1)"
    ]
  },
  "freshness": {
    "score": 95,               // Điểm độ mới (0-100)
    "daysSincePublished": 5,   // Số ngày từ khi publish
    "daysSinceUpdated": 2,     // Số ngày từ lần update cuối
    "suggestion": "Content is fresh (updated 2 days ago)"
  },
  "recommendations": [         // Tổng hợp các đề xuất
    "Add more internal links",
    "Improve readability score to 80+",
    "Add alt text to 2 images"
  ]
}
```

**Use Case**: Post editor sidebar, SEO analysis panel

**Example**:
```bash
curl http://localhost:3003/api/seo/analyze/123e4567-e89b-12d3-a456-426614174000
```

---

### 3. GET /seo/schema/:postId
**Mục đích**: Lấy Schema Markup (JSON-LD) cho bài viết

**Request**:
- Path param: `postId` (UUID)

**Response**:
```typescript
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://erg.edu.vn/#organization",
      "name": "EDURISE GLOBAL",
      "url": "https://erg.edu.vn",
      "logo": {
        "@type": "ImageObject",
        "url": "https://erg.edu.vn/logo.png"
      }
    },
    {
      "@type": "Article",
      "@id": "https://erg.edu.vn/posts/my-post#article",
      "headline": "Tiêu đề bài viết",
      "description": "Mô tả bài viết",
      "image": {
        "@type": "ImageObject",
        "url": "https://erg.edu.vn/thumbnail.jpg",
        "width": 1200,
        "height": 630
      },
      "datePublished": "2026-02-10T10:00:00Z",
      "dateModified": "2026-02-10T12:00:00Z",
      "author": {
        "@type": "Person",
        "name": "Nguyễn Văn A"
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://erg.edu.vn/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Trang chủ",
          "item": "https://erg.edu.vn"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Tin giáo dục",
          "item": "https://erg.edu.vn/tin-giao-duc"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Tiêu đề bài viết"
        }
      ]
    }
  ]
}
```

**Use Case**: Schema preview, SEO testing tools

**Example**:
```bash
curl http://localhost:3003/api/seo/schema/123e4567-e89b-12d3-a456-426614174000
```

---

### 4. POST /seo/schema/:postId/validate
**Mục đích**: Validate Schema Markup

**Request**:
- Path param: `postId` (UUID)

**Response**:
```typescript
{
  "valid": true,
  "errors": []
}

// Hoặc nếu có lỗi:
{
  "valid": false,
  "errors": [
    "Missing @context",
    "Invalid @type value"
  ]
}
```

**Use Case**: Schema validation trước khi publish

**Example**:
```bash
curl -X POST http://localhost:3003/api/seo/schema/123e4567-e89b-12d3-a456-426614174000/validate
```

---

### 5. GET /seo/history/:postId
**Mục đích**: Lấy lịch sử SEO score của bài viết

**Request**:
- Path param: `postId` (UUID)
- Query param: `days` (optional, default: 30)

**Response**:
```typescript
[
  {
    "id": "hist-001",
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "seoScore": 85,
    "readabilityScore": 75,
    "keywordDensity": 0.025,
    "wordCount": 1500,
    "suggestions": ["Add more internal links"],
    "metadata": {
      "version": "1.0",
      "analyzer": "seo-analyzer-v2"
    },
    "createdAt": "2026-02-10T10:00:00Z"
  },
  {
    "id": "hist-002",
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "seoScore": 80,
    "readabilityScore": 70,
    "keywordDensity": 0.020,
    "wordCount": 1400,
    "suggestions": ["Improve readability"],
    "metadata": {},
    "createdAt": "2026-02-09T10:00:00Z"
  }
]
```

**Use Case**: SEO trend chart, history timeline

**Example**:
```bash
curl http://localhost:3003/api/seo/history/123e4567-e89b-12d3-a456-426614174000?days=30
```

---

### 6. GET /seo/trends/:postId
**Mục đích**: Lấy xu hướng SEO (tính toán sẵn)

**Request**:
- Path param: `postId` (UUID)
- Query param: `days` (optional, default: 30)

**Response**:
```typescript
{
  "postId": "123e4567-e89b-12d3-a456-426614174000",
  "period": 30,
  "currentScore": 85,
  "previousScore": 75,
  "change": 10,              // +10 điểm
  "changePercent": 13.33,    // +13.33%
  "trend": "improving",      // "improving" | "declining" | "stable"
  "dataPoints": [
    { "date": "2026-02-01", "score": 75 },
    { "date": "2026-02-05", "score": 78 },
    { "date": "2026-02-10", "score": 85 }
  ],
  "insights": [
    "SEO score improved by 10 points in the last 30 days",
    "Readability increased from 70 to 75",
    "Keyword density is now optimal"
  ]
}
```

**Use Case**: Trend visualization, performance insights

**Example**:
```bash
curl http://localhost:3003/api/seo/trends/123e4567-e89b-12d3-a456-426614174000?days=30
```

---

### 7. GET /seo/gsc/:postId
**Mục đích**: Lấy dữ liệu Google Search Console cho bài viết

**Request**:
- Path param: `postId` (UUID)
- Query param: `days` (optional, default: 30)

**Response**:
```typescript
[
  {
    "id": "gsc-001",
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://erg.edu.vn/posts/my-post",
    "clicks": 150,           // Số lượt click
    "impressions": 5000,     // Số lần hiển thị
    "ctr": 0.03,             // Click-through rate (3%)
    "position": 5.2,         // Vị trí trung bình trên Google
    "date": "2026-02-10",
    "country": "VN",
    "device": "mobile",
    "query": "học tiếng anh online",
    "createdAt": "2026-02-10T10:00:00Z"
  },
  {
    "id": "gsc-002",
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://erg.edu.vn/posts/my-post",
    "clicks": 120,
    "impressions": 4500,
    "ctr": 0.027,
    "position": 6.1,
    "date": "2026-02-09",
    "country": "VN",
    "device": "desktop",
    "query": "học tiếng anh",
    "createdAt": "2026-02-09T10:00:00Z"
  }
]
```

**Use Case**: GSC performance chart, search analytics

**Example**:
```bash
curl http://localhost:3003/api/seo/gsc/123e4567-e89b-12d3-a456-426614174000?days=30
```

---

### 8. POST /seo/gsc/sync
**Mục đích**: Đồng bộ dữ liệu từ Google Search Console (Admin only)

**Authentication**: Required (JWT Bearer token)

**Request**:
- Query param: `days` (optional, default: 7)

**Response**:
```typescript
{
  "message": "GSC data synced successfully",
  "synced": 150,           // Số records đã sync
  "duration": 5.2          // Thời gian sync (giây)
}
```

**Use Case**: Manual sync button trong admin dashboard

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3003/api/seo/gsc/sync?days=7
```

---

### 9. GET /seo/gsc/top-posts
**Mục đích**: Lấy danh sách bài viết có hiệu suất tốt nhất trên Google

**Request**:
- Query param: `limit` (optional, default: 10)
- Query param: `days` (optional, default: 30)

**Response**:
```typescript
[
  {
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Học tiếng Anh online hiệu quả",
    "slug": "hoc-tieng-anh-online",
    "totalClicks": 1500,
    "totalImpressions": 50000,
    "avgCtr": 0.03,
    "avgPosition": 3.5,
    "trend": "improving"     // "improving" | "declining" | "stable"
  },
  {
    "postId": "223e4567-e89b-12d3-a456-426614174001",
    "title": "Top 10 khóa học IELTS",
    "slug": "top-10-khoa-hoc-ielts",
    "totalClicks": 1200,
    "totalImpressions": 45000,
    "avgCtr": 0.027,
    "avgPosition": 4.2,
    "trend": "stable"
  }
]
```

**Use Case**: Top performing posts widget, content strategy

**Example**:
```bash
curl http://localhost:3003/api/seo/gsc/top-posts?limit=10&days=30
```

---

## 📦 DATA MODELS & TYPESCRIPT INTERFACES

### File: `types/seo.types.ts`

```typescript
// ===== BASIC TYPES =====

export interface SeoHealth {
  totalPosts: number;
  postsAbove80: number;
  averageSeoScore: number;
  postsNeedImprovement: number;
}

export interface SeoAnalysis {
  overallScore: number;
  basic: BasicSeoAnalysis;
  links: LinkAnalysis;
  images: ImageAnalysis;
  headings: HeadingAnalysis;
  freshness: FreshnessAnalysis;
  recommendations: string[];
}

export interface BasicSeoAnalysis {
  score: number;
  readabilityScore: number;
  keywordDensity: number;
  wordCount: number;
  suggestions: string[];
}

export interface LinkAnalysis {
  internalLinks: number;
  externalLinks: number;
  nofollowLinks: number;
  suggestions: string[];
}

export interface ImageAnalysis {
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: string[];
  suggestions: string[];
}

export interface HeadingAnalysis {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  hierarchy: boolean;
  suggestions: string[];
}

export interface FreshnessAnalysis {
  score: number;
  daysSincePublished: number;
  daysSinceUpdated: number;
  suggestion: string;
}

// ===== SCHEMA MARKUP =====

export interface SchemaMarkup {
  '@context': string;
  '@graph': SchemaNode[];
}

export interface SchemaNode {
  '@type': string;
  '@id'?: string;
  [key: string]: any;
}

export interface SchemaValidation {
  valid: boolean;
  errors: string[];
}

// ===== SEO HISTORY =====

export interface SeoHistory {
  id: string;
  postId: string;
  seoScore: number;
  readabilityScore: number;
  keywordDensity: number;
  wordCount: number;
  suggestions: string[];
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SeoTrends {
  postId: string;
  period: number;
  currentScore: number;
  previousScore: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'declining' | 'stable';
  dataPoints: TrendDataPoint[];
  insights: string[];
}

export interface TrendDataPoint {
  date: string;
  score: number;
}

// ===== GOOGLE SEARCH CONSOLE =====

export interface GSCData {
  id: string;
  postId: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
  country?: string;
  device?: string;
  query?: string;
  createdAt: string;
}

export interface GSCSyncResponse {
  message: string;
  synced: number;
  duration: number;
}

export interface TopPost {
  postId: string;
  title: string;
  slug: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ===== API RESPONSE WRAPPERS =====

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error: string;
}
```

---

## 🔌 API CLIENT IMPLEMENTATION

### File: `lib/api/seo.api.ts`

```typescript
import { api } from './client'; // Axios instance của bạn
import type {
  SeoHealth,
  SeoAnalysis,
  SchemaMarkup,
  SchemaValidation,
  SeoHistory,
  SeoTrends,
  GSCData,
  GSCSyncResponse,
  TopPost,
} from '@/types/seo.types';

export const seoApi = {
  /**
   * Get SEO health metrics for the entire website
   */
  getHealth: async (): Promise<SeoHealth> => {
    const { data } = await api.get<SeoHealth>('/seo/health');
    return data;
  },

  /**
   * Get comprehensive SEO analysis for a post
   */
  analyzePost: async (postId: string): Promise<SeoAnalysis> => {
    const { data } = await api.get<SeoAnalysis>(`/seo/analyze/${postId}`);
    return data;
  },

  /**
   * Get schema markup for a post
   */
  getSchema: async (postId: string): Promise<SchemaMarkup> => {
    const { data } = await api.get<SchemaMarkup>(`/seo/schema/${postId}`);
    return data;
  },

  /**
   * Validate schema markup
   */
  validateSchema: async (postId: string): Promise<SchemaValidation> => {
    const { data } = await api.post<SchemaValidation>(
      `/seo/schema/${postId}/validate`
    );
    return data;
  },

  /**
   * Get SEO history for a post
   */
  getHistory: async (
    postId: string,
    days: number = 30
  ): Promise<SeoHistory[]> => {
    const { data } = await api.get<SeoHistory[]>(
      `/seo/history/${postId}?days=${days}`
    );
    return data;
  },

  /**
   * Get SEO trends for a post
   */
  getTrends: async (
    postId: string,
    days: number = 30
  ): Promise<SeoTrends> => {
    const { data } = await api.get<SeoTrends>(
      `/seo/trends/${postId}?days=${days}`
    );
    return data;
  },

  /**
   * Get Google Search Console data for a post
   */
  getGSCData: async (
    postId: string,
    days: number = 30
  ): Promise<GSCData[]> => {
    const { data } = await api.get<GSCData[]>(
      `/seo/gsc/${postId}?days=${days}`
    );
    return data;
  },

  /**
   * Sync Google Search Console data (Admin only)
   */
  syncGSC: async (days: number = 7): Promise<GSCSyncResponse> => {
    const { data } = await api.post<GSCSyncResponse>(
      `/seo/gsc/sync?days=${days}`
    );
    return data;
  },

  /**
   * Get top performing posts from GSC
   */
  getTopPosts: async (
    limit: number = 10,
    days: number = 30
  ): Promise<TopPost[]> => {
    const { data } = await api.get<TopPost[]>(
      `/seo/gsc/top-posts?limit=${limit}&days=${days}`
    );
    return data;
  },
};
```

---

## 🪝 REACT HOOKS & STATE MANAGEMENT

### File: `hooks/useSeo.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seoApi } from '@/lib/api/seo.api';
import { toast } from 'sonner';

// ===== QUERY KEYS =====
export const seoKeys = {
  all: ['seo'] as const,
  health: () => [...seoKeys.all, 'health'] as const,
  analysis: (postId: string) => [...seoKeys.all, 'analysis', postId] as const,
  schema: (postId: string) => [...seoKeys.all, 'schema', postId] as const,
  history: (postId: string, days: number) =>
    [...seoKeys.all, 'history', postId, days] as const,
  trends: (postId: string, days: number) =>
    [...seoKeys.all, 'trends', postId, days] as const,
  gsc: (postId: string, days: number) =>
    [...seoKeys.all, 'gsc', postId, days] as const,
  topPosts: (limit: number, days: number) =>
    [...seoKeys.all, 'top-posts', limit, days] as const,
};

// ===== HOOKS =====

/**
 * Get SEO health metrics
 */
export function useSeoHealth() {
  return useQuery({
    queryKey: seoKeys.health(),
    queryFn: () => seoApi.getHealth(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get SEO analysis for a post
 */
export function useSeoAnalysis(postId: string | undefined) {
  return useQuery({
    queryKey: seoKeys.analysis(postId!),
    queryFn: () => seoApi.analyzePost(postId!),
    enabled: !!postId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get schema markup for a post
 */
export function useSeoSchema(postId: string | undefined) {
  return useQuery({
    queryKey: seoKeys.schema(postId!),
    queryFn: () => seoApi.getSchema(postId!),
    enabled: !!postId,
  });
}

/**
 * Validate schema markup
 */
export function useValidateSchema(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seoApi.validateSchema(postId),
    onSuccess: (data) => {
      if (data.valid) {
        toast.success('Schema markup is valid!');
      } else {
        toast.error(`Schema validation failed: ${data.errors.join(', ')}`);
      }
    },
    onError: () => {
      toast.error('Failed to validate schema');
    },
  });
}

/**
 * Get SEO history for a post
 */
export function useSeoHistory(postId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: seoKeys.history(postId!, days),
    queryFn: () => seoApi.getHistory(postId!, days),
    enabled: !!postId,
  });
}

/**
 * Get SEO trends for a post
 */
export function useSeoTrends(postId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: seoKeys.trends(postId!, days),
    queryFn: () => seoApi.getTrends(postId!, days),
    enabled: !!postId,
  });
}

/**
 * Get GSC data for a post
 */
export function useGSCData(postId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: seoKeys.gsc(postId!, days),
    queryFn: () => seoApi.getGSCData(postId!, days),
    enabled: !!postId,
  });
}

/**
 * Sync GSC data (Admin only)
 */
export function useSyncGSC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: number = 7) => seoApi.syncGSC(days),
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} records in ${data.duration}s`);
      // Invalidate all GSC queries
      queryClient.invalidateQueries({ queryKey: seoKeys.all });
    },
    onError: () => {
      toast.error('Failed to sync GSC data');
    },
  });
}

/**
 * Get top performing posts
 */
export function useTopPosts(limit: number = 10, days: number = 30) {
  return useQuery({
    queryKey: seoKeys.topPosts(limit, days),
    queryFn: () => seoApi.getTopPosts(limit, days),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}
```

---

## 🎨 UI COMPONENTS

### 1. SEO Score Card

**File**: `components/admin/seo/SeoScoreCard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useSeoAnalysis } from '@/hooks/useSeo';
import { Skeleton } from '@/components/ui/skeleton';

interface SeoScoreCardProps {
  postId: string;
}

export function SeoScoreCard({ postId }: SeoScoreCardProps) {
  const { data: analysis, isLoading, error } = useSeoAnalysis(postId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Unable to load SEO analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>SEO Analysis</span>
          <div className="flex items-center gap-2">
            {getScoreIcon(analysis.overallScore)}
            <span className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Overall SEO Score</span>
            <Badge variant={analysis.overallScore >= 80 ? 'default' : 'secondary'}>
              {getScoreLabel(analysis.overallScore)}
            </Badge>
          </div>
          <Progress 
            value={analysis.overallScore} 
            className="h-2"
            indicatorClassName={
              analysis.overallScore >= 80 
                ? 'bg-green-600' 
                : analysis.overallScore >= 60 
                ? 'bg-yellow-600' 
                : 'bg-red-600'
            }
          />
        </div>

        {/* Readability */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Readability</span>
            <span className="text-sm text-muted-foreground">
              {analysis.basic.readabilityScore}%
            </span>
          </div>
          <Progress value={analysis.basic.readabilityScore} className="h-2" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Keyword Density</p>
            <p className="text-lg font-semibold">
              {(analysis.basic.keywordDensity * 100).toFixed(2)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Word Count</p>
            <p className="text-lg font-semibold">
              {analysis.basic.wordCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Internal Links</p>
            <p className="text-lg font-semibold">
              {analysis.links.internalLinks}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Images with Alt</p>
            <p className="text-lg font-semibold">
              {analysis.images.imagesWithAlt}/{analysis.images.totalImages}
            </p>
          </div>
        </div>

        {/* Top Suggestions */}
        {analysis.recommendations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Top Suggestions:</h4>
            <ul className="space-y-1">
              {analysis.recommendations.slice(0, 3).map((suggestion, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
            {analysis.recommendations.length > 3 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{analysis.recommendations.length - 3} more suggestions
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 2. SEO Trend Chart

**File**: `components/admin/seo/SeoTrendChart.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSeoTrends } from '@/hooks/useSeo';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SeoTrendChartProps {
  postId: string;
  days?: number;
}

export function SeoTrendChart({ postId, days = 30 }: SeoTrendChartProps) {
  const { data: trends, isLoading } = useSeoTrends(postId, days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!trends) return null;

  const getTrendIcon = () => {
    switch (trends.trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    switch (trends.trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>SEO Trend ({days} days)</span>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {trends.change > 0 ? '+' : ''}{trends.change} points
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trends.dataPoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
            />
            <YAxis domain={[0, 100]} />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString('vi-VN')}
              formatter={(value: number) => [`${value} points`, 'SEO Score']}
            />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Insights */}
        {trends.insights.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Insights:</h4>
            <ul className="space-y-1">
              {trends.insights.map((insight, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 3. GSC Performance Card

**File**: `components/admin/seo/GSCPerformanceCard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGSCData } from '@/hooks/useSeo';
import { MousePointerClick, Eye, TrendingUp, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface GSCPerformanceCardProps {
  postId: string;
  days?: number;
}

export function GSCPerformanceCard({ postId, days = 30 }: GSCPerformanceCardProps) {
  const { data: gscData, isLoading } = useGSCData(postId, days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!gscData || gscData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Search Console</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No GSC data available for this period
          </p>
        </CardContent>
      </Card>
    );
  }

  // Aggregate data
  const totalClicks = gscData.reduce((sum, d) => sum + d.clicks, 0);
  const totalImpressions = gscData.reduce((sum, d) => sum + d.impressions, 0);
  const avgCtr = totalClicks / totalImpressions;
  const avgPosition = gscData.reduce((sum, d) => sum + d.position, 0) / gscData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Search Console ({days} days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Clicks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs">Clicks</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
          </div>

          {/* Impressions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-xs">Impressions</span>
            </div>
            <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
          </div>

          {/* CTR */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">CTR</span>
            </div>
            <p className="text-2xl font-bold">{(avgCtr * 100).toFixed(2)}%</p>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-xs">Avg Position</span>
            </div>
            <p className="text-2xl font-bold">{avgPosition.toFixed(1)}</p>
          </div>
        </div>

        {/* Top Queries */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Top Queries:</h4>
          <div className="space-y-2">
            {gscData
              .filter(d => d.query)
              .sort((a, b) => b.clicks - a.clicks)
              .slice(0, 5)
              .map((d, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate">{d.query}</span>
                  <span className="font-medium">{d.clicks} clicks</span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 📄 PAGE IMPLEMENTATIONS

### 1. Post Editor with SEO Sidebar

**File**: `app/admin/posts/[id]/edit/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoScoreCard } from '@/components/admin/seo/SeoScoreCard';
import { SeoTrendChart } from '@/components/admin/seo/SeoTrendChart';
import { GSCPerformanceCard } from '@/components/admin/seo/GSCPerformanceCard';
import { Button } from '@/components/ui/button';
import { Save, Eye } from 'lucide-react';

interface PostEditPageProps {
  params: { id: string };
}

export default function PostEditPage({ params }: PostEditPageProps) {
  const [post, setPost] = useState<any>(null);

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Edit Post</h1>
            <div className="flex gap-2">
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="seo">SEO Settings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              {/* Your existing content editor */}
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">Content editor goes here...</p>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              {/* SEO settings form */}
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">SEO settings form goes here...</p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              {/* Advanced settings */}
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">Advanced settings go here...</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* SEO Sidebar - 1/3 width */}
        <div className="space-y-6">
          <SeoScoreCard postId={params.id} />
          <SeoTrendChart postId={params.id} days={30} />
          <GSCPerformanceCard postId={params.id} days={30} />
        </div>
      </div>
    </div>
  );
}
```

---

### 2. SEO Dashboard Page

**File**: `app/admin/seo/page.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSeoHealth, useTopPosts, useSyncGSC } from '@/hooks/useSeo';
import { TrendingUp, Eye, MousePointerClick, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function SEODashboardPage() {
  const { data: health, isLoading: healthLoading } = useSeoHealth();
  const { data: topPosts, isLoading: topPostsLoading } = useTopPosts(10, 30);
  const { mutate: syncGSC, isPending: isSyncing } = useSyncGSC();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Dashboard</h1>
          <p className="text-muted-foreground">
            Tổng quan về hiệu suất SEO của website
          </p>
        </div>
        <Button 
          onClick={() => syncGSC(7)}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync GSC Data
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average SEO Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{health?.averageSeoScore || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all posts
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Posts Above 80</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{health?.postsAbove80 || 0}</div>
                <p className="text-xs text-muted-foreground">
                  High quality content
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{health?.totalPosts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  In database
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Need Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{health?.postsNeedImprovement || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Below 80 score
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Posts (Last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {topPostsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : topPosts && topPosts.length > 0 ? (
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <div 
                  key={post.postId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <Link 
                        href={`/admin/posts/${post.postId}/edit`}
                        className="font-medium hover:underline"
                      >
                        {post.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        /{post.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MousePointerClick className="h-3 w-3" />
                        <span className="text-xs">Clicks</span>
                      </div>
                      <p className="text-lg font-semibold">{post.totalClicks.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">Impressions</span>
                      </div>
                      <p className="text-lg font-semibold">{post.totalImpressions.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-xs">CTR</span>
                      </div>
                      <p className="text-lg font-semibold">{(post.avgCtr * 100).toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">Position</span>
                      <p className="text-lg font-semibold">{post.avgPosition.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🧪 TESTING & VALIDATION

### Test Checklist

```typescript
// File: __tests__/seo/seo-integration.test.ts

describe('SEO Integration', () => {
  describe('API Client', () => {
    it('should fetch SEO health metrics', async () => {
      const health = await seoApi.getHealth();
      expect(health).toHaveProperty('totalPosts');
      expect(health).toHaveProperty('averageSeoScore');
    });

    it('should analyze a post', async () => {
      const analysis = await seoApi.analyzePost('test-post-id');
      expect(analysis).toHaveProperty('overallScore');
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(100);
    });

    it('should get schema markup', async () => {
      const schema = await seoApi.getSchema('test-post-id');
      expect(schema).toHaveProperty('@context');
      expect(schema['@context']).toBe('https://schema.org');
    });
  });

  describe('React Hooks', () => {
    it('should load SEO analysis', async () => {
      const { result } = renderHook(() => useSeoAnalysis('test-post-id'));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Components', () => {
    it('should render SEO Score Card', () => {
      render(<SeoScoreCard postId="test-post-id" />);
      expect(screen.getByText('SEO Analysis')).toBeInTheDocument();
    });
  });
});
```

---

## ⏱️ TIMELINE & EFFORT ESTIMATION

### Phase 1: Foundation (Week 1) - 20 hours
**Priority: HIGH**

- [ ] Setup API client (`seo.api.ts`) - 2h
- [ ] Create TypeScript interfaces (`seo.types.ts`) - 2h
- [ ] Implement React hooks (`useSeo.ts`) - 3h
- [ ] Create SEO Score Card component - 4h
- [ ] Integrate into Post Editor sidebar - 3h
- [ ] Testing & bug fixes - 6h

**Deliverables**:
- ✅ Working SEO Score Card in Post Editor
- ✅ Real-time SEO analysis
- ✅ Basic metrics display

---

### Phase 2: Dashboard & Charts (Week 2) - 16 hours
**Priority: MEDIUM**

- [ ] Create SEO Dashboard page - 4h
- [ ] Implement SEO Trend Chart component - 4h
- [ ] Implement GSC Performance Card - 4h
- [ ] Add Top Posts widget - 2h
- [ ] Testing & refinement - 2h

**Deliverables**:
- ✅ SEO Dashboard với overview metrics
- ✅ Trend visualization
- ✅ GSC integration

---

### Phase 3: Advanced Features (Week 3-4) - 24 hours
**Priority: LOW**

- [ ] SEO Meta Editor component - 6h
- [ ] Open Graph Editor - 6h
- [ ] Twitter Card Editor - 4h
- [ ] Schema Markup Editor - 6h
- [ ] Advanced testing - 2h

**Deliverables**:
- ✅ Full SEO editing capabilities
- ✅ Social media preview
- ✅ Schema customization

---

### Total Effort
- **Minimum (Phase 1 only)**: 20 hours
- **Recommended (Phase 1 + 2)**: 36 hours
- **Complete (All phases)**: 60 hours

### Team Size
- **1 Frontend Developer**: 3-4 tuần
- **2 Frontend Developers**: 2 tuần

---

## 📝 NOTES & RECOMMENDATIONS

### Best Practices
1. **Caching**: Sử dụng React Query với staleTime phù hợp
2. **Error Handling**: Luôn có fallback UI khi API fail
3. **Loading States**: Skeleton loaders cho UX tốt hơn
4. **Responsive**: Đảm bảo mobile-friendly
5. **Performance**: Lazy load components nặng

### Common Pitfalls
- ❌ Không check `postId` undefined trước khi call API
- ❌ Quên invalidate cache sau mutations
- ❌ Không handle loading/error states
- ❌ Hard-code API URLs thay vì dùng env variables

### Support
- **API Documentation**: http://localhost:3003/api-docs
- **Backend Team**: Ping khi có vấn đề về API
- **Testing**: Dùng Postman/Swagger để test API trước

---

**Status**: ✅ READY FOR IMPLEMENTATION  
**Last Updated**: 2026-02-10  
**Version**: 1.0
