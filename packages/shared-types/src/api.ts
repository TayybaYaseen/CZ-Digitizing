// Mirrors docs/specs/2026-08-28-cz-digitizing-platform.md §3 API contract.
// Single source of truth shared by apps/api, apps/web, apps/admin.

export interface ApiResponse<T> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  errors?: { field: string; message: string }[];
  traceId: string;
}

// Global codes (master spec §3) + feature-specific codes, added here before first use.
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'FILE_FORMAT_BLOCKED'
  | 'PAYMENT_NOT_CONFIRMED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'RATE_LIMITED'
  // Fallback for uncaught/unexpected errors — never a designed API behavior, but every envelope
  // needs a code (added 2026-08-31, apps/api/src/common/filters/all-exceptions.filter.ts)
  | 'INTERNAL_ERROR'
  // Auth spec (docs/specs/2026-08-28-01-auth-account-security.md §3)
  | 'NEW_DEVICE_VERIFICATION_REQUIRED'
  | 'INVALID_OR_EXPIRED_CODE'
  | 'EMAIL_ALREADY_REGISTERED'
  // Notifications spec (docs/specs/2026-08-28-02-notifications-system.md §3)
  | 'NOTIFICATION_NOT_FOUND'
  // Shopping Cart & Checkout spec (docs/specs/2026-08-28-07-shopping-cart-checkout.md §3)
  | 'ITEM_NOT_PUBLISHED'
  | 'SIZE_REQUIRED'
  | 'INSUFFICIENT_CREDITS'
  // Checkout's real pre-validation passes (item published, size selected) before failing at the
  // one step Orders & Payment Processing (A-013, still Blocked) owns — never a fabricated success.
  | 'ORDERS_NOT_AVAILABLE'
  // Orders & Payment Processing spec (docs/specs/2026-08-28-08-orders-payment-processing.md §3)
  | 'INVALID_WEBHOOK_SIGNATURE'
  | 'ORDER_ALREADY_CONFIRMED'
  | 'RECEIPT_REQUIRED'
  | 'INVALID_ORDER_TRANSITION'
  // Subscriptions & Credits spec (docs/specs/2026-08-28-09-subscriptions-credits.md §3)
  | 'ALREADY_SUBSCRIBED'
  | 'RENEWAL_PAYMENT_FAILED'
  // Subscription logo/design-file download allowance (plan.logoLimit) exhausted for this cycle.
  | 'SUBSCRIPTION_LOGO_LIMIT_REACHED'
  // Content & Knowledge Base spec (docs/specs/2026-08-28-10-content-knowledge-base.md §3)
  | 'SLUG_ALREADY_EXISTS'
  | 'ORDER_NOT_ELIGIBLE_FOR_REVIEW'
  // Home Promotions CMS spec (docs/specs/2026-08-28-13-home-promotions-cms.md §3, §8 risk #2)
  | 'ADVERTISEMENT_TARGET_CONFLICT';
