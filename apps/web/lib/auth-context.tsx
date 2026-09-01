'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@czd/shared-types';

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
    setState(readStoredAuth());
    setIsReady(true);
  }, []);

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
