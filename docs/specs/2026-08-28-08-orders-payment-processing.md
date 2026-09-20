# Spec: Orders & Payment Processing

**File:** `docs/specs/2026-08-28-08-orders-payment-processing.md`
**Status:** Approved — **amended 2026-09-19 by business decision: BANK TRANSFER ONLY** (see [§11](#11-business-decision-2026-09-19--bank-transfer-only)) and **2026-09-20: FINAL PAYMENT ACCESS POLICY** (see [§12](#12-final-payment-access-policy-2026-09-20))
**Implementation status:** **In Progress** — the Bank Transfer workflow, security checks, credits, manual refunds, purchases-as-orders and renewals are implemented, tested and browser-verified. One acceptance criterion is not fully done and waits on a **product decision, not on engineering**: AC-8 (local-currency display). The file-access policy is decided and implemented ([§12](#12-final-payment-access-policy-2026-09-20)): **customer files are unlocked only after 100% of the order amount has been paid and the payment has been confirmed by an authorized admin.** See [§10](#10-implementation-status-2026-09-19). `SPEC_INDEX.md` A-013 stays `In Progress` until AC-8 is decided and closed.
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Private file management spec](2026-08-28-05-private-file-management.md), [Cart & checkout spec](2026-08-28-07-shopping-cart-checkout.md), [Subscriptions & credits spec](2026-08-28-09-subscriptions-credits.md), SRS §6 Addendum, architecture §Payment Processing

---

## 1. Problem statement

**Today:** Payment is by **bank transfer only**. The customer transfers the exact PKR amount to the bank
account an Admin configured in Settings, uploads a receipt, and an Admin approving that receipt is the
only thing that confirms payment and releases files. Every step must be auditable, and the trust
boundary between "paid" and "not paid" must not be bypassable.

**Who is affected:** Every purchasing customer, whose file access depends entirely on correct order
state transitions; Admin, who must verify bank-transfer receipts and track order/payment status;
finance/reporting, which relies on `orders`/`order_items` as the ledger of record.

**Why it matters now:** This is the trust boundary between "paid" and "not paid" that the entire
private-file-delivery guarantee (see Private File Management spec) depends on.

**Success looks like:** An order moves predictably through
`pending → payment_pending → payment_confirmed → processing → ready → completed`, bank transfers require
explicit Admin approval of an uploaded receipt, and every transition fires the correct customer/Admin
notification.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | ~~PayPal capture webhook confirms the order~~ — **NOT APPLICABLE — BUSINESS DECISION** (PayPal removed; bank transfer only). Not an implementation bug |
| AC-2 | ~~Provider webhook signature verification~~ — **NOT APPLICABLE — BUSINESS DECISION** (there is no provider webhook; Admin approval is the only confirmation mechanism). Replaced by the guarantees under AC-5 and §11 (no endpoint, header or body a caller can send can confirm a payment) |
| AC-3 | **Given** a customer checks out **When** they view the payment page **Then** they see the **exact PKR amount** to transfer, the **bank details Admin configured in Settings** (bank name, account title, account number, IBAN, additional instructions), and a unique auto-generated reference number for that order |
| AC-4 | **Given** a customer uploads a payment receipt for an order **When** the upload succeeds **Then** Admin receives an immediate notification and the order is flagged for review |
| AC-5 | **Given** Admin reviews an uploaded receipt **When** they approve it for the **full outstanding amount** **Then** the order transitions to `payment_confirmed`, files release, and the customer is notified; **given** they approve it for **less** than the outstanding amount (a partial payment) **then** the money is recorded, the order stays unpaid and its files stay locked; **given** they reject it (with a reason) **then** the customer is told why and that a new receipt is required, without file release. A cancelled/refunded order is never revived by a late receipt, and a duplicate/concurrent approval has no duplicate effect |
| AC-6 | **Given** an order is not **fully paid and confirmed** — its `payment_status` is anything other than `completed` (unpaid, awaiting payment, receipt uploaded but not approved, receipt rejected, partially paid, partially or fully refunded) **or** it is cancelled **When** any file route is called for that order **Then** it is rejected (`422 PAYMENT_NOT_CONFIRMED`) per the Private File Management spec (AC-5 there). **Customer files are unlocked only after 100% of the order amount has been paid and the payment has been confirmed by an authorized admin. Partial payment never unlocks files.** See [§12](#12-final-payment-access-policy-2026-09-20) |
| AC-7 | **Given** a customer completes any purchase **When** the order is created **Then** it is permanently linked to that customer's persistent identity so all past and future purchases accumulate in one order history (SRS Addendum §6) |
| AC-8 | **Given** an order total needs to display in a customer's local currency **When** the order is fetched with `?currencyCode=` **Then** PKR (source of truth) and a converted local-currency amount are returned, using an hourly-refreshed exchange rate. **Display only — it never changes what a customer must transfer, which is always the exact PKR amount** |
| AC-9 | **Given** Admin changes the bank receiving details from Settings **When** saved **Then** all future payment pages immediately show the updated details, with no code deploy |
| AC-10 | ~~Stripe card payment with 3-D Secure~~ — **NOT APPLICABLE — BUSINESS DECISION** (Stripe/card payments are not part of the product). Not an implementation bug |
| AC-11 | **Given** Admin records a full or partial refund on a `payment_confirmed` order **When** it is recorded **Then** `orders.payment_status` reflects `refunded` (full) or the cumulative partial amount is recorded — **never above what the customer actually transferred (`total − credits used`)** — **any refund — a partial refund included — re-locks the customer's files**, and the credits used on that order are restored exactly once when the refund completes. After any refund the original order is no longer fully paid for file-access purposes ([§12](#12-final-payment-access-policy-2026-09-20)). **Refunds are manual**: the system records them; the money is returned to the customer's bank account by an Admin outside the system |
| AC-12 | **Given** a subscription first payment or renewal (per the Subscriptions & Credits spec) **When** it is processed **Then** it is an ordinary bank-transfer order following the same state machine, tagged `purchase` / `renewal`; approving its receipt activates/extends the subscription and grants the monthly credits exactly once |
| AC-13 | **Given** a customer buys a credit package (Subscriptions & Credits AC-5/AC-6) **When** they pay **Then** it is a bank-transfer order for the exact PKR price; approving the receipt adds the package's credits exactly once |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/cart/checkout` | Authenticated customer | `201` `OrderDto` | Creates the order from the cart (Cart spec AC-6). `paymentMethod` is optional and can only be `bank_transfer`; any other value is a `400`. Credits are applied first (capped at the order total); only the remainder is to be transferred. An order fully covered by credits is `payment_confirmed` immediately with no bank reference and no receipt |
| `GET` | `/api/orders/:id` | Owner or `role=admin` | `200` `OrderDto` | `amountDuePkr` = `totalPkr − creditsUsed`, the exact PKR amount to transfer. `amountPaidPkr` / `amountOutstandingPkr` show what Admin has confirmed so far and what is still owed; `filesUnlocked` is the **server's** file-access decision (clients display it, never compute it). `?currencyCode=` adds a display-only converted amount |
| `GET` | `/api/orders/user/history` | Authenticated customer | `200` `PagedResponse<OrderSummaryDto>` | AC-7 |
| `GET` | `/api/orders` | `role=admin` | `200` | filterable list |
| `PUT` | `/api/orders/:id/status` | `role=admin` | `200` | manual status transitions. **`payment_confirmed` and `refunded` are refused here** (`PAYMENT_CONFIRMATION_REQUIRED` / `RECEIPT_REQUIRED` / `ORDER_ALREADY_CONFIRMED` / `USE_REFUND_ENDPOINT`): a payment is confirmed only by an approved receipt or by credits covering the order |
| `POST` | `/api/orders/:id/payment-confirmation` | `role=admin` | `201` | AC-5. Approve/reject the **latest pending** receipt of an order that is still `payment_pending`; a cancelled/refunded order can never be confirmed this way (`ORDER_NOT_PAYABLE`). Body: `approve`, optional `amountPkr` (the PKR Admin confirms was **actually received** for this receipt; omitted = the whole outstanding amount; `null`, ≤ 0, > outstanding or > 2 decimals is a `400`). The order becomes `payment_confirmed` — and files unlock — **only when credits + all confirmed receipts reach 100% of the total**; a smaller confirmation records a **partial payment** (the receipt is `confirmed` with its amount, the order stays `payment_pending` / `paymentStatus: pending`, files stay locked, the customer uploads another receipt for the remainder). The order row is locked for the whole transaction, so duplicate/concurrent/replayed approvals are judged one after another and can never count the same money twice. Receipt claim, order transition and (for credit/subscription orders) fulfilment happen in **one transaction** |
| `PUT` | `/api/orders/:id/refund` | `role=admin` | `200` | AC-11 — **manual**: records a full/partial refund in this system only. The refundable ceiling is `total − credits used` (what was actually transferred); partial refunds accumulate and cannot exceed it; **every refund, a partial one included, re-locks the customer's files**; concurrent refunds apply once; credits are restored once when the refund completes (an order paid entirely with credits takes a single zero-amount refund that only restores them); credit-package and subscription orders are refused (`REFUND_NOT_SUPPORTED`) |
| `GET` | `/api/orders/:id/receipts/:receiptId/file` | `role=admin` (staff) | `200` bytes | AC-4/AC-5 — Admin previews the receipt before deciding. Staff-only, `no-store`, `nosniff`; never a public URL and never the storage path |
| `GET` | `/api/orders?receiptStatus=pending` | `role=admin` | `200` `PagedResponse<AdminOrderSummaryDto>` | AC-4 — the receipt review queue (orders awaiting payment with a pending receipt, oldest first, with customer identity) |
| `POST` | `/api/orders/:id/receipt` | Authenticated customer, own order only | `201` | receipt upload (AC-4). JPEG/PNG/WebP/PDF only, decided by file signature, ≤ 10 MB; only while the order is `payment_pending`; one receipt awaiting review at a time (`RECEIPT_ALREADY_PENDING`); refused on a paid order (`ORDER_ALREADY_CONFIRMED`) |
| `GET` | `/api/settings/public` | public | `200` | `bankTransferConfig` — the Admin-configured bank details the payment page shows (AC-3/AC-9) |
| `PUT` | `/api/admin/settings/payment-methods` | `role=admin` | `200` | Admin edits the bank details (AC-9). Only `bankName`, `accountTitle`, `accountNumber`, `iban`, `instructions` are stored/returned |
| `POST` | `/api/credits/purchase` | Authenticated customer | `201` `OrderDto` | AC-13 — creates (or returns the still-unpaid) bank-transfer order for the package |
| `POST` | `/api/subscriptions/subscribe` | Authenticated customer | `201` `OrderDto` | AC-12 — creates (or returns the still-unpaid) bank-transfer order for the plan |

**There are no payment-provider endpoints** — no `payment-session`, `verify-payment`, `reverify-payment`
or `/api/webhooks/*` routes exist (they return `404`), and nothing a client or third party sends can
mark an order paid.

Money rules that apply to every route above: an order's PKR total is the source of truth and **the
customer transfers exactly `amountDuePkr` in PKR** — no USD conversion, no provider currency, no cents.
Credits are applied first and capped at the order total. Exchange rates exist only for the display-only
`?currencyCode=` conversion (AC-8).

### Order state machine (authoritative)

```
pending → payment_pending → payment_confirmed → processing → ready → completed
                    ↘ (rejected receipt) → payment_pending (retry) / cancelled
```

Cancelling an order that was **never paid** (`payment_status ≠ completed`) returns any credits it used, once, in the same transaction as the status change. Cancelling a **paid** order does not move money or credits by itself — a refund is recorded through the refund action.

A credit-package or subscription order is its own deliverable: approving its receipt grants the
credits / activates the subscription and moves the order straight to `completed` (nothing to process or
ship).

### Error codes (feature-specific)

| HTTP | `code` | When |
|---|---|---|
| `409` | `ORDER_ALREADY_CONFIRMED` | duplicate confirmation attempt; receipt on an already-paid order |
| `422` | `RECEIPT_REQUIRED` | confirmation attempted with no receipt on file (or only an already-reviewed one) — on `payment-confirmation` and on `PUT /status` |
| `409` | `ORDER_NOT_PAYABLE` | receipt/approval attempted on an order that is not `payment_pending` (cancelled, refunded, ...) |
| `409` | `ORDER_STATE_CHANGED` | a concurrent change won the race (two admins) |
| `409` | `PAYMENT_CONFIRMATION_REQUIRED` | `PUT /status` -> `payment_confirmed` on an unpaid order |
| `409` | `USE_REFUND_ENDPOINT` | `PUT /status` -> `refunded` |
| `409` | `REFUND_NOT_SUPPORTED` | refund of a credit-package / subscription order (its credits/subscription would not be taken back) |
| `409` | `RECEIPT_ALREADY_PENDING` | a receipt is already awaiting review for this order |
| `409` | `CART_CHANGED` | checkout of a cart that was already checked out / changed underneath the request |
| `409` | `ALREADY_SUBSCRIBED` | subscribing while a subscription is active |
| `415` | `UNSUPPORTED_FILE_TYPE` | receipt is not a JPEG/PNG/WebP/PDF |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `orders`, `order_items` | existing | `orders.payment_method` enum is `bank_transfer` only. `order_items` gains `credit_package_id`, `credits_granted`, `subscription_plan_id` (an item is exactly one of design / bundle / quote / custom request / credit package / subscription plan — DB CHECK `order_item_exactly_one_line_kind`) |
| `orders.refunded_amount_pkr` | semantics fixed 2026-09-19 | cumulative **bank money** refunded (manually); ceiling `total_pkr − credits_used`. Credits come back as credits, never as bank money |
| `payment_receipts` | built | `id`, `order_id`, `file_url` (private storage), `uploaded_at`, `reviewed_by_admin_id`, `review_status` enum(`pending`,`confirmed`,`rejected`), `reviewed_at`, `rejection_reason`, `content_type`, `original_filename` |
| `payment_method_settings` | built | one row, `method = bank_transfer`: `is_enabled` + `config` JSON (`bankName`, `accountTitle`, `accountNumber`, `iban`, `instructions`) |
| `exchange_rates` | built | `currency_code`, `rate_to_pkr`, `updated_at`; **display-only** local-currency conversion (AC-8) |
| *(removed)* | dropped 2026-09-19 | `orders.paypal_order_id`, `paypal_capture_id`, `stripe_payment_intent_id`, `provider_currency`, `provider_amount_minor`, `provider_rate_to_pkr`, `provider_charge_pkr`; tables `pending_subscription_payments`, `pending_credit_purchases`; enum values `paypal`/`stripe` (`PaymentMethod`) and `paypal`/`credit_card` (`PaymentMethodType`) |

### Migrations

- **`20260903120000_add_orders_payments_receipts_exchange_rates`** — receipts + exchange rates (applied).
- **`20260919120000_add_provider_payment_amounts_and_receipt_metadata`** — receipt `content_type`/`original_filename` (the `provider_*` columns it also added are removed again by the next migration).
- **`20260919180000_bank_transfer_only_payments`** — removes the provider columns/tables/enum values; adds the credit-package / subscription order-line columns and the six-way CHECK; rewrites the two seeded FAQ answers that named PayPal (only if unedited). **Safety:** it **aborts** (`RAISE EXCEPTION`, nothing changed) if any order was actually *paid or refunded* through PayPal/Stripe, so real provider transaction ids are never silently lost — reconcile those by hand first. Before dropping columns it copies every legacy provider reference into `audit_logs` (`ORDER_PROVIDER_PAYMENT_METHOD_REMOVED`), and converts still-open PayPal/Stripe orders into ordinary bank-transfer orders (a bank reference is issued if something is due). **Reversible:** no (columns and enum values are dropped; the audit rows keep the references) · **Backfill:** none · **Downtime:** none beyond brief ALTER locks. **Verified** against seeded legacy data, both the conversion path and the abort path.

### Retention and privacy

Payment receipts may contain bank account details belonging to the customer (sender info on a
transfer slip) — treat `payment_receipts.file_url` with the same private-storage protection as
embroidery files (never public, Admin review only). **Built as:** files live under the private
storage root; the only way to read one is `GET /api/orders/:id/receipts/:receiptId/file`, gated to
staff roles + the `orders` permission, served `no-store`/`nosniff`, and only if the bytes still pass
the JPEG/PNG/WebP/PDF signature check. Retention period tracked in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | checkout submit button disabled with spinner while the order is created |
| **Empty** | Order History with zero orders shows "No orders yet" + link to catalog |
| **Error** | a failed upload shows the specific reason; a bank-transfer rejection shows Admin's stated reason and that a **new receipt is required**, and re-opens the upload form on the same order |
| **Success** | order confirmation screen with order number, next steps, and (once confirmed) a link to purchased files |

**Route(s):** `/checkout` (order summary + credits; the only payment method is shown as "Bank Transfer"),
`/checkout/bank-transfer/:id` (the only payment page: exact PKR amount, Admin-configured bank details,
reference, receipt upload), `/order-confirmation/:id`, `/account/orders`, `/admin/orders`,
`/admin/orders/:id` (receipt preview next to Confirm/Reject-with-reason and a manual refund record),
`/admin/payments` (the receipt queue), `/admin/settings/platform` (bank details). No screen offers,
names or hints at PayPal, Stripe or card payment.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | order state-machine + payment-gated statuses, PKR formatting, receipt file-type detection, bank-config sanitising, credits ledger idempotency (`grantPurchase`, `reverseUsageOnOrder`), subscription activation, and a **repo-wide guard** that fails if PayPal/Stripe code, dependencies, env vars, routes or UI strings return | `apps/api/src/orders/**/*.spec.ts`, `src/credits`, `src/subscriptions`, `src/settings`, `src/payments/bank-transfer-only.spec.ts` |
| **Integration** | checkout with exact PKR, bank details from Admin Settings, receipt upload/queue/preview, approve/reject/re-upload, cancelled-order protection, payment-bypass guards, duplicate approval, credits cap/double-spend/refund-once, fully-credit-covered and already-paid orders, no provider routes (`404`) / no provider values (`400`) / no provider DB columns, manual + accumulating refunds | `apps/api/test/integration/orders.spec.ts` |
| **Integration** | credit-package and subscription purchases, renewals (`renewal` orders, reminders, lapse, receipt-pending is not a missed attempt), duplicate approval, refund refusal, package/plan deletion guards | `apps/api/test/integration/purchases-bank-transfer.spec.ts`, `subscriptions-credits.spec.ts` |
| **E2E (API-level walk)** | Admin sets bank details → checkout → payment page data → receipt → Admin queue + preview → approve → files downloadable; reject → new receipt; credits; credit-package and subscription/renewal flows | `e2e/orders-payment.e2e.spec.ts` |

The integration/e2e specs share `apps/api/test/integration/helpers/orders-harness.ts`, which **refuses to
run unless `DATABASE_URL` names a throwaway database** (they truncate tables). Nothing is faked: there is
no external payment system.

**Traceability:** see the per-AC table in §10.

**Coverage:** the ≥85% target is **not measured**.

**Not covered:** the mobile app is type-checked only (not run on a device/emulator) and its receipt upload is
image-only (image picker, no PDF); the browser smoke test is a one-off script, not a committed suite.

---

## 7. Out of scope

- **PayPal, Stripe and any other online payment provider** — removed/never used by business decision (§11).
- Automatic bank reconciliation / bank-feed matching — Admin verifies receipts by hand.
- Automated refunds — refunds are manual (AC-11).
- Proration collection on a mid-cycle plan change (`changePlan` returns a prorated figure but does not
  create an order; unchanged, belongs to Subscriptions & Credits).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | ~~`payment_receipts` and `exchange_rates` tables absent from the DDL~~ | Engineering | **Resolved** |
| 2 | ~~Partial-refund file policy~~ | Admin | **Resolved 2026-09-20 (final payment access policy, [§12](#12-final-payment-access-policy-2026-09-20))** — any refund, including a partial refund, re-locks file access; files are unlocked only when the order is 100% paid and confirmed by an admin |
| 3 | Exchange-rate provider not finalized: rates are an approximate built-in table. Only affects the **display-only** local-currency amount, never what a customer transfers | Admin | **Open — display only** |
| 4 | ~~Rejected receipt: same order or new order?~~ | Admin | **Resolved** — same order; the customer re-uploads |
| 5 | ~~AC-9 "PayPal credentials from Settings"~~ | Admin | **Closed — NOT APPLICABLE (business decision)**; AC-9 is bank details only |
| 6 | ~~AC-12 renewals not implemented~~ | Engineering | **Resolved** — renewals are `renewal` bank-transfer orders |
| 7 | ~~Credits/subscription webhooks confirm on signature without amount check~~ | Engineering | **Closed — webhooks removed**; credits/subscriptions are fulfilled only by an Admin approving the order's receipt |
| 8 | ~~One `PAYPAL_WEBHOOK_ID` for three endpoints~~ | Engineering | **Closed — NOT APPLICABLE (business decision)** |
| 9 | Bank-transfer confirmation is human: an Admin must match the receipt to the bank statement. The system cannot detect a forged or wrong-amount receipt — it guarantees nothing is released without an Admin's explicit approval **and** that the amount the Admin confirms (never a customer-supplied figure) reaches 100% of the order before files unlock. Mis-typing the amount is an Admin data-entry risk; the admin form pre-fills the outstanding amount | Admin | **Open — process risk** |
| 10 | **AC-8 local-currency display — needs a product decision.** The API returns a converted amount (`GET /api/orders/:id?currencyCode=`, display only). No screen shows it because the platform has no rule for *which* currency a customer sees: there is a stored `preferred_locale` but no locale→currency mapping or currency preference (the code carries `TODO(A-021)`), and Cart AC-9 depends on the same missing rule. It also has to be reconciled with the 2026-09-19 rule that the bank-transfer amount is always the exact PKR figure (a secondary "≈" amount must be clearly informational). Not implemented rather than inventing a mapping | Admin / Engineering | **Open — needs a product decision** |
| 11 | Unpaid orders never expire. **Not a requirement:** no acceptance criterion asks for auto-expiry or auto-cancel, and §9 only asks to *alert* on orders stuck in `payment_pending` (monitoring, not built into the application). An abandoned unpaid order simply stays `payment_pending`; Admin can cancel it (which returns any credits it used). | Admin | **Intentionally out of scope** |
| 12 | `/api/settings/public` exposes the bank details without login. **Intentional design, not a defect:** customers need the account to pay, the Admin-editable bank details were specified as customer-visible display config (A-005 spec, AC-3/AC-9 here, SRS "Admin can add/change bank receiving details"), the DTO comment names it "the one deliberate, narrow exception", and the endpoint is the shared public-settings feed used by the Footer/Contact/Taebo. Only five whitelisted fields are ever returned and only while bank transfer is enabled; no credential or secret is involved. (SRS "never expose bank credentials" means *login* credentials, not the receiving account.) Making it login-only would change a specified, tested contract for no acceptance-criteria benefit | Admin | **Accepted as designed** |

---

## 9. Rollout

- **Feature flag:** none — core purchase path.
- **Migration order:** apply `20260919180000_bank_transfer_only_payments` (guarded — see §4) and `20260920120000_partial_payment_receipt_amounts` (adds `payment_receipts.confirmed_amount_pkr`; already-confirmed receipts are backfilled with their order's amount due, so nothing already paid becomes "partial"); then configure the bank details under Admin → Settings → Bank transfer details.
- **Rollback:** code only, never financial state — orders already in `payment_confirmed` or later must **not** be reverted. The migration itself is not reversible.
- **Observability:** alert on any order stuck in `payment_pending` beyond a configurable SLA with a receipt awaiting review, and on file-release failures after confirmation (a confirmation that does not release files is a critical bug).

---

## 10. Implementation status (2026-09-19)

Verified means an automated test against a real (throwaway) Postgres. Nothing in this spec has been
exercised against a real bank account — by design there is no external system to integrate.

| AC | Status | What is true today |
|---|---|---|
| AC-1 PayPal capture | **NOT APPLICABLE — BUSINESS DECISION** | PayPal removed (§11) |
| AC-2 webhook signature | **NOT APPLICABLE — BUSINESS DECISION** | No webhooks exist; `/api/webhooks/*` → 404; a webhook-shaped POST cannot change an order (`orders.spec.ts`) |
| AC-3 exact PKR + bank details + reference | **Done** | `amountDuePkr` = total − credits in PKR; unique `CZD-XXXX-XXXX`; the payment page reads the Admin-configured details live. `orders.spec.ts` (exact PKR, fractional, partial credits, bank details) |
| AC-4 receipt upload + Admin notified + flagged | **Done** | Signature-checked JPEG/PNG/WebP/PDF ≤ 10 MB; every Admin notified; queue at `/admin/payments`; Admin previews the file. `orders.spec.ts` |
| AC-5 approve / reject | **Done** | Approve for the full outstanding amount releases files once; a smaller amount records a partial payment and releases nothing; reject shows the reason and asks for a new receipt; a cancelled/refunded order cannot be revived; duplicate/concurrent approvals have one effect; `PUT /status` cannot confirm or refund; only `role=admin`, or a freelancer/moderator an admin explicitly granted `orders` **crud**, can approve/reject/refund (read-only, revoked, other-module and no permission are all `403`, audit-logged). `orders.spec.ts`, `purchases-bank-transfer.spec.ts`, e2e, browser |
| AC-6 files blocked until paid | **Done** (download bytes: see note) | Files unlock only at 100% paid + admin-confirmed: unpaid, partially paid, receipt pending/rejected, cancelled, partially refunded and fully refunded are all blocked, on list, direct download, extra-format requests and custom-request deliverables. `payment-access-policy.spec.ts`. *Note:* `POST .../download` returns a signed token but no route serves the bytes for it — that gap belongs to the Private File Management spec (A-007) |
| AC-7 order history | **Done** | Scoped, paginated, newest first. `orders.spec.ts` |
| AC-8 local currency | **Partial — needs a product decision** | API returns PKR + a converted amount (`?currencyCode=`, display only, unit-tested). No screen shows it: there is no locale→currency rule to drive it (§8 #10). Not a bank-transfer defect and untouched by this decision |
| AC-9 bank details without deploy | **Done** | Admin edits bank name / account title / account number / IBAN / instructions; the next payment-page view shows them; only those fields are stored/returned; customers cannot edit. `orders.spec.ts` |
| AC-10 Stripe card | **NOT APPLICABLE — BUSINESS DECISION** | Stripe removed (§11) |
| AC-11 refunds (manual) | **Done** | Ceiling = amount actually transferred (`total − credits`); partial refunds accumulate; concurrent/duplicate refunds apply once; credits restored once on completion; an all-credits order takes one zero-amount refund; customer told refunds are returned manually; audit-logged with `manual: true`. **Any refund (partial included) re-locks the files.** Cancelling an unpaid order returns its credits once. `orders.spec.ts`, `payment-access-policy.spec.ts` |
| AC-12 renewals as orders | **Done** | Due renewal → one unpaid `renewal` bank-transfer order reused on later reminders; a receipt awaiting review is not a missed attempt; 3 missed reminders lapse; paying the outstanding order reactivates. `purchases-bank-transfer.spec.ts`, e2e |
| AC-13 credit packages | **Done** | Order for the exact PKR price; credits added once on approval; price/credits are a snapshot; package cannot be deleted once ordered. `purchases-bank-transfer.spec.ts`, e2e |

**Why A-013 is still In Progress:** one acceptance criterion is not fully done, and it is waiting on a
business/product decision rather than on engineering — AC-8 (which currency a customer sees, §8 #10). The
partial-refund file policy is decided ([§12](#12-final-payment-access-policy-2026-09-20)). Nothing else is open: unpaid-order expiry (§8 #11) is not a requirement and the
public bank details (§8 #12) are intentional. None of this concerns PayPal or Stripe.

**Browser verification (2026-09-19):** a real Chromium run against a throwaway database and isolated ports covered
Admin → Settings (bank details) → customer checkout → payment page (exact PKR, bank details, reference) → receipt
upload → Admin queue → receipt preview → reject with reason → customer sees the reason and re-uploads → Admin
approves → customer confirmation with files → live bank-detail change → subscription / credit-package orders →
manual-refund card; 17/17 steps passed and no provider/USD/card text appeared on any customer or admin payment screen.

---

## 11. Business decision (2026-09-19) — BANK TRANSFER ONLY

The business decided that the website accepts **only bank transfer / bank account payment**.

- **PayPal is removed from the project** (checkout, order creation, approval, capture, webhooks, provider
  services, controllers/routes, SDK use, UI, refund integration, credentials and environment variables,
  provider-specific database columns, tests, mocks and documentation).
- **Stripe is not used** as a customer payment method (no checkout, PaymentIntent, client secret, Elements,
  webhook, credentials, tests or mocks); the `stripe` dependency is removed.
- The PayPal- and Stripe-specific requirements above (AC-1, AC-2, AC-10) are **NOT APPLICABLE — BUSINESS
  DECISION**. They are **not** implementation bugs and do not keep A-013 incomplete.
- **The final supported payment method is BANK TRANSFER ONLY.** Credit-package purchases, subscription
  first payments and renewals use the same workflow.
- Customer flow: cart → checkout → order created → exact PKR amount → Admin-configured bank details →
  manual transfer → receipt upload → Admin notified → Admin approves or rejects (with a reason) → approved:
  payment confirmed and files/credits/subscription delivered; rejected: reason shown and a new receipt can
  be uploaded on the same order.
- Refunds are manual and admin-managed; no provider refund is ever shown as succeeded.

---

## 12. Final payment access policy (2026-09-20)

> **Customer files are unlocked only after 100% of the order amount has been paid and the payment has been confirmed by an authorized admin.**
>
> **Partial payment never unlocks files.**
>
> **Any refund, including a partial refund, re-locks file access.**

This replaces the earlier wording that left file access untouched after a partial refund. Bank transfer remains
the only payment method; nothing here reintroduces PayPal or Stripe.

### Files are unlocked when — and only when

The order is **paid in full and confirmed**: `payment_status = completed`, the fulfilment status is
`payment_confirmed` / `processing` / `ready` / `completed`, and **no refund of any size is recorded**. It is
decided by one function, `orderAllowsFileAccess` (`order-state-machine.ts`), that every file route calls.

`payment_status = completed` is written by exactly two paths, both of which verify the **full** amount:

1. an authorized admin approves the receipt that brings *credits applied + all confirmed receipts* up to the order
   total (the admin states the PKR actually received; a partial amount only records money);
2. credits cover the **entire** order at checkout (nothing is left to transfer).

### Files stay locked when

unpaid · awaiting payment · **partially paid** · receipt uploaded but not approved · receipt rejected · payment pending
review · payment incomplete · **cancelled** · payment amount below the order total · **credits cover only part of the
order** and the remainder is unpaid · **partially refunded** · **fully refunded**.

| Example | Result |
|---|---|
| Order PKR 1,500, customer transfers PKR 500, admin confirms PKR 500 | Payment incomplete, order **not paid**, files **locked** |
| …later PKR 1,000 more is transferred and the admin confirms it (PKR 1,500 in total) | Order **paid**, files **unlocked** |
| Order PKR 1,500 = PKR 500 credits + PKR 1,000 bank transfer, transfer confirmed | Fully paid → files **unlocked** |
| Order PKR 1,500 with PKR 500 credits, no bank transfer (or only part of the PKR 1,000) | Not fully paid → files **locked** — credits alone never unlock a partly covered order |
| Order paid in full, then a PKR 200 partial refund | `partially_refunded` → files **locked** |
| Order paid in full, then a full refund | `refunded` → files **locked** |

### Backend enforcement (nothing depends on the frontend)

* Every request is judged from the order row in the database: the file list, a direct download request, the
  extra-file-format request, and a custom request's deliverable download (which checks its linked order).
  Nothing the client sends — state, headers, query/URL parameters, a body, a receipt upload, a replayed request —
  can change the outcome; customers have no route that writes an order's status, payment status or amounts.
  A malformed id in the URL (`undefined`, `abc`, `1e3`, `-1`) is a plain `404`, never an internal error.
* The amount that counts as paid is the one **an authorized admin confirms on a receipt**, stored per receipt
  (`payment_receipts.confirmed_amount_pkr`) and summed with the credits applied. Pending and rejected receipts
  count for nothing. A confirmation larger than the outstanding amount is refused.
* Approval runs in one transaction that locks the order row, re-reads the receipts, claims the receipt
  (single winner) and only then may complete the order — so duplicate, concurrent or replayed confirmations can
  never count the same money twice or unlock the order early.
* A refund sets `payment_status` to `partially_refunded` / `refunded` (and the refunded amount), which the
  gate treats as locked; a refunded order can never be re-paid or re-confirmed, and moving it through
  `processing`/`ready`/`completed` does not re-open it. Authorized-file rows are kept — the gate, not the data,
  is what locks them.

### Known limits

* `POST .../download` returns a signed 10-minute token but **no route serves bytes for that token yet** (Private
  File Management spec, A-007). A token issued just before a refund is therefore not exploitable today; when that
  route is built it must call the same gate.
* Money confirmed on a partly paid order that is then **cancelled** is recorded on its receipts but the refund
  action only covers a `payment_confirmed` order; returning that money is a manual Admin process outside the system.
