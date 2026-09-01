# Post-Migration Checklist — Run Once cz-digitizing-ef Signals Safe

Sequential runbook for closing out the plan approved this session
(`Close Out the Application Skeleton + Spec 01 (Auth)`). Every command is exact and copy-pasteable
— no placeholders. Stop and report back if any step fails; don't skip ahead.

---

## 0. Confirm it's actually safe

- [ ] Re-check no other session is mid-edit right now:
  ```
  ListAgents
  ```
- [ ] Pull in whatever `cz-digitizing-ef` committed:
  ```
  git fetch origin
  git status
  git log --oneline -10
  ```
- [ ] If they committed locally (not pushed) rather than to origin, confirm with them directly
  before assuming the working tree reflects their finished state.

## 1. Run the migration (corrected command)

Do **not** use `pnpm --filter api prisma:migrate -- --name init` — that's the command that hung on
an interactive prompt earlier (the `pnpm run` wrapper mangled `--name init`). Use `exec` instead:

```
pnpm --filter api exec prisma migrate dev --name init
```

- [ ] If it fails again with `P1002` (advisory lock timeout), something is still holding the lock
  — check for stray node/prisma processes before retrying, don't just re-run blindly:
  ```powershell
  Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Select-Object Id, ProcessName, StartTime
  ```

## 2. Validate the schema landed correctly

```powershell
$env:PGPASSWORD = "dev"
& "C:\Program Files\PostgreSQL\14\bin\psql.exe" -U dev -h localhost -p 5432 -d czdigitizing -f apps/api/prisma/validate-schema.sql
Remove-Item Env:\PGPASSWORD
```

- [ ] Confirm the final output line is `Schema validation PASSED` — if it's `FAILED`, stop and
  read which item is missing before continuing.

## 3. Verify Memurai for real (not just "looks configured")

Two earlier "it's configured" reports didn't match reality — actually check all three:

```powershell
Get-Service | Where-Object {$_.Name -like "*memurai*"} | Format-Table Name, Status, DisplayName -AutoSize
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 6379}
winget list --id Memurai.MemuraiDeveloper
```

- [ ] Service status is `Running`, a listener exists on 6379, and winget shows it installed. If
  any of the three is missing, it is **not** done — reinstall with
  `winget install -e --id Memurai.MemuraiDeveloper` in an elevated PowerShell before proceeding.

## 4. Full workspace sanity pass

```
pnpm install
pnpm build
pnpm typecheck
pnpm lint
```

- [ ] All four exit 0 across every app/package in the Turborepo. Fix any failure before moving on
  — don't skip lint/typecheck errors as "pre-existing."

## 5. Boot smoke test

```
pnpm dev
```

- [ ] `apps/api` boots clean (no crash on startup with the full `AppModule` — auth/admin/audit/
  email/redis all wired in) and `GET http://localhost:4000/health` returns `200`.
- [ ] `apps/web` (`:3000`) and `apps/admin` (`:3002`) placeholder pages load and show the API
  health status as reachable (green, not the "unreachable" fallback).

## 6. Run the existing test suite

```
pnpm --filter api test
pnpm --filter api test:integration
```

- [ ] Unit specs pass: `password.service.spec.ts`, `token.service.spec.ts`,
  `session.service.spec.ts`, `totp.service.spec.ts`, `verification-code.service.spec.ts`.
- [ ] `apps/api/test/integration/auth.spec.ts` passes against the now-real database — this is the
  first time it's ever been run against real infra.
- [ ] Fix real failures. Don't loosen assertions to force a pass.

## 7. Fold in the drafted gap tests (optional but recommended)

`docs/specs/testing/auth-signup-login-validation.draft.spec.ts` and `auth-mock-payloads.ts` cover
three real gaps the existing suite doesn't (wrong-password login, non-existent-email login,
DTO-validation errors on register/login) — see that file's header for details.

- [ ] Move both into `apps/api/test/` (suggested: `integration/auth-validation.spec.ts` +
  `fixtures/auth.fixtures.ts`), fix the import paths (they're written as drafts with placeholder
  relative paths), add to `apps/api/test/jest-integration.json` if it's an explicit file list.
- [ ] Decide whether to fix the `fieldFromMessage()` "property" quirk flagged in that draft's
  header, or accept it as-is — either way, don't let the test silently paper over it.
- [ ] Re-run step 6 after merging these in.

## 8. Trace the 12 acceptance criteria

- [ ] Walk `docs/specs/2026-08-28-01-auth-account-security.md` §2 AC-1 through AC-12 against
  `AuthController`/`AuthService` and the now-passing test suite. Record which test(s) cover each
  AC (the spec's own traceability convention: test names matching the AC number). Flag anything
  stubbed or missing rather than assuming coverage from file existence alone.

## 9. Commit in logical, separated commits

Per `docs/BRANCHING.md` — not one giant commit. Suggested grouping (adjust to how the diff
actually falls):
- [ ] `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/` (the migration itself)
- [ ] `apps/api/src/auth/**`, `apps/api/src/common/**` (auth module + guards/filters/interceptors)
- [ ] `apps/api/src/admin/**`, `apps/api/src/audit/**`, `apps/api/src/email/**`,
  `apps/api/src/redis/**` (supporting modules)
- [ ] `apps/api/src/**/*.spec.ts`, `apps/api/test/**` (tests)
- [ ] `pnpm-lock.yaml` (whichever commit first needs the updated lockfile)
- [ ] Separately: the two already-fixed, unstaged doc files (`docs/CLAUDE.md`,
  `docs/specs/USER_FLOW.md`) and the new `docs/specs/testing/` drafts — docs-only, not blocked by
  any of the above, can go in their own commit whenever.

Review before staging each — `git status` / `git diff` — since none of this has been looked at
file-by-file yet:
```
git status
git diff -- apps/api/prisma/schema.prisma
```

## 10. Update SPEC_INDEX.md and open the PR

- [ ] `docs/specs/SPEC_INDEX.md`: A-002 Status `In Progress` → `Completed`, **only** after steps 6
  and 8 actually passed — not because the files exist (`docs/CLAUDE.md` §5/§6).
- [ ] Push the branch, open a PR to `main` per `docs/BRANCHING.md`.

---

**Go/no-go gates, if short on time:** step 2's strict pass/fail block, step 6's test suite exit
code, and step 5's `/health` round-trip are the three checks that actually determine whether this
is safe to call done — the rest is thoroughness on top of those three.
