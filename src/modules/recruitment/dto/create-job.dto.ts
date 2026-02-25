import { IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { JobStatus } from '../entities/job.entity';

export class CreateJobDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    slug: string;

    @IsOptional()
    @IsEnum(JobStatus)
    status?: JobStatus;

    @IsOptional()
    @IsBoolean()
    isHot?: boolean;

    @IsOptional()
    @IsBoolean()
    isNew?: boolean;

    @IsOptional()
    @IsBoolean()
    isUrgent?: boolean;

    @IsNotEmpty()
    @IsString()
    salary: string;

    @IsNotEmpty()
    @IsNumber()
    quantity: number;

    @IsNotEmpty()
    @IsString()
    workType: string;

    @IsOptional()
    @IsString()
    workSchedule?: string;

    @IsOptional()
    @IsString()
    postDate?: string;

    @IsNotEmpty()
    @IsString()
    deadline: string;

    @IsNotEmpty()
    @IsString()
    location: string;

    @IsOptional()
    @IsString()
    summary?: string;

    @IsArray()
    @IsString({ each: true })
    description: string[];

    @IsArray()
    @IsString({ each: true })
    requirements: string[];

    @IsArray()
    @IsString({ each: true })
    benefits: string[];

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
