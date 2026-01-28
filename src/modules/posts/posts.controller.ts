import { Controller, Get, Post, Body, Put, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) { }

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
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
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