# Spec: Notifications System (Admin + Customer)

**File:** `docs/specs/2026-08-28-02-notifications-system.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), SRS §25–26 / Addendum §10, architecture §Notifications System

---

## 1. Problem statement

**Today:** There is no unified notification mechanism. Every other feature spec in this set (Orders,
Quotes, Custom Requests, Taebo, Auth) depends on this system to inform the right party at the right
moment, across email, WhatsApp, in-app, and push channels — none of which currently exist.

**Who is affected:** Admin, who needs to run the business without constantly checking every module
manually; customers, who need confirmation and status updates without asking.

**Why it matters now:** This is a cross-cutting dependency — nearly every acceptance criterion in
every other spec in this set references "Admin is notified" or "customer is notified." Building it
once, correctly, avoids each feature reinventing delivery/retry/read-state logic.

**Success looks like:** Every defined trigger (new quote, new order, payment needing attention, new
registration, unanswered Taebo question, contact message, subscription/credit events, file/system
errors) reliably reaches Admin; every customer-facing trigger reliably reaches the customer; both
sides get a notification center with unread counts and read/unread state; routine FAQ clicks never
notify anyone.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** any trigger event listed in architecture §Notifications System (Admin or customer side) **When** it fires **Then** a `notifications` row is created for the correct `recipient_user_id` with the correct `notification_type`, and delivered to the configured channel(s) for that type |
| AC-2 | **Given** the Admin Dashboard **When** loaded **Then** it shows an unread-count badge and a chronological list with timestamp and read/unread state, matching architecture's Admin trigger list exactly (new quote, new order, payment needing attention, new registration, unanswered Taebo, contact message, subscription/credit purchase, relevant cart/order events, file/system errors) |
| AC-3 | **Given** a customer's in-app notification center **When** loaded **Then** it shows the matching customer trigger list (order confirmation, payment confirmation, files ready, quote confirmation/response, custom-request status, file-format availability, subscription/credit confirmation, order updates) with 30-day retention |
| AC-4 | **Given** a routine FAQ-answer click inside the Get a Quote flow **When** it occurs **Then** it never creates an Admin notification (this is a negative requirement shared with the Smart Get a Quote spec's AC-2) |
| AC-5 | **Given** an email notification **When** sent **Then** it uses an HTML branded template, includes an unsubscribe link where applicable, and retries with exponential backoff on transient failure, targeting 99.9% delivery |
| AC-6 | **Given** a WhatsApp-eligible notification (order confirmation, payment, file ready) **When** the customer's last message was more than 24–48 hours ago **Then** the system falls back to email/in-app rather than silently failing to deliver via WhatsApp |
| AC-7 | **Given** a mobile app user with push notifications enabled **When** a relevant event fires **Then** an FCM/APNs push is sent with deep linking to the relevant in-app screen; **given** the user has opted out **then** no push is sent but the in-app notification is still created |
| AC-8 | **Given** Admin marks a notification read, or deletes it **When** saved **Then** the unread count updates immediately and the action does not affect the underlying business record (e.g. marking a "new order" notification read does not change the order) |
| AC-9 | **Given** a customer's notification preference center **When** they toggle a specific notification type (e.g. "Subscription renewal" or "Marketing offers") per channel (email/WhatsApp/push/in-app) **Then** only their selected types/channels are delivered for future events, independent of the platform-wide channel routing table |
| AC-10 | **Given** an SMS-eligible notification (e.g. order confirmation) and a customer without WhatsApp/email reachable **When** the event fires **Then** an SMS is sent via the configured SMS provider as an additional channel alongside Email, WhatsApp, In-app, and Push |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.
This spec exposes the notification **center** APIs; the *creation* of notifications happens as a
side-effect inside each triggering feature's own service code via a shared internal
`NotificationService`, not via a public "create notification" endpoint.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/admin/notifications` | `role=admin` | `200` `PagedResponse<NotificationDto>` | |
| `GET` | `/api/admin/notifications/unread-count` | `role=admin` | `200` `{ count }` | |
| `PUT` | `/api/admin/notifications/:id/read` | `role=admin` | `200` | |
| `DELETE` | `/api/admin/notifications/:id` | `role=admin` | `204` | |
| `GET` | `/api/notifications` *(new, proposed)* | Authenticated customer | `200` `PagedResponse<NotificationDto>` | architecture only lists Admin notification routes; customer-facing equivalents are required by AC-3 but missing from the endpoint inventory |
| `GET` | `/api/notifications/unread-count` *(new, proposed)* | Authenticated customer | `200` `{ count }` | |
| `PUT` | `/api/notifications/:id/read` *(new, proposed)* | Authenticated customer, own notification only | `200` | |

### Internal contract (not a public route, but part of this spec)

```ts
interface NotificationService {
  notify(input: {
    recipientUserId: string;
    type: NotificationType;           // matches notifications.notification_type enum
    title: string;
    message: string;
    relatedOrderId?: string;
    relatedQuoteId?: string;
    relatedCustomRequestId?: string;
    channels: ('email' | 'whatsapp' | 'in_app' | 'push')[];
  }): Promise<void>;
}
```

Every other feature spec's "customer/Admin is notified" acceptance criteria are satisfied by a call
into this service — no feature should implement its own ad-hoc email/WhatsApp sending.

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `notifications` | existing | per architecture DDL; `notification_type` enum must be extended as new trigger types are identified across feature specs (e.g. `custom_request_status`, `taebo_waiting`, `subscription_renewal_failed`) — track additions here centrally rather than per-feature |
| `notification_delivery_log` *(new, proposed)* | proposed | `id`, `notification_id`, `channel`, `status` enum(`queued`,`sent`,`failed`,`retried`), `provider_message_id`, `attempted_at` — needed to support AC-5's retry/backoff and to debug delivery failures; not modeled today |

### Migration

- **Name:** `AddNotificationDeliveryLog`
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** `notifications` DDL is already reviewed in the master spec's `InitialSchema`;
  `notification_delivery_log` to be authored alongside implementation

### Retention and privacy

`notifications` has an explicit `expires_at`/30-day retention rule already in the architecture.
Delivery logs containing email/WhatsApp provider message IDs should follow the same retention
window unless needed longer for dispute resolution — tracked in master spec §8.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | notification list skeleton; badge count shows last-known value until refreshed |
| **Empty** | "You're all caught up" / "No notifications yet" |
| **Error** | failed fetch shows retry with `traceId`; does not clear already-loaded notifications |
| **Success** | list with unread visually distinct, mark-as-read on open, delete action (Admin only) |

**Route(s):** `/account/notifications`, `/admin/notifications`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | trigger-to-channel mapping table matches architecture's spec exactly; WhatsApp 24–48hr window fallback logic; FAQ-click never triggers notify (AC-4) | `apps/api/notifications/*.spec.ts` |
| **Integration** | end-to-end notify() call from a real trigger (e.g. order created) results in a `notifications` row + delivery attempt; read/unread/delete actions | `apps/api/test/integration/notifications.spec.ts` |
| **E2E** | place an order → see Admin dashboard badge increment → admin marks read → badge decrements; customer sees order-confirmation in-app notification | `e2e/notifications.e2e.spec.ts` |
| **Provider contract** | SendGrid/SES/Twilio integration against real provider sandboxes | `ops/contract-tests/notifications-providers` |

**Traceability:** AC-1…AC-10 → `notifications.integration.spec.ts` / `notifications.e2e.spec.ts`.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — provider-specific contract testing is covered by the
Provider contract row above.

---

## 7. Out of scope

None — every item previously listed here (granular notification preference center, SMS
notifications) has been folded into AC-9/AC-10 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Customer-facing `/api/notifications*` routes are required by AC-3 but absent from the architecture's endpoint inventory (Admin-only routes are listed) | Engineering | Open |
| 2 | Full `notification_type` enum coverage across all feature specs' new trigger types needs to be consolidated into one authoritative list before implementation | Engineering | Open |
| 3 | Order-status-change batching ("5 min batch" / "daily summary email" per architecture) needs a concrete scheduler mechanism selected | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — every other feature depends on this shipping first or alongside them.
- **Migration order:** `notifications` ships in `InitialSchema`; `notification_delivery_log` ships
  before any feature that requires delivery-failure alerting goes live.
- **Rollback:** standard image rollback; in-flight queued notifications should drain rather than be
  dropped on deploy (graceful shutdown of the notification worker).
- **Observability:** this feature *is* the observability layer for the rest of the business, but it
  also needs its own: alert on delivery-failure rate per channel exceeding a threshold, and on
  queue depth growing unbounded (worker falling behind).
