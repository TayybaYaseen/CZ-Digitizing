import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { QuoteQuestionQueryDto } from './dto/quote-question-query.dto';
import { toQuoteQuestionDto } from './dto/quote-question.dto';
import type { CreateQuoteQuestionDto, UpdateQuoteQuestionDto } from './dto/quote-question-write.dto';

// docs/specs/2026-08-28-11-smart-get-a-quote.md §3/§4 (aspect A-016, AC-1/AC-5).
@Injectable()
export class QuoteQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-1 — Step 2's question list, scoped to the selected service. AC-2's invariant (no
  // notification, no quotes row) holds trivially here: this is a pure read.
  async list(query: QuoteQuestionQueryDto, includeUnpublished = false) {
    const where: Record<string, unknown> = { ...(includeUnpublished ? {} : { isPublished: true }) };
    if (query.serviceId) where.serviceId = BigInt(query.serviceId);

    const rows = await this.prisma.quoteQuestion.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toQuoteQuestionDto);
  }

  async create(dto: CreateQuoteQuestionDto, admin: AccessTokenPayload) {
    const row = await this.prisma.quoteQuestion.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        serviceId: BigInt(dto.serviceId),
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'QUOTE_QUESTION_CREATED', resourceType: 'quote_question', resourceId: row.id.toString() });
    return toQuoteQuestionDto(row);
  }

  async update(id: string, dto: UpdateQuoteQuestionDto, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    const row = await this.prisma.quoteQuestion.update({
      where: { id: BigInt(id) },
      data: {
        question: dto.question,
        answer: dto.answer,
        serviceId: dto.serviceId ? BigInt(dto.serviceId) : undefined,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'QUOTE_QUESTION_UPDATED', resourceType: 'quote_question', resourceId: id, changes: dto as Record<string, unknown> });
    return toQuoteQuestionDto(row);
  }

  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.quoteQuestion.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'QUOTE_QUESTION_DELETED', resourceType: 'quote_question', resourceId: id });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.quoteQuestion.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Quote question not found');
    return row;
  }
}
