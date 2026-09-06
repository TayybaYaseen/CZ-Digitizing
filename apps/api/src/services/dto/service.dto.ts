import type { ServiceDetailDto, ServiceSummaryDto } from '@czd/shared-types';
import type { Service } from '../../generated/prisma';

export function toServiceSummaryDto(row: Service): ServiceSummaryDto {
  return {
    id: row.id.toString(),
    name: row.name,
    slug: row.slug,
    type: row.type,
    parentServiceId: row.parentServiceId ? row.parentServiceId.toString() : null,
    description: row.description,
    visualImageUrl: row.visualImageUrl,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
  };
}

export function toServiceDetailDto(row: Service, relatedFaqIds: string[], subServices?: Service[]): ServiceDetailDto {
  return {
    ...toServiceSummaryDto(row),
    applications: row.applications,
    process: row.process,
    relatedFaqIds,
    relatedDesignCategoryId: row.relatedDesignCategoryId ? row.relatedDesignCategoryId.toString() : null,
    subServices: subServices?.map(toServiceSummaryDto),
  };
}
