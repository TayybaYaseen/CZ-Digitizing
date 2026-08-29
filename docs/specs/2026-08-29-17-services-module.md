# Spec: Services Module (Embroidery Digitizing & Vector Art)

**File:** `docs/specs/2026-08-29-17-services-module.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Smart Get a Quote spec](2026-08-28-11-smart-get-a-quote.md), [Content & Knowledge Base spec](2026-08-28-10-content-knowledge-base.md), [Design catalog spec](2026-08-28-04-design-catalog-browsing.md), SRS §6

> **Why this is a new spec, not an update to an existing one (2026-08-29 gap-audit):** SRS §6
> defines a full public Services module — two main services, nine Embroidery Digitizing
> sub-categories, nine Vector Art sub-categories, each needing its own visuals/explanation/
> applications/process/FAQs/CTA — that no existing spec owns. The [Smart Get a Quote
> spec](2026-08-28-11-smart-get-a-quote.md) owns the *interactive* quote flow (Step 1 assumes a
> service already exists to select), not the descriptive marketing content of what each service
> *is*. The [Content & Knowledge Base spec](2026-08-28-10-content-knowledge-base.md) owns
> general-purpose CMS content (FAQ/Tips/Testimonials/Blog/About/Portfolio) but treating Services as
> another "content type" there would conflate a structured, hierarchical commercial catalog
> (services → sub-categories, each linked to pricing/quote flows) with flat public content pages —
> folding it in would make that spec conceptually overloaded, which is exactly the condition under
> which the audit's own rules call for a new file. This spec owns the content; Smart Get a Quote
> keeps owning the interaction, linked via a shared `service_type`/`service_category` vocabulary.

---

## 1. Problem statement

**Today:** There is no Services page content system. The Smart Get a Quote spec assumes a customer
can "select a service," but nothing defines what services exist, what their sub-categories are,
what each one looks like, or how a customer learns about a service before deciding to request a
quote or browse pre-made designs for it.

**Who is affected:** Prospective customers evaluating whether CZ Digitizing offers the specific
service they need (e.g. "3D Puff Digitizing," "Logo Cleanup") before committing to a quote request;
Admin, who needs to describe and merchandise each service without a code deploy.

**Why it matters now:** Services is the entry point into both major commercial paths — buying a
pre-made design (Catalog spec) and requesting custom work (Smart Get a Quote / Custom Design
Requests specs) — and it is explicitly named in the SRS's public page list (§29: "Services",
"Embroidery Digitizing Service Details", "Vector Art Service Details") with no current owner.

**Success looks like:** A customer visits Services, understands the two main offerings
(Embroidery Digitizing, Vector Art), drills into a specific sub-category (e.g. Cap & Hat
Digitizing), sees realistic visuals, applications, and process information, reads service-specific
FAQs, and has a clear path to either browse related pre-made designs or submit a Get a Quote
request pre-scoped to that exact service.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the public Services page **When** a customer visits it **Then** it lists the two main services — Embroidery Digitizing and Vector Art — each with its own visual, short explanation, and a link to its detail page |
| AC-2 | **Given** the Embroidery Digitizing detail page **When** rendered **Then** it lists its sub-categories (Logo Digitizing, Cap & Hat Digitizing, 3D Puff Digitizing, Left Chest Digitizing, Jacket Back Digitizing, Patch & Badge Digitizing, Appliqué Digitizing, Image-to-Embroidery, **Monogram & Lettering** — see terminology note below), each with its own visual and short explanation |
| AC-3 | **Given** the Vector Art detail page **When** rendered **Then** it lists its sub-categories (Raster-to-Vector Conversion, Logo Redrawing, Logo Cleanup, Hand-Drawn Artwork, Image Redraw, Color Separation, Print-Ready Artwork, Vector Logo Conversion, Artwork Editing), each with its own visual and short explanation |
| AC-4 | **Given** any service or sub-service card **When** rendered **Then** it uses realistic, service-specific visuals and original CZ Digitizing wording — never generic stock imagery — consistent with the Brand & Visual Identity requirements in the master spec §5 |
| AC-5 | **Given** a service or sub-service detail page **When** a customer scrolls past the explanation **Then** they see an Applications section (example real-world use cases) and a Process section (how CZ Digitizing delivers that service) |
| AC-6 | **Given** a service or sub-service detail page **When** rendered **Then** it shows service-specific FAQs, sourced from `faqs` entries whose `related_service`/`related_category` matches this service (owned by the Content & Knowledge Base spec; this spec only queries, never duplicates FAQ content) |
| AC-7 | **Given** a service or sub-service detail page **When** a customer wants pricing or custom work **Then** a prominent "Get a Quote" CTA opens the Smart Get a Quote flow with Step 1's service selection pre-filled to this exact service |
| AC-8 | **Given** Admin manages Services from the private panel **When** they add, edit, reorder, publish, or unpublish a service or sub-service **Then** the public Services pages reflect the change immediately with no code deploy |
| AC-9 | **Given** a service/sub-service's `service_type`/`service_category` value **When** the Smart Get a Quote spec's Step 2 loads Admin-curated questions for that same service **Then** the two features resolve to the same service identity (shared vocabulary), even though each spec owns its own table |
| AC-10 | **Given** a service or sub-service detail page **When** a customer wants pre-made options instead of custom work **Then** it links to the matching category/subcategory in the Design Catalog spec where one exists (e.g. "Cap & Hat Digitizing" service links to the "Cap Embroidery" design category) |
| AC-11 | **Given** a customer clicks "Get a Quote" on a service/sub-service page (AC-7) **When** the Smart Get a Quote flow loads **Then** all quote calculation, pricing logic, and `quotes` record creation happen entirely inside the Smart Get a Quote spec's own API/business logic — this spec provides only the entry-point link and pre-selected service value, and implements no quote-calculation or pricing logic of its own |
| AC-12 | **Given** a service/sub-service detail page's FAQ section (AC-6) **When** Admin edits, publishes, reorders, or deletes the underlying FAQ content **Then** that action happens entirely inside the Content & Knowledge Base spec's own Admin UI/API — this spec has no FAQ authoring interface of its own |

### Requirement-by-requirement traceability (2026-08-29, fourth-pass fix)

Every individual Services requirement named in the Master SRS/gap review, verified one at a time
rather than asserted in aggregate:

| Requirement | Covered by | Notes |
|---|---|---|
| Embroidery Digitizing (main service) | AC-1 | |
| Vector Art (main service) | AC-1 | |
| Logo Digitizing (sub-category) | AC-2 | |
| Cap/Hat (sub-category) | AC-2 | listed as "Cap & Hat Digitizing" per architecture's exact wording |
| Left Chest (sub-category) | AC-2 | listed as "Left Chest Digitizing" |
| Jacket Back (sub-category) | AC-2 | listed as "Jacket Back Digitizing" |
| 3D Puff (sub-category) | AC-2 | listed as "3D Puff Digitizing" |
| Appliqué (sub-category) | AC-2 | listed as "Appliqué Digitizing" |
| Patches (sub-category) | AC-2 | listed as "Patch & Badge Digitizing" |
| Small Lettering (sub-category) | AC-2 + Terminology note below | mapped to "Monogram & Lettering," the source material's actual name — see note |
| Image-to-Embroidery (sub-category) | AC-2 | |
| Service visuals | AC-4 | `visual_image_url` per service/sub-service |
| Service explanation | AC-1/AC-2/AC-3 | `description` field |
| Applications | AC-5 | `applications` field |
| Process information | AC-5 | `process` field |
| Service FAQs | AC-6 | queried from Content & Knowledge Base's `faqs`, not duplicated |
| Get a Quote CTA | AC-7, AC-11 | link + explicit non-duplication of quote logic |

### Terminology note: "Small Lettering" (2026-08-29, third-pass fix)

A prior gap-audit pass referred to a sub-category named "Small Lettering." That exact phrase does
not appear anywhere in `CZ_DIGITIZING_ARCHITECTURE.md` or the Master SRS — the source material's
Embroidery Digitizing category list (reproduced verbatim in AC-2) names **"Monogram & Lettering"**
instead. Monogramming and small-lettering embroidery are the same real-world technique (small-scale
text/initials embroidery), so "Monogram & Lettering" is treated as the authoritative name for this
sub-category and is what AC-2 and the seed data (§4 Migration) use. No separate "Small Lettering"
service is created — that would invent a service not present in the source architecture. If a
future requirement genuinely needs "Small Lettering" as a *distinct* sub-category from "Monogram &
Lettering" (e.g. monogram = initials, small lettering = arbitrary short text), that is a scope
decision for Admin, not an assumption this spec makes on its own.

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/services` | Public | `200` `ServiceSummaryDto[]` | the two main services, each with nested sub-categories — AC-1 |
| `GET` | `/api/services/:slug` | Public | `200` `ServiceDetailDto` | AC-2/AC-3/AC-5/AC-6 |
| `POST` / `PUT` / `DELETE` | `/api/services` `/:id` | `role=admin` | `201` / `200` / `204` | AC-8 |
| `PUT` | `/api/admin/services/:id/reorder` | `role=admin` | `200` | |

### DTOs

```ts
export interface ServiceDetailDto {
  id: string; name: string; slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  parentServiceId?: string;          // set for sub-categories, null for the two main services
  description: string;
  visualImageUrl: string;
  applications: string;              // rich text
  process: string;                   // rich text
  relatedFaqIds: string[];           // resolved from Content & Knowledge Base's faqs.related_service
  relatedDesignCategoryId?: string;  // AC-10, resolves to the Catalog spec's design_categories
  subServices?: ServiceSummaryDto[]; // populated only for the two main services
}
```

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `services` *(new, proposed)* | proposed | `id`, `name`, `slug` (unique), `parent_service_id → services.id` (nullable — null for the two main services, set for sub-categories), `type` enum(`embroidery_digitizing`,`vector_art`), `description`, `visual_image_url`, `applications`, `process`, `related_design_category_id → design_categories.id` (nullable, AC-10), `sort_order`, `is_published`, `created_at`, `updated_at`, `created_by_admin_id` |

`faqs.related_service`/`related_category` (existing columns on the Content & Knowledge Base spec's
`faqs` table) are matched against `services.name`/`slug` at query time (AC-6) — no new FK is added
to `faqs` to avoid two specs owning writes to the same column.

### Migration

- **Name:** `AddServices`
- **Reversible:** yes
- **Backfill required:** yes — seed the two main services and their 18 combined sub-categories from
  SRS §6 so the Services pages are never empty at launch
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

No PII. Public content only.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | service-card grid skeleton on the Services page; detail-page skeleton for visual/explanation/applications/process/FAQ sections |
| **Empty** | not expected in production (seeded at launch, per Migration above); if a sub-category is unpublished, it is simply omitted from its parent's list, not shown as an empty slot |
| **Error** | retry with `traceId`, consistent with the Catalog spec's pattern |
| **Success** | service/sub-service cards; detail page with Applications/Process/FAQ sections and a prominent Get a Quote CTA |

**Route(s):** `/services`, `/services/embroidery-digitizing`,
`/services/embroidery-digitizing/:subSlug`, `/services/vector-art`,
`/services/vector-art/:subSlug`, `/admin/services`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | service/sub-service hierarchy validation (a sub-category must have a parent of the same `type`), FAQ-matching resolution | `apps/api/services/*.spec.ts` |
| **Integration** | Services CRUD, reorder, publish/unpublish propagation, FAQ/design-category linkage resolution | `apps/api/test/integration/services.spec.ts` |
| **E2E** | browse Services → open a sub-category → see visuals/applications/process/FAQs → click Get a Quote → Step 1 pre-selected | `e2e/services.e2e.spec.ts` |

**Traceability:** AC-1…AC-12 → `services.integration.spec.ts` / `services.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** service-specific dynamic pricing calculators — pricing remains
Admin-set per quote response, owned entirely by the Smart Get a Quote spec.

---

## 7. Out of scope

- Per-service inventory/stock tracking (services are not stock-limited).
- Customer reviews scoped specifically to a service (general testimonials already cover
  `service_used`, owned by the Content & Knowledge Base spec).

### Not covered, deliberately (2026-08-29, fourth-pass addition)

These are not gaps — each is functionality this spec deliberately does not own, because an
existing spec already owns it (verified by inspection, not assumed) or it is explicitly outside
this feature's boundary. Where this spec touches the boundary at all, the interaction is fixed by
an AC above (AC-11, AC-12); where it has no touchpoint at all (Auth, Notifications, Orders/Payment
below), no boundary AC is invented, since there is no observable behavior of this spec to test.

| Requirement / area | Not covered here because | Owner |
|---|---|---|
| Quote calculation / pricing logic | Services only links to Get a Quote (AC-7, AC-11); it computes no price and creates no `quotes` record itself | [Smart Get a Quote spec](2026-08-28-11-smart-get-a-quote.md) |
| Custom Design Request production workflow | Services has no direct handoff to custom requests (only to Get a Quote); a customer reaching a custom request does so via that spec's own flow | [Custom Design Request spec](2026-08-28-12-custom-design-requests.md) |
| FAQ authoring / knowledge-base management | Services only queries published FAQ rows by `related_service` (AC-6, AC-12); it has no FAQ create/edit/publish UI | [Content & Knowledge Base spec](2026-08-28-10-content-knowledge-base.md) |
| Customer authentication / account identity | Services has no login, session, or account-specific logic — every route in §3 is either public-read or `role=admin` per the shared policy | [Auth & Account Security spec](2026-08-28-01-auth-account-security.md) |
| Notifications | Publishing/editing a service triggers no customer or Admin notification of its own | [Notifications spec](2026-08-28-02-notifications-system.md) |
| Orders / payment processing | Services never creates an order or processes a payment — that only happens after a customer leaves this spec's flow via Get a Quote or the Catalog link (AC-10) | [Orders & Payment Processing spec](2026-08-28-08-orders-payment-processing.md) |
| Design catalog data (price, stitch count, etc.) | AC-10 links to a `design_categories` row; Services does not read or duplicate individual design records | [Design Catalog spec](2026-08-28-04-design-catalog-browsing.md) |

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The shared `service_type`/`service_category` vocabulary between this spec and the Smart Get a Quote spec's `quote_questions`/`quotes` tables is a naming convention, not a foreign key — a rename in one place could silently break matching in the other; needs a shared constant/enum source before implementation | Engineering | Open |
| 2 | Whether every sub-category must link to a Design Catalog category (AC-10), or linking is optional per sub-category, is not specified | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — Phase 2 per the master spec's implementation order (alongside Content &
  Knowledge Base and ahead of Smart Get a Quote, which depends on it).
- **Migration order:** `services` (seeded) ships before the public Services pages and before Smart
  Get a Quote's Step 1 service-selection UI is enabled.
- **Rollback:** standard image rollback; safe to drop pre-launch.
- **Observability:** track Services-to-Get-a-Quote click-through rate per service/sub-category as a
  demand signal for which services to promote.
