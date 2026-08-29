# Spec: Subscriptions & Credits

**File:** `docs/specs/2026-08-28-09-subscriptions-credits.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md), SRS §11, architecture §Database Schema

---

## 1. Problem statement

**Today:** There is no recurring-revenue mechanism and no prepaid-credit system. Customers cannot
subscribe for monthly credits/perks, nor buy a credit pack to use against future purchases.

**Who is affected:** Repeat customers who want predictable pricing/perks (subscriptions) or
flexible prepaid spend (credits); Admin, who must fully control plan names, prices, benefits, and
credit-package sizes without a code change.

**Why it matters now:** Subscriptions and Credits are a named Phase 3 milestone in the
implementation roadmap and a distinct pricing-page experience (toggle between the two) called out
explicitly in the SRS.

**Success looks like:** A customer can subscribe to a plan (monthly/yearly) or buy a credit package,
see their balance, use credits against eligible purchases, and manage/cancel their subscription —
all fully Admin-configurable.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin creates a subscription plan (name, monthly/yearly price, monthly credits, perks, `is_best_value`) **When** published **Then** it appears on the Pricing page under the Subscription Plans toggle, with the best-value plan visually highlighted |
| AC-2 | **Given** a customer subscribes to a plan **When** the first payment succeeds **Then** a `customer_subscriptions` row is created with `subscription_status=active`, `start_date=now`, and `renewal_date` computed from the billing period |
| AC-3 | **Given** an active monthly/yearly subscription **When** the renewal date arrives and `auto_renew=true` **Then** a renewal charge is attempted and, on success, `renewal_date` advances and the customer's monthly credit allotment refreshes; on failure the subscription is flagged and the customer is notified |
| AC-4 | **Given** a customer cancels a subscription **When** the cancellation is confirmed **Then** `subscription_status=cancelled`, `auto_renew=false`, and access/perks remain until the already-paid `end_date` (no immediate mid-cycle cutoff) |
| AC-5 | **Given** Admin creates a credit package (e.g. 25 credits + bonus) **When** published **Then** it appears under the Pricing page's Buy Credits toggle |
| AC-6 | **Given** a customer purchases a credit package **When** payment is confirmed **Then** `customer_credits.total_credits`/`available_credits` increase and a `credit_transactions` row of type `purchase` is recorded |
| AC-7 | **Given** a customer applies credits to an eligible cart item at checkout **When** the order is placed **Then** `available_credits` decreases by the applied amount, a `usage`-type `credit_transactions` row references the resulting order, and `orders.credits_used` reflects the amount |
| AC-8 | **Given** a subscription is cancelled/expired **When** the customer's monthly credit allotment date arrives **Then** no further automatic credit grant occurs |
| AC-9 | **Given** a customer upgrades or downgrades their subscription plan mid-billing-cycle **When** the change is confirmed **Then** the price difference is prorated for the remainder of the current cycle and `renewal_date`/the next charge reflects the new plan |
| AC-10 | **Given** a customer wants to gift credits to another customer **When** they specify a recipient and amount within their available balance **Then** the amount is deducted from the sender's `customer_credits` and added to the recipient's, with a `credit_transactions` row of type `adjustment` recorded for each side referencing the gift |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/subscriptions/plans` | Public | `200` | |
| `POST` | `/api/subscriptions/subscribe` | Authenticated customer | `201` | initiates payment for first period |
| `GET` | `/api/subscriptions/current` | Authenticated customer | `200` `CustomerSubscriptionDto` \| `404` | |
| `PUT` | `/api/subscriptions/cancel` | Authenticated customer, own subscription | `200` | AC-4 |
| `GET` / `POST` / `PUT` | `/api/subscriptions` `/plans` `/plans/:id` | `role=admin` | | plan CRUD |
| `GET` | `/api/credits/packages` | Public | `200` | |
| `GET` | `/api/credits/balance` | Authenticated customer | `200` `{ available, used, total }` | |
| `POST` | `/api/credits/purchase` | Authenticated customer | `201` | AC-6 |
| `GET` | `/api/credits/transactions` | Authenticated customer | `200` `PagedResponse<CreditTransactionDto>` | |
| `POST` / `PUT` | `/api/credits/packages` `/:id` | `role=admin` | | package CRUD |

### Error codes (feature-specific)

| HTTP | `code` | When |
|---|---|---|
| `422` | `INSUFFICIENT_CREDITS` | shared with Cart spec — applying more credits than `available_credits` |
| `409` | `ALREADY_SUBSCRIBED` | subscribe attempt while an active subscription exists |
| `422` | `RENEWAL_PAYMENT_FAILED` | AC-3 failure path |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `subscription_plans`, `customer_subscriptions` | existing | per architecture DDL |
| `credit_packages`, `customer_credits`, `credit_transactions` | existing | per architecture DDL; `credit_transactions` is append-only, `customer_credits` is a derived/cached balance |
| `subscription_credit_grants` *(new, proposed)* | proposed | `id`, `customer_subscription_id`, `granted_at`, `credit_transaction_id` — links each monthly grant to its ledger entry, needed to implement AC-3/AC-8 idempotently (avoid double-granting on retry) |

### Migration

- **Name:** `AddSubscriptionCreditGrants`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored alongside implementation

### Retention and privacy

`credit_transactions` and `customer_subscriptions` are financial-adjacent records tied to a
customer identity — same retention posture as Orders (master spec §8).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | pricing-page toggle skeleton while plans/packages load |
| **Empty** | not expected in production (Admin should always have at least one plan/package published); if empty, hide the corresponding toggle rather than show a blank panel |
| **Error** | subscribe/purchase failure shows the specific reason (payment vs. `ALREADY_SUBSCRIBED`) |
| **Success** | active-subscription badge in My Account; credit balance visible in header/account; toast on successful purchase |

**Route(s):** `/pricing`, `/pricing/subscriptions`, `/pricing/credits`, `/account/subscription`,
`/account/credits`, `/admin/pricing`, `/admin/credits`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | credit ledger arithmetic (purchase/usage/refund/adjustment), renewal-date computation, idempotent monthly grant | `apps/api/subscriptions-credits/*.spec.ts` |
| **Integration** | subscribe → renew → cancel lifecycle; credit purchase → apply-to-order → balance decrement | `apps/api/test/integration/subscriptions-credits.spec.ts` |
| **E2E** | buy a plan, see credits appear, apply credits at checkout, cancel subscription and confirm access persists to `end_date` | `e2e/subscriptions-credits.e2e.spec.ts` |
| **Integration** | dunning/retry scheduling for failed subscription renewals (backoff cadence, grace period, lapse) | `apps/api/test/integration/subscription-dunning.spec.ts` |

**Traceability:** AC-1…AC-10 → `subscriptions-credits.integration.spec.ts`.

**Coverage:** ≥85% on the ledger/balance logic specifically (financial correctness).

**Not covered, deliberately:** None — dunning/retry scheduling is covered by the additional
Integration row above (the exact retry cadence remains tracked as an open question in §8).

---

## 7. Out of scope

None — every item previously listed here (mid-cycle proration, gifting credits) has been folded
into AC-9/AC-10 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Recurring billing mechanism for PayPal subscriptions (PayPal Subscriptions API vs. manual re-charge) not specified — architecture only shows one-time PayPal capture flow | Engineering | Open |
| 2 | Exact "eligible purchases" rule for credit application referenced in SRS §11 has no concrete rule engine | Admin | Open |
| 3 | Failed-renewal retry cadence/backoff and grace period before subscription lapses not specified | Admin | Open |

---

## 9. Rollout

- **Feature flag:** `subscriptions-credits-enabled` — this is a Phase 3 feature per the roadmap and
  may ship after core catalog/cart/orders are live; flag defaults off until Phase 3, removed once
  generally available.
- **Migration order:** existing tables from `InitialSchema`, plus `subscription_credit_grants`
  before enabling renewal automation.
- **Rollback:** disable the feature flag; no destructive schema rollback needed since credit ledger
  entries must never be deleted.
- **Observability:** alert on renewal-payment failure rate and on any negative `available_credits`
  balance (a ledger-integrity violation that must never occur).
