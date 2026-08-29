# Spec: Customer Account & Purchase History

**File:** `docs/specs/2026-08-28-14-customer-account-history.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Auth & account security spec](2026-08-28-01-auth-account-security.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md), SRS §14 / Addendum §6

---

## 1. Problem statement

**Today:** There is no unified "My Account" area. Even once auth, orders, quotes, custom requests,
credits, and subscriptions each exist individually, a customer has no single place that aggregates
their profile, order history, quotes, purchased designs, credits, and subscription — and every new
purchase must attach to the *same* persistent identity rather than fragmenting history per
transaction.

**Who is affected:** Every returning customer who expects their full history in one place; Admin,
who relies on that same aggregated history when supporting a customer.

**Why it matters now:** SRS Addendum §6 is explicit: "One persistent customer identity keeps ALL
later purchases under the same customer history. Each new purchase creates a new date/order while
preserving previous records." This is a cross-cutting aggregation feature over data owned by other
specs (Orders, Quotes, Custom Requests, Subscriptions & Credits) — it needs its own spec because the
aggregation and presentation rules aren't implied by any single owning feature.

**Success looks like:** A customer's account shows profile, all orders (ever), all quotes, all
custom requests, purchased/downloadable designs, credit balance, and subscription status — every
new purchase simply adds to this same view, nothing fragments or resets.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a customer with multiple historical purchases across different dates **When** they view My Orders **Then** every order they've ever placed appears, newest first, regardless of how long ago |
| AC-2 | **Given** a customer's account **When** they view Purchased Designs **Then** it lists every design/bundle they've bought across all orders (not just the most recent order), each with a working download action per the Private File Management spec |
| AC-3 | **Given** a customer updates their profile (display name, avatar) **When** saved **Then** it does not affect any historical order/quote/request records, which retain the identity info captured at submission time (e.g. `quotes.customer_name` as entered then) |
| AC-4 | **Given** a customer's account **When** they view My Quotes and My Custom Requests **Then** each shows current status and links to the detail/tracking view owned by the respective feature |
| AC-5 | **Given** a customer's account **When** they view Credits Balance and Subscription **Then** it reflects the live values from the Subscriptions & Credits feature, not a stale snapshot |
| AC-6 | **Given** a customer logs out **When** they log back in on the same or a trusted device **Then** their full account view is identical to before logout — no data loss, no re-fragmentation |
| AC-7 | **Given** multiple people share one account (e.g. a small business) **When** Admin/the primary customer invites a secondary user **Then** the secondary user gets their own login linked to the same shared order/purchase history under defined permission limits |
| AC-8 | **Given** a customer made purchases as a guest before ever registering (beyond the pre-login cart already covered by the Cart spec) **When** they later register with the same email used at guest checkout **Then** their historical guest orders are retroactively linked into their new account's Order History |
| AC-9 | **Given** an authenticated customer opens a design detail page **When** the page successfully renders **Then** exactly one `VIEWED` activity event is recorded for that view session — a page refresh or repeated internal re-render within the same session does not create a duplicate event |
| AC-10 | **Given** a customer adds a design/bundle to the cart **When** the add succeeds **Then** an `ADDED_TO_CART` activity event is recorded referencing the cart item; **given** they remove it **when** the removal succeeds **then** a `REMOVED_FROM_CART` event is recorded referencing the same design/bundle |
| AC-11 | **Given** a customer completes checkout **When** the order is created **Then** a `PURCHASED` activity event is recorded referencing the resulting order; **given** the order later reaches `payment_confirmed` **when** that transition occurs **then** a `PAID` activity event is recorded referencing the same order (this event is owned here for the customer-activity view; the order-status transition itself remains owned by the Orders & Payment spec) |
| AC-12 | **Given** a customer downloads an authorized file **When** the download completes **Then** a `DOWNLOADED` activity event is recorded referencing the file and order (this event is owned here for the customer-activity view; the download itself and its authorization remain owned by the Private File Management spec) |
| AC-13 | **Given** a customer's Activity/Recently Viewed tab **When** they open it **Then** it shows their own `VIEWED`/`ADDED_TO_CART`/`REMOVED_FROM_CART`/`PURCHASED`/`PAID`/`DOWNLOADED` events in reverse-chronological order, each linking back to the relevant design/order |
| AC-14 | **Given** Admin views a specific customer's record **When** the Customer Activity panel loads **Then** Admin sees that customer's full activity timeline (same event types as AC-13) to support customer service and troubleshooting |
| AC-15 | **Given** a duplicate event-creation attempt for the same idempotency key (e.g. a retried API call or a repeated webhook/callback for the same view session, cart action, or download) **When** it is processed **Then** no duplicate `activity_events` row is created — the write is idempotent |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.
This spec is primarily an aggregation layer over other features' data — it does not own new
business logic, only read/composition endpoints and the profile-write endpoints.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/users/profile` | Authenticated customer | `200` `ProfileDto` | |
| `PUT` | `/api/users/profile` | Authenticated customer | `200` | AC-3 |
| `POST` | `/api/users/avatar` | Authenticated customer | `200` | |
| `GET` | `/api/users/orders` | Authenticated customer | `200` `PagedResponse<OrderSummaryDto>` | delegates to Orders spec |
| `GET` | `/api/users/quotes` | Authenticated customer | `200` `PagedResponse<QuoteSummaryDto>` | delegates to Get-a-Quote spec |
| `GET` | `/api/users/custom-requests` | Authenticated customer | `200` `PagedResponse<CustomRequestSummaryDto>` | delegates to Custom Requests spec |
| `GET` | `/api/users/purchased-designs` | Authenticated customer | `200` `PagedResponse<PurchasedDesignDto>` | AC-2, aggregates across all `order_items`/bundle purchases |
| `GET` | `/api/users/activity` *(new, proposed)* | Authenticated customer | `200` `PagedResponse<ActivityEventDto>` | AC-13; owns write access internally via the events below, not via a public write endpoint |
| `POST` | `/api/designs/:id/view` *(new, proposed)* | Authenticated customer | `202` | records a `VIEWED` event (AC-9); idempotent per `(customer_id, design_id, session_id)` (AC-15) |
| `GET` | `/api/admin/customers/:id/activity` *(new, proposed)* | `role=admin` | `200` `PagedResponse<ActivityEventDto>` | AC-14 |

### Internal contract (not a public route, but part of this spec)

```ts
interface ActivityService {
  record(input: {
    customerId: string;
    eventType: 'VIEWED' | 'ADDED_TO_CART' | 'REMOVED_FROM_CART' | 'PURCHASED' | 'PAID' | 'DOWNLOADED';
    designId?: string;
    orderId?: string;
    cartItemId?: string;
    fileId?: string;
    source: 'web' | 'mobile';
    idempotencyKey: string;   // e.g. `${customerId}:${eventType}:${designId|orderId}:${sessionId}`
  }): Promise<void>;
}
```

`ADDED_TO_CART`/`REMOVED_FROM_CART` are recorded as a side-effect inside the Cart spec's own
add/remove handlers (not a separate customer-facing route); `PURCHASED`/`PAID` as a side-effect
inside the Orders & Payment spec's create/confirm handlers; `DOWNLOADED` as a side-effect inside
the Private File Management spec's download handler. This spec owns the event schema, storage,
and the customer/Admin-facing read views — it does not own the triggering business logic.

---

## 4. Data model changes

### Entities

This feature mostly reads across `users`, `orders`/`order_items`, `customer_authorized_files`,
`quotes`, `custom_requests`, `customer_credits`, `customer_subscriptions`, all of which are owned
by other specs. It owns one new table for the activity timeline (AC-9–AC-15).

| Entity | Change | Notes |
|---|---|---|
| `users` | existing | `id` is the persistent identity anchor referenced by AC-1/AC-6 |
| `activity_events` *(new, proposed)* | proposed | `id`, `customer_id → users.id`, `event_type` enum(`VIEWED`,`ADDED_TO_CART`,`REMOVED_FROM_CART`,`PURCHASED`,`PAID`,`DOWNLOADED`), `design_id → designs.id` (nullable), `order_id → orders.id` (nullable), `cart_item_id` (nullable), `file_id → design_files.id` (nullable), `source` enum(`web`,`mobile`), `idempotency_key` (unique), `created_at` — indexed on `(customer_id, created_at)` for the timeline read and unique on `idempotency_key` to enforce AC-15 |

### Migration

- **Name:** `AddActivityEvents`
- **Reversible:** yes — drop `activity_events`
- **Backfill required:** no (new table, empty by default; history starts accumulating from launch,
  it is not backfilled from pre-launch data since none exists)
- **Downtime:** none
- **Reviewed SQL:** to be authored; the unique constraint on `idempotency_key` is load-bearing for
  AC-15 and must ship in the same migration as the table itself, not added later

### Retention and privacy

No new PII beyond what's already covered by the owning features; this spec's job is presentation,
not storage.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | account dashboard shows per-widget skeletons (orders list, credits balance, etc.) independently, so a slow one doesn't block the rest |
| **Empty** | new account with no orders yet shows "You haven't ordered anything yet — browse designs" rather than a blank table |
| **Error** | if one widget (e.g. subscription status) fails to load, the rest of the account page still renders — partial failure isolation, not a full-page error |
| **Success** | full account overview with quick links into each owning feature's detail views |

**Route(s):** `/account`, `/account/profile`, `/account/orders`, `/account/quotes`,
`/account/custom-requests`, `/account/purchased-designs`, `/account/credits`,
`/account/subscription`, `/account/activity`, `/admin/customers/:id/activity`

### Customer activity workflow

```text
Customer opens design
        ↓
VIEWED event recorded (idempotent per session)
        ↓
Customer adds design to cart
        ↓
ADDED_TO_CART event recorded
        ↓
Customer removes it            OR      Customer checks out
        ↓                                       ↓
REMOVED_FROM_CART event                 PURCHASED event recorded
                                                 ↓
                                         Payment confirmed
                                                 ↓
                                         PAID event recorded
                                                 ↓
                                         Authorized file downloaded
                                                 ↓
                                         DOWNLOADED event recorded
```

Every event is written through the shared `ActivityService.record()` contract (§3) with an
idempotency key, so retried requests, page refreshes, or repeated webhook callbacks never create
duplicate rows (AC-15).

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | purchased-designs aggregation correctly de-duplicates/unions across individual and bundle purchases | `apps/api/account/*.spec.ts` |
| **Integration** | a customer with orders across multiple dates, a quote, and a custom request sees all of them under one account; profile edit doesn't mutate historical records | `apps/api/test/integration/account.spec.ts` |
| **E2E** | buy a design, buy a second design a "session later," confirm both appear in Purchased Designs and Order History together | `e2e/account.e2e.spec.ts` |
| **Integration** | customer-initiated self-service account deletion / personal-data export request | `apps/api/test/integration/account-deletion-export.spec.ts` |
| **Unit** | `ActivityService.record()` idempotency-key collision handling; no duplicate row on retried/duplicate calls | `apps/api/activity/*.spec.ts` |
| **Integration** | full view → cart-add → cart-remove-or-purchase → paid → downloaded event chain recorded in order; Admin can read another customer's timeline | `apps/api/test/integration/activity.spec.ts` |

**Traceability:** AC-1…AC-15 → `account.integration.spec.ts` / `account.e2e.spec.ts` /
`activity.spec.ts` (AC-9–AC-15).

**Coverage:** ≥80% on new code (this feature's own aggregation logic; underlying data correctness is
each owning feature's responsibility and already covered there).

**Not covered, deliberately:** None — self-service account deletion/data export is covered by the
additional Integration row above.

---

## 7. Out of scope

None — every item previously listed here (household/shared accounts, guest-to-account historical
merge) has been folded into AC-7/AC-8 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | If a customer registers a second account with a different email, there is no mechanism to merge histories — is that acceptable, or does the business need an account-merge tool? | Admin | Open |
| 2 | `activity_events` has no stated retention limit; `VIEWED` events in particular can grow large in volume — retention/rollup policy (e.g. purge or aggregate `VIEWED` events after N months while keeping `PURCHASED`/`PAID`/`DOWNLOADED` indefinitely) is not specified anywhere in the source SRS/architecture | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — depends on Auth, Orders, Quotes, Custom Requests, and
  Subscriptions/Credits each existing; ships after those, still within Phase 1–2 per the roadmap.
- **Migration order:** `activity_events` (`AddActivityEvents`) ships before the view-tracking/
  cart-event/download-event hooks are enabled in the owning features; everything else inherits
  from owning features with no migration of its own.
- **Rollback:** standard image rollback; account aggregation views are purely presentational, no
  data risk. `activity_events` rows are historical and are not deleted on rollback.
- **Observability:** track account-page load time (aggregation of multiple sources can be slow) —
  alert if p95 exceeds the platform's general API latency targets.
