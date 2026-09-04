import type { TipDto } from '@czd/shared-types';
import type { EmbroidererTip, TipFaqLink } from '../../generated/prisma';

type TipWithLinks = EmbroidererTip & { faqLinks: TipFaqLink[] };

export function toTipDto(row: TipWithLinks): TipDto {
  return {
    id: row.id.toString(),
    title: row.title,
    content: row.content,
    category: row.category,
    languageCode: row.languageCode,
    isPublished: row.isPublished,
    linkedFaqIds: row.faqLinks.map((l) => l.faqId.toString()),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
