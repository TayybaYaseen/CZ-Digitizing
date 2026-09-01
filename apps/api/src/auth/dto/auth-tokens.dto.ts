import type { UserProfileDto } from './user-profile.dto';

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileDto;
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
