# GitHub: pushed, and now automatic

**Status: in sync.** `origin/main` = the workspace, verified by cloning the repository back out.

```
origin/main   aca7109   ← M6.1 code, verified with git ls-remote after the push
              99dac4d   ← this document on top of it
local main    99dac4d   ← identical to the remote; 0 ahead / 0 behind
files         152 tracked (133 source/docs/QA + 19 reference mocks on disk-less uploads/)
tags          module-1-and-2-import · module-2-complete · module-3-complete · module-4-complete
              module-4-ai · module-5-complete · m6-theme-studio · m6-theme-studio-benchmark
              m6.1-theme-studio (5fcaff4)
artifact      WACRM-CMS.html 15,487,295 B · md5 3b6612e18fc6f9c3e81d08b51145d25e
package       wacrm-app.zip 11.4 MB · 113 files — omits the regenerable font source
              and qa/ (STORAGE.md); md5 is printed by every `npm run package`
```

Since then every module has landed the same way and the remote has never drifted: Module 3, Module 4 (builder + AI mode), Module 5 (block library), Module 6 (Theme Studio), the competitive benchmark, and now **Module 6.1** — the type scale, the four new colour roles, the specimen sheet, revision diffs and the 247-family Google Fonts library. The workspace itself went the other way: it had drifted to **119 MB** — the 14 MB font library and the 15.5 MB artifact were each stored in the app folder, in the clone and inside the zip. That layout is fixed (`STORAGE.md`): one copy on disk, a zip that omits what it can regenerate, and repacked history. **119 MB → ~80 MB** with the artifact byte-identical (md5 `3b6612e18fc6…`).

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

## Credential — what is stored, where, and what I cannot protect

**Rotated.** The first token was revoked by the user (verified: `GET /user` → **401**). The current one lives at **`/home/user/.gh-token`** (mode `0600`, outside the repository, installed `2026-11-14T19:44Z`), and **expires Tuesday 17 November 2026** — three days, not two. The date lives in `/home/user/.gh-token-expiry`, so the guard reads the real lifecycle instead of a hard-coded guess.

Scope probe on the live token: `GET /repos/…/hooks`, `/actions/secrets` and `/branches/main/protection` all return **403**, so it is not an administrator credential — it can push contents and little else.

Scripts resolve `GITHUB_TOKEN` → `GH_TOKEN` → that file, and re-apply `0600` on every run, because the workspace snapshot drops file modes (`0600` came back as `0644` once). `checkpoint.sh` warns when **fewer than 12 hours** remain before that date, and prints the regenerate link (`…/personal-access-tokens/22939853/regenerate`) in the same breath.

| Where the string exists | Mitigation |
|---|---|
| `/home/user/.gh-token` (0600, outside the repo) | the only copy on disk; deleted on request, and at expiry by you |
| this chat transcript | unavoidable — the reason the token is short-lived (3 days) |
| the platform snapshot bundle (`hydrate.zip` carries `.gh-token`) | same — bounded by the expiry date, not by where the file sits |
| the git repository, the zip, HANDOVER, logs | **not present** — the pre-commit gate refuses any staged `github_pat_` / `ghp_` / `gho_` / `ghs_` pattern, and `.gitignore` blocks `findgreattoken*`, `*secret*.ts`, `.env*` |

**Rotating before 17 Nov** (takes a minute): open `https://github.com/settings/personal-access-tokens/22939853/regenerate` (your browser session, not mine — the page needs a login and is not an API), then either accept the regenerated value or mint a new fine-grained token: access **only `euromilesofficial/Arena-Agent--WACRM`**, permission **Contents = Read and write**, expiration **3 days**. Then:

```bash
printf '%s' 'github_pat_…' > /home/user/.gh-token && chmod 600 /home/user/.gh-token
printf '%s' '2026-11-20' > /home/user/.gh-token-expiry     # the new date
date -u +%FT%TZ > /home/user/.gh-token-since
```

`checkpoint.sh` keeps pushing with no other change. If the token lapses first, the push fails loudly with a 401 and nothing is lost — the commits are already local and the next checkpoint sends them.

### If you would rather I never store it

Say so and I will delete `/home/user/.gh-token` after this session and stop writing it. The cost is that `checkpoint.sh` cannot push on its own — you would re-supply the token once per session (`GH_TOKEN=… ./checkpoint.sh "msg"`), and everything else — build, mirror, commit, verify — still runs automatically.

## Rules this repository follows

- Commits sit on top of your `main`; the push is always a fast-forward. Nothing is ever force-pushed.
- `node_modules/`, `dist/`, `*.zip`, `*.bundle`, `qa/*.webp`, `qa/*.png` and the credential are ignored — a checkout is source + the built `WACRM-CMS.html` + the mocks, and runs immediately.
- A commit claims green tests only when the suites were run at that commit; the numbers live in the commit message or the tag annotation.
- History rewrites are range-limited (`git filter-branch … -- <base>..main`) so the fast-forward to `origin` survives. A bare `--all` rewrites the root and breaks it.
