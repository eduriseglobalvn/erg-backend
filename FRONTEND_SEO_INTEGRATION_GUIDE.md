# 🎨 FRONTEND INTEGRATION GUIDE - Advanced SEO System

## 📋 TỔNG QUAN

Tài liệu này hướng dẫn Frontend team tích hợp hệ thống SEO vào Admin CMS.

**Backend API Base URL**: `http://localhost:3003` (dev) / `https://api.erg.edu.vn` (prod)

---

## 🔌 BƯỚC 1: TẠO API CLIENT

### File: `lib/api/seo.api.ts`

```typescript
import { api } from './client';

export interface SeoAnalysis {
  overallScore: number;
  basic: {
    score: number;
    readabilityScore: number;
    keywordDensity: number;
    wordCount: number;
    suggestions: string[];
  };
  links: {
    internalLinks: number;
    externalLinks: number;
    nofollowLinks: number;
    suggestions: string[];
  };
  images: {
    totalImages: number;
    imagesWithAlt: number;
    imagesWithoutAlt: string[];
    suggestions: string[];
  };
  headings: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    hierarchy: boolean;
    suggestions: string[];
  };
  freshness: {
    score: number;
    daysSincePublished: number;
    daysSinceUpdated: number;
    suggestion: string;
  };
  recommendations: string[];
}

export interface SchemaMarkup {
  '@context': string;
  '@graph': any[];
}

export interface SeoHistory {
  id: string;
  postId: string;
  seoScore: number;
  readabilityScore: number;
  keywordDensity: number;
  wordCount: number;
  suggestions: string[];
  metadata: any;
  createdAt: string;
}

export interface GSCData {
  id: string;
  postId: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export const seoApi = {
  // Get comprehensive SEO analysis
  analyzePost: async (postId: string): Promise<SeoAnalysis> => {
    const { data } = await api.get(`/seo/analyze/${postId}`);
    return data;
  },

  // Get schema markup
  getSchema: async (postId: string): Promise<SchemaMarkup> => {
    const { data } = await api.get(`/seo/schema/${postId}`);
    return data;
  },

  // Validate schema
  validateSchema: async (postId: string) => {
    const { data } = await api.post(`/seo/schema/${postId}/validate`);
    return data;
  },

  // Get SEO history
  getHistory: async (postId: string, days: number = 30): Promise<SeoHistory[]> => {
    const { data } = await api.get(`/seo/history/${postId}?days=${days}`);
    return data;
  },

  // Get SEO trends
  getTrends: async (postId: string, days: number = 30) => {
    const { data } = await api.get(`/seo/trends/${postId}?days=${days}`);
    return data;
  },

  // Get Google Search Console data
  getGSCData: async (postId: string, days: number = 30): Promise<GSCData[]> => {
    const { data } = await api.get(`/seo/gsc/${postId}?days=${days}`);
    return data;
  },

  // Sync GSC data (admin only)
  syncGSC: async (days: number = 7) => {
    const { data } = await api.post(`/seo/gsc/sync?days=${days}`);
    return data;
  },

  // Get top performing posts
  getTopPosts: async (limit: number = 10, days: number = 30) => {
    const { data } = await api.get(`/seo/gsc/top-posts?limit=${limit}&days=${days}`);
    return data;
  },

  // Get SEO health metrics
  getHealth: async () => {
    const { data } = await api.get('/seo/health');
    return data;
  },
};
```

---

## 🎯 BƯỚC 2: TẠO REACT HOOKS

### File: `hooks/useSeoAnalysis.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { seoApi } from '@/lib/api/seo.api';

export function useSeoAnalysis(postId: string | undefined) {
  return useQuery({
    queryKey: ['seo-analysis', postId],
    queryFn: () => seoApi.analyzePost(postId!),
    enabled: !!postId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSeoSchema(postId: string | undefined) {
  return useQuery({
    queryKey: ['seo-schema', postId],
    queryFn: () => seoApi.getSchema(postId!),
    enabled: !!postId,
  });
}

export function useSeoHistory(postId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ['seo-history', postId, days],
    queryFn: () => seoApi.getHistory(postId!, days),
    enabled: !!postId,
  });
}

export function useSeoHealth() {
  return useQuery({
    queryKey: ['seo-health'],
    queryFn: () => seoApi.getHealth(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

---

## 📊 BƯỚC 3: TẠO SEO SCORE CARD COMPONENT

### File: `components/admin/seo/SeoScoreCard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useSeoAnalysis } from '@/hooks/useSeoAnalysis';

interface SeoScoreCardProps {
  postId: string;
}

export function SeoScoreCard({ postId }: SeoScoreCardProps) {
  const { data: analysis, isLoading } = useSeoAnalysis(postId);

  if (isLoading) {
    return <Card><CardContent className="p-6">Loading SEO analysis...</CardContent></Card>;
  }

  if (!analysis) return null;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>SEO Analysis</span>
          <div className="flex items-center gap-2">
            {getScoreIcon(analysis.overallScore)}
            <span className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}/100
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Overall SEO Score</span>
            <span className="text-sm text-muted-foreground">{analysis.overallScore}%</span>
          </div>
          <Progress value={analysis.overallScore} className="h-2" />
        </div>

        {/* Readability */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Readability</span>
            <span className="text-sm text-muted-foreground">{analysis.basic.readabilityScore}%</span>
          </div>
          <Progress value={analysis.basic.readabilityScore} className="h-2" />
        </div>

        {/* Keyword Density */}
        <div className="flex justify-between">
          <span className="text-sm font-medium">Keyword Density</span>
          <Badge variant="outline">{(analysis.basic.keywordDensity * 100).toFixed(2)}%</Badge>
        </div>

        {/* Word Count */}
        <div className="flex justify-between">
          <span className="text-sm font-medium">Word Count</span>
          <Badge variant="outline">{analysis.basic.wordCount} words</Badge>
        </div>

        {/* Suggestions */}
        {analysis.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Suggestions:</h4>
            <ul className="space-y-1">
              {analysis.recommendations.slice(0, 5).map((suggestion, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>{suggestion}</span>
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

## 🖊️ BƯỚC 4: TÍCH HỢP VÀO POST EDITOR

### File: `app/admin/posts/[id]/edit/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoScoreCard } from '@/components/admin/seo/SeoScoreCard';
// ... other imports

export default function PostEditPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<any>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Editor */}
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            {/* Existing content editor */}
          </TabsContent>

          <TabsContent value="seo">
            {/* SEO settings sẽ implement sau */}
            <p>SEO Settings (Coming soon)</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <SeoScoreCard postId={params.id} />
        {/* Other sidebar components */}
      </div>
    </div>
  );
}
```

---

## 📈 BƯỚC 5: TẠO SEO DASHBOARD

### File: `app/admin/seo/page.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Eye, MousePointerClick } from 'lucide-react';
import { useSeoHealth } from '@/hooks/useSeoAnalysis';

export default function SEODashboardPage() {
  const { data: health } = useSeoHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SEO Dashboard</h1>
        <p className="text-muted-foreground">
          Tổng quan về hiệu suất SEO của website
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average SEO Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.averageSeoScore || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all posts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Posts Above 80</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.postsAbove80 || 0}</div>
            <p className="text-xs text-muted-foreground">
              High quality content
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.totalPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              In database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Need Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.postsNeedImprovement || 0}</div>
            <p className="text-xs text-muted-foreground">
              Below 80 score
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 🧪 TESTING

### 1. Test API Connection

```typescript
// Test trong browser console
fetch('http://localhost:3003/seo/health')
  .then(res => res.json())
  .then(console.log);
```

### 2. Test với một Post ID thật

```typescript
const postId = 'YOUR_POST_ID_HERE';
fetch(`http://localhost:3003/seo/analyze/${postId}`)
  .then(res => res.json())
  .then(console.log);
```

---

## 📦 DEPENDENCIES CẦN CÀI

```bash
# React Query (nếu chưa có)
npm install @tanstack/react-query

# Shadcn UI components (nếu chưa có)
npx shadcn-ui@latest add card
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs
```

---

## 🔐 AUTHENTICATION

Tất cả API endpoints đều **KHÔNG** yêu cầu authentication, trừ:
- `POST /seo/gsc/sync` - Cần JWT token

```typescript
// Example với auth
const { data } = await api.post('/seo/gsc/sync?days=7', {}, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

---

## 📝 CHECKLIST IMPLEMENTATION

### Phase 1: Basic Integration (Week 1)
- [ ] Tạo `seo.api.ts`
- [ ] Tạo `useSeoAnalysis.ts` hook
- [ ] Tạo `SeoScoreCard` component
- [ ] Tích hợp vào Post Editor sidebar

### Phase 2: Dashboard (Week 2)
- [ ] Tạo SEO Dashboard page
- [ ] Hiển thị health metrics
- [ ] Thêm charts (optional)

### Phase 3: Advanced Features (Week 3-4)
- [ ] SEO Meta Editor component
- [ ] Open Graph Editor
- [ ] Twitter Card Editor
- [ ] Schema Markup Editor

---

## 🎯 PRIORITY

**HIGH PRIORITY** (Làm ngay):
1. ✅ API Client (`seo.api.ts`)
2. ✅ React Hooks (`useSeoAnalysis.ts`)
3. ✅ SEO Score Card trong Post Editor

**MEDIUM PRIORITY** (Tuần sau):
4. SEO Dashboard page
5. SEO Meta Editor

**LOW PRIORITY** (Tùy chọn):
6. Advanced editors (OG, Twitter, Schema)
7. Charts và visualizations

---

**Timeline**: 2-4 tuần  
**Effort**: 40-60 giờ  
**Status**: Ready for implementation
