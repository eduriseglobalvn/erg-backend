import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { IsString, IsIP, IsOptional, IsInt, Min } from 'class-validator';
import { IpProtectionService } from './ip-protection.service';

class BlockIpDto {
  @IsIP(4)
  ip: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  ttlMs?: number;
}

@ApiTags('Operations / IP Admin')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, PermissionsGuard)
// @Permissions('system:manage_ips')
@Controller('admin/ip')
export class IpAdminController {
  constructor(private readonly ipProtectionService: IpProtectionService) {}

  @Post('block')
  @ApiOperation({ summary: 'Block an IP recursively or manually' })
  async blockIp(@Body(new ValidationPipe()) dto: BlockIpDto) {
    return this.ipProtectionService.blockIp(dto.ip, dto.ttlMs);
  }

  @Delete('unblock/:ip')
  @ApiOperation({ summary: 'Unblock a previously blocked IP' })
  async unblockIp(@Param('ip') ip: string) {
    return this.ipProtectionService.unblockIp(ip);
  }

  @Get('check/:ip')
  @ApiOperation({ summary: 'Check if an IP is currently blocked' })
  async checkIp(@Param('ip') ip: string) {
    const isBlocked = await this.ipProtectionService.isBlocked(ip);
    return { ip, isBlocked };
  }
}
