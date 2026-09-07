# Incident: Bank transfer account details not showing on checkout page

**Date diagnosed:** 2026-09-07
**Reported by:** Admin (Muhammad Suleman Yaseen / Tayyba Yaseen), via the Claude Code session
**Severity:** High — blocks the entire Bank Transfer payment path (A-013b); a customer at
`/checkout/bank-transfer/[id]` sees no account to transfer money into.
**Related spec:** [`docs/specs/2026-08-28-08-orders-payment-processing.md`](../specs/2026-08-28-08-orders-payment-processing.md)
(AC-3, AC-9)
**Related feature entry:** [`docs/features/2026-09-07-payment-account-details-boxes.md`](../features/2026-09-07-payment-account-details-boxes.md)

## Symptom

Admin reported: "bank account details work not showing on page ... not show all time." On
`apps/web/app/checkout/bank-transfer/[id]/page.tsx`, the account details section (Bank Name /
Account Title / Account Number) rendered as an empty gap — no error, no placeholder, nothing — even
though the reference number and receipt-upload UI worked fine.

## Trigger vs. cause

Two independent defects compounded into this one visible symptom. Neither alone fully explains it —
both had to be found and are both fixed here.

### Defect 1 — `AuditLogService.record()` was not fault-isolated from the write it audits

**Trigger:** the local dev Postgres was reseeded (a new `localdev-admin`-style admin row was
created with a new id) while an admin session/JWT issued against the *old* admin id was still being
used to call `PUT /api/admin/settings/payment-methods`.

**Cause:** `PlatformSettingsService.updatePaymentMethods()`
(`apps/api/src/settings/platform-settings.service.ts:72-93`) does the real `payment_method_settings`
upsert first, then `await`s `AuditLogService.record({ adminUserId, ... })` afterward. The audit
insert has a real FK (`audit_logs.admin_user_id -> users.id`); when the admin id no longer exists,
`prisma.auditLog.create()` throws a `PrismaClientKnownRequestError` (foreign key violation). That
exception was never caught, so it propagated straight to `AllExceptionsFilter` and the whole request
came back `500 INTERNAL_ERROR` — **even though the actual settings write had already committed** in
the `$transaction` a few lines earlier. Confirmed live: first call (stale admin id) → `500`, but a
`SELECT` immediately after would have shown the row already written; the *second* call (fresh admin
id, otherwise identical body) succeeded and the row's `updatedAt` matched that second call, not the
first.

This is a repo-wide pattern risk, not specific to payment methods: every other `applyUpdate()` path
in the same service (`contact`, `social`, `experience`, `domain`) does the identical
write-then-`await audit.record()` sequence, and so does every other caller of
`AuditLogService.record()` elsewhere in `apps/api`. Any of them can produce the same
"looks like it failed, actually succeeded" response whenever the acting admin's id has gone stale
relative to the database (deleted account, reseeded dev DB, revoked admin during a long-lived
session).

### Defect 2 — the checkout page conflated "not configured" with "couldn't check"

**Trigger:** any failure of `GET /api/settings/public` from the customer's browser — including the
above 500 rebounding indirectly (Admin never actually got bank transfer enabled, so the public
endpoint legitimately returned `bankTransferConfig: null`), but also any transient network error,
CORS misconfiguration, or backend restart mid-session.

**Cause:** `apps/web/app/checkout/bank-transfer/[id]/page.tsx`'s fetch effect
(`.catch(() => setBankConfig(null))`) mapped every failure mode onto the exact same state as "Admin
hasn't configured this yet" — `null`. Both cases then rendered as the same silent empty box, with no
banner, no retry prompt, nothing distinguishing "we don't have your bank details on file" (an Admin
setup gap) from "we couldn't reach the server just now" (a transient failure the customer should
retry, not conclude the store simply has no bank transfer option). For a payment flow, silently
hiding *where to send money* with no explanation is a customer-trust problem on its own, independent
of the audit-log bug that caused this specific occurrence.

## Detection gap

- No integration test exercises `updatePaymentMethods()` against a `adminUserId` that doesn't
  satisfy the `audit_logs` FK — every existing test's fixture admin id is always valid, so this path
  was never exercised.
- No test asserts that a settings write's *data effect* (the row exists, correctly, after the call)
  is independent of the HTTP response code returned for that call — the existing unit test for
  `updatePaymentMethods` (`platform-settings.service.spec.ts`) mocks `paymentMethodSetting.findMany`
  to always return `[]` and never exercises the audit-log call at all, let alone a failing one.
- No test on the `apps/web` side distinguishes a `null` config from a fetch rejection on the
  bank-transfer page — the two were rendered identically, so a test asserting "empty box when not
  configured" would have passed even with this bug present; only a test asserting "an error banner
  appears on fetch failure, distinct from the not-configured state" would have caught it.
- This was only caught because of an unrelated Windows-specific event in this session (`git pull`
  required killing all `node.exe` processes, which stopped the dev API; restarting it happened to
  trigger a dev-only reseed that seeded a *new* admin id) that manually reproduced the exact
  staleness condition. In a normal dev/prod flow this class of bug is silent until an admin account
  is deleted or a session significantly outlives the admin record it references.

## Fix

- `apps/api/src/audit/audit-log.service.ts` — `record()` now wraps the `auditLog.create()` call in
  `try/catch` and logs via `Logger.error()` on failure instead of throwing. Audit logging is
  best-effort observability, not a transactional gate on the write it's recording; every call site
  (`updatePaymentMethods`, `applyUpdate`, and every other caller across `apps/api`) is fixed by this
  one change without needing to touch each call site individually.
- `apps/web/app/checkout/bank-transfer/[id]/page.tsx` — added a `bankConfigLoadFailed` state,
  distinct from `bankConfig === null`. A fetch failure now shows an amber banner telling the
  customer to refresh before sending payment; a successful fetch that legitimately has no bank
  transfer configured shows a different banner directing them to contact support. Neither case is
  silent anymore.

### Deliberately not changed (scope boundary)

- The underlying reason an admin session can reference a deleted user id at all (no DB-existence
  check in `JwtAuthGuard`, only signature/expiry verification) is not fixed here — that's a
  legitimate design question (should a JWT be revoked the instant its user row is deleted, versus
  relying on token TTL?) belonging to the Auth & Account Security aspect (A-002), not this incident.
  Flagged here for whoever picks that up next, not guessed at.
- No migration or backfill was needed — this was a code-path bug, not a data-model bug.
