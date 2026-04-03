import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNotEmpty } from 'class-validator';

export class UpdateThemeDto {
    @ApiProperty({ description: 'Theme configuration object containing colors, styles, etc.' })
    @IsNotEmpty()
    @IsObject()
    themeConfig: Record<string, any>;
}
