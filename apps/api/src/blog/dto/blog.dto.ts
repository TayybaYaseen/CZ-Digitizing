import type { BlogPostDto, BlogPostSummaryDto } from '@czd/shared-types';
import type { BlogPost } from '../../generated/prisma';

function toSummary(row: BlogPost): BlogPostSummaryDto {
  return {
    id: row.id.toString(),
    title: row.title,
    slug: row.slug,
    coverImageUrl: row.coverImageUrl,
    category: row.category,
    languageCode: row.languageCode,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBlogPostSummaryDto(row: BlogPost): BlogPostSummaryDto {
  return toSummary(row);
}

export function toBlogPostDto(row: BlogPost): BlogPostDto {
  return { ...toSummary(row), body: row.body };
}
