# Spec: Design Bundles

**File:** `docs/specs/2026-08-28-06-design-bundles.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Design catalog spec](2026-08-28-04-design-catalog-browsing.md), SRS §10, architecture §Database Schema

---

## 1. Problem statement

**Today:** Designs can only be sold individually. There is no way for Admin to curate a
multi-design bundle at a combined price, and no bundle browsing page for customers.

**Who is affected:** Customers who want a themed collection (e.g. "10 Cap Logos Bundle") at a
bundle price; Admin, who needs to assemble and price bundles without duplicating design records.

**Why it matters now:** Bundles are an explicit pricing/merchandising lever (SRS §10) and a distinct
purchasable line-item type in the cart/order model (`order_items.bundle_id`).

**Success looks like:** Admin creates a bundle from existing designs with its own price/sale price
and preview image; customers browse bundles on their own page, buy a bundle as a single cart item,
and — on payment — receive authorized files for every design in the bundle.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin selects a set of published designs, a title, description, preview image, price, and optional sale price **When** the bundle is published **Then** it appears on the Design Bundles page with a card following the same visual system as design cards |
| AC-2 | **Given** a published bundle **When** a customer adds it to the cart and completes checkout **Then** the order records a single `order_items` row with `bundle_id` set and `design_id` null |
| AC-3 | **Given** an order containing a bundle reaches `payment_confirmed` **When** files are released **Then** `customer_authorized_files` rows are created for every design's authorized files inside that bundle, not just one |
| AC-4 | **Given** Admin removes a design from an already-published bundle **When** the change is saved **Then** existing customers who already purchased the bundle keep access to the files they were originally authorized for (no retroactive revocation) |
| AC-5 | **Given** Admin unpublishes or deletes a bundle **When** the change is saved **Then** it no longer appears on the public Bundles page, but existing purchasers' order history and file access are unaffected |
| AC-6 | **Given** Admin configures a dynamic bundle rule (e.g. "any 5 designs from Category X for 4000 PKR") **When** a customer selects qualifying designs at checkout **Then** the dynamic bundle price applies automatically instead of the sum of individual prices |
| AC-7 | **Given** Admin sets a per-design price override within a bundle **When** the bundle total is computed **Then** it reflects the sum of each design's overridden price rather than one flat bundle price |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/bundles` | Public | `200` `PagedResponse<BundleSummaryDto>` | |
| `GET` | `/api/bundles/:id` | Public | `200` `BundleDetailDto` | includes included-design summaries |
| `POST` / `PUT` / `DELETE` | `/api/bundles` `/:id` | `role=admin` | `201` / `200` / `204` | |
| `POST` / `DELETE` | `/api/bundles/:id/designs` `/:designId` | `role=admin` | `200` / `204` | manages `bundle_designs` membership |

### DTOs

```ts
export interface BundleDetailDto {
  id: string; name: string; description: string; previewImageUrl: string;
  pricePkr: number; salePricePkr?: number;
  includedDesigns: { id: string; name: string; previewImageUrl: string }[];
}
```

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `design_bundles`, `bundle_designs` | existing (per architecture DDL) | no changes proposed |
| `order_items` | existing | already supports `bundle_id` with the CHECK constraint requiring exactly one of `design_id`/`bundle_id` |

### Migration

None beyond what the master spec's `InitialSchema` migration already includes — this feature reuses
existing DDL as-is.

### Retention and privacy

No new PII. Bundle membership changes must not be retroactively applied to already-fulfilled orders
(AC-4) — enforced by resolving a purchased bundle's file set from `order_items`/`customer_authorized_files`
at the time of `payment_confirmed`, not by re-querying current `bundle_designs` membership at
download time.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | bundle-card grid skeleton |
| **Empty** | "No bundles available right now" if zero published bundles exist |
| **Error** | retry with `traceId`, consistent with the catalog page |
| **Success** | bundle card grid; clicking opens bundle detail listing included designs |

**Route(s):** `/bundles`, `/bundles/:id`, `/admin/bundles`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | bundle-to-order-item mapping, file-authorization fan-out logic (AC-3) | `apps/api/bundles/*.spec.ts` |
| **Integration** | bundle CRUD, membership changes not affecting past orders (AC-4) | `apps/api/test/integration/bundles.spec.ts` |
| **E2E** | browse bundle → buy → pay → download every included design's files | `e2e/bundles.e2e.spec.ts` |
| **Integration** | bundle price interacting with credit application and active-subscription discounts at checkout | `apps/api/test/integration/bundles-discount-stacking.spec.ts` |

**Traceability:** AC-1…AC-7 → `bundles.integration.spec.ts` / `bundles.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — discount stacking with credits/subscriptions is covered by
the additional Integration row above.

---

## 7. Out of scope

None — every item previously listed here (dynamic/auto-generated bundles, per-design price
override) has been folded into AC-6/AC-7 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | What happens to an active cart item referencing a bundle that Admin unpublishes mid-session — block checkout or honor it? | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** reuses `InitialSchema`; no independent migration needed.
- **Rollback:** standard image rollback.
- **Observability:** track bundle attach-rate (bundle purchases ÷ total orders) as a merchandising
  signal.
