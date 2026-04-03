import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateRoleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    permissionIds?: string[];
}

export class UpdateRoleDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    permissionIds?: string[];
}

export class AssignRolesDto {
    @IsArray()
    @IsString({ each: true })
    roleIds: string[];
}

export class AssignDirectPermissionsDto {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    grantIds?: string[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    denyIds?: string[];
}
