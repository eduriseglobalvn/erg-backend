import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Patch } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';
import type { Request } from 'express';
import { SchemaMarkupService } from '@/modules/seo/services/schema-markup.service';

interface RequestWithUser extends Request {
    user: {
        sub: string;
    };
}

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
    constructor(
        private readonly coursesService: CoursesService,
        private readonly schemaMarkupService: SchemaMarkupService,
    ) { }

    @Get()
    findAll() {
        return this.coursesService.findAll();
    }

    @Get('subdomain/:sub')
    findBySubdomain(@Param('sub') subdomain: string) {
        return this.coursesService.findBySubdomain(subdomain);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req: Request) {
        const course = await this.coursesService.findOne(id);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host || 'erg.edu.vn';
        const baseUrl = `${protocol}://${host}`;

        const schema = this.schemaMarkupService.generateCourseSchema(course, baseUrl);
        return { course, schema };
    }

    @Post()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('courses.create')
    create(@Body() dto: CreateCourseDto, @Req() req: RequestWithUser) {
        return this.coursesService.create(dto, req.user.sub);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('courses.update')
    update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
        return this.coursesService.update(id, dto);
    }

    @Patch(':id/theme')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('courses.update')
    updateTheme(@Param('id') id: string, @Body() dto: UpdateThemeDto) {
        return this.coursesService.updateTheme(id, dto.themeConfig);
    }

    @Post(':id/lessons/reorder')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('courses.update')
    reorderLessons(@Param('id') id: string, @Body('lessonIds') lessonIds: string[]) {
        return this.coursesService.reorderLessons(id, lessonIds);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('courses.delete')
    remove(@Param('id') id: string) {
        return this.coursesService.remove(id);
    }
}
