import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CandidateStatus } from '../entities/candidate.entity';

export class UpdateCandidateStatusDto {
    @IsNotEmpty()
    @IsEnum(CandidateStatus)
    status: CandidateStatus;

    @IsOptional()
    @IsString()
    publicNote?: string;
}
