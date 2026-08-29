# Spec: Design Catalog, Categories & Card Browsing

**File:** `docs/specs/2026-08-28-04-design-catalog-browsing.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), SRS §7–9 & Addendum §3, architecture §Database Schema / §API Architecture

---

## 1. Problem statement

**Today:** There is no public catalog. Customers cannot browse, search, or filter machine
embroidery designs by category/subcategory, cannot see stitch/thread details before buying, and
Admin has no structured way to organize designs into categories.

**Who is affected:** Every prospective customer discovering CZ Digitizing designs; Admin, who needs
unlimited categories/subcategories and full design metadata control.

**Why it matters now:** The catalog is the primary discovery and conversion surface — the design
card's front/back flip interaction is the core browsing experience described across SRS §7–9.

**Success looks like:** A customer can browse by category/subcategory or search, see a uniform card
with all required public information, flip it for full detail, and favorite/add to cart directly
from either side — on desktop, tablet, and mobile.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin creates a main category and, optionally, subcategories under it **When** published **Then** customers can browse into that category/subcategory from navigation, and any design assigned to it appears there |
| AC-2 | **Given** a design assigned to one or multiple categories/subcategories **When** the catalog renders **Then** it appears under every assigned category, not just the first |
| AC-3 | **Given** a published design card, front side **When** rendered **Then** it shows preview image, name, category/subcategory tag, favorite icon, price/sale price, and Add to Cart |
| AC-4 | **Given** a card is clicked/tapped **When** it flips **Then** the back shows all sizes (Size 1, Size 2, …), stitch count, thread/color info, description, category tags, and an Add to Cart button also present on the back |
| AC-5 | **Given** a design has both Vector Image/Video and Embroidery Image/Video uploaded, with auto-swap enabled **When** the card is idle **Then** media swaps every 2 seconds; **given** the user clicks/taps/swipes **then** auto-swap pauses on the manually selected media |
| AC-6 | **Given** a customer types in header search **When** they type ≥1 character **Then** live suggestions appear across design name, category, subcategory, tags, services, blog, and FAQ, with a "View All Results" action |
| AC-7 | **Given** the All Designs page with active filters (category, price range, service type, tags, stitch-count range, thread-color) **When** filters are applied **Then** results update via the faceted search query and pagination limits to 50 items per architecture §Search Optimization |
| AC-8 | **Given** a customer favorites a design **When** they view "My Account → Purchased Designs/Favorites" **Then** the favorite persists across sessions for their account |
| AC-9 | **Given** the catalog is viewed on mobile **When** rendered **Then** no horizontal overflow occurs and all card text remains readable (SRS §3 Responsive Requirement) |
| AC-10 | **Given** catalog/FAQ search is served by Elasticsearch instead of Postgres FTS **When** a customer searches **Then** results are returned from the Elasticsearch index with equivalent or better relevance, through the same `/api/designs/search` contract as AC-6 |
| AC-11 | **Given** a customer views a design detail page **When** the page renders **Then** a "Customers also bought" section shows related designs computed from co-purchase order-history data |
| AC-12 | **Given** a design's embroidery/vector video assets **When** played on the design detail page **Then** they stream via HLS with adaptive bitrate instead of a flat MP4 file, per architecture §File Management video optimization |
| AC-13 | **Given** the public search index/endpoint (AC-6) **When** it returns results **Then** it includes only publicly-searchable catalog/content data (published designs, categories, subcategories, services, blog posts, FAQs, per the Search index scope note in §4) and never includes Admin-only fields, private-file metadata (storage paths, filenames, `.EMB`/format data), or any other customer's private purchase/account information — enforced by the same DTO-exclusion-by-construction rule as the master spec §3, applied to every entity in the search index |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/designs` | Public | `200` `PagedResponse<DesignSummaryDto>` | filterable, paginated (limit 50) |
| `GET` | `/api/designs/:id` | Public | `200` `DesignDetailDto` | includes sizes, no private-file fields |
| `GET` | `/api/designs/search?q=` | Public | `200` live suggestions | debounced client-side |
| `GET` | `/api/designs/category/:categoryId` | Public | `200` | |
| `GET` | `/api/designs/subcategory/:subcategoryId` | Public | `200` | |
| `POST` / `PUT` / `DELETE` | `/api/designs` `/:id` | `role=admin` | `201` / `200` / `204` | |
| `POST` / `DELETE` | `/api/designs/:id/favorite` | Authenticated customer | `204` | |
| `GET` | `/api/designs/:id/sizes` | Public | `200` | |
| `GET` | `/api/categories`, `/:id`, `/:id/subcategories` | Public | `200` | |
| `POST` / `PUT` / `DELETE` | `/api/categories` `/:id` | `role=admin` | | |

### DTOs

```ts
export interface DesignDetailDto {
  id: string; name: string; description: string;
  previewImageUrl: string; galleryImageUrls: string[];
  vectorImageUrl?: string; vectorVideoUrl?: string;
  embroideryImageUrl?: string; embroideryVideoUrl?: string;
  autoSwapEnabled: boolean;
  categoryId: string; subcategoryIds: string[]; tags: string[];
  sizes: { id: string; label: string; widthMm: number; heightMm: number }[];
  stitchCount?: number; threadColorCount?: number; threadColorChanges?: number;
  pricePkr: number; salePricePkr?: number; discountBadge?: string;
  isFavorited: boolean;
  // No file_format, storage_path, file_url, or is_private fields — ever.
}
```

Required/validation rules for admin-write endpoints (name length, price ≥ 0, at least one size
entry, etc.) are defined in the implementation PR against this DTO shape.

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `design_categories`, `design_subcategories` *(new — referenced by FK in architecture DDL but never defined)* | proposed | `id`, `name`, `slug`, `parent_category_id` (nullable, for subcategories), `sort_order`, `is_published`, `created_at`, `updated_at` |
| `designs`, `design_sizes` | existing | per architecture DDL |
| `design_category_assignments` *(new)* | proposed | `design_id`, `category_id` — many-to-many join, since SRS Addendum §3 requires "one category **or** multiple categories" per design, but `designs.category_id` in the current DDL is a single FK; this join table supersedes that single-FK relationship |
| `favorites` *(new)* | proposed | `id`, `customer_id → users.id`, `design_id → designs.id`, `created_at`, unique `(customer_id, design_id)` — required by AC-8, not present in current schema |
| `designs.vector_image_url`, `.vector_video_url`, `.embroidery_image_url`, `.embroidery_video_url`, `.auto_swap_enabled` *(new columns)* | proposed | required for AC-5 dual-media swap; not in current DDL |

### Migration

- **Name:** `AddCatalogCategoriesAndMedia`
- **Reversible:** yes
- **Backfill required:** if `designs.category_id` already has data before this ships, backfill into
  `design_category_assignments` before dropping the single-FK column
- **Downtime:** none expected
- **Reviewed SQL:** author alongside implementation; must preserve the existing `idx_designs_category`
  and full-text search index behavior against the new join table

### Search index scope (2026-08-29 gap-audit note)

AC-6 requires header search to cover "Design Name, Category, Subcategory, Tags, Services, Blog,
FAQ and other indexed public content" (SRS §4). At the time this spec was first written, `Services`
and `Blog` had no owning entity; both gaps are now closed —
[Services spec](2026-08-29-17-services-module.md) (`services`, `service_categories`) and the
[Content & Knowledge Base spec](2026-08-28-10-content-knowledge-base.md) (`blog_posts`) — so the
unified search index (`idx_designs_name_search`-style full-text index, one per searchable entity,
merged at query time or via a shared search view) must include `designs`, `design_categories`,
`design_subcategories`, `services`, `service_categories`, `blog_posts`, and `faqs`. This spec keeps
ownership of the search **endpoint and UI** (AC-6); each content type's owning spec keeps
ownership of its own entity and publish/language rules that gate what is indexable.

### Retention and privacy

No new PII beyond `favorites.customer_id`, covered by the account-deletion policy tracked in the
master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | card-grid skeleton matching final card size; category nav remains interactive |
| **Empty** | category/subcategory with zero published designs shows "No designs in this category yet" |
| **Error** | search/filter failure shows retry with `traceId`; card grid does not disappear, prior results remain with an error banner |
| **Success** | grid populated; flip interaction, favorite toggle with optimistic UI + rollback on failure |

**Route(s):** `/`, `/services`, `/categories`, `/categories/:slug`, `/categories/:slug/:subSlug`,
`/designs`, `/designs/:id`, `/search`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | multi-category assignment logic, favorite toggle idempotency | `apps/api/designs/*.spec.ts` |
| **Integration** | category/subcategory CRUD, search relevance, pagination limits | `apps/api/test/integration/designs.spec.ts` |
| **Component** | card flip animation state, dual-media auto-swap timer + pause-on-interaction | `apps/web/design-card/*.spec.tsx` |
| **E2E** | browse → filter → flip card → favorite → add to cart | `e2e/catalog.e2e.spec.ts` |
| **Search relevance** | Elasticsearch-backed relevance tuning (synonym handling, typo tolerance, weighted fields) | `apps/api/test/integration/search-relevance.spec.ts` |
| **Security** | search response DTOs never contain private-file metadata or another customer's account/purchase data, even when the query text matches an internal-only field | `apps/api/test/integration/search-privacy.spec.ts` |

**Traceability:** AC-1…AC-13 map 1:1 to test files above by AC number in test titles.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — Elasticsearch relevance tuning is covered by the Search
relevance row above.

---

## 7. Out of scope

None — every item previously listed here (Elasticsearch integration, design recommendations,
video HLS streaming) has been folded into AC-10–AC-12 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `design_categories`/`design_subcategories` tables are required by every category-related SRS requirement but are absent from the architecture doc's DDL — must be authored before any catalog work starts | Engineering | Open |
| 2 | Whether a design can belong to a category with **no** subcategory, and how that renders in subcategory-only navigation | Admin | Open |
| 3 | Split/half-and-half Vector+Embroidery preview rendering approach (CSS clip vs. pre-composited asset) not specified | Engineering | Open |
| 4 | The unified search index now spans entities owned by three specs (this one, Services, Content & Knowledge Base) — a shared indexing/query mechanism (single Postgres view vs. per-entity queries merged in the API layer) needs to be agreed so the three owning teams don't each build an incompatible partial index | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — core browsing ships with Phase 1 MVP.
- **Migration order:** `design_categories`/`design_subcategories`/`design_category_assignments`
  ship before the catalog API goes live; `favorites` and dual-media columns can ship in the same or
  a follow-up migration.
- **Rollback:** standard image rollback; schema changes are additive and reversible pre-launch.
- **Observability:** track search-zero-result rate and category-page bounce rate as product signals;
  alert on catalog API p95 latency exceeding the 600ms TTFB target (architecture §Performance).
