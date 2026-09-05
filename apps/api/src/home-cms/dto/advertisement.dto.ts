import type { AdvertisementDto } from '@czd/shared-types';
import type { Advertisement, AdvertisementTargetDesign } from '../../generated/prisma';

type AdvertisementWithTargets = Advertisement & { targetDesigns: AdvertisementTargetDesign[] };

export function toAdvertisementDto(row: AdvertisementWithTargets): AdvertisementDto {
  return {
    id: row.id.toString(),
    heading: row.heading,
    subheading: row.subheading,
    offerText: row.offerText,
    bannerImageUrl: row.bannerImageUrl,
    bannerVideoUrl: row.bannerVideoUrl,
    ctaText: row.ctaText,
    ctaLink: row.ctaLink,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    targetCategoryId: row.targetCategoryId?.toString() ?? null,
    targetDesignIds: row.targetDesigns.map((t) => t.designId.toString()),
  };
}
