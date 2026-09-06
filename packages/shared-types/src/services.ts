// Mirrors docs/specs/2026-08-29-17-services-module.md §3/§4 (aspect A-014, A-014a, A-014b).
// Shared between apps/api, apps/web, apps/admin.

export type ServiceMainType = 'embroidery_digitizing' | 'vector_art';

export interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: ServiceMainType;
  parentServiceId: string | null;
  description: string;
  visualImageUrl: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface ServiceDetailDto extends ServiceSummaryDto {
  applications: string;
  process: string;
  relatedFaqIds: string[];
  relatedDesignCategoryId: string | null;
  subServices?: ServiceSummaryDto[];
}
