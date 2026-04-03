import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsObject, IsArray, Min } from 'class-validator';
import { CourseStatus } from '@/shared/enums/app.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ThemeConfigDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    primaryColor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    bannerUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    fontFamily?: string;
}

export class CreateCourseDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    title!: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    slug!: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    code!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    summary?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @ApiPropertyOptional({ enum: CourseStatus })
    @IsOptional()
    @IsEnum(CourseStatus)
    status?: CourseStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    subdomain?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    themeConfig?: ThemeConfigDto;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    metaTitle?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    metaDescription?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    seoKeywords?: string[];
}
