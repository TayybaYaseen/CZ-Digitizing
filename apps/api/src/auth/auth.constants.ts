// docs/specs/2026-08-28-01-auth-account-security.md — TTLs, cookie name, rate-limit windows.

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min — AC-2/AC-3, JWT structure
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 day
export const SESSION_INACTIVITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 day — AC-7

// New-device verification code (AC-3/AC-4). Validity window not stated in spec/architecture;
// defaulting to 15 min to match the AC-4 rate-limit window.
export const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
export const DEVICE_CODE_MAX_ATTEMPTS = 3;
export const DEVICE_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// Forgot-password code — spec §2 AC-6 states these explicitly.
export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 3;
export const RESET_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// Magic-link login token (AC-12) — no window stated; 15 min matches the device-code window.
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

// Partial-session token issued after password/OAuth check, before mandatory admin 2FA (AC-5).
export const PENDING_2FA_TTL_SECONDS = 5 * 60;

// Email verification link (AC-1) — no window stated in spec/architecture; 24h is a common default.
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;

// Device-trust cookie (spec §8 risk #2 — fingerprinting method chosen here).
export const DEVICE_ID_COOKIE = 'czd_device_id';
export const DEVICE_ID_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months
