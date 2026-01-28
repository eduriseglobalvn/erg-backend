import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiKeyType } from '../entities/api-key.entity';

export class UpdateApiKeyDto {
    @IsNotEmpty()
    @IsString()
    key!: string;

    @IsOptional()
    @IsString()
    label?: string;

    @IsOptional()
    @IsString()
    projectId?: string;

    @IsOptional()
    @IsEnum(ApiKeyType)
    type?: ApiKeyType;

    @IsOptional()
    @IsNumber()
    maxDailyQuota?: number;
}

export class CreateApiKeyDto extends UpdateApiKeyDto { }
