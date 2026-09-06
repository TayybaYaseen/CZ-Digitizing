// Mirrors docs/specs/2026-08-28-13-home-promotions-cms.md §3/§4 (aspect A-018, A-018a-c).
// Shared between apps/api, apps/web, apps/admin.

// Field-for-field identical to apps/web/components/DesignCard.tsx's local DesignSummaryDto (which
// isn't itself in shared-types) — a structurally compatible shape is all a Home Section's designs
// list needs to pass straight into <DesignCard design={...} />.
export interface HomeSectionDesignDto {
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

export interface HomeSectionDto {
  id: string;
  heading: string;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
  designs: HomeSectionDesignDto[];
}

// AC-3/AC-4/AC-5 — GET /api/home/advertisement returns null when nothing is active.
export interface AdvertisementDto {
  id: string;
  heading: string;
  subheading: string | null;
  offerText: string | null;
  bannerImageUrl: string | null;
  bannerVideoUrl: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  startDate: string;
  endDate: string;
  targetCategoryId: string | null;
  targetDesignIds: string[];
}

// AC-6/AC-10/AC-11.
export interface HeaderMediaDto {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  heading: string | null;
  subheading: string | null;
  ctaLink: string | null;
  priority: number;
  isCarouselItem: boolean;
  autoSlideDurationSeconds: number;
}
