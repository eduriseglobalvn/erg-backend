import { IsNotEmpty, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateZaloCandidateDto {
    @ApiProperty({ description: 'Job ID (required for Zalo apply)' })
    @IsNotEmpty()
    @IsUUID()
    jobId: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    fullName: string;

    @ApiPropertyOptional({ description: 'Email ứng viên (nếu có, sẽ gửi email xác nhận)' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    phone: string;

    @ApiPropertyOptional({ description: 'Ghi chú nội bộ (vd: Apply Zalo lúc 10h sáng 24/2)' })
    @IsOptional()
    @IsString()
    note?: string;

    @ApiPropertyOptional({ description: 'Base tracking URL from FE' })
    @IsOptional()
    @IsString()
    trackingUrl?: string;
}
