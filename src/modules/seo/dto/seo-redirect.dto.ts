import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateRedirectDto {
    @ApiProperty()
    @IsString()
    fromPattern: string;

    @ApiProperty()
    @IsString()
    toUrl: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    statusCode?: number;
}

export class UpdateRedirectDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    fromPattern?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    toUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
