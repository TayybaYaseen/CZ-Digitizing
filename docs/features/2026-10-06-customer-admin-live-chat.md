# Customer ↔ Admin Live Chat (A-025)

> **SPECIFICATION:** CREATED (2026-10-06)
> **APPROVAL:** APPROVED by the Primary Admin (2026-10-06), before any code was written
> **IMPLEMENTATION:** COMPLETED (2026-10-06)

## Trigger

The Primary Admin's request on 2026-10-06: *"I want to add a complete Customer ↔ Admin live chat system
to the existing CZ Digitizing website"*. The workflow was spec-first and approval-gated (inspect →
specify → register → stop for approval → implement → test). The human support chat had to stay
separate from Taebo, the AI assistant. The spec was registered first and the Admin replied "start
implementation".

## Spec used

[`docs/specs/2026-10-06-21-customer-admin-live-chat.md`](../specs/2026-10-06-21-customer-admin-live-chat.md),
aspect **A-025** (AC-1–AC-26), registered in [`SPEC_INDEX.md`](../specs/SPEC_INDEX.md) at Order 53. Spec
§38 lists the non-material implementation notes.

## Files changed

### API (`apps/api`)

| File | Change |
|---|---|
| `prisma/schema.prisma` | New `SupportConversation` and `SupportMessage` models and three enums. Adds `AdminModule.support_chat`, the `NotificationType` values `support_reply`/`support_message`, and `Notification.relatedSupportConversationId`. Back-relations on User, Order, Quote, CustomRequest and FileFormatRequest. |
| `prisma/migrations/20261006120000_add_support_live_chat/migration.sql` | Generated DDL plus hand-written constraints: the context CHECK, the "one active conversation per customer per context" partial unique index, the admin-unread partial index, non-negative counters and the body-length CHECK. |
| `src/support-chat/support-chat.module.ts` | New module, registered in `src/app.module.ts`. |
| `src/support-chat/support-chat.service.ts` | All reads and writes. Ownership is checked in the same query (404 for "not yours"), starts are idempotent, sends are idempotent on `clientMessageId`, and the status machine auto-reopens. Covers read pointers and counters, search and filters, customer info, context cards and audit logging. |
| `src/support-chat/support-chat.controller.ts` / `support-chat-admin.controller.ts` | Customer `/api/support/*` routes (`role=customer`) and admin `/api/admin/support/*` routes (`support_chat` `read_only`/`crud`), with per-IP rate limits. |
| `src/support-chat/support-chat.gateway.ts` | `/support-chat` namespace on the existing Socket.IO server. JWT and origin checks at handshake, disconnect at token expiry, join/leave/typing/viewing with acks and throttling. |
| `src/support-chat/support-chat-events.service.ts` | Every server → client push, per audience. |
| `src/support-chat/support-chat-notifier.service.ts` | `support_reply`/`support_message` through `NotificationService`. Skips recipients who are viewing the conversation, sends at most one unread notification per conversation, and serializes work per conversation. |
| `src/support-chat/support-presence.service.ts` / `support-staff-access.service.ts` | In-memory joined/viewing tracking. The `support_chat` permission rule for the socket and the notifier. |
| `src/support-chat/support-message.util.ts`, `support-chat.constants.ts`, `dto/*` | Body normalization and preview, limits and room names, class-validator DTOs, and the mapper that keeps admin data out of customer DTOs. |
| `src/support-chat/*.spec.ts`, `dto/*.spec.ts` | Unit tests: normalization, data minimization, notification de-duplication. |
| `test/integration/support-chat.spec.ts` | 22 REST and Socket.IO integration tests. Refuses to run against a non-test DB. |
| `src/notifications/notifications.constants.ts`, `services/notification.service.ts`, `dto/notification.mapper.ts` | The new types' channels, `relatedSupportConversationId` in `notify()` and in the DTO. |

### Shared types (`packages/shared-types`)

| File | Change |
|---|---|
| `src/support-chat.ts` (new), `src/index.ts` | REST DTOs, socket payloads, constants. |
| `src/notifications.ts`, `src/api.ts` | The new notification types and `relatedSupportConversationId`; the `CONVERSATION_ALREADY_OPEN` error code. |

### Customer site (`apps/web`)

| File | Change |
|---|---|
| `app/account/support/page.tsx`, `new/page.tsx`, `[id]/page.tsx` | Conversation list, new conversation (optional `?context=&id=`), thread. |
| `components/support-chat/*` | Shell (sign-in gate, list, socket), thread (cursor paging, live merge, read receipts, typing, retry, gap-fill on reconnect, full screen on phones), composer, bubble, list, new-conversation pane, visual-viewport hook. |
| `lib/support-chat.ts` | Socket hook, unread-badge hook and event bus, context labels, linkify, UUIDs. |
| `lib/api-client.ts` | `getFreshAccessToken()` for the socket `auth` callback. |
| `components/AccountMenu.tsx` | "Chat with Support" item with an unread count, and an unread dot on the avatar. |
| `components/TaeboWidget.tsx` | "Chat with a person" hand-off button. Hidden on `/account/support*`. |
| `components/OrderCard.tsx`, `app/account/custom-requests/page.tsx`, `app/account/quotes/page.tsx` | "Ask about this order / request / quote" entry points. |
| `app/account/page.tsx`, `app/contact/page.tsx` | Chat links. |
| `lib/notification-link.ts` | `support_reply` opens its conversation. |
| `i18n/messages/*.ts` (all 15), `i18n/api-errors.ts` | `supportChat.*` strings, notification type labels, `apiErrors.conversationAlreadyOpen`, and Taebo's subtitle now says "AI Assistant". |

### Admin (`apps/admin`)

| File | Change |
|---|---|
| `app/support/live-chat/page.tsx`, `[id]/page.tsx` | Customer Support → Live Chat. |
| `components/support-chat/LiveChatInbox.tsx`, `AdminSupportThread.tsx`, `CustomerInfoPanel.tsx` | Inbox (URL-persisted search and filters, live list), thread (system lines, Seen, typing, status control, read-only mode), customer and context panel (a drawer below `xl`). |
| `lib/support-chat.ts`, `lib/api-client.ts` | Socket hook, sidebar badge hook (polls only with access, so no `ACCESS_DENIED` audit spam), access check from the JWT claims, fresh-token helper. |
| `components/Sidebar.tsx` | The "Support" section is renamed "Customer Support"; new "Live Chat" item with an unread badge. |
| `app/settings/freelancer-accounts/page.tsx` | `support_chat` is now grantable to freelancers and moderators. |
| `lib/notification-link.ts` | `support_message` opens its conversation. |

### Docs

`docs/specs/2026-10-06-21-customer-admin-live-chat.md` (new), `docs/specs/SPEC_INDEX.md`,
`docs/specs/USER_FLOW.md`, `docs/features/README.md`, this file.

## Verification

- **API:** `tsc --noEmit` and ESLint clean. The full unit suite passed (513/513, 70 suites, including the new
  support-chat specs). `test/integration/support-chat.spec.ts` passed 22/22 against a throwaway database
  (`czd_livechat_test`), created, migrated and dropped for the run. The dev DB `czdigitizing` was only
  migrated forward with `prisma migrate deploy`; nothing was truncated.
- **Web, admin and mobile:** `tsc --noEmit` clean. `next lint` is clean for the changed areas (only
  pre-existing `<img>` warnings in `TaeboPanda.tsx`). `pnpm --filter @czd/web i18n:check`: "All 15 locales are
  consistent with en.ts."
- **Live UI:** a scripted Playwright pass passed 31/31 against an isolated stack: API on :4100 with Redis db 5 and
  a throwaway DB, web on :3100, admin on :3102. It checked:
  - Starting a chat from an order card.
  - The admin inbox row and its unread count.
  - The thread with customer info and the order card.
  - "Support is typing…" and the live reply (about 100–140 ms).
  - "Seen" on both sides.
  - Resolving live, and a customer reply reopening the conversation.
  - Exactly one notification for two replies sent while the customer was away.
  - The account-menu badge, and reading clearing both unread and the notification.
  - Another customer seeing "not available".
  - The signed-out sign-in prompt.
  - The Taebo hand-off, and Taebo hidden on the chat pages.
  - iPhone 13 and Pixel 7: no horizontal scroll, composer in view, Send ≥ 44px.
  - Arabic and Urdu RTL alignment.
  - No uncaught page errors.

  The screenshots were reviewed by eye. One bidi bug (Latin timestamps reading "PM 7:56" in RTL) was
  found and fixed with `<bdi>`.
- **Not verified / open:**
  - The 14 translations are complete but have not had native-speaker review.
  - The admin shell (from before this aspect) isn't responsive at phone width.
  - Typing with a real phone's on-screen keyboard wasn't tested. The `visualViewport` handling was checked
    only in emulation.
  - Horizontal scaling still needs the Socket.IO Redis adapter (spec §36 #1).
