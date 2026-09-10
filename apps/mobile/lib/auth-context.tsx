import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@czd/shared-types';
import { apiFetch, AUTH_KEY, clearStoredAuth, readStoredAuth, setDeviceId } from './api-client';
import { setItem } from './storage';

// Port of apps/web/lib/auth-context.tsx — same shape/contract, ./storage-backed instead of
// localStorage directly (native: expo-secure-store; web: localStorage — see storage.ts).
// Mirrors apps/api/src/auth/dto/user-profile.dto.ts's UserProfileDto.
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  gmailVerified: boolean;
  twoFactorEnabled: boolean;
  preferredLocale: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  // Returned by login/register so this device's future requests can identify themselves — see
  // api-client.ts's doc comment for why apps/mobile needs this explicitly (no cookie jar in RN).
  deviceId?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue extends AuthState {
  isReady: boolean;
  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
}

const EMPTY_STATE: AuthState = { user: null, accessToken: null, refreshToken: null };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);

  // Restore from SecureStore on launch, then confirm the restored session is still valid (AC-2 —
  // "session persists until logout/expiry"). apiFetch's own fetchWithAuthRetry already implements
  // the "expired access token but valid refresh token -> one silent refresh" flow.
  useEffect(() => {
    (async () => {
      const stored = await readStoredAuth();
      if (stored) setState(stored as AuthState);
      setIsReady(true);
      if (stored?.accessToken) void verifySession(stored.accessToken);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifySession(accessToken: string) {
    try {
      const profile = await apiFetch<AuthUser>('/api/auth/verify-session', { headers: { Authorization: `Bearer ${accessToken}` } });
      const latest = await readStoredAuth(); // fetchWithAuthRetry may have silently written a refreshed access token
      const next: AuthState = { user: profile, accessToken: (latest as AuthState | null)?.accessToken ?? accessToken, refreshToken: (latest as AuthState | null)?.refreshToken ?? null };
      setState(next);
      await setItem(AUTH_KEY, JSON.stringify(next));
    } catch {
      setState(EMPTY_STATE);
      await clearStoredAuth();
    }
  }

  async function login(tokens: AuthTokens) {
    const next: AuthState = { user: tokens.user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    setState(next);
    await setItem(AUTH_KEY, JSON.stringify(next));
    if (tokens.deviceId) await setDeviceId(tokens.deviceId);
  }

  async function logout() {
    setState(EMPTY_STATE);
    await clearStoredAuth();
  }

  async function updateUser(user: AuthUser) {
    setState((prev) => {
      const next = { ...prev, user };
      void setItem(AUTH_KEY, JSON.stringify(next));
      return next;
    });
  }

  return <AuthContext.Provider value={{ ...state, isReady, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
