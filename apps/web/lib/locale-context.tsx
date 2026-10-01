'use client';

import { useRouter } from 'next/navigation';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiError, LanguageDto, TranslationBundleDto } from '@czd/shared-types';
import { DEFAULT_LOCALE, intlLocale, isLocale, LOCALE_COOKIE, LOCALES, localeDir, type Direction, type Locale } from '@/i18n/config';
import { loadFlatMessages, type EnglishMessages } from '@/i18n/messages';
import { translateApiError, translateFieldMessage } from '@/i18n/api-errors';
import { createTranslator, overridesFromBundle, type FlatMessages, type TranslationKeyOf, type TranslationValues } from '@/i18n/translate';
import { apiFetch } from './api-client';
import { useAuth } from './auth-context';

// docs/specs/2026-08-28-16-internationalization.md (aspect A-021).
//
// The base UI strings for all 15 locales ship with the app (apps/web/i18n/messages/*.ts). The
// server reads the `czd_locale` cookie and hands this provider the active locale's messages, so the
// first render — server and client alike — is already in the right language and direction. The
// admin-editable `ui_translations` rows (/api/translations/:locale) are layered on top as
// overrides, so Admin can still reword any string without a deploy (AC-6): merged on the server
// for the initial locale (i18n/server.ts), and fetched alongside the bundle on a language switch.

export type TranslationKey = TranslationKeyOf<EnglishMessages>;

export interface LanguageOption {
  code: Locale;
  name: string;
  nativeName: string;
  dir: Direction;
}

type RichRenderer = (chunk: ReactNode) => ReactNode;

interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  languages: LanguageOption[];
  setLocale: (locale: string) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  // For keys built at runtime (e.g. an order status) — returns `fallback` when no such key exists.
  tOr: (key: string, fallback: string, values?: TranslationValues) => string;
  // t() plus inline markup: "Read the <link>terms</link>" → components.link("terms").
  rich: (key: TranslationKey, components: Record<string, RichRenderer>, values?: TranslationValues) => ReactNode;
  errorMessage: (error: ApiError) => string;
  // Inline form-field message (zod key or class-validator English) → translated text.
  fieldError: (message: string | undefined) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string) => string;
  // Kept for existing callers of the pre-refactor context shape.
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeCookie(value: string) {
  // 1 year — AC-4's "persists across return visits" for guests, who have no account row to persist to.
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}


const RICH_TAG = /<(\w+)>(.*?)<\/\1>/g;

export function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
  hasExplicitChoice,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialMessages: FlatMessages;
  hasExplicitChoice: boolean;
}) {
  const router = useRouter();
  const { user, accessToken, isReady: authReady } = useAuth();
  const [{ locale, messages }, setActive] = useState({ locale: initialLocale, messages: initialMessages });
  const [enabledCodes, setEnabledCodes] = useState<string[] | null>(null);
  // True once the visitor has actively picked a language (cookie present or chosen this session) —
  // that choice then wins over a stale account preference on login instead of being overwritten.
  const explicitChoice = useRef(hasExplicitChoice);
  const switchSeq = useRef(0);

  const persistToAccount = useCallback(
    (next: Locale) => {
      if (!user || !accessToken) return;
      apiFetch('/api/account/preferred-locale', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    },
    [user, accessToken],
  );

  const applyLocale = useCallback(
    async (next: Locale) => {
      const seq = ++switchSeq.current;
      writeCookie(next);
      // Admin overrides for the new locale win over its bundled strings (docs/i18n.md precedence).
      const [bundled, overrides] = await Promise.all([
        loadFlatMessages(next),
        apiFetch<TranslationBundleDto>(`/api/translations/${next}?fallback=false`)
          .then(overridesFromBundle)
          .catch(() => ({})),
      ]);
      if (seq !== switchSeq.current) return; // a later switch already won
      setActive({ locale: next, messages: { ...bundled, ...overrides } });
      // Re-renders server components (root layout's <html lang/dir>, page metadata) with the new cookie.
      router.refresh();
    },
    [router],
  );

  const setLocale = useCallback(
    (next: string) => {
      if (!isLocale(next)) return;
      explicitChoice.current = true;
      void applyLocale(next);
      persistToAccount(next);
    },
    [applyLocale, persistToAccount],
  );

  // AC-4 — on sign-in, a language picked on this device is saved to the account; with no pick on
  // this device yet, the account's saved preference is adopted instead.
  useEffect(() => {
    if (!authReady || !user) return;
    if (explicitChoice.current) {
      if (user.preferredLocale !== locale) persistToAccount(locale);
    } else if (isLocale(user.preferredLocale) && user.preferredLocale !== locale) {
      explicitChoice.current = true;
      void applyLocale(user.preferredLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id]);

  // Admin rollout toggle (languages.is_enabled) — hides a bundled language the Admin has switched
  // off. A failed/empty response leaves all 15 visible rather than an empty selector.
  useEffect(() => {
    apiFetch<LanguageDto[]>('/api/languages')
      .then((rows) => setEnabledCodes(rows.length > 0 ? rows.map((r) => r.code) : null))
      .catch(() => setEnabledCodes(null));
  }, []);


  const dir = localeDir(locale);

  // AC-7 — the server already rendered the right lang/dir; this keeps them in step immediately on
  // a client-side switch, before router.refresh() round-trips.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<LocaleContextValue>(() => {
    const translator = createTranslator(messages, locale);
    const t = (key: TranslationKey, values?: TranslationValues) => translator.t(key, values);
    const tOr = (key: string, fallback: string, values?: TranslationValues) => (translator.has(key) || translator.has(`${key}_other`) ? translator.t(key, values) : fallback);
    const rich = (key: TranslationKey, components: Record<string, RichRenderer>, values?: TranslationValues): ReactNode => {
      const text = translator.t(key, values);
      const parts: ReactNode[] = [];
      let last = 0;
      for (const match of Array.from(text.matchAll(RICH_TAG))) {
        const [whole, tag, inner] = match;
        const index = match.index ?? 0;
        if (index > last) parts.push(text.slice(last, index));
        const render = components[tag!];
        parts.push(<Fragment key={index}>{render ? render(inner) : inner}</Fragment>);
        last = index + whole.length;
      }
      if (last < text.length) parts.push(text.slice(last));
      return parts;
    };
    const tag = intlLocale(locale);
    const toDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v);
    const visible = LOCALES.filter((l) => !enabledCodes || enabledCodes.includes(l.code) || l.code === locale || l.code === DEFAULT_LOCALE);

    return {
      locale,
      dir,
      languages: visible.map(({ code, name, nativeName, dir: d }) => ({ code, name, nativeName, dir: d })),
      setLocale,
      t,
      tOr,
      rich,
      errorMessage: (error: ApiError) => translateApiError(error, translator.t, translator.has),
      fieldError: (message: string | undefined) => translateFieldMessage(message, translator.t, translator.has),
      formatNumber: (v, options) => new Intl.NumberFormat(tag, options).format(v),
      formatDate: (v, options) => new Intl.DateTimeFormat(tag, options ?? { dateStyle: 'medium' }).format(toDate(v)),
      formatDateTime: (v) => new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(v)),
      isReady: true,
    };
  }, [locale, dir, messages, enabledCodes, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale() must be used within <LocaleProvider>');
  return ctx;
}

// Shorthand for the common case of a component that only needs t().
export function useT() {
  return useLocale().t;
}
