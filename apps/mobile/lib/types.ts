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

// Mirrors apps/api/src/services/dto/service.dto.ts's ServiceSummaryDto/ServiceDetailDto.
export interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  parentServiceId: string | null;
  description: string;
  visualImageUrl: string;
  sortOrder: number;
  isPublished: boolean;
}
export interface MainServiceDto extends ServiceSummaryDto {
  subServices: ServiceSummaryDto[];
}
export interface ServiceDetailDto extends ServiceSummaryDto {
  applications: string;
  process: string;
  relatedFaqIds: string[];
  relatedDesignCategoryId: string | null;
  subServices?: ServiceSummaryDto[];
}

// Mirrors apps/api/src/bundles/dto/bundle.dto.ts.
export interface BundleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
}
export interface BundleDetailDto extends BundleSummaryDto {
  includedDesigns: { id: string; name: string; previewImageUrl: string; pricePkr: number; priceOverridePkr: number | null }[];
}

// Mirrors apps/api/src/subscriptions/dto/subscription-plan.dto.ts.
export interface SubscriptionPlanDto {
  id: string;
  name: string;
  billingPeriod: 'monthly' | 'yearly';
  pricePkr: number;
  monthlyCredits: number;
  logoLimit: number | null;
  perks: string[];
  isBestValue: boolean;
  isPublished: boolean;
}

// Mirrors apps/api/src/credits/dto/credit-package.dto.ts.
export interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  pricePkr: number;
  isPublished: boolean;
}

// Mirrors apps/api/src/account/account.controller.ts's account-members shape.
export interface AccountMemberDto {
  id: string;
  email: string;
  displayName: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

// Mirrors apps/api/src/activity/activity.controller.ts's ActivityEventDto.
export interface ActivityEventDto {
  id: string;
  eventType: 'VIEWED' | 'ADDED_TO_CART' | 'REMOVED_FROM_CART' | 'PURCHASED' | 'PAID' | 'DOWNLOADED';
  designId?: string;
  orderId?: string;
  createdAt: string;
}
