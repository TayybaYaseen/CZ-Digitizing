import type { Cart, CartItem, Design, DesignBundle, DesignCategory, DesignCategoryAssignment, DesignSize, DesignSubcategory } from '../../generated/prisma';

type DesignWithTaxonomy = Design & {
  subcategory: DesignSubcategory | null;
  categoryAssignments: (DesignCategoryAssignment & { category: DesignCategory })[];
};

export type CartItemWithRelations = CartItem & {
  design: DesignWithTaxonomy | null;
  bundle: DesignBundle | null;
  size: DesignSize | null;
};

export type CartWithItems = Cart & { items: CartItemWithRelations[] };

// spec §3 CartItemDto, extended per AC-2's "each line shows preview image, name,
// category/subcategory, selected size, quantity, unit price, and line discount" — the spec's own
// DTO snippet is a minimal sketch, not exhaustive (its own §5/AC-2 requires more fields than it
// lists), same posture as every other DTO in this repo that fleshes out a spec sketch.
export interface CartItemDto {
  id: string;
  designId: string | null;
  bundleId: string | null;
  name: string;
  previewImageUrl: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  quantity: number;
  unitPricePkr: number;
  linePriceAtSelectionPkr: number;
  lineDiscountPkr: number;
  status: 'active' | 'saved_for_later';
  isPublished: boolean;
}

export interface CartDto {
  items: CartItemDto[];
  savedForLater: CartItemDto[];
  subtotalPkr: number;
  discountPkr: number;
  creditsUsed: number;
  totalPkr: number;
}

// Live unit price — always recomputed from the current Design/Bundle row, never trusted from
// CartItem.priceAtAddPkr (that field only feeds linePriceAtSelectionPkr, an audit value).
export function liveUnitPricePkr(item: CartItemWithRelations, bundleTotalPkr?: number): number {
  if (item.design) return Number(item.design.salePricePkr ?? item.design.pricePkr);
  if (bundleTotalPkr !== undefined) return bundleTotalPkr;
  return Number(item.bundle!.salePricePkr ?? item.bundle!.pricePkr);
}

function toItemDto(item: CartItemWithRelations, bundleTotalPkr?: number): CartItemDto {
  const unitPricePkr = liveUnitPricePkr(item, bundleTotalPkr);
  const fullPricePkr = item.design ? Number(item.design.pricePkr) : Number(item.bundle!.pricePkr);
  const lineDiscountPkr = Math.max(0, fullPricePkr - unitPricePkr) * item.quantity;

  return {
    id: item.id.toString(),
    designId: item.designId?.toString() ?? null,
    bundleId: item.bundleId?.toString() ?? null,
    name: item.design?.name ?? item.bundle!.name,
    previewImageUrl: item.design?.previewImageUrl ?? item.bundle?.previewImageUrl ?? null,
    categoryName: item.design?.categoryAssignments[0]?.category.name ?? null,
    subcategoryName: item.design?.subcategory?.name ?? null,
    sizeId: item.sizeId?.toString() ?? null,
    sizeLabel: item.size?.sizeLabel ?? null,
    quantity: item.quantity,
    unitPricePkr,
    linePriceAtSelectionPkr: Number(item.priceAtAddPkr),
    lineDiscountPkr,
    status: item.status,
    isPublished: item.design?.isPublished ?? item.bundle?.isPublished ?? false,
  };
}

export function toCartItemDto(item: CartItemWithRelations, bundleTotalPkr?: number): CartItemDto {
  return toItemDto(item, bundleTotalPkr);
}

// AC-3/AC-8 — subtotal/discount/total only ever reflect active lines; saved-for-later items are
// listed separately and never contribute to the cart total (spec AC-8: "removed from the active
// cart total"). subtotalPkr is pre-discount (unitPricePkr*quantity + lineDiscountPkr, i.e. the
// full undiscounted line total); discountPkr is the sum of per-line sale-price reductions; total =
// subtotal - discount - credits. creditsUsed is always 0 today — TODO(A-015), see
// CartService.applyCredits().
export function toCartDto(itemDtos: CartItemDto[]): CartDto {
  const active = itemDtos.filter((i) => i.status === 'active');
  const savedForLater = itemDtos.filter((i) => i.status === 'saved_for_later');
  const discountPkr = active.reduce((sum, i) => sum + i.lineDiscountPkr, 0);
  const subtotalPkr = active.reduce((sum, i) => sum + i.unitPricePkr * i.quantity, 0) + discountPkr;
  const creditsUsed = 0;
  return { items: active, savedForLater, subtotalPkr, discountPkr, creditsUsed, totalPkr: subtotalPkr - discountPkr - creditsUsed };
}
