# Branching Strategy

This project uses **GitHub Flow**: `main` is always deployable. All work
happens on short-lived branches off `main` and lands back via pull request.
There is no long-lived `develop` branch.

```
main   ──●──●──●──●──●──●──►
          \      \    /
       feature/x  feature/y  (PR → squash-merge → main)
```

## Branch naming

| Prefix       | Purpose                                  | Example                          |
|--------------|-------------------------------------------|-----------------------------------|
| `feature/`   | New functionality                        | `feature/design-catalog-search`   |
| `fix/`       | Non-urgent bug fix                       | `fix/cart-total-rounding`         |
| `hotfix/`    | Urgent production fix, branched off `main` and merged straight back | `hotfix/checkout-500-error` |
| `chore/`     | Tooling, deps, config, CI, docs          | `chore/update-eslint-config`      |
| `spike/`     | Throwaway exploration, not meant to merge as-is | `spike/websocket-notifications` |

Use short, kebab-case, present-tense descriptions. Reference an issue/spec
number when one exists, e.g. `feature/17-services-module`.

## Workflow

1. Branch off the latest `main`:
   ```
   git checkout main
   git pull
   git checkout -b feature/short-description
   ```
2. Commit small, working increments. Write commit messages that explain
   *why*, not just *what*.
3. Push the branch and open a PR against `main` as soon as it's reviewable
   (draft PRs are fine for work-in-progress).
4. Keep the branch current with `main` (`git pull --rebase origin main` or
   merge `main` in) rather than letting it drift.
5. Squash-merge once approved and CI is green. Delete the branch after
   merge (GitHub can do this automatically — see below).
6. `main` should be deployable at every commit. If something breaks it,
   the fix is a `hotfix/` branch, not a revert-and-hope.

## Commit messages

Short imperative summary line (≤ 72 chars), blank line, then the "why" if
it isn't obvious from the diff. No need to restate the file list — the
diff already shows that.

## Pull requests

- One logical change per PR. Prefer several small PRs over one large one.
- PR description should say what changed and why, plus a test plan.
- At least one review approval required before merging (see branch
  protection below).
- CI (once configured) must pass before merge.

## Recommended GitHub repo settings

These aren't set from the CLI in this environment (no `gh` available), so
configure them once in **Settings → Branches → Branch protection rules**
for `main`:

- [ ] Require a pull request before merging (no direct pushes to `main`)
- [ ] Require at least 1 approving review
- [ ] Require status checks to pass before merging (once CI exists)
- [ ] Require branches to be up to date before merging
- [ ] Automatically delete head branches after merge
  (**Settings → General → Pull Requests**)

## Releases / hotfixes

Because `main` is always deployable, a release is just "what's currently
on `main`" (or a tag on it, e.g. `v1.2.0`, once versioning matters).
Production incidents get a `hotfix/*` branch cut from `main`, fixed,
reviewed, and merged the same way — no separate release branch needed at
this stage. If the project later needs staged environments (e.g. a
`staging` branch mirroring a QA deployment), add it then rather than
pre-building for it now.
