import { IsOptional, IsString, IsNumber, Min, IsArray, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum JobSortOption {
    NEWEST = 'newest',
    OLDEST = 'oldest',
}

export class JobQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Search keyword for job title or summary' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by salary ranges', type: [String], isArray: true })
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]).filter(Boolean))
    @IsArray()
    @IsString({ each: true })
    salary?: string[];

    @ApiPropertyOptional({ description: 'Filter by work types', type: [String], isArray: true })
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]).filter(Boolean))
    @IsArray()
    @IsString({ each: true })
    workType?: string[];

    @ApiPropertyOptional({ description: 'Filter by locations', type: [String], isArray: true })
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]).filter(Boolean))
    @IsArray()
    @IsString({ each: true })
    location?: string[];

    @ApiPropertyOptional({ enum: JobSortOption, default: JobSortOption.NEWEST })
    @IsOptional()
    @IsEnum(JobSortOption)
    sort?: JobSortOption = JobSortOption.NEWEST;
}
