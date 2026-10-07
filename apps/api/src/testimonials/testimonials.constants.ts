// docs/specs/2026-10-06-22-customer-review-submission.md §18/§19 (aspect A-026). Mirrors
// REVIEW_LIMITS in @czd/shared-types (the web/admin forms import that one); the API keeps its own
// copy because it does not load runtime values from the shared-types package.
export const REVIEW_DISPLAY_NAME_MIN = 2;
export const REVIEW_DISPLAY_NAME_MAX = 80;
export const REVIEW_COUNTRY_MAX = 80;
export const REVIEW_SERVICE_USED_MIN = 2;
export const REVIEW_SERVICE_USED_MAX = 120;
export const REVIEW_FEEDBACK_MIN = 20;
export const REVIEW_FEEDBACK_MAX = 2000;

export const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
// §8 — decompression-bomb guard, and the longest side after processing.
export const REVIEW_IMAGE_MAX_INPUT_PIXELS = 40_000_000;
export const REVIEW_IMAGE_MAX_DIMENSION = 2000;
export const REVIEW_IMAGE_WEBP_QUALITY = 82;
export const REVIEW_IMAGE_NAMESPACE = 'review-images';

// §18 — anti-spam limits, deliberately loose.
export const MAX_PENDING_REVIEWS_PER_CUSTOMER = 3;
export const DUPLICATE_REVIEW_WINDOW_HOURS = 24;

// Home page shows at most 6 (A-012c AC-4).
export const MAX_HOME_COUNT = 6;

// §14 — public image responses may sit in browser caches this long after a Hide.
export const PUBLIC_IMAGE_MAX_AGE_SECONDS = 300;
