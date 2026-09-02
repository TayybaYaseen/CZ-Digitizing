import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto, CreateSubcategoryDto, UpdateCategoryDto, UpdateSubcategoryDto } from './dto/category.dto';
import { toCategoryDto, toSubcategoryDto, type CategoryDto, type SubcategoryDto } from './dto/category.dto';

// docs/specs/2026-08-28-04-design-catalog-browsing.md §3/§4 (aspect A-006, AC-1).
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listCategories(publishedOnly: boolean): Promise<CategoryDto[]> {
    const rows = await this.prisma.designCategory.findMany({
      where: publishedOnly ? { isPublished: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toCategoryDto);
  }

  async getCategory(id: string): Promise<CategoryDto> {
    const row = await this.findCategoryOrThrow(id);
    return toCategoryDto(row);
  }

  async listSubcategories(categoryId: string, publishedOnly: boolean): Promise<SubcategoryDto[]> {
    const rows = await this.prisma.designSubcategory.findMany({
      where: { parentCategoryId: BigInt(categoryId), ...(publishedOnly ? { isPublished: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toSubcategoryDto);
  }

  async createCategory(dto: CreateCategoryDto, admin: AccessTokenPayload): Promise<CategoryDto> {
    await this.assertSlugAvailable('designCategory', dto.slug);
    const row = await this.prisma.designCategory.create({
      data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder ?? 0, isPublished: dto.isPublished ?? false },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_CATEGORY_CREATED',
      resourceType: 'design_category',
      resourceId: row.id.toString(),
      changes: { name: row.name, slug: row.slug },
    });
    return toCategoryDto(row);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, admin: AccessTokenPayload): Promise<CategoryDto> {
    await this.findCategoryOrThrow(id);
    if (dto.slug) await this.assertSlugAvailable('designCategory', dto.slug, id);

    const row = await this.prisma.designCategory.update({ where: { id: BigInt(id) }, data: dto });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_CATEGORY_UPDATED',
      resourceType: 'design_category',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });
    return toCategoryDto(row);
  }

  async deleteCategory(id: string, admin: AccessTokenPayload): Promise<void> {
    await this.findCategoryOrThrow(id);
    await this.prisma.designCategory.delete({ where: { id: BigInt(id) } });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_CATEGORY_DELETED',
      resourceType: 'design_category',
      resourceId: id,
    });
  }

  async createSubcategory(categoryId: string, dto: CreateSubcategoryDto, admin: AccessTokenPayload): Promise<SubcategoryDto> {
    await this.findCategoryOrThrow(categoryId);
    await this.assertSlugAvailable('designSubcategory', dto.slug);
    const row = await this.prisma.designSubcategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parentCategoryId: BigInt(categoryId),
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
      },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_SUBCATEGORY_CREATED',
      resourceType: 'design_subcategory',
      resourceId: row.id.toString(),
      changes: { name: row.name, slug: row.slug, parentCategoryId: categoryId },
    });
    return toSubcategoryDto(row);
  }

  async updateSubcategory(id: string, dto: UpdateSubcategoryDto, admin: AccessTokenPayload): Promise<SubcategoryDto> {
    await this.findSubcategoryOrThrow(id);
    if (dto.slug) await this.assertSlugAvailable('designSubcategory', dto.slug, id);

    const row = await this.prisma.designSubcategory.update({ where: { id: BigInt(id) }, data: dto });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_SUBCATEGORY_UPDATED',
      resourceType: 'design_subcategory',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });
    return toSubcategoryDto(row);
  }

  async deleteSubcategory(id: string, admin: AccessTokenPayload): Promise<void> {
    await this.findSubcategoryOrThrow(id);
    await this.prisma.designSubcategory.delete({ where: { id: BigInt(id) } });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_SUBCATEGORY_DELETED',
      resourceType: 'design_subcategory',
      resourceId: id,
    });
  }

  private async findCategoryOrThrow(id: string) {
    const row = await this.prisma.designCategory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Category not found');
    return row;
  }

  private async findSubcategoryOrThrow(id: string) {
    const row = await this.prisma.designSubcategory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Subcategory not found');
    return row;
  }

  private async assertSlugAvailable(model: 'designCategory' | 'designSubcategory', slug: string, excludeId?: string) {
    const existing =
      model === 'designCategory'
        ? await this.prisma.designCategory.findUnique({ where: { slug } })
        : await this.prisma.designSubcategory.findUnique({ where: { slug } });
    if (existing && existing.id.toString() !== excludeId) {
      throw new ApiException('CONFLICT', 409, `Slug "${slug}" is already in use`);
    }
  }
}
