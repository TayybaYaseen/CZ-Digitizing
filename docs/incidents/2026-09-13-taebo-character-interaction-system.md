# Incident: Taebo had no approved character asset and no interaction system beyond a static widget

**Date diagnosed:** 2026-09-13
**Reported by:** Admin (Tayyba Yaseen), via the Claude Code session, after supplying an official
Taebo reference image
**Severity:** Medium — a brand/UX defect, not a functional outage: the chatbot's actual Q&A logic
(AC-1–AC-9, `apps/api/src/taebo/`) worked correctly throughout; what was wrong was purely the
character's visual presentation and the absence of any positioning/interaction system around it.
**Related spec:** [`docs/specs/2026-08-28-15-taebo-chatbot.md`](../specs/2026-08-28-15-taebo-chatbot.md)
§10 (new addendum this incident introduces) — aspect A-020 (Taebo Helping Panda / Chatbot, already
`Completed`)
**Related feature entry:** none — this is a character/UI correction to an aspect already marked
`Completed`, not new backend functionality

## Symptom

Admin supplied an official reference image for Taebo (a realistic, standing, full-body panda in a
navy vest with gold trim and a small CZ badge, shown across several named poses — idle, greeting,
thinking, helping, waiting, success, mobile) and asked for a complete branded chatbot character
system. Inspection of the running site found:

- The production widget was rendering a plain 🐼 emoji circle instead of any panda artwork — the
  master asset `apps/web/public/images/taebo-full.png` this component has always expected does not
  exist in the repository, so `TaeboPanda.tsx`'s existing error-fallback path was silently active on
  every page.
- The only internal documentation describing what Taebo should look like
  (`docs/design/taebo-panda-prompts.md`) specified a **different, unapproved character concept** — a
  sitting baby panda cub with no clothing — not the standing, vested, branded adult panda in the
  newly supplied reference. A future agent or designer regenerating art from that doc alone would
  have produced the wrong character.
- There was no pose/state system at all: one static image (once supplied) would have been reused
  everywhere with no visual distinction between "thinking," "waiting for admin," or "idle."
- The floating launcher had a fixed screen position with no way for a customer to move it out of the
  way of page content, and no keyboard-only path existed for repositioning (moot until dragging
  existed, but relevant once it did).

## Trigger vs. cause

**Trigger:** Admin supplied the official reference image and a full specification for the character
+ interaction system in this session; there was no prior code change or user action that broke
anything — the emoji fallback had been silently active since Taebo's original build.

**Cause:** `apps/web/components/TaeboPanda.tsx` was built correctly to require an external binary
image asset, but that asset was never supplied to the project, so its existing error-handling path
(a 🐼 fallback) was the only thing ever rendered in production.
Separately, `docs/design/taebo-panda-prompts.md` was authored before any real reference existed and
encoded a design decision (baby cub, sitting) that was never actually approved against a real
brand reference — it was a placeholder assumption, not a verified requirement. No drag/position
system existed because none had been specified until this session.

## Detection gap

- No visual regression check exists (or could reasonably exist) for "is the correct binary asset
  present" — this class of gap is only caught by someone actually looking at the rendered page,
  which is exactly how Admin caught it here.
- `docs/design/taebo-panda-prompts.md` was never cross-checked against an actual approved brand
  reference image before this session, because no such reference had been supplied yet — the doc
  documented an assumption, and nothing flagged that assumption as unverified until a real reference
  arrived.

## Fix

UI/interaction layer only — the existing chatbot API, data model, and anti-fabrication contract
(§1–§9 of the linked spec) were not touched.

- `apps/web/components/TaeboPanda.tsx` — added a `pose` prop and a `taebo-<pose>.png` →
  `taebo-full.png` → 🐼 emoji fallback chain (previously: one fixed source, emoji fallback only).
- `apps/web/components/TaeboWidget.tsx` — derives the active pose from the widget's own existing
  `loading`/`error`/`messages` state (no second state machine); added drag-aware pointer handlers on
  the closed-state launcher, a computed on-screen placement for the open panel and the proactive
  suggestion bubble, and a "Reset Taebo position" control.
- `apps/web/lib/use-taebo-position.ts` (new) — click-vs-drag threshold (6px), Pointer Events for
  mouse and touch, viewport clamping, `localStorage`-only persistence (`czd.taebo.position`), reset.
- `apps/web/app/globals.css` — `prefers-reduced-motion` guard for the idle-bob animation and the
  widget's own transitions.
- `docs/design/taebo-panda-prompts.md` — old cub-concept prompts marked superseded (kept for
  history, not deleted); new prompts and a required-asset-file table added, matching the existing
  `apps/web/public/images/` convention rather than introducing a new asset folder.
- `.claude/skills/cz-digitizing-design/readme.md` — new "TAEBO — OFFICIAL CHATBOT CHARACTER SYSTEM"
  section; `.claude/skills/cz-digitizing-design/guidelines/brand-taebo.html` — new specimen card.
- `docs/specs/2026-08-28-15-taebo-chatbot.md` — new §10 (this incident's specification of record).
- `docs/specs/SPEC_INDEX.md` — Change Log entry (A-020, no Status/Order/Dependency change).

### Deliberately not changed (scope boundary)

- The chat panel itself is not draggable, only the closed-state launcher — matches the supplied
  specification's own framing and keeps the drag surface small and predictable.
- `success` pose plumbing exists (asset resolution, type, design-doc entry) but is not invoked
  anywhere in `TaeboWidget.tsx` — it's reserved for other pages' own request-submitted states (Get a
  Quote, Custom Request, File Format Request), which were not touched, to avoid unrelated-page scope
  creep in this pass.
- `apps/mobile/components/TaeboWidget.tsx` (React Native) was not touched or evaluated — this pass
  was scoped to the customer website, where the reference image and the existing web widget both
  live. Mobile parity, if wanted, is a follow-up.
- **The supplied reference image is still not committed to the repository.** This session has no
  mechanism to save an image pasted inline into a chat conversation to disk — someone with the
  exported file needs to place it at `apps/web/public/images/taebo-full.png` (and optionally the
  per-pose files listed in `docs/design/taebo-panda-prompts.md`). Until then, the fallback chain
  above keeps the site rendering a neutral 🐼 emoji rather than a broken image or a substituted
  different-looking character.
- No hardcoded demo/test chat content was found or removed from production UI — a full-repo search
  confirmed the only "Antarctica"-style string in the codebase is a legitimate backend unit-test
  fixture (`apps/api/src/taebo/taebo.service.spec.ts`) for the existing AC-3 no-fabrication
  contract, not a bug.

## Update (later the same day)

Two corrections to the original write-up above, both from the same 2026-09-13 session:

1. **The premise "there is no dedicated Taebo component" was checked and found false.** A follow-up
   instruction assumed the fix above hadn't happened and asked to build the component "from
   scratch." `apps/web/components/TaeboWidget.tsx`, `TaeboPanda.tsx`, and
   `apps/web/lib/use-taebo-position.ts` were all already present and working (verified via `git
   status`/`ls` before touching anything) — nothing was rebuilt from zero; the existing files were
   extended instead, avoiding a duplicate second widget.
2. **The master asset is no longer missing.** It was found saved locally (an exported ChatGPT-image
   PNG in Admin's Downloads folder, matching the reference pasted in chat) and copied to
   `apps/web/public/images/taebo-full.png` (and mirrored to the design skill's own
   `assets/taebo-full.png` for the guideline card). The 🐼 emoji fallback documented above is no
   longer what customers see; it remains in the code as a defensive fallback only.

A real, additional gap was found and fixed at the same time: the launcher was rendering the panda
inside a circular white avatar button (a "generic round chatbot icon"), which is exactly what the
design system's own rule against a "generic AI mascot" presentation warns against. Fixed:
`TaeboWidget.tsx`'s closed-state launcher now renders `<TaeboPanda variant="full">` directly, sized
~90–130px tall (desktop) / ~70–95px (mobile) via CSS breakpoints, with no circular/boxed background
— `apps/web/lib/use-taebo-position.ts`'s clamp/default-position math was generalized from a single
square `LAUNCHER_SIZE` to a `{width, height}` pair to match the panda's portrait aspect ratio. The
small circular avatar inside the open chat panel's header was deliberately left alone — that's a
different, appropriately compact placement, not the "floating assistant" the no-circle rule targets.

Re-verified live end-to-end after this update (Playwright, desktop 1440px + mobile 390px with real
touch events): the real photo renders (`img[src="/images/taebo-full.png"]`, not the emoji), drag
moves it without opening chat, a real click/tap still opens the panel, "Reset Taebo position"
restores the exact default coordinates, a dragged position round-trips through `localStorage` and
survives a reload byte-for-byte, no horizontal overflow on mobile, and zero console/page errors on
either viewport.

## Update 2 (third pass, same day)

A follow-up instruction asked to complete the chatbot UI/identity/behavior layer against the same
reference sheet, again scoped to "improve the existing assistant," not rebuild it. Real gaps found
and fixed in this pass:

- The chat panel header displayed **"Taebo Helping Panda"** — the reference names the assistant
  "TAEBO" with the panda as the character, not the name. Changed to "TAEBO" + "Your CZ Digitizing
  Assistant," plus a small online-status dot. (The aspect's own title, "Taebo Helping Panda
  (Chatbot)," used throughout `SPEC_INDEX.md` and the master spec as a stable cross-reference
  identifier, was deliberately left untouched — that's spec-numbering metadata, not rendered UI
  copy, and renaming it would ripple through unrelated cross-references for no visual benefit.)
- The chat panel was a white card; the reference specifically depicts a dark navy chat surface.
  Restyled: navy-800 header, navy-900/700 body, white customer bubbles, navy-700 Taebo bubbles,
  gold-tinted escalated bubbles, gold Send button, a dot-based typing indicator (`● ● ●`-style,
  replacing a plain "Taebo is typing…" line) and an updated error message
  ("I'm having trouble connecting right now. Please try again or contact support." + a real
  `/contact` link), per the reference's explicit chat-window styling requirements.
- No site-navigation quick actions existed inside the chat. Added a `QUICK_ACTIONS` pill row
  (Browse Designs, Design Categories, Embroidery Digitizing, Vector Art, Get a Quote, Custom
  Request, Orders & Downloads, File Formats, Contact Support), each a plain `<Link>` to a route
  that already exists — no new backend functionality, no fake destinations.
- The panel's fixed 320×384 size could risk overflow on the narrowest phones in the test sweep
  (320–375px); it's now clamped to the actual viewport with the same margin the launcher/bubble
  already respect.

**Expressions (Happy/Thinking/Excited/Winking/Surprised/Friendly), explicitly requested, were
deliberately NOT implemented as code** — no distinct expression assets exist, and there is no
honest way to visually express "winking" vs. "surprised" via CSS alone on one static photo. Adding
an unused `expression` prop that never changes what renders would be exactly the kind of inert
scaffolding the originating instructions warned against. Documented instead (design system §11,
spec §10.10) as ready to wire in in the same style as the existing pose fallback chain, if and when
real crops are supplied.

Re-verified live (Playwright, desktop 1440px + real mobile touch at 375px): header shows "TAEBO" /
"Your CZ Digitizing Assistant" (old string confirmed gone from the rendered panel), quick actions
render and a direct click-through confirmed `Get a Quote` navigates to the real `/get-a-quote`
route, the dark theme and typing/error states render as designed, and the panel fits without
horizontal overflow at 375px. Zero console/page errors.

## Related

- [`docs/specs/2026-08-28-15-taebo-chatbot.md`](../specs/2026-08-28-15-taebo-chatbot.md) §10.
- [`docs/specs/SPEC_INDEX.md`](../specs/SPEC_INDEX.md) — A-020 row and Change Log.
- [`docs/design/taebo-panda-prompts.md`](../design/taebo-panda-prompts.md).
- [`.claude/skills/cz-digitizing-design/readme.md`](../../.claude/skills/cz-digitizing-design/readme.md) — TAEBO section.
