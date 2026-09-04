import type { FaqDto } from '@czd/shared-types';
import type { Faq } from '../../generated/prisma';

export function toFaqDto(row: Faq): FaqDto {
  return {
    id: row.id.toString(),
    question: row.question,
    answer: row.answer,
    topic: row.topic,
    relatedPage: row.relatedPage,
    relatedService: row.relatedService,
    relatedCategory: row.relatedCategory,
    languageCode: row.languageCode,
    priority: row.priority,
    taeboVisible: row.taeboVisible,
    isPublished: row.isPublished,
    helpfulYesCount: row.helpfulYesCount,
    helpfulNoCount: row.helpfulNoCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
