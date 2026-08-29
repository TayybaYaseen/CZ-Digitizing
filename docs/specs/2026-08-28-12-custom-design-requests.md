# Spec: Custom Design Request System

**File:** `docs/specs/2026-08-28-12-custom-design-requests.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Private file management spec](2026-08-28-05-private-file-management.md), [Notifications spec](2026-08-28-02-notifications-system.md), SRS Addendum §7, architecture §Database Schema / §API Architecture

---

## 1. Problem statement

**Today:** Customers who want a design digitized or vectorized from their own artwork have no
structured request path, no visible status tracking, and no way to request an additional file
format after purchase.

**Who is affected:** Customers commissioning custom embroidery/vector work; Admin/designers who
must track requests through a production workflow; customers who purchased files and later need a
different machine format.

**Why it matters now:** This is a distinct commercial workflow from the pre-made-design catalog and
has its own multi-stage production lifecycle described explicitly in the SRS addendum.

**Success looks like:** A customer submits a custom request with the minimum required fields, tracks
it through a defined status workflow, receives notifications at every stage, and — after purchase —
can request an additional file format that Admin fulfills and delivers securely.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a customer submits a custom embroidery request **When** they provide at minimum an image/logo, size, and machine format (fabric optional) plus any reference uploads and instructions **Then** a `custom_requests` row is created with `status=new` and Admin is notified |
| AC-2 | **Given** a `custom_requests` row **When** its status changes **Then** it follows exactly: `new → reviewing → quote_sent → approved → in_production → ready → delivered → completed`, with `need_more_info`, `revision_required`, and `cancelled` reachable as side-states from `reviewing`/`in_production` |
| AC-3 | **Given** any status change **When** it is saved **Then** the customer receives a status-update notification and the change is timestamped |
| AC-4 | **Given** Admin sends a quote for a custom request **When** the customer approves it **Then** status moves to `approved` and the request proceeds toward production (payment handling per Orders & Payment spec) |
| AC-5 | **Given** a completed and paid custom request **When** Admin uploads the final files **Then** they become downloadable to the customer through the same private-file authorization mechanism as catalog designs (see Private File Management spec) — never a raw/unauthenticated link |
| AC-6 | **Given** a customer who already purchased files **When** they use "Need Another File Format?" **Then** a `file_format_requests` record is created linked to their order, Admin is notified, and once Admin fulfills it the customer is notified and can download the new format through the standard authorized-download path |
| AC-7 | **Given** a custom request **When** viewed by Admin **Then** it shows customer identity, Gmail, WhatsApp, date/time, all reference uploads, size, machine format, fabric, required files, instructions, status, assigned designer, notes, quote, payment status, delivery status, and message history |
| AC-8 | **Given** a customer and Admin/designer messaging on a custom request **When** either party is typing **Then** a real-time typing indicator and live message delivery (via WebSocket) show in the other party's chat thread |
| AC-9 | **Given** a designer assigned to a custom request **When** they work through production **Then** they have dedicated production tooling (task checklist, time tracking, file-versioning during production) beyond simple status-field updates |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/custom-requests` | Public/authenticated customer | `201` | AC-1 |
| `GET` | `/api/custom-requests/:id` | Owner or `role=admin` | `200` | |
| `GET` | `/api/custom-requests/user/history` | Authenticated customer | `200` `PagedResponse<CustomRequestSummaryDto>` | |
| `GET` | `/api/custom-requests` | `role=admin` | `200` | filterable by status |
| `PUT` | `/api/custom-requests/:id` | `role=admin` | `200` | status/assignment/notes changes, AC-2/AC-3 |
| `POST` | `/api/custom-requests/:id/quote` | `role=admin` | `200` | AC-4 |
| `POST` | `/api/custom-requests/:id/files` | `role=admin`, after completion | `201` | AC-5, routes through the private-file pipeline |
| `POST` | `/api/orders/:orderId/file-format-request` | Authenticated customer, owner of order | `201` | AC-6 |
| `GET` | `/api/orders/:orderId/file-format-requests` | Owner or `role=admin` | `200` | |
| `GET` | `/api/file-format-requests` | `role=admin` | `200` | |
| `POST` | `/api/file-format-requests/:id/fulfill` | `role=admin` | `200` | AC-6 |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `custom_requests` | existing | per architecture DDL; status enum already matches AC-2 exactly |
| `custom_request_references` *(new, proposed)* | proposed | `id`, `custom_request_id`, `image_url` (private storage), `uploaded_at` — SRS requires "multiple reference uploads," but the current DDL's `custom_requests.image_url` is a single field |
| `custom_request_messages` *(new, proposed)* | proposed | `id`, `custom_request_id`, `sender_user_id`, `message`, `created_at` — required for AC-7's "message history," not modeled today |
| `file_format_requests` *(new, proposed)* | proposed | `id`, `order_id`, `customer_id`, `requested_format`, `notes`, `status` enum(`pending`,`fulfilled`,`rejected`), `fulfilled_file_id → design_files.id`, `created_at`, `fulfilled_at` — the API routes exist in architecture §API Architecture, but the backing table was never defined |

### Migration

- **Name:** `AddCustomRequestDetailAndFileFormatRequests`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

Stores name/Gmail/WhatsApp, reference images, and message history — same retention posture as
other order-adjacent PII, tracked in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | request-detail page shows skeleton for status timeline and message thread |
| **Empty** | "No custom requests yet" on My Account tab; empty message thread shows a prompt to add extra info |
| **Error** | reference-upload failure shows per-file error without discarding already-attached files; status-change failure (admin) shows why |
| **Success** | status timeline with timestamps; toast on file-format-request fulfillment |

**Route(s):** `/custom-request`, `/account/custom-requests`, `/account/custom-requests/:id`,
`/admin/custom-requests`, `/admin/custom-requests/:id`, `/admin/file-format-requests`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | status-transition validity (rejecting illegal jumps, e.g. `new → completed` directly) | `apps/api/custom-requests/*.spec.ts` |
| **Integration** | full submission → quote → approve → production → delivery flow; file-format-request → fulfill → authorized download | `apps/api/test/integration/custom-requests.spec.ts` |
| **E2E** | submit request with multiple reference images → admin quotes → customer approves → admin delivers files → customer downloads | `e2e/custom-requests.e2e.spec.ts` |
| **Unit** | designer auto-assignment/workload-balancing algorithm | `apps/api/custom-requests/designer-assignment.spec.ts` |

**Traceability:** AC-1…AC-9 → `custom-requests.integration.spec.ts` / `.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — designer workload/assignment balancing is covered by the
additional Unit row above.

---

## 7. Out of scope

None — every item previously listed here (real-time chat widget, designer-facing production
tooling) has been folded into AC-8/AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `custom_request_references`, `custom_request_messages`, and `file_format_requests` are all required by explicit SRS text or by already-listed API routes, but none exist in the architecture DDL | Engineering | Open |
| 2 | Whether payment for a custom request happens before or after `in_production`, and how it ties into the `orders` table (a custom request may not map 1:1 to a catalog `order_items` row) | Admin / Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — Phase 2 feature per roadmap.
- **Migration order:** `custom_requests` (already in `InitialSchema`) plus the three new tables
  above before the submission form goes live.
- **Rollback:** standard image rollback.
- **Observability:** alert on requests stuck in `reviewing` beyond an SLA; track
  submission-to-quote-sent latency as an Admin-responsiveness metric.
