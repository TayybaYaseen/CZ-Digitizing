// Local DTO mirrors, same convention as apps/web (each app defines its own local shape rather
// than importing apps/api internals — see apps/web/components/DesignCard.tsx's own doc comment).

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
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  subcategories: { id: string; name: string; slug: string }[];
}

export interface CartItemDto {
  id: string;
  designId: string | null;
  bundleId: string | null;
  name: string;
  previewImageUrl: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  quantity: number;
  unitPricePkr: number;
  linePriceAtSelectionPkr: number;
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

export interface OrderSummaryDto {
  id: string;
  status: string;
  totalPkr: number;
  createdAt: string;
  itemCount: number;
}

export interface PurchasedDesignDto {
  designId: string;
  name: string;
  previewImageUrl: string;
  purchasedAt: string;
}

export interface CreditTransactionDto {
  id: string;
  amountPkr: number;
  type: string;
  createdAt: string;
}

export interface CustomerSubscriptionDto {
  id: string | null;
  planName: string | null;
  status: string | null;
  renewsAt: string | null;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}
