import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { DesignCategory, DesignSubcategory } from '../../generated/prisma';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface SubcategoryDto extends CategoryDto {
  parentCategoryId: string;
}

export function toCategoryDto(category: DesignCategory): CategoryDto {
  return {
    id: category.id.toString(),
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    isPublished: category.isPublished,
  };
}

export function toSubcategoryDto(sub: DesignSubcategory): SubcategoryDto {
  return { ...toCategoryDto(sub), parentCategoryId: sub.parentCategoryId.toString() };
}

// AC-1 — Admin creates a main category, optionally with subcategories.
export class CreateCategoryDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(255)
  slug!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class CreateSubcategoryDto extends CreateCategoryDto {}
export class UpdateSubcategoryDto extends UpdateCategoryDto {}
