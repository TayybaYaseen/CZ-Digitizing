import type { ApiError, ApiErrorCode } from '@czd/shared-types';

// docs/specs/2026-08-28-16-internationalization.md AC-1/AC-3 — the API speaks English only (its
// messages are also what Admin, logs and support see), so the customer site never shows an API
// `message` verbatim when it can map it to a translation instead. Resolution order:
//   1. a client-built error whose `message` is itself a translation key (see clientError below);
//   2. an exact, known API message → its specific translation;
//   3. a stable error `code` → a translated, code-level message;
//   4. otherwise the API's own text (rare, unmapped admin-facing wording) rather than nothing.

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Has = (key: string) => boolean;

// Frontend-originated failures (network down, unexpected exception). Stores the key, not English,
// so ErrorBanner renders it in whatever language is active at render time — including after a
// later language switch.
export function clientError(key: string, code: ApiErrorCode = 'INTERNAL_ERROR'): ApiError {
  return { code, message: key, traceId: '' };
}

const MESSAGE_KEYS: Record<string, string> = {
  'Invalid email or password': 'apiErrors.invalidCredentials',
  'Email is already registered': 'apiErrors.emailAlreadyRegistered',
  'Invalid or expired code': 'apiErrors.invalidOrExpiredCode',
  'Invalid or expired magic link': 'apiErrors.invalidMagicLink',
  'This login link has already been used': 'apiErrors.magicLinkUsed',
  'Invalid or expired verification link': 'apiErrors.invalidVerificationLink',
  'Too many attempts — request a new code': 'apiErrors.tooManyCodeAttempts',
  'Too many requests — try again later': 'apiErrors.rateLimited',
  'Verification code sent to your email': 'apiErrors.verificationCodeSent',
  'Session expired or revoked': 'apiErrors.sessionExpired',
  'Invalid or expired token': 'apiErrors.sessionExpired',
  'Missing access token': 'apiErrors.sessionExpired',
  'User not found': 'apiErrors.sessionExpired',
  'Cart is empty': 'apiErrors.cartEmpty',
  'Cart not found': 'apiErrors.cartNotFound',
  'Cart item not found': 'apiErrors.cartItemNotFound',
  'Your cart changed (or was already checked out) — please review your cart and try again.': 'apiErrors.cartChanged',
  'A size must be selected for this design': 'apiErrors.sizeRequired',
  'Size not found for this design': 'apiErrors.sizeNotFound',
  'This design is no longer available': 'apiErrors.designUnavailable',
  'This bundle is no longer available': 'apiErrors.bundleUnavailable',
  'Design not found': 'apiErrors.designNotFound',
  'Bundle not found': 'apiErrors.bundleNotFound',
  'Category not found': 'apiErrors.categoryNotFound',
  'Subcategory not found': 'apiErrors.subcategoryNotFound',
  'Service not found': 'apiErrors.serviceNotFound',
  'Order not found': 'apiErrors.orderNotFound',
  'Quote not found': 'apiErrors.quoteNotFound',
  'Custom request not found': 'apiErrors.customRequestNotFound',
  'Blog post not found': 'apiErrors.blogPostNotFound',
  'Tip not found': 'apiErrors.tipNotFound',
  'FAQ not found': 'apiErrors.faqNotFound',
  'Portfolio item not found': 'apiErrors.portfolioItemNotFound',
  'Notification not found': 'apiErrors.notificationNotFound',
  'File not found': 'apiErrors.fileNotFound',
  'File not found or not authorized for this order': 'apiErrors.fileNotFound',
  'File not found for this request': 'apiErrors.fileNotFound',
  'Files are available only once this order has been paid in full and the payment confirmed': 'apiErrors.filesLockedUntilPaid',
  'Files are available only once the order has been paid in full and the payment confirmed': 'apiErrors.filesLockedUntilPaid',
  'Files for this request have not been delivered yet': 'apiErrors.filesNotDelivered',
  'Payment for this custom request has not been confirmed': 'apiErrors.customRequestPaymentPending',
  'Download-attempt limit reached for this file': 'apiErrors.downloadLimitReached',
  'A receipt file is required': 'apiErrors.receiptRequired',
  'A receipt for this order is already awaiting review': 'apiErrors.receiptAlreadyPending',
  'Receipts must be a JPEG, PNG or WebP image, or a PDF': 'apiErrors.receiptUnsupportedType',
  'This receipt is not a supported image or PDF and will not be served': 'apiErrors.receiptUnsupportedType',
  'Image exceeds the 10MB limit': 'apiErrors.imageTooLarge',
  'A file is required': 'apiErrors.fileRequired',
  'This order does not use bank transfer': 'apiErrors.notBankTransfer',
  'Nothing is outstanding on this order — there is no amount left to confirm': 'apiErrors.nothingOutstanding',
  'Only completed orders can be reviewed': 'apiErrors.orderNotReviewable',
  'This quote has no quoted price': 'apiErrors.quoteNoPrice',
  'This custom request has no quoted price': 'apiErrors.customRequestNoPrice',
  'Only a request with a sent quote can be approved': 'apiErrors.customRequestNotQuoted',
  'You do not have access to this quote': 'apiErrors.forbidden',
  'You do not have access to this custom request': 'apiErrors.forbidden',
  'You do not have permission to perform this action': 'apiErrors.forbidden',
  'An active subscription already exists': 'apiErrors.alreadySubscribed',
  'No active subscription found': 'apiErrors.noActiveSubscription',
  'No subscription found': 'apiErrors.noSubscription',
  'Subscription plan not found': 'apiErrors.planNotFound',
  'This subscription plan has no price': 'apiErrors.planNoPrice',
  'Credit package not found': 'apiErrors.creditPackageNotFound',
  'This credit package has no price': 'apiErrors.creditPackageNoPrice',
  'Cannot gift credits to yourself': 'apiErrors.cannotGiftSelf',
  'Recipient not found': 'apiErrors.recipientNotFound',
  'Cannot invite your own account': 'apiErrors.cannotInviteSelf',
  'No registered customer account found for that email — they must register first': 'apiErrors.memberNotRegistered',
  'That account is already a member of another shared account': 'apiErrors.memberElsewhere',
  'Membership not found': 'apiErrors.membershipNotFound',
  'This request has already been fulfilled': 'apiErrors.fileFormatAlreadyFulfilled',
  'OAuth code exchange failed': 'apiErrors.oauthFailed',
  'OAuth account email is not verified': 'apiErrors.oauthEmailUnverified',
  'Facebook account has no verified email': 'apiErrors.oauthEmailUnverified',
  'Internal server error': 'apiErrors.generic',
};

// Code-level fallback for API messages not listed above. Deliberately excludes VALIDATION_ERROR
// (field errors render inline via FormField) and INTERNAL_ERROR is mapped to the generic message.
const CODE_KEYS: Record<string, string> = {
  UNAUTHENTICATED: 'apiErrors.sessionExpired',
  FORBIDDEN: 'apiErrors.forbidden',
  RESOURCE_NOT_FOUND: 'apiErrors.notFound',
  RATE_LIMITED: 'apiErrors.rateLimited',
  INVALID_OR_EXPIRED_CODE: 'apiErrors.invalidOrExpiredCode',
  EMAIL_ALREADY_REGISTERED: 'apiErrors.emailAlreadyRegistered',
  NEW_DEVICE_VERIFICATION_REQUIRED: 'apiErrors.verificationCodeSent',
  CART_CHANGED: 'apiErrors.cartChanged',
  SIZE_REQUIRED: 'apiErrors.sizeRequired',
  ITEM_NOT_PUBLISHED: 'apiErrors.itemUnavailable',
  PAYMENT_NOT_CONFIRMED: 'apiErrors.filesLockedUntilPaid',
  RECEIPT_REQUIRED: 'apiErrors.receiptRequired',
  RECEIPT_ALREADY_PENDING: 'apiErrors.receiptAlreadyPending',
  UNSUPPORTED_FILE_TYPE: 'apiErrors.unsupportedFileType',
  FILE_TOO_LARGE: 'apiErrors.fileTooLarge',
  ALREADY_SUBSCRIBED: 'apiErrors.alreadySubscribed',
  SUBSCRIPTION_LOGO_LIMIT_REACHED: 'apiErrors.logoLimitReached',
  ORDER_NOT_ELIGIBLE_FOR_REVIEW: 'apiErrors.orderNotReviewable',
  CUSTOM_REQUEST_NOT_QUOTED: 'apiErrors.customRequestNotQuoted',
  FILE_FORMAT_REQUEST_ALREADY_FULFILLED: 'apiErrors.fileFormatAlreadyFulfilled',
  GUEST_CHECKOUT_SIGN_IN_REQUIRED: 'apiErrors.guestCheckoutSignInRequired',
  GUEST_CHECKOUT_SIGNED_IN: 'apiErrors.guestCheckoutSignedIn',
  CONFLICT: 'apiErrors.conflict',
  INTERNAL_ERROR: 'apiErrors.generic',
  SERVICE_UNAVAILABLE: 'apiErrors.generic',
};

export function translateApiError(error: ApiError, t: Translate, has: Has): string {
  if (has(error.message)) return t(error.message);
  const byMessage = MESSAGE_KEYS[error.message];
  if (byMessage) return t(byMessage);
  const byCode = CODE_KEYS[error.code];
  if (byCode) return t(byCode);
  return error.message;
}

// class-validator's default English field messages ("email must be an email", "password must be
// longer than or equal to 8 characters", ...) plus the zod schemas' own messages, which are written
// as translation keys (e.g. 'validation.email') so they translate here too.
const FIELD_PATTERNS: [RegExp, string][] = [
  [/must be an email$/, 'validation.email'],
  [/should not be empty$|is required$/, 'validation.required'],
  [/must be longer than or equal to (\d+) characters$/, 'validation.minLength'],
  [/must be at least (\d+) characters$/, 'validation.minLength'],
  [/must be shorter than or equal to (\d+) characters$/, 'validation.maxLength'],
  [/must be a URL address$/, 'validation.url'],
  [/must be a number|must be an integer/, 'validation.number'],
  [/must not be less than (\d+)$/, 'validation.min'],
  [/must not be greater than (\d+)$/, 'validation.max'],
];

export function translateFieldMessage(message: string | undefined, t: Translate, has: Has): string {
  if (!message) return '';
  if (has(message)) return t(message);
  for (const [pattern, key] of FIELD_PATTERNS) {
    const match = message.match(pattern);
    if (match) return t(key, match[1] ? { n: Number(match[1]) } : undefined);
  }
  return message;
}
