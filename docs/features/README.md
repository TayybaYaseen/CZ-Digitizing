# Features

A changelog of feature-level work done in this codebase, written for a human trying to answer
"what triggered this change, which spec does it belong to, and exactly which files moved" — a level
more granular than `docs/specs/SPEC_INDEX.md`'s Change Log (which tracks aspect Status transitions)
and more permanent than a PR description (which git history doesn't make easy to browse by spec).

## When to add an entry

Add a file here for any real feature addition or extension — a new UI capability, a new endpoint, a
new admin control — whether or not it moves an aspect's Status in `SPEC_INDEX.md`. Small
UI-only additions (like a details form for an existing config field) still get an entry; they just
won't always have a Status change to go with them.

Do **not** duplicate a bug fix here — that belongs in `docs/incidents/` instead. If a change is
both (a fix that also adds new capability), it can get entries in both places, cross-linked.

## File naming

`YYYY-MM-DD-short-kebab-slug.md`, dated the day the feature shipped.

## Required sections

Each feature file must cover:

- **Trigger** — what prompted this work: a user request (quote it), a spec's stated requirement, a
  gap found while working on something else. Not "why is this a good idea" — literally what caused
  someone to start this change today.
- **Spec used** — which `docs/specs/*.md` file (and which AC/section) this traces to. If no spec
  covers it exactly (a small UI gap-fill, say), say so explicitly rather than inventing a citation.
- **Files changed** — every file touched, with a one-line note on what changed in each. This is the
  part a changelog/PR description usually skips and that makes this folder worth having — a reader
  should be able to jump straight to the right file without re-deriving it from a diff.
- **Verification** — what was actually run/checked (typecheck, tests, live render) before calling
  it done, and what could *not* be verified in this environment (be honest about gaps, per
  `docs/CLAUDE.md`'s "flag, don't guess" rule).

## Index

| Date | Feature | Spec |
|---|---|---|
| 2026-09-07 | [Per-method payment account detail boxes](2026-09-07-payment-account-details-boxes.md) | `2026-08-28-08-orders-payment-processing.md` (AC-3/AC-9) |
