import { intlLocale, localeDir } from './config';

// Pure helpers shared by the server (root layout, metadata) and the client LocaleProvider. No React
// and no browser APIs, so the exact same lookup runs on both sides and hydration always matches.

export type FlatMessages = Record<string, string>;
export type TranslationValues = Record<string, string | number>;

// { nav: { home: 'Home' } } → { 'nav.home': 'Home' }
export function flattenMessages(messages: object, prefix = '', out: FlatMessages = {}): FlatMessages {
  for (const [key, value] of Object.entries(messages) as [string, unknown][]) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') flattenMessages(value, path, out);
  }
  return out;
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

// English underneath a locale (AC-3 fallback). A plural family the locale defines itself replaces
// English's entirely — otherwise e.g. English `_one` would leak into a language (Arabic, Japanese…)
// that deliberately defines only `_other`.
export function withEnglishFallback(english: FlatMessages, localized: FlatMessages): FlatMessages {
  const merged: FlatMessages = {};
  for (const [key, value] of Object.entries(english)) {
    const base = key.replace(PLURAL_SUFFIX, '');
    if (base !== key && localized[`${base}_other`] !== undefined) continue;
    merged[key] = value;
  }
  return Object.assign(merged, localized);
}

// `ui_translations` rows (GET /api/translations/:locale?fallback=false) → flat map. These are the
// Admin's per-locale overrides and always win over the bundled strings (see docs/i18n.md).
export function overridesFromBundle(bundle: Record<string, { value: string }> | null | undefined): FlatMessages {
  return Object.fromEntries(Object.entries(bundle ?? {}).map(([key, entry]) => [key, entry.value]));
}

// Dotted paths of every string leaf — gives t() compile-time key checking against en.ts.
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

// Plural families are stored as `key_one` / `key_other` (+ `_zero/_two/_few/_many` where a language
// needs them) and looked up by their base name with a numeric `count`.
type PluralBase<K> = K extends `${infer Base}_other` ? Base : never;

export type TranslationKeyOf<M> = Leaves<M> | PluralBase<Leaves<M>>;

export function formatValue(value: string | number, locale: string): string {
  return typeof value === 'number' ? new Intl.NumberFormat(intlLocale(locale)).format(value) : value;
}

// In RTL locales each inserted value is wrapped in Unicode FIRST STRONG ISOLATE … POP DIRECTIONAL
// ISOLATE (invisible), so an email, order number or Latin name keeps its own direction inside an
// Arabic/Urdu sentence instead of being reordered by the surrounding RTL text.
const FSI = '\u2068';
const PDI = '\u2069';

export function interpolate(template: string, values: TranslationValues | undefined, locale: string): string {
  if (!values) return template;
  const isolate = localeDir(locale) === 'rtl';
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) return match;
    const formatted = formatValue(values[name]!, locale);
    return isolate ? `${FSI}${formatted}${PDI}` : formatted;
  });
}

export function createTranslator(messages: FlatMessages, locale: string) {
  const pluralRules = new Intl.PluralRules(intlLocale(locale));

  function resolve(key: string, values?: TranslationValues): string | undefined {
    const count = values?.count;
    if (typeof count === 'number') {
      const form = count === 0 && messages[`${key}_zero`] !== undefined ? 'zero' : pluralRules.select(count);
      const plural = messages[`${key}_${form}`] ?? messages[`${key}_other`];
      if (plural !== undefined) return plural;
    }
    return messages[key];
  }

  // AC-3 — a missing key renders the key itself (never blank) so the gap is visible, but every key
  // in en.ts exists in every locale file (enforced by the Messages type), so this is a last resort.
  function t(key: string, values?: TranslationValues): string {
    const template = resolve(key, values);
    return template === undefined ? key : interpolate(template, values, locale);
  }

  function has(key: string): boolean {
    return messages[key] !== undefined;
  }

  return { t, has };
}
