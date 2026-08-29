# Spec: Performance & Optimization

**File:** `docs/specs/2026-08-29-19-performance-optimization.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Design catalog spec](2026-08-28-04-design-catalog-browsing.md), [Private file management spec](2026-08-28-05-private-file-management.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md), architecture §Performance & Optimization / §File Management

> **Why this is a new spec, not an update to an existing one (2026-08-29 gap-audit):**
> Performance requirements are already scattered as brief notes across nearly every other spec
> (e.g. the Catalog spec's "alert on catalog API p95 latency exceeding the 600ms TTFB target," the
> master spec's Performance test row) and as a dedicated section in the architecture document, but
> no spec owns platform-wide performance as its primary subject with its own acceptance criteria
> and verification plan. This consolidates that scattered content into one place rather than
> leaving every feature spec to restate the same budgets inconsistently. Every numeric target below
> is copied from `CZ_DIGITIZING_ARCHITECTURE.md § Performance & Optimization` — none is invented;
> where the source material has no number, this spec states the qualitative requirement and a
> testable verification approach instead of fabricating one, per the audit's own constraint.

---

## 1. Problem statement

**Today:** Performance requirements exist in the architecture document (Core Web Vitals budgets,
image/video optimization rules, caching strategy, rate limits) but no spec makes them testable
acceptance criteria owned by anyone, and no spec defines the pre-launch performance verification
pass called out in the architecture's own Phase 5 roadmap ("Performance optimization... Load
testing").

**Who is affected:** Every customer, whose perceived speed directly affects conversion on a
catalog/cart/checkout-driven business; Admin, whose private-file delivery and payment confirmation
must remain reliable under load; the business, which explicitly calls fast-loading "a core
requirement" (SRS Addendum §11) separate from any individual feature.

**Why it matters now:** Without a single owner, performance work risks being treated as an
afterthought per-feature rather than a platform-wide gate that must pass before launch, exactly the
failure mode the architecture's own Phase 5 milestone ("Performance optimization... Load testing")
exists to prevent.

**Success looks like:** Every page meets the Core Web Vitals budgets already defined in
architecture; images/video are optimized and lazy-loaded per architecture's rules; the database and
API meet their stated caching/pagination/rate-limit behavior; payment state changes are reliable
and recoverable; backups exist for the database and private files; and a pre-launch performance/load
test verifies all of the above before the Phase 5 launch gate.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** any public page **When** measured under architecture's stated conditions **Then** it meets Largest Contentful Paint (LCP) < 2.5s, First Input Delay (FID) < 100ms, Cumulative Layout Shift (CLS) < 0.1, and Time to First Byte (TTFB) < 600ms (architecture §Performance & Optimization "Frontend Performance") |
| AC-2 | **Given** a design/bundle/testimonial preview image **When** uploaded by Admin **Then** it is stored as 1200×1200px at 80% quality in both WebP and JPG, with a 300×300px WebP thumbnail and 800×800px WebP gallery variant generated automatically, per the Private File Management spec's upload pipeline; **given** a browser requests that image **when** it is served through the Next.js `<Image>` component **then** it additionally negotiates AVIF for browsers that support it, per architecture §Performance & Optimization → Frontend Performance → Image Optimization ("Auto WebP/AVIF conversion") — AVIF is a delivery-time format negotiated on top of the stored WebP/JPG variants, not a replacement for them |
| AC-3 | **Given** a page with images below the fold **When** rendered **Then** they lazy-load via the Intersection Observer API rather than loading eagerly |
| AC-4 | **Given** a design/header/ad video **When** served **Then** it does not exceed 5 Mbps bitrate, is delivered as MP4 (H.264) at a maximum of 1080p, auto-plays muted and looped only for preview contexts, and is not loaded/decoded until the customer scrolls to or opens it |
| AC-5 | **Given** a catalog/section listing page **When** it has more items than one page **Then** it paginates at 12 items per page on web (per architecture's Lazy Loading rules) and 20 items per screen on the mobile app (per architecture's Mobile App Performance rules), never loading every design/video at once |
| AC-6 | **Given** the production database **When** queried by any read-heavy endpoint (designs list, orders list, FAQ search) **Then** it uses the indexes already defined in architecture §Database Schema "Indexes," connection pooling of 20–50 connections, and read replicas for read traffic where configured |
| AC-7 | **Given** Redis caching **When** a cacheable resource is requested **Then** it respects the TTL strategy already defined in architecture (Designs: 1 hour, Categories: 24 hours, User data: 30 minutes, FAQs: 24 hours, Search results: 5 minutes) |
| AC-8 | **Given** API rate limits **When** a caller exceeds them **Then** the platform enforces the limits already defined in architecture (Anonymous: 100 req/min per IP, Authenticated: 1000 req/min per user, Admin API: 5000 req/min, file uploads: 10 per hour per user) and returns `429 RATE_LIMITED` per the master spec's shared error-code contract |
| AC-9 | **Given** a payment-state-changing operation (order creation, PayPal webhook, bank-receipt confirmation) **When** it partially fails (e.g. the process crashes after the DB write but before the notification send) **Then** the operation is recoverable — retried or reconciled — without leaving the order in an inconsistent state (e.g. `payment_confirmed` with no files released), per the Orders & Payment spec's state machine |
| AC-10 | **Given** the production PostgreSQL database **When** operated **Then** automated backups run per architecture's "AWS RDS PostgreSQL (Multi-AZ, automated backups)" and are periodically verified restorable |
| AC-11 | **Given** the private embroidery-file storage bucket **When** operated **Then** it follows architecture's "AWS S3 (Versioning, lifecycle policies)" so a private file is not permanently lost to accidental deletion or corruption |
| AC-12 | **Given** the platform approaching a Phase 5 launch gate **When** the pre-launch performance pass runs **Then** it verifies AC-1 (Core Web Vitals) and load-tests the checkout/download critical path against realistic concurrent-user volume, with results recorded before launch sign-off |
| AC-13 | **Given** the frontend application is built for production **When** a customer requests a route **Then** only that route's JavaScript (and its associated styles) is delivered — via route-based code splitting (`next/dynamic`), component-based splitting for heavy components, and vendor splitting (third-party dependencies bundled separately from application code) — per architecture §Performance & Optimization → Frontend Performance → Code Splitting, so no page loads more CSS/JS than its own route requires |
| AC-14 | **Given** a production frontend build **When** it is generated **Then** unused code is removed via tree-shaking, output is minified, responses are Gzip-compressed, and web fonts are subset to only the characters/weights actually used — per architecture §Performance & Optimization → Frontend Performance → Bundle Size ("Tree-shaking: Remove unused code... Minification... Gzip compression: 70% reduction... Font subsetting: Load only used characters") |
| AC-15 | **Given** a versioned static asset (JS/CSS bundle, image) **When** requested **Then** it carries a 1-year browser-cache header; **given** a page response is requested **when** served through the CDN **then** it is cached at the CDN edge for 1 hour; **given** the CDN is unreachable **when** a Service Worker is registered **then** it serves an offline fallback — per architecture §Performance & Optimization → Frontend Performance → Caching Strategy ("Browser cache: 1 year... CDN cache: 1 hour... Service Worker: Offline fallback"). This is a distinct caching layer from AC-7's Redis TTLs (server-side data cache) — Redis, application-level, browser, and CDN caching each have their own rule here and in AC-7, and none substitutes for another |
| AC-16 | **Given** a design's protected original embroidery file (`.EMB` or any `design_files` row with `is_private=true`) **When** any performance optimization is applied anywhere in this spec (CDN caching, compression, image-variant generation, database indexing, or any future optimization) **Then** it never exposes the original, generates a public-facing derivative of it, or otherwise weakens the authorization boundary defined by the Private File Management spec's `emb_never_public` constraint and signed-URL download flow — performance work in this spec applies only to public assets (preview images, public page responses) and never touches the private-file delivery path's access-control rules |

### Requirement-by-requirement traceability (2026-08-29, fourth-pass fix)

Every individual performance requirement named in the Master gap review, verified one at a time
rather than asserted as one generic "performance is optimized" claim:

| Requirement | Covered by | Notes |
|---|---|---|
| Fast perceived loading | AC-1 | Core Web Vitals budgets |
| Image optimization | AC-2 | |
| Compression (image) | AC-2 | 80% quality WebP/JPG |
| Compression (JS/text) | AC-14 | Gzip, 70% reduction |
| WebP | AC-2 | |
| AVIF | AC-2 | delivery-time negotiation on top of stored WebP/JPG |
| Lazy loading (images) | AC-3 | Intersection Observer |
| Video lazy loading | AC-4 | not decoded until scrolled to/opened |
| Avoid loading all designs initially | AC-5 | 12/page web pagination |
| Avoid loading all videos initially | AC-4, AC-5 | same pagination + lazy-decode rule |
| CSS optimization | AC-13 | route/component/vendor code splitting |
| JavaScript optimization | AC-13, AC-14 | code splitting + tree-shaking/minification |
| Font optimization | AC-14 | font subsetting |
| Database optimization | AC-6 | indexes, connection pooling, read replicas |
| Pagination | AC-5 | |
| Caching/CDN | AC-7 (Redis), AC-15 (browser + CDN + Service Worker) | three distinct layers, explicitly disambiguated in AC-15 |
| Optimized design previews | AC-2 | |
| Protected originals | **AC-16** | boundary AC — optimization must never weaken private-file authorization, owned by the Private File Management spec |
| Payment reliability | AC-9 | |
| Recoverable state changes | AC-9 | |
| Database backup | AC-10 | |
| Private-file backup | AC-11 | |
| Pre-launch performance testing | AC-12 | |

---

## 3. API contract

This spec introduces no new customer/Admin-facing routes. It defines platform-wide *behavioral*
requirements (caching headers, rate-limit responses, pagination defaults) that every existing
route in every other spec's API contract must already satisfy. Where an existing spec's route
table does not yet state a pagination default or cache TTL, that spec's own table remains the
source of truth for its resource-specific value; this spec fixes the platform-wide defaults
(AC-5–AC-8) those tables inherit unless they explicitly override.

### Error codes (feature-specific, additive to master list)

| HTTP | `code` | When |
|---|---|---|
| `429` | `RATE_LIMITED` | already defined in master spec §3; this spec fixes the concrete limits it enforces (AC-8) |

---

## 4. Data model changes

### Entities

No new tables. This spec verifies behavior against infrastructure/configuration
(Redis TTL config, CDN config, DB connection-pool config, backup schedules) rather than
application data, and against indexes/read-replica configuration already defined in architecture
§Database Schema.

### Migration

None.

### Retention and privacy

Not applicable — this spec does not introduce or touch personal data. Backup retention (AC-10/
AC-11) is an infrastructure policy, not a data-model concern; its retention window is tracked as
an open question below since architecture does not state one.

---

## 5. UI states

Not applicable in the usual per-screen sense — this spec's "UI" concern is that every screen
already defined elsewhere continues to satisfy AC-1's budgets under its own Loading/Empty/Error/
Success states (each owning spec's §5), not a new screen of its own.

**Route(s):** none new; `/admin/dashboard` (Admin Platform Settings spec) is a reasonable place to
surface performance/health signals for Admin, if desired, but that is that spec's own UI decision,
not owned here.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Performance** | LCP/FID/CLS budgets per representative page template (Home, Catalog, Design Detail, Cart, Checkout) | `e2e/performance/` (Lighthouse CI) — same suite referenced in the master spec's §6 |
| **Load** | checkout and download critical-path throughput/latency under simulated concurrent load | `apps/api/test/load` (k6) |
| **Integration** | rate-limit enforcement per caller class (AC-8); cache TTL behavior per resource (AC-7) | `apps/api/test/integration/performance-config.spec.ts` |
| **Integration** | payment-state recovery after a simulated mid-operation failure (AC-9) | `apps/api/test/integration/payment-recovery.spec.ts` |
| **Ops verification** | database backup restore drill; S3 versioning/lifecycle policy verification (AC-10/AC-11) | `ops/runbooks/backup-restore-drill.md` (manual/scheduled, not a CI test) |
| **Build/bundle** | production bundle contains only the current route's JS/CSS (code-splitting, AC-13); tree-shaking/minification/Gzip/font-subsetting applied (bundle size, AC-14) | `apps/web/test/build-output.spec.ts` (bundle-analyzer assertions) |
| **Integration** | static asset responses carry the correct browser-cache header; CDN edge cache and Service Worker offline fallback behave per AC-15 | `apps/api/test/integration/cdn-cache.spec.ts` |
| **Security** | no optimization pipeline (CDN, image-variant generation, indexing) ever produces a public/cached artifact of a `.EMB` or `is_private=true` file (AC-16) | `apps/api/test/integration/optimization-privacy-boundary.spec.ts` |

**Traceability:** AC-1…AC-16 → `e2e/performance/`, `performance-config.spec.ts`,
`payment-recovery.spec.ts`, `build-output.spec.ts` (AC-13/AC-14), `cdn-cache.spec.ts` (AC-15),
`optimization-privacy-boundary.spec.ts` (AC-16), and the backup-restore runbook (AC-10/AC-11,
ops-verified rather than CI-verified since it exercises real infrastructure).

**Coverage:** not expressed as a code-coverage percentage — this spec is verified by budget/threshold
pass-fail (Lighthouse CI, k6 thresholds), consistent with how the master spec's own Performance
test row is defined.

**Not covered, deliberately:** None — every previously-scattered performance note across other
specs is either consolidated here or remains a spec-specific detail (e.g. the Catalog spec's own
p95 latency alert) that this spec's AC-1/AC-6 set the platform-wide baseline for.

---

## 7. Out of scope

- Choosing the specific CDN/hosting provider (AWS CloudFront vs. Cloudflare, EC2/ECS vs.
  DigitalOcean vs. Vercel) — tracked as an open question in the master spec §8, not decided here.
- Elasticsearch adoption for search performance — out of scope per the master spec §7 and the
  Catalog spec's own scope.

### Not covered, deliberately (2026-08-29, fourth-pass addition)

These are not gaps — each is business logic this spec deliberately does not own, verified by
inspecting the actual owning spec rather than assumed. This spec imposes performance
*requirements* on the systems below (indexing, caching, recoverability) without redefining their
business rules.

| Area | Not covered here because | Owner |
|---|---|---|
| Payment business logic (order state machine, webhook handling, refund rules) | AC-9 only requires that state changes are recoverable; it does not define the state machine itself | [Orders & Payment Processing spec](2026-08-28-08-orders-payment-processing.md) |
| Private-file authorization (`.EMB` exclusion, signed URLs) | AC-16 only requires that optimization never weakens this boundary; the boundary itself is defined elsewhere | [Private File Management spec](2026-08-28-05-private-file-management.md) |
| Catalog business rules (categories, pricing, favorites) | AC-2/AC-5 impose image/pagination requirements on catalog pages without redefining what a design or category is | [Design Catalog spec](2026-08-28-04-design-catalog-browsing.md) |
| Cart business rules (pricing, credit eligibility) | Not referenced by this spec at all; cart performance is covered generically by AC-1's page-level budgets | [Shopping Cart & Checkout spec](2026-08-28-07-shopping-cart-checkout.md) |
| Subscription/credit ledger rules | Not referenced by this spec; no subscription-specific performance requirement exists beyond the platform-wide budgets in AC-1/AC-6/AC-7 | [Subscriptions & Credits spec](2026-08-28-09-subscriptions-credits.md) |
| Authentication rules (session, 2FA, rate-limit *policy*) | AC-8 enforces the rate-limit *numbers* architecture already defines; it does not define login/session/2FA behavior | [Auth & Account Security spec](2026-08-28-01-auth-account-security.md) |
| Notification business logic (trigger-to-channel mapping) | Not referenced by this spec; notification delivery latency is covered generically by AC-1/AC-6, not a dedicated rule here | [Notifications spec](2026-08-28-02-notifications-system.md) |
| Database schema / entity definitions | AC-6 requires indexes/pooling/replicas be used; it does not define what any table's columns are | Each entity's owning spec (e.g. `orders` → Orders & Payment Processing spec) |

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Database and private-file backup retention windows (how many days/versions kept) are not stated anywhere in the SRS or architecture | Admin | Open |
| 2 | The concrete concurrent-user volume to load-test against (AC-12) is not specified — needs a business estimate (expected launch traffic × safety margin) before the load-test suite can be written meaningfully | Admin | Open |
| 3 | Whether Lighthouse CI budgets (AC-1) block a deploy on failure or only alert is not specified — this is a CI/CD policy decision, not a performance-requirement question | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — this is a verification/hardening pass, not a customer-facing feature.
- **Migration order:** not applicable (no schema changes).
- **Rollback:** not applicable in the usual sense; if a performance regression is found post-launch,
  the fix follows whichever owning feature spec's normal rollback process applies.
- **Observability:** this spec *is* largely about observability — Prometheus + Grafana p50/p95/p99
  latency, CPU/memory/DB-connection/Redis-memory/disk-space alerts, and ELK/Datadog log aggregation,
  exactly as already defined in the master spec §9 and architecture §Performance & Optimization;
  this spec's contribution is making sure every other spec's endpoints are actually held to those
  thresholds before launch (AC-12), not introducing a new monitoring stack.
