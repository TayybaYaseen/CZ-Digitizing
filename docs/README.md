# CZ Digitizing — Documentation

This folder holds the implementation-ready specification set for the **CZ Digitizing** platform —
a multi-platform e-commerce and service-management system for machine embroidery designs,
digitizing services, and custom design requests, spanning a public website, a mobile app
(iOS/Android), and a protected Admin panel sharing one backend.

## Start here

| If you want to... | Go to |
|---|---|
| Understand a specific feature in full (requirements, API, data model, tests) | [`specs/`](specs/) — one file per feature, see index below |
| See the customer/Admin navigation flow and screen list | [`USER_FLOW.md`](USER_FLOW.md) |
| See how features depend on each other and what order to build them in | [`../SPEC_INDEX.md`](../SPEC_INDEX.md) |
| Understand the rules for keeping all of the above in sync | [`../CLAUDE.md`](../CLAUDE.md) |
| Read the original business requirements this all comes from | [`../CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md`](../CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md) |
| Read the original technical architecture this all comes from | [`../CZ_DIGITIZING_ARCHITECTURE.md`](../CZ_DIGITIZING_ARCHITECTURE.md) |
| See the blank template every spec below is written against | [`../TEMPLATE - SPEC.md`](../TEMPLATE%20-%20SPEC.md) |

Every file in `specs/` follows that template's structure: Problem statement → Acceptance criteria
(Given/When/Then) → API contract → Data model → UI states → Test plan → Out of scope → Risks &
open questions → Rollout. Each spec is self-contained but cross-references sibling specs rather
than duplicating their content — see each file's own **Related** line.

---

## Spec Index

**20 spec files** — 1 platform-level master spec + 19 feature specs. Listed in **recommended
implementation order** (dependency-validated — see [`../SPEC_INDEX.md`](../SPEC_INDEX.md) for the
full aspect-level dependency analysis behind this ordering). File numbers are stable identifiers,
not renumbered as specs are added; the table order reflects actual build sequence.

### Master

| Spec | Covers |
|---|---|
| [CZ Digitizing E-Commerce Platform](specs/2026-08-28-cz-digitizing-platform.md) | Platform-wide problem statement, cross-cutting acceptance criteria, shared API/DTO conventions, brand & visual identity, and the implementation-order index this README mirrors |

### Phase 0 — Foundation

| # | Spec | Covers |
|---|---|---|
| 01 | [Authentication & Account Security](specs/2026-08-28-01-auth-account-security.md) | Register/login, 2FA, new-device verification, forgot password, freelancer/limited-admin accounts, social login |
| 02 | [Notifications System](specs/2026-08-28-02-notifications-system.md) | The shared Admin + customer notification service every other spec's "notify" behavior calls into |
| 03 | [Admin Platform Settings, Dashboard, Live Preview, Data Export & Audit](specs/2026-08-28-03-admin-platform-settings.md) | Contact/social/payment/domain settings, Admin Dashboard, Live Website Preview, data exports, audit log |

### Phase 1 — Core commerce backbone

| # | Spec | Covers |
|---|---|---|
| 04 | [Design Catalog, Categories & Card Browsing](specs/2026-08-28-04-design-catalog-browsing.md) | Categories/subcategories, search, the front/back flip card, dual-media swap, favorites |
| 05 | [Private Embroidery File Management & Protection](specs/2026-08-28-05-private-file-management.md) | `.EMB` privacy, admin uploads, signed downloads, ZIP protection, allowed-format configuration |
| 06 | [Design Bundles](specs/2026-08-28-06-design-bundles.md) | Curated multi-design bundles and their purchase/file-authorization flow |
| 07 | [Shopping Cart & Checkout](specs/2026-08-28-07-shopping-cart-checkout.md) | Cart contents, credit application, saved-for-later, checkout hand-off |
| 08 | [Orders & Payment Processing](specs/2026-08-28-08-orders-payment-processing.md) | Order state machine, PayPal, Bank Transfer, Stripe, refunds, currency conversion |

### Phase 2 — Monetization extensions & service requests

| # | Spec | Covers |
|---|---|---|
| 09 | [Subscriptions & Credits](specs/2026-08-28-09-subscriptions-credits.md) | Plans, recurring credits, credit packages, the credit ledger, proration, gifting |
| 10 | [Content & Knowledge Base](specs/2026-08-28-10-content-knowledge-base.md) | FAQ, Tips for Embroiderers, Testimonials, Blog, About Us, Portfolio |
| 17 | [Services Module](specs/2026-08-29-17-services-module.md) | Embroidery Digitizing / Vector Art service pages and sub-categories |
| 11 | [Smart Get a Quote](specs/2026-08-28-11-smart-get-a-quote.md) | Guided service selection, instant Q&A, the quote submission form |
| 12 | [Custom Design Request System](specs/2026-08-28-12-custom-design-requests.md) | Custom digitizing/vector requests, production workflow, "Need Another Format?" |

### Phase 3 — Merchandising & aggregation

| # | Spec | Covers |
|---|---|---|
| 13 | [Home Page Sections & Advertisement/Offer Manager](specs/2026-08-28-13-home-promotions-cms.md) | Home sections, advertisements/offers, header media (with per-platform visibility & auto-slide) |
| 14 | [Customer Account & Purchase History](specs/2026-08-28-14-customer-account-history.md) | The aggregated "My Account" view, order/quote/request history, and the Activity Timeline |

### Phase 4 — Advanced / polish

| # | Spec | Covers |
|---|---|---|
| 15 | [Taebo Helping Panda (Chatbot)](specs/2026-08-28-15-taebo-chatbot.md) | The chatbot's anti-fabrication contract and Admin-escalation workflow |
| 16 | [Internationalization & Multi-Language Content](specs/2026-08-28-16-internationalization.md) | UI translation infrastructure and the 15-language rollout |
| 18 | [Mobile App (Android/iOS) & Cross-Platform Sync](specs/2026-08-29-18-mobile-app-android-ios.md) | The app shell/navigation and the contract keeping web and mobile state in sync |

### Phase 5 — Pre-launch hardening

| # | Spec | Covers |
|---|---|---|
| 19 | [Performance & Optimization](specs/2026-08-29-19-performance-optimization.md) | Core Web Vitals, image/asset optimization, caching/CDN, backups, and the pre-launch verification pass |

---

## How this doc set fits together

```text
CZ_DIGITIZING_ARCHITECTURE.md  +  CZ_Digitizing_Master_SRS...md   (source of truth)
                    ↓
              SPEC_INDEX.md   (dependency analysis: what depends on what, and in what order)
                    ↓
              docs/specs/*.md   (this folder: the 20 implementation-ready specs)
                    ↓
              docs/USER_FLOW.md   (the customer/Admin navigation flow derived from that order)
                    ↓
              CLAUDE.md   (the standing rules that keep all of the above from drifting apart)
```

If you're about to work on a feature: find it in the Spec Index above, open its file, check its
**Related** line and its owning phase here for what must exist first, then check
[`../SPEC_INDEX.md`](../SPEC_INDEX.md) for that aspect's current `Status` before starting.
