// Mirrors docs/specs/2026-08-28-16-internationalization.md §3/§4 (aspect A-021).
// Shared between apps/api, apps/web, apps/admin.

export interface LanguageDto {
  code: string;
  name: string;
  nativeName: string;
  isRtl: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface UiTranslationDto {
  locale: string;
  key: string;
  value: string;
  updatedAt: string;
}

// AC-3/AC-8 — the merged bundle a locale actually renders with: the requested locale's own rows,
// English fallback for any missing key. `isMachineTranslated` is stubbed false everywhere until a
// real translation provider is wired in (spec §8 risk noted as an open, deliberate stub for now).
export interface TranslationEntryDto {
  value: string;
  isMachineTranslated: boolean;
}

export type TranslationBundleDto = Record<string, TranslationEntryDto>;

export interface UpsertTranslationsDto {
  entries: Record<string, string>;
}

export interface UpsertLanguageDto {
  name: string;
  nativeName: string;
  isRtl: boolean;
  isEnabled: boolean;
  sortOrder: number;
}
