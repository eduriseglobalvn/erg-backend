import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ElearningService } from './elearning.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';

// ==================== PUBLIC ENDPOINTS ====================

@Controller('elearning')
export class ElearningPublicController {
    constructor(private readonly elearningService: ElearningService) {}

    @Get('categories')
    getAllCategories() {
        return this.elearningService.getAllCategories();
    }

    @Get('categories/:slug')
    getCategoryBySlug(@Param('slug') slug: string) {
        return this.elearningService.getCategoryBySlug(slug);
    }

    @Get('levels/:slug')
    getLevelBySlug(@Param('slug') slug: string) {
        return this.elearningService.getLevelBySlug(slug);
    }
}

// ==================== ADMIN ENDPOINTS ====================

@Controller('admin/elearning')
@UseGuards(JwtAuthGuard)
export class ElearningAdminController {
    constructor(private readonly elearningService: ElearningService) {}

    // Categories
    @Get('categories')
    getAllCategories() {
        return this.elearningService.getAllCategoriesAdmin();
    }

    @Post('categories')
    createCategory(@Body() dto: CreateCategoryDto) {
        return this.elearningService.createCategory(dto);
    }

    @Patch('categories/:id')
    updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.elearningService.updateCategory(id, dto);
    }

    @Delete('categories/:id')
    deleteCategory(@Param('id') id: string) {
        return this.elearningService.deleteCategory(id);
    }

    // Levels
    @Post('levels')
    createLevel(@Body() dto: CreateLevelDto) {
        return this.elearningService.createLevel(dto);
    }

    @Patch('levels/:id')
    updateLevel(@Param('id') id: string, @Body() dto: UpdateLevelDto) {
        return this.elearningService.updateLevel(id, dto);
    }

    @Delete('levels/:id')
    deleteLevel(@Param('id') id: string) {
        return this.elearningService.deleteLevel(id);
    }

    // Units
    @Post('units')
    createUnit(@Body() dto: CreateUnitDto) {
        return this.elearningService.createUnit(dto);
    }

    @Patch('units/:id')
    updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
        return this.elearningService.updateUnit(id, dto);
    }

    @Delete('units/:id')
    deleteUnit(@Param('id') id: string) {
        return this.elearningService.deleteUnit(id);
    }
}
