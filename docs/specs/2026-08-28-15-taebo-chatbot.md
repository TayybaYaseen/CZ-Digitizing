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

---

## 10. Character & interaction system (2026-09-13 addendum)

Added after A-020 shipped (§ above, `Completed`) to correct the character's visual/interaction
layer — no change to §1–9's API contract, data model, or anti-fabrication behaviour. See
`.claude/skills/cz-digitizing-design/readme.md`'s TAEBO section for the design-system-facing summary
and `docs/design/taebo-panda-prompts.md` for the approved asset generation prompts; this section is
the specification of record.

### 10.1 Character identity

Taebo is a **realistic, full-body panda** — never a cartoon/anime/chibi/plush/emoji mascot. Approved
appearance: standing, three-quarter/front pose, realistic black-and-white fur with visible texture,
natural ears/paws/eyes, a professional-but-friendly expression, wearing a fitted deep-navy vest with
a thin gold trim/zipper and a small CZ-badge lanyard (sometimes holding a tablet/notebook). **This
identity is fixed unless an explicit design change is approved** — future UI work must not
redesign Taebo differently per page or placement.

### 10.2 Master asset and pose states

One master, full-body image is the source for every placement:
`apps/web/public/images/taebo-full.png` (existing convention — not a new folder; present and
committed to the repo as of 2026-09-13, the reference Admin supplied — same as this app's other
static image assets, e.g. `apps/web/public/brand/logo-*.png`).
`TaeboPanda.tsx` (`apps/web/components/TaeboPanda.tsx`) accepts a `pose` prop and resolves, in
order: `taebo-<pose>.png` → `taebo-full.png` → a 🐼 emoji — so the widget always renders something
coherent regardless of which optional pose assets exist yet (currently: only the master).

### 10.3 Pose mapping

Reuses the existing chat state machine (§2–§5 above) — no second state machine:

| Pose | Existing state |
|---|---|
| `idle` | default, no active conversation |
| `greeting` | AC-1's one-time welcome message |
| `thinking` | `/api/taebo/chat` request in flight (`loading`) |
| `helping` | a matched, non-escalated reply |
| `waiting` | an escalated reply (AC-3/AC-4) or a network/API error — Taebo must never look like it "knows" something it doesn't |
| `success` | reserved for other pages' own request-submitted states (Get a Quote, Custom Request, File Format Request) — deliberately not wired inside the chat widget itself in this pass, to avoid touching those pages' unrelated business logic; the pose/asset is ready for them to adopt later |
| `mobile` | optional cosmetic crop; functional mobile sizing is CSS, independent of whether this asset exists |

### 10.4 Launcher position, drag, and persistence

The **closed-state launcher is the full-body panda itself** — never cropped into a circular avatar
or placed inside a generic round chatbot-icon background (the panel-header avatar is a separate,
smaller circular crop of the same master image, used only inside the open 320px panel where a
compact mark is appropriate). Sized ~90–130px tall on desktop, ~70–95px on mobile, via CSS
breakpoints only. Default position: bottom-right (matches the original fixed anchor). The launcher
is draggable — mouse and touch via Pointer Events, with a small movement threshold so a plain click
still opens chat and a drag never accidentally triggers it. Position is clamped to the viewport at
all times (never draggable fully off-screen) and stored client-side only
(`localStorage['czd.taebo.position']` — a UI preference, not a new backend table). A "Reset Taebo
position" control inside the open panel restores the default. The **chat panel itself is not
draggable**; when opened it repositions (above/below, left/right of the launcher) only as needed to
stay fully on-screen given wherever the launcher currently is.

### 10.5 Accessibility

The launcher is a real `<button>` with `aria-label="Open Taebo assistant"`; Enter/Space activates it
identically to a click, with no drag involved, so keyboard users are never required to drag to open
chat. Focus is visible (`focus-visible:ring`). Ambient motion (idle bob, hover/scroll transitions)
respects `prefers-reduced-motion` (`apps/web/app/globals.css`); drag movement itself is user-driven
and stays instant regardless.

### 10.6 Responsive behaviour

Preserves all existing responsive behaviour; the launcher/panel/proactive-bubble never render
outside the viewport at any width tested (390–1920px), and dragging cannot move them there either
(§10.4's clamp).

### 10.7 Production-content restriction

No hard-coded demo/test message anywhere in the UI (e.g. a fabricated "Do you deliver to a remote
research station in Antarctica?"-style greeting). A full-repo search as part of this addendum found
no such string in production UI — the only occurrence is a legitimate backend unit-test fixture
(`apps/api/src/taebo/taebo.service.spec.ts`) asserting AC-3's escalation behaviour, which is correct
test content, not a defect. If a real customer asks an out-of-scope question, the existing
AC-3/AC-4 escalation is the correct, intended behaviour.

### 10.8 Chatbot identity and panel theme (2026-09-13, second addendum)

The assistant's name is **"TAEBO"**, subtitled "Your CZ Digitizing Assistant" — not "Taebo Helping
Panda" (the panel header's previous UI text, corrected here; the aspect's own title in
`SPEC_INDEX.md`/master-spec cross-references, "Taebo Helping Panda (Chatbot)", is a stable
spec-numbering identifier, not rendered UI copy, and is deliberately left as-is). The open panel is
a dark navy surface (navy-800 header with a small online-status dot, navy-900/700 body, white
customer bubbles, navy-700 Taebo bubbles, gold-tinted escalated bubbles, gold Send button, a
dot-based typing indicator) — a deliberate, scoped exception to the site's usual white-card chat
surface, because the supplied reference specifically shows a dark chat UI.

### 10.9 Quick actions

Before the first message, the panel shows pill links to real existing pages — Browse Designs,
Design Categories, Embroidery Digitizing, Vector Art, Get a Quote, Custom Request, Orders &
Downloads, File Formats, Contact Support (`apps/web/components/TaeboWidget.tsx`'s `QUICK_ACTIONS`)
— plain navigation `<Link>`s, not chatbot logic, each pointing at a route that already exists.
Embroidery Digitizing/Vector Art both resolve to `/services` (the one real Services page covering
both); File Formats resolves to `/faq` (no dedicated customer-facing file-format page exists to
link instead).

### 10.10 Expressions — documented, not implemented

The supplied reference also depicts six expressions (Happy, Thinking, Excited, Winking, Surprised,
Friendly) layered on top of the seven main states. No distinct expression assets exist, and a
static photo cannot be convincingly re-expressed via CSS alone, so no `expression` prop was added —
doing so would be inert, unobservable code. If individual expression crops are supplied later, they
plug into the same `taebo-<pose>.png` fallback chain `TaeboPanda.tsx` already implements.
