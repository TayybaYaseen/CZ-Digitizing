import type { PortfolioItemDto } from '@czd/shared-types';
import type { PortfolioItem } from '../../generated/prisma';

export function toPortfolioItemDto(row: PortfolioItem): PortfolioItemDto {
  return {
    id: row.id.toString(),
    title: row.title,
    description: row.description,
    mediaUrls: row.mediaUrls as string[],
    category: row.category,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
  };
}
