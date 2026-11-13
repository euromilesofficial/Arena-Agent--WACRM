# Rollback

Every milestone is a commit on `main` **and** an annotated tag, so there is always a named state to return to.

```
git tag -l                 # module-2-complete, module-1-and-2-import, …
git log --oneline --decorate
```

## The three ways back

**1. Undo one commit, keep everything after it** — normal case when you dislike a specific change.

```bash
git log --oneline                 # find the commit
git revert <sha>                  # creates an inverse commit, history stays intact
git push origin main
```

Surgical version — restore a single file to how it looked in a checkpoint:

```bash
git checkout module-2-complete -- src/views/Sites.tsx
git commit -am "Restore Sites.tsx to the module-2 layout"
```

**2. Roll the whole app back to a checkpoint** — when a later module made things worse overall.

```bash
git diff module-2-complete..main --stat        # what would be lost
git revert --no-commit module-2-complete..HEAD # undo everything after it
git commit -m "Roll back to module-2-complete"
git push origin main
```

`revert` is preferred over `reset --hard`: it keeps the discarded work in history, so nothing is unrecoverable. If you genuinely want the branch to *look* like the old state:

```bash
git reset --hard module-2-complete && git push --force-with-lease origin main
```

**3. Just look at an old build** — no git knowledge needed.

```bash
git show module-2-complete:WACRM-CMS.html > ~/Desktop/WACRM-module-2.html
```

That file is the complete, self-contained app as it shipped at that checkpoint — double-click it and the old UI runs, with its own data.

## What each checkpoint means

| Tag | State |
| --- | --- |
| `module-1-and-2-import` | Module 1 (Overview) + Module 2 (Sites & Domains) as first committed — landed together because the Module 2 rebuild rewrote the same files |
| `module-2-complete` | Module 2 rebuild verified: 48/48 layout, 25/25 Module 2 states, 39/39 Module 1 states, 38/38 flows |

Going forward: a commit per logical change, and a `module-N-complete` tag the moment a module passes its checks — so "roll back to the last good module" is always one command.

## Safety rules this repo follows

- Never `push --force` to `main` except to undo a mistake you made in the same session (`--force-with-lease`, never bare `--force`).
- `node_modules/` and `dist/` are ignored — a checkout is always source + the built `WACRM-CMS.html`, so any past state is immediately runnable.
- A commit only claims green tests when the harnesses were actually run at that commit; the numbers are recorded in the commit message or the tag annotation.
