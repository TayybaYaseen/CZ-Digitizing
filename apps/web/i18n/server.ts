import { cookies } from 'next/headers';
import { cache } from 'react';
import type { ApiResponse, TranslationBundleDto } from '@czd/shared-types';
import { API_URL } from '@/lib/api-url';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { loadFlatMessages } from './messages';
import { createTranslator, overridesFromBundle, type FlatMessages } from './translate';

// Server-side half of the locale system (root layout + generateMetadata). Reading the same
// `czd_locale` cookie the client writes means the very first HTML already has the right text,
// <html lang> and <html dir> — no English flash, no RTL flip after hydration.
export function getRequestLocale(): { locale: Locale; fromCookie: boolean } {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? { locale: value, fromCookie: true } : { locale: DEFAULT_LOCALE, fromCookie: false };
}

// Admin overrides for one locale. Uncached so an Admin edit shows on the very next page load; a
// slow/unreachable API just means no overrides (bundled strings still render), never a broken page.
async function fetchOverrides(locale: Locale): Promise<FlatMessages> {
  try {
    const res = await fetch(`${API_URL}/api/translations/${locale}?fallback=false`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (!res.ok) return {};
    const body = (await res.json()) as ApiResponse<TranslationBundleDto>;
    return overridesFromBundle(body.data);
  } catch {
    return {};
  }
}

// Precedence (highest first): Admin override for this locale → bundled string for this locale →
// bundled English. Overrides are merged here, on the server, so server components, page metadata
// and the first client render all agree — no flash from bundled text to the Admin's wording.
// cache() dedupes the work across the layout, metadata and server components of one request.
export const getFlatMessages = cache(async (locale: Locale): Promise<FlatMessages> => {
  const [bundled, overrides] = await Promise.all([loadFlatMessages(locale), fetchOverrides(locale)]);
  return { ...bundled, ...overrides };
});

export async function getServerTranslator() {
  const { locale } = getRequestLocale();
  return { locale, ...createTranslator(await getFlatMessages(locale), locale) };
}
