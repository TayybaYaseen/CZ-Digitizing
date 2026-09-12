# Incidents

A record of real bugs found in this codebase — not a wishlist, not a TODO list. Every entry here
was an actual observed failure (reported by Admin/a customer, or caught during verification),
written up **after** it was diagnosed and fixed, so future work doesn't reintroduce the same class
of mistake.

## When to add an entry

Add a file here whenever a real defect is found and fixed — not for every code review nitpick, and
not for "flagged, not guessed" open questions from `docs/specs/SPEC_INDEX.md` (those already have a
home: the spec's own §8 Risks table and the SPEC_INDEX.md Change Log).

## File naming

`YYYY-MM-DD-short-kebab-slug.md`, dated the day the incident was diagnosed (not necessarily the day
it started).

## Required sections

Each incident file must cover:

- **Symptom** — what was observed, in the words of whoever reported it, plus what it looked like
  technically (error message, HTTP status, screenshot description).
- **Trigger vs. cause** — these are not the same thing and must not be conflated:
  - *Trigger*: the specific action/event that surfaced the bug this time (e.g. "dev database was
    reseeded while an old admin session was still active").
  - *Cause*: the actual defect in the code that made that trigger produce a failure at all (e.g.
    "audit logging was awaited synchronously in the write path with no failure isolation, so an
    unrelated FK violation there aborted an already-successful write").
  - A trigger without a cause section is just a bug report; a cause without a trigger doesn't
    explain why it wasn't caught sooner. Both are required.
- **Detection gap** — why existing tests/monitoring/review didn't catch this before it reached a
  real user. This is the most important section: it's what should change process-wise, not just
  code-wise.
- **Fix** — what was actually changed (file paths), and what was deliberately *not* changed (scope
  boundary), if relevant.
- **Related** — links to the spec(s) involved and any `docs/features/` entry for the change that
  introduced or fixed it.

## Index

| Date | Incident | Root cause category |
|---|---|---|
| 2026-09-07 | [Bank transfer details not showing](2026-09-07-bank-transfer-details-not-showing.md) | Audit logging not fault-isolated from the write path |
| 2026-09-12 | [Header navigation overflow at laptop/desktop widths](2026-09-12-header-navigation-overflow.md) | No responsive width budget on the header's nav row |
