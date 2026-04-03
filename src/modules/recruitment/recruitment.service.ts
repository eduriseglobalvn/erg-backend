import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap, FilterQuery } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus } from './entities/job.entity';
import { Candidate, CandidateStatus, ApplyType } from './entities/candidate.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { CreateZaloCandidateDto } from './dto/create-zalo-candidate.dto';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';
import { JobQueryDto, JobSortOption } from './dto/job-query.dto';
import { StorageService } from '@/shared/services/storage.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class RecruitmentService {
    private readonly logger = new Logger(RecruitmentService.name);

    constructor(
        @InjectRepository(Job)
        private readonly jobRepository: EntityRepository<Job>,
        @InjectRepository(Candidate)
        private readonly candidateRepository: EntityRepository<Candidate>,
        private readonly storageService: StorageService,
        private readonly mailerService: MailerService,
    ) { }

    // ==========================
    // JOB MANAGEMENT (ADMIN)
    // ==========================
    async createJob(createJobDto: CreateJobDto): Promise<Job> {
        const job = this.jobRepository.create({
            ...createJobDto,
            salaryCurrency: createJobDto.salaryCurrency || 'VND',
            country: createJobDto.country || 'VN',
            status: createJobDto.status || JobStatus.NORMAL,
            summary: createJobDto.summary || '',
            isActive: createJobDto.isActive ?? true,
            isHot: createJobDto.isHot ?? false,
            isNew: createJobDto.isNew ?? false,
            isUrgent: createJobDto.isUrgent ?? false,
            viewCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await this.jobRepository.getEntityManager().persistAndFlush(job);
        return job;
    }

    async findAllJobs(queryDto: JobQueryDto) {
        const { search, salary, workType, location, sort, page = 1, limit = 10 } = queryDto;
        const where: FilterQuery<Job> = { isActive: true };

        if (search) {
            where.$or = [
                { title: { $ilike: `%${search}%` } },
                { summary: { $ilike: `%${search}%` } }
            ];
        }

        if (salary && salary.length > 0) {
            where.salary = { $in: salary };
        }

        if (workType && workType.length > 0) {
            where.workType = { $in: workType };
        }

        if (location && location.length > 0) {
            where.location = { $in: location };
        }

        const orderBy = { createdAt: sort === JobSortOption.OLDEST ? 'ASC' : 'DESC' };
        const offset = (page - 1) * limit;

        const [jobs, total] = await this.jobRepository.findAndCount(where, {
            orderBy: orderBy as any,
            limit,
            offset,
        });

        return {
            items: jobs.map(job => this.processWithFlags(job)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findJobBySlug(slug: string): Promise<Job> {
        const job = await this.jobRepository.findOne({ slug, isActive: true });
        if (!job) throw new NotFoundException('Job not found');

        job.viewCount = (job.viewCount || 0) + 1;
        await this.jobRepository.getEntityManager().flush();

        return this.processWithFlags(job);
    }

    async findOneJob(id: string): Promise<Job> {
        const job = await this.jobRepository.findOne({ id });
        if (!job) throw new NotFoundException('Job not found');
        return job;
    }

    async updateJob(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
        const job = await this.findOneJob(id);
        wrap(job).assign(updateJobDto);
        await this.jobRepository.getEntityManager().flush();
        return job;
    }

    async removeJob(id: string): Promise<void> {
        const job = await this.findOneJob(id);
        job.isActive = false;
        await this.jobRepository.getEntityManager().flush();
    }

    async toggleJobFlag(id: string, flag: 'isHot' | 'isUrgent' | 'isNew'): Promise<Job> {
        const job = await this.findOneJob(id);
        job[flag] = !job[flag];
        await this.jobRepository.getEntityManager().flush();
        return this.processWithFlags(job);
    }

    async updateJobStatus(id: string, isActive: boolean): Promise<Job> {
        const job = await this.findOneJob(id);
        if (isActive === undefined) throw new NotFoundException('isActive status required');
        job.isActive = isActive;
        await this.jobRepository.getEntityManager().flush();
        return this.processWithFlags(job);
    }

    // ==========================
    // CANDIDATE — APPLY ONLINE
    // ==========================
    async apply(dto: ApplyJobDto, file: Express.Multer.File) {
        // 1. Validate file
        if (!file) throw new BadRequestException('CV file is required');

        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Chỉ chấp nhận file PDF hoặc Word (.pdf, .doc, .docx)');
        }
        if (file.size > 2 * 1024 * 1024) {
            throw new BadRequestException('Dung lượng CV không được vượt quá 2MB');
        }

        // 2. Tìm Job (nếu có jobId)
        let job: Job | undefined;
        if (dto.jobId) {
            job = await this.findOneJob(dto.jobId);
        }

        // 3. Đặt tên file theo tên ứng viên
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
        const slug = this.slugifyName(dto.fullName);
        const filename = `${slug}-${Date.now()}.${ext}`;

        // 4. Upload lên R2 thư mục cv/
        const cvUrl = await this.storageService.uploadRawFile(
            file.buffer,
            'cv',
            filename,
            file.mimetype,
        );

        // 5. Tạo Candidate
        const candidate = this.candidateRepository.create({
            job,
            fullName: dto.fullName,
            email: dto.email,
            phone: dto.phone,
            cvUrl,
            coverLetter: dto.coverLetter,
            applyType: ApplyType.ONLINE,
            status: CandidateStatus.PENDING,
            trackingCode: uuidv4(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await this.candidateRepository.getEntityManager().persistAndFlush(candidate);

        // 6. Gửi email xác nhận (bất đồng bộ)
        this.sendApplicationEmail(candidate, job || null, dto.trackingUrl);

        return {
            trackingCode: candidate.trackingCode,
            message: 'Hồ sơ của bạn đã được gửi thành công. Vui lòng kiểm tra email để theo dõi.',
        };
    }

    // ==========================
    // CANDIDATE — APPLY ZALO (ADMIN)
    // ==========================
    async createZaloCandidate(dto: CreateZaloCandidateDto) {
        const job = await this.findOneJob(dto.jobId);

        const candidate = this.candidateRepository.create({
            job,
            fullName: dto.fullName,
            email: dto.email || '',
            phone: dto.phone,
            cvUrl: undefined,
            note: dto.note,
            applyType: ApplyType.ZALO,
            status: CandidateStatus.PENDING,
            trackingCode: uuidv4(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await this.candidateRepository.getEntityManager().persistAndFlush(candidate);

        // Gửi email nếu ứng viên có email
        if (dto.email) {
            this.sendApplicationEmail(candidate, job, dto.trackingUrl);
        }

        return {
            trackingCode: candidate.trackingCode,
            message: `Đã tạo hồ sơ ứng viên Zalo cho ${dto.fullName} thành công.`,
        };
    }

    async trackApplication(code: string) {
        const candidate = await this.candidateRepository.findOne(
            { trackingCode: code },
            { populate: ['job'] }
        );
        if (!candidate) throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');

        return {
            fullName: candidate.fullName,
            jobTitle: (candidate.job as any)?.title ?? 'Ứng viên chung',
            applyType: candidate.applyType,
            status: candidate.status,
            publicNote: candidate.publicNote,
            submittedAt: candidate.createdAt,
        };
    }

    // ==========================
    // ADMIN — CANDIDATES
    // ==========================
    async findAllCandidates(jobId?: string) {
        const where: FilterQuery<Candidate> = {};
        if (jobId) where.job = jobId;

        return this.candidateRepository.find(where, {
            populate: ['job'],
            orderBy: { createdAt: 'DESC' }
        });
    }

    async updateCandidateStatus(id: string, dto: UpdateCandidateStatusDto) {
        const candidate = await this.candidateRepository.findOne({ id });
        if (!candidate) throw new NotFoundException('Candidate not found');

        candidate.status = dto.status;
        if (dto.publicNote !== undefined) {
            candidate.publicNote = dto.publicNote;
        }

        await this.candidateRepository.getEntityManager().flush();
        return candidate;
    }

    // ==========================
    // HELPERS
    // ==========================
    private slugifyName(name: string): string {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')   // Bỏ dấu tiếng Việt
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    private processWithFlags(job: Job): Job {
        const now = new Date();
        const createdDate = new Date(job.createdAt);
        const deadlineDate = new Date(job.deadline);

        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
            job.isNew = true;
        }

        if (!job.isUrgent && job.deadline) {
            if (!isNaN(deadlineDate.getTime())) {
                const diffDeadline = deadlineDate.getTime() - now.getTime();
                const daysToDeadline = Math.ceil(diffDeadline / (1000 * 60 * 60 * 24));
                if (daysToDeadline > 0 && daysToDeadline <= 5) {
                    job.isUrgent = true;
                }
            }
        }

        if (!job.isHot && job.viewCount > 20) {
            if (job.deadline && !isNaN(deadlineDate.getTime())) {
                if (deadlineDate.getTime() > now.getTime()) {
                    job.isHot = true;
                }
            } else {
                job.isHot = true;
            }
        }

        return job;
    }

    private async sendApplicationEmail(candidate: Candidate, job: Job | null, trackingUrl?: string) {
        if (!candidate.email) return;

        const baseUrl = trackingUrl || 'https://erg.edu.vn/tuyen-dung/track';
        const trackingLink = `${baseUrl}/${candidate.trackingCode}`;
        const jobTitle = job?.title ?? 'Ứng tuyển chung';
        const applyTypeLabel = candidate.applyType === ApplyType.ZALO ? ' (qua Zalo)' : '';
        const hrPhone = process.env.HR_PHONE_NUMBER || '0909 xxx xxx';

        try {
            await this.mailerService.sendMail({
                to: candidate.email,
                subject: `[ERG] Xác nhận ứng tuyển${applyTypeLabel} - ${jobTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                        <div style="background: #003087; padding: 20px; text-align: center;">
                            <h2 style="color: white; margin: 0;">Trung tâm Tin học ERG</h2>
                            <p style="color: #90caf9; margin: 4px 0 0;">Xác nhận ứng tuyển thành công</p>
                        </div>
                        <div style="padding: 24px;">
                            <p>Chào <strong>${candidate.fullName}</strong>,</p>
                            <p>Cảm ơn bạn đã quan tâm đến cơ hội nghề nghiệp tại <strong>Trung tâm Tin học ERG</strong>.</p>
                            <p>Chúng tôi xác nhận đã nhận được hồ sơ của bạn cho vị trí:</p>
                            <div style="background: #f5f5f5; border-left: 4px solid #003087; padding: 12px 16px; margin: 12px 0; border-radius: 4px;">
                                <strong style="font-size: 16px;">📋 ${jobTitle}</strong>
                            </div>
                            <p>Bạn có thể theo dõi trạng thái hồ sơ của mình tại đường dẫn dưới đây:</p>
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${trackingLink}" 
                                   style="background: #003087; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                                    🔍 Xem trạng thái hồ sơ
                                </a>
                            </div>
                            <p style="color: #666; font-size: 13px;">Hoặc copy link: <a href="${trackingLink}">${trackingLink}</a></p>
                            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                            <p style="color: #666; font-size: 13px;">
                                📞 Nếu có thắc mắc, vui lòng liên hệ HR: <strong>${hrPhone}</strong><br>
                                📧 Email: <strong>tuyendung@erg.edu.vn</strong>
                            </p>
                        </div>
                        <div style="background: #f9f9f9; padding: 12px; text-align: center; color: #999; font-size: 12px;">
                            © 2025 Trung tâm Tin học ERG — EDURISE GLOBAL CO., LTD
                        </div>
                    </div>
                `,
            });
        } catch (error) {
            this.logger.error('Failed to send application confirmation email', error);
        }
    }
}
