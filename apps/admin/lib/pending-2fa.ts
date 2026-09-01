export const PENDING_2FA_STORAGE_KEY = 'czd.admin.pending2fa';

export interface PendingTwoFactor {
  pendingTwoFactorToken: string;
  setupRequired: boolean;
}

export function readPendingTwoFactor(): PendingTwoFactor | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_2FA_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingTwoFactor;
  } catch {
    return null;
  }
}

export function clearPendingTwoFactor(): void {
  window.sessionStorage.removeItem(PENDING_2FA_STORAGE_KEY);
}
