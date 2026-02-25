import {
    Controller, Get, Post, Body, Patch, Param, Delete, Put,
    UseInterceptors, UploadedFile, BadRequestException, Query, UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RecruitmentService } from './recruitment.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { CreateZaloCandidateDto } from './dto/create-zalo-candidate.dto';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';

const CV_ALLOWED_MIMES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const cvUploadOptions = {
    storage: memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
        if (!CV_ALLOWED_MIMES.includes(file.mimetype)) {
            return cb(new BadRequestException('Chỉ chấp nhận file PDF hoặc Word (.pdf, .doc, .docx)'), false);
        }
        cb(null, true);
    },
};

@Controller('recruitment')
export class RecruitmentController {
    constructor(
        private readonly recruitmentService: RecruitmentService,
    ) { }

    // ==========================
    // PUBLIC ENDPOINTS
    // ==========================
    @Get('jobs')
    findAllJobs(@Query() query: JobQueryDto) {
        return this.recruitmentService.findAllJobs(query);
    }

    @Get('jobs/:slug')
    findJobBySlug(@Param('slug') slug: string) {
        return this.recruitmentService.findJobBySlug(slug);
    }

    /**
     * POST /api/recruitment/apply
     * Ứng tuyển qua form website: Bắt buộc CV file, jobId optional (có thể gửi CV chung).
     * - Giới hạn 2MB
     * - Chỉ nhận PDF / Word
     * - Tên file tự động đổi theo tên ứng viên
     * - Gửi email xác nhận tự động
     */
    @Post('apply')
    @UseInterceptors(FileInterceptor('file', cvUploadOptions))
    apply(
        @Body() applyJobDto: ApplyJobDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.recruitmentService.apply(applyJobDto, file);
    }

    @Get('tracking/:code')
    trackApplication(@Param('code') code: string) {
        return this.recruitmentService.trackApplication(code);
    }

    // ==========================
    // ADMIN ENDPOINTS
    // ==========================

    /**
     * POST /api/recruitment/apply/zalo  [Admin]
     * Admin nhập tay ứng viên từ Zalo — không cần file CV.
     * Nếu có email, sẽ tự động gửi email xác nhận cho ứng viên.
     */
    @Post('apply/zalo')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    createZaloCandidate(@Body() dto: CreateZaloCandidateDto) {
        return this.recruitmentService.createZaloCandidate(dto);
    }

    @Post('jobs')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    createJob(@Body() createJobDto: CreateJobDto) {
        return this.recruitmentService.createJob(createJobDto);
    }

    @Put('jobs/:id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    updateJob(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
        return this.recruitmentService.updateJob(id, updateJobDto);
    }

    @Delete('jobs/:id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    removeJob(@Param('id') id: string) {
        return this.recruitmentService.removeJob(id);
    }

    @Patch('jobs/:id/toggle-hot')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    toggleHot(@Param('id') id: string) {
        return this.recruitmentService.toggleJobFlag(id, 'isHot');
    }

    @Patch('jobs/:id/toggle-urgent')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    toggleUrgent(@Param('id') id: string) {
        return this.recruitmentService.toggleJobFlag(id, 'isUrgent');
    }

    @Patch('jobs/:id/status')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    updateStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
        return this.recruitmentService.updateJobStatus(id, isActive);
    }

    @Get('admin/candidates')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    findAllCandidates(@Query('jobId') jobId?: string) {
        return this.recruitmentService.findAllCandidates(jobId);
    }

    @Patch('admin/candidates/:id/status')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    updateCandidateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateCandidateStatusDto,
    ) {
        return this.recruitmentService.updateCandidateStatus(id, dto);
    }
}
