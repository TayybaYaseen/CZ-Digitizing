import type en from './en';
import { DEFAULT_LOCALE, type Locale } from '../config';
import { flattenMessages, withEnglishFallback, type FlatMessages } from '../translate';

// en.ts is the source of truth for the key set. Every other locale file is typed as `Messages`, so a
// key added to en.ts fails the typecheck until it exists in all 14 other languages too — no
// silently-English strings. Plural families (`key_one`/`key_other`, see i18n/translate.ts) must
// always provide `_other`; the extra CLDR forms a language needs (`_zero`, `_two`, `_few`, `_many` —
// Arabic, Russian, …) are allowed without having to exist in English.
type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many';
type PluralExtras = { [K in `${string}_${PluralForm}`]?: string };

type LocaleShape<T> = {
  [K in keyof T as K extends `${string}_${PluralForm}` ? never : K]: T[K] extends string ? string : LocaleShape<T[K]>;
} & PluralExtras;

export type EnglishMessages = typeof en;
export type Messages = LocaleShape<EnglishMessages>;

// One dynamic import per locale so webpack splits each language into its own chunk: the server
// loads just the active locale for SSR, and the browser only downloads another language when the
// customer actually switches to it.
const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import('./en'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  pt: () => import('./pt'),
  it: () => import('./it'),
  nl: () => import('./nl'),
  tr: () => import('./tr'),
  ar: () => import('./ar'),
  zh: () => import('./zh'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  ru: () => import('./ru'),
  hi: () => import('./hi'),
  ur: () => import('./ur'),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}

// The flat, English-backed message map a locale renders with — shared by the server (root layout)
// and the client LocaleProvider (language switch) so both resolve strings identically.
export async function loadFlatMessages(locale: Locale): Promise<FlatMessages> {
  const english = flattenMessages(await loadMessages(DEFAULT_LOCALE));
  if (locale === DEFAULT_LOCALE) return english;
  return withEnglishFallback(english, flattenMessages(await loadMessages(locale)));
}
