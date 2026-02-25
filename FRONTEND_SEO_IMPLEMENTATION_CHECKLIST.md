# ✅ FRONTEND SEO IMPLEMENTATION CHECKLIST

## 📋 OVERVIEW

Checklist này giúp Frontend team theo dõi tiến độ implementation của SEO system.

**Estimated Total Effort**: 36-60 hours  
**Recommended Team Size**: 1-2 developers  
**Timeline**: 2-4 weeks

---

## 🔙 BACKEND STATUS
- ✅ **Phase 1: Core Analysis & Health** (Ready)
- ✅ **Phase 2: Auto-linking System** (Ready)
- ⏳ **Phase 3: Schema Advanced** (Pending)
- ⏳ **Phase 4: GSC OAuth** (Pending)
- ⏳ **Phase 5-7: Advanced Features** (Pending)

---

## 🎯 PHASE 1: FOUNDATION (Week 1) - HIGH PRIORITY

### Setup & Configuration (2 hours)
- [ ] Cài đặt dependencies
  - [ ] `@tanstack/react-query` (nếu chưa có)
  - [ ] `recharts` hoặc `chart.js` (cho charts)
  - [ ] Shadcn/UI components: `card`, `progress`, `badge`, `tabs`, `skeleton`
- [ ] Setup environment variables
  - [ ] `NEXT_PUBLIC_API_URL=http://localhost:3003/api`
  - [ ] `NEXT_PUBLIC_API_URL_PROD=https://api.erg.edu.vn/api`

### TypeScript Types (2 hours)
- [ ] Tạo file `types/seo.types.ts`
  - [ ] `SeoHealth` interface
  - [ ] `SeoAnalysis` interface (với 5 sub-interfaces)
  - [ ] `SchemaMarkup` interface
  - [ ] `SeoHistory` interface
  - [ ] `SeoTrends` interface
  - [ ] `GSCData` interface
  - [ ] `TopPost` interface

### API Client (3 hours)
- [ ] Tạo file `lib/api/seo.api.ts`
  - [ ] `getHealth()` method
  - [ ] `analyzePost(postId)` method
  - [ ] `getSchema(postId)` method
  - [ ] `validateSchema(postId)` method
  - [ ] `getHistory(postId, days)` method
  - [ ] `getTrends(postId, days)` method
  - [ ] `getGSCData(postId, days)` method
  - [ ] `syncGSC(days)` method
  - [ ] `getTopPosts(limit, days)` method
- [ ] Test tất cả methods với Postman/curl

### React Hooks (3 hours)
- [ ] Tạo file `hooks/useSeo.ts`
  - [ ] Define query keys (`seoKeys`)
  - [ ] `useSeoHealth()` hook
  - [ ] `useSeoAnalysis(postId)` hook
  - [ ] `useSeoSchema(postId)` hook
  - [ ] `useValidateSchema(postId)` mutation
  - [ ] `useSeoHistory(postId, days)` hook
  - [ ] `useSeoTrends(postId, days)` hook
  - [ ] `useGSCData(postId, days)` hook
  - [ ] `useSyncGSC()` mutation
  - [ ] `useTopPosts(limit, days)` hook
- [ ] Test hooks trong một test component

### SEO Score Card Component (4 hours)
- [ ] Tạo file `components/admin/seo/SeoScoreCard.tsx`
  - [ ] Import dependencies
  - [ ] Use `useSeoAnalysis` hook
  - [ ] Loading state với Skeleton
  - [ ] Error state
  - [ ] Display overall score với icon (green/yellow/red)
  - [ ] Progress bar cho overall score
  - [ ] Progress bar cho readability
  - [ ] Metrics grid (keyword density, word count, links, images)
  - [ ] Top 3 suggestions
  - [ ] Responsive design
- [ ] Test component với mock data
- [ ] Test component với real API

### Integration vào Post Editor (3 hours)
- [ ] Mở file Post Editor page
  - [ ] Thêm grid layout (2/3 main, 1/3 sidebar)
  - [ ] Thêm `<SeoScoreCard postId={params.id} />` vào sidebar
  - [ ] Test responsive layout
  - [ ] Test với nhiều post IDs khác nhau
- [ ] Verify real-time updates khi edit content

### Testing & Bug Fixes (3 hours)
- [ ] Test với post có content dài
- [ ] Test với post có content ngắn
- [ ] Test với post không có content
- [ ] Test với invalid postId
- [ ] Test loading states
- [ ] Test error states
- [ ] Fix bugs phát hiện được
- [ ] Code review

**Phase 1 Deliverables**:
- ✅ SEO Score Card hiển thị trong Post Editor
- ✅ Real-time SEO analysis
- ✅ Basic metrics display
- ✅ Suggestions list

---

## 📊 PHASE 2: DASHBOARD & CHARTS (Week 2) - MEDIUM PRIORITY

### SEO Trend Chart Component (4 hours)
- [ ] Tạo file `components/admin/seo/SeoTrendChart.tsx`
  - [ ] Import Recharts components
  - [ ] Use `useSeoTrends` hook
  - [ ] Loading state
  - [ ] Line chart với dataPoints
  - [ ] Trend indicator (improving/declining/stable)
  - [ ] Change display (+/- points)
  - [ ] Insights list
  - [ ] Responsive chart
- [ ] Test với different time periods (7, 30, 90 days)

### GSC Performance Card Component (4 hours)
- [ ] Tạo file `components/admin/seo/GSCPerformanceCard.tsx`
  - [ ] Use `useGSCData` hook
  - [ ] Loading state
  - [ ] Metrics grid (clicks, impressions, CTR, position)
  - [ ] Top queries list
  - [ ] Device breakdown (optional)
  - [ ] Country breakdown (optional)
- [ ] Test với posts có GSC data
- [ ] Test với posts không có GSC data

### SEO Dashboard Page (4 hours)
- [ ] Tạo file `app/admin/seo/page.tsx`
  - [ ] Page header với title
  - [ ] Sync GSC button
  - [ ] Health metrics cards (4 cards)
    - [ ] Average SEO Score
    - [ ] Posts Above 80
    - [ ] Total Posts
    - [ ] Need Improvement
  - [ ] Top Performing Posts table
    - [ ] Rank number
    - [ ] Post title (link to editor)
    - [ ] Clicks, Impressions, CTR, Position
    - [ ] Trend indicator
  - [ ] Responsive grid layout
- [ ] Add navigation link to sidebar menu

### Sync GSC Functionality (2 hours)
- [ ] Implement sync button click handler
  - [ ] Use `useSyncGSC` mutation
  - [ ] Loading state (spinner)
  - [ ] Success toast
  - [ ] Error toast
  - [ ] Invalidate queries after sync
- [ ] Test sync với auth token
- [ ] Test sync without auth (should fail)

### Testing & Refinement (2 hours)
- [ ] Test dashboard với different data scenarios
- [ ] Test charts responsiveness
- [ ] Test table sorting/filtering (if implemented)
- [ ] Performance testing
- [ ] Fix bugs
- [ ] Code review

**Phase 2 Deliverables**:
- ✅ SEO Dashboard page
- ✅ Trend visualization
- ✅ GSC integration
- ✅ Top posts widget
- ✅ Sync functionality

---

## 🎨 PHASE 3: ADVANCED FEATURES (Week 3-4) - LOW PRIORITY

### SEO Meta Editor Component (6 hours)
- [ ] Tạo file `components/admin/seo/SeoMetaEditor.tsx`
  - [ ] Meta title input (với character counter)
  - [ ] Meta description textarea (với character counter)
  - [ ] Focus keyword input
  - [ ] Keywords input (comma-separated)
  - [ ] Canonical URL input
  - [ ] Preview card
  - [ ] Save functionality
- [ ] Integrate vào Post Editor (SEO tab)
- [ ] Test save/update

### Open Graph Editor Component (6 hours)
- [ ] Tạo file `components/admin/seo/OpenGraphEditor.tsx`
  - [ ] OG title input
  - [ ] OG description textarea
  - [ ] OG image upload/select
  - [ ] OG type select
  - [ ] Facebook preview card
  - [ ] Save functionality
- [ ] Integrate vào Post Editor (SEO tab)
- [ ] Test với Facebook Debugger

### Twitter Card Editor Component (4 hours)
- [ ] Tạo file `components/admin/seo/TwitterCardEditor.tsx`
  - [ ] Card type select (summary/summary_large_image)
  - [ ] Twitter title input
  - [ ] Twitter description textarea
  - [ ] Twitter image upload/select
  - [ ] Twitter preview card
  - [ ] Save functionality
- [ ] Integrate vào Post Editor (SEO tab)
- [ ] Test với Twitter Card Validator

### Schema Markup Editor Component (6 hours)
- [ ] Tạo file `components/admin/seo/SchemaMarkupEditor.tsx`
  - [ ] Schema type selector
  - [ ] FAQ items editor (add/remove/edit)
  - [ ] HowTo steps editor (add/remove/edit)
  - [ ] JSON preview (read-only)
  - [ ] Validate button
  - [ ] Validation results display
  - [ ] Save functionality
- [ ] Integrate vào Post Editor (SEO tab)
- [ ] Test với Google Rich Results Test

### Advanced Testing (2 hours)
- [ ] Test tất cả editors
- [ ] Test save/update functionality
- [ ] Test validation
- [ ] Test preview cards
- [ ] Integration testing
- [ ] Fix bugs
- [ ] Code review

**Phase 3 Deliverables**:
- ✅ Full SEO editing capabilities
- ✅ Social media preview
- ✅ Schema customization
- ✅ Validation tools

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] API client methods
- [ ] React hooks
- [ ] Component rendering
- [ ] Component interactions

### Integration Tests
- [ ] API integration
- [ ] Component integration
- [ ] Page integration
- [ ] Navigation flow

### E2E Tests
- [ ] Complete user flow: Edit post → See SEO score → Improve content → See score increase
- [ ] Dashboard flow: View dashboard → Sync GSC → See updated data
- [ ] SEO settings flow: Edit meta → Save → Verify saved

### Manual Testing
- [ ] Test với real posts
- [ ] Test với different content lengths
- [ ] Test với different SEO scores
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test loading states
- [ ] Test error states
- [ ] Test empty states

### Validation Testing
- [ ] Test với Google Rich Results Test
- [ ] Test với Facebook Debugger
- [ ] Test với Twitter Card Validator
- [ ] Test với Schema.org Validator

---

## 📱 RESPONSIVE DESIGN CHECKLIST

### Mobile (< 768px)
- [ ] SEO Score Card stacks vertically
- [ ] Charts are readable
- [ ] Tables scroll horizontally
- [ ] Buttons are touch-friendly
- [ ] Forms are easy to fill

### Tablet (768px - 1024px)
- [ ] Grid layouts adapt properly
- [ ] Sidebar doesn't overlap content
- [ ] Charts maintain aspect ratio

### Desktop (> 1024px)
- [ ] Full grid layout works
- [ ] Sidebar is visible
- [ ] Charts are optimal size

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-deployment
- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings
- [ ] Code reviewed
- [ ] Documentation updated

### Environment Variables
- [ ] Production API URL configured
- [ ] Environment-specific configs set

### Performance
- [ ] Lazy loading implemented for heavy components
- [ ] Images optimized
- [ ] Bundle size checked
- [ ] Lighthouse score > 90

### SEO Validation
- [ ] Test production URLs với validation tools
- [ ] Verify schema markup renders correctly
- [ ] Verify OG tags work on social media
- [ ] Verify Twitter cards work

---

## 📊 PROGRESS TRACKING

### Week 1 Progress
- [ ] Day 1-2: Setup, Types, API Client
- [ ] Day 3: React Hooks
- [ ] Day 4: SEO Score Card
- [ ] Day 5: Integration & Testing

### Week 2 Progress
- [ ] Day 1: Trend Chart
- [ ] Day 2: GSC Card
- [ ] Day 3: Dashboard Page
- [ ] Day 4: Sync & Testing
- [ ] Day 5: Bug fixes & refinement

### Week 3-4 Progress (Optional)
- [ ] Week 3: Meta & OG Editors
- [ ] Week 4: Twitter & Schema Editors, Testing

---

## 🎯 SUCCESS CRITERIA

### Minimum Success (Phase 1)
- ✅ SEO Score Card works in Post Editor
- ✅ Shows accurate SEO analysis
- ✅ Updates in real-time
- ✅ Provides actionable suggestions

### Recommended Success (Phase 1 + 2)
- ✅ Dashboard shows health metrics
- ✅ Trend charts visualize progress
- ✅ GSC integration works
- ✅ Top posts widget functional

### Complete Success (All Phases)
- ✅ Full SEO editing capabilities
- ✅ Social media previews work
- ✅ Schema validation passes
- ✅ All tests passing
- ✅ Production-ready

---

## 📞 SUPPORT & RESOURCES

### Documentation
- [ ] Read `FRONTEND_SEO_COMPLETE_GUIDE.md`
- [ ] Read `SEO_API_QUICK_REFERENCE.md`
- [ ] Bookmark Swagger UI: http://localhost:3003/api-docs

### Tools
- [ ] Import Postman collection: `postman/SEO_API_Collection.json`
- [ ] Use Google Rich Results Test
- [ ] Use Facebook Debugger
- [ ] Use Twitter Card Validator

### Communication
- [ ] Backend team contact for API issues
- [ ] Design team for UI/UX questions
- [ ] Product team for feature clarifications

---

## 🐛 KNOWN ISSUES & WORKAROUNDS

### Issue 1: API returns 404
**Workaround**: Verify server is running and URL is correct

### Issue 2: CORS errors
**Workaround**: Backend already configured, check frontend URL

### Issue 3: Empty GSC data
**Workaround**: Run sync first, or wait for scheduled sync

---

**Last Updated**: 2026-02-10  
**Version**: 1.0  
**Status**: Ready for implementation
