import type { Design, DesignCategoryAssignment, DesignSize, DesignSubcategory, Favorite } from '../../generated/prisma';

type DesignWithRelations = Design & {
  subcategory: DesignSubcategory | null;
  categoryAssignments: DesignCategoryAssignment[];
  sizes?: DesignSize[];
  favorites?: Favorite[];
};

// AC-3 — front-of-card public fields only. Never file_format/storage_path/file_url/is_private
// (spec §3 DTO note) — this DTO has no field capable of carrying them in the first place.
export interface DesignSummaryDto {
  id: string;
  name: string;
  previewImageUrl: string;
  categoryIds: string[];
  subcategoryId: string | null;
  tags: string[];
  pricePkr: number;
  salePricePkr: number | null;
  discountBadge: string | null;
  isFavorited: boolean;
  vectorImageUrl: string | null;
  vectorVideoUrl: string | null;
  embroideryImageUrl: string | null;
  embroideryVideoUrl: string | null;
  autoSwapEnabled: boolean;
  isPublished: boolean;
}

// AC-4 — back-of-card + detail-page fields.
export interface DesignDetailDto extends DesignSummaryDto {
  description: string | null;
  galleryImageUrls: string[];
  sizes: { id: string; label: string; widthMm: number; heightMm: number }[];
  stitchCount: number | null;
  threadColorCount: number | null;
  threadColorChanges: number | null;
}

function toSummary(design: DesignWithRelations, favoritedByCustomerId?: bigint): DesignSummaryDto {
  return {
    id: design.id.toString(),
    name: design.name,
    previewImageUrl: design.previewImageUrl,
    categoryIds: design.categoryAssignments.map((a) => a.categoryId.toString()),
    subcategoryId: design.subcategoryId?.toString() ?? null,
    tags: design.tags,
    pricePkr: Number(design.pricePkr),
    salePricePkr: design.salePricePkr !== null ? Number(design.salePricePkr) : null,
    discountBadge: design.discountBadge,
    isFavorited: favoritedByCustomerId !== undefined ? !!design.favorites?.some((f) => f.customerId === favoritedByCustomerId) : false,
    vectorImageUrl: design.vectorImageUrl,
    vectorVideoUrl: design.vectorVideoUrl,
    embroideryImageUrl: design.embroideryImageUrl,
    embroideryVideoUrl: design.embroideryVideoUrl,
    autoSwapEnabled: design.autoSwapEnabled,
    isPublished: design.isPublished,
  };
}

export function toDesignSummaryDto(design: DesignWithRelations, favoritedByCustomerId?: bigint): DesignSummaryDto {
  return toSummary(design, favoritedByCustomerId);
}

export function toDesignDetailDto(design: DesignWithRelations, favoritedByCustomerId?: bigint): DesignDetailDto {
  return {
    ...toSummary(design, favoritedByCustomerId),
    description: design.description,
    galleryImageUrls: design.galleryImageUrls,
    sizes: (design.sizes ?? [])
      .sort((a, b) => a.sizeOrder - b.sizeOrder)
      .map((s) => ({ id: s.id.toString(), label: s.sizeLabel, widthMm: Number(s.sizeWidthMm), heightMm: Number(s.sizeHeightMm) })),
    stitchCount: design.stitchCount,
    threadColorCount: design.threadColorCount,
    threadColorChanges: design.threadColorChanges,
  };
}
