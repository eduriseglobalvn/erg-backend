import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class SavePreviewDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    meta?: any;

    [key: string]: any; // Allow capturing any other valid post fields for draft
}
