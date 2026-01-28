import {
  Controller,
  Post as HttpPost,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import { UsersService } from '@/modules/users/users.service';
import { PostsService } from '@/modules/posts/posts.service';
import { AiContentService } from './services/ai-content.service';

@Controller('ai-content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiContentController {
  constructor(
    @InjectQueue('ai-content-queue') private aiQueue: Queue,
    private readonly usersService: UsersService,
    private readonly postsService: PostsService,
    private readonly aiContentService: AiContentService,
  ) { }

  @HttpPost('generate')
  @Permissions('posts.create')
  async generatePost(
    @Body() body: { topic: string; categoryId: string },
    @Request() req,
  ) {
    // 1. Kiểm tra Input
    if (!body.topic) {
      throw new BadRequestException('Vui lòng nhập chủ đề bài viết');
    }
    if (!body.categoryId) {
      throw new BadRequestException('Vui lòng chọn danh mục bài viết');
    }

    // [MỚI] Validate Category sớm để không trả về 200 khi data sai
    await this.postsService.findCategoryOne(body.categoryId);

    // 2. Lấy Email từ Token
    const userEmail = req.user?.email;
    if (!userEmail) {
      throw new UnauthorizedException(
        'Token không hợp lệ: Không tìm thấy Email',
      );
    }

    // 3. Tìm User ID chuẩn xác
    const user = await this.usersService.findByEmail(userEmail);

    // 4. Đẩy vào Queue
    const job = await this.aiQueue.add(
      'generate-post',
      {
        topic: body.topic,
        categoryId: body.categoryId,
        userId: user.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 60000,
        },
        // --- SỬA Ở ĐÂY ---
        // Thay vì true (xóa ngay), ta giữ lại job đã xong trong 1 khoảng thời gian
        removeOnComplete: {
          age: 3600, // Giữ lại trong 3600 giây (1 giờ) sau khi xong
          count: 100, // Giữ lại tối đa 100 job gần nhất (để tránh đầy Redis)
        },
        // Nên cấu hình thêm cái này để debug khi lỗi
        removeOnFail: {
          age: 24 * 3600, // Giữ lại job lỗi trong 24h để kiểm tra
        },
      },
    );

    return {
      jobId: job.id,
      message: 'Đang khởi tạo bài viết...',
    };
  }

  @HttpPost('refine')
  @Permissions('posts.create')
  async refineContent(
    @Body() body: { content?: string; text?: string; instruction: string },
    @Request() req,
  ) {
    const inputContent = body.text || body.content;
    const instruction = body.instruction || 'Hãy làm cho nội dung hay hơn và chuyên nghiệp hơn';

    if (!inputContent) {
      throw new BadRequestException('Nội dung không được để trống');
    }

    if (!body.instruction) {
      // Có thể bắt buộc hoặc không, ở đây ta bắt buộc để đảm bảo AI có chỉ dẫn rõ ràng
      throw new BadRequestException('Vui lòng cung cấp yêu cầu cải thiện (instruction)');
    }

    const userEmail = req.user?.email;
    const user = await this.usersService.findByEmail(userEmail);

    // Trả về trực tiếp (Synchronous) cho Frontend thay vì dùng Queue
    const refinedContent = await this.aiContentService.refineText(
      inputContent,
      instruction,
      user,
    );

    return {
      statusCode: 200,
      message: 'Xử lý nội dung thành công',
      data: {
        refinedContent: refinedContent,
      },
    };
  }

  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.aiQueue.getJob(jobId);

    // Nếu không tìm thấy job (do sai ID hoặc đã hết hạn lưu trữ)
    if (!job) {
      return {
        status: 'not_found',
        message: 'Không tìm thấy job hoặc job đã bị xóa khỏi bộ nhớ đệm.'
      };
    }

    const state = await job.getState();

    // Lấy lý do lỗi nếu có (xử lý an toàn)
    const failedReason = job.failedReason;

    // Lấy kết quả trả về (nếu job xong)
    const result = job.returnvalue;

    return {
      id: job.id,
      state, // 'waiting', 'active', 'completed', 'failed'
      progress: job.progress,
      result, // Dữ liệu bài viết AI tạo ra sẽ nằm ở đây
      error: failedReason,
    };
  }
}