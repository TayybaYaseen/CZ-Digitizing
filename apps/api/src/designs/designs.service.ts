import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { DesignQueryDto } from './dto/design-query.dto';
import { toDesignDetailDto, toDesignSummaryDto, type DesignDetailDto, type DesignSummaryDto } from './dto/design.dto';
import type { CreateDesignDto, UpdateDesignDto } from './dto/design-write.dto';

const DESIGN_INCLUDE = {
  subcategory: true,
  categoryAssignments: true,
  sizes: true,
} satisfies Prisma.DesignInclude;

export interface PagedResult<T> {
  items: T[];
  total: number;
}

// docs/specs/2026-08-28-04-design-catalog-browsing.md §3/§4 (aspect A-006).
@Injectable()
export class DesignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-7 — faceted filters + pagination (limit enforced in DesignQueryDto, max 50).
  // includeUnpublished — admin/freelancer/moderator managing the catalog see drafts too
  // (StaffVisibilityUtil-gated in the controller); public/customer callers never do.
  async list(query: DesignQueryDto, customerId?: bigint, includeUnpublished = false): Promise<PagedResult<DesignSummaryDto>> {
    const where = this.buildWhere(query, includeUnpublished);
    const orderBy = this.buildOrderBy(query.sort);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.design.findMany({
        where,
        include: { ...DESIGN_INCLUDE, favorites: customerId ? { where: { customerId } } : false },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.design.count({ where }),
    ]);

    return { items: rows.map((r) => toDesignSummaryDto(r, customerId)), total };
  }

  async listByCategory(categoryId: string, query: DesignQueryDto, customerId?: bigint, includeUnpublished = false): Promise<PagedResult<DesignSummaryDto>> {
    return this.list({ ...query, category: [categoryId] }, customerId, includeUnpublished);
  }

  async listBySubcategory(
    subcategoryId: string,
    query: DesignQueryDto,
    customerId?: bigint,
    includeUnpublished = false,
  ): Promise<PagedResult<DesignSummaryDto>> {
    const where: Prisma.DesignWhereInput = { ...this.buildWhere(query, includeUnpublished), subcategoryId: BigInt(subcategoryId) };
    const orderBy = this.buildOrderBy(query.sort);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.design.findMany({
        where,
        include: { ...DESIGN_INCLUDE, favorites: customerId ? { where: { customerId } } : false },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.design.count({ where }),
    ]);
    return { items: rows.map((r) => toDesignSummaryDto(r, customerId)), total };
  }

  // AC-6 — simple live-suggestions search. Postgres ILIKE for now; AC-10's Elasticsearch swap is
  // a documented follow-up (same query contract, /api/designs/search?q=) once that infra exists.
  async search(q: string, customerId?: bigint): Promise<DesignSummaryDto[]> {
    if (!q.trim()) return [];
    const rows = await this.prisma.design.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }],
      },
      include: { ...DESIGN_INCLUDE, favorites: customerId ? { where: { customerId } } : false },
      take: 10,
    });
    return rows.map((r) => toDesignSummaryDto(r, customerId));
  }

  // AC-6 — live suggestions across design name/tags plus category/subcategory name matches, for
  // the header's debounced dropdown. Services/Blog/FAQ inclusion is a documented follow-up
  // (TODO(A-014, A-012d)) — those aspects are still Blocked, so this merge point only covers what
  // is actually indexable today. AC-10's Elasticsearch swap keeps this same return shape.
  async searchSuggestions(q: string): Promise<{
    designs: DesignSummaryDto[];
    categories: { id: string; name: string; slug: string }[];
    subcategories: { id: string; name: string; slug: string }[];
  }> {
    if (!q.trim()) return { designs: [], categories: [], subcategories: [] };

    const [designs, categories, subcategories] = await Promise.all([
      this.search(q),
      this.prisma.designCategory.findMany({
        where: { isPublished: true, name: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
      this.prisma.designSubcategory.findMany({
        where: { isPublished: true, name: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
    ]);

    return {
      designs,
      categories: categories.map((c) => ({ id: c.id.toString(), name: c.name, slug: c.slug })),
      subcategories: subcategories.map((s) => ({ id: s.id.toString(), name: s.name, slug: s.slug })),
    };
  }

  // AC-11 — "Customers also bought", computed from co-purchase order-history data. That data
  // (orders/order_items) doesn't exist yet — A-013 is still Blocked per docs/specs/SPEC_INDEX.md —
  // so this ships as a documented empty-state stub rather than a fabricated/random list.
  // TODO(A-013): replace with a real co-purchase query once Orders exists.
  async related(_id: string): Promise<DesignSummaryDto[]> {
    return [];
  }

  async get(id: string, customerId?: bigint, includeUnpublished = false): Promise<DesignDetailDto> {
    const row = await this.prisma.design.findFirst({
      where: { id: BigInt(id), deletedAt: null, ...(includeUnpublished ? {} : { isPublished: true }) },
      include: { ...DESIGN_INCLUDE, favorites: customerId ? { where: { customerId } } : false },
    });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Design not found');
    return toDesignDetailDto(row, customerId);
  }

  async getSizes(id: string): Promise<DesignDetailDto['sizes']> {
    const detail = await this.get(id);
    return detail.sizes;
  }

  async create(dto: CreateDesignDto, admin: AccessTokenPayload): Promise<DesignDetailDto> {
    const row = await this.prisma.design.create({
      data: {
        name: dto.name,
        description: dto.description,
        previewImageUrl: dto.previewImageUrl,
        galleryImageUrls: dto.galleryImageUrls ?? [],
        subcategoryId: dto.subcategoryId ? BigInt(dto.subcategoryId) : undefined,
        vectorImageUrl: dto.vectorImageUrl,
        vectorVideoUrl: dto.vectorVideoUrl,
        embroideryImageUrl: dto.embroideryImageUrl,
        embroideryVideoUrl: dto.embroideryVideoUrl,
        autoSwapEnabled: dto.autoSwapEnabled ?? false,
        tags: dto.tags ?? [],
        pricePkr: dto.pricePkr,
        salePricePkr: dto.salePricePkr,
        discountBadge: dto.discountBadge,
        stitchCount: dto.stitchCount,
        threadColorCount: dto.threadColorCount,
        threadColorChanges: dto.threadColorChanges,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
        // AC-2 — a design belongs to every listed category, not just the first.
        categoryAssignments: { create: dto.categoryIds.map((categoryId) => ({ categoryId: BigInt(categoryId) })) },
        sizes: {
          create: dto.sizes.map((s, i) => ({ sizeLabel: s.label, sizeWidthMm: s.widthMm, sizeHeightMm: s.heightMm, sizeOrder: i })),
        },
      },
      include: DESIGN_INCLUDE,
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_CREATED',
      resourceType: 'design',
      resourceId: row.id.toString(),
      changes: { name: row.name, categoryIds: dto.categoryIds },
    });

    return toDesignDetailDto(row);
  }

  async update(id: string, dto: UpdateDesignDto, admin: AccessTokenPayload): Promise<DesignDetailDto> {
    await this.findOrThrow(id);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.categoryIds) {
        await tx.designCategoryAssignment.deleteMany({ where: { designId: BigInt(id) } });
        await tx.designCategoryAssignment.createMany({
          data: dto.categoryIds.map((categoryId) => ({ designId: BigInt(id), categoryId: BigInt(categoryId) })),
        });
      }
      if (dto.sizes) {
        await tx.designSize.deleteMany({ where: { designId: BigInt(id) } });
        await tx.designSize.createMany({
          data: dto.sizes.map((s, i) => ({ designId: BigInt(id), sizeLabel: s.label, sizeWidthMm: s.widthMm, sizeHeightMm: s.heightMm, sizeOrder: i })),
        });
      }

      return tx.design.update({
        where: { id: BigInt(id) },
        data: {
          name: dto.name,
          description: dto.description,
          previewImageUrl: dto.previewImageUrl,
          galleryImageUrls: dto.galleryImageUrls,
          subcategoryId: dto.subcategoryId ? BigInt(dto.subcategoryId) : undefined,
          vectorImageUrl: dto.vectorImageUrl,
          vectorVideoUrl: dto.vectorVideoUrl,
          embroideryImageUrl: dto.embroideryImageUrl,
          embroideryVideoUrl: dto.embroideryVideoUrl,
          autoSwapEnabled: dto.autoSwapEnabled,
          tags: dto.tags,
          pricePkr: dto.pricePkr,
          salePricePkr: dto.salePricePkr,
          discountBadge: dto.discountBadge,
          stitchCount: dto.stitchCount,
          threadColorCount: dto.threadColorCount,
          threadColorChanges: dto.threadColorChanges,
          isPublished: dto.isPublished,
        },
        include: DESIGN_INCLUDE,
      });
    });

    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'DESIGN_UPDATED',
      resourceType: 'design',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });

    return toDesignDetailDto(row);
  }

  // Soft delete (deletedAt) — AC-4/AC-5's bundle equivalent implies purchased-design history must
  // survive a design's removal from the live catalog; a hard delete would break past order/file
  // references once A-013/A-007 exist. Excluded from every public query via deletedAt: null.
  async remove(id: string, admin: AccessTokenPayload): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.design.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date(), isPublished: false } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'DESIGN_DELETED', resourceType: 'design', resourceId: id });
  }

  // AC-8 — idempotent: favoriting an already-favorited design, or unfavoriting one that isn't, is
  // a no-op success rather than a conflict/404.
  async favorite(designId: string, customerId: bigint): Promise<void> {
    await this.prisma.favorite.upsert({
      where: { customerId_designId: { customerId, designId: BigInt(designId) } },
      create: { customerId, designId: BigInt(designId) },
      update: {},
    });
  }

  async unfavorite(designId: string, customerId: bigint): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { customerId, designId: BigInt(designId) } });
  }

  // AC-8 — "My Account → Favorites" list, sourced directly from the Favorite table rather than
  // filtering a paginated catalog page (which would silently miss favorites outside that page).
  async listFavorites(customerId: bigint): Promise<DesignSummaryDto[]> {
    const rows = await this.prisma.design.findMany({
      where: { deletedAt: null, isPublished: true, favorites: { some: { customerId } } },
      include: { ...DESIGN_INCLUDE, favorites: { where: { customerId } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toDesignSummaryDto(r, customerId));
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.design.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Design not found');
    return row;
  }

  private buildWhere(query: DesignQueryDto, includeUnpublished = false): Prisma.DesignWhereInput {
    const where: Prisma.DesignWhereInput = { deletedAt: null, ...(includeUnpublished ? {} : { isPublished: true }) };
    if (query.category?.length) where.categoryAssignments = { some: { categoryId: { in: query.category.map(BigInt) } } };
    if (query.subcategoryId) where.subcategoryId = BigInt(query.subcategoryId);
    if (query.tags?.length) where.tags = { hasSome: query.tags };
    if (query.minPricePkr !== undefined || query.maxPricePkr !== undefined) {
      where.pricePkr = { ...(query.minPricePkr !== undefined ? { gte: query.minPricePkr } : {}), ...(query.maxPricePkr !== undefined ? { lte: query.maxPricePkr } : {}) };
    }
    if (query.minStitchCount !== undefined || query.maxStitchCount !== undefined) {
      where.stitchCount = { ...(query.minStitchCount !== undefined ? { gte: query.minStitchCount } : {}), ...(query.maxStitchCount !== undefined ? { lte: query.maxStitchCount } : {}) };
    }
    if (query.threadColorCount !== undefined) where.threadColorCount = query.threadColorCount;
    return where;
  }

  private buildOrderBy(sort?: DesignQueryDto['sort']): Prisma.DesignOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { pricePkr: 'asc' };
      case 'price_desc':
        return { pricePkr: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}
