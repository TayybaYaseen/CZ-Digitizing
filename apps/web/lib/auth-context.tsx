'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@czd/shared-types';
import { apiFetch } from './api-client';

// Mirrors apps/api/src/auth/dto/user-profile.dto.ts's UserProfileDto — the shape returned by
// register/login/verify-session. Not imported directly since apps/api isn't a workspace dependency
// of apps/web (backend internals stay backend-internal); kept in sync by hand.
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  gmailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// isReady distinguishes "haven't checked localStorage yet" from "checked, no session" — a page
// gating on `user` alone would see `null` on the very first synchronous render (before the
// restore effect below runs) and redirect a legitimately logged-in user every time.
interface AuthContextValue extends AuthState {
  isReady: boolean;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

const STORAGE_KEY = 'czd.auth';
const EMPTY_STATE: AuthState = { user: null, accessToken: null, refreshToken: null };

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): AuthState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return JSON.parse(raw) as AuthState;
  } catch {
    return EMPTY_STATE;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);

  // Restore from localStorage after mount only — avoids a server/client render mismatch
  // (the server has no localStorage, so the first client render must match it: signed out).
  useEffect(() => {
    const stored = readStoredAuth();
    setState(stored);
    setIsReady(true);
    if (stored.accessToken) void verifySession(stored.accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Landing Page Experience spec AC-2/AC-3 — confirms a restored session is still actually valid
  // (not merely present in localStorage) on every load. apiFetch's own fetchWithAuthRetry already
  // implements AC-3's "expired access token but valid refresh token -> one silent refresh" flow;
  // this only needs to sync the result back into React state and localStorage. If both
  // verify-session AND the automatic refresh retry fail, the session really is gone (revoked
  // session, expired refresh token) — fall back to signed-out, never a broken/stale signed-in nav.
  async function verifySession(accessToken: string) {
    try {
      const profile = await apiFetch<AuthUser>('/api/auth/verify-session', { headers: { Authorization: `Bearer ${accessToken}` } });
      const latest = readStoredAuth(); // fetchWithAuthRetry may have silently written a refreshed access token
      const next: AuthState = { user: profile, accessToken: latest.accessToken ?? accessToken, refreshToken: latest.refreshToken };
      setState(next);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setState(EMPTY_STATE);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function login(tokens: AuthTokens) {
    const next: AuthState = { user: tokens.user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    setState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function logout() {
    setState(EMPTY_STATE);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return <AuthContext.Provider value={{ ...state, isReady, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
