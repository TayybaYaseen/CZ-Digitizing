# Spec: Taebo Helping Panda (Chatbot)

**File:** `docs/specs/2026-08-28-15-taebo-chatbot.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Content & knowledge base spec](2026-08-28-10-content-knowledge-base.md), [Notifications spec](2026-08-28-02-notifications-system.md), SRS Addendum §9, architecture §API Architecture

---

## 1. Problem statement

**Today:** There is no first-line, always-available assistant on the site/app. Customers with
simple questions have no faster path than contacting Admin directly, even for answers that already
exist in the FAQ.

**Who is affected:** Customers wanting instant, low-friction answers; Admin, who should only be
interrupted when Taebo genuinely has no approved answer.

**Why it matters now:** Taebo has a strict behavioral contract — it must **never** fabricate an
answer, especially about payment, price, order status, or file availability — which is a trust and
liability boundary, not just a UX nicety.

**Success looks like:** Taebo greets unobtrusively, answers from approved FAQ/knowledge content
only, escalates unanswered questions to Admin with a clear "Waiting for Admin" state, and lets Admin
turn a good answer into a reusable FAQ entry.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a customer lands on a page **When** Taebo first appears **Then** it may wave and show a brief welcome/help message once, then remain unobtrusive (not re-triggering the greeting on every navigation within the same session) |
| AC-2 | **Given** a customer opens Taebo chat **When** they ask a free-text question or pick a query category **Then** Taebo attempts to match it against `taebo_visible=true` published FAQ content, using page-aware context (e.g. suggests catalog FAQs on a design page) |
| AC-3 | **Given** no approved FAQ/knowledge match exists for a question **When** Taebo responds **Then** it does not guess or fabricate an answer; the question is recorded with status "Waiting for Admin" and Admin receives a notification |
| AC-4 | **Given** any question about payment status, price, order status, or file availability **When** Taebo would need live/customer-specific data it cannot verifiably access from approved content **Then** it declines to answer and escalates per AC-3, rather than inferring an answer |
| AC-5 | **Given** Admin answers a waiting question **When** saved **Then** the customer who asked receives a notification with the answer, and Admin is offered a "Save as FAQ" action that creates a new `faqs` row pre-filled from the Q&A |
| AC-6 | **Given** Taebo conversation history **When** stored **Then** it is retrievable for Admin review/support continuity, and WhatsApp/human support remains reachable from within the chat at all times |
| AC-7 | **Given** the platform's selected NLP/LLM technology for question matching **When** it processes a customer's free-text question **Then** it satisfies the anti-fabrication behavioral contract fixed in AC-3/AC-4 (never guesses, escalates on no-match or restricted topics) regardless of which specific model/library implements the matching |
| AC-8 | **Given** a customer prefers voice input **When** they speak a question to Taebo **Then** it is transcribed to text and processed through the same FAQ-matching and escalation pipeline as a typed question (AC-2–AC-4) |
| AC-9 | **Given** a customer appears stuck on a page associated with common questions (e.g. idle on Checkout or a Custom Request form) beyond the one-time entry greeting **When** an engagement threshold is reached **Then** Taebo proactively offers a relevant suggestion without requiring the customer to open chat first |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/taebo/chat` | Public/authenticated | `200` `TaeboReplyDto` | AC-2/AC-3/AC-4 |
| `GET` | `/api/taebo/suggestions?page=` | Public | `200` | page-aware suggested questions |
| `POST` | `/api/taebo/mark-waiting` | Internal (called by `/chat` handler, not directly by client) | `200` | AC-3 |
| `GET` | `/api/taebo/unanswered` | `role=admin` | `200` `PagedResponse<TaeboWaitingQuestionDto>` | |
| `POST` | `/api/taebo/unanswered/:id/answer` *(new, proposed)* | `role=admin` | `200` | AC-5; not explicitly listed in architecture but required to close the loop |
| `POST` | `/api/taebo/unanswered/:id/save-as-faq` *(new, proposed)* | `role=admin` | `201` | AC-5 |

### DTOs

```ts
export interface TaeboReplyDto {
  matchedFaqId?: string;
  answer?: string;             // present only when matchedFaqId is set
  escalated: boolean;          // true when AC-3/AC-4 triggered
  conversationId: string;
}
```

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `taebo_conversations` *(new, proposed)* | proposed | `id`, `customer_id` (nullable, guest allowed), `session_id`, `started_at`, `last_message_at` |
| `taebo_messages` *(new, proposed)* | proposed | `id`, `conversation_id`, `sender` enum(`customer`,`taebo`,`admin`), `message`, `matched_faq_id → faqs.id` (nullable), `created_at` |
| `taebo_waiting_questions` *(new, proposed)* | proposed | `id`, `conversation_id`, `question_text`, `status` enum(`waiting`,`answered`), `admin_answer`, `answered_by_admin_id`, `saved_as_faq_id → faqs.id` (nullable), `created_at`, `answered_at` |

None of these exist in the current architecture DDL, despite Taebo being a named, detailed SRS
feature — this is the largest schema gap of any feature spec in this set.

### Migration

- **Name:** `AddTaeboConversationTables`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** to be authored; fully new subsystem

### Retention and privacy

Chat transcripts may contain personal details volunteered by customers. Retention period is an open
question tracked in master spec §8; at minimum, transcripts must be excluded from any data export
that isn't explicitly a support/Taebo export (per master spec AC-16's named-dataset exports).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | typing-indicator while Taebo processes a message |
| **Empty** | first open of a new conversation shows the greeting + query categories, not a blank chat window |
| **Error** | if the `/chat` call fails outright (network/server error), show a retry affordance distinct from "Taebo doesn't know" (AC-3) — these must never look the same to the customer |
| **Success** | matched-answer bubble with optional "Was this helpful?" quick action; escalated question shows a clear "I've passed this to our team — you'll hear back soon" state |

**Route(s):** floating widget on all public pages + mobile app screens; `/admin/taebo/unanswered`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | FAQ-matching logic only returns `taebo_visible=true` + `is_published=true` rows; escalation triggers on no-match and on the AC-4 restricted-topic list | `apps/api/taebo/*.spec.ts` |
| **Integration** | full ask → match → answer flow; ask → no-match → escalate → admin answers → customer notified → save-as-FAQ creates a real `faqs` row | `apps/api/test/integration/taebo.spec.ts` |
| **E2E** | open Taebo → ask an FAQ-covered question → get instant answer; ask an unanswerable question → see "Waiting for Admin" → admin answers from dashboard → customer sees notification | `e2e/taebo.e2e.spec.ts` |
| **Unit** | NLP/matching-model accuracy benchmark (precision/recall of FAQ-matching against a labeled question set) | `apps/api/taebo/nlp-model-benchmark.spec.ts` |

**Traceability:** AC-1…AC-9 → `taebo.integration.spec.ts` / `taebo.e2e.spec.ts`, with a specific
test asserting AC-4's restricted topics (payment/price/order-status/file-availability) always
escalate even if a loosely-matching FAQ exists.

**Coverage:** ≥85% given the anti-fabrication requirement is safety-critical to get right.

**Not covered, deliberately:** None — the NLP/matching-model benchmark is covered by the
additional Unit row above.

---

## 7. Out of scope

None — every item previously listed here (NLP/LLM technology choice, voice interaction,
proactive/unsolicited messaging) has been folded into AC-7–AC-9 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The entire Taebo data model (`taebo_conversations`, `taebo_messages`, `taebo_waiting_questions`) is undefined in the architecture doc and must be authored from scratch | Engineering | Open |
| 2 | How AC-4's "restricted topics" are detected (keyword list vs. classifier) is unspecified — a false negative here is a fabrication-risk incident | Engineering | Open |
| 3 | Whether Taebo is the same backend service across Website and Mobile App, or a duplicated client-side implementation | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** `taebo-enabled` — Phase 4 per the roadmap; ships after FAQ/knowledge base is
  populated with real content, since Taebo is only as good as its source data.
- **Migration order:** the three new Taebo tables ship together, after `faqs` already exists.
- **Rollback:** disable the feature flag to hide the widget; conversation data is retained, not
  deleted, on rollback.
- **Observability:** track escalation rate (waiting ÷ total questions) as the primary product
  metric; hard-alert if AC-4's restricted-topic escalation rate drops unexpectedly (possible
  regression toward fabrication).
