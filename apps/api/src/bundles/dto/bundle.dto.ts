import type { BundleDesign, Design, DesignBundle } from '../../generated/prisma';

type BundleDesignWithDesign = BundleDesign & { design: Design };
type BundleWithDesigns = DesignBundle & { designs: BundleDesignWithDesign[] };

// spec §3 DTO — front-of-card fields, same visual system as DesignSummaryDto (AC-1).
export interface BundleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
}

// spec §3 — BundleDetailDto, includes included-design summaries.
export interface BundleDetailDto extends BundleSummaryDto {
  includedDesigns: { id: string; name: string; previewImageUrl: string; pricePkr: number; priceOverridePkr: number | null }[];
}

function toSummary(bundle: DesignBundle): BundleSummaryDto {
  return {
    id: bundle.id.toString(),
    name: bundle.name,
    description: bundle.description,
    previewImageUrl: bundle.previewImageUrl,
    pricePkr: Number(bundle.pricePkr),
    salePricePkr: bundle.salePricePkr !== null ? Number(bundle.salePricePkr) : null,
    isPublished: bundle.isPublished,
  };
}

export function toBundleSummaryDto(bundle: DesignBundle): BundleSummaryDto {
  return toSummary(bundle);
}

export function toBundleDetailDto(bundle: BundleWithDesigns): BundleDetailDto {
  return {
    ...toSummary(bundle),
    includedDesigns: bundle.designs
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((bd) => ({
        id: bd.design.id.toString(),
        name: bd.design.name,
        previewImageUrl: bd.design.previewImageUrl,
        pricePkr: Number(bd.design.pricePkr),
        priceOverridePkr: bd.priceOverridePkr !== null ? Number(bd.priceOverridePkr) : null,
      })),
  };
}
