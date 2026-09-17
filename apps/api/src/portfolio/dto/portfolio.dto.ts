import type { PortfolioItemDto } from '@czd/shared-types';
import type { PortfolioItem } from '../../generated/prisma';

// docs/portfolio-spec.md §15 — projectNotes is admin-only/internal, never customer-facing.
// includeInternal (true only for staff — see portfolio.service.ts's callers, mirroring the same
// publishedOnlyFor(req) staff check already used to decide unpublished-item visibility) controls
// whether it's included at all, so the public GET /api/portfolio[/:id] response never carries it
// regardless of what the frontend happens to render.
export function toPortfolioItemDto(row: PortfolioItem, includeInternal: boolean): PortfolioItemDto {
  return {
    id: row.id.toString(),
    title: row.title,
    description: row.description,
    mediaUrls: row.mediaUrls as string[],
    category: row.category,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    isFeatured: row.isFeatured,
    originalArtworkUrl: row.originalArtworkUrl,
    embroideryResultUrl: row.embroideryResultUrl,
    closeUpImageUrl: row.closeUpImageUrl,
    beforeImageUrl: row.beforeImageUrl,
    afterImageUrl: row.afterImageUrl,
    softwareUsed: row.softwareUsed,
    embroideryType: row.embroideryType,
    stitchCount: row.stitchCount,
    sizeLabel: row.sizeLabel,
    machineFormat: row.machineFormat,
    projectNotes: includeInternal ? row.projectNotes : null,
    mediaAltTexts: row.mediaAltTexts as Record<string, string>,
  };
}
