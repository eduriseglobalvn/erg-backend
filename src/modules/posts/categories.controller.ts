import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreateCategoryDto } from '@/modules/posts/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/posts/dto/update-category.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/access-control/guards/permissions.guard';
import { Permissions } from '@/modules/access-control/decorators/permissions.decorator';

@Controller('posts/categories')
export class CategoriesController {
    constructor(private readonly postsService: PostsService) { }

    @Post()
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.settings') // Chỉ Admin mới đc tạo Category
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.postsService.createCategory(createCategoryDto);
    }

    @Get()
    findAll() {
        return this.postsService.findAllCategories();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.postsService.findCategoryOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.settings')
    update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
        return this.postsService.updateCategory(id, updateCategoryDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @Permissions('system.settings')
    remove(@Param('id') id: string) {
        return this.postsService.removeCategory(id);
    }
}
