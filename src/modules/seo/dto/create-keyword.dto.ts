import { IsNotEmpty, IsOptional, IsString, IsUrl, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKeywordDto {
    @ApiProperty({ example: 'digital marketing', description: 'Keyword to be linked' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    keyword: string;

    @ApiProperty({ example: 'https://erg.edu.vn/khoa-hoc-digital-marketing', description: 'Target URL' })
    @IsUrl()
    @IsNotEmpty()
    @MaxLength(500)
    targetUrl: string;

    @ApiProperty({ example: 1, description: 'Maximum number of links per post', default: 1 })
    @IsInt()
    @Min(1)
    @IsOptional()
    linkLimit?: number;
}

export class BulkAutoLinkDto {
    @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'List of post IDs to process (optional)', required: false })
    @IsOptional()
    @IsString({ each: true })
    postIds?: string[];
}
