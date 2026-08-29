# Spec: Internationalization & Multi-Language Content

**File:** `docs/specs/2026-08-28-16-internationalization.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Content & knowledge base spec](2026-08-28-10-content-knowledge-base.md), SRS §4 / §28, architecture Frontend Stack (i18next)

---

## 1. Problem statement

**Today:** The platform has no language infrastructure. UI strings, navigation, cart/checkout/
account flows, and Admin-authored content (FAQs, tips) all exist only in English with no structure
for translation, and there is no language selector.

**Who is affected:** International customers who don't read English as a first language; Admin, who
must be able to manage language-specific content without engineering help.

**Why it matters now:** 15 languages are named as a planned target (SRS §4), and multiple other
specs (FAQ, Tips, Get a Quote) already carry a `language_code` field in their data model — this spec
defines the shared infrastructure those features assume exists.

**Success looks like:** A customer selects (or is defaulted by browser locale to) one of 15
languages; UI chrome, forms, and Admin-authored content render in that language with English
fallback for anything untranslated; the choice persists across the session; the system is built so
additional languages can be added later without a schema change.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the header language selector **When** a customer picks one of the 15 supported languages **Then** UI labels, navigation, cart, checkout, account, and FAQ system messages render in that language |
| AC-2 | **Given** no explicit selection **When** a customer first visits **Then** the site defaults to English |
| AC-3 | **Given** a UI string has no translation for the selected language **When** rendered **Then** it falls back to English rather than showing a raw translation key or blank text |
| AC-4 | **Given** a customer selects a language **When** they navigate across pages within the same session **Then** the selection persists (and persists across return visits where practically supported, e.g. via account preference or cookie) |
| AC-5 | **Given** Admin-authored content with `language_code` (FAQs, Tips) **When** a customer's selected language has no matching row for a given entry **Then** the English (`en`) row is shown as fallback rather than omitting the content entirely |
| AC-6 | **Given** Admin wants to add a 16th language in the future **When** they do so **Then** it requires only adding translation content and a new `language_code`/locale entry — no schema migration or code deploy |
| AC-7 | **Given** RTL languages are included in the 15 (Arabic, Urdu) **When** selected **Then** the layout mirrors correctly (text direction, icon/nav placement) without breaking the design system |
| AC-8 | **Given** an FAQ/Tip/design-description entry has no human translation yet for a selected language **When** the page renders **Then** a machine-translated auto-fill (clearly labeled "Machine translated") displays instead of the English fallback, until Admin publishes a human translation |
| AC-9 | **Given** a customer's selected locale **When** numbers, dates, and prices render across the site (beyond the Orders & Payment spec's currency conversion) **Then** they follow that locale's number/date formatting conventions (decimal/thousands separators, date order, calendar) |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/admin/settings/languages` | `role=admin` | `200` `LanguageDto[]` | list of supported/enabled languages |
| `POST` | `/api/admin/settings/languages/:code` | `role=admin` | `200` | enable/configure a language (AC-6) |
| `GET` | `/api/translations/:locale` *(new, proposed)* | Public | `200` `Record<string,string>` | UI-string translation bundle for i18next to consume; not present in architecture's endpoint list |
| `PUT` | `/api/admin/translations/:locale` *(new, proposed)* | `role=admin` | `200` | Admin-editable UI string overrides |

Content-level translation (FAQs, Tips) is served through each owning feature's existing
`language_code`-filtered endpoints (see Content & Knowledge Base spec) — this spec does not
duplicate those routes, only the UI-chrome translation layer and the language-settings admin API.

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `languages` *(new, proposed)* | proposed | `code` (e.g. `en`, `ur`, `ar`), `name`, `native_name`, `is_rtl`, `is_enabled`, `sort_order` — nothing in the architecture DDL enumerates the 15 target languages or tracks which are enabled |
| `ui_translations` *(new, proposed)* | proposed | `id`, `locale`, `key`, `value`, `updated_at`, `updated_by_admin_id` — backs AC-6's "add a language without a deploy" requirement for UI chrome strings (content-level translation already has `language_code` columns on `faqs`/`embroiderer_tips` per the existing DDL) |
| `users.preferred_locale` *(new column, proposed)* | proposed | persists AC-4's cross-visit language preference for logged-in customers; guest persistence uses a cookie, not the DB |

### Migration

- **Name:** `AddLanguagesAndTranslations`
- **Reversible:** yes
- **Backfill required:** yes — seed `languages` with the 15 planned languages (English default
  enabled, others per Admin rollout decision) and seed `ui_translations` for `en` from the initial
  hardcoded UI strings before removing them from source
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

No PII beyond `users.preferred_locale`, which is a preference, not sensitive data.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | translation bundle fetch happens once at app boot / language switch; show existing content (previous language or English) rather than blanking the page during the fetch |
| **Empty** | a language with zero `ui_translations` rows beyond the seed still functions fully via English fallback (AC-3) — never a broken UI |
| **Error** | translation-fetch failure falls back to the last successfully loaded bundle or English, silently (not a user-facing error — this is a degraded-but-functional state, not a failure state) |
| **Success** | full UI in the selected language, correct text direction for RTL languages |

**Route(s):** language selector is a header component present on every public page; `/admin/settings/languages`,
`/admin/settings/translations`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | English-fallback resolution for missing keys/content rows, RTL direction switching | `apps/web/i18n/*.spec.ts` |
| **Integration** | language-settings CRUD, translation-bundle endpoint returns correct locale, `preferred_locale` persists across login sessions | `apps/api/test/integration/i18n.spec.ts` |
| **Component** | key UI flows (cart, checkout, account) render correctly with a non-English locale active, including RTL layout snapshot for Arabic/Urdu | `apps/web/**` (RTL/snapshot) |
| **E2E** | select Arabic → navigate cart/checkout → layout is RTL and text is translated; select an unconfigured edge-case string → falls back to English | `e2e/i18n.e2e.spec.ts` |
| **Content QA** | translation quality/accuracy review for each of the 15 languages against a native-speaker-reviewed reference set | `content-qa/i18n-review-checklist` |

**Traceability:** AC-1…AC-9 → `i18n.integration.spec.ts` / `i18n.e2e.spec.ts`.

**Coverage:** ≥75% (slightly below the platform default, since exhaustive per-string translation
coverage across 15 languages is a content task, not a code-correctness one — the *mechanism* is what
this spec's tests must cover at high confidence).

**Not covered, deliberately:** None — translation quality/accuracy review is covered by the
Content QA row above.

---

## 7. Out of scope

None — every item previously listed here (machine-translation auto-fill, locale-based
number/date formatting) has been folded into AC-8/AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `languages` and `ui_translations` tables are required by the explicit "add a language without a deploy" requirement but absent from the architecture DDL | Engineering | Open |
| 2 | Which of the 15 languages are enabled at initial launch vs. added progressively — SRS lists all 15 as "planned," not necessarily all live on day one | Admin | Open |
| 3 | RTL layout verification approach (manual QA vs. automated visual regression) not decided | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** `i18n-enabled` languages can be toggled individually via `languages.is_enabled`
  — English ships enabled at launch; each additional language flips on independently as its content
  is ready, per Phase 4 of the roadmap.
- **Migration order:** `languages`/`ui_translations` ship before the language selector UI is shown;
  `users.preferred_locale` can ship in the same migration.
- **Rollback:** standard image rollback; disabling a problematic language is a data toggle
  (`is_enabled=false`), not a deploy.
- **Observability:** track language-selection distribution to prioritize which of the 15 to fully
  translate/content-fill first.
