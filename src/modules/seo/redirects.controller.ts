import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RedirectsService } from './services/redirects.service';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('seo.manage')
@Controller('seo/redirects')
export class RedirectsController {
    constructor(private readonly redirectsService: RedirectsService) { }

    @Get()
    async findAll(@Query('page') page: number, @Query('limit') limit: number) {
        return this.redirectsService.findAll(page, limit);
    }

    @Post()
    async create(@Body() body: { fromPath: string; toPath: string; statusCode?: number }) {
        return this.redirectsService.create(body);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.redirectsService.delete(id);
    }
}
