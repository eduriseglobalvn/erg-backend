import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiKeyType, AIProviderType } from '../entities/api-key.entity';

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

    @IsOptional()
    @IsEnum(AIProviderType)
    provider?: AIProviderType;
}

export class CreateApiKeyDto extends UpdateApiKeyDto { }
