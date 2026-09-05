import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { FaqQueryDto } from './dto/faq-query.dto';
import { toFaqDto } from './dto/faq.dto';
import type { CreateFaqDto, UpdateFaqDto } from './dto/faq-write.dto';

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012a).
@Injectable()
export class FaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-1/AC-2 — filter by topic/language_code, published-only for public/customer callers.
  async list(query: FaqQueryDto, includeUnpublished = false) {
    const where: Prisma.FaqWhereInput = { ...(includeUnpublished ? {} : { isPublished: true }) };
    if (query.topic) where.topic = query.topic;
    if (query.language_code) where.languageCode = query.language_code;

    const rows = await this.prisma.faq.findMany({ where, orderBy: [{ topic: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toFaqDto);
  }

  // AC-2 — searches question/answer/topic text.
  async search(q: string, languageCode?: string, includeUnpublished = false) {
    if (!q.trim()) return [];
    const rows = await this.prisma.faq.findMany({
      where: {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(languageCode ? { languageCode } : {}),
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { answer: { contains: q, mode: 'insensitive' } },
          { topic: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 25,
    });
    return rows.map(toFaqDto);
  }

  // TODO(A-020, A-012a): Taebo's own source-of-truth query — surfaces only taeboVisible &&
  // isPublished entries, per spec §1's "contractually forbidden to deviate" contract. Kept here
  // rather than duplicated once A-020 (still Blocked) is built.
  async listTaeboVisible(languageCode?: string) {
    const rows = await this.prisma.faq.findMany({
      where: { isPublished: true, taeboVisible: true, ...(languageCode ? { languageCode } : {}) },
      orderBy: [{ priority: 'desc' }],
    });
    return rows.map(toFaqDto);
  }

  async get(id: string, includeUnpublished = false) {
    const row = await this.prisma.faq.findFirst({ where: { id: BigInt(id), ...(includeUnpublished ? {} : { isPublished: true }) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'FAQ not found');
    return toFaqDto(row);
  }

  async create(dto: CreateFaqDto, admin: AccessTokenPayload) {
    const row = await this.prisma.faq.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        topic: dto.topic,
        relatedPage: dto.relatedPage,
        relatedService: dto.relatedService,
        relatedCategory: dto.relatedCategory,
        languageCode: dto.languageCode ?? 'en',
        priority: dto.priority ?? 0,
        taeboVisible: dto.taeboVisible ?? false,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'FAQ_CREATED', resourceType: 'faq', resourceId: row.id.toString() });
    return toFaqDto(row);
  }

  async update(id: string, dto: UpdateFaqDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.faq.update({
      where: { id: BigInt(id) },
      data: {
        question: dto.question,
        answer: dto.answer,
        topic: dto.topic,
        relatedPage: dto.relatedPage,
        relatedService: dto.relatedService,
        relatedCategory: dto.relatedCategory,
        languageCode: dto.languageCode,
        priority: dto.priority,
        taeboVisible: dto.taeboVisible,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'FAQ_UPDATED', resourceType: 'faq', resourceId: id, changes: dto as Record<string, unknown> });
    return toFaqDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.faq.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'FAQ_DELETED', resourceType: 'faq', resourceId: id });
  }

  // AC-8 — atomic counter increment, no per-user vote idempotency required.
  async feedback(id: string, vote: 'yes' | 'no') {
    await this.findOrThrow(id);
    await this.prisma.faq.update({
      where: { id: BigInt(id) },
      data: vote === 'yes' ? { helpfulYesCount: { increment: 1 } } : { helpfulNoCount: { increment: 1 } },
    });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.faq.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'FAQ not found');
    return row;
  }
}
