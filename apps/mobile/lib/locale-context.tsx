import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NativeModules, Platform } from 'react-native';
import type { LanguageDto, TranslationBundleDto } from '@czd/shared-types';
import { apiFetch } from './api-client';
import { useAuth } from './auth-context';

// Port of apps/web/lib/locale-context.tsx (docs/specs/2026-08-28-16-internationalization.md,
// aspect A-021). Same resolution order and API surface (/api/languages, /api/translations/:locale)
// — SecureStore replaces the web version's cookie for guest persistence.
const STORAGE_KEY = 'czd.locale';
const DEFAULT_LOCALE = 'en';

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

function deviceLocale(): string {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale || NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    return typeof locale === 'string' ? locale.split(/[-_]/)[0] : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isReady: authReady } = useAuth();
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [languages, setLanguages] = useState<LanguageDto[]>([]);
  const [translations, setTranslations] = useState<TranslationBundleDto>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    (async () => {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null);
      const resolved = user?.preferredLocale ?? stored ?? deviceLocale() ?? DEFAULT_LOCALE;
      setLocaleState(resolved);
    })();
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
      .catch(() => setIsReady(true));
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const language = languages.find((l) => l.code === locale);
  const dir: 'ltr' | 'rtl' = language?.isRtl ? 'rtl' : 'ltr';

  function setLocale(next: string) {
    setLocaleState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next);
    if (user && accessToken) {
      apiFetch('/api/account/preferred-locale', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ locale: next }),
      }).catch(() => {});
    }
  }

  function t(key: string): string {
    return translations[key]?.value ?? key;
  }

  return <LocaleContext.Provider value={{ locale, dir, languages, translations, isReady, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale() must be used within <LocaleProvider>');
  return ctx;
}
