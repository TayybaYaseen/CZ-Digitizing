import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toHeaderMediaDto } from './dto/header-media.dto';
import type { CreateHeaderMediaDto, UpdateHeaderMediaDto } from './dto/header-media-write.dto';

// docs/specs/2026-08-28-13-home-promotions-cms.md §2-4 (aspect A-018c).
@Injectable()
export class HeaderMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-6/AC-10 — active window + per-platform visibility, ordered by priority.
  async listActive(platform: 'desktop' | 'mobile_web' | 'mobile_app' = 'desktop') {
    const now = new Date();
    const platformFilter: Prisma.HeaderMediaWhereInput =
      platform === 'mobile_web' ? { visibleMobileWeb: true } : platform === 'mobile_app' ? { visibleMobileApp: true } : { visibleDesktop: true };
    const where: Prisma.HeaderMediaWhereInput = {
      isActive: true,
      ...platformFilter,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
    };
    const rows = await this.prisma.headerMedia.findMany({ where, orderBy: { priority: 'desc' } });
    // endDate filter applied in JS (Prisma can't express "null OR >= now" cleanly alongside the OR above)
    return rows.filter((r) => !r.endDate || r.endDate >= now).map(toHeaderMediaDto);
  }

  async listAdmin() {
    const rows = await this.prisma.headerMedia.findMany({ orderBy: { priority: 'desc' } });
    return rows.map(toHeaderMediaDto);
  }

  async create(dto: CreateHeaderMediaDto, admin: AccessTokenPayload) {
    const row = await this.prisma.headerMedia.create({
      data: {
        imageUrl: dto.imageUrl,
        videoUrl: dto.videoUrl,
        heading: dto.heading,
        subheading: dto.subheading,
        ctaLink: dto.ctaLink,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? false,
        isCarouselItem: dto.isCarouselItem ?? true,
        visibleDesktop: dto.visibleDesktop ?? true,
        visibleMobileWeb: dto.visibleMobileWeb ?? true,
        visibleMobileApp: dto.visibleMobileApp ?? true,
        autoSlideDurationSeconds: dto.autoSlideDurationSeconds ?? 5,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HEADER_MEDIA_CREATED', resourceType: 'header_media', resourceId: row.id.toString() });
    return toHeaderMediaDto(row);
  }

  async update(id: string, dto: UpdateHeaderMediaDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.headerMedia.update({
      where: { id: BigInt(id) },
      data: {
        imageUrl: dto.imageUrl,
        videoUrl: dto.videoUrl,
        heading: dto.heading,
        subheading: dto.subheading,
        ctaLink: dto.ctaLink,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        priority: dto.priority,
        isActive: dto.isActive,
        isCarouselItem: dto.isCarouselItem,
        visibleDesktop: dto.visibleDesktop,
        visibleMobileWeb: dto.visibleMobileWeb,
        visibleMobileApp: dto.visibleMobileApp,
        autoSlideDurationSeconds: dto.autoSlideDurationSeconds,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HEADER_MEDIA_UPDATED', resourceType: 'header_media', resourceId: id, changes: dto as Record<string, unknown> });
    return toHeaderMediaDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.headerMedia.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'HEADER_MEDIA_DELETED', resourceType: 'header_media', resourceId: id });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.headerMedia.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Header media item not found');
    return row;
  }
}
