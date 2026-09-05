import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toHomeSectionDto } from './dto/home-section.dto';
import type { CreateHomeSectionDto, ReorderHomeSectionsDto, UpdateHomeSectionDto } from './dto/home-section-write.dto';

const SECTION_INCLUDE = {
  designs: { include: { design: { include: { subcategory: true, categoryAssignments: true } } } },
} satisfies Prisma.HomeSectionInclude;

// docs/specs/2026-08-28-13-home-promotions-cms.md §2-4 (aspect A-018a).
@Injectable()
export class HomeSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-1/AC-2 — published, Admin-ordered. Capping at 6 + View More is a frontend concern (Admin
  // may curate more than 6 designs into one section).
  async list(includeUnpublished = false) {
    const rows = await this.prisma.homeSection.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      include: SECTION_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toHomeSectionDto);
  }

  async create(dto: CreateHomeSectionDto, admin: AccessTokenPayload) {
    const row = await this.prisma.homeSection.create({
      data: {
        heading: dto.heading,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
        designs: { create: dto.designIds.map((designId, i) => ({ designId: BigInt(designId), sortOrder: i })) },
      },
      include: SECTION_INCLUDE,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HOME_SECTION_CREATED', resourceType: 'home_section', resourceId: row.id.toString() });
    return toHomeSectionDto(row);
  }

  async update(id: string, dto: UpdateHomeSectionDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.designIds) {
        await tx.homeSectionDesign.deleteMany({ where: { homeSectionId: BigInt(id) } });
        await tx.homeSectionDesign.createMany({
          data: dto.designIds.map((designId, i) => ({ homeSectionId: BigInt(id), designId: BigInt(designId), sortOrder: i })),
        });
      }
      return tx.homeSection.update({
        where: { id: BigInt(id) },
        data: { heading: dto.heading, description: dto.description, sortOrder: dto.sortOrder, isPublished: dto.isPublished },
        include: SECTION_INCLUDE,
      });
    });

    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HOME_SECTION_UPDATED', resourceType: 'home_section', resourceId: id, changes: dto as Record<string, unknown> });
    return toHomeSectionDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.homeSection.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HOME_SECTION_DELETED', resourceType: 'home_section', resourceId: id });
  }

  // AC-2/AC-7 — sections render in Admin-defined order; reflects immediately, no deploy.
  async reorder(dto: ReorderHomeSectionsDto, admin: AccessTokenPayload) {
    await this.prisma.$transaction(dto.items.map((i) => this.prisma.homeSection.update({ where: { id: BigInt(i.id) }, data: { sortOrder: i.sortOrder } })));
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HOME_SECTIONS_REORDERED', resourceType: 'home_section', changes: { items: dto.items } });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.homeSection.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Home section not found');
    return row;
  }
}
