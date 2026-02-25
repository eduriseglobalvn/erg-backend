# 📚 SWAGGER API DOCUMENTATION GUIDE

## 🚀 SETUP SWAGGER

### Bước 1: Cấu hình Swagger trong main.ts

**File**: `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ===== SWAGGER CONFIGURATION =====
  const config = new DocumentBuilder()
    .setTitle('ERG Backend API')
    .setDescription('EDURISE GLOBAL - Advanced SEO & Content Management System')
    .setVersion('1.0')
    .addTag('SEO', 'SEO Analysis & Optimization endpoints')
    .addTag('Posts', 'Content Management endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .addBearerAuth() // Enable JWT authentication
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Lưu token khi refresh
      tagsSorter: 'alpha', // Sắp xếp tags theo alphabet
      operationsSorter: 'alpha', // Sắp xếp operations theo alphabet
    },
  });

  await app.listen(3003);
  console.log(`🚀 Application is running on: http://localhost:3003`);
  console.log(`📚 Swagger API Docs: http://localhost:3003/api-docs`);
}
bootstrap();
```

---

## 🎯 TRUY CẬP SWAGGER UI

### Development
```
http://localhost:3003/api-docs
```

### Production
```
https://api.erg.edu.vn/api-docs
```

---

## 📖 CÁCH SỬ DỤNG SWAGGER UI

### 1. Xem danh sách API Endpoints

Khi mở Swagger UI, bạn sẽ thấy:

```
┌─────────────────────────────────────┐
│ ERG Backend API                     │
│ Version 1.0                         │
├─────────────────────────────────────┤
│ 📂 SEO                              │
│   GET    /seo/analyze/{postId}      │
│   GET    /seo/schema/{postId}       │
│   POST   /seo/schema/{postId}/validate │
│   GET    /seo/history/{postId}      │
│   GET    /seo/trends/{postId}       │
│   GET    /seo/gsc/{postId}          │
│   POST   /seo/gsc/sync              │
│   GET    /seo/gsc/top-posts         │
│   GET    /seo/health                │
├─────────────────────────────────────┤
│ 📂 Posts                            │
│   GET    /posts                     │
│   POST   /posts                     │
│   ...                               │
└─────────────────────────────────────┘
```

### 2. Test một API Endpoint

**Ví dụ: Test GET /seo/health**

1. Click vào endpoint `GET /seo/health`
2. Click nút **"Try it out"**
3. Click nút **"Execute"**
4. Xem kết quả trong phần **"Response"**

**Response Example:**
```json
{
  "totalPosts": 150,
  "postsAbove80": 45,
  "averageSeoScore": 72,
  "postsNeedImprovement": 105
}
```

### 3. Test với Parameters

**Ví dụ: Test GET /seo/analyze/{postId}**

1. Click vào endpoint `GET /seo/analyze/{postId}`
2. Click **"Try it out"**
3. Nhập `postId` vào ô input (ví dụ: `123e4567-e89b-12d3-a456-426614174000`)
4. Click **"Execute"**
5. Xem kết quả

**Response Example:**
```json
{
  "overallScore": 85,
  "basic": {
    "score": 90,
    "readabilityScore": 75,
    "keywordDensity": 0.025,
    "wordCount": 1500,
    "suggestions": [
      "Content length is good",
      "Keyword density is optimal"
    ]
  },
  "links": {
    "internalLinks": 5,
    "externalLinks": 3,
    "nofollowLinks": 1,
    "suggestions": []
  },
  "recommendations": [
    "Add more internal links",
    "Improve readability score"
  ]
}
```

### 4. Test với Query Parameters

**Ví dụ: Test GET /seo/history/{postId}?days=30**

1. Click vào endpoint
2. Click **"Try it out"**
3. Nhập `postId`
4. Nhập `days` = 30 (hoặc để mặc định)
5. Click **"Execute"**

### 5. Test API cần Authentication

**Ví dụ: Test POST /seo/gsc/sync**

**Bước 1: Lấy JWT Token**
1. Login vào hệ thống qua API `/auth/login`
2. Copy JWT token từ response

**Bước 2: Authorize trong Swagger**
1. Click nút **"Authorize"** ở góc trên bên phải
2. Nhập token vào ô `Value`: `Bearer YOUR_TOKEN_HERE`
3. Click **"Authorize"**
4. Click **"Close"**

**Bước 3: Test endpoint**
1. Click vào `POST /seo/gsc/sync`
2. Click **"Try it out"**
3. Nhập `days` = 7
4. Click **"Execute"**

---

## 🔧 THÊM SWAGGER DECORATORS VÀO CONTROLLER

### Ví dụ: SEO Controller với đầy đủ decorators

```typescript
import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@ApiTags('SEO') // Nhóm endpoints vào tag "SEO"
@Controller('seo')
export class SeoController {
  
  @Get('analyze/:postId')
  @ApiOperation({ 
    summary: 'Get comprehensive SEO analysis for a post',
    description: 'Analyzes content, links, images, headings, and freshness'
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'UUID of the post to analyze',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'SEO analysis completed successfully',
    schema: {
      example: {
        overallScore: 85,
        basic: { score: 90, readabilityScore: 75 },
        recommendations: ['Add more internal links']
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async analyzePost(@Param('postId') postId: string) {
    // Implementation
  }

  @Get('history/:postId')
  @ApiOperation({ summary: 'Get SEO history for a post' })
  @ApiParam({ name: 'postId', description: 'Post UUID' })
  @ApiQuery({ 
    name: 'days', 
    required: false, 
    type: Number,
    description: 'Number of days to look back',
    example: 30
  })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  async getHistory(
    @Param('postId') postId: string,
    @Query('days') days: number = 30,
  ) {
    // Implementation
  }

  @Post('gsc/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth() // Yêu cầu JWT token
  @ApiOperation({ 
    summary: 'Sync Google Search Console data',
    description: 'Requires authentication. Syncs GSC data for the last N days.'
  })
  @ApiQuery({ 
    name: 'days', 
    required: false, 
    type: Number,
    example: 7
  })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncGSC(@Query('days') days: number = 7) {
    // Implementation
  }
}
```

---

## 📊 SWAGGER DECORATORS REFERENCE

### Controller Level
```typescript
@ApiTags('SEO')              // Nhóm endpoints
@ApiBearerAuth()             // Yêu cầu JWT cho tất cả endpoints
@Controller('seo')
```

### Method Level
```typescript
@ApiOperation({ 
  summary: 'Short description',
  description: 'Detailed description'
})
@ApiResponse({ status: 200, description: 'Success' })
@ApiResponse({ status: 404, description: 'Not found' })
```

### Parameters
```typescript
@ApiParam({ 
  name: 'id', 
  description: 'Resource ID',
  example: '123'
})

@ApiQuery({ 
  name: 'limit', 
  required: false,
  type: Number,
  description: 'Number of items',
  example: 10
})

@ApiBody({ 
  description: 'Create post DTO',
  type: CreatePostDto
})
```

### DTO Decorators
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ 
    description: 'Post title',
    example: 'My awesome post',
    minLength: 3,
    maxLength: 200
  })
  title: string;

  @ApiProperty({ 
    description: 'Post content',
    example: 'This is the content...'
  })
  content: string;

  @ApiProperty({ 
    description: 'Focus keyword for SEO',
    example: 'nestjs tutorial',
    required: false
  })
  focusKeyword?: string;
}
```

---

## 🎨 CUSTOMIZATION

### 1. Thêm Logo và Custom CSS

```typescript
SwaggerModule.setup('api-docs', app, document, {
  customSiteTitle: 'ERG API Docs',
  customfavIcon: 'https://erg.edu.vn/favicon.ico',
  customCss: '.swagger-ui .topbar { display: none }', // Ẩn topbar
});
```

### 2. Export Swagger JSON

```typescript
// Lưu swagger spec ra file
import * as fs from 'fs';

const document = SwaggerModule.createDocument(app, config);
fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
```

### 3. Multiple Swagger Instances

```typescript
// API Docs cho Public
const publicConfig = new DocumentBuilder()
  .setTitle('Public API')
  .build();
const publicDocument = SwaggerModule.createDocument(app, publicConfig);
SwaggerModule.setup('api', app, publicDocument);

// API Docs cho Admin
const adminConfig = new DocumentBuilder()
  .setTitle('Admin API')
  .addBearerAuth()
  .build();
const adminDocument = SwaggerModule.createDocument(app, adminConfig);
SwaggerModule.setup('admin-api', app, adminDocument);
```

---

## 🧪 TESTING VỚI SWAGGER

### 1. Test Flow cho SEO System

**Scenario: Phân tích SEO một bài viết**

1. **Get Health Check**
   - Endpoint: `GET /seo/health`
   - Không cần params
   - Xem tổng quan hệ thống

2. **Analyze Post**
   - Endpoint: `GET /seo/analyze/{postId}`
   - Nhập postId
   - Xem điểm SEO chi tiết

3. **Get Schema**
   - Endpoint: `GET /seo/schema/{postId}`
   - Nhập postId
   - Xem schema markup

4. **Validate Schema**
   - Endpoint: `POST /seo/schema/{postId}/validate`
   - Nhập postId
   - Kiểm tra schema hợp lệ

5. **Get History**
   - Endpoint: `GET /seo/history/{postId}?days=30`
   - Nhập postId và days
   - Xem lịch sử SEO

---

## 📱 EXPORT & SHARE

### 1. Export Swagger Spec

Truy cập:
```
http://localhost:3003/api-docs-json
```

Copy JSON và import vào:
- Postman
- Insomnia
- API testing tools

### 2. Generate Client Code

Sử dụng Swagger Codegen:
```bash
# Install
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:3003/api-docs-json \
  -g typescript-axios \
  -o ./generated-client
```

---

## ✅ CHECKLIST

- [ ] Thêm Swagger vào `main.ts`
- [ ] Thêm `@ApiTags` vào tất cả controllers
- [ ] Thêm `@ApiOperation` cho mọi endpoint
- [ ] Thêm `@ApiParam` cho path parameters
- [ ] Thêm `@ApiQuery` cho query parameters
- [ ] Thêm `@ApiResponse` cho responses
- [ ] Thêm `@ApiProperty` vào DTOs
- [ ] Test tất cả endpoints trong Swagger UI
- [ ] Export Swagger JSON
- [ ] Share link với Frontend team

---

## 🎯 BEST PRACTICES

1. **Luôn thêm examples** trong decorators
2. **Mô tả rõ ràng** cho mọi endpoint
3. **Group endpoints** bằng tags
4. **Document errors** với ApiResponse
5. **Version API** khi có breaking changes

---

**Swagger URL**: http://localhost:3003/api-docs  
**Status**: ✅ Ready to use  
**Updated**: 2026-02-10
