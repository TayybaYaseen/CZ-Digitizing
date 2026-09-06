import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveAdvertisement } from './active-advertisement.util';
import { toAdvertisementDto } from './dto/advertisement.dto';
import type { CreateAdvertisementDto, UpdateAdvertisementDto } from './dto/advertisement-write.dto';

const AD_INCLUDE = { targetDesigns: true } satisfies Prisma.AdvertisementInclude;

// docs/specs/2026-08-28-13-home-promotions-cms.md §2-4 (aspect A-018b).
@Injectable()
export class AdvertisementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-3/AC-4/AC-5 — returns null (204, no body) when nothing is currently active; the frontend
  // must render zero ad-area layout, not an empty container, on that response.
  async getActive() {
    const candidates = await this.prisma.advertisement.findMany({ where: { isActive: true }, include: AD_INCLUDE });
    const active = resolveActiveAdvertisement(new Date(), candidates);
    return active ? toAdvertisementDto(active) : null;
  }

  async listAdmin() {
    const rows = await this.prisma.advertisement.findMany({ include: AD_INCLUDE, orderBy: { createdAt: 'desc' } });
    return rows.map(toAdvertisementDto);
  }

  async create(dto: CreateAdvertisementDto, admin: AccessTokenPayload) {
    this.validateTargeting(dto.targetCategoryId, dto.targetDesignIds);
    const row = await this.prisma.advertisement.create({
      data: {
        heading: dto.heading,
        subheading: dto.subheading,
        offerText: dto.offerText,
        bannerImageUrl: dto.bannerImageUrl,
        bannerVideoUrl: dto.bannerVideoUrl,
        ctaText: dto.ctaText,
        ctaLink: dto.ctaLink,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? false,
        targetCategoryId: dto.targetCategoryId ? BigInt(dto.targetCategoryId) : undefined,
        createdByAdminId: BigInt(admin.sub),
        targetDesigns: dto.targetDesignIds?.length ? { create: dto.targetDesignIds.map((designId) => ({ designId: BigInt(designId) })) } : undefined,
      },
      include: AD_INCLUDE,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'ADVERTISEMENT_CREATED', resourceType: 'advertisement', resourceId: row.id.toString() });
    return toAdvertisementDto(row);
  }

  async update(id: string, dto: UpdateAdvertisementDto, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    const nextCategory = dto.targetCategoryId !== undefined ? dto.targetCategoryId : existing.targetCategoryId?.toString();
    if (dto.targetCategoryId !== undefined || dto.targetDesignIds !== undefined) {
      this.validateTargeting(nextCategory, dto.targetDesignIds);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.targetDesignIds) {
        await tx.advertisementTargetDesign.deleteMany({ where: { advertisementId: BigInt(id) } });
        if (dto.targetDesignIds.length) {
          await tx.advertisementTargetDesign.createMany({ data: dto.targetDesignIds.map((designId) => ({ advertisementId: BigInt(id), designId: BigInt(designId) })) });
        }
      }
      return tx.advertisement.update({
        where: { id: BigInt(id) },
        data: {
          heading: dto.heading,
          subheading: dto.subheading,
          offerText: dto.offerText,
          bannerImageUrl: dto.bannerImageUrl,
          bannerVideoUrl: dto.bannerVideoUrl,
          ctaText: dto.ctaText,
          ctaLink: dto.ctaLink,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          isActive: dto.isActive,
          targetCategoryId: dto.targetCategoryId !== undefined ? (dto.targetCategoryId ? BigInt(dto.targetCategoryId) : null) : undefined,
        },
        include: AD_INCLUDE,
      });
    });

    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'ADVERTISEMENT_UPDATED', resourceType: 'advertisement', resourceId: id, changes: dto as Record<string, unknown> });
    return toAdvertisementDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.advertisement.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'ADVERTISEMENT_DELETED', resourceType: 'advertisement', resourceId: id });
  }

  // SRS: "category OR specific designs" — never both.
  private validateTargeting(targetCategoryId?: string, targetDesignIds?: string[]) {
    if (targetCategoryId && targetDesignIds?.length) {
      throw new ApiException('ADVERTISEMENT_TARGET_CONFLICT', 422, 'An advertisement may target a category or specific designs, not both');
    }
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.advertisement.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Advertisement not found');
    return row;
  }
}
