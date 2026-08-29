# Spec: Mobile App (Android/iOS) & Cross-Platform Synchronization

**File:** `docs/specs/2026-08-29-18-mobile-app-android-ios.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Auth & account security spec](2026-08-28-01-auth-account-security.md), [Notifications spec](2026-08-28-02-notifications-system.md), SRS Addendum §1, architecture §Technology Stack (Mobile App) / §Notifications (Push)

> **Why this is one new spec, not two, and not an update to an existing one (2026-08-29
> gap-audit):** No existing spec owns the mobile app shell, navigation, or platform-specific
> behavior — every feature spec in this set defines its *backend/business logic* in a
> platform-neutral way ("Given a customer... Then...") and explicitly assumes the same API serves
> web, iOS, and Android (architecture: "using the same secure backend/database/API"). Android and
> iOS are combined into a single spec rather than two, per the architecture's own single React
> Native/Expo codebase and the absence of any Android-only or iOS-only requirement anywhere in the
> SRS — splitting them would duplicate nearly every requirement for no benefit. Website↔App
> synchronization (a separately named gap area) is folded in here rather than given its own file:
> synchronization is not a feature with its own UI or business rules, it is *this spec's own
> subject* — "how does the mobile client stay consistent with the same shared backend" is exactly
> what a mobile-client spec exists to define, and a separate sync-only spec would have no other
> logical owner and no content distinct from what belongs here.
>
> This spec does **not** redefine any business logic already owned elsewhere (cart rules, order
> state machine, credit ledger, etc.) — it defines the mobile client's shell, navigation, and its
> contract as a second consumer of the same backend those specs already define.

---

## 1. Problem statement

**Today:** The architecture explicitly requires "Website AND Android/iOS mobile app... using the
same secure backend/database/API" (SRS Addendum §1), and every feature spec in this set is written
API-first so it can serve both — but nothing defines the mobile app's own shell (navigation,
platform constraints, app-specific behavior) or guarantees that state a customer changes on one
platform is correctly reflected on the other.

**Who is affected:** Customers who use both the website and the mobile app and expect one
continuous experience (e.g. add to cart on web, complete checkout on the app); Admin, whose content
and configuration changes must reach both platforms identically.

**Why it matters now:** Without an explicit synchronization contract, "same backend" does not
automatically mean "same state as perceived by the customer" — client-side caching, offline
buffers, or platform-specific shortcuts could silently diverge without this spec's rules.

**Success looks like:** A customer's account, cart, orders, purchases, downloads, quotes, custom
requests, credits, subscriptions, and notifications look identical whether viewed on the website or
the mobile app, because both are thin clients over the same API with no duplicated business logic;
Admin-controlled content/configuration changes reach both platforms the same way they already reach
the website today.

---

## 2. Acceptance criteria

### App shell & navigation

| # | Criterion |
|---|---|
| AC-1 | **Given** the mobile app's bottom/tab navigation **When** a customer uses it **Then** it provides the same core sections as the website's primary navigation (Home, Categories/Services, Search, Cart, Account) adapted to a mobile navigation pattern, per architecture's React Navigation stack |
| AC-2 | **Given** a customer opens the app **When** it launches **Then** the same authentication rules from the Auth & Account Security spec apply (session persists until logout/expiry, new-device verification for a first-time app install, mandatory 2FA if the account is `role=admin`) |
| AC-3 | **Given** every customer-facing feature already specified elsewhere — Home & Promotions (spec 13), Design Catalog/card flip (04), Services (17), Design Bundles (06), Content & Knowledge Base: FAQ/Tips/Testimonials/Blog/About/Portfolio (10), Cart/Checkout (07), Orders/Payment (08), Subscriptions/Credits (09), Smart Get a Quote (11), Custom Design Requests (12), Account & Activity (14), Notifications (02), Taebo (15), Language selection (16) — **When** it is used from **either** the Android or the iOS build of the mobile app **Then** it behaves per that feature's own spec on both platforms identically; this spec does not redefine any of that business logic, only the app shell that hosts it. This is the itemized implementation of the platform-level parity requirement stated in the [master spec's AC-24](2026-08-28-cz-digitizing-platform.md#2-acceptance-criteria); the "Regression" row in §6 is the mechanism that verifies each owning spec's existing test suite still passes unmodified when exercised from the app shell |
| AC-4 | **Given** the mobile app's Admin login path (per SRS Addendum §1: "Website Admin is protected at `/admin`. Mobile Admin uses secure Admin Login → Admin Dashboard") **When** an Admin logs in from the app **Then** they reach a mobile-adapted Admin Dashboard (per the Admin Platform Settings spec's Dashboard, AC-12–AC-14) — customers never see any Admin navigation entry point in the app, matching the website's separation |
| AC-5 | **Given** a design's private embroidery files **When** viewed/downloaded from the mobile app **Then** the exact same private-file authorization, signed-URL, and `.EMB`-exclusion rules from the Private File Management spec apply — there is no relaxed mobile-specific download path |
| AC-6 | **Given** the app is built for release **When** packaged **Then** it targets the sizes and performance budgets already defined in architecture §Performance & Optimization "Mobile App Performance" (app size, memory management, network retry, battery) — this spec does not invent new numbers beyond what architecture already states |

### Requirement-by-requirement traceability (2026-08-29, fourth-pass fix)

Every individual mobile-client scope item named in the Master gap review, verified one at a time:

| Requirement | Covered by | Owning business logic |
|---|---|---|
| Android | AC-1–AC-16 (this spec covers both platforms identically; no Android-only requirement exists — see §7) | this spec (shell only) |
| iOS | AC-1–AC-16 (same as above) | this spec (shell only) |
| Mobile navigation / app shell | AC-1 | this spec |
| Authentication integration | AC-2 | [Auth & Account Security spec](2026-08-28-01-auth-account-security.md) |
| Home | AC-3 (enumerated) | [Home Page Sections spec](2026-08-28-13-home-promotions-cms.md) |
| Search / Categories / Catalog / Design details / Vector-embroidery behavior | AC-3 (enumerated) | [Design Catalog spec](2026-08-28-04-design-catalog-browsing.md) |
| Cart | AC-3, AC-8 | [Shopping Cart & Checkout spec](2026-08-28-07-shopping-cart-checkout.md) |
| Checkout / Orders | AC-3, AC-9 | [Orders & Payment Processing spec](2026-08-28-08-orders-payment-processing.md) |
| Downloads | AC-5, AC-10 | [Private File Management spec](2026-08-28-05-private-file-management.md) |
| Subscriptions / Credits | AC-3, AC-12 | [Subscriptions & Credits spec](2026-08-28-09-subscriptions-credits.md) |
| Quotes | AC-3, AC-11 | [Smart Get a Quote spec](2026-08-28-11-smart-get-a-quote.md) |
| Custom Requests | AC-3, AC-11 | [Custom Design Requests spec](2026-08-28-12-custom-design-requests.md) |
| Account | AC-3, AC-7 | [Customer Account & Purchase History spec](2026-08-28-14-customer-account-history.md) |
| Notifications | AC-3, AC-13 | [Notifications spec](2026-08-28-02-notifications-system.md) |
| Taebo | AC-3 | [Taebo spec](2026-08-28-15-taebo-chatbot.md) |
| Languages/settings | AC-3 | [Internationalization spec](2026-08-28-16-internationalization.md) |

Search/Categories/Catalog/Design-details/Vector-embroidery-behavior are grouped in one row because
they are all owned by the same spec (04) and exercised through the same app screens (§5
Route(s)) — this is a traceability grouping, not a missing individual check; each sub-item's own
acceptance criteria live in spec 04 §2 and are unchanged by being consumed from a mobile client.

### Cross-platform synchronization

```text
Website  ──┐
           ├──▶ Shared API / Backend ──▶ Shared persisted state (Postgres/Redis)
Android  ──┤                                        │
iOS      ──┘                                        ▼
                                    Every client reads the same state on its next request
                                    (AC-7–AC-14); no client-local copy is authoritative.
```

| # | Criterion |
|---|---|
| AC-7 | **Given** a customer logs into the mobile app with the same account used on the website **When** authenticated **Then** they see the exact same account identity, session-independent state (orders, purchases, credits, subscription), per the Customer Account & Purchase History spec's persistent-identity model |
| AC-8 | **Given** a customer adds an item to their cart on the website **When** they open the mobile app on the same authenticated account **Then** the same cart item appears, because both clients read/write the same `carts`/`cart_items` tables via the same Cart spec API — no client-local cart state is treated as authoritative |
| AC-9 | **Given** an order placed on one platform **When** viewed from the other platform's Order History **Then** it appears identically (same status, same items), since both read the same `orders`/`order_items` tables via the Orders & Payment spec's API |
| AC-10 | **Given** a design purchased on one platform **When** viewed from the other platform's Purchased Designs **Then** it appears identically and is downloadable from either platform, subject to the same authorization rules (Private File Management spec) |
| AC-11 | **Given** a quote or custom request submitted on one platform **When** viewed from the other platform **Then** its status and history appear identically, since both read the same `quotes`/`custom_requests` tables |
| AC-12 | **Given** a credit balance or subscription change on one platform (purchase, usage, renewal, cancellation) **When** viewed from the other platform **Then** the balance/status is identical, since both read the same `customer_credits`/`credit_transactions`/`customer_subscriptions` tables — there is no separate mobile-cached balance that can drift |
| AC-13 | **Given** a notification triggered by any event **When** delivered **Then** its in-app/read state is shared across platforms for the same account — marking a notification read on the website marks it read when the same account opens the app, since both read/write the same `notifications` table via the Notifications spec's API |
| AC-14 | **Given** Admin changes shared public content or configuration (designs, categories, services, home sections, ads, FAQs, settings, languages) **When** saved **Then** it propagates to the mobile app the same way it already propagates to the website — both are read clients of the same public API, so no separate mobile content-sync mechanism is needed |
| AC-15 | **Given** two near-simultaneous writes to the same resource from two different platforms/sessions for the same account (e.g. cart quantity changed on web and app within the same second) **When** both requests reach the API **Then** the standard optimistic-concurrency/last-write-wins behavior already defined by the owning feature's API contract applies consistently regardless of which platform originated the write — this spec does not introduce a separate mobile-specific conflict-resolution mechanism |
| AC-16 | **Given** the mobile app temporarily loses network connectivity **When** connectivity is restored **Then** the app re-fetches current state from the API rather than trusting any locally cached state as authoritative for cart/orders/credits/subscriptions — per architecture's existing "API response caching: 5–60 minutes" and "offline support: cache critical screens" guidance, this spec does not add complex offline-write/conflict-merge functionality beyond what architecture already specifies |

---

## 3. API contract

This spec introduces **no new API surface** — it is a client of every other spec's existing API
(see [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for the shared response
envelope and conventions). The one addition is mobile-specific push registration, already named in
architecture §Notifications System but not previously owned by any spec's API contract table:

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/users/push-token` *(new, proposed)* | Authenticated customer or admin | `201` | registers an FCM (Android) or APNs (iOS) device token; owned here since it is mobile-app-specific, consumed by the Notifications spec's delivery worker |
| `DELETE` | `/api/users/push-token/:token` *(new, proposed)* | Authenticated, own token only | `204` | on logout/opt-out |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `push_tokens` *(new, proposed)* | proposed | `id`, `user_id → users.id`, `token`, `platform` enum(`ios`,`android`), `created_at`, `last_seen_at` — required for AC-13's push delivery and not present in any existing spec's data model |

No other new tables — per AC-7–AC-16, this spec deliberately introduces no duplicated business
data; every synced entity (`carts`, `orders`, `customer_credits`, `customer_subscriptions`,
`notifications`, `quotes`, `custom_requests`) is owned and defined by its respective existing spec.

### Migration

- **Name:** `AddPushTokens`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

`push_tokens.token` is a device identifier tied to a customer/admin identity — same retention
posture as `sessions` (tracked in master spec §8); a token is deleted on logout/opt-out (AC-13's
DELETE route) and should be pruned if `last_seen_at` is very old (device uninstalled without
explicit logout) — exact staleness window is an open question below.

---

## 5. UI states

Every screen in the mobile app follows the same four-state rule (Loading/Empty/Error/Success) as
its equivalent web screen, per each owning feature spec's own §5 — this spec does not redefine
those states, only the shell that hosts them.

| State | Behaviour |
|---|---|
| **Loading** | native/Expo-appropriate loading indicators matching the owning feature's skeleton pattern where practical on a smaller viewport |
| **Empty** | identical empty-state copy/actions to the equivalent web screen, adapted to mobile touch targets |
| **Error** | identical error messages/`traceId` surfacing to the equivalent web screen; network-loss specifically shows a distinct "You're offline" state per AC-16, not a generic error |
| **Success** | full feature parity with the equivalent web screen per AC-3 |

**Route(s) (app screens, React Navigation stack):** Home, Services, Categories, All Designs,
Design Detail, Bundles, Pricing, Get a Quote, Custom Request, Cart, Checkout, Login/Register,
Account (Orders/Quotes/Custom Requests/Purchased Designs/Credits/Subscription/Activity/
Notifications), Taebo, Language selection, Admin Login → Admin Dashboard (Admin accounts only).

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | push-token registration/de-registration idempotency | `apps/mobile/push/*.spec.ts` |
| **Integration** | push-token API round trip; Notifications worker successfully targets a registered token | `apps/api/test/integration/push-tokens.spec.ts` |
| **Cross-platform sync** | write on web → read on app (and reverse) for cart, orders, purchased designs, quotes, custom requests, credits, subscriptions, notifications-read-state | `e2e/cross-platform-sync.e2e.spec.ts` |
| **E2E (mobile)** | full mobile purchase journey: browse → cart → checkout → payment → download; full mobile quote/custom-request journey | `apps/mobile/e2e` (Detox or Expo E2E) |
| **Regression** | every web E2E journey already defined in other specs continues to pass unchanged — this spec must not require modifying any existing feature's business logic | existing `e2e/*.e2e.spec.ts` suites, unmodified |

**Traceability:** AC-1…AC-16 → `push-tokens.spec.ts` (AC-13 registration half),
`cross-platform-sync.e2e.spec.ts` (AC-7–AC-16), `apps/mobile/e2e` (AC-1–AC-6).

**Coverage:** ≥80% on new code (which is intentionally small — `push_tokens` and the app shell
itself; the vast majority of mobile behavior is covered by each owning feature spec's own tests).

**Not covered, deliberately:** platform-store submission/review process (Apple App Store, Google
Play) — an operational/release process, not a specification-testable behavior.

---

## 7. Out of scope

- Offline write queuing / local-first conflict merge beyond the "refetch on reconnect" behavior in
  AC-16 — not required by the architecture's stated offline guidance.
- Any Android-only or iOS-only feature — none is named anywhere in the SRS or architecture; if one
  emerges later it gets its own platform-specific addendum to this spec, not a fork into two specs.
- Tablet-specific layouts (phone-form-factor is the assumed baseline, per architecture's app-size
  targets being phone-oriented).

### Not covered, deliberately (2026-08-29, fourth-pass addition)

These are not gaps — each is business logic this spec deliberately does not own, verified by
inspecting the actual owning spec rather than assumed. This spec's own subject is the app shell
and the cross-platform sync contract (§2); every rule below stays exactly where it already lives.

| Area | Not covered here because | Owner |
|---|---|---|
| Payment business rules (order state machine, webhook verification, refunds) | This spec only asserts that orders/payments look identical across platforms (AC-9); it does not define how a payment is processed | [Orders & Payment Processing spec](2026-08-28-08-orders-payment-processing.md) |
| Cart business rules (pricing, credit eligibility, size validation) | This spec only asserts cart state is shared (AC-8); it does not define cart calculation logic | [Shopping Cart & Checkout spec](2026-08-28-07-shopping-cart-checkout.md) |
| Design/catalog metadata rules (categories, stitch count, favorites) | This spec relies on spec 04's own data/API; AC-3 references it, does not restate it | [Design Catalog spec](2026-08-28-04-design-catalog-browsing.md) |
| Private-file authorization (`.EMB` exclusion, signed URLs, download logging) | AC-5 explicitly states the same rules apply with no mobile-specific relaxation, rather than redefining them | [Private File Management spec](2026-08-28-05-private-file-management.md) |
| Notification business rules (trigger-to-channel mapping, retry/backoff) | This spec only owns push-token registration (§3, §4) and read-state sync (AC-13); it does not define when/what to notify | [Notifications spec](2026-08-28-02-notifications-system.md) |
| Subscription/credit rules (renewal, proration, ledger math) | This spec only asserts the balance/status is identical across platforms (AC-12); it does not define the ledger | [Subscriptions & Credits spec](2026-08-28-09-subscriptions-credits.md) |
| Customer account rules (persistent identity, profile fields) | This spec only asserts identity/state is identical across platforms (AC-7); it does not define the account model | [Customer Account & Purchase History spec](2026-08-28-14-customer-account-history.md) |
| Quote / custom-request workflow rules | This spec only asserts status/history sync (AC-11); it does not define the workflow states | [Smart Get a Quote](2026-08-28-11-smart-get-a-quote.md) / [Custom Design Requests](2026-08-28-12-custom-design-requests.md) specs |
| Taebo's anti-fabrication / matching logic | This spec lists Taebo as an available screen (§5 Route(s)); it does not redefine Taebo's behavioral contract | [Taebo spec](2026-08-28-15-taebo-chatbot.md) |
| Admin Dashboard content/metrics | AC-4 states the app reaches "a mobile-adapted Admin Dashboard" per that spec's own AC-12–AC-14; this spec does not define what the dashboard shows | [Admin Platform Settings spec](2026-08-28-03-admin-platform-settings.md) |

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `push_tokens` staleness/pruning policy (when to remove a token for an uninstalled app that never explicitly logged out) is not specified | Engineering | Open |
| 2 | Whether the mobile app is built with Expo managed workflow or bare React Native (affects push-notification and build-pipeline specifics) is an architecture decision not yet finalized (architecture lists "React Native / Expo" as the stack) | Engineering | Open |
| 3 | AC-15's "standard optimistic-concurrency/last-write-wins behavior" assumes every owning feature's API already implements consistent concurrency handling; this spec surfaces the requirement but does not audit each feature spec's API for whether that's actually true yet — tracked as a cross-spec consistency follow-up | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none for the app shell itself; the mobile app's *launch* is gated by the
  Phase 4 milestone in the master spec's implementation order (after the full API surface it wraps
  is stable) per architecture's own roadmap ("Mobile app launch (iOS/Android)" — Phase 4).
- **Migration order:** `push_tokens` ships before push-notification registration is enabled in the
  app; every other synced entity already ships as part of its owning feature spec.
- **Rollback:** standard app-store release rollback (previous build re-promoted); `push_tokens` is
  additive and safe to leave in place.
- **Observability:** track push-delivery success rate per platform (iOS/Android) via the
  Notifications spec's delivery log; alert on cross-platform state-divergence reports (e.g. a
  customer-reported "my cart is different on the app" ticket) as a signal this spec's sync
  guarantee has a gap somewhere in an owning feature's implementation.
