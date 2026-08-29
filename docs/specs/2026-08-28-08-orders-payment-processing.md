# Spec: Orders & Payment Processing

**File:** `docs/specs/2026-08-28-08-orders-payment-processing.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Private file management spec](2026-08-28-05-private-file-management.md), [Cart & checkout spec](2026-08-28-07-shopping-cart-checkout.md), SRS §6 Addendum, architecture §Payment Processing

---

## 1. Problem statement

**Today:** There is no order record, no payment confirmation workflow, and no link between "money
received" and "files unlocked." PayPal and Bank Transfer both need distinct, auditable
confirmation paths since one is automatic (webhook) and one is manual (Admin verifies a receipt).

**Who is affected:** Every purchasing customer, whose file access depends entirely on correct order
state transitions; Admin, who must verify bank-transfer receipts and track order/payment status;
finance/reporting, which relies on `orders`/`order_items` as the ledger of record.

**Why it matters now:** This is the trust boundary between "paid" and "not paid" that the entire
private-file-delivery guarantee (see Private File Management spec) depends on.

**Success looks like:** An order moves predictably through
`pending → payment_pending → payment_confirmed → processing → ready → completed`, PayPal
confirmations are automatic and webhook-verified, bank transfers require explicit Admin
confirmation of an uploaded receipt, and every transition fires the correct customer/Admin
notification.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a customer checks out with PayPal **When** PayPal's `payment.capture.completed` webhook is received and its signature verified **Then** the order transitions `payment_pending → payment_confirmed` automatically, files are released, and the customer is notified |
| AC-2 | **Given** a webhook signature fails verification **When** processed **Then** the order is **not** transitioned, the event is logged, and no files are released |
| AC-3 | **Given** a customer checks out with Bank Transfer **When** they view checkout **Then** they see the bank details and a unique auto-generated reference number for that order |
| AC-4 | **Given** a customer uploads a payment receipt for a bank-transfer order **When** the upload succeeds **Then** Admin receives an immediate notification and the order is flagged for review |
| AC-5 | **Given** Admin reviews an uploaded receipt **When** they mark it Confirmed **Then** the order transitions to `payment_confirmed`, files release, and the customer is notified; **given** they mark it Rejected/Pending **then** the customer is notified of that outcome without file release |
| AC-6 | **Given** an order's `payment_status` is anything other than `completed` **When** any file-download route is called for that order **Then** it is rejected per the Private File Management spec (AC-5 there) |
| AC-7 | **Given** a customer completes any purchase **When** the order is created **Then** it is permanently linked to that customer's persistent identity so all past and future purchases accumulate in one order history (SRS Addendum §6) |
| AC-8 | **Given** an order total needs to display in a customer's local currency **When** the order/cart is rendered for a non-Pakistani customer **Then** PKR (source of truth) and the converted local-currency amount both display, using an hourly-refreshed exchange rate |
| AC-9 | **Given** Admin changes bank receiving details or PayPal credentials from Settings **When** saved **Then** all future checkouts immediately use the updated details, with no code deploy |
| AC-10 | **Given** a customer checks out with a credit/debit card **When** Stripe processes the charge (3D Secure where required) and confirms via webhook **Then** the order transitions `payment_pending → payment_confirmed` the same way as AC-1 for PayPal, files release, and the customer is notified |
| AC-11 | **Given** Admin issues a full or partial refund on a `payment_confirmed` order **When** the refund is processed **Then** `orders.payment_status` reflects `refunded` (full) or a partial-refund amount is recorded, previously-released file access is re-evaluated per Admin policy, and any credits used on that order are reversed |
| AC-12 | **Given** a customer's subscription renewal charge (per the Subscriptions & Credits spec) **When** it is processed through this payment layer **Then** it follows the same order/payment state machine as a one-time purchase, tagged as a renewal transaction |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/orders` | Authenticated customer | `201` | created from cart contents, see Cart spec AC-6 |
| `GET` | `/api/orders/:id` | Owner or `role=admin` | `200` `OrderDto` | |
| `GET` | `/api/orders/user/history` | Authenticated customer | `200` `PagedResponse<OrderSummaryDto>` | AC-7 |
| `GET` | `/api/orders` | `role=admin` | `200` | filterable list |
| `PUT` | `/api/orders/:id/status` | `role=admin` | `200` | manual status transitions (bank transfer path) |
| `POST` | `/api/orders/:id/payment-confirmation` | `role=admin` | `200` | AC-5 |
| `POST` | `/api/webhooks/paypal` | PayPal (signature-verified) | `200` | AC-1/AC-2, not user-invocable |
| `POST` | `/api/orders/:id/receipt` *(new, proposed)* | Authenticated customer, own order only | `201` | receipt image/file upload for bank transfer — not listed in architecture's endpoint inventory but required by AC-4 |

### Order state machine (authoritative)

```
pending → payment_pending → payment_confirmed → processing → ready → completed
                    ↘ (rejected receipt) → payment_pending (retry) / cancelled
```

### Error codes (feature-specific)

| HTTP | `code` | When |
|---|---|---|
| `422` | `INVALID_WEBHOOK_SIGNATURE` | AC-2 |
| `409` | `ORDER_ALREADY_CONFIRMED` | duplicate confirmation attempt |
| `422` | `RECEIPT_REQUIRED` | bank-transfer order confirmation attempted with no receipt on file |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `orders`, `order_items` | existing | per architecture DDL; state machine above must match `order_status` enum exactly |
| `payment_receipts` *(new, proposed)* | proposed | `id`, `order_id`, `file_url` (private storage), `uploaded_at`, `reviewed_by_admin_id`, `review_status` enum(`pending`,`confirmed`,`rejected`), `reviewed_at` — required for AC-3/AC-4/AC-5, absent from current DDL |
| `exchange_rates` *(new, proposed)* | proposed | `currency_code`, `rate_to_pkr`, `updated_at` — required for AC-8, absent from current DDL |

### Migration

- **Name:** `AddPaymentReceiptsAndExchangeRates`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored; the core `orders`/`order_items` DDL is already reviewed in the
  master spec's `InitialSchema`

### Retention and privacy

Payment receipts may contain bank account details belonging to the customer (sender info on a
transfer slip) — treat `payment_receipts.file_url` with the same private-storage protection as
embroidery files (never public, signed-URL access for Admin review only). Retention period tracked
in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | checkout submit button disabled with spinner while order/payment intent is created |
| **Empty** | Order History with zero orders shows "No orders yet" + link to catalog |
| **Error** | payment failure shows the specific reason (e.g. PayPal declined vs. webhook mismatch) without leaking internal signature-verification detail; bank-transfer rejection shows Admin's stated reason if provided |
| **Success** | order confirmation screen with order number, next steps, and (once confirmed) a link to purchased files |

**Route(s):** `/checkout`, `/checkout/bank-transfer`, `/order-confirmation/:id`, `/account/orders`,
`/admin/orders`, `/admin/orders/:id`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | order state-machine transition rules, PKR↔local-currency conversion math | `apps/api/orders/*.spec.ts` |
| **Integration** | PayPal webhook happy/invalid-signature paths, bank-transfer receipt → admin confirm → file release, order history aggregation | `apps/api/test/integration/orders.spec.ts` |
| **E2E** | full PayPal purchase → files downloadable; full bank-transfer purchase → receipt upload → admin confirms → files downloadable | `e2e/orders-payment.e2e.spec.ts` |
| **Integration** | Stripe credit/debit card checkout, 3D Secure, and webhook confirmation | `apps/api/test/integration/stripe-payments.spec.ts` |

**Traceability:** AC-1…AC-12 → `orders.integration.spec.ts` / `orders-payment.e2e.spec.ts`.

**Coverage:** ≥85% on this feature (payment correctness is high-stakes).

**Not covered, deliberately:** None — Stripe/credit-card integration is covered by the additional
Integration row above.

---

## 7. Out of scope

None — every item previously listed here (Stripe/credit-card payments, partial refunds/cancellation,
recurring/subscription billing) has been folded into AC-10–AC-12 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `payment_receipts` and `exchange_rates` tables are required by explicit SRS/architecture requirements but are absent from the current DDL | Engineering | Open |
| 2 | Refund workflow (who triggers it, does it re-lock files, does it reverse credits) is not specified beyond the `refunded` enum value existing | Admin | Open |
| 3 | Exchange-rate provider (OpenExchangeRates vs. Fixer.io) not finalized (duplicated from master spec §8 risk #5) | Admin | Open |
| 4 | Whether a rejected bank-transfer receipt allows the customer to re-upload on the same order, or requires a new order | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — core purchase path, ships with Phase 1 MVP per the roadmap.
- **Migration order:** `orders`/`order_items` first (already in `InitialSchema`), then
  `payment_receipts`/`exchange_rates` before enabling bank-transfer checkout in the UI.
- **Rollback:** if payment processing must be rolled back post-launch, orders already in
  `payment_confirmed` or later must **not** be reverted — rollback applies to code only, never to
  financial state.
- **Observability:** alert on PayPal webhook failure rate, on any order stuck in
  `payment_pending` beyond a configurable SLA, and on file-release failures after confirmation
  (AC-1/AC-5 completing without triggering AC-6's downstream file authorization is a critical bug).
