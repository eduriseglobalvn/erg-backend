import { IsNotEmpty, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class ApplyJobDto {
    @ApiPropertyOptional({ description: 'Job ID (optional: leave empty to submit general CV)' })
    @IsOptional()
    @IsUUID()
    jobId?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    fullName: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    phone: string;

    @ApiPropertyOptional({ description: 'Cover letter / thư xin việc' })
    @IsOptional()
    @IsString()
    coverLetter?: string;

    @ApiPropertyOptional({ description: 'Base tracking URL from FE' })
    @IsOptional()
    @IsString()
    trackingUrl?: string;
}
