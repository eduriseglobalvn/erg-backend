import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Report404Dto {
    @IsString()
    @IsNotEmpty()
    url: string;

    @IsString()
    @IsOptional()
    referrer?: string;

    @IsString()
    @IsOptional()
    userAgent?: string;
}
