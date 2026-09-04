import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { toPortfolioItemDto } from './dto/portfolio.dto';
import type { CreatePortfolioItemDto, ReorderPortfolioDto, UpdatePortfolioItemDto } from './dto/portfolio-write.dto';

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012f). No languageCode by
// design (AC-17) — title/description render as Admin entered them in every language.
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(includeUnpublished = false) {
    const rows = await this.prisma.portfolioItem.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toPortfolioItemDto);
  }

  async get(id: string, includeUnpublished = false) {
    const row = await this.prisma.portfolioItem.findFirst({ where: { id: BigInt(id), ...(includeUnpublished ? {} : { isPublished: true }) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Portfolio item not found');
    return toPortfolioItemDto(row);
  }

  async create(dto: CreatePortfolioItemDto, admin: AccessTokenPayload) {
    const row = await this.prisma.portfolioItem.create({
      data: {
        title: dto.title,
        description: dto.description,
        mediaUrls: dto.mediaUrls,
        category: dto.category,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'PORTFOLIO_ITEM_CREATED', resourceType: 'portfolio_item', resourceId: row.id.toString() });
    return toPortfolioItemDto(row);
  }

  async update(id: string, dto: UpdatePortfolioItemDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.portfolioItem.update({
      where: { id: BigInt(id) },
      data: {
        title: dto.title,
        description: dto.description,
        mediaUrls: dto.mediaUrls,
        category: dto.category,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'PORTFOLIO_ITEM_UPDATED', resourceType: 'portfolio_item', resourceId: id, changes: dto as Record<string, unknown> });
    return toPortfolioItemDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.portfolioItem.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'PORTFOLIO_ITEM_DELETED', resourceType: 'portfolio_item', resourceId: id });
  }

  // AC-13 — bulk sortOrder update, reflects on the public page immediately.
  async reorder(dto: ReorderPortfolioDto, admin: AccessTokenPayload) {
    await this.prisma.$transaction(dto.items.map((i) => this.prisma.portfolioItem.update({ where: { id: BigInt(i.id) }, data: { sortOrder: i.sortOrder } })));
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'PORTFOLIO_REORDERED', resourceType: 'portfolio_item', changes: { items: dto.items } });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.portfolioItem.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Portfolio item not found');
    return row;
  }
}
