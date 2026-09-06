'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LanguageDto, TranslationBundleDto } from '@czd/shared-types';
import { apiFetch } from './api-client';
import { useAuth } from './auth-context';

// docs/specs/2026-08-28-16-internationalization.md (aspect A-021).
const COOKIE_NAME = 'czd_locale';
const DEFAULT_LOCALE = 'en'; // AC-2

interface LocaleContextValue {
  locale: string;
  dir: 'ltr' | 'rtl';
  languages: LanguageDto[];
  translations: TranslationBundleDto;
  isReady: boolean;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  // 1 year — AC-4's "persists across return visits" for guests, who have no account row to persist to.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isReady: authReady } = useAuth();
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [languages, setLanguages] = useState<LanguageDto[]>([]);
  const [translations, setTranslations] = useState<TranslationBundleDto>({});
  const [isReady, setIsReady] = useState(false);

  // AC-2/AC-4 — resolution order: an existing choice (cookie or, once auth is known, the logged-in
  // user's saved preference) beats the browser's language, which beats the English default. Runs
  // client-side only, after mount, to avoid an SSR/client render mismatch (server has no cookie).
  useEffect(() => {
    if (!authReady) return;
    const cookieLocale = readCookie(COOKIE_NAME);
    const resolved = user?.preferredLocale ?? cookieLocale ?? (typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : undefined) ?? DEFAULT_LOCALE;
    setLocaleState(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  useEffect(() => {
    apiFetch<LanguageDto[]>('/api/languages')
      .then(setLanguages)
      .catch(() => setLanguages([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TranslationBundleDto>(`/api/translations/${locale}`)
      .then((bundle) => {
        if (!cancelled) {
          setTranslations(bundle);
          setIsReady(true);
        }
      })
      // AC-3/§5 error state — a fetch failure keeps whatever bundle was already loaded (or empty
      // on first load, which itself renders fine via the t() fallback below) rather than a broken page.
      .catch(() => setIsReady(true));
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const language = languages.find((l) => l.code === locale);
  const dir: 'ltr' | 'rtl' = language?.isRtl ? 'rtl' : 'ltr';

  // AC-7 — flips <html> dir/lang once the real locale is known; SSR always renders lang="en"/ltr
  // (see app/layout.tsx), so this only ever mutates after mount, never during the first paint.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  function setLocale(next: string) {
    setLocaleState(next);
    writeCookie(COOKIE_NAME, next);
    if (user && accessToken) {
      apiFetch('/api/account/preferred-locale', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    }
  }

  // AC-3 — a key with no bundle entry yet (still loading, or genuinely missing from both the
  // locale and its English fallback) renders as a readable label, never a blank string.
  function t(key: string): string {
    return translations[key]?.value ?? key;
  }

  return (
    <LocaleContext.Provider value={{ locale, dir, languages, translations, isReady, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale() must be used within <LocaleProvider>');
  return ctx;
}
