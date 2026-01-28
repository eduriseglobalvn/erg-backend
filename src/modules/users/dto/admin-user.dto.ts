
import {
    IsEnum,
    IsNotEmpty,
    IsArray,
    IsUUID,
    ArrayNotEmpty
} from 'class-validator';
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
