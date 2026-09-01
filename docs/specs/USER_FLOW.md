# User Flow — CZ Digitizing

**Derived from:** [`SPEC_INDEX.md`](SPEC_INDEX.md) (the dependency-validated Aspect
Registry), which is itself derived from the Aspect File —
[`CZ_DIGITIZING_ARCHITECTURE.md`](../../CZ_DIGITIZING_ARCHITECTURE.md) +
[`CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md`](../../CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md).
**Governing rules:** [`CLAUDE.md`](../CLAUDE.md) — parent aspects always precede dependents.
**Last synced against the Aspect Registry:** 2026-08-30

> This flow follows the validated dependency order (`SPEC_INDEX.md` § Recommended
> Implementation / UX Order), not either source document's own narrative order. Every screen below
> cites the Aspect ID that owns it and the feature spec (`docs/specs/*.md`) that defines its
> behavior in full — this file is the flow/navigation view; the specs remain the source of truth
> for acceptance criteria, API, and data model.

---

## 1. Customer User Flow

```text
Start (anonymous visitor)
        ↓
Header & Global Navigation  [A-003]                 (Brand & Visual System [A-001] applied throughout)
        ↓
Home  [A-018]
        ↓
        ├──▶ Design Categories → All Designs → Design Card (flip)  [A-006a → A-006b → A-006c]
        │            ↓
        │       Add to Cart  ──────────────────────────────────────────────┐
        │            │                                                     │
        │       Favorite  ⚠ requires Login/Register [A-002]                │
        │                                                                  │
        ├──▶ Services → Embroidery Digitizing / Vector Art  [A-014 → A-014a/b]
        │            ↓
        │       Get a Quote: Step 1 Select Service → Step 2 Instant Q&A → Step 3 Quote Form  [A-016 → A-016a → A-016b]
        │            ↓
        │       Quote submitted → Admin notified [A-004] → Admin responds → customer notified
        │
        ├──▶ Design Bundles  [A-008] ──▶ Add to Cart ────────────────────────┤
        │                                                                    │
        ├──▶ Content & Knowledge Base  [A-012]                               │
        │       FAQ · Tips for Embroiderers · Testimonials · Blog · About Us · Portfolio
        │       [A-012a] [A-012b] [A-012c] [A-012d] [A-012e] [A-012f]
        │            ↓
        │       Taebo chat widget  [A-020] (available on every page; escalates to Admin if unanswered)
        │
        ├──▶ Pricing  [A-015]
        │       Subscription Plans [A-015a]  ⇄  Buy Credits [A-015b]
        │            ↓
        │       Subscribe / Purchase Credits  ⚠ requires Login/Register [A-002]
        │
        ├──▶ Custom Design Request  [A-017]  ⚠ requires enough identity to track (Gmail/WhatsApp)
        │            ↓
        │       Workflow: New → Reviewing → Quote Sent → Approved → In Production → Ready → Delivered → Completed
        │       (Admin/customer notified [A-004] at every status change)
        │
        └──▶ Contact Us [A-010] · Footer & Social Buttons [A-009]  (support, available throughout)
        ↓
Cart  [A-011]  (review items, apply eligible Credits)
        ↓
Checkout  [A-013]  ⚠ Login/Register required here if not already authenticated [A-002]
        ↓
        ├──▶ PayPal  [A-013a] → automatic webhook confirmation
        └──▶ Bank Transfer  [A-013b] → upload receipt → Admin verifies → confirmed/rejected
        ↓
Order Confirmation  [A-013c]  →  Notification: order confirmed, payment received
        ↓
Private File Release  [A-007]  (only after payment_confirmed)
        ↓
Download authorized files  (every download logged; `.EMB` never served, ever)
        ↓
My Account  [A-019]
        Orders · Quotes · Custom Requests · Purchased Designs · Credits · Subscription
        ↓
Customer Activity Timeline  [A-019a]
        Viewed → Added to Cart → Removed/Purchased → Paid → Downloaded  (idempotent event log)
        ↓
Need a different file format later?  →  "Need Another File Format?"  [A-017a]  →  Admin fulfills  →  re-download
```

**Auth-gating points (⚠ above):** browsing the Catalog, Services, Content, and Pricing pages is
fully anonymous. Login/Register [A-002] is only forced at: Favoriting a design, Checkout,
subscribing/buying credits, and viewing My Account. This matches SRS §14 ("Customer and Admin
accounts must be completely separated") without forcing an artificial login wall on discovery.

---

## 2. Admin User Flow

Per SRS §31 ("Final Admin Workflow"), validated against the Aspect Registry — every module below
is reachable only after its own dependencies are met (`SPEC_INDEX.md` Levels 2–9):

```text
Admin Login (mandatory 2FA)  [A-002]
        ↓
Admin Dashboard  [A-005d]  (recent orders, revenue, top designs, recent customers, unread notifications)
        ↓
Manage Designs / Categories / Subcategories / Files  [A-006a, A-007]
        ↓
Manage Bundles  [A-008]
        ↓
Manage Services  [A-014]
        ↓
Manage Home Sections / Advertisements / Header Media  [A-018, A-018a, A-018b, A-018c]
        ↓
Manage Pricing: Subscription Plans / Credit Packages  [A-015, A-015a, A-015b]
        ↓
Manage Quotes & Quote Q&A  [A-016, A-016a]
        ↓
Manage Custom Requests & File Format Requests  [A-017, A-017a]
        ↓
Manage Orders / Payments / Receipts  [A-013, A-013a, A-013b, A-013c]
        ↓
Manage Content: Testimonials / Blog / Tips / FAQ / About / Portfolio  [A-012a–A-012f]
        ↓
Manage Languages / Translations  [A-021, A-022]
        ↓
Manage Social / Contact Settings, Experience, Domain, Payment Methods, Allowed File Formats  [A-005a, A-005b, A-005c]
        ↓
Manage Admin Users / Roles / Active Sessions (freelancer/limited-admin)  [A-005f]
        ↓
Data Exports (Customer_History, Orders, Payments, Downloads, Quotes, Custom_Requests, Notifications)  [A-005e]
        ↓
Live Website Preview  [A-005g]  ⚠ dependency scope Needs Review — see SPEC_INDEX.md § Dependency Issues
        ↓
Review Notifications  [A-004]
```

---

## 3. UI / Screen Flow

Every screen respects the dependency order — a screen never links forward to a screen whose Aspect
has a lower Order number than its own (that would mean linking into something not yet buildable).
Routes are taken from each owning feature spec's own §5 UI States "Route(s)" field, not invented
here.

### Customer-facing screens

| Screen | Route | Aspect | Parent Aspect | Main user action | Next screen |
|---|---|---|---|---|---|
| Home | `/` | A-018 | A-006 | Browse featured sections, active ad | Categories / Services / Bundles |
| Design Categories | `/categories`, `/categories/:slug` | A-006a | A-006 | Drill into a category/subcategory | All Designs |
| All Designs / Search Results | `/designs`, `/search` | A-006b | A-006 | Filter, search, paginate | Design Detail |
| Design Detail (flip card) | `/designs/:id` | A-006c | A-006 | Flip card, select size, Add to Cart, Favorite | Cart / Login |
| Design Bundles | `/bundles`, `/bundles/:id` | A-008 | A-006 | View included designs, Add to Cart | Cart |
| Services | `/services` | A-014 | A-006 | Pick Embroidery Digitizing or Vector Art | Service sub-category |
| Service Detail | `/services/embroidery-digitizing`, `/services/vector-art`, `/:subSlug` | A-014a / A-014b | A-014 | Read applications/process/FAQ | Get a Quote |
| Get a Quote | `/get-a-quote` | A-016 | A-014 | Select service → instant Q&A → submit form | Confirmation |
| Custom Design Request | `/custom-request` | A-017 | A-007 | Submit reference images + requirements | Status tracking |
| Pricing | `/pricing`, `/pricing/subscriptions`, `/pricing/credits` | A-015 | A-013 | Toggle plans/credits, subscribe/purchase | My Account |
| Cart | `/cart` | A-011 | A-006 | Review items, apply credits | Checkout |
| Checkout | `/checkout`, `/checkout/bank-transfer` | A-013 | A-011 | Choose PayPal or Bank Transfer | Order Confirmation |
| Order Confirmation | `/order-confirmation/:id` | A-013c | A-013 | View order number, next steps | My Account → Orders |
| Login / Register | `/login`, `/register` | A-002 | — | Authenticate | Wherever the login was triggered from |
| New-Device Verification | `/verify-device` | A-002 | — | Enter 4-digit code | Session established |
| Forgot / Reset Password | `/forgot-password`, `/reset-password` | A-002 | — | Verify email, set new password | Login |
| My Account | `/account` | A-019 | A-002 | View aggregated profile/orders/quotes/credits | Sub-tabs below |
| — Orders | `/account/orders` | A-019 | A-013 | View order history | Download files |
| — Quotes | `/account/quotes` | A-019 | A-016 | Track quote status | Convert to order |
| — Custom Requests | `/account/custom-requests` | A-019 | A-017 | Track production status | Download final files |
| — Purchased Designs | `/account/purchased-designs` | A-019 | A-007 | Download authorized files | — |
| — Credits | `/account/credits` | A-019 | A-015b | View balance, transaction history | Buy more credits |
| — Subscription | `/account/subscription` | A-019 | A-015a | View/cancel active plan | Pricing |
| — Activity | `/account/activity` | A-019a | A-019 | Review Viewed/Cart/Purchased/Paid/Downloaded timeline | — |
| — Notifications | `/account/notifications` | A-004 | A-002 | Mark read | — |
| FAQ | `/faq` | A-012a | A-012 | Search/filter by topic | Get a Quote / Taebo |
| Tips for Embroiderers | `/tips`, `/tips/:id` | A-012b | A-012 | Read articles | Linked FAQ |
| Testimonials | `/testimonials` | A-012c | A-012 | View More | — |
| Blog | `/blog`, `/blog/:slug` | A-012d | A-012 | Read post | Search results |
| About Us | `/about` | A-012e | A-012 | Read company info | Contact Us |
| Portfolio | `/portfolio`, `/portfolio/:id` | A-012f | A-012 | Browse work samples | Get a Quote |
| Contact Us | `/contact` | A-010 | A-005a | Submit contact form, open WhatsApp | — |
| Taebo widget | floating, all pages | A-020 | A-012a | Ask a question | Instant answer or escalate to Admin |

### Admin screens

| Screen | Route | Aspect | Parent Aspect | Main user action | Next screen |
|---|---|---|---|---|---|
| Admin Login | `/admin/login` | A-002 | — | Credentials + mandatory 2FA | Admin Dashboard |
| Admin Dashboard | `/admin/dashboard` | A-005d | A-005 | Review metrics, click into records | Any module below |
| Admin Designs / Files | `/admin/designs/:id/files` | A-007 | A-006 | Upload/replace embroidery files | Design list |
| Admin Bundles | `/admin/bundles` | A-008 | A-006 | Create/edit bundle | Bundle list |
| Admin Services | `/admin/services` | A-014 | A-006 | Edit service/sub-category content | Services list |
| Admin Home Sections | `/admin/home/sections` | A-018a | A-018 | Create/reorder sections | Home preview |
| Admin Advertisements | `/admin/home/advertisements` | A-018b | A-018 | Configure ad, dates, targeting | Home preview |
| Admin Header Media | `/admin/home/header-media` | A-018c | A-018 | Upload header image/video | Home preview |
| Admin Pricing | `/admin/pricing` | A-015a | A-015 | Edit subscription plans | Credits |
| Admin Credits | `/admin/credits` | A-015b | A-015 | Edit credit packages | Pricing |
| Admin Quotes | `/admin/quotes` | A-016 | A-014 | Respond to submitted quotes | Quote Q&A |
| Admin Quote Q&A | `/admin/quote-questions` | A-016a | A-016 | Manage Step-2 questions | Quotes |
| Admin Custom Requests | `/admin/custom-requests` | A-017 | A-007 | Move through production workflow | File Format Requests |
| Admin File Format Requests | `/admin/file-format-requests` | A-017a | A-017 | Fulfill format request | Order files |
| Admin Orders | `/admin/orders`, `/admin/orders/:id` | A-013 | A-011 | Confirm bank-transfer receipts, view status | Payments |
| Admin FAQ / Tips / Testimonials / Blog / About / Portfolio | `/admin/faq`, `/admin/tips`, `/admin/testimonials`, `/admin/blog`, `/admin/about`, `/admin/portfolio` | A-012a–f | A-012 | Create/edit/publish content | Public page reflects immediately |
| Admin Settings | `/admin/settings`, `/admin/settings/payment-methods`, `/admin/settings/file-formats` | A-005a/b/c | A-005 | Update contact, payment, allowed formats | Propagates site-wide |
| Admin Freelancer Accounts | `/admin/settings/freelancer-accounts` | A-005f | A-002 | Create scoped limited-admin account | Active Sessions |
| Admin Languages / Translations | `/admin/settings/languages`, `/admin/settings/translations` | A-021, A-022 | A-021 | Enable language, edit UI strings | Language selector live |
| Admin Exports | `/admin/exports` | A-005e | A-005 | Request named dataset export | Download file |
| Admin Audit Log | `/admin/audit-log` | A-005 | A-002 | Review admin action history | — |
| Admin Live Preview | `/admin/preview` | A-005g | A-005 | View current published public site | — |
| Admin Notifications | `/admin/notifications` | A-004 | A-002 | Mark read, review unread badge | Linked record |

---

## 4. Consistency notes

- This file, `SPEC_INDEX.md`, and every `docs/specs/*.md` feature spec must stay mutually
  consistent per [`CLAUDE.md`](../CLAUDE.md) §1. If the Aspect Registry's order changes, this file
  needs re-deriving from it — don't hand-edit the flow independently of the registry.
- Routes shown here are already defined in each owning spec's §5 "Route(s)" field; this file adds
  no new routes of its own, only sequences the existing ones into a navigable flow.
- Screens marked ⚠ in §1 are the only points where anonymous browsing is interrupted by a login
  requirement — everything else is intentionally open, per SRS §7–9's public-catalog design.
