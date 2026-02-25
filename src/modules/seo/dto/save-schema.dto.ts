import { IsString, IsEnum, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdvancedSchemaType {
    FAQ = 'FAQ',
    HOW_TO = 'HowTo',
    VIDEO = 'Video',
    COURSE = 'Course',
    LOCAL_BUSINESS = 'LocalBusiness',
    REVIEW = 'Review',
}

export class SaveSchemaDto {
    @ApiProperty({ enum: AdvancedSchemaType, example: 'FAQ' })
    @IsEnum(AdvancedSchemaType)
    @IsNotEmpty()
    type: AdvancedSchemaType;

    @ApiProperty({
        example: {
            questions: [
                { question: 'What is ERG?', answer: 'ERG is a leading education provider.' }
            ]
        }
    })
    @IsObject()
    @IsNotEmpty()
    data: Record<string, any>;
}
