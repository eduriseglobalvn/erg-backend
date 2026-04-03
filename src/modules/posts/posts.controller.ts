import { Controller, Get, Post, Body, Put, Param, Delete, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { StorageService } from '@/shared/services/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SavePreviewDto } from './dto/save-preview.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { Auditable } from '@/modules/audit/decorators/auditable.decorator';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly storageService: StorageService,
  ) { }

  @Post('images/upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create', 'posts.update')
  @Auditable({ action: 'upload_image', resourceType: 'posts' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const allowedMimetypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimetypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed (jpg, png, gif, webp)');
    }
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    const url = await this.storageService.processAndUpload(file.buffer, 'posts', originalName);
    return { statusCode: 200, message: 'Upload successful', data: { url } };
  }

  @Delete('images')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete', 'posts.update')
  @Auditable({ action: 'delete_image', resourceType: 'posts' })
  async deleteImage(@Body('url') url: string) {
    if (!url) throw new BadRequestException('URL is required');
    const allowedPrefix = 'https://media.erg.edu.vn/posts/';
    if (!url.startsWith(allowedPrefix)) throw new BadRequestException('Invalid URL');
    const filename = url.replace(allowedPrefix, '');
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    await this.storageService.deleteFile(url);
    return { statusCode: 200, message: 'Deleted successfully' };
  }

  @Post('preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create', 'posts.update')
  async savePreview(@Body() body: SavePreviewDto) {
    const { id, ...data } = body;
    const previewId = await this.postsService.savePreviewDraft(data, id);
    return { id: previewId };
  }

  @Get('preview/:id')
  async getPreview(@Param('id') id: string) {
    return this.postsService.getPreviewDraft(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.create')
  @Auditable({ action: 'create', resourceType: 'posts' })
  create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    return this.postsService.create(createPostDto, req.user);
  }

  @Get()
  findAll(@Query() query: PostQueryDto) {
    return this.postsService.findAll(query);
  }

  @Get('hidden')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.manage_hidden', 'system.manage')
  getHiddenPosts(@Query() query: PostQueryDto) {
    return this.postsService.findHiddenPosts(query);
  }

  @Post(':id/promote')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.manage_hidden', 'system.manage')
  @Auditable({ action: 'promote', resourceType: 'posts' })
  promoteToPublic(@Param('id') id: string, @Body('categoryId') categoryId: string, @Req() req: any) {
    if (!categoryId) throw new BadRequestException('categoryId is required');
    return this.postsService.promoteToPublic(id, categoryId, req.user);
  }

  @Get('trash')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  getTrash(@Query() query: PostQueryDto) {
    return this.postsService.findDeleted(query);
  }

  @Get('slug/:slug')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.update')
  @Auditable({ action: 'update', resourceType: 'posts' })
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto, @Req() req: any) {
    return this.postsService.update(id, updatePostDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  @Auditable({ action: 'delete', resourceType: 'posts' })
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }

  @Put(':id/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  @Auditable({ action: 'restore', resourceType: 'posts' })
  restore(@Param('id') id: string) {
    return this.postsService.restore(id);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('posts.delete')
  @Auditable({ action: 'permanent_delete', resourceType: 'posts' })
  hardDelete(@Param('id') id: string) {
    return this.postsService.hardDelete(id);
  }
}