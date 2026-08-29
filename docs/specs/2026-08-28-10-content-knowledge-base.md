# Spec: Content & Knowledge Base (FAQ, Tips for Embroiderers, Testimonials, Blog, About Us, Portfolio)

**File:** `docs/specs/2026-08-28-10-content-knowledge-base.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Taebo chatbot spec](2026-08-28-15-taebo-chatbot.md), [Design catalog spec](2026-08-28-04-design-catalog-browsing.md), SRS §16–17 / §29 / Addendum §8, architecture §Database Schema / §API Architecture

> **2026-08-29 gap-audit update:** Blog, About Us, and Portfolio were named in the SRS More Menu
> (§16) and Final Public Page List (§29) but had no owning spec. They are the same shape of
> problem this spec already solves — Admin-authored public content with publish/unpublish and
> (where applicable) language scoping — so they are added here rather than fragmented into three
> new files. Everything below §2 that predates this update is unchanged; new content is additive.

---

## 1. Problem statement

**Today:** There is no self-serve knowledge base. Customers cannot find answers to common questions
(pricing, formats, downloads) without contacting Admin directly, there is no embroidery-education
content to build trust/authority, there are no real customer testimonials displayed anywhere, and
three more named public pages — Blog, About Us, and Portfolio — have no Admin-managed content
system at all, despite being in the site's main navigation (SRS §16 More Menu).

**Who is affected:** Customers seeking answers before buying/asking, or wanting to read blog
content, learn about the business, or see portfolio work before buying/asking; Admin, who needs to
publish and maintain all of this content without engineering help; Taebo (separate spec), which
consumes `taebo_visible` FAQ entries as its only source of truth.

**Why it matters now:** FAQ is described as a "complete website-wide knowledge base" spanning every
functional area of the site, and it is the data source Taebo is contractually forbidden to deviate
from — so its structure and publishing workflow must be solid before Taebo can be built correctly.
Blog, About Us, and Portfolio are each explicitly listed in the SRS's public page list (§29) and
More Menu (§16); without an owning spec, none of them can be implemented as more than a hardcoded
page requiring a code deploy for every content change — which contradicts the platform's core
"no code deploy for routine content" principle (SRS §32).

**Success looks like:** Admin publishes/edits FAQ entries (scoped to page/service/category/topic),
embroidery Tips articles, real testimonials, blog posts, the About Us page, and Portfolio items;
customers browse/search all of them; Taebo and the FAQ page draw from the exact same published,
language-specific content.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin creates an FAQ with question, answer, topic, related page/service/category, language, priority, and `taebo_visible` **When** published **Then** it appears on the public FAQ page under its topic and, if `taebo_visible=true`, becomes eligible for Taebo to surface |
| AC-2 | **Given** the FAQ page **When** a customer searches or filters by topic **Then** results match across question/answer/topic text, respecting `language_code` and `is_published` |
| AC-3 | **Given** Admin creates a Tips for Embroiderers article (title, content, category, language) **When** published **Then** it appears on the Tips page and can be linked from relevant FAQ entries |
| AC-4 | **Given** a real customer testimonial (name, country, optional business/photo, rating 1–5, feedback, service used) is added by Admin **When** published **Then** it appears on the Home page (max 6 initially, with View More) and on a dedicated Testimonials page |
| AC-5 | **Given** testimonial content **When** authored **Then** no fabricated customer name, country, or review is ever entered — this is a content-governance rule enforced by process, not by the system, and must be visible as a warning in the Admin testimonial-creation UI |
| AC-6 | **Given** Admin archives, reorders, or unpublishes an FAQ/Tip/testimonial **When** saved **Then** it immediately reflects on all public surfaces (FAQ page, Home, Testimonials page, and — for FAQ — Taebo) with no deploy |
| AC-7 | **Given** a customer who purchased a design/service **When** they submit a review with a rating and feedback **Then** it is stored pending Admin moderation and, once approved, displays alongside Admin-curated testimonials |
| AC-8 | **Given** a customer viewing an FAQ answer **When** they click "Was this helpful?" (Yes/No) **Then** the response is recorded against that FAQ entry and aggregated helpfulness is visible to Admin for content-quality triage |
| AC-9 | **Given** Admin creates a blog post (title, slug, cover image, body content, category, language, publish date) **When** published **Then** it appears on the public Blog listing (newest first) and at its own detail URL, and is hidden again if Admin unpublishes it |
| AC-10 | **Given** the public Blog listing **When** a customer browses or filters by category **Then** only `is_published=true` posts for the customer's resolved language (with English fallback per the Internationalization spec) are shown |
| AC-11 | **Given** Admin edits the single About Us content record (heading, body content, images, language variants) **When** saved **Then** the saved content becomes the active public content immediately with no deploy and no separate publish step — this is an intentional design decision (§4), not an omission: unlike FAQ/Tips/Testimonials/Blog/Portfolio, which are lists of individually publishable items, About Us is one static page with no SRS requirement for a draft/unpublished state, so `about_content` deliberately has no `is_published` field |
| AC-12 | **Given** Admin creates a Portfolio item (title, description, image(s)/media, category, sort order) **When** published **Then** it appears on the public Portfolio listing in Admin-defined order, and in a detail view if the item has more than a single image |
| AC-13 | **Given** Admin reorders, hides, or deletes a Portfolio item **When** saved **Then** the public Portfolio page reflects the change immediately with no deploy |
| AC-14 | **Given** a customer uses header search (per the Design Catalog spec's AC-6) **When** they search **Then** results also include matching Blog post titles/content, consistent with that spec's search index scope; About Us and Portfolio are not part of the searchable index (they are single/low-cardinality pages reachable directly from navigation) |
| AC-15 | **Given** Admin edits an existing blog post's fields (title, cover image, body, category, language) **When** saved **Then** the updated content is reflected on the public listing and detail page (if published) immediately with no deploy, and `updated_at` changes — the same in-place-edit contract as AC-6 already guarantees for FAQ/Tip/testimonial edits |
| AC-16 | **Given** Admin deletes a blog post **When** the deletion is confirmed **Then** it is permanently removed and no longer appears in the public listing/detail or the Admin blog list — a hard delete, consistent with the `DELETE` semantics already used by every other route in this spec's §3 API contract; the architecture does not specify soft-delete for any content type here, so none is invented for Blog specifically |
| AC-17 | **Given** a Portfolio item's `title`/`description` **When** rendered to a customer in any selected language **Then** the text displays exactly as Admin entered it (no per-language variant, no translation fallback needed since there is only one variant), while the page's navigation/labels/buttons around it still render in the customer's selected language via the Internationalization spec's UI-chrome layer — this is an intentional design decision (§4), not a missing feature |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/faqs` | Public | `200` | filterable by `topic`, `language_code` |
| `GET` | `/api/faqs/search?q=` | Public | `200` | |
| `POST` / `PUT` / `DELETE` | `/api/faqs` `/:id` | `role=admin` | | |
| `GET` | `/api/tips` *(new, proposed)* | Public | `200` `PagedResponse<TipDto>` | not present in architecture's endpoint list, required by SRS §16 |
| `GET` | `/api/tips/:id` *(new, proposed)* | Public | `200` | |
| `POST` / `PUT` / `DELETE` | `/api/tips` `/:id` *(new, proposed)* | `role=admin` | | |
| `GET` | `/api/testimonials` | Public | `200` | |
| `POST` / `PUT` / `DELETE` | `/api/testimonials` `/:id` | `role=admin` | | |
| `GET` | `/api/blog` *(new, proposed)* | Public | `200` `PagedResponse<BlogPostSummaryDto>` | filterable by `category`, `language_code` — AC-10 |
| `GET` | `/api/blog/:slug` *(new, proposed)* | Public | `200` `BlogPostDto` | |
| `POST` / `PUT` / `DELETE` | `/api/blog` `/:id` *(new, proposed)* | `role=admin` | | AC-9 |
| `GET` | `/api/about` *(new, proposed)* | Public | `200` `AboutContentDto` | AC-11 |
| `PUT` | `/api/admin/about` *(new, proposed)* | `role=admin` | `200` | AC-11 |
| `GET` | `/api/portfolio` *(new, proposed)* | Public | `200` `PagedResponse<PortfolioItemDto>` | ordered, published only — AC-12 |
| `GET` | `/api/portfolio/:id` *(new, proposed)* | Public | `200` `PortfolioItemDto` | |
| `POST` / `PUT` / `DELETE` | `/api/portfolio` `/:id` *(new, proposed)* | `role=admin` | | AC-12/AC-13 |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `faqs`, `embroiderer_tips`, `testimonials` | existing | per architecture DDL; no schema change proposed |
| `tip_faq_links` *(new, proposed)* | proposed | `tip_id`, `faq_id` — join table for "Tips can be … linked to FAQ" (SRS Addendum §8); not modeled today |
| `blog_posts` *(new, proposed)* | proposed | `id`, `title`, `slug` (unique), `cover_image_url`, `body`, `category`, `language_code`, `is_published`, `published_at`, `created_at`, `updated_at`, `created_by_admin_id` — required by AC-9/AC-10, absent from architecture DDL |
| `about_content` *(new, proposed)* | proposed | single-row-per-language table: `language_code` (PK), `heading`, `body`, `image_urls` (array/JSONB), `updated_at`, `updated_by_admin_id` — required by AC-11. **Deliberately no `is_published` column**: the SRS names About Us only as a nav/page-list entry (§16, §29) with no publish/unpublish requirement anywhere, unlike FAQ/Testimonials which explicitly say "Admin can add, edit, **publish/unpublish** and delete." Treated as a single always-live static page by design (2026-08-29), not left ambiguous — see AC-11 |
| `portfolio_items` *(new, proposed)* | proposed | `id`, `title`, `description`, `media_urls` (array/JSONB), `category`, `sort_order`, `is_published`, `created_at`, `updated_at`, `created_by_admin_id` — required by AC-12/AC-13. **Deliberately no `language_code` column**: Portfolio is visual-first content (the media *is* the content) rather than explanatory text, the same treatment already given to `testimonials` in this same table, which also has no `language_code`. Text fields (`title`, `description`) display as Admin entered them regardless of the customer's selected language; only the surrounding page chrome (nav, labels, buttons) is translated, per the Internationalization spec's UI-chrome layer (2026-08-29 design decision, see §8) |

### Migration

- **Name:** `AddTipFaqLinks` + `AddBlogAboutPortfolio`
- **Reversible:** yes
- **Backfill required:** yes for `about_content` — seed one row for the default language (`en`)
  with placeholder content so the public About page never renders empty before Admin fills it in
- **Downtime:** none
- **Reviewed SQL:** to be authored; `faqs`/`embroiderer_tips`/`testimonials` DDL is already reviewed
  in the master spec's `InitialSchema`

### Retention and privacy

Testimonials contain a real customer's name/country/photo/feedback — this is the one entity in the
system where the data is *intentionally* public-facing PII; Admin must have consent from the
customer to publish it (a process control, not a system control) and a mechanism to remove one on
request (already covered by the existing delete/unpublish action). Blog posts, About content, and
Portfolio items are Admin-authored (not customer PII) and carry no additional privacy concern.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | FAQ/Tips list skeleton; Testimonials carousel skeleton |
| **Empty** | topic with zero FAQs shows "No questions in this topic yet" with a link to Contact/Get a Quote; zero testimonials hides the section entirely on Home (no empty placeholder) |
| **Error** | search failure shows retry with `traceId` |
| **Success** | FAQ accordion/list; Tips article list/detail; Testimonials carousel/grid with View More; Blog listing/detail; About page; Portfolio grid/detail |

**Route(s):** `/faq`, `/tips`, `/tips/:id`, `/testimonials`, `/blog`, `/blog/:slug`, `/about`,
`/portfolio`, `/portfolio/:id`, `/admin/faq`, `/admin/tips`, `/admin/testimonials`,
`/admin/blog`, `/admin/about`, `/admin/portfolio`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | topic/language filtering logic, `taebo_visible` gating | `apps/api/content/*.spec.ts` |
| **Integration** | FAQ/Tips/Testimonial CRUD, publish/unpublish propagation, search | `apps/api/test/integration/content.spec.ts` |
| **E2E** | browse FAQ by topic → search → open Tips article linked from an FAQ → view testimonials with View More | `e2e/content.e2e.spec.ts` |
| **Component** | rich-text/WYSIWYG editor for Tips content authoring (formatting, embedded images) | `apps/web/admin/tips-editor.spec.tsx` |
| **Integration** | Blog CRUD (create, **edit reflects on listing/detail**, **hard delete removes from both**) + publish propagation; About content edit reflects immediately (always-live, no publish step); Portfolio CRUD + reorder + language-neutral rendering | `apps/api/test/integration/blog-about-portfolio.spec.ts` |
| **E2E** | publish a blog post → appears in listing and search → edit it → change reflects → delete it → gone from listing; edit About → public page updates with no publish step; reorder Portfolio items → public order matches; switch language → Portfolio text unchanged, page chrome translated | `e2e/blog-about-portfolio.e2e.spec.ts` |

**Traceability:** AC-1…AC-17 → `content.integration.spec.ts` / `content.e2e.spec.ts` /
`blog-about-portfolio.spec.ts` (AC-9–AC-17).

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — the Tips rich-text/WYSIWYG editor is covered by the
additional Component row above.

---

## 7. Out of scope

None — every item previously listed here (customer-submitted reviews/ratings, FAQ voting) has
been folded into AC-7/AC-8 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `/api/tips*` routes are required by the SRS but absent from the architecture doc's endpoint inventory | Engineering | Open |
| 2 | Process for verifying testimonial authenticity/consent before publish is not defined | Admin | Open |
| 3 | ~~Whether About Us needs full per-language content or a single language with translated UI chrome only~~ — **Resolved 2026-08-29**: `about_content` stays keyed by `language_code` (full per-language content, consistent with FAQ/Tips), and is deliberately always-live with no publish/unpublish state (see AC-11 and the `about_content` entity note in §4) | Admin | Resolved |
| 4 | Blog author attribution (single Admin vs. named author profiles) is not specified — this spec assumes `created_by_admin_id` is sufficient and there is no public "author" concept | Admin | Open |
| 5 | ~~Whether Portfolio needs per-language content~~ — **Resolved 2026-08-29**: no, by design — Portfolio is visual-first content, treated the same as `testimonials` (also no `language_code`); see AC-17 and the `portfolio_items` entity note in §4 | Admin | Resolved |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** existing tables from `InitialSchema`; `tip_faq_links` is additive;
  `blog_posts`/`portfolio_items`/`about_content` (with its seeded default row) ship before the
  Blog/Portfolio/About admin UIs and public pages are enabled.
- **Rollback:** standard image rollback.
- **Observability:** track FAQ search-zero-result queries as a content-gap signal for Admin; track
  Blog post view counts and Portfolio item click-through as content-engagement signals.
