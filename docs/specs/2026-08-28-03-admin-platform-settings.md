# Spec: Admin Platform Settings, Dashboard, Live Preview, Data Export & Audit

**File:** `docs/specs/2026-08-28-03-admin-platform-settings.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Auth & account security spec](2026-08-28-01-auth-account-security.md), SRS §19 / §23–24 / Addendum §6 / §12, architecture §Authentication & Security / §API Architecture

> **2026-08-29 gap-audit update:** the SRS §19 Admin module checklist names three modules with no
> existing spec owner — **Dashboard**, **Live Website Preview**, and a **Domain** setting field.
> All three are cross-cutting Admin-operations concerns of the same shape this spec already owns
> (Settings, Exports, Audit), so they are added here rather than fragmented into new files.
> Everything below §2 that predates this update is unchanged; new content is additive.

---

## 1. Problem statement

**Today:** There is no central place for Admin to change contact/social details, payment-method
configuration, or the auto-calculating "years of experience" value — and no way to export business
data or review an audit trail of admin actions.

**Who is affected:** Admin, who must be able to change WhatsApp number, bank details,
PayPal/payment configuration, and social links globally, in one place, with the change propagating
everywhere automatically; anyone doing bookkeeping/reporting, who needs filtered/complete data
exports.

**Why it matters now:** SRS §32 states routine content and settings changes must never require a
code deploy — this spec is the settings backbone that makes every other feature's "Admin-configurable"
requirement (payment methods, WhatsApp number, social links, experience counter) actually true.

**Success looks like:** One update to WhatsApp/bank/PayPal/social settings instantly propagates to
every public location that displays it; the experience counter increments automatically each year
with no manual edit; Admin can export named datasets (filtered or complete); every admin write is
audit-logged.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin updates the WhatsApp number in Settings **When** saved **Then** every public location that displays it (footer, Contact page, purchased-file support icon, WhatsApp click-to-chat links) reflects the new number immediately |
| AC-2 | **Given** Admin updates bank receiving details or PayPal/payment configuration **When** saved **Then** the next checkout uses the updated details, and past order records retain the details that were active at the time of that order (never rewritten retroactively) |
| AC-3 | **Given** Admin updates a social link (Facebook, Instagram, LinkedIn, X/Twitter, YouTube) **When** a link is left empty **Then** its icon is hidden everywhere it would otherwise appear |
| AC-4 | **Given** the Experience Start Year stored in settings **When** the public site calculates "years of experience" **Then** it computes `current_year − experience_start_year` automatically each year with no Admin edit required |
| AC-5 | **Given** Admin requests a data export **When** they choose a specific filtered dataset (e.g. date range) or "all" **Then** a separately named file is produced per dataset: `Customer_History`, `Orders`, `Payments`, `Downloads`, `Quotes`, `Custom_Requests`, `Notifications` |
| AC-6 | **Given** any Admin write action anywhere in the system (design edit, price change, settings change, order status change, etc.) **When** it is saved **Then** an `audit_logs` row is written with the admin's user id, action type, resource type/id, and a diff of the change |
| AC-7 | **Given** Admin creates a freelancer/limited-admin account (per Auth & Account Security spec AC-8) **When** module/category permissions are assigned **Then** this settings module enforces those scoped permissions on every settings-related read/write |
| AC-8 | **Given** every Admin/API endpoint across the platform **When** it receives a request **Then** it independently verifies authorization server-side — this settings module is the canonical place this rule is documented, but it applies platform-wide (cross-cutting with every other spec) |
| AC-9 | **Given** Admin configures a recurring export schedule (dataset, frequency, delivery — e.g. weekly Orders export) **When** the scheduled time arrives **Then** the export job runs automatically and the resulting file is available the same way an on-demand export is, without Admin needing to trigger it manually each time |
| AC-10 | **Given** Admin enables an additional payment method with a non-PKR settlement currency **When** it is configured **Then** `payment_method_settings.config` stores that currency and checkout displays/settles in it accordingly |
| AC-11 | **Given** Admin sets the platform's domain (e.g. `czdigitizing.com`) in Settings **When** saved **Then** it is used everywhere the domain is referenced (canonical URLs, email templates, share links) without a code deploy |
| AC-12 | **Given** the Admin Dashboard **When** it loads **Then** it shows operational metrics already available from existing platform data — recent orders, monthly revenue, top-selling designs, recent customer signups, and Admin's unread-notification count (per the Notifications spec) — with no invented metrics beyond what those features already track |
| AC-13 | **Given** the Admin Dashboard **When** an admin without a specific module's permission (per the Auth & Account Security spec's `admin_permissions`) views it **Then** only the widgets/sections for modules that admin has at least read access to are shown; a full Admin sees everything |
| AC-14 | **Given** Admin clicks a Dashboard widget (e.g. "Recent Orders") **When** they click a specific row **Then** they navigate directly to that record's detail view in its owning module (e.g. `/admin/orders/:id`) |
| AC-15 | **Given** Admin opens Live Website Preview **When** it loads **Then** it renders the actual public site (current published state — same designs, sections, ads, FAQs, etc. a real customer would see) inside the Admin panel, without creating, modifying, or exposing any unpublished/draft data and without mutating any production record as a side effect of viewing it. Because Preview reuses the same public read endpoints every other spec already exposes (§4), each Preview page load reflects whatever was published as of *that* request — **if Admin edits content in a separate tab while Preview is already open, the open Preview pane is not required to auto-refresh; Admin must reload/reopen it to see the change.** Automatic live-refresh of an already-open Preview pane is explicitly not required by this spec (no SRS/architecture text asks for it) — see §8 Risk #4, which documents this as a stated limitation rather than an unspecified gap |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/admin/settings` | `role=admin` | `200` `SettingsDto` | |
| `PUT` | `/api/admin/settings/contact` | `role=admin` | `200` | WhatsApp, email — AC-1 |
| `PUT` | `/api/admin/settings/social` | `role=admin` | `200` | AC-3 |
| `PUT` | `/api/admin/settings/experience` | `role=admin` | `200` | sets `experience_start_year` — AC-4 |
| `PUT` | `/api/admin/settings/payment-methods` | `role=admin` | `200` | AC-2 |
| `GET` | `/api/admin/settings/languages` | `role=admin` | `200` | see Internationalization spec |
| `POST` | `/api/admin/settings/languages/:code` | `role=admin` | `200` | see Internationalization spec |
| `POST` | `/api/admin/export/customer-history` | `role=admin` | `202` (async job) | AC-5 |
| `POST` | `/api/admin/export/orders` | `role=admin` | `202` | |
| `POST` | `/api/admin/export/payments` | `role=admin` | `202` | |
| `POST` | `/api/admin/export/downloads` | `role=admin` | `202` | |
| `POST` | `/api/admin/export/quotes` | `role=admin` | `202` | |
| `POST` | `/api/admin/export/custom-requests` | `role=admin` | `202` | |
| `GET` | `/api/admin/exports/:jobId` *(new, proposed)* | `role=admin` | `200` status + download link when ready | exports are large and should be async, not synchronous per architecture's file-size guidance |
| `PUT` | `/api/admin/settings/domain` *(new, proposed)* | `role=admin` | `200` | AC-11 |
| `GET` | `/api/admin/dashboard/stats` | `role=admin` | `200` `DashboardStatsDto` | already listed in architecture §API Architecture; no spec previously owned it — AC-12 |
| `GET` | `/api/admin/orders/recent` | `role=admin` | `200` | AC-12, AC-14 |
| `GET` | `/api/admin/revenue/monthly` | `role=admin` | `200` | AC-12 |
| `GET` | `/api/admin/top-designs` | `role=admin` | `200` | AC-12, AC-14 |
| `GET` | `/api/admin/customers/recent` | `role=admin` | `200` | AC-12, AC-14 |
| `GET` | `/api/admin/preview` *(new, proposed)* | `role=admin` | `200` | AC-15; renders the public site through the same public read endpoints Admin already has elevated access to — no separate rendering system |

### DTO

```ts
export interface SettingsDto {
  whatsappNumber: string; contactEmail: string;
  social: { facebook?: string; instagram?: string; linkedIn?: string; xTwitter?: string; youTube?: string };
  experienceStartYear: number;
  domain: string;
  paymentMethods: { paypalEnabled: boolean; bankTransferEnabled: boolean; bankDetails?: BankDetailsDto };
}

export interface DashboardStatsDto {
  recentOrders: OrderSummaryDto[];
  monthlyRevenuePkr: { month: string; revenuePkr: number }[];
  topDesigns: { designId: string; name: string; unitsSold: number }[];
  recentCustomers: { customerId: string; name: string; registeredAt: string }[];
  unreadNotificationCount: number; // delegates to the Notifications spec
}
```

### Export file column schema (per dataset)

Each export is produced in both CSV and XLSX, one file per dataset (AC-5):

| Dataset | Columns |
|---|---|
| `Customer_History` | `customer_id`, `name`, `email`, `whatsapp`, `country`, `total_orders`, `total_spent_pkr`, `first_purchase_at`, `last_purchase_at` |
| `Orders` | `order_number`, `customer_email`, `order_status`, `payment_method`, `payment_status`, `subtotal_pkr`, `discount_pkr`, `credits_used`, `total_pkr`, `currency`, `created_at`, `completed_at` |
| `Payments` | `order_number`, `payment_method`, `payment_status`, `amount_pkr`, `currency`, `confirmed_by_admin`, `confirmed_at` |
| `Downloads` | `order_number`, `customer_email`, `design_id`, `file_format`, `download_count`, `first_download_at`, `last_download_at` |
| `Quotes` | `quote_number`, `customer_name`, `customer_email`, `service_type`, `status`, `created_at` |
| `Custom_Requests` | `request_number`, `customer_email`, `request_type`, `status`, `designer_id`, `created_at`, `delivered_at` |
| `Notifications` | `recipient_email`, `notification_type`, `title`, `is_read`, `created_at` |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `platform_settings` *(new, proposed)* | proposed | single-row (or key/value) table: `id`, `whatsapp_number`, `contact_email`, `domain`, `facebook_url`, `instagram_url`, `linkedin_url`, `x_twitter_url`, `youtube_url`, `experience_start_year`, `updated_at`, `updated_by_admin_id` — nothing in the architecture DDL backs any of these Admin-configurable global values today |
| `payment_method_settings` *(new, proposed)* | proposed | `id`, `method` enum(`paypal`,`bank_transfer`,`credit_card`), `is_enabled`, `config` JSONB (bank details, PayPal client config — secrets stored via the secrets manager, not this table, only non-secret display config lives here), `updated_at` |
| `data_export_jobs` *(new, proposed)* | proposed | `id`, `requested_by_admin_id`, `dataset` enum(`customer_history`,`orders`,`payments`,`downloads`,`quotes`,`custom_requests`,`notifications`), `filters` JSONB, `status` enum(`queued`,`processing`,`ready`,`failed`), `file_url` (private, signed access), `created_at`, `completed_at` |
| `audit_logs` | existing | per architecture DDL; AC-6 requires every admin write path to call into this, which is a cross-cutting implementation concern, not a schema one |

No new tables are needed for Dashboard (AC-12–AC-14) or Live Preview (AC-15) — both are read-only
compositions over existing entities (`orders`, `designs`, `users`, `notifications`) and existing
public read endpoints, respectively. Dashboard reuses the architecture-defined
`/api/admin/dashboard/*` endpoints (previously listed but unowned by any spec); Live Preview
reuses the same public read paths every other spec's public endpoints already expose, with
`role=admin` auth layered on top — it does not introduce a second rendering system.

### Migration

- **Name:** `AddPlatformSettingsAndExports`
- **Reversible:** yes
- **Backfill required:** yes — seed `platform_settings` with a single default row (current WhatsApp
  +92 317 4604508, email czdigitizing@gmail.com, domain `czdigitizing.com` (planned, per SRS
  Addendum §1), experience_start_year computed from "10 years as of 2026") so the site never
  renders with null contact info
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

`data_export_jobs.file_url` may contain customer PII in bulk (Customer_History export) — must use
the same private-storage/signed-URL protection as embroidery files, with a short expiry and
Admin-only access. Never emailed as an attachment; delivered via authenticated download only.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | settings form shows current values with a skeleton on first load; export list shows job-status polling |
| **Empty** | first-ever load before backfill should never occur (seeded by migration); if an export dataset has zero matching rows, the export still completes with an empty file, not an error |
| **Error** | settings save failure shows field-level validation (e.g. invalid URL format); export failure shows `status=failed` with a retry action |
| **Success** | toast on settings save; export ready shows a download action with signed-URL expiry countdown |
| **Loading** (Dashboard) | per-widget skeletons (recent orders, revenue chart, top designs, recent customers) load independently, matching the pattern already established in the Customer Account spec — a slow widget never blocks the rest |
| **Empty** (Dashboard) | a brand-new platform with zero orders/customers shows each widget's own empty state (e.g. "No orders yet") rather than hiding the widget |
| **Error** (Dashboard) | a failed widget shows an inline retry without breaking the rest of the dashboard |
| **Loading/Error** (Live Preview) | preview pane shows a skeleton while the public site loads inside it; a failed load shows retry with `traceId`, same as any other page |

**Route(s):** `/admin/settings`, `/admin/settings/payment-methods`, `/admin/exports`,
`/admin/audit-log`, `/admin/dashboard`, `/admin/preview`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | experience-year computation, empty-social-link hides icon, audit-log diff generation | `apps/api/admin-settings/*.spec.ts` |
| **Integration** | settings save → propagates to a public-facing read (e.g. footer query reflects new WhatsApp number); export job lifecycle; audit log written on every admin write across a sample of other features | `apps/api/test/integration/admin-settings.spec.ts` |
| **E2E** | admin changes WhatsApp number → footer/contact page reflect it immediately; admin requests an Orders export → downloads it | `e2e/admin-settings.e2e.spec.ts` |
| **Integration** | Dashboard widget data matches underlying `orders`/`designs`/`users`/`notifications` records; permission-scoped widget visibility (AC-13) | `apps/api/test/integration/admin-dashboard.spec.ts` |
| **E2E** | admin opens Dashboard → clicks a Recent Order → lands on that order's detail page (AC-14); admin opens Live Preview → sees the actual current public site with no mutation | `e2e/admin-dashboard-preview.e2e.spec.ts` |

**Traceability:** AC-1…AC-15 → `admin-settings.integration.spec.ts` / `admin-dashboard.spec.ts`
(AC-12–AC-14) / `admin-dashboard-preview.e2e.spec.ts` (AC-15).

**Coverage:** ≥80% on new code; AC-6 (audit logging) traced with a cross-feature smoke test that
performs one write in each of 3–4 other modules and asserts an `audit_logs` row exists for each.

**Not covered, deliberately:** None — the export file's column schema per dataset is defined in
§3 above.

---

## 7. Out of scope

None — every item previously listed here (scheduled/recurring exports, multi-currency
payment-method configuration) has been folded into AC-9/AC-10 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `platform_settings`, `payment_method_settings`, and `data_export_jobs` are all required by explicit SRS Admin modules but absent from the architecture DDL | Engineering | Open |
| 2 | Where PayPal client secret / bank-account-number sensitive values live (secrets manager vs. encrypted DB column) — SRS explicitly says "Never expose API keys, payment secrets, bank credentials" but doesn't specify storage mechanism | Engineering | Open |
| 3 | Freelancer/limited-admin permission enforcement (AC-7) depends on `admin_permissions` from the Auth spec being finalized first | Engineering | Open |
| 4 | Live Preview's exact rendering mechanism (server-side render of the public app inside an Admin-authenticated frame vs. a dedicated read-only render path) is not specified beyond "reflects current published state, no mutation" — implementation detail to finalize in the PR. **Resolved as a stated limitation (2026-08-29):** an already-open Preview pane does not auto-refresh when content is edited in another tab — Admin must reload it (see AC-15). This is a deliberate scope limit (no auto-refresh mechanism is required by the SRS/architecture), not an unresolved ambiguity | Engineering | Open (mechanism) / Resolved (refresh behavior) |
| 5 | Dashboard's `monthlyRevenuePkr` trailing window (e.g. last 6 months vs. 12 months) is not specified in the SRS/architecture | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — foundational Admin capability, ships with Phase 1 MVP.
- **Migration order:** `platform_settings` (with seeded default row) ships before any public page
  that reads WhatsApp/social/experience values goes live — those pages must never render with nulls.
- **Rollback:** standard image rollback; `data_export_jobs` history is retained across rollback
  (jobs are historical records, not transient state).
- **Observability:** alert on export-job failure rate; alert if `platform_settings` is ever queried
  and returns no row (seed-migration failure, a launch-blocking bug); alert on Dashboard/Preview
  API error rate since Admin relies on them daily to operate the business.

Dashboard and Live Preview introduce no migrations of their own (read-only compositions over
existing tables/endpoints per §4) and ship as soon as the endpoints/entities they read from exist.
