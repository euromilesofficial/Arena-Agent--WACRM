# GitHub: pushed, and now automatic

**Status: in sync.** `origin/main` = the workspace, verified by cloning the repository back out.

```
origin/main   95d3f16   ← matches /home/user/repo exactly
files         107       (88 source/docs/QA + 19 reference mocks)
tags          module-1-and-2-import · module-2-complete · module-3-complete · module-4-complete · module-4-ai
round trip    fresh clone → WACRM-CMS.html md5 119b71ca… (identical) · uploads/EuroMiles…webp sha 7b51c952… (matches MANIFEST)
```

Before the credential arrived, GitHub held only `d2dd7db` — your Module 3 *spec review*. The 30 commits after it (Module 3's build, the whole Module 4 builder, the interlink plan, AI mode, the packaging automation, the WebP mocks) were local-only. They are now on `main`.

---

## The automatic process

Every task ends the same way, with one command:

```bash
/home/user/checkpoint.sh "what changed" [optional-tag]
```

It does, in order:

1. **Build** — `npm run build` (tsc → vite → single file → HANDOVER → zip) when `node_modules` exists; otherwise it regenerates HANDOVER and the zip directly.
2. **Mirror** — `wacrm-app/` is copied into the clone at `repo/` (`node_modules`, `dist` and generated QA screenshots excluded), along with `PUSH-TO-GIT.md`. The execute bits on `.githooks/pre-commit` and `push-to-github.sh` are re-applied after every copy, because tar preserves whatever mode the source had and a non-executable hook is silently skipped.
3. **Commit** — the pre-commit hook regenerates `HANDOVER.md` and refuses any commit that stages deletions under `uploads/`; an empty change set is a no-op, not a failure.
4. **Push** — fetches `origin`, **refuses a non-fast-forward**, pushes `main` and **all tags**, then compares the remote head with the local head and fails loudly if they differ.

Two smaller entry points do one half each: `push-to-github.sh` (push only) and `npm run package` (zip only).

## Credential

The token lives at **`/home/user/.gh-token`**, mode `0600`, outside the repository, and `.gh-token` / `*.token` are in `.gitignore`. Scripts resolve `GITHUB_TOKEN` → `GH_TOKEN` → that file, and the value is only ever interpolated into the single `git push` / `git ls-remote` URL for that command: it is never written into `.git/config`, a remote URL, a log, or a commit. Every command that prints the URL scrubs the token to `***` first.

Since a token has now been shared in a chat window, treat it as exposed: rotate it at **Settings → Developer settings → Fine-grained tokens** when convenient, and drop the new value into the same file — nothing else needs to change. Scope it to this one repository with **Contents: Read and write**; nothing here needs more.

## Rules this repository follows

- Commits sit on top of your `main`; the push is always a fast-forward. Nothing is ever force-pushed.
- `node_modules/`, `dist/`, `*.zip`, `*.bundle`, `qa/*.webp`, `qa/*.png` and the credential are ignored — a checkout is source + the built `WACRM-CMS.html` + the mocks, and runs immediately.
- A commit claims green tests only when the suites were run at that commit; the numbers live in the commit message or the tag annotation.
- History rewrites are range-limited (`git filter-branch … -- <base>..main`) so the fast-forward to `origin` survives. A bare `--all` rewrites the root and breaks it.
