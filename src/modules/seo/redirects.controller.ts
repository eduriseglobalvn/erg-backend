import { Controller, Get, Post, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { RedirectsService } from './services/redirects.service';

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
