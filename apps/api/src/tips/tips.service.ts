import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { PagedResult } from '../designs/designs.service';
import type { TipQueryDto } from './dto/tip-query.dto';
import { toTipDto } from './dto/tip.dto';
import type { CreateTipDto, UpdateTipDto } from './dto/tip-write.dto';

const TIP_INCLUDE = { faqLinks: true } satisfies Prisma.EmbroidererTipInclude;

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012b).
@Injectable()
export class TipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: TipQueryDto, includeUnpublished = false): Promise<PagedResult<ReturnType<typeof toTipDto>>> {
    const where: Prisma.EmbroidererTipWhereInput = { ...(includeUnpublished ? {} : { isPublished: true }) };
    if (query.category) where.category = query.category;
    if (query.language_code) where.languageCode = query.language_code;
    if (query.linkedFaqId) where.faqLinks = { some: { faqId: BigInt(query.linkedFaqId) } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.embroidererTip.findMany({
        where,
        include: TIP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.embroidererTip.count({ where }),
    ]);
    return { items: rows.map(toTipDto), total };
  }

  async get(id: string, includeUnpublished = false) {
    const row = await this.prisma.embroidererTip.findFirst({
      where: { id: BigInt(id), ...(includeUnpublished ? {} : { isPublished: true }) },
      include: TIP_INCLUDE,
    });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Tip not found');
    return toTipDto(row);
  }

  async create(dto: CreateTipDto, admin: AccessTokenPayload) {
    const row = await this.prisma.embroidererTip.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        languageCode: dto.languageCode ?? 'en',
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
        faqLinks: dto.faqIds?.length ? { create: dto.faqIds.map((faqId) => ({ faqId: BigInt(faqId) })) } : undefined,
      },
      include: TIP_INCLUDE,
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TIP_CREATED', resourceType: 'embroiderer_tip', resourceId: row.id.toString() });
    return toTipDto(row);
  }

  async update(id: string, dto: UpdateTipDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.faqIds) {
        await tx.tipFaqLink.deleteMany({ where: { tipId: BigInt(id) } });
        if (dto.faqIds.length) {
          await tx.tipFaqLink.createMany({ data: dto.faqIds.map((faqId) => ({ tipId: BigInt(id), faqId: BigInt(faqId) })) });
        }
      }
      return tx.embroidererTip.update({
        where: { id: BigInt(id) },
        data: {
          title: dto.title,
          content: dto.content,
          category: dto.category,
          languageCode: dto.languageCode,
          isPublished: dto.isPublished,
        },
        include: TIP_INCLUDE,
      });
    });

    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TIP_UPDATED', resourceType: 'embroiderer_tip', resourceId: id, changes: dto as Record<string, unknown> });
    return toTipDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.embroidererTip.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TIP_DELETED', resourceType: 'embroiderer_tip', resourceId: id });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.embroidererTip.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Tip not found');
    return row;
  }
}
