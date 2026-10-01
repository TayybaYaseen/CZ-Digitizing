-- docs/specs/2026-08-28-16-internationalization.md (aspect A-021) — the customer site now ships
-- complete UI strings for all 15 SRS languages (apps/web/i18n/messages/*.ts), so every one of them
-- gets a `languages` row: enabled, so it appears in the selector, and present, so Admin can also
-- store per-locale `ui_translations` overrides for it (upsertTranslations requires the row).
-- Codes match apps/web/i18n/config.ts exactly. Existing rows (en/ar/ur/es) keep their is_enabled
-- flag — an Admin's rollout decision is never overwritten — and only get the canonical sort order.
INSERT INTO "languages" ("code", "name", "native_name", "is_rtl", "is_enabled", "sort_order") VALUES
  ('en', 'English', 'English', false, true, 0),
  ('es', 'Spanish', 'Español', false, true, 1),
  ('fr', 'French', 'Français', false, true, 2),
  ('de', 'German', 'Deutsch', false, true, 3),
  ('pt', 'Portuguese', 'Português', false, true, 4),
  ('it', 'Italian', 'Italiano', false, true, 5),
  ('nl', 'Dutch', 'Nederlands', false, true, 6),
  ('tr', 'Turkish', 'Türkçe', false, true, 7),
  ('ar', 'Arabic', 'العربية', true, true, 8),
  ('zh', 'Chinese (Simplified)', '简体中文', false, true, 9),
  ('ja', 'Japanese', '日本語', false, true, 10),
  ('ko', 'Korean', '한국어', false, true, 11),
  ('ru', 'Russian', 'Русский', false, true, 12),
  ('hi', 'Hindi', 'हिन्दी', false, true, 13),
  ('ur', 'Urdu', 'اردو', true, true, 14)
ON CONFLICT ("code") DO UPDATE SET "sort_order" = EXCLUDED."sort_order";
