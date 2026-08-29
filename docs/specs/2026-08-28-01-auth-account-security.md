# Spec: Authentication & Account Security

**File:** `docs/specs/2026-08-28-01-auth-account-security.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), architecture §Authentication & Security, SRS §14 / Addendum §1

---

## 1. Problem statement

**Today:** There is no customer account system. Nobody can register, log in, recover a password,
or be recognized across sessions/devices. Admin has no protected login separate from customers, no
2FA, and no way to grant a limited-scope helper (freelancer) account.

**Who is affected:** Every customer who needs an account to buy, track orders, or download files;
Admin and any future freelancer/limited-admin, who need a protected, auditable login distinct from
public customers.

**Why it matters now:** Every other feature (cart, orders, quotes, downloads, admin CMS) depends on
knowing who the caller is and what they're allowed to do. Private embroidery files must only ever
be reachable by an authenticated, authorized, paid customer or Admin — this is the gate that
enforces that.

**Success looks like:** A customer can register, log in, be safely recognized on a new device, and
recover a forgotten password; Admin logs in with mandatory 2FA and can create scoped
freelancer/limited-admin accounts; every session expires appropriately and every admin/API endpoint
verifies authorization server-side.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a new email/password **When** the user submits registration **Then** the password is hashed (bcrypt, 12 rounds), a `users` row is created with `role=customer`, and email verification is required before the account is treated as trusted |
| AC-2 | **Given** valid credentials from a device that already has a verified session for that account **When** the user logs in **Then** an access token (15 min) and refresh token (7 day) are issued immediately, no extra verification is required |
| AC-3 | **Given** valid credentials from a device with no verified session for that account **When** the user logs in **Then** the API returns `401 NEW_DEVICE_VERIFICATION_REQUIRED`, a 4-digit code is emailed, and existing trusted sessions for the account receive a new-login notification |
| AC-4 | **Given** a 4-digit device-verification code **When** the user submits it within its validity window and has not exceeded 3 attempts in 15 minutes **Then** a trusted session is created; **given** more than 3 attempts in 15 minutes **then** the API returns `429 RATE_LIMITED` |
| AC-5 | **Given** an `admin`-role user **When** they log in **Then** 2FA (TOTP) verification is mandatory before a session is issued, regardless of device trust |
| AC-6 | **Given** a user requests "Forgot Password" for a registered email **When** they submit the correct 4-digit code within 10 minutes **Then** they may set a new password and every existing session for that account is revoked; **given** an expired or incorrect code **then** the API returns a validation error without revealing whether the email exists |
| AC-7 | **Given** a session with no activity for 30 days **When** the user next makes any request **Then** the session is treated as expired and the request is rejected with `401 UNAUTHENTICATED` |
| AC-8 | **Given** Admin creates a freelancer/limited-admin account for a saved Gmail/email **When** the account is created **Then** it is scoped to specific modules/categories with read-only or CRUD limits as configured, and Admin can revoke it at any time, immediately invalidating its active sessions |
| AC-9 | **Given** any request to an Admin or private-file API route **When** the caller's token role/permissions do not satisfy the route's policy **Then** the API returns `403 FORBIDDEN` and the attempt is written to `audit_logs` |
| AC-10 | **Given** a user chooses to authenticate via Google or Facebook OAuth instead of email/password **When** the OAuth flow completes successfully **Then** a `users` row is created or matched by the verified OAuth email and a session is issued the same way as AC-2/AC-3, with device-trust rules still applying |
| AC-11 | **Given** a user with `role=moderator` **When** they log in **Then** they receive the moderator permission set — approve/reject user-submitted content, handle support tickets, and view basic analytics — distinct from both `customer` and `admin` access |
| AC-12 | **Given** a registered user chooses passwordless/magic-link login **When** they request a login link and click it from their email within its validity window **Then** a session is issued the same way as a successful password login, with the device-trust and new-device-verification rules from AC-2/AC-3 still applying |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for the shared response
envelope and global error codes. Routes specific to this feature:

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | `201` | rate-limited per IP |
| `POST` | `/api/auth/login` | Public | `200` tokens, or `401 NEW_DEVICE_VERIFICATION_REQUIRED` | |
| `POST` | `/api/auth/verify-new-device` | Public (code-bound) | `200` tokens | AC-3/AC-4 |
| `POST` | `/api/auth/verify-2fa` | Partial session (post-credentials) | `200` tokens | admin-mandatory |
| `POST` | `/api/auth/forgot-password` | Public | `200` (always, to avoid email enumeration) | |
| `POST` | `/api/auth/reset-password` | Code-bound | `200` | revokes all sessions (AC-6) |
| `POST` | `/api/auth/refresh-token` | Refresh token | `200` new access token | |
| `POST` | `/api/auth/logout` | Authenticated | `204` | revokes current session |
| `GET` | `/api/auth/verify-session` | Authenticated | `200` current user | used by frontend on boot |

### JWT structure

Access token (15 min): `sub`, `email`, `role`, `device_id`, `permissions[]`, `iat`, `exp`.
Refresh token (7 day): `sub`, `session_id`, `iat`, `exp`. Both per architecture §Authentication &
Security — no changes proposed here.

### Error codes (feature-specific, additive to master list)

| HTTP | `code` | When |
|---|---|---|
| `401` | `NEW_DEVICE_VERIFICATION_REQUIRED` | AC-3 |
| `401` | `INVALID_OR_EXPIRED_CODE` | wrong/expired verification or reset code |
| `409` | `EMAIL_ALREADY_REGISTERED` | registration with existing email |
| `429` | `RATE_LIMITED` | AC-4, login brute-force, password-reset spam |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `users` | existing (per architecture DDL) | add nothing new; `role` enum already covers `customer`/`admin`/`freelancer`/`moderator` |
| `sessions` | existing | `verification_code`, `verification_attempts`, `verification_expires_at` drive AC-3/AC-4 |
| `admin_permissions` *(new)* | proposed | `id`, `user_id → users.id`, `module` (e.g. `designs`, `orders`, `faqs`), `access_level` enum(`read_only`,`crud`), `revoked_at`, `created_at` — needed for AC-8 (freelancer/limited-admin scoping); the current schema only has a single `role` column, which cannot express per-module permissions |

### Migration

- **Name:** `AddAdminPermissions`
- **Reversible:** yes — drop `admin_permissions` table
- **Backfill required:** no (new table, empty by default)
- **Downtime:** none
- **Reviewed SQL:** to be authored alongside `users`/`sessions` in the initial schema migration from
  the master spec; `admin_permissions` ships as an additive table in the same or a follow-up
  migration

### Retention and privacy

Stores email, hashed password, device fingerprint/IP, verification codes (short-lived). Retention
policy is an open item tracked in the master spec §8; verification codes must be purged/nulled
after use or expiry regardless of the broader policy decision.

---

## 5. UI states

Screens: Register, Login, New-Device Verification, Forgot Password, Reset Password, Admin Login
(+2FA), Admin → Freelancer Accounts management.

| State | Behaviour |
|---|---|
| **Loading** | submit button shows inline spinner + disabled state; no skeleton needed (form, not a list) |
| **Empty** | not applicable to forms; Freelancer Accounts list shows "No freelancer accounts yet" + Create action |
| **Error** | inline field errors from `VALIDATION_ERROR.errors[]`; top-of-form banner for `INVALID_OR_EXPIRED_CODE` / `RATE_LIMITED` with retry timing shown |
| **Success** | redirect to intended destination post-login; toast confirmation on password reset / freelancer account created |

**Route(s):** `/register`, `/login`, `/verify-device`, `/forgot-password`, `/reset-password`,
`/admin/login`, `/admin/settings/freelancer-accounts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | password hashing, JWT claims construction, code expiry/attempt-limit logic | `apps/api/auth/*.spec.ts` |
| **Integration** | full register → login → new-device → verify flow; forgot-password → reset → sessions-revoked; admin 2FA gate; permission-scoped freelancer route access | `apps/api/test/integration/auth.spec.ts` |
| **Component** | form validation states, code-entry UI | `apps/web/auth/**` (RTL) |
| **E2E** | register → verify → login → logout; new-device login triggers notification on the original session | `e2e/auth.e2e.spec.ts` |
| **Component** | TOTP secret provisioning UX (QR code display) during Admin 2FA setup | `apps/web/auth/totp-setup.spec.tsx` |

**Traceability:** AC-1…AC-12 → `auth.integration.spec.ts` test names matching each AC number.

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** None — TOTP provisioning UX is covered by the Component test row
above.

---

## 7. Out of scope

None — every item previously listed here (social login, moderator role behavior,
passwordless/magic-link login) has been folded into AC-10–AC-12 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Exact freelancer permission granularity (per-module vs. per-category vs. per-record) is described narratively only; `admin_permissions.module` needs an agreed enum of module names before implementation | Admin / Engineering | Open |
| 2 | Device fingerprinting method (cookie, browser fingerprint library, or IP+UA heuristic) not specified | Engineering | Open |
| 3 | Whether "logout on all devices" is a customer-facing self-service action or admin-only | Admin | Open |

---

## 9. Rollout

- **Feature flag:** none — foundational, ships with the rest of Phase 1 MVP.
- **Migration order:** `admin_permissions` ships alongside/after the base `users`/`sessions` tables.
- **Rollback:** standard image rollback; `admin_permissions` table drop is safe pre-launch (no
  dependent data).
- **Observability:** alert on abnormal login-failure rate per IP (possible brute force) and on
  `NEW_DEVICE_VERIFICATION_REQUIRED` rate spikes (possible credential-stuffing).
