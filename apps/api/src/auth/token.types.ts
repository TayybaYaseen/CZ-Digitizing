import type { Role } from '@czd/shared-types';

// Access token (15 min) — CZ_DIGITIZING_ARCHITECTURE.md § Authentication & Security. Fixed by
// spec; no session_id here by design (see SessionService for why AC-7 is enforced elsewhere).
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  device_id: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// Refresh token (7 day).
export interface RefreshTokenPayload {
  sub: string;
  session_id: string;
  iat: number;
  exp: number;
}

// Signed, single-use magic-link token (AC-12) and the partial-session token issued after
// password/OAuth verification but before admin 2FA completes (AC-5) — neither carries the
// full access-token claim set, so they're kept out of AccessTokenPayload.
export interface MagicLinkTokenPayload {
  purpose: 'magic_link';
  sub: string;
  email: string; // lets the frontend prefill /verify-device without a second round trip
  device_id: string;
  jti: string; // single-use marker — consumed via Redis on first verification, see auth.service.ts
  iat: number;
  exp: number;
}

export interface PartialSessionTokenPayload {
  purpose: 'pending_2fa';
  sub: string;
  device_id: string;
  iat: number;
  exp: number;
}

// AC-1 — "email verification is required before the account is treated as trusted"; the spec
// doesn't specify the mechanism, so this reuses the same signed-link pattern as the magic link.
export interface EmailVerificationTokenPayload {
  purpose: 'verify_email';
  sub: string;
  iat: number;
  exp: number;
}
