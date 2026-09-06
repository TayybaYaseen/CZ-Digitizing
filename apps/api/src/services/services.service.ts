import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { Service } from '../generated/prisma';
import type { CreateServiceDto, ReorderServiceDto, UpdateServiceDto } from './dto/service-write.dto';
import { toServiceDetailDto, toServiceSummaryDto } from './dto/service.dto';

// docs/specs/2026-08-29-17-services-module.md §3/§4 (aspect A-014, A-014a, A-014b).
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-1 — the two main services (parentServiceId null) with their sub-services nested.
  async listMainServices(publishedOnly: boolean) {
    const mainServices = await this.prisma.service.findMany({
      where: { parentServiceId: null, ...(publishedOnly ? { isPublished: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
    const subServicesByParent = await this.groupSubServices(
      mainServices.map((s) => s.id),
      publishedOnly,
    );
    return mainServices.map((row) => ({
      ...toServiceSummaryDto(row),
      subServices: (subServicesByParent.get(row.id.toString()) ?? []).map(toServiceSummaryDto),
    }));
  }

  // AC-2/AC-3/AC-5/AC-6 — full detail by slug, including resolved FAQs and sub-services (for the
  // two main services) or the sibling list is omitted for a sub-service.
  async getBySlug(slug: string, publishedOnly: boolean) {
    const row = await this.prisma.service.findUnique({ where: { slug } });
    if (!row || (publishedOnly && !row.isPublished)) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Service not found');

    const relatedFaqIds = await this.resolveRelatedFaqIds(row);
    let subServices: Service[] | undefined;
    if (!row.parentServiceId) {
      const map = await this.groupSubServices([row.id], publishedOnly);
      subServices = map.get(row.id.toString()) ?? [];
    }
    return toServiceDetailDto(row, relatedFaqIds, subServices);
  }

  // AC-8 — Admin write. A sub-service's parent must exist and must itself be a main service
  // (parentServiceId null) of the *same* type — mirrors DesignSubcategory's parent-must-exist rule,
  // extended per this spec's own hierarchy since a sub-service can't attach to another sub-service.
  async create(dto: CreateServiceDto, admin: AccessTokenPayload) {
    await this.assertSlugAvailable(dto.slug);
    if (dto.parentServiceId) await this.assertValidParent(dto.parentServiceId, dto.type);

    const row = await this.prisma.service.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        parentServiceId: dto.parentServiceId ? BigInt(dto.parentServiceId) : undefined,
        description: dto.description,
        visualImageUrl: dto.visualImageUrl,
        applications: dto.applications,
        process: dto.process,
        relatedDesignCategoryId: dto.relatedDesignCategoryId ? BigInt(dto.relatedDesignCategoryId) : undefined,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'SERVICE_CREATED',
      resourceType: 'service',
      resourceId: row.id.toString(),
      changes: { name: row.name, slug: row.slug },
    });
    return toServiceSummaryDto(row);
  }

  async update(id: string, dto: UpdateServiceDto, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);
    if (dto.parentServiceId) await this.assertValidParent(dto.parentServiceId, dto.type ?? existing.type, id);

    const row = await this.prisma.service.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        parentServiceId: dto.parentServiceId !== undefined ? BigInt(dto.parentServiceId) : undefined,
        description: dto.description,
        visualImageUrl: dto.visualImageUrl,
        applications: dto.applications,
        process: dto.process,
        relatedDesignCategoryId: dto.relatedDesignCategoryId !== undefined ? BigInt(dto.relatedDesignCategoryId) : undefined,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'SERVICE_UPDATED',
      resourceType: 'service',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });
    return toServiceSummaryDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.service.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'SERVICE_DELETED', resourceType: 'service', resourceId: id });
  }

  async reorder(id: string, dto: ReorderServiceDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.service.update({ where: { id: BigInt(id) }, data: { sortOrder: dto.sortOrder } });
    await this.audit.record({
      adminUserId: BigInt(admin.sub),
      actionType: 'SERVICE_REORDERED',
      resourceType: 'service',
      resourceId: id,
      changes: { sortOrder: dto.sortOrder },
    });
    return toServiceSummaryDto(row);
  }

  private async groupSubServices(parentIds: bigint[], publishedOnly: boolean) {
    const rows = await this.prisma.service.findMany({
      where: { parentServiceId: { in: parentIds }, ...(publishedOnly ? { isPublished: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
    const map = new Map<string, Service[]>();
    for (const row of rows) {
      const key = row.parentServiceId!.toString();
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }

  // AC-6 — faqs.related_service/related_category matched by value against this service's
  // slug/name (no FK — spec §4/§8 risk #1: shared vocabulary, not a shared table).
  private async resolveRelatedFaqIds(service: Service): Promise<string[]> {
    const rows = await this.prisma.faq.findMany({
      where: {
        isPublished: true,
        OR: [{ relatedService: service.slug }, { relatedService: service.name }, { relatedCategory: service.slug }, { relatedCategory: service.name }],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id.toString());
  }

  private async assertValidParent(parentServiceId: string, type: string, selfId?: string) {
    if (parentServiceId === selfId) throw new ApiException('VALIDATION_ERROR', 400, 'A service cannot be its own parent');
    const parent = await this.prisma.service.findUnique({ where: { id: BigInt(parentServiceId) } });
    if (!parent) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Parent service not found');
    if (parent.parentServiceId) throw new ApiException('VALIDATION_ERROR', 400, 'Parent service must itself be a main service, not a sub-service');
    if (parent.type !== type) throw new ApiException('VALIDATION_ERROR', 400, 'A sub-service must share its parent service\'s type');
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.service.findUnique({ where: { slug } });
    if (existing && existing.id.toString() !== excludeId) {
      throw new ApiException('CONFLICT', 409, `Slug "${slug}" is already in use`);
    }
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.service.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Service not found');
    return row;
  }
}
