# Spec: CZ Digitizing E-Commerce Platform (Website + Mobile App + Admin Panel)

**File:** `docs/specs/2026-08-28-cz-digitizing-platform.md`
**Status:** Draft
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [CZ_DIGITIZING_ARCHITECTURE.md](../../CZ_DIGITIZING_ARCHITECTURE.md), [CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md](../../CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md)

> This is a project-level master spec covering the CZ Digitizing platform end to end, consolidated
> from the approved Master SRS (business/UX requirements) and the Technical Architecture document
> (system design). It is scoped at the level of the whole product, not a single feature; individual
> features implemented later (e.g. "Taebo chatbot", "Subscriptions billing") may spin off their own
> child specs using this same template, linked back here under **Related**.

---

## Feature specs

The platform has been broken down into 16 feature-scoped specs, each independently implementable
and testable, each linking back to this master spec. File names are prefixed `01`–`16` in
**recommended implementation order** (see below) so the directory listing itself reflects build
sequence — this is a different ordering from the customer-facing journey, also given below.

### Recommended implementation order

Ordered by dependency: each phase assumes every earlier phase is functionally complete. Within a
phase, specs are largely independent of each other and can be built in parallel.

**Phase 0 — Foundation** (everything else depends on this existing first)

| # | Spec | Why it comes first |
|---|---|---|
| 01 | [Authentication & Account Security](2026-08-28-01-auth-account-security.md) | Every other feature needs to know who the caller is (`users`, `sessions`, RBAC) |
| 02 | [Notifications System](2026-08-28-02-notifications-system.md) | Nearly every later spec's acceptance criteria assume "Admin/customer is notified" — build the shared service once |
| 03 | [Admin Platform Settings, Data Export & Audit](2026-08-28-03-admin-platform-settings.md) | Seeds WhatsApp/social/payment-method config that Orders, Content, and Home CMS all read; hosts the audit log every admin write depends on |

**Phase 1 — Core commerce backbone**

| # | Spec | Why it's here |
|---|---|---|
| 04 | [Design Catalog, Categories & Card Browsing](2026-08-28-04-design-catalog-browsing.md) | The product to sell must exist before anything can be bundled, carted, or bought |
| 05 | [Private Embroidery File Management & Protection](2026-08-28-05-private-file-management.md) | Attaches to `designs` from #04; the `.EMB`/download-authorization contract must be solid before Orders can release files against it |
| 06 | [Design Bundles](2026-08-28-06-design-bundles.md) | Composes designs from #04 into a second sellable item type |
| 07 | [Shopping Cart & Checkout](2026-08-28-07-shopping-cart-checkout.md) | Needs #04/#06 to have something to add to cart |
| 08 | [Orders & Payment Processing](2026-08-28-08-orders-payment-processing.md) | Consumes the cart from #07, releases files via #05, uses payment config from #03, fires notifications via #02 |

**Phase 2 — Monetization extensions & service requests**

| # | Spec | Why it's here |
|---|---|---|
| 09 | [Subscriptions & Credits](2026-08-28-09-subscriptions-credits.md) | Builds on the payment infrastructure from #08; credits then feed back into Cart's credit-application step |
| 10 | [Content & Knowledge Base](2026-08-28-10-content-knowledge-base.md) | FAQ/Tips/Testimonials/Blog/About/Portfolio are largely standalone, but must exist before Get a Quote's Q&A step, Taebo, and the Home page can reference them |
| 17 | [Services Module](2026-08-29-17-services-module.md) | Public service-listing content; Smart Get a Quote's Step 1 (service selection) assumes these service/category records already exist |
| 11 | [Smart Get a Quote](2026-08-28-11-smart-get-a-quote.md) | Uses Notifications (#02), the Q&A pattern established alongside #10, and the service catalog from #17 |
| 12 | [Custom Design Request System](2026-08-28-12-custom-design-requests.md) | Final file delivery reuses the private-file pipeline from #05; loosely tied to #08 for payment |

**Phase 3 — Merchandising & aggregation**

| # | Spec | Why it's here |
|---|---|---|
| 13 | [Home Page Sections & Advertisement/Offer Manager](2026-08-28-13-home-promotions-cms.md) | Needs designs (#04) and testimonials (#10) to have something to feature |
| 14 | [Customer Account & Purchase History](2026-08-28-14-customer-account-history.md) | Pure aggregation over #01/#08/#09/#11/#12 — cannot be meaningfully built before those exist; also owns the cross-feature Activity Timeline (view/cart/purchase/pay/download events) added 2026-08-29 |

**Phase 4 — Advanced / polish**

| # | Spec | Why it's here |
|---|---|---|
| 15 | [Taebo Helping Panda (Chatbot)](2026-08-28-15-taebo-chatbot.md) | Only as good as the FAQ content from #10; escalation depends on #02 |
| 16 | [Internationalization & Multi-Language Content](2026-08-28-16-internationalization.md) | A layer over every UI surface built in #01–#15; cheapest to retrofit last, though the i18next mechanism itself can be scaffolded as early as #04 if the team prefers to build translation-ready from day one |
| 18 | [Mobile App (Android/iOS) & Cross-Platform Sync](2026-08-29-18-mobile-app-android-ios.md) | A client shell over the same shared backend every other spec already defines; cannot be meaningfully built until the API surface it wraps is stable |

**Phase 5 — Pre-launch hardening**

| # | Spec | Why it's here |
|---|---|---|
| 19 | [Performance & Optimization](2026-08-29-19-performance-optimization.md) | Consolidates the performance requirements scattered as notes across every other spec into one verification pass; matches architecture's own Phase 5 "Polish & Launch" (performance optimization, load testing, production deployment) |

This grouping lines up with the Phase 1–5 roadmap in
[CZ_DIGITIZING_ARCHITECTURE.md § Appendix: Implementation Roadmap](../../CZ_DIGITIZING_ARCHITECTURE.md#appendix-implementation-roadmap):
Phase 0–1 above ≈ architecture's Phase 1 (MVP), Phase 2 above ≈ architecture's Phase 2–3
(Services/Quotes, Subscriptions/Credits), Phase 3–4 above ≈ architecture's Phase 4 (Advanced
Features), Phase 5 above ≈ architecture's Phase 5 (Polish & Launch).

> **2026-08-29 gap-audit note:** specs #17–#19 were added after a full audit against the Master
> SRS/Architecture found three feature areas with no existing owner (Services, Mobile App +
> cross-platform sync, Performance). Their file numbers are higher than neighboring specs they
> logically precede (e.g. #17 Services precedes #11 Get a Quote) because existing spec numbers are
> never renumbered once assigned — the table row order above reflects actual build sequence; the
> `#` column reflects file-creation order. See each spec's own header for what changed and why.

### Customer/Admin workflow order (for reference)

This is the order a **user** experiences the product, per SRS §30–31's Final User Journey /
Final Admin Workflow — useful for UX walkthroughs and demos, not for sequencing engineering work,
since several early-experience features (Home CMS, Taebo) depend on later-built infrastructure:

**Discover → Evaluate → Purchase:**
[Home Page Sections & Advertisement/Offer Manager](2026-08-28-13-home-promotions-cms.md) →
[Design Catalog, Categories & Card Browsing](2026-08-28-04-design-catalog-browsing.md) →
[Design Bundles](2026-08-28-06-design-bundles.md) →
[Shopping Cart & Checkout](2026-08-28-07-shopping-cart-checkout.md) →
[Orders & Payment Processing](2026-08-28-08-orders-payment-processing.md) →
[Private Embroidery File Management & Protection](2026-08-28-05-private-file-management.md)
(download)

**Service path (parallel to Discover/Evaluate):**
[Smart Get a Quote](2026-08-28-11-smart-get-a-quote.md) →
[Custom Design Request System](2026-08-28-12-custom-design-requests.md)

**Ongoing value:**
[Subscriptions & Credits](2026-08-28-09-subscriptions-credits.md) →
[Customer Account & Purchase History](2026-08-28-14-customer-account-history.md)

**Support, throughout:**
[Content & Knowledge Base](2026-08-28-10-content-knowledge-base.md) →
[Taebo Helping Panda (Chatbot)](2026-08-28-15-taebo-chatbot.md)

**Cross-cutting, present on every screen:**
[Authentication & Account Security](2026-08-28-01-auth-account-security.md) ·
[Notifications System](2026-08-28-02-notifications-system.md) ·
[Internationalization & Multi-Language Content](2026-08-28-16-internationalization.md)

**Admin's own workflow** (SRS §31): Login (#01, with mandatory 2FA) → Dashboard (#02
notifications) → manage Designs/Categories/Bundles/Services (#04/#06) → manage Home Sections/Ads
(#13) → manage Pricing/Credits/Subscriptions (#09) → manage Quotes & Orders (#11/#08) → manage
Testimonials/Blog/FAQ (#10) → manage Languages (#16) → manage Social/Contact Settings (#03) →
review Notifications (#02).

---

## 1. Problem statement

**Today:** CZ Digitizing sells machine-embroidery digitizing, vector art conversion, and pre-made
designs entirely through manual channels (WhatsApp +92 317 4604508 and email
czdigitizing@gmail.com). There is no online catalog, no self-serve checkout, no customer account
history, no automated quoting, and no controlled delivery mechanism for the private embroidery
source files (DST/PES/JEF/EXP/VP3) that customers pay for. Every price change, new design, FAQ
answer, or promotional offer currently requires manual, ad-hoc communication rather than a managed
content system.

**Who is affected:** International customers (embroidery hobbyists and small businesses) who want
to browse and buy designs, purchase bundles/subscriptions/credits, or request custom
digitizing/vector work with a predictable process; and the Admin, who currently absorbs all quoting,
file delivery, and payment verification manually with no dashboard, no notification system, and no
audit trail.

**Why it matters now:** The business has no scalable revenue channel (no cart/checkout), no
protection against private-file leakage (embroidery files, especially the always-private `.EMB`
format, must never reach a customer who hasn't paid), no multilingual reach (15 target languages),
and Admin time is consumed answering the same quote questions repeatedly instead of using a Smart
Get-a-Quote flow with instant answers.

**Success looks like:** A customer can discover a design, buy it (or a bundle, subscription, or
credit package), or submit a guided quote/custom request, and — once payment is confirmed — download
exactly the private files they are authorized for; Admin can manage every piece of routine content
(designs, pricing, ads, FAQs, social links, languages) from a protected Admin Panel without any code
change or deploy.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a published design in a category **When** a customer opens the category or "All Designs" page **Then** the design card renders with preview image, name, category tag, favorite icon, price/sale price, and an Add to Cart button, and clicking/tapping the card flips it to show sizes, stitch count, thread/color info, description, and tags |
| AC-2 | **Given** a home-page section with more than 6 published designs **When** the section renders **Then** exactly 6 cards show initially with a "View More" control; **given** 6 or fewer designs, **then** "View More" is hidden |
| AC-3 | **Given** an active Admin-configured advertisement (start date ≤ now ≤ end date, status active) **When** a customer loads the home page **Then** the ad section renders with countdown, heading/subheading, and CTA; **given** no active advertisement, **then** the ad section is omitted entirely (no empty placeholder) |
| AC-4 | **Given** a customer with items in the cart **When** they complete checkout via PayPal or Bank Transfer **Then** an order is created in `pending`/`payment_pending` state, an order confirmation notification is sent (email/WhatsApp/in-app), and the cart is cleared |
| AC-5 | **Given** a PayPal payment capture webhook confirms success, or an Admin manually confirms a bank-transfer receipt **When** the order transitions to `payment_confirmed` **Then** the authorized private files become downloadable to that customer only, and the customer receives a "files ready" notification |
| AC-6 | **Given** a design has an uploaded `.EMB` file **When** any customer (authenticated, paid, or not) requests that design's files or a ZIP of that design **Then** the `.EMB` file is never returned, never listed, and never included in the ZIP, regardless of payment status |
| AC-7 | **Given** a customer downloads an authorized file **When** the download completes **Then** a record is written to `customer_authorized_files` (download count, first/last download timestamp) and the response never exposes the real storage path or filename structure |
| AC-8 | **Given** an unauthenticated or unauthorized user **When** they call `GET /api/orders/:id/files` for an order that is not theirs, or is not yet `payment_confirmed` **Then** the API returns `403` and no file data or signed URL is returned |
| AC-9 | **Given** a customer submits the Get-a-Quote form (service, size, quantity, fabric, deadline, etc.) **When** the submission succeeds **Then** a `quotes` record is created with status `new`, the customer receives a confirmation notification, and Admin receives a notification — **but** merely opening an FAQ answer in Step 2 does **not** notify Admin |
| AC-10 | **Given** a customer submits a Custom Design Request with the minimum required fields (image/logo, size, machine format) **When** it is created **Then** the request enters the `new` state of the workflow (`new → reviewing → quote_sent → approved → in_production → ready → delivered → completed`, with `need_more_info`, `revision_required`, `cancelled` as side states), and both Admin and customer receive the appropriate notifications on every status change |
| AC-11 | **Given** a user logs in from a browser/device that has never completed verification for their account **When** credentials are valid **Then** the system requires a 4-digit verification code sent to the registered email before issuing a session, and it notifies the customer's existing trusted sessions of the new-device login |
| AC-12 | **Given** a logged-in user requests "Forgot Password" **When** they confirm their registered email and enter the 4-digit code (10-minute expiry, rate-limited to 3 attempts / 15 minutes) **Then** they may set a new password and all existing sessions for that account are invalidated |
| AC-13 | **Given** Admin edits a design's price, publishes a new FAQ, or updates the WhatsApp/social-link settings **When** the change is saved **Then** the corresponding public page(s) reflect the new value without any code deployment, and the change is written to `audit_logs` with the admin user id and a diff of the change |
| AC-14 | **Given** a non-admin (customer) session **When** it requests any `/api/admin/*` route or the Admin Panel UI **Then** the API returns `403`/the UI redirects, and the attempt is recorded in the audit/security log |
| AC-15 | **Given** a customer's browser language or manual language selection is one of the 15 supported languages **When** they navigate the public site **Then** UI labels, navigation, cart, checkout, account, and FAQ content render in that language (falling back to English for any untranslated string), and the language choice persists across the session |
| AC-16 | **Given** Admin requests a data export (e.g. Orders, Customer_History, Downloads) for a filtered date range or "all" **When** the export completes **Then** a separately named file per dataset is produced and no other customer's private file storage paths are exposed in the export |
| AC-17 | **Given** the Taebo chatbot receives a question with no approved FAQ/knowledge-base match **When** it responds **Then** it does not fabricate an answer; instead it marks the question "Waiting for Admin", notifies Admin, and once Admin answers, notifies the customer and offers "Save as FAQ" |
| AC-18 | **Given** a customer checks out with a credit or debit card **When** Stripe processes the charge (3D Secure where required) and confirms the payment **Then** the order transitions to `payment_confirmed` the same way PayPal/Bank Transfer do, files release, and the customer is notified |
| AC-19 | **Given** a client needs a GraphQL surface instead of REST **When** it queries/mutates through the GraphQL schema (`design`, `designs`, `searchDesigns`, `order`, `myOrders`, `cart`, `currentUser`, `createOrder`, `addToCart`, `submitQuote`, `submitCustomRequest`, `uploadDesign`, `orderStatusChanged`, `customRequestUpdated`) **Then** it receives the same data/behavior as the equivalent REST endpoint, since GraphQL is a thin projection over the same services, not a second source of truth |
| AC-20 | **Given** catalog/FAQ search volume or query complexity exceeds what Postgres full-text search handles well **When** Elasticsearch is enabled as the search backend **Then** design/FAQ search results are served from it with equivalent or better relevance, through the same public search API contract |
| AC-21 | **Given** Admin grants a `freelancer` or `moderator` role to a user **When** that user authenticates **Then** they receive the scoped permissions defined for that role (freelancer: custom-request creation/upload/payment-tracking; moderator: content approval, support-ticket handling, basic analytics access) rather than full Admin or plain Customer access |
| AC-22 | **Given** the platform is deployed to production **When** traffic/scale requires it **Then** the system runs on the Kubernetes manifests and multi-AZ topology defined in architecture §Deployment Architecture (Namespace, Deployment with 3–10 replicas, Service, HorizontalPodAutoscaler), not just a single-environment deployment |
| AC-23 | **Given** Admin populates FAQ/tip/design-description content in each of the 15 supported languages **When** a customer selects that language **Then** the fully translated content renders, not just the English-fallback UI chrome |
| AC-24 | **Given** the same backend/API/data model that powers the website **When** the React Native/Expo mobile app is built against it **Then** customers can browse, buy, get quotes, and manage their account on iOS/Android with full feature parity to the website — this is the platform-level statement of the requirement; the itemized per-feature contract and the cross-platform sync guarantee are owned by the [Mobile App spec](2026-08-29-18-mobile-app-android-ios.md) (AC-1–AC-16), not restated here |
| AC-25 | **Given** a specific NLP/LLM technology is selected to power Taebo's question matching **When** it is integrated **Then** it satisfies the behavioral contract fixed in AC-17 (never fabricate, escalate to Admin) regardless of which underlying model/library is chosen |

### Brand & Visual acceptance criteria (2026-08-29 traceability fix)

The qualitative Brand & Visual Identity table in §5 previously had no AC-numbered traceability.
These convert the same, already-existing requirements — nothing new — into testable form; §5's
table remains the source of the verification method for each, so it is referenced rather than
repeated here.

| # | Criterion |
|---|---|
| AC-26 | **Given** the CZ Digitizing logo asset **When** rendered anywhere across web, mobile, and Admin **Then** it is the single approved logo file (moon-shaped "C", metallic/silver "Z", needle-and-thread detail, "MACHINE EMBROIDERY DESIGN" subtitle), never a substitute or ad-hoc variant, at every size — verified per §5's Brand & visual identity table |
| AC-27 | **Given** any public or Admin page **When** rendered **Then** it uses only the approved color palette (Deep Navy/Black backgrounds, White/Silver/Light-Gray typography, controlled Gold accents), with no off-palette colors introduced per-feature — verified per §5 |
| AC-28 | **Given** any UI text across web, mobile, and Admin **When** rendered **Then** it uses one consistent, shared typography system, not a mixed or per-page-specific type scale — verified per §5 |
| AC-29 | **Given** any imagery used on a service/design/marketing page **When** published **Then** it is realistic embroidery photography, stitch close-ups, or genuine product imagery (shirts/polos/caps/jackets/patches/machines), never generic stock photography or "AI-looking" visuals — verified per §5 |
| AC-30 | **Given** any UI animation or transition **When** triggered **Then** it is limited to the approved motion vocabulary (fade, slide, hover, card flip, smooth transition), with no additional effect types introduced without a spec update — verified per §5 |
| AC-31 | **Given** any UI component (button, card, icon) across web, mobile, and Admin **When** rendered **Then** it is drawn from the one shared component library referenced in §5's Frontend module layout, not a page-specific one-off implementation — verified per §5 |

Each acceptance criterion must be traceable to at least one test in §6, and the pull request
implementing it must show that test passing.

---

## 3. API contract

> The full endpoint inventory (grouped by resource) is authored in
> [CZ_DIGITIZING_ARCHITECTURE.md § API Architecture](../../CZ_DIGITIZING_ARCHITECTURE.md#api-architecture)
> and is the source of truth for exact routes. This section restates the contract rules that apply
> across all of them and must be agreed before any route is implemented. REST is primary; the
> GraphQL schema in the architecture doc is an optional alternative surface, not a second source of
> truth — it must be a thin projection over the same services.

### Resource groups and auth policy

| Resource group | Representative routes | Auth policy | Notes |
|---|---|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/verify-2fa`, `/forgot-password`, `/reset-password`, `/verify-new-device` | Public (rate-limited) | Issues JWT access token (15 min) + refresh token (7 day); new-device flow required per AC-11 |
| Designs / Categories / Bundles | `GET /api/designs`, `/api/designs/:id`, `/api/categories`, `/api/bundles` (reads public); `POST/PUT/DELETE` variants | Read: public. Write: `role=admin` | `.EMB` files never appear in any response body for these resources |
| Cart / Orders | `GET/POST /api/cart/*`, `POST /api/orders`, `GET /api/orders/:id/files` | Authenticated customer for own resources; `role=admin` for `/api/orders` (list) and status changes | File-download route enforces AC-8 |
| Quotes / Custom Requests | `POST /api/quotes`, `POST /api/custom-requests`, admin variants | Public submit (customer identity captured in payload); admin routes `role=admin` | Notification side-effects per AC-9/AC-10 |
| Subscriptions / Credits | `GET /api/subscriptions/plans`, `POST /api/subscriptions/subscribe`, `GET /api/credits/balance` | Authenticated customer; plan/package CRUD `role=admin` | |
| FAQs / Testimonials / Taebo | `GET /api/faqs`, `POST /api/taebo/chat` | Read: public. Write: `role=admin` | Taebo must only draw from `is_published` + `taebo_visible` FAQ rows |
| Admin dashboard / settings / notifications / exports | `/api/admin/**` | `role=admin`, IP allowlist + mandatory 2FA per architecture §Authentication & Security | |

### Request and response conventions

```ts
// Shared response envelope (all endpoints)
export interface ApiResponse<T> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  code: string;          // SCREAMING_SNAKE_CASE, stable forever
  message: string;       // human-readable
  errors?: { field: string; message: string }[];
  traceId: string;
}

// Example: design summary never includes private file metadata
export interface DesignSummaryDto {
  id: string;
  name: string;
  previewImageUrl: string;
  categoryId: string;
  subcategoryId?: string;
  pricePkr: number;
  salePricePkr?: number;
  stitchCount?: number;
  threadColorCount?: number;
  isFavorited?: boolean;
  // storage_path, upload_hash, file_url, is_private are SERVER-ONLY fields
  // and must never be serialized onto any customer-facing DTO.
}
```

State which fields are required, their validation rules, max lengths, and formats per resource
in the child spec for that resource; this master spec fixes the rule that private file fields
(`storage_path`, `file_url`, `upload_hash`, `is_private`) are excluded from every customer-facing
DTO by construction (mapped, not filtered at serialization time).

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | request failed validation; `errors[]` lists the field failures |
| `401` | `UNAUTHENTICATED` | missing/expired/invalid access token |
| `401` | `NEW_DEVICE_VERIFICATION_REQUIRED` | valid credentials from an unrecognized device; 4-digit code sent |
| `403` | `FORBIDDEN` | authenticated but not authorized for this resource/role |
| `404` | `RESOURCE_NOT_FOUND` | the resource does not exist or is not visible to this caller |
| `409` | `CONFLICT` | optimistic concurrency mismatch, or duplicate submission |
| `422` | `FILE_FORMAT_BLOCKED` | an upload or delivery attempt would expose a `.EMB` file to a non-admin |
| `422` | `PAYMENT_NOT_CONFIRMED` | file/download requested before `order.payment_status = completed` |
| `429` | `RATE_LIMITED` | request exceeded the applicable rate limit (§ Authentication & Security) |

New codes are `SCREAMING_SNAKE_CASE`, stable forever, and listed here before they are used.

### Breaking-change check

- [ ] No existing field removed, renamed, or narrowed in type
- [ ] No existing status code or `code` value changed
- [ ] If any box above is unchecked, this needs a new API version (`/api/v2/...`) — record the
      decision and reasoning in §8 before you build

---

## 4. Data model changes

### Entities

The full column-level DDL is authored in
[CZ_DIGITIZING_ARCHITECTURE.md § Database Schema](../../CZ_DIGITIZING_ARCHITECTURE.md#database-schema)
and is the source of truth; this table summarizes the entities and the rule this spec adds on top
of that DDL.

| Entity | Purpose | Key relationships / rules |
|---|---|---|
| `users` | Customer, admin, freelancer, moderator accounts | `role` enum drives RBAC; `two_factor_enabled` mandatory for admin |
| `sessions` | Device/session tracking | Drives new-device verification (AC-11) and 30-day inactivity auto-logout |
| `designs`, `design_files`, `design_sizes` | Catalog + private file records | `design_files.file_format = 'EMB'` **must** carry `is_private = true` at all times — enforced by DB constraint `emb_never_public`, not just application logic |
| `design_bundles`, `bundle_designs` | Curated design bundles | many-to-many via join table, `sort_order` for display |
| `orders`, `order_items` | Purchases | `order_status` state machine per §Payment Processing; `order_items` requires exactly one of `design_id`/`bundle_id` |
| `customer_authorized_files` | Download authorization + audit | Written only after `payment_confirmed`; every download increments `download_count` |
| `custom_requests` | Custom digitizing/vector requests | Status enum matches AC-10 workflow exactly |
| `quotes` | Get-a-Quote submissions | `status` distinguishes `new` (submitted) from FAQ-only interactions, which are never persisted here |
| `subscription_plans`, `customer_subscriptions` | Recurring plans | `is_best_value` flag drives pricing-page highlight |
| `credit_packages`, `customer_credits`, `credit_transactions` | Credit purchase/usage ledger | `credit_transactions` is append-only; balance is derived/cached in `customer_credits` |
| `faqs`, `embroiderer_tips`, `testimonials` | CMS content | `language_code` per row; `taebo_visible` gates chatbot use |
| `notifications` | Admin + customer notification center | `is_read`, `expires_at`, 30-day retention per architecture §Notifications |
| `audit_logs` | Admin action trail | Written on every admin write (AC-13), never customer-writable |

### Migration

- **Name:** `InitialSchema`
- **Reversible:** yes — this is a greenfield schema; the down-migration drops all tables listed above
- **Backfill required:** no — no pre-existing production data to migrate
- **Downtime:** none expected (new system, no live traffic yet)
- **Reviewed SQL:** see `CZ_DIGITIZING_ARCHITECTURE.md § Database Schema` for the full `CREATE TABLE`
  statements to be reviewed and applied as the initial migration; the CHECK constraint
  `emb_never_public` on `design_files` and the `CHECK` on `order_items` (exactly one of
  design/bundle) must not be dropped or weakened in any later migration without a new spec.

### Retention and privacy

Yes — this system stores personal data: name, email, WhatsApp number, country, IP address, device
fingerprint, order/payment history, uploaded reference images, and chat/support history. Retention
periods and deletion mechanics (e.g. "delete on account closure", "anonymize after N years",
GDPR/PECA-style data-subject requests) are **not specified** in the source SRS/architecture and are
tracked as an open question in §8 — this spec must not move to Approved until that question is
closed.

---

## 5. UI states

> Stack note: the source architecture specifies **Next.js/React + Tailwind + shadcn/ui** for the
> public website and **React Native/Expo** for the mobile app (not Angular/PrimeNG). Every screen
> below still ships all four states — a missing empty or error state is an incomplete feature, not
> a follow-up ticket.

Representative example — **All Designs / Category catalog page** (the highest-traffic screen):

| State | Behaviour |
|---|---|
| **Loading** | skeleton card grid (not a spinner) matching the final card dimensions; filters disabled; no layout shift on resolve |
| **Empty** | "No designs found for this filter/category yet" with a control to clear filters or return to Home; never a bare blank grid |
| **Error** | human-readable message derived from the response `code` (e.g. network vs. `RATE_LIMITED`), a retry action, and the `traceId` shown in a collapsible detail for support |
| **Success** | populated card grid; Add to Cart shows a toast/confirmation; destructive actions (e.g. remove from favorites) are not silent |

The same four-state rule applies to: Cart, Checkout, My Account (Orders/Quotes/Custom
Requests/Purchased Designs), Get-a-Quote, Admin Designs list, Admin Orders list, and every other
data-backed screen in the page list below.

Also specify per screen when implemented: validation timing (on blur vs. on submit), keyboard and
screen-reader behaviour (WCAG 2.1 AA per architecture §References & Standards), responsive
behaviour at desktop/tablet/mobile breakpoints (no horizontal overflow, hamburger nav below the
tablet breakpoint), and what an unauthenticated/unauthorized user sees for gated actions (Admin
controls and private-file metadata are never present in the DOM for customer sessions — hidden, not
just disabled, since disabled-but-present would still leak structure).

**Route(s):** full public page list — Home, Services (+ per-service detail), Design Categories (+
subcategories), All Designs, Design Detail (flip-card), Design Bundles, Pricing (Subscriptions /
Credits toggle), Get a Quote, Contact Us, About Us, Portfolio, Blog, Testimonials, Tips for
Embroiderers, FAQ, Search Results, Cart, Checkout, Login/Register, My Account (Orders, Quotes,
Purchased Designs, Credits, Subscription). Admin routes live under `/admin/*` and are never linked
from public navigation.

**Frontend module layout:** Next.js App Router (`apps/web`), React Native/Expo (`apps/mobile`),
Admin dashboard as its own protected app or route group (`apps/web/admin` or `apps/admin`) sharing
the same API client and generated types.

### Brand & visual identity (2026-08-29 gap-audit addition)

No existing spec owned the platform's brand/visual-identity requirements (SRS §2, §28 Brand &
Website Visual References). They are added here, to the one section every other spec's UI states
already point back to, rather than as a new file — brand identity is a cross-cutting visual
constraint on every screen already defined in this spec set, not a separate feature with its own
acceptance criteria/API/data model. Per the SRS, this is deliberately kept as testable-through-QA
guidance rather than invented numeric design tokens the source material never specified:

| Element | Requirement | Verification |
|---|---|---|
| Logo | The approved CZ Digitizing logo (moon-shaped "C", metallic/silver "Z", needle-and-thread detail, "MACHINE EMBROIDERY DESIGN" subtitle) is the single source of truth for brand identity and must render crisply and recognizably at every size used across web, mobile, and Admin | Visual QA checklist against the approved logo reference (SRS Appendix, Pages 18–19) at each breakpoint |
| Color palette | Deep Navy/Black backgrounds with White/Silver/Light-Gray typography and controlled Gold accents, consistently applied — no ad-hoc off-palette colors introduced per-feature | Visual QA checklist against the approved Brand Kit reference (SRS Appendix, Page 19) |
| Typography | One consistent, premium typography system across all UI, not mixed per page/feature | Visual QA checklist; a shared design-token/typography-scale file used by every frontend module in §5's Frontend module layout |
| Imagery | Realistic embroidery photography and stitch close-ups; shirts/polos/caps/jackets/patches/embroidery-machine visuals where relevant — never generic stock imagery or "AI-looking" visuals (explicit SRS constraint) | Visual QA checklist per page/feature at content-authoring time, not a system-enforced rule |
| Motion | Elegant, restrained animation only — fade, slide, hover, card flip, smooth transitions; explicitly *not* excessive effects | Visual QA checklist; component-level animation review as part of each feature's own UI-state test pass (§6 in each feature spec) |
| Consistency | Every UI component (buttons, cards, icons) follows one shared design system across web, mobile, and Admin | Enforced structurally by the shared `apps/web`/`apps/mobile`/Admin module sharing one component library, not by a separate brand-compliance test suite |

This table is deliberately qualitative where the SRS is qualitative (e.g. "premium," "realistic,"
"elegant") — inventing arbitrary pixel/hex/millisecond values the source material never specified
would misrepresent the requirement, not clarify it. Where a feature spec needs a concrete value
(e.g. the 2-second dual-media auto-swap in the Catalog spec's AC-5), that value is already defined
in that spec, not here.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | domain invariants (order state machine, `.EMB` privacy rule, credit ledger math), validators, mappers/DTO exclusion of private fields | `apps/api/**/*.spec.ts` (Jest) |
| **Integration** | endpoint round trip, persistence (Postgres via test container), auth policy, download authorization, error-code mapping | `apps/api/test/integration` (Jest + Supertest) |
| **Migration/DB constraints** | `emb_never_public` and `order_items` CHECK constraints actually reject bad inserts | `apps/api/test/integration/db-constraints.spec.ts` |
| **Component** | React component states (loading/empty/error/success), form validation, card flip interaction | `apps/web/**` (React Testing Library + Vitest/Jest) |
| **E2E** | the critical journeys: browse → cart → checkout → payment-confirmed → download; submit quote → admin notified → respond; admin content edit reflects publicly | `e2e/` (Playwright) |
| **Performance** | LCP/FID/CLS budgets and p50/p95/p99 API latency against the thresholds in architecture §Performance & Optimization | `e2e/performance/` (Lighthouse CI) + `apps/api/test/load` (k6) |
| **Visual QA** | logo/color-palette/typography/imagery/motion/component-consistency checklist (AC-26–AC-31) | `e2e/brand-visual-qa.spec.ts` (visual regression snapshots) + manual design review |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `design-card.component.spec.tsx` — renders front/back fields |
| AC-2 | `home-section.spec.tsx` — 6-item cap and View More toggle |
| AC-3 | `advertisement.spec.tsx` + `ads.integration.spec.ts` — active/expired/absent states |
| AC-4, AC-5 | `checkout.e2e.spec.ts`, `orders.integration.spec.ts` |
| AC-6, AC-7 | `db-constraints.spec.ts`, `file-download.integration.spec.ts` |
| AC-8 | `file-download.integration.spec.ts` — unauthorized/unpaid cases |
| AC-9, AC-10 | `quotes.integration.spec.ts`, `custom-requests.integration.spec.ts` |
| AC-11, AC-12 | `auth.integration.spec.ts` — new-device + forgot-password flows |
| AC-13, AC-14 | `admin-audit.integration.spec.ts`, `admin-rbac.integration.spec.ts` |
| AC-15 | `i18n.spec.tsx` |
| AC-16 | `exports.integration.spec.ts` |
| AC-17 | `taebo.integration.spec.ts` |
| AC-18 | `stripe-payments.integration.spec.ts` |
| AC-19 | `graphql.integration.spec.ts` |
| AC-20 | `search-relevance.integration.spec.ts` |
| AC-21 | `admin-rbac.integration.spec.ts` (freelancer/moderator cases) |
| AC-22 | `e2e/performance/` load and scale-out verification |
| AC-23 | `i18n.spec.tsx` (full-content cases) |
| AC-24 | `apps/mobile/e2e` — detailed contract owned by [Mobile App spec](2026-08-29-18-mobile-app-android-ios.md) AC-1–AC-16; this AC is the platform-level headline, that spec is the source of truth for the itemized behavior |
| AC-25 | `taebo.integration.spec.ts` (model-agnostic contract cases) |
| AC-26–AC-31 | `e2e/brand-visual-qa.spec.ts` (visual QA checklist automation) |

**Coverage:** ≥80% on new code (proposed default; confirm as part of §8 before Approved).

**Not covered, deliberately:** None — every previously deferred test type is now covered by the
Performance row above and by the traceability rows for AC-18–AC-25.

---

## 7. Out of scope

None — every item previously listed here has been folded into the acceptance criteria above
(AC-18–AC-25) and, where a dedicated feature spec owns the detail, into that spec's own scope.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Data retention/deletion policy for PII, audit logs, and session/device data is not specified anywhere in the source SRS or architecture doc | Admin (Muhammad Suleman Yaseen) | Open |
| 2 | Framework choice not finalized: architecture lists Express.js **or** NestJS, Prisma **or** TypeORM, as either/or options | Engineering | Open |
| 3 | Hosting target not finalized: AWS EC2/ECS vs. DigitalOcean vs. Vercel listed as alternatives | Admin / Engineering | Open |
| 4 | `.EMB` privacy is enforced by file-extension check at upload; a renamed file (e.g. `.emb` saved as `.dst`) could bypass extension-based detection — needs content/magic-byte validation, not just extension, to fully satisfy AC-6 | Engineering | Open |
| 5 | Currency conversion provider (OpenExchangeRates vs. Fixer.io) and refresh cadence (hourly, per architecture) not contractually confirmed | Admin | Open |
| 6 | WhatsApp notifications via Twilio are bound by the 24–48 hour customer-initiated messaging window — some Admin-triggered notifications (e.g. daily order-status batch) may silently fail to deliver outside that window and need a fallback (email) | Engineering | Open |
| 7 | Malware/content scanning provider for uploaded reference images and receipt uploads is unspecified | Engineering | Open |
| 8 | Freelancer/limited-admin account permission model ("module/category permissions, read-only/CRUD limitations") is described narratively in the SRS addendum but has no concrete permission schema yet | Admin / Engineering | Open |

Every open question must be closed before this spec moves to **Approved**.

---

## 9. Rollout

- **Feature flag:** none — this is a greenfield launch. Sub-features may ship behind flags per
  their own child spec (e.g. Taebo, Subscriptions) but the base catalog/cart/checkout/admin
  platform ships as a whole per the Phase 1 MVP scope in
  [CZ_DIGITIZING_ARCHITECTURE.md § Appendix: Implementation Roadmap](../../CZ_DIGITIZING_ARCHITECTURE.md#appendix-implementation-roadmap).
- **Migration order:** schema (`InitialSchema`) ships before any application code that depends on
  it; every subsequent migration follows the same rule for its own spec.
- **Rollback:** redeploy the previous container image via the CI/CD pipeline
  (`kubectl rollout undo` once on Kubernetes, or redeploy prior image tag on the initial
  simpler hosting target); schema migrations must ship with a tested down-migration so a rollback
  never leaves the database ahead of the running code.
- **Observability:** Prometheus + Grafana for p50/p95/p99 response time and error-rate alerts
  (>1%), CPU/memory/DB-connection/Redis-memory/disk-space alerts, and ELK/Datadog for log
  aggregation, per architecture §Performance & Optimization. At minimum for launch: an alert on
  order-payment-confirmation failures and on any `.EMB` file being served to a non-admin request
  (this should be a hard invariant violation, alerted as a security incident, not a soft error).
