# Feature: Per-method payment account detail boxes in Admin Settings

**Date shipped:** 2026-09-07
**Spec:** [`docs/specs/2026-08-28-08-orders-payment-processing.md`](../specs/2026-08-28-08-orders-payment-processing.md)
— AC-3 ("customer sees bank details and reference number at checkout"), AC-9 ("Admin changes bank
receiving details or PayPal credentials from Settings ... no code deploy").
**Related incident:** [`docs/incidents/2026-09-07-bank-transfer-details-not-showing.md`](../incidents/2026-09-07-bank-transfer-details-not-showing.md)
— found while verifying this feature actually renders end-to-end.

## Trigger

Two direct requests from Admin, in sequence:

1. *"where i save payment accounts, if customer want transfer payment how he transfer and where he
   saw my accounts details"* — asked immediately after A-013 (Orders & Payment Processing) was
   implemented and merged. Investigating this surfaced a real gap: the A-013 implementation pass
   had wired the *data plane* for `PaymentMethodSetting.config` (backend model, the customer-facing
   bank-transfer page already read `bankTransferConfig` from it) but never built the Admin-facing
   *form* to actually type those values in — only an enable/disable checkbox existed.
2. *"also add cradit card and paypal details box if i check all the then i have to change, delete
   and save all three details"* — a direct follow-up asking for the same capability (an editable
   details box, with a clear/delete action) to extend to all three payment methods, not just bank
   transfer, saved together in one action.

## Spec used

`docs/specs/2026-08-28-08-orders-payment-processing.md` doesn't specify the *Admin Settings UI*
layout itself (only the API contract in its §3 and the data model in its §4) — the details-box
design (which fields, the "Clear details" affordance, one shared Save button) was this session's own
concretization of AC-9's "no code deploy" requirement, following this repo's existing
`apps/admin/app/settings/platform/page.tsx` Card-per-section pattern rather than inventing a new
screen.

## Files changed

- `apps/admin/app/settings/platform/page.tsx` — added `PAYMENT_METHOD_FIELDS` (a per-method field
  list: bank transfer gets bank name/account title/account number/IBAN; PayPal gets a business
  account email; credit card gets a statement/merchant display name), a generic `paymentConfigs`
  state keyed by method (replacing the bank-transfer-only `bankTransferConfig` state from the first
  request), and a details box rendered per checked method with its own "Clear details" action. All
  three methods' enabled-flag + config save together through the existing single
  `PUT /api/admin/settings/payment-methods` call.
- `apps/api/src/settings/dto/update-payment-methods.dto.ts` — corrected a stale comment that called
  the bank account number a "secret" belonging in a secrets manager; it's necessarily
  customer-visible (a customer needs it to send the transfer), unlike PayPal/Stripe API credentials
  which do stay in `.env`. No behavioral change, no new validation — the `config` field already
  accepted arbitrary non-secret JSON.
- `apps/web/app/checkout/bank-transfer/[id]/page.tsx` — display the IBAN field alongside bank
  name/account title/account number, since the admin form now collects it.

No backend/schema change was needed — `PaymentMethodSetting.config` (a `Json?` column) already
existed from A-005, and `PublicSettingsDto.bankTransferConfig` already exposed it publicly, both
built during the A-013 implementation pass itself.

## Verification

- `tsc --noEmit` clean on `apps/admin`, `apps/api`, and `apps/web` after each edit.
- Confirmed the settings page still renders (`200`) against the running dev admin server after each
  change.
- End-to-end save round-trip verified via direct API calls (not the browser UI, since no admin
  password was available in this session) with a valid admin JWT: `PUT
  /api/admin/settings/payment-methods` with a `bank_transfer` config, then `GET
  /api/settings/public`, confirmed the saved `bankName`/`accountTitle`/`accountNumber`/`iban` came
  back correctly in `bankTransferConfig`. This same verification pass is what surfaced the
  audit-log bug written up in the linked incident.
- Not verified: an actual click-through in a real browser session as the Admin user (no credentials
  available in this environment) — flagged rather than claimed.
