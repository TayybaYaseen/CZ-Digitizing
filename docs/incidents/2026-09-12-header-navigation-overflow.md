# Incident: Header navigation overflowed at laptop/desktop widths

**Date diagnosed:** 2026-09-12
**Reported by:** Admin (Tayyba Yaseen), via the Claude Code session
**Severity:** Medium — a visual/layout defect, not a functional outage: every nav link, Search,
Language, Login, Register and the logo all still worked, but the header itself exceeded the
available width at common laptop resolutions, cutting content off screen.
**Related spec:** [`docs/specs/SPEC_INDEX.md`](../specs/SPEC_INDEX.md) — A-003 (Header & Global
Navigation, core), A-022 (Header: Language Selector)
**Related feature entry:** none — this is a pure layout correction to an aspect already marked
`Completed`, not new functionality

## Symptom

Admin reported: the header contains too many navigation items in one horizontal row, so the
header becomes too wide and some content goes outside/cuts off the screen, especially on smaller
desktop/laptop resolutions.

`apps/web/components/Header.tsx`'s desktop row rendered the logo, all 8 `PRIMARY_LINKS` (Home,
Services, Design Categories, All Designs, Design Bundles, Get a Quote, Custom Request, Contact
Us), a "More" dropdown trigger, the search box, language switcher, cart link, and login/register
— fourteen-plus interactive elements — in a single `lg:flex` row with no responsive narrowing.
At 1366px/1440px laptop widths in particular, that row's intrinsic content width exceeded the
viewport, so trailing controls (Register, in the worst case) rendered partially or fully outside
the visible area with no wrap or scroll affordance.

## Trigger vs. cause

**Trigger:** none — this wasn't triggered by a code change or a specific user action. It was
present from the moment A-003 shipped (2026-09-02, see `SPEC_INDEX.md`'s Change Log) and only
surfaced now because nobody had checked the header specifically at 1366/1440px until Admin did.

**Cause:** the header's desktop nav (`apps/web/components/Header.tsx`'s `<nav className="hidden
items-center gap-1 lg:flex">` block) rendered all 8 `PRIMARY_LINKS` plus a "More" trigger inline,
beside the logo, search, language switcher, cart, and login/register — with no width budget
applied anywhere in that row. Nothing in the original implementation accounted for the combined
minimum width of that many controls against real laptop viewport widths; it was verified only
against wider desktop resolutions per the A-003 Change Log entry ("live render confirmed against
the running dev server").

## Detection gap

- No responsive/viewport-width test existed for `Header.tsx` — nothing asserted that its content
  fits within common laptop widths (1366/1440) without overflow.
- The A-003 verification note in `SPEC_INDEX.md` only records a live check against the dev
  server's default window size, not a sweep across breakpoints.
- Visual/layout regressions like this don't fail `tsc`/lint/unit tests — they're only caught by
  actually rendering the page at representative widths, which wasn't part of this aspect's
  verification step.

## Fix

UI/layout only — no route, destination, or functional behavior changed for any control.

- `apps/web/components/Header.tsx` — removed the inline desktop nav row (`PRIMARY_LINKS` map +
  "More" dropdown) entirely. The header's horizontal row is now fixed at logo (left) plus Search,
  Language, Login/Register (or Notifications + Account when signed in), and a hamburger control
  (right) at every breakpoint, not just below `lg`. All 8 primary links, "More" and its existing
  sub-items (FAQ/Tips/Testimonials/Blog/About Us/Portfolio/Subscription/My Account/My Quotes), and
  Cart now live inside a hamburger-triggered navigation drawer, grouped as Main / Requests /
  Company (with More as an in-drawer accordion, preserving its existing nested-list behavior) /
  Account. The drawer replaces the old `lg:hidden` mobile-only panel — it's now the single
  navigation surface at all widths, so mobile and desktop no longer diverge into two separate nav
  implementations.
- The header's right-hand cluster (search field width, language button label, login/register
  padding, the logo itself) is now responsive down to ~360px, verified with Playwright across
  360/390/414/834/1366/1440/1920px viewports: no `document.documentElement.scrollWidth` exceeds
  `clientWidth` at any of them (no horizontal overflow), and no element's bounding box overlaps
  another's.
- `apps/web/components/LanguageSwitcher.tsx`, `apps/web/components/NotificationBell.tsx` — same
  buttons, same click/keyboard behavior, same destinations; only their label rendering is now
  responsive (2-letter locale code / bell glyph below `sm`, full text at `sm` and up) so they don't
  consume more width than the smallest viewports have to give.
- `apps/web/tailwind.config.ts` — added an `xs: 400px` custom breakpoint (between Tailwind's base
  and its 640px `sm`) so the header's width-critical elements have one more responsive step
  between "smallest phone" and "phone", rather than jumping straight to `sm`'s values.

### Deliberately not changed (scope boundary)

- No route, page, or API changed. No auth, search, language, cart, or account logic changed —
  every control the drawer or header row renders points at the exact same `href` it did before.
- The "More" dropdown's own contents were not flattened, reordered, or pruned — same 9 links,
  same order, now reached through an accordion instead of a hover dropdown, per Admin's explicit
  instruction to preserve its existing sub-navigation as-is.
- A live-auth (signed-in) pass showing Notifications + Account menu in the header's right-hand
  cluster at every breakpoint was reasoned about component-by-component (both controls are already
  narrower than the Login/Register pair they replace, and `AccountMenu` already hides the display
  name below `lg`) rather than exercised through a real login flow in this session — flagged here,
  not asserted as verified, in case a follow-up pass wants to confirm it live.

## Related

- [`docs/specs/SPEC_INDEX.md`](../specs/SPEC_INDEX.md) — A-003 row and Change Log (this incident's
  fix is noted there as a layout correction, no Status/Order/Dependency change since A-003 was
  already `Completed` and this doesn't reopen its scope).
