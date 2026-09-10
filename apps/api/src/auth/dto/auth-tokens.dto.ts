import type { UserProfileDto } from './user-profile.dto';

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileDto;
  // docs/specs/2026-08-29-18-mobile-app-android-ios.md (aspect A-023) — apps/web relies on the
  // httpOnly czd_device_id cookie the browser sends/stores automatically; apps/mobile has no
  // cookie jar, so it needs the device id explicitly in the body to persist (SecureStore) and
  // resend as the x-device-id header on future requests, preserving the same device-trust flow.
  deviceId: string;
}

// Returned instead of AuthTokensDto when role=admin needs TOTP verification (AC-5) — never a
// full session. `setupRequired` tells the client whether to call /2fa/setup or go straight to
// /2fa/confirm (or /verify-2fa for an already-enrolled admin).
export interface PendingTwoFactorDto {
  pendingTwoFactorToken: string;
  setupRequired: boolean;
}

export interface TwoFactorSetupDto {
  otpauthUrl: string;
  secret: string;
}
