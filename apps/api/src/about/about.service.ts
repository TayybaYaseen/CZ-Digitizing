import { Injectable } from '@nestjs/common';
import type { AboutContentDto } from '@czd/shared-types';
import type { AboutContent } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertAboutContentDto } from './dto/about-write.dto';

function toDto(row: AboutContent): AboutContentDto {
  return {
    languageCode: row.languageCode,
    heading: row.heading,
    body: row.body,
    imageUrls: row.imageUrls as string[],
    updatedAt: row.updatedAt.toISOString(),
  };
}

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012e). AC-11 — single
// always-live page per language, no publish/unpublish step by design.
@Injectable()
export class AboutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // English fallback per the Internationalization spec, mirroring AC-10's Blog fallback contract.
  async get(languageCode = 'en'): Promise<AboutContentDto> {
    const row = (await this.prisma.aboutContent.findUnique({ where: { languageCode } }))
      ?? (await this.prisma.aboutContent.findUnique({ where: { languageCode: 'en' } }));
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'About content not found');
    return toDto(row);
  }

  // AC-11 — saved content becomes active immediately, no separate publish step.
  async upsert(dto: UpsertAboutContentDto, admin: AccessTokenPayload): Promise<AboutContentDto> {
    const row = await this.prisma.aboutContent.upsert({
      where: { languageCode: dto.languageCode },
      create: {
        languageCode: dto.languageCode,
        heading: dto.heading,
        body: dto.body,
        imageUrls: dto.imageUrls ?? [],
        updatedByAdminId: BigInt(admin.sub),
      },
      update: {
        heading: dto.heading,
        body: dto.body,
        imageUrls: dto.imageUrls ?? [],
        updatedByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'ABOUT_CONTENT_UPDATED', resourceType: 'about_content', resourceId: dto.languageCode });
    return toDto(row);
  }
}
