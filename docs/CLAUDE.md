# CLAUDE.md — CZ Digitizing Project Rules

This file defines the **permanent rules** Claude must follow when working on the CZ Digitizing
project's aspects, features, and user/screen flow. It governs how [`SPEC_INDEX.md`](specs/SPEC_INDEX.md)
is built, read, and maintained. These rules do not expire at the end of a session.

---

## 1. Aspect Source of Truth

The **Aspect File** — currently [`CZ_DIGITIZING_ARCHITECTURE.md`](../CZ_DIGITIZING_ARCHITECTURE.md)
and [`CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md`](../CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md)
together — is the single source of truth for:

- Aspect names
- Parent Aspects
- Dependent Aspects
- Dependencies
- Relationships between aspects

[`SPEC_INDEX.md`](specs/SPEC_INDEX.md) is a **derived artifact**. It is never edited to say something
the Aspect File doesn't support. If the two disagree, the Aspect File wins and `SPEC_INDEX.md`
must be corrected to match — not the other way around.

If the individual `docs/specs/*.md` feature specs and the Aspect File ever disagree on a
relationship, the Aspect File is still authoritative for *dependency structure*; the feature specs
remain authoritative for *implementation detail* (API contracts, data models, acceptance criteria).
Flag any conflict between them rather than silently picking one.

---

## 2. Mandatory Dependency Rule

**A Parent Aspect MUST always come before its Dependent Aspect.** No exception.

- If Aspect B's Parent Aspect is Aspect A, then A appears earlier in every ordering, tree, and flow
  than B — always.
- If C depends on B and B depends on A, the only valid order is A → B → C.
- If multiple aspects share the same parent, the parent still comes first; the siblings are then
  ordered by their *own* dependencies relative to each other, never by convenience or by whatever
  order the Aspect File happens to list them in.
- This rule applies to the dependency tree, the recommended implementation/UX order, the user flow,
  and the screen flow. All four must be mutually consistent with each other and with
  `SPEC_INDEX.md`.

---

## 3. Before Working on Any Aspect

Before starting work on an aspect (design, spec, or implementation), Claude must:

1. Find the aspect in [`SPEC_INDEX.md`](specs/SPEC_INDEX.md)'s Aspect Registry.
2. Identify its Parent Aspect.
3. Identify all of its Dependencies (not just the parent — the full list).
4. Check the current Status of every aspect in that Dependencies list.
5. Confirm every required Parent/Dependency is `Completed` (not `In Progress`, not `Not Started`).
6. Only then start work, and only then move this aspect's own Status to `In Progress`.

If any required dependency is not `Completed`:

- This aspect's Status is (or remains) `Blocked`.
- Do not start it. Do not partially implement it "to get ahead." Say clearly which dependency is
  blocking it and what would need to complete first.

---

## 4. When the Aspect File Changes

Whenever `CZ_DIGITIZING_ARCHITECTURE.md` or `CZ_Digitizing_Master_SRS_COMPLETENESS_VERIFIED_FINAL.md`
changes (or a new/updated Aspect File is provided), Claude must, in this order:

1. Re-read the complete Aspect File — not a diff, not a summary. The full document(s).
2. Compare it against the current [`SPEC_INDEX.md`](specs/SPEC_INDEX.md) registry, row by row.
3. Detect:
   - New aspects (present in the Aspect File, absent from the registry)
   - Removed aspects (present in the registry, no longer supported by the Aspect File)
   - Renamed aspects (same underlying feature, different name/wording)
   - Changed Parent Aspects (a relationship that used to point one way now points another)
   - Changed Dependencies (a dependency added, removed, or redirected)
4. Update `SPEC_INDEX.md`'s Aspect Registry to reflect exactly what was detected — additive
   where possible, never silently deleting a row without flagging it first (see §6, Never Do).
5. Recalculate the Level for every aspect whose dependency chain changed
   (`Level = 1 + max(level of every aspect in its Dependencies)`).
6. Recalculate the Order column so it stays a valid topological sequence — Level 6, Dependency
   Validation.
7. Rebuild the Dependency Tree section to match.
8. Flag every conflict found (a dependent that would land before its parent, a dependency that no
   longer exists, a level that regressed) in the Dependency Issues section — do not resolve a
   conflict silently; surface it and, where the correction is unambiguous, apply it and record what
   changed and why in the Change Log at the bottom of `SPEC_INDEX.md`.

---

## 5. Status Values and Meaning

Only these five values are valid for the Status column. Do not invent others.

| Status | Meaning |
|---|---|
| `Not Started` | Work has not begun. All of its dependencies (if any) are `Completed`, or it has none. |
| `In Progress` | Currently being designed or developed. |
| `Completed` | Finished, and — this matters — its own dependencies were `Completed` *before* it was started. A "completed" aspect built out of order is a data-integrity problem, not a status to accept at face value; investigate before trusting it. |
| `Blocked` | A required Parent Aspect or Dependency is not yet `Completed`. This is computed mechanically from the Dependencies column, not asserted freely. |
| `Needs Review` | The relationship, dependency, or requirement itself is unclear in the Aspect File and must not be guessed at. |

Update [`SPEC_INDEX.md`](specs/SPEC_INDEX.md) every time a status actually changes. Do not batch
status updates or leave the registry stale relative to real progress.

---

## 6. Never Do

Claude must **not**:

- Invent a dependency or relationship that isn't stated or clearly implied by the Aspect File.
- Ignore a Parent/Dependent relationship because it's inconvenient for a requested order.
- Put a Dependent Aspect before its Parent anywhere — tree, order, user flow, or screen flow.
- Start work on an aspect whose Status is `Blocked`.
- Remove an aspect from `SPEC_INDEX.md` without flagging it and getting confirmation first — a
  vanished aspect might mean the Aspect File dropped it, or might mean a misread; treat it as the
  latter until told otherwise.
- Change a dependency silently. Every dependency change gets a Change Log entry: what changed,
  which aspect(s) it affected, and why.
- Follow the Aspect File's own visual/reading order when it conflicts with actual dependencies —
  SRS numbered sections and the architecture's section order are *reading* order, not build order.
- Mark something `Completed` because its files exist, if its own listed dependencies were not
  `Completed` first. Existence is not completion; correct sequencing is part of the definition.
- Claim 100% coverage or "all aspects accounted for" without having actually walked the full Aspect
  File section by section — partial coverage dressed up as complete coverage is worse than an
  honestly incomplete pass.

---

## 7. Working Principle

```text
Aspect File (architecture + SRS)
        ↓
Analyze aspects — every feature, sub-feature, screen, admin module named in the source
        ↓
Identify Parent / Dependent relationships — grounded in the source, not assumed
        ↓
Build the dependency tree
        ↓
Update SPEC_INDEX.md
        ↓
Validate: parent exists → parent comes first → dependencies satisfied
        ↓
Rearrange aspects into a corrected, dependency-true order
        ↓
Derive the User Flow and Screen Flow from that order
        ↓
Implement in dependency order
        ↓
Track progress by updating Status in SPEC_INDEX.md as work actually happens
```

Do not finalize a tree, order, flow, or status change until it has been validated against the
complete Aspect File — not a remembered summary of it.
