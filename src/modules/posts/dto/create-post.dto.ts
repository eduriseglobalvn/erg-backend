import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsObject, IsBoolean } from 'class-validator';
import { PostStatus } from '@/shared/enums/app.enum';
import { SchemaType } from '../entities/post.entity';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string; // <--- Thêm field này

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus = PostStatus.DRAFT;

  @IsObject()
  @IsOptional()
  meta?: any;

  // --- SEO Fields ---
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  focusKeyword?: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsString()
  @IsOptional()
  canonicalUrl?: string;

  @IsEnum(SchemaType)
  @IsOptional()
  schemaType?: SchemaType;
}