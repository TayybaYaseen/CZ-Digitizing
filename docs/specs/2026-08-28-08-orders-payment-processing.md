# Spec: Orders & Payment Processing

**File:** `docs/specs/2026-08-28-08-orders-payment-processing.md`
**Status:** Approved
**Implementation status:** **In Progress** (2026-09-19) — the critical findings of the 2026-09-19 audit are fixed and tested, but not every AC is complete; see [§10](#10-implementation-status-2026-09-19) for the honest per-AC table. `SPEC_INDEX.md` A-013 is `In Progress` until it is.
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
| `PUT` | `/api/orders/:id/status` | `role=admin` | `200` | manual status transitions. **`payment_confirmed` and `refunded` are refused here** (`PAYMENT_CONFIRMATION_REQUIRED` / `RECEIPT_REQUIRED` / `ORDER_ALREADY_CONFIRMED` / `USE_REFUND_ENDPOINT`): a payment is confirmed only by an approved receipt, a verified provider payment, or credits covering the order |
| `POST` | `/api/orders/:id/payment-confirmation` | `role=admin` | `201` (Nest's POST default; the original table said `200`) | AC-5. Approve/reject the **latest pending** receipt of a bank-transfer order that is still `payment_pending`; a cancelled/refunded order can never be confirmed this way (`ORDER_NOT_PAYABLE`) |
| `PUT` | `/api/orders/:id/refund` | `role=admin` | `200` | AC-11 (was not in the original table) — records a full/partial refund **in this system only**; it does not call PayPal/Stripe |
| `POST` | `/api/orders/:id/payment-session` | Authenticated customer, own order | `200` `PaymentSessionDto` | AC-1/AC-10 — starts or restarts the provider payment: PayPal approval link, or Stripe client secret + publishable key. Reload-safe; re-uses the amount locked at checkout. Confirms nothing |
| `POST` | `/api/orders/:id/verify-payment` | Authenticated customer, own order | `200` `OrderDto` | AC-1/AC-10 — the **server** reads the payment's real state from PayPal/Stripe (capturing a buyer-approved PayPal order), checks amount/currency against the locked amount, and only then confirms. The client supplies nothing |
| `POST` | `/api/orders/:id/reverify-payment` | `role=admin` | `200` `OrderDto` | same verification, Admin-triggered for any provider order (missed webhook) |
| `GET` | `/api/orders/:id/receipts/:receiptId/file` | `role=admin` (staff) | `200` bytes | AC-4/AC-5 — Admin previews the receipt before deciding. Staff-only, `no-store`, `nosniff`; never a public URL and never the storage path |
| `GET` | `/api/orders?receiptStatus=pending` | `role=admin` | `200` `PagedResponse<AdminOrderSummaryDto>` | AC-4 — the receipt review queue (bank-transfer orders awaiting payment with a pending receipt, oldest first, with customer identity) |
| `POST` | `/api/webhooks/paypal` | PayPal (signature-verified) | `200` | AC-1/AC-2, not user-invocable. A valid signature is necessary, not sufficient: amount, currency and provider reference must also match the order |
| `POST` | `/api/webhooks/stripe` | Stripe (signature-verified) | `200` | AC-10, same rules |
| `POST` | `/api/orders/:id/receipt` | Authenticated customer, own order only | `201` | receipt upload for bank transfer (required by AC-4). JPEG/PNG/WebP/PDF only, decided by file signature, ≤ 10 MB; only while the order is `payment_pending`; one receipt awaiting review at a time (`RECEIPT_ALREADY_PENDING`) |

Money rules that apply to every route above: an order's PKR total is the source of truth; PayPal and
Stripe are charged in `PAYMENT_PROVIDER_CURRENCY` (default USD) at the rate in `exchange_rates` **when
the order is created**, and that amount is locked on the order (`orders.provider_*`). Provider payments
fail closed (`503 PAYMENT_CURRENCY_UNAVAILABLE`) if no fresh rate exists — a rate is never guessed.
Credits are applied first and capped at the order total; only the remainder is charged. An order fully
covered by credits is `payment_confirmed` immediately, with no bank reference and no provider call.

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
| `422` | `RECEIPT_REQUIRED` | bank-transfer order confirmation attempted with no receipt on file (or only an already-reviewed one) — on `payment-confirmation` and on `PUT /status` |
| `409` | `ORDER_NOT_PAYABLE` | payment/receipt/verify attempted on an order that is not `payment_pending` (cancelled, refunded, ...) |
| `409` | `ORDER_STATE_CHANGED` | a concurrent change won the race (two admins, admin vs. webhook) |
| `409` | `PAYMENT_CONFIRMATION_REQUIRED` | `PUT /status` -> `payment_confirmed` on an unpaid order |
| `409` | `USE_REFUND_ENDPOINT` | `PUT /status` -> `refunded` |
| `409` | `RECEIPT_ALREADY_PENDING` | a receipt is already awaiting review for this order |
| `409` | `CART_CHANGED` | checkout of a cart that was already checked out / changed underneath the request |
| `409` | `PAYMENT_NOT_APPROVED` / `PAYMENT_AMOUNT_MISMATCH` | server-side verification: buyer hasn't approved yet / provider amount or currency differs from the locked one |
| `409` | `PAYMENT_NOT_STARTED` | verify on an order with no provider payment yet |
| `415` | `UNSUPPORTED_FILE_TYPE` | receipt is not a JPEG/PNG/WebP/PDF |
| `422` | `PAYMENT_AMOUNT_TOO_SMALL` | amount rounds to zero in the provider currency |
| `502` | `PAYMENT_PROVIDER_ERROR` | PayPal/Stripe could not be reached |
| `503` | `PAYMENT_METHOD_UNAVAILABLE` / `PAYMENT_CURRENCY_UNAVAILABLE` | provider not configured / no usable exchange rate — raised **before** any order is created |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `orders`, `order_items` | existing | per architecture DDL; state machine above must match `order_status` enum exactly |
| `payment_receipts` | **built** | `id`, `order_id`, `file_url` (private storage), `uploaded_at`, `reviewed_by_admin_id`, `review_status` enum(`pending`,`confirmed`,`rejected`), `reviewed_at`, `rejection_reason`; **+ `content_type`, `original_filename`** (2026-09-19: detected type, for the Admin preview) |
| `exchange_rates` | **built** | `currency_code`, `rate_to_pkr`, `updated_at`; seeded at boot when empty and refreshed hourly |
| `orders` (provider amount lock) | **added 2026-09-19** | `provider_currency`, `provider_amount_minor`, `provider_rate_to_pkr`, `provider_charge_pkr` — the amount PayPal/Stripe is expected to collect, locked at order creation and compared by every webhook / verify call. All nullable; an order without them fails closed (cannot be confirmed by a provider event) |

### Migrations

- **`20260903120000_add_orders_payments_receipts_exchange_rates`** — receipts + exchange rates (applied).
- **`20260919120000_add_provider_payment_amounts_and_receipt_metadata`** — the columns above.
- **Reversible:** yes (drop the added columns) · **Backfill required:** no · **Downtime:** none

### Retention and privacy

Payment receipts may contain bank account details belonging to the customer (sender info on a
transfer slip) — treat `payment_receipts.file_url` with the same private-storage protection as
embroidery files (never public, Admin review only). **Built as:** files live under the private
storage root; the only way to read one is `GET /api/orders/:id/receipts/:receiptId/file`, gated to
staff roles + the `orders` permission, served `no-store`/`nosniff`, and only if the bytes still pass
the JPEG/PNG/WebP/PDF signature check. (An authenticated fetch is used instead of a signed URL because
only staff ever view receipts.) Retention period tracked in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | checkout submit button disabled with spinner while order/payment intent is created |
| **Empty** | Order History with zero orders shows "No orders yet" + link to catalog |
| **Error** | payment failure shows the specific reason (e.g. PayPal declined vs. webhook mismatch) without leaking internal signature-verification detail; bank-transfer rejection shows Admin's stated reason if provided |
| **Success** | order confirmation screen with order number, next steps, and (once confirmed) a link to purchased files |

**Route(s):** `/checkout`, `/checkout/bank-transfer/:id`, **`/checkout/pay/:id`** (PayPal redirect and
the Stripe Payment Element; ends at `verify-payment`), `/order-confirmation/:id` (re-checks with the
server while a provider payment is unconfirmed), `/account/orders`, `/admin/orders`,
`/admin/orders/:id` (receipt preview next to Confirm/Reject), **`/admin/payments`** (the receipt queue).

*Known gap:* a provider *decline* is shown to the customer with the provider's own message on the
card form, but no `failed` payment status is recorded on the order (`paymentStatus = failed` is never
set), so Admin cannot see failed attempts.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | order state-machine + payment-gated statuses, PKR→provider conversion (`provider-amount.util`, `payment-amount.service`), receipt file-type detection, PayPal/Stripe service payloads and real Stripe signature verification | `apps/api/src/orders/**/*.spec.ts`, `apps/api/src/payments/*.spec.ts` |
| **Integration** | bank transfer + receipt queue/preview/approve/reject/re-upload, cancelled-order protection, payment-bypass guards, credits cap, duplicate checkout, history, currency, settings, refunds | `apps/api/test/integration/orders.spec.ts` |
| **Integration** | PayPal: payment session, server-side capture/verification, amount/currency/signature validation, duplicate events | `apps/api/test/integration/paypal-payments.spec.ts` |
| **Integration** | Stripe: client secret, server verification, webhook signature/amount/currency validation, duplicate events | `apps/api/test/integration/stripe-payments.spec.ts` |
| **E2E** | full PayPal purchase → files downloadable; full Stripe purchase; full bank-transfer purchase → receipt → admin confirms → files downloadable; credits | `e2e/orders-payment.e2e.spec.ts` |

The integration/e2e specs share `apps/api/test/integration/helpers/orders-harness.ts`, which **refuses to
run unless `DATABASE_URL` names a throwaway database** (they truncate tables) and fakes PayPal/Stripe
at the network boundary only (Stripe webhook signatures are verified by the real Stripe SDK).

**Traceability:** see the per-AC table in §10 (each row names its tests).

**Coverage:** the ≥85% target is **not yet measured or met** — unit coverage of the orders module is low
because the service layer is exercised through the integration suite, whose coverage is not reported.

**Not covered:** live PayPal-sandbox and live Stripe (card form + 3-D Secure) runs — no credentials
exist in this repo, so both providers are exercised through fakes/stand-ins only (see §10).

---

## 7. Out of scope

None — every item previously listed here (Stripe/credit-card payments, partial refunds/cancellation,
recurring/subscription billing) has been folded into AC-10–AC-12 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | ~~`payment_receipts` and `exchange_rates` tables absent from the DDL~~ | Engineering | **Resolved** — both tables exist (migration `20260903120000_...`) |
| 2 | Refund workflow: a full refund reverses credits, re-locks file access and notifies, but **no money is returned through PayPal/Stripe** (no provider refund call exists); partial refunds overwrite instead of accumulating and can exceed the total; whether a *partial* refund re-locks files is undecided; the Admin UI offers only a full refund, with no confirmation step | Admin / Engineering | **Open** — deliberately not redesigned in the 2026-09-19 iteration |
| 3 | Exchange-rate provider (OpenExchangeRates vs. Fixer.io) not finalized. Until it is, rates are the built-in approximate fallback table (and the live-provider path still pins USD→PKR to that table), so PKR→USD conversion is only as good as that table. Provider payments now fail closed on a missing/stale rate, but a *fresh fallback* rate is still not market data | Admin | **Open — must be closed before charging real customers** |
| 4 | ~~Rejected bank-transfer receipt: same order or new order?~~ | Admin | **Resolved** — same order; the customer re-uploads, one receipt awaiting review at a time |
| 5 | AC-9 wording says Admin changes "PayPal credentials from Settings"; credentials (and the Stripe keys) are server environment variables by design (secrets never live in `payment_method_settings.config`), so changing them needs a config change + restart | Admin | **Open** — decide whether AC-9 means bank details only, or build a secrets-store-backed settings path |
| 6 | AC-12 (renewal charges as orders tagged `renewal`) is not implemented: subscription renewals use `pending_subscription_payments`, and nothing writes `transaction_type = renewal` | Engineering | **Open** |
| 7 | The credits and subscription payment webhooks (`/api/webhooks/subscriptions/*`, credits) still confirm on a valid signature without comparing the paid amount; only their creation-time currency conversion was fixed. They belong to A-015 | Engineering | **Open** |
| 8 | PayPal registers one `webhook_id` per endpoint URL, but `PAYPAL_WEBHOOK_ID` is a single value used for the orders, credits and subscriptions endpoints; at least two of the three will fail signature verification against a real PayPal account until this is split per endpoint | Engineering | **Open — verify in the PayPal dashboard** |
| 9 | If money arrives (webhook) for an order that was cancelled meanwhile, the order is deliberately **not** revived; it is logged at error level and needs a manual refund at the provider | Admin | **Open** — no automatic refund/alert |
| 10 | AC-8: no screen shows a converted (local-currency) amount; only `GET /api/orders/:id?currencyCode=` returns one | Engineering | **Open** |

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

---

## 10. Implementation status (2026-09-19)

Written after the 2026-09-19 completeness audit and the critical-fix iteration on branch
`feature/orders-payment-critical-fixes`. **Verified** means an automated test *and* (where a UI is
involved) a real-browser run against a throwaway database with a local PayPal stand-in. **Nothing here
has been verified against real PayPal or Stripe accounts** — none are configured in this repo.

| AC | Status | What is true today |
|---|---|---|
| AC-1 PayPal → confirmed | **Implemented; provider-side unverified** | Checkout returns an approval link; the buyer is redirected to PayPal and back; the **server** reads/captures the order at PayPal, compares amount + currency with the locked amount, then confirms and releases files exactly once. Webhook path does the same checks. Tests: `paypal-payments.spec.ts`, e2e, live run. Not yet run against the real PayPal sandbox (request shape, `payment_source` handling and the webhook-id question in §8 #8 are unproven) |
| AC-2 bad signature | **Done** | PayPal + Stripe: 422, nothing transitions, logged. `paypal-payments.spec.ts`, `stripe-payments.spec.ts`, live |
| AC-3 bank details + reference | **Done** | Unique `CZD-XXXX-XXXX` reference and the Admin-configured bank details; the amount shown is what is actually due (after credits). `orders.spec.ts`, live |
| AC-4 receipt upload + Admin notified + flagged | **Done** | Signature-checked JPEG/PNG/WebP/PDF ≤ 10 MB; every Admin notified; the order appears in the `/admin/payments` queue; Admin sees the file before deciding. `orders.spec.ts`, live |
| AC-5 confirm / reject | **Done** | Approve releases files once; reject shows the reason and allows same-order re-upload; only a `payment_pending` order with a pending receipt can be confirmed, so a **cancelled order cannot be revived**; `PUT /status` can no longer set `payment_confirmed`/`refunded`. `orders.spec.ts`, live |
| AC-6 files blocked until paid | **Done** (download bytes: see note) | Every unpaid status/method is blocked; a full refund blocks again. *Note:* `POST .../download` returns a signed token but no route serves the bytes for it — that gap belongs to the Private File Management spec (A-007) |
| AC-7 order history | **Done** | Scoped, paginated, newest first. `orders.spec.ts`, live |
| AC-8 local currency | **Partial** | `GET /api/orders/:id?currencyCode=` returns PKR + converted amount and rates are seeded at boot (no more empty-table gap). Still: the rates are the approximate built-in table (§8 #3); no cart/checkout/order screen displays a converted amount (§8 #10); the history summary is PKR-only |
| AC-9 settings without deploy | **Partial** | Bank details apply to the very next checkout (tested + live). PayPal/Stripe credentials are environment variables (§8 #5) |
| AC-10 Stripe card + 3-D Secure | **Implemented; provider-side unverified** | Checkout returns a client secret + publishable key; `/checkout/pay/:id` mounts Stripe's Payment Element (which runs 3-D Secure) and ends at server-side verification; the webhook uses the real Stripe signature scheme and the same amount/currency/intent checks. Backend fully tested. The card form itself was **not** exercised (needs a real Stripe key); the Stripe-unreachable error path was |
| AC-11 refunds | **Partial** | Full refund: status + payment status, credits reversed, files re-locked, customer notified, audit-logged (tested). Not done: provider refunds, accumulating/capped partial refunds, a partial-refund file policy, a confirm step (§8 #2) |
| AC-12 renewals as orders | **Not implemented** | §8 #6 |

**Also fixed in this iteration (each with a regression test):** PKR was sent to PayPal/Stripe as if it
were USD (Rs 1,500 → `USD 1500.00` / 150,000 cents; now USD 5.39 / 539 cents from the stored rate,
locked on the order); signed webhooks confirmed without comparing amounts; credits over-deducted
(5,000 credits on a Rs 1,500 order used all 5,000; now 1,500) and a credit-covered bank order still asked
for a transfer; duplicate/simultaneous webhooks sent duplicate notifications; duplicate checkout created
two orders (the cart row is now locked and re-checked inside the order transaction).
