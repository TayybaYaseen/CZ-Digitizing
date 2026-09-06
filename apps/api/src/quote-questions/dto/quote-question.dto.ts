import type { QuoteQuestionDto } from '@czd/shared-types';
import type { QuoteQuestion } from '../../generated/prisma';

export function toQuoteQuestionDto(row: QuoteQuestion): QuoteQuestionDto {
  return {
    id: row.id.toString(),
    question: row.question,
    answer: row.answer,
    serviceId: row.serviceId.toString(),
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
