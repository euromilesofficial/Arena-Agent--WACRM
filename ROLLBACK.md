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
| `module-3-complete` | Module 3 (Pages & Routes) verified: 105/105 module checks, 40/40 state checks, Module 1–2 regressions still green |
| `module-4-ai` | AI mode in the builder (prompt → page, in-canvas rewrite) verified: `qa_ai.py` 60/60, all suites 475/475 |
| `module-4-complete` | Module 4 (Visual Builder) verified: 97/97 builder checks, 47/47 state checks, 106/106 Module 3, 40/40 + 39/39 + 48/48 state/layout, 38/38 flows |

Going forward: a commit per logical change, and a `module-N-complete` tag the moment a module passes its checks — so "roll back to the last good module" is always one command.

## Safety rules this repo follows

- Never `push --force` to `main` except to undo a mistake you made in the same session (`--force-with-lease`, never bare `--force`).
- `node_modules/` and `dist/` are ignored — a checkout is always source + the built `WACRM-CMS.html`, so any past state is immediately runnable.
- A commit only claims green tests when the harnesses were actually run at that commit; the numbers are recorded in the commit message or the tag annotation.

## Packaging (and how to get a single-file copy of the history)

Two artefacts are built from `/home/user`, both **regenerable at any time** — they are not stored in the workspace because they are byte-for-byte derivable and together cost ~15 MB:

```bash
# the deliverable the user double-clicks (excludes node_modules, dist, .git)
cd /home/user && zip -rq wacrm-app.zip wacrm-app \
  -x "wacrm-app/node_modules/*" "wacrm-app/dist/*" "wacrm-app/.git/*"

# a one-file, clone-able copy of the git history (every commit and tag)
cd /home/user/repo && git bundle create /home/user/wacrm-app.bundle --all
# then, anywhere:  git clone wacrm-app.bundle wacrm
```

The zip is rebuilt after every build. The bundle is only needed when the history has to leave this machine (push is still blocked without a PAT), so build it on demand rather than keeping a stale copy on disk. `git gc --prune=now` in `repo/` after a burst of commits keeps the object store from doubling — it took the store from 18 MB to 9 MB.
