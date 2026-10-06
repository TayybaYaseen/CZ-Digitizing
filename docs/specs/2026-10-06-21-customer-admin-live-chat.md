# Spec: Customer ↔ Admin Live Chat (Human Support Chat)

**File:** `docs/specs/2026-10-06-21-customer-admin-live-chat.md`
**Aspect ID:** A-025 (see [`SPEC_INDEX.md`](SPEC_INDEX.md) § Aspect Registry)
**Status:** Implemented

> **SPECIFICATION:** CREATED (2026-10-06)
> **IMPLEMENTATION:** COMPLETED (2026-10-06) — see §38 for implementation notes and verification
> **APPROVAL:** APPROVED by the Primary Admin, 2026-10-06
>
> Approved before any code was written. No material difference from this spec was found during
> implementation; the small refinements made are listed in §38 rather than changed silently.

**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), [Auth spec](2026-08-28-01-auth-account-security.md),
[Notifications spec](2026-08-28-02-notifications-system.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md),
[Custom design requests spec](2026-08-28-12-custom-design-requests.md), [Smart Get a Quote spec](2026-08-28-11-smart-get-a-quote.md),
[Customer account spec](2026-08-28-14-customer-account-history.md), [Taebo spec](2026-08-28-15-taebo-chatbot.md),
[i18n spec](2026-08-28-16-internationalization.md), [`docs/i18n.md`](../i18n.md), SRS §9 ("WhatsApp/human support remains
available") and §10 ("Notifications + Support")

---

## Contents

1. Feature name · 2. Feature ID · 3. Objective · 4. Scope · 5. Out of scope · 6. Customer requirements ·
7. Admin requirements · 8. UI/UX requirements · 9. Database architecture · 10. API requirements ·
11. Socket.IO / realtime architecture · 12. Authentication & authorization · 13. Conversation model ·
14. Message model · 15. Read/unread behavior · 16. Conversation status · 17. Notifications ·
18. Customer information shown to Admin · 19. Order / custom-request association · 20. Message history ·
21. Pagination · 22. Search / filtering · 23. Mobile behavior · 24. Desktop behavior · 25. Internationalization ·
26. RTL support · 27. Accessibility · 28. Security · 29. File attachment architecture · 30. Error handling ·
31. Performance requirements · 32. Edge cases · 33. Testing requirements · 34. Acceptance criteria ·
35. Dependencies · 36. Risks · 37. Future extensibility · 38. Implementation notes · Appendix A: existing architecture discovered ·
Appendix B: decisions requiring approval

---

## 1. Feature name

**Customer ↔ Admin Live Chat** — customer-facing label **"Chat with Support"**, Admin-facing location
**Admin → Customer Support → Live Chat**.

## 2. Feature ID

- **Aspect:** `A-025` — next free ID in the registry (A-001…A-024 are taken; IDs are never renumbered).
- **Spec file number:** `21` — next number after `2026-09-01-20-landing-page-experience.md` in the
  `YYYY-MM-DD-NN-slug.md` convention.

## 3. Objective

Give signed-in customers a real-time, persistent text conversation with the CZ Digitizing team, and give
Admin one inbox to answer, triage and resolve those conversations — optionally tied to the order, custom
request, quote or file-format request the customer is asking about.

**Today:** a customer who needs a human has only the Contact Us form (one-way, email-like, Admin answers
outside the platform), WhatsApp (off-platform, no record against the customer), Taebo's "Waiting for
Admin" escalation (one question → one answer, not a conversation), or the per-custom-request message
thread (only exists once a custom request exists). None of them is a general, two-way, in-platform
support conversation with history.

**Success looks like:** a customer can open "Chat with Support" from anywhere they'd look for help,
send a message, get a reply in real time (or a notification if they've left), and pick the same
conversation up days later; Admin sees every conversation in one list with unread counts, the customer's
details and the related order/request, and moves it through Open → Pending → Resolved.

## 4. Scope

**In scope (first implementation):**

- Signed-in customers (`role=customer`, real account — see §32 for guest-checkout identities).
- Customer website (`apps/web`): conversation list + conversation thread at `/account/support`, entry
  points from the account menu, Taebo panel, Contact Us page, order cards and custom-request rows.
- Admin panel (`apps/admin`): `Customer Support → Live Chat` inbox at `/support/live-chat`, with search,
  filters, customer-info panel, context card and status control.
- Text messages (plain text, up to 4,000 characters, line breaks preserved, http/https links auto-linked).
- Real-time delivery, typing indicator and read receipts over the **existing** Socket.IO server (new
  namespace on the same NestJS gateway stack — not a second realtime system).
- REST API for all writes and all reads (single validated write path; see §11.1).
- Optional conversation context: general, order, custom request, quote, file-format request.
- Conversation statuses `open` / `pending` / `resolved` with automatic reopen on customer reply.
- Unread counts on both sides; in-app + email + push notifications through the existing
  `NotificationService`, de-duplicated (§17).
- New `AdminModule.support_chat` permission so freelancer/moderator accounts can be scoped (A-005f).
- All customer-visible strings in all 15 locales, RTL-correct for Arabic and Urdu.
- Audit-log entries for status changes.

## 5. Out of scope

| Item | Why / where it goes |
|---|---|
| **File attachments** | Phase 2 (§29) — designed here, not built in the first implementation. |
| Guest (not signed-in) chat, including guest-checkout cookie identities | No JWT to authenticate a socket or own a conversation safely; guests are sent to sign in (§32). |
| Native mobile app (`apps/mobile`) chat screens | API/socket are client-agnostic so A-023 can add screens later; push notifications still reach the device. |
| Presence ("Available / Offline") | Not reliable enough to promise to customers (an open admin tab ≠ someone answering). §11.9. |
| Message edit / delete / reactions | Not requested; adds moderation and history complexity. |
| Admin-initiated new conversations | Admin can reply to and continue any existing conversation; starting one is a future extension. |
| Assignment to a specific admin, internal notes, canned replies, SLA timers | Future (§37). Read state on the Admin side is team-level in v1. |
| Full-text search inside message bodies | Future (needs `pg_trgm`/FTS index). v1 searches customer/conversation/order identifiers. |
| Merging with Taebo or importing Taebo transcripts | Taebo stays a separate AI assistant (§8.3). |
| Translating message content | Messages are user content, shown exactly as typed. |
| Data export of transcripts (A-005e) | Excluded from every export unless a dedicated support export is specified later. |
| Horizontal scaling of the socket server (Redis adapter) | Not needed on the current single-instance deploy; §36 risk #1. |

## 6. Customer requirements

A signed-in customer can:

| # | Requirement |
|---|---|
| C-1 | Start a conversation with "CZ Digitizing Support" from any entry point (§8.1) by typing a first message. |
| C-2 | Start it from an order, custom request, quote or file-format request so the context is attached automatically (§19). |
| C-3 | Send further messages; each shows *Sending… → Sent → Seen* (§15). |
| C-4 | Receive Admin replies in real time while the thread is open, without refreshing. |
| C-5 | See all of their own past conversations, newest activity first, and reopen any of them. |
| C-6 | Continue a conversation later — including a `resolved` one, which reopens it (§16). |
| C-7 | See an unread count per conversation and a total unread badge in the account menu. |
| C-8 | Receive a notification (in-app, email, push per their preferences) when Admin replies and they are not looking at the conversation. |
| C-9 | Use the chat comfortably on mobile and desktop (§23, §24), in any of the 15 languages (§25, §26). |

A customer can **never**: read or write another customer's conversation; learn whether another
conversation ID exists; see which individual admin replied (replies show as "CZ Digitizing Support",
§18.3); see internal fields (status-change actor, admin read pointers, audit data); attach a context
object they don't own; reach any admin route or admin socket room.

## 7. Admin requirements

An Admin (`role=admin`, or a freelancer/moderator holding `support_chat`) can, at
**Admin → Customer Support → Live Chat**:

| # | Requirement | Min. permission |
|---|---|---|
| AD-1 | View all customer conversations, most recent activity first. | `support_chat:read_only` |
| AD-2 | Search by customer name / email / username, conversation ID, order ID or bank-transfer reference, custom-request ID. | `read_only` |
| AD-3 | Filter by status (Open / Pending / Resolved / All), "Unread only", and context type. | `read_only` |
| AD-4 | Open a conversation and read its full history (paged). | `read_only` |
| AD-5 | See unread counts per conversation and a total badge on the sidebar item. | `read_only` |
| AD-6 | Mark a conversation as read (automatic on viewing; explicit "Mark as unread" is future). | `read_only` |
| AD-7 | Reply in real time. | `crud` |
| AD-8 | See the customer's details (§18) and the related context card (§19), with links to the full record. | `read_only` |
| AD-9 | Change status Open ↔ Pending ↔ Resolved. | `crud` |
| AD-10 | Continue an old conversation (reply to a resolved one — reopens it as `pending`, §16). | `crud` |
| AD-11 | Receive a notification for new customer messages when not already viewing that conversation. | `read_only` |

## 8. UI/UX requirements

### 8.1 Customer entry points

The header is deliberately **not** given a new icon: the 2026-09-12 header-overflow incident
(`docs/incidents/2026-09-12-header-navigation-overflow.md`) showed it has no spare width at 1366/1440px.

| Entry point | Behaviour |
|---|---|
| Account menu (`AccountMenu.tsx`) | New item "Chat with Support" with an unread-count pill; the avatar trigger shows a small dot when support unread > 0. |
| My Account (`/account`) | "Chat with Support" card/link alongside the other account sections. |
| Taebo panel (`TaeboWidget.tsx`) | A clearly separate button "Chat with a person" → `/account/support/new` (signed in) or `/login?next=/account/support/new`. Sits next to the existing Contact/WhatsApp links; Taebo's own answering is unchanged. |
| Contact Us (`/contact`) | "Prefer to chat? Chat with Support" link for signed-in customers. |
| Order card (`OrderCard.tsx`, `/account/orders`) | "Ask about this order" → `/account/support/new?context=order&id=<orderId>`. |
| Custom request row (`/account/custom-requests`) | "Chat with Support about this request" (see §19.3 for how this differs from the existing request thread). |
| Quote / file-format request rows | Same pattern with `context=quote` / `context=file_format_request`. |
| Notification click-through | `support_reply` notification opens `/account/support/<conversationId>`. |

### 8.2 Customer chat screen

```
┌───────────────────────────────────────────────────────────┐
│ ←  CZ Digitizing Support                        [Order #1234] │  header: title + context chip
│    Our team replies here — we'll notify you of new replies.   │  subtitle (no presence claim)
├───────────────────────────────────────────────────────────┤
│                 ── Tuesday, 6 October ──                       │  day separator (locale-formatted)
│  ┌─────────────────────────┐                                    │
│  │ Support message           │  10:42                           │  start-aligned, light surface
│  └─────────────────────────┘                                    │
│                                ┌─────────────────────────┐      │
│                       10:44    │ Customer message          │      │  end-aligned, navy surface
│                                └─────────────────────────┘      │
│                                                   Seen ✓✓       │  read receipt on own last msg
│  Support is typing…                                              │
├───────────────────────────────────────────────────────────┤
│ [ Type a message…                                ]  [ Send ]   │  sticky composer
└───────────────────────────────────────────────────────────┘
```

- Header title: **"CZ Digitizing Support"** with a team/headset icon — never the Taebo panda.
- Context chip (when present): "Order #1234" / "Custom request #56" / "Quote #78" / "Format request #9",
  linking to the customer's own record.
- Status shown to the customer only as: `resolved` → a banner "This conversation was marked resolved.
  Send a message to reopen it." `open`/`pending` are not surfaced (they are Admin triage states).
- Composer: multiline textarea, placeholder "Type a message…", Enter sends on desktop, Shift+Enter =
  newline; on touch devices Enter inserts a newline and only the Send button sends. Character counter
  appears after 3,500 chars. Send disabled when empty/whitespace-only.
- New conversation screen (`/account/support/new`): optional context chip + the composer; no
  conversation row is created until the first message is sent (§13.3).
- Conversation list (`/account/support`): each row shows context label (or "General support"), last
  message preview (prefixed "You: " when the customer sent it), relative timestamp, unread pill,
  "Resolved" tag where applicable; "New conversation" button.

### 8.3 Coexistence with Taebo

| | Taebo AI Assistant | Chat with Support |
|---|---|---|
| Who answers | AI grounded in approved FAQ content (A-020, unchanged) | A person on the CZ Digitizing team |
| Where | Floating, draggable panda launcher on every page | Full page at `/account/support` (no second floating launcher) |
| Visual identity | Panda character, "TAEBO / Your CZ Digitizing Assistant" | Headset/team icon, "CZ Digitizing Support", "Real people from our team" |
| Sign-in | Not required | Required |
| Data | `taebo_*` tables | `support_*` tables (no shared rows, no shared socket namespace) |

Taebo's label in its panel header becomes / stays **"Taebo AI Assistant"** wording where it names itself
to the customer, and its new "Chat with a person" button is the explicit hand-off. Taebo's
"Waiting for Admin" escalation flow, its notifications (`taebo_waiting`/`taebo_answered`) and its admin
page are untouched. A second floating bubble is intentionally avoided so the two never sit on top of
each other or compete for the same corner.

### 8.4 Admin UI

Sidebar (`apps/admin/components/Sidebar.tsx`): the existing `Support` section is renamed
**Customer Support** and gains **Live Chat** as its first item, with an unread-conversation badge:

```
Customer Support
  Live Chat                 (3)
  Taebo — Waiting for Admin
  Contact Messages
```

Live Chat page (`/support/live-chat`, `/support/live-chat/[id]`):

```
┌──────────────── List (360px) ───────┬──────────── Thread ───────────────┬─── Customer (320px) ──┐
│ [Search name, email, #id, order…  ] │ Ayesha Khan · Order #1234  [Open ▾]│ Ayesha Khan           │
│ Open | Pending | Resolved | All      │                                   │ ayesha@…  · +92…      │
│ ☐ Unread only   Context: [Any ▾]     │  messages… (customer start-side,  │ Customer since 2026-03│
│─────────────────────────────────────│   support end-side, admin name on │ Lang: Urdu            │
│ ● Ayesha Khan        10:44   (2)     │   each support bubble)            │ Orders: 4  Requests: 1│
│   Order #1234 · "Is my file ready…"  │                                   │ [Open customer ↗]     │
│   Bilal R.           Yesterday       │  Ayesha is typing…                │───────────────────────│
│   General · You: Sure, I'll check…   │───────────────────────────────────│ Order #1234           │
│                                      │ [Reply…                ] [Send]   │ Payment: Pending · …  │
└──────────────────────────────────────┴───────────────────────────────────┴───────────────────────┘
```

- List row: customer display name (fallback email), context label, last-message preview, timestamp,
  unread count, status pill (Open = gold, Pending = silver, Resolved = muted).
- Status control in the thread header: dropdown Open / Pending / Resolved. Status changes add a
  system line to the thread ("Marked resolved by Sana · 11:02") visible to Admin only (§14.3).
- Support bubbles show the replying admin's display name to other admins.
- Admin UI is English-only, consistent with the rest of `apps/admin` (`docs/i18n.md`: "The admin panel
  is not localized").
- Uses the existing admin component set (`ui/`, `ErrorBanner`, `ButtonSpinner`) and design tokens.

### 8.5 UI states (both apps)

| State | Behaviour |
|---|---|
| Loading | Skeleton rows in lists; spinner at top when loading older messages; composer stays usable. |
| Empty (customer list) | "No conversations yet" + "Start a conversation" button. |
| Empty (thread) | Context chip + a short prompt "How can we help?"; no fake greeting message from Support. |
| Empty (admin list) | "No conversations match these filters" with a "Clear filters" action. |
| Error (load) | `ErrorBanner` with Retry; never shown as an empty list. |
| Error (send) | The failed bubble stays with "Not sent · Retry" (§30). |
| Offline / reconnecting | Thin banner "Reconnecting… messages will still send" (REST works without the socket). |
| Success | Message appears immediately (optimistic), confirmed by server ack. |

**Route(s):** `/account/support`, `/account/support/new`, `/account/support/[id]` (web);
`/support/live-chat`, `/support/live-chat/[id]` (admin).

## 9. Database architecture

Two new tables, three new enums, additive changes to two existing enums and one existing table. Model
names are prefixed `Support…` to keep them unmistakably separate from `TaeboConversation`/`TaeboMessage`
and from the per-request `CustomRequestMessage`.

### 9.1 New enums

```prisma
enum SupportConversationStatus {
  open      // needs Admin attention (new, or customer replied last)
  pending   // Admin is waiting on the customer
  resolved  // closed by Admin; any customer message reopens it
}

enum SupportContextType {
  general
  order
  custom_request
  quote
  file_format_request
}

enum SupportSenderType {
  customer
  admin
  system   // status-change lines; Admin-visible only (§14.3)
}
```

### 9.2 `SupportConversation` → table `support_conversations`

```prisma
model SupportConversation {
  id         BigInt @id @default(autoincrement())
  customerId BigInt @map("customer_id")
  customer   User   @relation("SupportConversationCustomer", fields: [customerId], references: [id], onDelete: Cascade)

  status      SupportConversationStatus @default(open)
  contextType SupportContextType        @default(general) @map("context_type")

  // Exactly the one FK matching contextType is set (CHECK constraint, §9.6); all null for `general`.
  // SetNull: deleting the context record must never delete the transcript.
  orderId             BigInt?            @map("order_id")
  order               Order?             @relation(fields: [orderId], references: [id], onDelete: SetNull)
  customRequestId     BigInt?            @map("custom_request_id")
  customRequest       CustomRequest?     @relation(fields: [customRequestId], references: [id], onDelete: SetNull)
  quoteId             BigInt?            @map("quote_id")
  quote               Quote?             @relation(fields: [quoteId], references: [id], onDelete: SetNull)
  fileFormatRequestId BigInt?            @map("file_format_request_id")
  fileFormatRequest   FileFormatRequest? @relation(fields: [fileFormatRequestId], references: [id], onDelete: SetNull)

  // Denormalized from the newest non-system message so list views need no join/N+1.
  lastMessageAt         DateTime           @default(now()) @map("last_message_at")
  lastMessagePreview    String?            @map("last_message_preview") // first 140 chars
  lastMessageSenderType SupportSenderType? @map("last_message_sender_type")

  // Read pointers are the source of truth (§15); the counters are maintained in the same
  // transaction as every message insert / read update so lists and badges are a plain column read.
  customerLastReadMessageId BigInt?   @map("customer_last_read_message_id")
  customerLastReadAt        DateTime? @map("customer_last_read_at")
  adminLastReadMessageId    BigInt?   @map("admin_last_read_message_id")  // team-level in v1
  adminLastReadAt           DateTime? @map("admin_last_read_at")
  customerUnreadCount       Int       @default(0) @map("customer_unread_count")
  adminUnreadCount          Int       @default(0) @map("admin_unread_count")

  statusChangedAt        DateTime? @map("status_changed_at")
  statusChangedByAdminId BigInt?   @map("status_changed_by_admin_id")
  statusChangedByAdmin   User?     @relation("SupportConversationStatusChangedBy", fields: [statusChangedByAdminId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  messages      SupportMessage[]
  notifications Notification[]

  @@index([customerId, lastMessageAt(sort: Desc)], map: "idx_support_conversations_customer_activity")
  @@index([status, lastMessageAt(sort: Desc)], map: "idx_support_conversations_status_activity")
  @@index([orderId], map: "idx_support_conversations_order")
  @@index([customRequestId], map: "idx_support_conversations_custom_request")
  @@index([quoteId], map: "idx_support_conversations_quote")
  @@index([fileFormatRequestId], map: "idx_support_conversations_file_format_request")
  @@map("support_conversations")
}
```

### 9.3 `SupportMessage` → table `support_messages`

```prisma
model SupportMessage {
  id             BigInt              @id @default(autoincrement()) // also the ordering key (§14.2)
  conversationId BigInt              @map("conversation_id")
  conversation   SupportConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  senderType   SupportSenderType @map("sender_type")
  // SetNull: an admin account being removed must not delete what they wrote to customers.
  senderUserId BigInt?           @map("sender_user_id")
  sender       User?             @relation("SupportMessageSender", fields: [senderUserId], references: [id], onDelete: SetNull)

  body            String   @db.Text        // 1–4,000 chars after normalization (§28.4)
  clientMessageId String   @map("client_message_id") @db.Uuid // idempotency key from the client (§11.6)
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([conversationId, clientMessageId], map: "uq_support_messages_conversation_client_id")
  @@index([conversationId, id], map: "idx_support_messages_conversation_id")
  @@map("support_messages")
}
```

No per-message `readAt`/`deliveredAt` columns: read state is derived from the read pointers (§15), and
"delivered" is not persisted (§14.4).

### 9.4 Changes to existing models

| Model / enum | Change | Notes |
|---|---|---|
| `enum AdminModule` | add `support_chat` | Non-breaking enum addition (the enum's own comment anticipates this). |
| `enum NotificationType` | add `support_reply`, `support_message` | §17. |
| `Notification` | add `relatedSupportConversationId BigInt?` → `SupportConversation` (`onDelete: SetNull`) + index | Click-through target, same pattern as `relatedContactMessageId`. |
| `User` | add back-relations `supportConversations`, `supportMessages`, `supportStatusChanges` | Relation fields only, no columns. |
| `Order`, `CustomRequest`, `Quote`, `FileFormatRequest` | add back-relation `supportConversations SupportConversation[]` | Relation fields only, no columns. |

### 9.5 Relations & cascade summary

| From → To | On delete of target |
|---|---|
| conversation → customer (`users`) | **Cascade** (a deleted customer's support transcript goes with them; same as `notifications`). |
| conversation → order / custom request / quote / file-format request | **SetNull** (transcript survives; context chip shows "no longer available"). |
| conversation → status-changing admin | SetNull |
| message → conversation | Cascade |
| message → sender user | SetNull (shown as "CZ Digitizing Support" / "Former team member") |
| notification → conversation | SetNull |

### 9.6 Constraints written as raw SQL in the migration

Prisma cannot express these; the repo already does the same (e.g. `cart_items` CHECK,
`emb_never_public` CHECK).

```sql
-- Context FK must match context_type; at most one FK set.
ALTER TABLE support_conversations ADD CONSTRAINT support_conversation_context_matches CHECK (
  (context_type = 'general'             AND order_id IS NULL AND custom_request_id IS NULL AND quote_id IS NULL AND file_format_request_id IS NULL) OR
  (context_type = 'order'               AND custom_request_id IS NULL AND quote_id IS NULL AND file_format_request_id IS NULL) OR
  (context_type = 'custom_request'      AND order_id IS NULL AND quote_id IS NULL AND file_format_request_id IS NULL) OR
  (context_type = 'quote'               AND order_id IS NULL AND custom_request_id IS NULL AND file_format_request_id IS NULL) OR
  (context_type = 'file_format_request' AND order_id IS NULL AND custom_request_id IS NULL AND quote_id IS NULL)
);
-- (the context FK itself may become NULL later via SetNull, so non-null is enforced in the service at creation, not here)

-- At most ONE non-resolved conversation per customer per context target (makes "start" idempotent, §13.3).
CREATE UNIQUE INDEX uq_support_conversations_active_context ON support_conversations (
  customer_id, context_type,
  COALESCE(order_id, 0), COALESCE(custom_request_id, 0), COALESCE(quote_id, 0), COALESCE(file_format_request_id, 0)
) WHERE status <> 'resolved';

-- Counters never go negative.
ALTER TABLE support_conversations ADD CONSTRAINT support_unread_non_negative
  CHECK (customer_unread_count >= 0 AND admin_unread_count >= 0);
ALTER TABLE support_messages ADD CONSTRAINT support_message_body_length
  CHECK (char_length(body) BETWEEN 1 AND 4000);
```

### 9.7 Migration (to be authored only after approval)

- **Name:** `add_support_live_chat` (timestamped folder per repo convention).
- **Reversible:** yes (drop two tables, the FK column on `notifications`; enum value removal requires
  the usual Postgres enum-recreate if ever rolled back).
- **Backfill:** none. **Downtime:** none (new tables; one nullable column on `notifications`).
- Must be applied to the dev DB and verified, and integration tests run against a **throwaway** DB
  (never `czdigitizing`).

### 9.8 Authorization implications of the model

- Every customer query includes `customerId = <JWT sub>` in the **same** `WHERE` as the conversation
  id (no load-then-check), returning 404 on mismatch.
- Context ownership is checked at creation (`order.customerId = sub`, etc.) and never trusted from the
  client afterwards.
- `system` messages and `statusChangedByAdminId` are never selected for customer responses.

## 10. API requirements

Conventions per [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract): `/api/...`
customer routes, `/api/admin/...` admin routes, `ApiResponse<T>` envelope (`{ data, meta? }`), `ApiError`
envelope with stable `code`, BigInt IDs serialized as strings, class-validator DTOs under the global
`ValidationPipe({ whitelist, forbidNonWhitelisted })`, `JwtAuthGuard` + `RolesGuard` +
`AdminPermissionsGuard`, `@RateLimit` per route. New module: `apps/api/src/support-chat/`. Shared DTOs in
`packages/shared-types/src/support-chat.ts`.

### 10.1 Customer routes — `@Controller('api/support')`, `role=customer` only

| Method | Route | Success | Notes |
|---|---|---|---|
| `GET` | `/api/support/conversations?page=&pageSize=` | `200` `SupportConversationSummaryDto[]` + meta | Own conversations, `lastMessageAt desc`. pageSize ≤ 50 (default 20). |
| `POST` | `/api/support/conversations` | `201` (created) / `200` (existing active one reused) `SupportConversationDto` + first `SupportMessageDto` | Body `StartConversationDto`. Rate limit 10/hour. §13.3. |
| `GET` | `/api/support/conversations/:id` | `200` `SupportConversationDto` | 404 if not own. |
| `GET` | `/api/support/conversations/:id/messages?before=&after=&limit=` | `200` `SupportMessageDto[]` + `meta.hasMore` | Cursor paging (§21). Excludes `system`. |
| `POST` | `/api/support/conversations/:id/messages` | `201` new / `200` duplicate `SupportMessageDto` | Body `SendSupportMessageDto`. Idempotent on `clientMessageId`. Reopens a resolved conversation (§16). Rate limit 30/min. |
| `POST` | `/api/support/conversations/:id/read` | `200` `{ customerUnreadCount, totalUnread }` | Body `{ upToMessageId }`; pointer only moves forward. |
| `GET` | `/api/support/unread-count` | `200` `{ total }` | Sum of `customerUnreadCount`; used for the account-menu badge. |

### 10.2 Admin routes — `@Controller('api/admin/support')`, `role ∈ {admin, freelancer, moderator}` + `@RequiresPermission('support_chat', …)`

| Method | Route | Permission | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/admin/support/conversations?status=&unread=&contextType=&q=&page=&pageSize=` | `read_only` | `200` `AdminSupportConversationSummaryDto[]` + meta | §22. Default sort `lastMessageAt desc`. |
| `GET` | `/api/admin/support/conversations/:id` | `read_only` | `200` `AdminSupportConversationDto` | Includes customer info (§18) and context card (§19). |
| `GET` | `/api/admin/support/conversations/:id/messages?before=&after=&limit=` | `read_only` | `200` `AdminSupportMessageDto[]` | Includes `system` lines and sender admin names. |
| `POST` | `/api/admin/support/conversations/:id/messages` | `crud` | `201`/`200` `AdminSupportMessageDto` | Idempotent on `clientMessageId`. Reply to `resolved` reopens as `pending`. Rate limit 60/min. |
| `POST` | `/api/admin/support/conversations/:id/read` | `read_only` | `200` `{ adminUnreadCount, totalUnreadConversations }` | Team-level pointer. |
| `PATCH` | `/api/admin/support/conversations/:id/status` | `crud` | `200` `AdminSupportConversationDto` | Body `{ status }`. Writes a `system` message + `AuditLog` (`SUPPORT_CONVERSATION_STATUS_CHANGED`). 409 `CONVERSATION_ALREADY_OPEN` if reopening would violate §9.6's unique index. |
| `GET` | `/api/admin/support/unread-count` | `read_only` | `200` `{ conversations }` | Count of conversations with `adminUnreadCount > 0`; sidebar badge. |

### 10.3 DTOs (`packages/shared-types/src/support-chat.ts`)

```ts
export type SupportConversationStatus = 'open' | 'pending' | 'resolved';
export type SupportContextType = 'general' | 'order' | 'custom_request' | 'quote' | 'file_format_request';

export interface SupportContextRefDto {
  type: SupportContextType;
  id: string | null;           // null for general, or after the target was deleted (SetNull)
  label: string | null;        // e.g. "1234" — display number only; UI composes "Order #1234" via i18n
}

export interface SupportConversationSummaryDto {        // customer list row
  id: string;
  context: SupportContextRefDto;
  isResolved: boolean;                                   // customers never see open vs pending
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  lastMessageAt: string;                                 // ISO
  unreadCount: number;
}

export interface SupportConversationDto extends SupportConversationSummaryDto {
  createdAt: string;
  supportLastReadMessageId: string | null;               // drives "Seen" on the customer's own messages
}

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'admin';                      // never 'system' on customer routes
  body: string;
  clientMessageId: string;
  createdAt: string;
  // admin identity deliberately absent on customer routes (§18.3)
}

export interface StartConversationDto {
  contextType: SupportContextType;                       // default 'general'
  contextId?: string;                                    // required unless general
  clientMessageId: string;                               // UUID v4
  body: string;                                          // 1–4000 after trim
}

export interface SendSupportMessageDto { clientMessageId: string; body: string; }

export interface AdminSupportConversationSummaryDto {
  id: string;
  status: SupportConversationStatus;
  customer: { id: string; displayName: string | null; email: string };
  context: SupportContextRefDto;
  lastMessagePreview: string | null;
  lastMessageSenderType: 'customer' | 'admin' | null;
  lastMessageAt: string;
  unreadCount: number;                                   // adminUnreadCount
}

export interface AdminSupportConversationDto extends AdminSupportConversationSummaryDto {
  customerInfo: SupportCustomerInfoDto;                  // §18
  contextCard: SupportContextCardDto | null;             // §19
  customerLastReadMessageId: string | null;
  statusChangedAt: string | null;
  statusChangedBy: { id: string; displayName: string | null } | null;
  createdAt: string;
}

export interface AdminSupportMessageDto extends Omit<SupportMessageDto, 'senderType'> {
  senderType: 'customer' | 'admin' | 'system';
  sender: { id: string; displayName: string | null } | null;
}
```

`SupportCustomerInfoDto` and `SupportContextCardDto` are defined in §18/§19.

### 10.4 New error codes (added to `ApiErrorCode` before first use)

| Code | HTTP | When |
|---|---|---|
| `CONVERSATION_ALREADY_OPEN` | 409 | Reopening/creating would create a second active conversation for the same context; response `errors`/details carry the existing conversation id so the UI can redirect. |

Everything else reuses existing codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN`
(403, admin permission), `RESOURCE_NOT_FOUND` (404 — also used for "not yours"), `RATE_LIMITED` (429).
Each new code gets an `apiErrors.*` key in all 15 web locale files (`apps/web/i18n/api-errors.ts`).

## 11. Socket.IO / realtime architecture

### 11.1 Design decision: REST writes, socket push

- **All writes (send, read, status) go through REST**, so authorization, validation, rate limiting, error
  envelopes and idempotency live in exactly one place (the guards/pipes the API already has).
- **Socket.IO carries only server→client pushes** (new message, read receipts, conversation updates,
  unread totals) **plus ephemeral client→server signals** that are never persisted (`join`, `leave`,
  `typing`, `viewing`).
- The HTTP response *is* the acknowledgement for a send. This differs from the existing
  `/custom-requests` gateway (which writes on the socket with no ack and no error path); that gateway is
  not changed by this aspect.

### 11.2 Server

- Reuses the existing stack: `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` 4.8 —
  **no new packages**.
- New gateway `SupportChatGateway` on namespace **`/support-chat`** (same server/port as the API and the
  existing `/custom-requests` namespace).
- CORS for the namespace uses the same `CORS_ORIGINS` allowlist as `main.ts`'s `enableCors` (the
  existing gateway's `origin: true` is not copied).
- In-memory adapter (single API instance on the current deploy). Redis adapter is a documented future
  need (§36).

### 11.3 Authentication

- Handshake: `auth.token` = the current access token (same mechanism as the existing gateway, via
  `TokenService.verifyAccessToken`). Invalid/missing → `connect_error` `UNAUTHENTICATED` and disconnect.
- On connect the server stores `userId`, `role` and `exp`, and schedules a disconnect at `exp`
  (access tokens live 15 minutes). The client's `auth` option is a **callback** that returns a fresh
  token (running the existing silent refresh if needed), so socket.io's automatic reconnect
  re-authenticates transparently.
- Staff: on connect, the gateway resolves whether the user is `role=admin` or holds a non-revoked
  `support_chat` permission (same rule as `AdminPermissionsGuard`). Staff without it are disconnected.
  The permission is re-checked on every `join`.
- Customers: `role=customer` only. Guest identities have no JWT and cannot connect.

### 11.4 Rooms

| Room | Who joins | Purpose |
|---|---|---|
| `support:user:<userId>` | every connected customer socket, automatically on connect | Per-customer pushes: unread totals, conversation updates, new messages for conversations not currently open (keeps multiple tabs in sync). |
| `support:staff` | every connected, permitted staff socket, automatically | Inbox-level updates (new conversation, list-row changes, unread totals). Never carries full message bodies of conversations the admin hasn't opened — only the 140-char preview already in the list. |
| `support:conversation:<id>` | on `join`, after an ownership/permission check | Full message events, typing, read receipts for one open thread. |

### 11.5 Events

Naming follows the existing gateway's style (plain lowercase names inside a feature namespace:
`join`, `message`, `typing`), extended with kebab-case for the new compound ones.

**Client → server** (all accept a socket.io ack callback; ack shape `{ ok: true } | { ok: false, code }`):

| Event | Payload | Behaviour |
|---|---|---|
| `join` | `{ conversationId }` | Ownership (customer) or permission (staff) check, then join `support:conversation:<id>`. Ack `{ ok:false, code:'RESOURCE_NOT_FOUND' }` on failure — identical for "doesn't exist" and "not yours". |
| `leave` | `{ conversationId }` | Leave the room. |
| `typing` | `{ conversationId, isTyping }` | Relayed to the room (excluding sender) only if the socket is in that room. Server drops more than 1 event/sec/socket. Never persisted. |
| `viewing` | `{ conversationId, visible }` | Marks whether this socket is actively looking at the thread (tab visible + thread open). Used only for notification suppression (§17.3). |

**Server → client:**

| Event | Room | Payload |
|---|---|---|
| `message` | `support:conversation:<id>` and the customer's `support:user:<id>` | `SupportMessageDto` (customer sockets) / `AdminSupportMessageDto` (staff sockets) — emitted **after** the DB transaction commits. |
| `read` | `support:conversation:<id>` | `{ conversationId, side: 'customer' \| 'support', lastReadMessageId, readAt }` |
| `typing` | `support:conversation:<id>` | `{ conversationId, side: 'customer' \| 'support', isTyping }` (no admin identity to customers) |
| `conversation-updated` | `support:user:<customerId>` and `support:staff` | Customer: `SupportConversationSummaryDto`. Staff: `AdminSupportConversationSummaryDto`. Status changes, new conversation, new last message. |
| `unread` | `support:user:<id>` / `support:staff` | Customer `{ total }`; staff `{ conversations }`. |

Staff and customer sockets receive differently-shaped payloads; the gateway emits per audience
(`server.to(room).except(...)` is not relied on for data minimization — separate emits per DTO type).

### 11.6 Acknowledgement, duplicate prevention and ordering

1. Client generates `clientMessageId` (UUID v4) and renders an optimistic bubble (`Sending…`).
2. `POST …/messages` → server inserts inside a transaction (message + conversation denormalized fields +
   counters). Unique `(conversationId, clientMessageId)` makes retries idempotent: a duplicate returns
   the **existing** message with `200`, never a second row.
3. HTTP success = ack → the optimistic bubble is replaced by the server DTO (matched on
   `clientMessageId`).
4. After commit the gateway emits `message`. Clients merge by **server `id`** — a message arriving via
   both the HTTP response and the socket is rendered once.
5. Ordering is by server `id` (monotonic `BIGSERIAL`), never by client clock; out-of-order socket
   arrivals are inserted in sorted position.

### 11.7 Reconnect behaviour

- socket.io built-in exponential backoff reconnect; on `connect` the client re-emits `join` for the
  open thread and calls `GET …/messages?after=<last known id>` to fill any gap, then
  `GET …/unread-count`.
- While disconnected, sending still works (REST); the UI shows "Reconnecting…".
- `visibilitychange` → visible triggers the same gap-fill (covers sleeping laptops/mobile tabs).

### 11.8 Disconnect handling

- Server clears the socket's `viewing` flags and typing state on disconnect; any "is typing" shown to
  the other side auto-expires after 5s without a refresh event, so a dropped socket can never leave a
  stuck indicator.
- Token expiry disconnect (`reason: 'auth-expired'`) → client refreshes and reconnects; logout → client
  disconnects explicitly.

### 11.9 Presence

Not shown to customers in v1. Showing "Available" because an admin tab happens to be open would be an
unreliable promise. The customer subtitle sets expectations instead ("Our team replies here — we'll
notify you of new replies"). Admins see a customer "is typing" and "Seen" only.

### 11.10 When sockets connect (efficiency)

- Customer: socket opens only on `/account/support*` pages. Everywhere else the account-menu badge uses
  `GET /api/support/unread-count` on the **existing** 30-second notification-bell polling cycle.
- Admin: socket opens only on `/support/live-chat*`; the sidebar badge elsewhere polls
  `GET /api/admin/support/unread-count` on the same 30s cycle.
- No event is ever broadcast to all connected clients.

## 12. Authentication and authorization

| Actor | REST | Socket |
|---|---|---|
| Anonymous / guest-checkout identity | 401 on every route; UI shows sign-in prompt with `next=` | Connection refused |
| Customer (`role=customer`) | `/api/support/*` only, scoped to own conversations | `/support-chat`, own `support:user:<id>`, only own conversation rooms |
| Staff without `support_chat` | 403 (`AdminPermissionsGuard`, `ACCESS_DENIED` audit row, existing behaviour) | Disconnected on connect |
| Freelancer/moderator with `support_chat:read_only` | All admin GET routes + read | Staff rooms, join any conversation |
| Freelancer/moderator with `support_chat:crud` | + reply, change status | same |
| `role=admin` | Everything (bypasses module check, existing rule) | same |

- Staff accounts cannot use the customer routes (role check), so an admin can't accidentally create
  "customer" conversations with themselves.
- Account members (A-019 AC-7 invited users) have their own user id and their own conversations; they
  do **not** see the primary account holder's conversations, and vice versa.

## 13. Conversation model

### 13.1 Definition

A conversation is one support thread between **one customer** and **the CZ Digitizing team** (not a
specific admin), with an optional single context object, a status, and an ordered list of messages.

### 13.2 How many conversations

- A customer may have many conversations over time.
- At most **one non-resolved conversation per (customer, context target)** — e.g. one active "General
  support" thread and one active thread per order. Enforced by the partial unique index (§9.6).

### 13.3 Starting a conversation (idempotent)

`POST /api/support/conversations` with `{ contextType, contextId?, clientMessageId, body }`:

1. Validate the context: exists **and** belongs to the caller (else 404 — same response as
   "doesn't exist").
2. If an active (non-resolved) conversation already exists for that customer+context → append the
   message to it and return it (`200`).
3. Else create the conversation (`status=open`) and its first message in one transaction (`201`).
4. A concurrent double-submit that races the unique index is caught (P2002) and retried as step 2.
5. Staff are notified (§17); `conversation-updated` is emitted to `support:staff`.

Creating the row only with a first message means there are never empty conversations in the Admin inbox.

## 14. Message model

### 14.1 Content

Plain text, 1–4,000 characters after normalization (§28.4). Rendered as text (React escaping) with
`white-space: pre-wrap`; `http(s)://` URLs auto-linked with `rel="noopener noreferrer nofollow ugc"`
and `target="_blank"`. No HTML, no Markdown rendering.

### 14.2 Ordering

Server-assigned `id` is the canonical order. `createdAt` (server time) is display-only.

### 14.3 System messages

`senderType=system` rows record status changes ("Marked resolved by Sana"). Shown in the Admin thread
only; excluded from all customer queries, previews (`lastMessage*` fields ignore them), unread counts
and notifications.

### 14.4 Delivery state

| State | Meaning | Persisted? |
|---|---|---|
| Sending | Optimistic, request in flight | No (client only) |
| Sent | Server committed (HTTP 2xx) | Implicit (row exists) |
| Failed | Request failed; Retry available | No (client only) |
| Seen | Counterpart's read pointer ≥ this id | Derived from pointer |

A separate "Delivered" state is **not** implemented: on the web it would only mean "a socket received
it", which says nothing about whether a person saw it, and it would need an extra ack round-trip per
recipient. Sent + Seen is the honest pair.

## 15. Read/unread behavior

- Each side has a **read pointer** (`customerLastReadMessageId`, `adminLastReadMessageId`) that only
  ever moves forward (`GREATEST`).
- **Unread for the customer** = admin messages with `id > customerLastReadMessageId`;
  **unread for Admin** = customer messages with `id > adminLastReadMessageId`. The counters on the
  conversation row cache these and are updated in the same transaction as the message insert / pointer
  move (recomputed with an indexed `COUNT` on pointer moves to self-heal any drift).
- A message from side X automatically counts as read *by* X (sending implies you've seen the thread).
- **When a read is recorded:** the thread is open, the document is visible
  (`document.visibilityState === 'visible'`), and the newest message is in (or has been scrolled
  into) view. The client then `POST …/read { upToMessageId }`, debounced 1s.
- **Admin side is team-level in v1:** when any permitted admin reads a thread, it is read for the team.
  Per-admin unread is a future extension (§37).
- Read receipts: the customer sees "Seen" under their latest message once `supportLastReadMessageId`
  covers it; Admin sees "Seen" under the latest support reply once `customerLastReadMessageId` covers it.
- Reading a thread also marks the matching unread `support_reply` / `support_message` in-app
  notification(s) for that conversation as read, so the bell and the chat badge never disagree.

## 16. Conversation status

`open` / `pending` / `resolved` fit the existing architecture: they mirror the Admin-triage split
already used elsewhere (e.g. Taebo's `waiting`/`answered`), and there's no need for more (e.g.
`closed`/`archived`) because resolved conversations stay visible and resumable.

| From | Trigger | To |
|---|---|---|
| (new) | Customer starts conversation | `open` |
| `pending` | Customer sends a message | `open` |
| `resolved` | Customer sends a message | `open` (reopen; `CONVERSATION_ALREADY_OPEN` if another active conversation for the same context exists — UI redirects to it) |
| `open` | Admin replies | stays `open` (Admin chooses `pending` explicitly) |
| `resolved` | Admin replies | `pending` (reopened by Admin, waiting on customer) |
| any | Admin sets status | chosen status (`system` message + audit row; no-op if unchanged) |

- Customers never see `open` vs `pending`; they see only "resolved" (banner) or nothing.
- No automatic time-based resolution in v1 (future).

## 17. Notifications

Reuses `NotificationService.notify()` (A-004) — no new delivery mechanism.

### 17.1 New notification types

| Type | Recipient | Default channels | `ADMIN_ONLY_TYPES`? | Click-through |
|---|---|---|---|---|
| `support_reply` | Customer | `email`, `in_app`, `push` | no (30-day retention) | `/account/support/<id>` (web `notification-link.ts`) |
| `support_message` | Each permitted staff user | `ADMIN_NOTIFICATION_CHANNELS` (`email`, `in_app`) | yes | `/support/live-chat/<id>` (admin) |

Both carry `relatedSupportConversationId`. Per-type opt-out works through the existing preference
center (`support_reply` appears there with all 15 locale labels).

### 17.2 Who is notified

- Admin → customer reply: the conversation's customer.
- Customer → Admin message: every `role=admin` user plus every freelancer/moderator holding a
  non-revoked `support_chat` permission.

### 17.3 Duplicate suppression

A notification is **skipped** for a recipient when either is true:

1. **Actively viewing:** the recipient has a socket in that conversation's room with `viewing=true`
   (thread open, tab visible). The message arrives live instead.
2. **Already notified:** the recipient already has an **unread** notification of that type for that
   conversation. Further messages update nothing; the existing notification still links to the
   thread. Once they read the thread (§15) or the notification, the next message notifies again.

So a burst of ten messages produces at most one notification (and one email) per recipient until it's
read. Notification failures are logged, never thrown into the send request (same pattern as Taebo's
`notifyAdminsWaiting`): the message is already saved.

### 17.4 Content

- Title (customer): "New reply from CZ Digitizing Support"; message: first 140 chars of the reply.
- Title (admin): "New support message from <customer name>"; message: preview + context label.
- Email bodies use the existing branded email template; no message content beyond the preview, and a
  link back into the app (the conversation itself is never emailed in full).
- Customer-facing titles follow the existing notification localization path (type labels in the web
  locale files; email in the recipient's `preferredLocale` if/where the existing email templates
  support it — no new translation system).

## 18. Customer information shown to Admin

### 18.1 `SupportCustomerInfoDto`

| Field | Source | Notes |
|---|---|---|
| `id`, `displayName`, `username`, `email` | `users` | |
| `phone` | `users.phone` | If set. |
| `preferredLocale` | `users.preferred_locale` | Shown as language name — tells the admin which language the customer reads. |
| `memberSince` | `users.created_at` | |
| `accountStatus` | `users.status` | active / inactive / suspended. |
| `counts` | `{ orders, customRequests, quotes, openConversations }` | Single grouped query. |
| `adminProfileHref` | `/customers/<id>` | Existing Admin customer page (A-019); that page enforces its own permissions. |

### 18.2 Not shown

Password/2FA/session data, payment receipts, addresses, credit ledger, audit data. The admin follows
the link to the full customer record (subject to that page's own permission) if they need more.

### 18.3 What customers see about admins

Support messages show as **"CZ Digitizing Support"** to customers — no individual admin names, user
ids or avatars (privacy for freelancer staff; consistent voice). Admins see each other's names.

## 19. Order / custom-request association

### 19.1 Contexts

| `contextType` | Ownership check at creation | Context card fields (Admin) | Admin deep link |
|---|---|---|---|
| `general` | — | — | — |
| `order` | `orders.customer_id = sub` | Order #, status, payment status, total PKR, bank reference, created | `/orders/<id>` |
| `custom_request` | `custom_requests` owner = `sub` | Request #, type, status, payment status, created | `/custom-requests` (row) |
| `quote` | `quotes` owner = `sub` | Quote #, service, status, created | `/quotes` |
| `file_format_request` | `file_format_requests` owner = `sub` | Request #, requested format, status | `/file-format-requests` |

- The context is fixed at creation and cannot be changed by the customer. (Admin "re-link context" is
  a future extension.)
- If the context record is later deleted (`SetNull`), the conversation keeps `contextType` and shows
  "Order (no longer available)".
- General conversations remain fully supported and are the default.
- Guest-checkout orders (owned by an `isGuest` user) can be chatted about once the person signs in
  and claims that identity (existing A-013/guest flow), since the order then belongs to their account.

### 19.2 `SupportContextCardDto`

```ts
export interface SupportContextCardDto {
  type: Exclude<SupportContextType, 'general'>;
  id: string | null;
  label: string;                       // "Order #1234"
  status: string | null;               // raw enum value; admin UI is English
  paymentStatus?: string | null;       // order / custom_request
  totalPkr?: string | null;            // order
  reference?: string | null;           // order bank-transfer reference
  createdAt: string | null;
  adminHref: string | null;
  available: boolean;                  // false after SetNull
}
```

### 19.3 Relationship to the existing custom-request thread (A-017 AC-8)

Custom requests already have their own message thread (`custom_request_messages`, `/custom-requests`
socket namespace) used for **production discussion** with the designer. That thread is unchanged.
"Chat with Support about this request" opens a **support** conversation with `custom_request` context —
for account/payment/delivery questions to the support team. The custom-request page labels the two
distinctly ("Production messages" vs "Chat with Support"). Merging them is explicitly not part of this
aspect (see Appendix B, decision 4).

## 20. Message history

- Retained indefinitely in v1 (no automatic deletion); retention policy is the same open question the
  Taebo spec tracks (master spec §8) and is listed in §36.
- Customers see the full history of their own conversations (minus `system` lines).
- Admins see the full history including `system` lines.
- Resolved conversations stay listed and resumable.
- Transcripts are excluded from every data export (A-005e) unless a support export is specified later.

## 21. Pagination

| List | Style | Default / max | Why |
|---|---|---|---|
| Customer conversations | `page` / `pageSize` (existing `meta {page,pageSize,total}` convention) | 20 / 50 | Small per customer. |
| Admin conversations | `page` / `pageSize` + filters | 25 / 100 | Matches every other admin list. |
| Messages | **Cursor** on message `id`: `before=<id>` (older), `after=<id>` (gap-fill), `limit` | 30 / 100 | Stable under concurrent inserts; page numbers would shift as new messages arrive. |

- Thread opens at the newest 30 messages, scrolled to bottom (or to the first unread if any unread
  exist above the fold, with a "New messages" divider).
- Scrolling to the top loads 30 older messages, preserving scroll position (no jump).
- `meta.hasMore` tells the client whether older messages exist.

## 22. Search / filtering (Admin)

| Param | Behaviour |
|---|---|
| `status` | `open` \| `pending` \| `resolved` \| omitted (= all). The UI's default tab is **Open**. |
| `unread` | `true` → `adminUnreadCount > 0`. |
| `contextType` | one of `SupportContextType`. |
| `q` | Trimmed, 1–100 chars. Matches: exact conversation id (digits, optional `#`), exact order id / custom-request id / quote id, exact bank-transfer reference, or case-insensitive substring of customer `email`, `displayName`, `username`. Parameterized Prisma queries only. |
| Sort | `lastMessageAt desc` (fixed in v1). |

Message-body search is out of scope (§5). Filter/search state is kept in the URL query string so a
refresh or shared link reproduces the view.

## 23. Mobile behavior (customer web + admin web on phones)

- **< 768px:** single-pane. List → thread navigates to a full-screen thread with a back button; the
  site header collapses to the chat header on the thread screen.
- Thread uses `height: 100dvh` with a `visualViewport` resize listener so the sticky composer stays
  directly above the on-screen keyboard (iOS Safari & Android Chrome); messages area scrolls, page
  doesn't.
- Opening the keyboard keeps the newest message visible (scroll-to-bottom if the user was already at
  the bottom; otherwise show a "↓ New messages" pill instead of jumping).
- Composer grows to 5 lines max, then scrolls internally. Touch targets ≥ 44×44px. Enter = newline;
  Send button sends.
- Taebo's floating launcher is **hidden on `/account/support*`** so it never covers the composer or
  the Send button on small screens.
- `overscroll-behavior: contain` on the messages list to avoid pull-to-refresh/scroll chaining while
  reading history.
- Admin on mobile: list → thread; customer info + context open as a slide-over drawer from an "Info"
  button.

## 24. Desktop behavior

- **Customer ≥ 1024px:** two panes on `/account/support` — conversation list (320px) + thread; the
  thread pane is the route `/account/support/[id]` so it's linkable.
- **Admin ≥ 1280px:** three panes (list 360px · thread · customer/context 320px). 1024–1279px: two panes
  with the info panel as a toggle-able drawer.
- Keyboard: Enter sends, Shift+Enter newline, Esc closes drawers; `/` focuses Admin search.
- Unread conversations in lists are bold with a count pill; selecting one marks it read per §15.

## 25. Internationalization

Integrated into the existing A-021 system (`apps/web/i18n/messages/<code>.ts`, `useLocale()`), no new
translation mechanism:

- New key group **`supportChat.*`** in `en.ts` (source of truth) and all 14 other locale files
  (`es fr de pt it nl tr ar zh ja ko ru hi ur`). `pnpm --filter @czd/web typecheck` and `i18n:check`
  must pass (every locale has every key; placeholders/tags preserved).
- Also new keys: account-menu label, Taebo "Chat with a person" button, context labels
  (`supportChat.context.order` = "Order #{id}" etc.), notification type labels for `support_reply` in
  the notifications/preferences screens, and `apiErrors.CONVERSATION_ALREADY_OPEN`.
- Plurals via the existing `_one/_other` (+ Arabic/Russian forms) for "{count} unread".
- Timestamps and day separators via `formatDateTime`/`formatDate` (Intl); relative times via
  `Intl.RelativeTimeFormat` in the active locale.
- Message **content** is never translated — shown exactly as typed.
- Admin overrides via `ui_translations` work automatically (existing layer).
- Admin panel strings are English, as the rest of `apps/admin`.

## 26. RTL support (Arabic `ar`, Urdu `ur`)

- Layout uses logical properties only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`): the customer's own
  bubbles sit at the **end** side (left in RTL), Support bubbles at the **start** side (right in RTL).
- Back arrow and Send icon use the existing `DirectionalArrow` pattern so they mirror in RTL.
- Each message body and preview gets `dir="auto"` so an English message renders LTR inside an Arabic UI
  and an Urdu message renders RTL inside an English UI (common for this customer base).
- Numbers/ids inside RTL text (e.g. "Order #1234") are wrapped in `<bdi>` to avoid bidi reordering.
- Composer textarea `dir="auto"`.
- Verified in Arabic and Urdu with both short and long, mixed-direction messages (§33).

## 27. Accessibility

- Messages list is `role="log"` with `aria-live="polite"` and `aria-relevant="additions"`, so screen
  readers announce new incoming messages without re-reading history; own sent messages are not
  re-announced.
- Each bubble has an accessible name: "<Support|You>, <time>: <text>".
- Typing indicator is `aria-live="polite"` and throttled (announced at most once per 10s).
- Unread pills have text equivalents ("3 unread messages"), not colour alone; status pills include text.
- Composer has a visible label (visually-hidden "Message") and the Send button an accessible name.
- Focus management: opening a thread focuses the composer on desktop (not on mobile, to avoid
  auto-opening the keyboard); loading older messages never steals focus.
- Colour contrast ≥ 4.5:1 for text on both bubble colours in the brand palette.
- Respects `prefers-reduced-motion` (no animated scroll/typing dots).
- All actions reachable by keyboard; drawers trap focus and close on Esc.

## 28. Security

### 28.1 Customer isolation / IDOR

- Conversation id + `customerId = sub` in **one** query for every customer read/write; mismatch = 404
  (`RESOURCE_NOT_FOUND`), indistinguishable from non-existent. Message routes check the parent
  conversation the same way; `before`/`after` cursors are always scoped to the verified conversation.
- Context ids at creation verified against the caller's ownership in the same query.
- Socket `join` performs the same check; a socket only receives messages for rooms it was allowed into,
  plus its own `support:user:<id>` room (server-assigned, not client-chosen).

### 28.2 Admin authorization

- `JwtAuthGuard` + `RolesGuard(admin, freelancer, moderator)` + `AdminPermissionsGuard` with
  `support_chat` on every admin route; denials are audit-logged (existing guard behaviour).
- Socket staff connection requires the same permission; re-checked on `join`; revocation takes effect
  at the next join/reconnect and at most within the 15-minute token lifetime.

### 28.3 Data minimization

Customer DTOs never include admin identities, `system` messages, status actors or Admin read pointers.
Staff room payloads contain list-row data only.

### 28.4 Message validation

- `body`: string; Unicode NFC-normalized; C0/C1 control characters stripped except `\n` and `\t`;
  more than 2 consecutive blank lines collapsed; trimmed; 1–4,000 chars after normalization
  (`VALIDATION_ERROR` otherwise). Zero-width-only messages rejected.
- `clientMessageId`: UUID v4 (`@IsUUID('4')`). `contextId`/ids: numeric string (`parse-id.util`).
- Unknown fields rejected (`forbidNonWhitelisted`).
- Output: rendered as text, never `dangerouslySetInnerHTML`; links limited to `http`/`https`.

### 28.5 Rate limiting

| Route / event | Limit |
|---|---|
| `POST /api/support/conversations` | 10 / hour (existing `@RateLimit`) |
| `POST /api/support/conversations/:id/messages` | 30 / minute per IP (existing guard) **and** 30 / minute per user (Redis counter in the service — IP-only limits are weak behind shared NATs/mobile carriers) |
| Admin send | 60 / minute per user |
| Socket `typing` / `viewing` | server drops > 1/sec/socket |
| Socket connections | ≤ 10 concurrent sockets per user (extra connections refused) |

429 → `RATE_LIMITED` with a translated message.

### 28.6 Socket hardening

Namespace CORS = `CORS_ORIGINS` allowlist; `maxHttpBufferSize` lowered to 16KB for the namespace
(no payload legitimately exceeds it since writes are REST); payloads validated (ids numeric) before use;
handshake token never logged.

### 28.7 Attachments

None in v1, so no upload surface. Phase-2 controls are specified in §29.

### 28.8 Abuse & audit

Status changes audit-logged. A suspended customer (`status=suspended`) cannot send (403) but can still
read their history. (Blocking a customer from chat specifically is a future extension.)

## 29. File attachment architecture

**Decision: B — designed now, built in a later phase.** Reasons found during inspection:

- Storage is a single local-disk private root (`StorageService`, content-addressed) with signed,
  single-use download tokens — sound for paid deliverables, but adding a customer-writable upload path
  from chat raises the abuse surface (storage exhaustion, malware distribution to admins).
- The magic-byte table (`files/magic-bytes.ts`) only covers PES/DST; there are no image/PDF signatures
  and no malware scanning anywhere in the repo — attachment validation would be extension-only.
- Customers already have purpose-built upload paths for the main file use cases (custom-request
  references, receipt uploads, quote attachments).

**Phase-2 design (not built now):**

- `SupportMessageAttachment` (`id`, `messageId` → Cascade, `storagePath`, `uploadHash`, `fileName`
  (sanitized), `mimeType`, `sizeBytes`, `contentValidated`, `createdAt`).
- Allowed: JPG, PNG, WEBP, PDF; optionally the embroidery/vector formats already in
  `allowed_file_formats` (DST, PES, AI, SVG — SVG served only as a download, never inline).
- Max 10MB per file (matches existing custom-request upload limit), 3 files per message, 50MB per
  conversation.
- Upload via REST multipart (`memoryStorage`, `limits.fileSize`), magic-byte validation extended for
  image/PDF signatures, images re-encoded server-side to strip EXIF/metadata, filenames never used as
  paths.
- Download only via `StorageService` signed short-lived tokens, authorized as: customer owns the
  conversation, or staff with `support_chat`. `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff` for non-image types.
- Malware scanning (e.g. ClamAV) as a prerequisite before enabling non-image types.

## 30. Error handling

| Situation | Customer UI | Admin UI | Server |
|---|---|---|---|
| Send fails (network/5xx) | Bubble "Not sent · Retry"; retry reuses the same `clientMessageId` (idempotent) | Same | — |
| 400 validation | Inline under composer, text kept | Same | `VALIDATION_ERROR` |
| 429 | "You're sending messages too quickly — try again in a moment"; text kept | Same | `RATE_LIMITED` |
| 401 (token expired) | Existing silent refresh + retry once; else sign-in redirect with `next=` | Same | — |
| 403 (admin lacks permission) | — | Existing forbidden state | Audit `ACCESS_DENIED` |
| 404 conversation | "This conversation isn't available" + link to list | Same | `RESOURCE_NOT_FOUND` |
| 409 already open | Redirect to the existing active conversation with a toast | Toast + link | `CONVERSATION_ALREADY_OPEN` |
| Socket can't connect / drops | "Reconnecting…" banner; sending still works over REST; history refetched on reconnect | Same | — |
| Load history fails | `ErrorBanner` + Retry; existing messages stay | Same | — |
| Notification delivery fails | Invisible; message already saved | — | Logged, not thrown |
| Context deleted | Chip "(no longer available)" | Card `available=false` | SetNull |

Error text goes through the existing `ErrorBanner`/`errorMessage()`/`apiErrors.*` mapping so it is
localized.

## 31. Performance requirements

| Requirement | Target |
|---|---|
| Message send (REST, p95, server) | < 300ms excluding notification dispatch (dispatch runs after the response is committed, not awaited by the client path) |
| Live delivery to an open thread | < 1s end-to-end on a normal connection |
| Admin list query (25 rows, filters) | < 200ms p95 with indexes in §9.2; no per-row queries (counts and previews are denormalized) |
| Message page (30) | < 100ms p95 via `(conversation_id, id)` index |
| Broadcast scope | Only the conversation room, the one customer's user room and the staff room — never global |
| Socket footprint | Sockets only on chat pages (§11.10); badge counts via the existing 30s poll |
| Typing | Client emits at most once per 3s while typing, `isTyping:false` after 4s idle; never stored |
| Client rendering | Thread renders at most ~300 bubbles at once; older pages beyond that are released from the DOM (or the list is virtualized) |
| Payload size | Previews capped at 140 chars in list payloads |

## 32. Edge cases

| Case | Behaviour |
|---|---|
| Guest (never signed in) clicks "Chat with Support" | Sign-in prompt → `/login?next=/account/support/new…`; Taebo, Contact Us and WhatsApp remain available. |
| Guest-checkout customer (`isGuest`, cookie only) | Same; signing in with their email (existing claim flow) gives them a real session and their orders become valid contexts. |
| Double-click Send / flaky retry | Single row (unique `clientMessageId`). |
| Two tabs open | Both receive messages via `support:user:<id>`; reading in one updates the badge in both. |
| Customer writes in a resolved conversation while another active one exists for the same context | 409 → redirected to the active one. |
| Two admins reply at the same time | Both messages saved, ordered by `id`; each sees the other's reply live and typing indicators from "Support". |
| Admin changes status while customer is typing | Customer sees nothing (status hidden) unless `resolved` → banner appears live. |
| Customer suspended mid-conversation | Can read, can't send (403 with message). |
| Context order deleted / anonymized | Transcript kept, chip unavailable. |
| Customer account deleted | Conversations and messages cascade-deleted. |
| Admin account deleted | Their messages remain, sender shown as "Former team member" to admins. |
| Admin's `support_chat` revoked while on the page | Next REST call 403; socket dropped at next join/reconnect/token expiry. |
| Very long word / URL without spaces | `overflow-wrap: anywhere` so bubbles never overflow horizontally. |
| Emoji / combining characters | Length counted in UTF-16 code units consistently client & server; NFC normalization. |
| Clock skew on device | Ordering by server id; timestamps from server. |
| Message arrives for a thread scrolled up in history | "↓ New messages" pill; no forced scroll. |
| Language switch mid-conversation | UI strings switch; message content unchanged. |
| Offline for hours | On reconnect, gap-fill via `after=`; unread counts refreshed. |
| Staff user opens the customer site | Customer routes reject non-customer roles; entry points hidden for staff. |
| Admin replies to a conversation whose customer was never notified before | Normal notification (no unread one exists). |

## 33. Testing requirements

| Level | What it covers | Where |
|---|---|---|
| **Unit** | Status transition table (§16); body normalization/validation; read-pointer + counter maths; notification suppression rules (viewing / already-unread); context ownership resolution; customer DTO never contains admin identity/system rows; search `q` parsing (id vs text). | `apps/api/src/support-chat/*.spec.ts` |
| **Integration** (real Postgres + Redis on a **throwaway DB** and non-default ports — never `czdigitizing`) | Start → idempotent reuse; concurrent start race → one row; send idempotency; customer A → B's conversation/messages/read → 404; customer → admin routes → 403; freelancer without/with read_only/crud; partial unique index + CHECK constraints; reopen rules incl. 409; notifications created once per unread burst; reading marks related notifications read; context SetNull; cascade on customer delete; rate limits → 429. | `apps/api/test/integration/support-chat.spec.ts` |
| **Socket integration** | Handshake rejects missing/invalid/expired token; customer can't `join` a foreign conversation (ack `RESOURCE_NOT_FOUND`, no events received); staff without permission disconnected; `message`/`read`/`typing`/`conversation-updated` reach only intended rooms; disconnect at token `exp`; reconnect + `after=` gap-fill; no duplicate render when REST response and socket event both arrive. | `apps/api/test/integration/support-chat.gateway.spec.ts` (socket.io-client is already a workspace dependency) |
| **E2E** (Playwright, existing `e2e/` setup) | Customer starts general chat → admin sees it in Open with unread → admin replies → customer sees it live and "Seen" flows both ways; start from an order card → admin sees the order card; admin resolves → customer reply reopens; notification when customer is away, none when viewing; mobile viewport (iPhone/Pixel profiles) keyboard/composer/scroll; Arabic and Urdu RTL layout; English. | `e2e/support-chat.e2e.spec.ts` |
| **Static** | `pnpm --filter @czd/web typecheck` + `i18n:check` (all 15 locales), API/admin typecheck, lint. | CI |
| **Regression** | Taebo widget/escalation unchanged; custom-request chat unchanged; notification bell/preferences unchanged except the new type. | existing specs |

## 34. Acceptance criteria

### Customer

| # | Criterion |
|---|---|
| AC-1 | **Given** a signed-in customer **When** they open "Chat with Support" from the account menu, Taebo panel or Contact Us and send a first message **Then** a conversation is created with status `open`, the message is shown as Sent, and it appears in the Admin Live Chat list with an unread count of 1. |
| AC-2 | **Given** a customer on their order card **When** they choose "Ask about this order" and send a message **Then** the conversation is linked to that order, the customer sees an "Order #…" chip, and starting again from the same order reuses the same active conversation instead of creating a second one. |
| AC-3 | **Given** an open thread on the customer's screen **When** an admin replies **Then** the reply appears within ~1s without a refresh, and no notification is created for the customer. |
| AC-4 | **Given** a customer who is not viewing the conversation **When** an admin replies (once or several times) **Then** exactly one `support_reply` notification is created (in-app + email/push per preferences) until the customer reads it, and clicking it opens that conversation. |
| AC-5 | **Given** a customer with past conversations **When** they open `/account/support` **Then** they see all and only their own conversations, newest activity first, with unread counts, and can open and continue any of them; older messages load on scroll without losing position. |
| AC-6 | **Given** unread admin replies **When** the customer views the thread with the tab visible **Then** the unread count and account-menu badge drop to 0 in every open tab, the related notification is marked read, and the admin sees "Seen". |
| AC-7 | **Given** a dropped connection **When** the socket reconnects **Then** any messages sent meanwhile appear exactly once in correct order, and sending while disconnected still succeeds via REST. |
| AC-8 | **Given** a resolved conversation **When** the customer sends a message **Then** it reopens as `open` (or, if another active conversation for the same context exists, the customer is taken to that one). |

### Admin

| # | Criterion |
|---|---|
| AC-9 | **Given** an admin with `support_chat` access **When** they open Customer Support → Live Chat **Then** they see all conversations with customer, context, last message, timestamp, unread count and status, defaulting to the Open tab, with a sidebar unread badge. |
| AC-10 | **Given** the conversation list **When** the admin searches by customer email/name, conversation id, order id or bank reference, or filters by status/unread/context **Then** only matching conversations are returned, and the filters persist in the URL. |
| AC-11 | **Given** an open conversation **When** the admin views it **Then** they see the full paged history (including system status lines), the customer info panel (§18) and the context card (§19); the conversation becomes read for the team. |
| AC-12 | **Given** an admin with `crud` **When** they reply **Then** the customer receives it in real time (or a single notification if away), and replying to a resolved conversation reopens it as `pending`. |
| AC-13 | **Given** an admin with `crud` **When** they change status **Then** the status updates live for all admins, a system line and an audit-log row are written, and the customer sees a "resolved" banner only for `resolved`. |
| AC-14 | **Given** a customer message while no admin is viewing that conversation **When** it is saved **Then** every permitted staff user gets at most one unread `support_message` notification for that conversation. |

### Security

| # | Criterion |
|---|---|
| AC-15 | **Given** customer A **When** they request customer B's conversation, messages, read endpoint, or socket `join` by id **Then** they receive 404 / `RESOURCE_NOT_FOUND` and no data or events, indistinguishable from a non-existent id. |
| AC-16 | **Given** a customer token **When** calling any `/api/admin/support/*` route or joining staff rooms **Then** access is refused (403 / disconnected). |
| AC-17 | **Given** a freelancer/moderator **When** they lack `support_chat` **Then** admin routes return 403 (audit-logged) and the socket is refused; with `read_only` they can read but not reply or change status. |
| AC-18 | **Given** an unauthenticated or expired-token socket **When** it connects or its token expires **Then** it is rejected/disconnected, and a valid client reconnects with a refreshed token automatically. |
| AC-19 | **Given** a customer creating a conversation **When** the context id is not theirs **Then** 404, and no conversation is created. |
| AC-20 | **Given** message input containing HTML/script, control characters or > 4,000 chars **When** sent **Then** HTML is shown as literal text, control characters are stripped, and over-length is rejected with `VALIDATION_ERROR`; bursts above the rate limits return `RATE_LIMITED`. |

### Mobile

| # | Criterion |
|---|---|
| AC-21 | **Given** a 360–430px wide phone **When** using list and thread **Then** there is no horizontal scroll, the composer stays above the on-screen keyboard, the newest message stays visible while typing, history scrolls independently, and Taebo's launcher does not cover the composer. |

### i18n / RTL

| # | Criterion |
|---|---|
| AC-22 | **Given** English, Urdu or Arabic (and every other of the 15 locales) **When** using the chat **Then** all UI strings are translated (typecheck + `i18n:check` pass), dates/times are locale-formatted, and message content is shown untranslated. |
| AC-23 | **Given** Arabic or Urdu **When** viewing a thread **Then** the layout mirrors (the customer's own messages on the end side — left in RTL — and directional icons mirrored), and mixed-direction messages render correctly via `dir="auto"`/`<bdi>`. |

### Performance

| # | Criterion |
|---|---|
| AC-24 | **Given** long histories **When** loading **Then** messages load 30 per page by cursor, conversation lists are paged, and list queries do not issue per-row queries. |
| AC-25 | **Given** any chat event **When** emitted **Then** it reaches only the relevant conversation room, the owning customer's room and/or the staff room — never all sockets — and pages outside the chat open no socket. |

### Coexistence

| # | Criterion |
|---|---|
| AC-26 | **Given** the Taebo widget **When** this feature ships **Then** Taebo's answering, escalation ("Waiting for Admin"), notifications and admin page behave exactly as before, Taebo is labelled as the AI assistant, and "Chat with a person" in its panel opens the human support chat. |

## 35. Dependencies

| Aspect | Status | Why |
|---|---|---|
| A-002 Authentication & Account Security | Completed | JWT, roles, `TokenService` for socket handshake. |
| A-004 Notifications System | Completed | `notify()`, preferences, bell polling, `notification-link.ts`. |
| A-005f Admin Users/Roles & Active Sessions | Completed | `AdminModule` permission scoping for freelancer/moderator. |
| A-013c Order History / Payment State Machine | Completed | `orders` as a conversation context. (Depends on the sub-aspect that owns the `Order` record, not on the A-013 parent, which is `In Progress` only for its unrelated AC-8.) |
| A-016 Smart Get a Quote | Completed | `quotes` as a context. |
| A-017 Custom Design Request System | Completed | `custom_requests` as a context; existing Socket.IO gateway pattern. |
| A-017a File Format Requests | Completed | `file_format_requests` as a context. |
| A-019 Customer Account & Purchase History | Completed | `/account/*` area, account menu, Admin customer page link. |
| A-020 Taebo Helping Panda | Completed | Coexistence + hand-off button in the Taebo panel. |
| A-021 Internationalization | Completed | Locale files, RTL, `useLocale()`. |

**Parent Aspect:** A-004 — SRS §10 groups this under "Notifications + Support"; SRS §9 is the source
of "human support remains available".

No new npm packages. Existing: `socket.io`, `@nestjs/websockets`, `@nestjs/platform-socket.io`,
`socket.io-client` (web, admin).

## 36. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Single-instance socket state.** In-memory rooms/viewing flags only work with one API instance (current Render deploy is one free instance). Scaling out would silently split rooms. | Documented; scaling requires adding `@socket.io/redis-adapter` (Redis already provisioned) and sticky sessions — a separate change. |
| 2 | **Free-tier sleep/cold starts** on Render drop sockets and delay the first REST call. | REST-first writes + reconnect gap-fill; "Reconnecting…" banner. |
| 3 | **Notification noise** for admins if many staff hold `support_chat`. | One unread notification per conversation per recipient; future per-admin assignment. |
| 4 | **Team-level read state** — one admin reading hides "unread" from the others. | Explicit v1 limitation; status `open` still marks needing attention. |
| 5 | **Aspect File gap.** The SRS mentions human support but not a live-chat feature explicitly; this aspect is registered on the Primary Admin's explicit request (2026-10-06). | Flagged in SPEC_INDEX Change Log; Aspect File should be updated to name it. |
| 6 | **Confusion between custom-request production chat and support chat** for custom-request contexts. | Distinct labels; Appendix B decision 4. |
| 7 | **Retention/privacy** of transcripts (personal details volunteered by customers). | Excluded from exports; retention period is an open question shared with Taebo (master spec §8). |
| 8 | **Header width** — adding a header icon would re-trigger the 2026-09-12 overflow. | Entry via account menu instead (§8.1). |
| 9 | **Uncommitted-work hazard:** `apps/admin/components/AdminAuthLayout.tsx` has an intentionally uncommitted edit in the working tree. | Implementation must not commit or overwrite it. |

## 37. Future extensibility

- **Attachments** (§29 Phase 2).
- **Mobile app screens** (A-023): same REST + `/support-chat` namespace; push already delivered.
- **Assignment & per-admin read state:** `assignedAdminId` on the conversation + a
  `support_conversation_reads(conversation_id, admin_id, last_read_message_id)` table replaces the
  team-level pointer without changing the customer side.
- **Internal notes:** a new `SupportSenderType` value `internal_note` (admin-only, like `system`).
- **Canned replies / save reply as FAQ** (mirrors Taebo's Save-as-FAQ).
- **Taebo hand-off with transcript:** attach the Taebo conversation id as an additional context so the
  admin can read what the customer already asked the AI.
- **Admin-initiated conversations** (e.g. "Message this customer" from an order).
- **Message-body search** (`pg_trgm` GIN index).
- **Business hours / expected reply time** setting under Admin Settings, shown in the chat subtitle.
- **Auto-resolve** pending conversations after N days of customer silence.
- **Horizontal scale:** Redis adapter (§36 #1).
- **CSAT rating** on resolve.

## 38. Implementation notes (2026-10-06)

None of these change a requirement, an acceptance criterion or the architecture; they record how the
spec was realized where it left a detail open.

| # | Note |
|---|---|
| 1 | **Rooms (§11.4/§11.5).** Customers receive `message` events only through their own `support:user:<id>` room (server-assigned), never through the shared conversation room; staff receive full `AdminSupportMessageDto` payloads through a staff-only twin room `support:conversation:<id>:staff`. The shared `support:conversation:<id>` room carries only audience-neutral payloads (`typing`, `read`). Same audiences and data minimization as §11.5, with separate rooms instead of per-socket filtering. |
| 2 | **Socket CORS (§11.2/§28.6).** Socket.IO CORS is configured per *server*, and the server is shared with the existing `/custom-requests` gateway. The `/support-chat` handshake therefore checks the `Origin` header against `CORS_ORIGINS` itself, and the web/admin clients use the WebSocket transport only (no cross-origin long-polling). `maxHttpBufferSize` is likewise server-wide, so it wasn't lowered; every socket payload is validated (numeric ids, booleans) before use instead. |
| 3 | **Token expiry (§11.3).** The server emits `auth-expired` and disconnects at the token's `exp`. The clients reconnect with backoff, and socket.io's `auth` callback fetches a token that is valid for at least 30 seconds (`getFreshAccessToken()` in both apps' `api-client.ts`). |
| 4 | **Notifications (§17).** Dispatch runs after the transaction commits and is never awaited by the request. Work for one conversation is serialized, so two quick messages can't both pass the "no unread notification yet" check. Email retries with the existing exponential backoff when SMTP is unavailable. |
| 5 | **Taebo label (§8.3/AC-26).** `taebo.subtitle` now reads "Your CZ Digitizing AI Assistant" in all 15 locales. No other Taebo behavior changed. |
| 6 | **Admin on phones (§23).** The Live Chat page is single-pane below `lg`, and the customer panel becomes a drawer below `xl`. The admin panel shell itself, with its fixed 216px sidebar from before this aspect, isn't responsive, so using the admin at phone width is still limited by that shell. Flagged rather than redesigning the shell here. |
| 7 | **Translations (§25).** All 14 non-English locales were written for this aspect. `i18n:check` and typecheck verify they are complete and well-formed, not their fluency. Native-speaker review is recommended (Urdu and Arabic first). |
| 8 | **E2E (§33).** The repo's `e2e/` specs are API-level Jest suites, and the repo has no browser-test runner. Coverage is therefore (a) `apps/api/test/integration/support-chat.spec.ts` with 22 REST and Socket.IO tests against a throwaway DB, and (b) a scripted live Playwright pass of 31 checks against an isolated stack. Pass (b) covered customer ↔ admin realtime, the status flow, notifications, isolation, the Taebo hand-off, iPhone 13 and Pixel 7 layouts, and Arabic and Urdu RTL. Its script isn't committed because there's no runner to execute it in CI. |
| 9 | **Custom-request page (§19.3).** "Chat with Support about this request" sits at the top of the expanded request. The existing production-thread heading ("Messages") is unchanged. |

---

## Appendix A — Existing architecture discovered (inspection, 2026-10-06)

| Area | Finding |
|---|---|
| Monorepo | pnpm + turbo: `apps/api` (NestJS 10, Prisma 5, Postgres, Redis), `apps/web` (Next.js customer site), `apps/admin` (Next.js admin), `apps/mobile` (Expo), `packages/shared-types`, `packages/config`. |
| Realtime | Socket.IO already installed and in use: `apps/api/src/custom-requests/custom-requests.gateway.ts`, namespace `/custom-requests`, JWT in handshake `auth.token`, rooms `custom-request:<id>`, events `join`/`typing`/`message`; clients in `apps/web/app/account/custom-requests/page.tsx`, `apps/admin/app/custom-requests/page.tsx`, mobile `CustomRequestDetailScreen`. No Redis adapter; `cors: { origin: true }`; no acks; token expiry not enforced after connect. |
| Auth | 15-min access JWT (`sub`, `role`, `permissions`) + 7-day refresh; roles `customer/admin/freelancer/moderator`; `JwtAuthGuard`, `RolesGuard`, `AdminPermissionsGuard` + `@RequiresPermission(module, level)`; `AdminModule` enum; per-IP `@RateLimit`. Web stores tokens in localStorage with silent refresh (`auth-context.tsx`, `api-client.ts`). |
| Guests | Guest checkout uses an httpOnly `czd_guest_orders` cookie whose hash must match `orders.guestAccessKeyHash`; guests have no JWT. |
| Notifications | `NotificationService.notify()` with `DEFAULT_CHANNELS`, `ADMIN_ONLY_TYPES`, `ADMIN_NOTIFICATION_CHANNELS`, per-user preferences, email/WhatsApp/push/SMS dispatch; `related*Id` FKs for click-through; bells in both apps poll every 30s (`NotificationBell.tsx`, `unread-count-bus.ts`). |
| Taebo | `apps/api/src/taebo`, `TaeboConversation`/`TaeboMessage`/`TaeboWaitingQuestion`; floating draggable widget `TaeboWidget.tsx` with Contact/WhatsApp links; admin `/taebo/unanswered`. |
| Orders / requests | `Order` (bank transfer only), `CustomRequest` (+ its own `CustomRequestMessage` thread), `Quote` (+ `QuoteMessage`), `FileFormatRequest`, `ContactMessage`. |
| Files | `StorageService`: private local-disk, content-addressed, HMAC signed single-use download tokens; `magic-bytes.ts` covers PES/DST only; multer `memoryStorage` with 10MB limits on custom-request uploads. |
| i18n | 15 locales in `apps/web/i18n/config.ts` (ar, ur = RTL); typed message files; `useLocale()`; `ui_translations` admin overrides; admin panel not localized. |
| Admin | `Sidebar.tsx` with a `Support` section (Taebo — Waiting for Admin, Contact Messages); customers page `/customers/[id]` backed by `api/admin/customers`. |
| Customer account | `/account/*` pages incl. orders, custom-requests, quotes, notifications; `AccountMenu.tsx`. Header width constrained (2026-09-12 incident). |
| Docs | Specs in `docs/specs/YYYY-MM-DD-NN-slug.md`, registry `docs/specs/SPEC_INDEX.md` (rules in `docs/CLAUDE.md`), flow view `docs/specs/USER_FLOW.md`, feature log `docs/features/`. |

## Appendix B — Decisions requiring approval

| # | Decision | Recommendation in this spec |
|---|---|---|
| 1 | Attachments in v1? | **No** — Phase 2 (§29). |
| 2 | Writes over REST vs. socket | **REST writes, socket push** (§11.1). |
| 3 | Guests | **Signed-in customers only** (§32). |
| 4 | Custom-request context vs. existing production thread | **Keep both, label distinctly** (§19.3). |
| 5 | Customer sees admin names? | **No** — "CZ Digitizing Support" (§18.3). |
| 6 | Presence indicator | **Not in v1** (§11.9). |
| 7 | Customer entry point in header | **No new header icon**; account menu + Taebo + Contact + order/request rows (§8.1). |
| 8 | Statuses | **`open` / `pending` / `resolved`** with auto-reopen (§16). |
| 9 | Admin read state | **Team-level** in v1 (§15). |
| 10 | Mobile app (`apps/mobile`) | **Out of v1**; API ready for it (§5). |
