# Spec: Home Page Sections & Advertisement/Offer Manager

**File:** `docs/specs/2026-08-28-13-home-promotions-cms.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Design catalog spec](2026-08-28-04-design-catalog-browsing.md), SRS §5 / §19 / §21–22 / Addendum §2, architecture §File Management

---

## 1. Problem statement

**Today:** The home page has no dynamic, Admin-controlled content. There is no way to create
curated design sections, no promotional advertisement/offer system, and no header media
(image/video banner) management — every homepage change would otherwise require a code deploy.

**Who is affected:** Admin, who needs to merchandise the home page and run time-boxed promotions
without engineering involvement; customers, whose first impression of the site is driven entirely
by this content.

**Why it matters now:** This is the explicit "implementation principle" of the whole platform (SRS
§32): the site is visually fixed and polished, while content is dynamic and Admin-controlled. Home
Sections and Advertisements are the two clearest examples of that principle.

**Success looks like:** Admin creates unlimited home sections (heading + related designs, capped at
6 visible with View More), and can run a header/home advertisement with dates, countdown, and
targeting that automatically appears and disappears — with zero empty placeholder when nothing is
active.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin creates a home section with a heading and a set of related designs **When** published **Then** it renders on Home using the standard design-card format, capped at 6 cards with a "View More" control if more than 6 exist (shared rule with the Catalog spec's AC-2) |
| AC-2 | **Given** multiple home sections **When** rendered **Then** they appear in Admin-defined order and each can be independently hidden/shown without affecting the others |
| AC-3 | **Given** Admin creates an advertisement (heading, subheading, offer/discount, image/banner or video, CTA, start/end date, target = whole category or specific designs) **When** the current time is within `[start_date, end_date]` and status is active **Then** it renders below the header with a live countdown to `end_date` |
| AC-4 | **Given** an advertisement's `end_date` passes, or Admin deactivates it **When** the page next loads **Then** the ad section is fully omitted (no empty container, no layout gap) |
| AC-5 | **Given** no active advertisement exists at all **When** the home page renders **Then** the ad area is skipped entirely — this must be true by default (SRS: "If no active ad exists, the entire ad area is skipped") |
| AC-6 | **Given** Admin uploads header media (image, video, or both) with optional heading/subheading/CTA/dates/priority/visibility **When** multiple header items are active simultaneously **Then** they display per configured priority, optionally as a carousel |
| AC-7 | **Given** Admin reorders, hides, or deletes a home section or its selected designs **When** saved **Then** the public home page reflects the change immediately with no deploy |
| AC-8 | **Given** Admin runs an A/B test on home-section ordering **When** customers are bucketed into variant groups **Then** each group sees its assigned ordering consistently across visits, and Admin can view engagement metrics per variant |
| AC-9 | **Given** a logged-in customer's browsing/purchase history **When** the home page renders for them **Then** home sections are personalized/reordered to favor categories relevant to that customer, while guests/customers with no history see the default Admin-defined order |
| AC-10 | **Given** Admin configures a header media item's visibility flags (desktop web, mobile web, mobile app) **When** the item is active **Then** it renders only on the platforms where its visibility flag is enabled, independently per platform — e.g. a desktop-only banner never renders on the mobile app |
| AC-11 | **Given** Admin sets an auto-slide display duration for a header carousel (e.g. 5 seconds) **When** multiple header items are active **Then** the carousel advances automatically at that configured interval, and manual navigation (swipe/click/tap) pauses the auto-advance the same way the design-card auto-swap does (Catalog spec AC-5) |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.
None of these routes exist in the architecture's endpoint inventory — this entire surface is new.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/home/sections` *(new)* | Public | `200` `HomeSectionDto[]` | ordered, published only |
| `POST` / `PUT` / `DELETE` | `/api/admin/home/sections` `/:id` *(new)* | `role=admin` | | AC-1/AC-2/AC-7 |
| `PUT` | `/api/admin/home/sections/:id/reorder` *(new)* | `role=admin` | `200` | |
| `GET` | `/api/home/advertisement` *(new)* | Public | `200` `AdvertisementDto \| null` | returns `null`/`204` when nothing active — AC-5 |
| `POST` / `PUT` / `DELETE` | `/api/admin/advertisements` `/:id` *(new)* | `role=admin` | | AC-3/AC-4 |
| `GET` | `/api/home/header-media` *(new)* | Public | `200` `HeaderMediaDto[]` | active items by priority — AC-6 |
| `POST` / `PUT` / `DELETE` | `/api/admin/header-media` `/:id` *(new)* | `role=admin` | | |

### DTOs

```ts
export interface AdvertisementDto {
  id: string; heading: string; subheading?: string; offerText?: string;
  bannerImageUrl?: string; bannerVideoUrl?: string; ctaText?: string; ctaLink?: string;
  startDate: string; endDate: string; targetCategoryId?: string; targetDesignIds?: string[];
}
```

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `home_sections` *(new, proposed)* | proposed | `id`, `heading`, `description`, `sort_order`, `is_published`, `created_at`, `updated_at`, `created_by_admin_id` |
| `home_section_designs` *(new, proposed)* | proposed | `id`, `home_section_id`, `design_id`, `sort_order` — many-to-many |
| `advertisements` *(new, proposed)* | proposed | `id`, `heading`, `subheading`, `offer_text`, `banner_image_url`, `banner_video_url`, `cta_text`, `cta_link`, `start_date`, `end_date`, `is_active`, `target_category_id` (nullable), `created_at`, `updated_at` |
| `advertisement_target_designs` *(new, proposed)* | proposed | `advertisement_id`, `design_id` — used when targeting is "specific designs/logos" instead of a whole category |
| `header_media` *(new, proposed)* | proposed | `id`, `image_url`, `video_url`, `heading`, `subheading`, `cta_link`, `start_date`, `end_date`, `priority`, `is_active`, `is_carousel_item`, `visible_desktop` (boolean, default true), `visible_mobile_web` (boolean, default true), `visible_mobile_app` (boolean, default true), `auto_slide_duration_seconds` (default 5) — the last four columns close the AC-10/AC-11 gap (per-platform visibility, configurable auto-slide timing) |

None of these five entities exist anywhere in the architecture's DDL, despite Home Sections,
Advertisements, and Header Media all being named, detailed Admin modules in the SRS (§19, §21, §22)
— this is the second-largest schema gap in this spec set, after Taebo.

### Migration

- **Name:** `AddHomeContentAndPromotions`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored; fully new subsystem

### Retention and privacy

No PII. Media assets follow the public-storage rules already defined in architecture §File
Management (`/public/header-media/`, `/public/ads/`).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | home page shows section skeletons; ad-area placeholder is *not* shown while loading if the API can determine "no active ad" quickly — prefer server-rendering the ad decision to avoid a loading flash into an empty slot |
| **Empty** | zero home sections published shows a minimal, still-polished home page (hero + services + testimonials + footer), never a broken layout |
| **Error** | a failed section/ad fetch degrades gracefully — the rest of the home page still renders; the failed section shows nothing rather than an error banner (this is marketing content, not a workflow the customer must complete) |
| **Success** | sections render in order; countdown timer updates live; carousel auto-advances per header-media priority |

**Route(s):** `/` (Home), `/admin/home/sections`, `/admin/home/advertisements`,
`/admin/home/header-media`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | active-ad date-window calculation, countdown math, 6-item cap + View More toggle (shared with Catalog spec), category-vs-specific-design targeting resolution, per-platform header-media visibility resolution, auto-slide timer/pause-on-interaction | `apps/api/home-cms/*.spec.ts` |
| **Integration** | section/ad/header-media CRUD, reorder, publish/unpublish propagation, "no active ad → area skipped" | `apps/api/test/integration/home-cms.spec.ts` |
| **E2E** | admin creates a section and an ad with a future end-date → both appear; ad's end-date passes → ad disappears with no layout shift | `e2e/home-cms.e2e.spec.ts` |
| **Integration** | header/ad video transcoding and optimization pipeline (bitrate/resolution/format per architecture §File Management) | `apps/api/test/integration/home-media-transcoding.spec.ts` |

**Traceability:** AC-1…AC-11 → `home-cms.integration.spec.ts` / `home-cms.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — the header/ad video transcoding pipeline is covered by the
additional Integration row above.

---

## 7. Out of scope

None — every item previously listed here (A/B testing of home-section ordering, personalized
home sections) has been folded into AC-8/AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `home_sections`, `home_section_designs`, `advertisements`, `advertisement_target_designs`, and `header_media` are all required by named SRS Admin modules but entirely absent from the architecture DDL | Engineering | Open |
| 2 | Whether an advertisement can target *both* a category and specific designs simultaneously, or must be one or the other (SRS says "category **or** specific designs") | Admin | Open |
| 3 | Carousel behavior when multiple header-media items are active at the same priority (tie-break rule) | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — expected at Phase 1/2 per roadmap (Admin panel basics ship in Phase 1).
- **Migration order:** all five new tables ship before the Admin Home CMS UI is enabled.
- **Rollback:** standard image rollback; safe to drop pre-launch.
- **Observability:** track home-section click-through and ad CTA click-through as merchandising
  signals; alert if the ad-area date-window calculation ever renders an expired ad (correctness bug,
  not just a product metric).
