import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { Job } from './entities/job.entity';
import { Candidate } from './entities/candidate.entity';
import { StorageService } from '@/shared/services/storage.service';

@Module({
    imports: [
        MikroOrmModule.forFeature([Job, Candidate]),
    ],
    controllers: [RecruitmentController],
    providers: [RecruitmentService, StorageService],
    exports: [RecruitmentService],
})
export class RecruitmentModule { }
