import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, wrap } from '@mikro-orm/core';
import slugify from 'slugify';
import { ElearningCategory } from './entities/elearning-category.entity';
import { ElearningLevel } from './entities/elearning-level.entity';
import { ElearningUnit } from './entities/elearning-unit.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class ElearningService {
    constructor(
        @InjectRepository(ElearningCategory, 'mongo-connection')
        private readonly categoryRepo: EntityRepository<ElearningCategory>,
        @InjectRepository(ElearningLevel, 'mongo-connection')
        private readonly levelRepo: EntityRepository<ElearningLevel>,
        @InjectRepository(ElearningUnit, 'mongo-connection')
        private readonly unitRepo: EntityRepository<ElearningUnit>,
    ) {}

    // ==================== HELPERS ====================

    private toPlain<T extends object>(entity: T): Record<string, any> {
        return wrap(entity).toObject() as Record<string, any>;
    }

    private async assembleCategories(categories: ElearningCategory[]) {
        if (categories.length === 0) return [];

        const categoryIds = categories.map((c) => c.id);
        const levels = await this.levelRepo.find(
            { categoryId: { $in: categoryIds } },
            { orderBy: { sortOrder: 'ASC' } },
        );

        const levelIds = levels.map((l) => l.id);
        const units =
            levelIds.length > 0
                ? await this.unitRepo.find(
                      { levelId: { $in: levelIds } },
                      { orderBy: { sortOrder: 'ASC' } },
                  )
                : [];

        return categories.map((cat) => {
            const catObj = this.toPlain(cat);
            catObj.levels = levels
                .filter((l) => l.categoryId === cat.id)
                .map((lvl) => {
                    const lvlObj = this.toPlain(lvl);
                    lvlObj.units = units
                        .filter((u) => u.levelId === lvl.id)
                        .map((u) => this.toPlain(u));
                    return lvlObj;
                });
            return catObj;
        });
    }

    private async assembleLevel(level: ElearningLevel) {
        const units = await this.unitRepo.find(
            { levelId: level.id },
            { orderBy: { sortOrder: 'ASC' } },
        );
        const lvlObj = this.toPlain(level);
        lvlObj.units = units.map((u) => this.toPlain(u));
        return lvlObj;
    }

    // ==================== CATEGORIES ====================

    async getAllCategories() {
        const cats = await this.categoryRepo.find(
            { isActive: true },
            { orderBy: { sortOrder: 'ASC' } },
        );
        return this.assembleCategories(cats);
    }

    async getAllCategoriesAdmin() {
        const cats = await this.categoryRepo.findAll({
            orderBy: { sortOrder: 'ASC' },
        });
        return this.assembleCategories(cats);
    }

    async getCategoryBySlug(slug: string) {
        const category = await this.categoryRepo.findOne({ slug, isActive: true });
        if (!category) throw new NotFoundException(`Không tìm thấy category: ${slug}`);
        const [assembled] = await this.assembleCategories([category]);
        return assembled;
    }

    async createCategory(dto: CreateCategoryDto): Promise<ElearningCategory> {
        const slug = dto.slug || slugify(dto.title, { lower: true, strict: true });
        const category = this.categoryRepo.create({ ...dto, slug } as any);
        await this.categoryRepo.getEntityManager().persistAndFlush(category);
        return category;
    }

    async updateCategory(id: string, dto: UpdateCategoryDto): Promise<ElearningCategory> {
        const category = await this.categoryRepo.findOne({ id });
        if (!category) throw new NotFoundException(`Không tìm thấy category: ${id}`);
        if (dto.slug) dto.slug = slugify(dto.slug, { lower: true, strict: true });
        wrap(category).assign(dto);
        await this.categoryRepo.getEntityManager().flush();
        return category;
    }

    async deleteCategory(id: string): Promise<void> {
        const category = await this.categoryRepo.findOne({ id });
        if (!category) throw new NotFoundException(`Không tìm thấy category: ${id}`);
        const levels = await this.levelRepo.find({ categoryId: id });
        const levelIds = levels.map((l) => l.id);
        if (levelIds.length > 0) {
            await this.unitRepo.nativeDelete({ levelId: { $in: levelIds } });
            await this.levelRepo.nativeDelete({ categoryId: id });
        }
        await this.categoryRepo.getEntityManager().removeAndFlush(category);
    }

    // ==================== LEVELS ====================

    async getLevelBySlug(slug: string) {
        const level = await this.levelRepo.findOne({ slug, isActive: true });
        if (!level) throw new NotFoundException(`Không tìm thấy level: ${slug}`);
        return this.assembleLevel(level);
    }

    async createLevel(dto: CreateLevelDto): Promise<ElearningLevel> {
        const category = await this.categoryRepo.findOne({ id: dto.categoryId });
        if (!category) throw new NotFoundException(`Không tìm thấy category: ${dto.categoryId}`);
        const slug = dto.slug || slugify(dto.title, { lower: true, strict: true });
        const level = this.levelRepo.create({ ...dto, slug } as any);
        await this.levelRepo.getEntityManager().persistAndFlush(level);
        return level;
    }

    async updateLevel(id: string, dto: UpdateLevelDto): Promise<ElearningLevel> {
        const level = await this.levelRepo.findOne({ id });
        if (!level) throw new NotFoundException(`Không tìm thấy level: ${id}`);
        if (dto.slug) dto.slug = slugify(dto.slug, { lower: true, strict: true });
        wrap(level).assign(dto);
        await this.levelRepo.getEntityManager().flush();
        return level;
    }

    async deleteLevel(id: string): Promise<void> {
        const level = await this.levelRepo.findOne({ id });
        if (!level) throw new NotFoundException(`Không tìm thấy level: ${id}`);
        await this.unitRepo.nativeDelete({ levelId: id });
        await this.levelRepo.getEntityManager().removeAndFlush(level);
    }

    // ==================== UNITS ====================

    async createUnit(dto: CreateUnitDto): Promise<ElearningUnit> {
        const level = await this.levelRepo.findOne({ id: dto.levelId });
        if (!level) throw new NotFoundException(`Không tìm thấy level: ${dto.levelId}`);
        const unit = this.unitRepo.create({ ...dto } as any);
        await this.unitRepo.getEntityManager().persistAndFlush(unit);
        return unit;
    }

    async updateUnit(id: string, dto: UpdateUnitDto): Promise<ElearningUnit> {
        const unit = await this.unitRepo.findOne({ id });
        if (!unit) throw new NotFoundException(`Không tìm thấy unit: ${id}`);
        wrap(unit).assign(dto);
        await this.unitRepo.getEntityManager().flush();
        return unit;
    }

    async deleteUnit(id: string): Promise<void> {
        const unit = await this.unitRepo.findOne({ id });
        if (!unit) throw new NotFoundException(`Không tìm thấy unit: ${id}`);
        await this.unitRepo.getEntityManager().removeAndFlush(unit);
    }
}
