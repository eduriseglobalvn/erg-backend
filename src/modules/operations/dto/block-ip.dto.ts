import { IsString, IsIP, IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class BlockIpDto {
  @ApiProperty({ example: '192.168.1.1' })
  @IsIP(4)
  ip: string;

  @ApiPropertyOptional({ example: 600000, description: 'Duration in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  ttlMs?: number;
}
