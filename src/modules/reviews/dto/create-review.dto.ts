import { IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewTargetType } from '../entities/review.entity';

export class CreateReviewDto {
    @ApiProperty()
    @IsString()
    targetId!: string;

    @ApiProperty({ enum: ReviewTargetType, required: false })
    @IsEnum(ReviewTargetType)
    @IsOptional()
    targetType?: ReviewTargetType;

    @ApiProperty()
    @IsNumber()
    @Min(1)
    @Max(5)
    rating!: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    comment?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    userName?: string;
}
