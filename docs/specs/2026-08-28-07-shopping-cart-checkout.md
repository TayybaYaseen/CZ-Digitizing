# Spec: Shopping Cart & Checkout

**File:** `docs/specs/2026-08-28-07-shopping-cart-checkout.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md), SRS §13, architecture §API Architecture

---

## 1. Problem statement

**Today:** There is no cart. A customer cannot accumulate multiple designs/bundles, choose a size
per item, apply available credits, or see a running total before committing to checkout.

**Who is affected:** Every purchasing customer; the header UI, which must show a live cart-item
count badge on every public page.

**Why it matters now:** Cart is the funnel step between browsing (Catalog spec) and purchase
(Orders & Payment spec) — it is where quantity, size selection, and credit application happen
before an order is created.

**Success looks like:** A customer adds designs/bundles with a chosen size and quantity, sees an
accurate subtotal/discount/credits-used/total, can edit or remove items, and proceeds to checkout
with confidence the cart reflects exactly what they're about to pay for.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a customer adds a design (with a selected size) or a bundle to the cart **When** the add succeeds **Then** the header cart badge count updates immediately and the item persists across page navigation for that session/account |
| AC-2 | **Given** a cart with items **When** the customer views the cart **Then** each line shows preview image, name, category/subcategory, selected size, quantity, unit price, and line discount |
| AC-3 | **Given** a customer changes an item's quantity or removes it **When** the change is saved **Then** the subtotal/discount/total recompute immediately and the cart badge updates |
| AC-4 | **Given** a customer has available credits and eligible items in the cart **When** they apply credits at checkout **Then** the cart summary shows credits used and the recomputed total, following Admin-configured eligibility rules |
| AC-5 | **Given** an anonymous (not-logged-in) visitor adds items to the cart **When** they later log in **Then** their pre-login cart merges with (or replaces, per product decision — see §8) any existing account cart |
| AC-6 | **Given** a customer proceeds to checkout **When** they select a payment method and confirm **Then** an order is created from the cart contents atomically (see Orders & Payment spec) and the cart is cleared only after order creation succeeds |
| AC-7 | **Given** the cart page on mobile/tablet/desktop **When** rendered **Then** it is fully responsive with no horizontal overflow (SRS §3) |
| AC-8 | **Given** a customer moves a cart item to "Saved for Later" (distinct from Favorites) **When** viewed **Then** it appears in a separate Saved-for-Later list, removed from the active cart total, and can be moved back to the cart at any time |
| AC-9 | **Given** a customer in a non-PKR locale **When** they view the cart **Then** the cart's subtotal/discount/total are computed and displayed in the customer's selected currency in addition to the PKR source-of-truth values, using the same exchange-rate mechanism as Orders & Payment |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/cart` | Authenticated or guest-session | `200` `CartDto` | |
| `POST` | `/api/cart/items` | Authenticated or guest-session | `201` | body: `designId` or `bundleId`, `sizeId?`, `quantity` |
| `PUT` | `/api/cart/items/:itemId` | Authenticated or guest-session, own cart only | `200` | quantity change |
| `DELETE` | `/api/cart/items/:itemId` | Authenticated or guest-session, own cart only | `204` | |
| `DELETE` | `/api/cart` | Authenticated or guest-session | `204` | clear cart |
| `POST` | `/api/cart/checkout` | Authenticated customer (guest checkout, if allowed, is a §8 open question) | `201` order | hands off to Orders & Payment |

### DTOs

```ts
export interface CartDto {
  items: CartItemDto[];
  subtotalPkr: number; discountPkr: number; creditsUsed: number; totalPkr: number;
}
export interface CartItemDto {
  id: string; designId?: string; bundleId?: string; sizeId?: string;
  quantity: number; unitPricePkr: number; linePriceAtSelectionPkr: number;
}
```

### Error codes (feature-specific)

| HTTP | `code` | When |
|---|---|---|
| `422` | `ITEM_NOT_PUBLISHED` | design/bundle in cart was unpublished before checkout |
| `422` | `SIZE_REQUIRED` | design added without a required size selection |
| `422` | `INSUFFICIENT_CREDITS` | requested credit application exceeds available balance |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `carts` *(new, proposed)* | proposed | `id`, `customer_id` (nullable for guest), `guest_session_id` (nullable), `created_at`, `updated_at` — the architecture doc has no cart table at all; it lists `/api/cart/*` routes with no backing entity |
| `cart_items` *(new, proposed)* | proposed | `id`, `cart_id`, `design_id` or `bundle_id`, `size_id`, `quantity`, `added_at` |

Design decision needed (§8): persist cart in Postgres (durable, survives Redis eviction) vs. Redis
(fast, matches architecture's stated use of Redis for "Sessions"/"Tokens" but not explicitly
"Cart"). This spec proposes Postgres for durability of a pre-purchase artifact that includes
price-sensitive state, with Redis as a read-through cache layer per architecture §Performance
(Redis TTL strategy does not currently list a cart entry either — also to be added if Redis caching
is used).

### Migration

- **Name:** `AddCartTables`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored; not present in the architecture doc's DDL today

### Retention and privacy

Guest carts tied to `guest_session_id` should expire (e.g. 30 days of inactivity) — exact TTL is an
open question in §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | cart page shows line-item skeletons; badge shows last-known count until refreshed |
| **Empty** | "Your cart is empty" + "Continue Shopping" CTA back to catalog |
| **Error** | inline error on quantity/credit-application failure (`INSUFFICIENT_CREDITS`, etc.) without losing the rest of the cart state |
| **Success** | line items, running total, "Proceed to Checkout" enabled only when all lines are valid (published, size selected) |

**Route(s):** `/cart`, `/checkout`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | subtotal/discount/credit calculation, guest-cart merge-on-login logic | `apps/api/cart/*.spec.ts` |
| **Integration** | add/update/remove item, checkout hand-off, unpublished-item rejection | `apps/api/test/integration/cart.spec.ts` |
| **Component** | cart line-item states, badge update on add/remove | `apps/web/cart/*.spec.tsx` |
| **E2E** | browse → add multiple items → adjust quantity → apply credits → checkout | `e2e/cart.e2e.spec.ts` |
| **Integration** | cart-abandonment detection and recovery-email trigger after N hours of inactivity | `apps/api/test/integration/cart-abandonment.spec.ts` |

**Traceability:** AC-1…AC-9 → `cart.integration.spec.ts` / `cart.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — cart abandonment recovery emails are covered by the
additional Integration row above.

---

## 7. Out of scope

None — every item previously listed here (saved-for-later/wishlist, multi-currency cart totals)
has been folded into AC-8/AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Cart persistence layer (Postgres vs. Redis-only) not decided | Engineering | Open |
| 2 | Guest checkout allowed, or is account creation/login required before `POST /api/cart/checkout`? SRS implies "My Cart" lives under Customer Account, suggesting login is required | Admin | Open |
| 3 | Guest-cart-to-account merge behavior on login (merge vs. overwrite) not specified | Admin | Open |
| 4 | Credit eligibility rules ("according to Admin rules" per SRS §11) have no concrete rule engine defined | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** `carts`/`cart_items` ship before the cart API is enabled.
- **Rollback:** standard image rollback; cart tables can be dropped pre-launch without data-loss
  concern.
- **Observability:** track cart-to-checkout conversion rate and cart abandonment as product metrics.
