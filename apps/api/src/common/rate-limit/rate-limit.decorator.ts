import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

// AC-4 / spec §9 rollout ("alert on abnormal login-failure rate per IP") — per-IP,
// per-route fixed-window limit, independent of the per-code attempt counter in
// VerificationCodeService (that one gates a specific 4-digit code; this gates route abuse).
export const RateLimit = (limit: number, windowSeconds: number) => SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitOptions);
