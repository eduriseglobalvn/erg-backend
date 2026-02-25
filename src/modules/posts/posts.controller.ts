import { Controller, Get, Post, Body, Put, Param, Delete, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { StorageService } from '@/shared/services/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly storageService: StorageService,
  ) { }

  // ==========================================
  // [NEW] QUẢN LÝ ẢNH (UPLOAD & DELETE)
  // Phải đặt TRƯỚC các route có :id để tránh bị nhận nhầm là Param
  // ==========================================
  @Post('images/upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create', 'posts.update')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const allowedMimetypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimetypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed (jpg, png, gif, webp)');
    }
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    const url = await this.storageService.processAndUpload(file.buffer, 'posts', originalName);
    return {
      statusCode: 200,
      message: 'Upload successful',
      data: { url }
    };
  }

  @Delete('images')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete', 'posts.update')
  async deleteImage(@Body('url') url: string) {
    console.log(`[Backend] Received DELETE request for URL:`, url);
    if (!url) throw new BadRequestException('URL is required');
    const allowedPrefix = 'https://media.erg.edu.vn/posts/';
    if (!url.startsWith(allowedPrefix)) {
      throw new BadRequestException('Invalid URL: Only media.erg.edu.vn/posts/ URLs are allowed');
    }
    // 3. Extract & Security (Prevent path traversal)
    const filename = url.replace(allowedPrefix, '');

    // Chỉ chặn ".." để tránh thoát ra khỏi bucket, còn "/" thì cho phép để hỗ trợ sub-folders
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid filename or security risk detected');
    }

    await this.storageService.deleteFile(url);
    return {
      statusCode: 200,
      message: 'Deleted successfully'
    };
  }

  // Xóa ảnh theo ID (Filename) - Path: /posts/images/id/:filename
  @Delete('images/id/:filename')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete', 'posts.update')
  async deleteImageByPath(@Param('filename') filename: string) {
    if (!filename) throw new BadRequestException('Filename is required');

    // Chống tấn công path traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('Invalid filename');
    }

    // Build URL để dùng lại logic của service
    const fullUrl = `https://media.erg.edu.vn/posts/${filename}`;
    await this.storageService.deleteFile(fullUrl);

    return {
      statusCode: 200,
      message: 'Deleted successfully'
    };
  }

  // ==========================================
  // [NEW] XEM TRƯỚC BÀI VIẾT (PREVIEW)
  // ==========================================
  @Post('preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create', 'posts.update')
  async savePreview(@Body() body: any) {
    const { id, ...data } = body;
    const previewId = await this.postsService.savePreviewDraft(data, id);
    return { id: previewId };
  }

  @Get('preview/:id')
  async getPreview(@Param('id') id: string) {
    return this.postsService.getPreviewDraft(id);
  }

  // ==========================================
  // 1. TẠO BÀI VIẾT (MANUAL CREATE)
  // API: POST /posts
  // ==========================================
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create')
  create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    const user = req.user;
    return this.postsService.create(createPostDto, user);
  }

  // ==========================================
  // 2. LẤY DANH SÁCH (PAGINATION & SEARCH)
  // API: GET /posts?page=1&limit=10&search=...
  // ==========================================
  @Get()
  findAll(@Query() query: PostQueryDto) {
    return this.postsService.findAll(query);
  }

  // ==========================================
  // 3. QUẢN LÝ THÙNG RÁC (XEM TRƯỚC ID)
  // ==========================================
  @Get('trash')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  getTrash(@Query() query: PostQueryDto) {
    return this.postsService.findDeleted(query);
  }

  // ==========================================
  // 4. LẤY CHI TIẾT (GET DETAIL)
  // API: GET /posts/:id
  // Dùng cho cả Frontend hiển thị và Admin Edit
  // ==========================================
  // Lấy bài viết theo Slug (Dành cho SEO/Frontend) - Phải đặt TRƯỚC :id
  // Lấy bài viết theo Slug (Dành cho SEO/Frontend) - Phải đặt TRƯỚC :id
  @Get('slug/:slug')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  // API: GET /posts/:id
  // API: GET /posts/:id
  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  // ==========================================
  // 4. CẬP NHẬT BÀI VIẾT (UPDATE)
  // API: PUT /posts/:id
  // ==========================================
  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.update')
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto, @Req() req: any) {
    const user = req.user;
    return this.postsService.update(id, updatePostDto, user);
  }

  // ==========================================
  // 5. XÓA BÀI VIẾT (SOFT DELETE)
  // API: DELETE /posts/:id
  // ==========================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  remove(@Param('id') id: string) {
    console.log(`[Backend] Deleting Post with ID:`, id);
    return this.postsService.remove(id);
  }



  @Put(':id/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  restore(@Param('id') id: string) {
    return this.postsService.restore(id);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete') // Cần quyền cao hơn nếu muốn (ví dụ system.manage)
  hardDelete(@Param('id') id: string) {
    return this.postsService.hardDelete(id);
  }

}