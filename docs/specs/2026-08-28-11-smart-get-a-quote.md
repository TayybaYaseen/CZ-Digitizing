# Spec: Smart Get a Quote

**File:** `docs/specs/2026-08-28-11-smart-get-a-quote.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Notifications spec](2026-08-28-02-notifications-system.md), SRS §12, architecture §API Architecture

---

## 1. Problem statement

**Today:** Every quote request currently requires a back-and-forth conversation over WhatsApp/email
to answer the same recurring questions (file formats, turnaround, pricing logic) before Admin can
even understand what's being asked.

**Who is affected:** Prospective customers who want a fast answer or a quote for
digitizing/vector-art work; Admin, who is currently interrupted by repetitive questions that a
self-serve Q&A step could deflect.

**Why it matters now:** This is explicitly designed to reduce Admin's repetitive-question load
(SRS §12) while still capturing full quote submissions when a customer needs one.

**Success looks like:** A customer picks a service, gets instant answers to common questions without
generating any Admin notification, and — only when they actually submit the quote form — Admin is
notified with a complete, structured request.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the Get a Quote flow **When** a customer selects a service (Embroidery Digitizing, Vector Art, or a subcategory) **Then** Step 2 shows Admin-curated questions scoped to that service/category |
| AC-2 | **Given** a customer clicks a listed question **When** clicked **Then** the answer displays instantly with no Admin notification and no `quotes` record created |
| AC-3 | **Given** no listed question answers the customer's need **When** they choose "Ask a Question" or continue **Then** they proceed to the Step 3 quote form |
| AC-4 | **Given** the Step 3 quote form (name, email, WhatsApp, country, service, design upload, size, quantity, fabric, thread colors, machine/file format preference, deadline, instructions) **When** the customer submits it **Then** a `quotes` row is created with `status=new`, the customer receives a submission-confirmation notification, and Admin receives a notification |
| AC-5 | **Given** Admin manages Questions & Answers from the private panel **When** they add/edit/assign a question to a service/category **Then** it becomes available in Step 2 for matching service selections without a code deploy |
| AC-6 | **Given** Admin responds to a submitted quote **When** the response is saved **Then** `quotes.status` moves to `responded`, `admin_notes` is set, and the customer receives a notification with the response |
| AC-7 | **Given** a responded quote the customer accepts **When** Admin converts it **Then** `quotes.status=converted_to_order` and it links to the resulting order (mechanism defined in Orders spec) |
| AC-8 | **Given** a submitted quote's structured attributes (service, size, quantity, fabric, deadline, etc.) **When** Admin requests a suggested price **Then** the system computes an AI/rule-based suggested `quoted_price_pkr` that Admin can accept or override before sending the response |
| AC-9 | **Given** a customer on the Step 3 quote form **When** they need to clarify a detail before submitting **Then** an embedded multi-turn chat (distinct from Taebo) lets them exchange messages with Admin/Taebo directly within the quote form prior to submission |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/quote-questions?service=&category=` *(new, proposed)* | Public | `200` `QuoteQuestionDto[]` | AC-1; not present in architecture's endpoint list, required by SRS §12 |
| `POST` | `/api/quotes` | Public (customer identity captured in payload; optionally authenticated) | `201` | AC-4 |
| `GET` | `/api/quotes/:id` | Owner or `role=admin` | `200` | |
| `GET` | `/api/quotes/user/history` | Authenticated customer | `200` `PagedResponse<QuoteSummaryDto>` | |
| `GET` | `/api/quotes` | `role=admin` | `200` | filterable by status |
| `PUT` | `/api/quotes/:id/status` | `role=admin` | `200` | |
| `POST` | `/api/quotes/:id/respond` | `role=admin` | `200` | AC-6 |
| `POST` / `PUT` / `DELETE` | `/api/quote-questions` `/:id` *(new, proposed)* | `role=admin` | | AC-5 |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `quotes` | existing | per architecture DDL |
| `quote_questions` *(new, proposed)* | proposed | `id`, `question`, `answer`, `service_type`, `service_category`, `sort_order`, `is_published`, `created_at`, `updated_at`, `created_by_admin_id` — SRS §12 explicitly requires Admin-managed Q&A ("Admin manages Questions and Answers from a private panel"), but no such table exists in the architecture DDL; this is distinct from the general `faqs` table because it is scoped specifically to the quote flow's guided step |

### Migration

- **Name:** `AddQuoteQuestions`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored

### Retention and privacy

`quotes` stores name, email, WhatsApp, country, and an uploaded design/reference image — same PII
posture as Custom Design Requests; retention tracked in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | Step 2 question list skeleton while service-scoped questions load |
| **Empty** | no matching questions for a service shows "No common questions yet — ask us directly" and skips straight to Step 3 |
| **Error** | quote submission failure shows field-level validation from `VALIDATION_ERROR.errors[]`; file-upload failure surfaces separately from text-field errors |
| **Success** | submission confirmation screen with expected response time; My Account → My Quotes shows status progression |

**Route(s):** `/get-a-quote`, `/account/quotes`, `/admin/quotes`, `/admin/quote-questions`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | question-to-service/category matching logic, no-notification-on-FAQ-click invariant | `apps/api/quotes/*.spec.ts` |
| **Integration** | full 3-step flow, admin Q&A CRUD, notification firing only on actual submission (AC-2 vs AC-4) | `apps/api/test/integration/quotes.spec.ts` |
| **E2E** | select service → click FAQ (no notification) → submit quote (notification fires) → admin responds → customer notified | `e2e/get-a-quote.e2e.spec.ts` |
| **E2E** | dedicated quote-negotiation thread (counter-offer exchange between Admin and customer before conversion) | `e2e/quote-negotiation.e2e.spec.ts` |

**Traceability:** AC-1…AC-9 → `quotes.integration.spec.ts` / `get-a-quote.e2e.spec.ts`.

**Coverage:** ≥80% on new code, with explicit assertion coverage on the "FAQ click never notifies
Admin" invariant (AC-2) since it's easy to regress accidentally.

**Not covered, deliberately:** None — quote-to-order price negotiation is covered by the
additional E2E row above.

---

## 7. Out of scope

None — every item previously listed here (automated/AI-generated quote pricing, multi-turn chat
within the quote form) has been folded into AC-8/AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `quote_questions` table is required by an explicit SRS requirement but absent from the architecture DDL | Engineering | Open |
| 2 | Exact mechanism for "convert quote to order" (does Admin manually create a cart on the customer's behalf, or generate a special checkout link?) not specified | Admin / Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — Phase 2 feature per roadmap, ships as a coherent whole.
- **Migration order:** `quotes` (already in `InitialSchema`) plus `quote_questions` before the
  guided flow's Step 2 is enabled.
- **Rollback:** standard image rollback.
- **Observability:** track FAQ-deflection rate (Step 2 answers viewed ÷ quote flow starts) as a
  product signal for whether the feature is reducing Admin's repetitive-question load.
