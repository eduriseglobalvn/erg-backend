import {
    IsEnum,
    IsNotEmpty,
    IsArray,
    IsUUID,
    ArrayNotEmpty,
    IsOptional,
    IsString
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '@/shared/enums/app.enum';

export class UpdateUserStatusDto {
    @IsEnum(UserStatus)
    @IsNotEmpty()
    status!: UserStatus;
}

export class AssignRolesDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    roleIds!: string[];
}

export class QueryUsersDto {
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    page?: number;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    limit?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @IsOptional()
    @IsString()
    role?: string;

    @IsOptional()
    @IsString()
    provider?: string;

    @IsOptional()
    dateFrom?: string;

    @IsOptional()
    dateTo?: string;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';
}
