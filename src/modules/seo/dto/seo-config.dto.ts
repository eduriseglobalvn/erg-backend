import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UpdateSeoConfigDto {
    @ApiProperty({ description: 'The configuration value or object payload' })
    @IsNotEmpty()
    value: any;
}
