// docs/specs/2026-08-28-16-internationalization.md (aspect A-021) — the single source of truth for
// which locales the customer site ships with. Every other piece (selector, cookie, <html lang/dir>,
// message loading, Intl formatting, the API's `languages` rows) keys off these exact codes.

export const LOCALE_COOKIE = 'czd_locale';

export const LOCALES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', intl: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', intl: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', intl: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', intl: 'de' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', intl: 'pt' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr', intl: 'it' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr', intl: 'nl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', intl: 'tr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', intl: 'ar' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr', intl: 'zh-CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', intl: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr', intl: 'ko' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', intl: 'ru' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', intl: 'hi' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', intl: 'ur' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
export type Direction = 'ltr' | 'rtl';

// AC-2 — English is the default for a first visit and the fallback for any missing string.
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((l) => l.code === value);
}

export function localeDir(code: string): Direction {
  return LOCALES.find((l) => l.code === code)?.dir ?? 'ltr';
}

// BCP-47 tag handed to Intl.* (zh → zh-CN so Simplified conventions are used).
export function intlLocale(code: string): string {
  return LOCALES.find((l) => l.code === code)?.intl ?? code;
}
