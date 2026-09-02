# Spec: Brand & Visual Identity System

**File:** `docs/specs/2026-09-02-01-brand-visual-identity.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** SRS §1-3 ("Brand & Website Visual References", "Brand Kit & UI Visual Direction"), `CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md` pages 1-5, `docs/specs/2026-09-01-20-landing-page-experience.md` (blocked on this spec)

---

## 1. Problem statement

**Today:** `apps/web` and `apps/admin` render with default Tailwind grays and no shared design
tokens — plain black-on-white text, a static header with no logo mark, and no documented color,
type, or spacing system. Every screen built so far (auth, notifications) works functionally but
carries no CZ Digitizing identity.

**Who is affected:** Every customer, who sees an unbranded placeholder instead of a premium
embroidery brand; Admin, whose panel has no visual distinction either; every future spec (A-003
Header/Nav, A-018 landing page, A-006 design catalog, etc.) that needs a design system to build on
instead of inventing its own colors ad hoc.

**Why it matters now:** This is the root of the dependency tree (`SPEC_INDEX.md` Level 1, no
dependencies) — `A-003` and everything visually downstream of it stays `Blocked` until this ships,
per `CLAUDE.md` §2's mandatory parent-before-dependent rule.

**Success looks like:** A documented, implemented color palette, typography scale, and spacing/
radius system shared by both apps; a wordmark used consistently in both apps' chrome; enough of a
foundation that A-003 (Header & Global Navigation) can start.

**Explicit non-goal of this pass:** The actual CZ Digitizing logo *mark* (the "moon-shaped C +
metallic Z + needle/thread" graphic the SRS references) is not available as a supplied asset in
this repository — only described narratively. Per Admin's direction, this spec ships a styled
**text wordmark** ("CZ Digitizing") as a placeholder and defines a `Logo` component seam so the
real mark can be dropped in later without touching every call site. Claiming a fabricated graphic
was "the selected logo" would misrepresent an asset that was never actually provided.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the SRS's narrative color direction (Deep Navy/Black, Silver, White, Light Gray, Gold Accent) **When** implemented **Then** a concrete hex palette exists as Tailwind theme tokens (`brand.navy`, `brand.gold`, `brand.silver`, `brand.lightGray`, plus semantic `background`/`foreground` tokens), shared by both `apps/web` and `apps/admin` |
| AC-2 | **Given** the palette tokens **When** applied **Then** `apps/web`'s existing header/footer chrome uses the brand navy/gold treatment instead of default Tailwind gray, and `apps/admin`'s existing dark chrome is re-based onto the same navy/gold tokens instead of generic `gray-950` |
| AC-3 | **Given** no supplied logo image asset **When** a wordmark is needed **Then** a shared `Logo` component renders a styled text wordmark ("CZ Digitizing" + "MACHINE EMBROIDERY DESIGN" subtitle) using the brand type scale, isolated behind one component per app so a real logo image can replace it later without call-site changes |
| AC-4 | **Given** the SRS's typography direction (premium, professional, readable) **When** implemented **Then** both apps load a single consistent font family (via `next/font`, not a runtime `<link>`) applied through Tailwind's `fontFamily` token, replacing the default system-font stack |
| AC-5 | **Given** existing form/button/banner components built for spec 01/02 (`FormField`, `ErrorBanner`, `SuccessBanner`, submit buttons) **When** this spec ships **Then** their colors are re-pointed at the new brand tokens (e.g. `indigo-600` → `brand.navy`/`brand.gold` accent) rather than left on the ad hoc palette chosen before a design system existed, with no behavioral change |
| AC-6 | **Given** this spec's completion **When** `SPEC_INDEX.md` is next updated **Then** A-001's Status moves `Not Started` → `Completed` and A-003 (whose only Dependencies are A-001, A-002 — both now `Completed`) is mechanically unblocked to `Not Started`, per `CLAUDE.md` §5 |

---

## 3. API contract

None — this is a frontend-only design-token and component spec. No backend routes.

---

## 4. Data model changes

None.

---

## 5. UI states

Not applicable in the usual sense (this spec has no data-fetching screens) — instead, this section
documents the token contract other specs must build against:

| Token category | Values |
|---|---|
| **Color — brand** | `navy` (#0B1220 primary dark background), `navy-light` (#152238, secondary surface), `gold` (#C9A227 accent, used sparingly for CTAs/highlights), `silver` (#C4CBD4, secondary text/borders on dark), `lightGray` (#F4F5F7, light-mode surface) |
| **Color — semantic** | `background`/`foreground` per app (light app: `lightGray`/`navy`; dark app: `navy`/`silver`) so components don't hardcode which literal brand color means "page background" |
| **Typography** | One font family (Inter, loaded via `next/font/google`) for both apps — SRS calls for "professional, not AI-looking," not a display/serif pairing; a single well-established grotesk keeps every screen legible and avoids an invented pairing not actually specified anywhere |
| **Radius/spacing** | No new scale — existing Tailwind defaults already match the "clean, professional" direction; not worth a bespoke token layer this pass |

**Route(s):** None (no new pages) — applies to `apps/web/app/layout.tsx` and `apps/admin/app/layout.tsx` and their shared component files.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | none — token values and a static wordmark component have no meaningful unit-testable behavior | — |
| **Visual/manual** | both apps' headers render the wordmark and brand colors; existing auth/notifications screens still pass their own test suites unchanged (this spec only re-points color classes, not logic) | manual `pnpm run dev` check + re-run of existing `apps/web`/`apps/admin` typecheck/lint |

**Traceability:** AC-1…AC-6 verified by direct inspection (`tailwind.config.ts` diffs, rendered HTML) since there is no business logic to unit test.

**Coverage:** N/A — no new executable logic.

**Not covered, deliberately:** Automated visual-regression testing (e.g. Chromatic/Percy) — no such tooling exists in this repo yet and standing one up is out of scope for a token-definition pass.

---

## 7. Out of scope

- The real logo image/mark — tracked as an explicit open item (§8) until Admin supplies it.
- Full landing page composition (A-018, A-009, A-012c) — separate aspects, still `Not Started` after this ships.
- Header & Global Navigation's actual nav/search/cart-badge UI (A-003) — this spec only unblocks it.
- A bespoke spacing/radius scale — existing Tailwind defaults are kept.
- Dark/light mode toggle — each app keeps its existing single theme (web light, admin dark), now re-based on shared tokens rather than each getting a theme switcher.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The actual selected logo image (SRS: "moon-shaped C + metallic Z + needle/thread") has never been supplied as a file in this repository | Admin | Open — text wordmark ships as a placeholder per Admin's explicit direction; swap-in point is the `Logo` component |
| 2 | Exact hex values are this spec's own concretization of the SRS's narrative palette ("Deep Navy/Black, Silver, White, Light Gray, Gold Accent") — no hex codes were specified anywhere in the source documents | Admin | Open — Admin should review the chosen hexes in §5 and request adjustments before they propagate into every future UI spec |
| 3 | Whether Admin Panel should visually share the customer brand at all, versus a deliberately distinct "operational tool" look, is not stated in the SRS (page 4 only says a "final... Admin Panel... visualization" reference exists, without describing its relationship to the customer brand) | Admin | Resolved for this pass: same token source, admin keeps its darker/denser layout — revisit if Admin wants a harder split |

---

## 9. Rollout

- **Feature flag:** none — foundational, no user-facing behavior to gate.
- **Migration order:** first in the dependency tree; nothing to sequence against.
- **Rollback:** standard revert of the Tailwind config / component changes; no data involved.
- **Observability:** none applicable.
