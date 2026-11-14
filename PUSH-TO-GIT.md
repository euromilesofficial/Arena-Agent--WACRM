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

## Credential — what is stored, where, and what I cannot protect

The token is at **`/home/user/.gh-token`** (mode `0600`, outside the repository). Scripts resolve `GITHUB_TOKEN` → `GH_TOKEN` → that file, and enforce the `0600` on every run because file modes are **not preserved** by the workspace snapshot — it came back as `0644` once already.

**Where the string exists right now — all of it:**

| Location | Consequence |
|---|---|
| `/home/user/.gh-token` | readable by anything running in this sandbox; the only copy I control |
| **the conversation transcript** | it was pasted in chat — this is the exposure that matters, and it cannot be undone |
| **the platform's snapshot bundle** (`/tmp/arena-workspace/hydrate.zip` contains `.gh-token`) | any workspace snapshot includes it, because it is a file in the workspace |
| the git repository, the zip, HANDOVER, logs | **not present** — verified by grep; a pre-commit gate now blocks any commit containing a `github_pat_`/`ghp_`/`gho_`/`ghs_` pattern |

That is the honest picture: I never send the token anywhere except `github.com`, never print it (every command scrubs it to `***`), and never write it into the repo — but **I cannot make a token that has already transited a chat "safe from the outside world."** Once it is in a transcript and a snapshot, it should be treated as known.

### The fix, and it takes a minute

1. **Settings → Developer settings → Fine-grained tokens → revoke** the current token.
2. Create a new one: **repository access: only `euromilesofficial/Arena-Agent--WACRM`**, **permissions: Contents = Read and write** (nothing else), **expiration: 30–90 days**.
3. Paste it once; it replaces the file. `checkpoint.sh` keeps working unchanged.

Rotating means the copy in this transcript, in old snapshots, and in anyone's shell history stops being able to do anything at all. That is the only durable protection; everything else is damage reduction.

### If you would rather I never store it

Say so and I will delete `/home/user/.gh-token` after this session and stop writing it. The cost is that `checkpoint.sh` cannot push on its own — you would re-supply the token once per session (`GH_TOKEN=… ./checkpoint.sh "msg"`), and everything else — build, mirror, commit, verify — still runs automatically.

## Rules this repository follows

- Commits sit on top of your `main`; the push is always a fast-forward. Nothing is ever force-pushed.
- `node_modules/`, `dist/`, `*.zip`, `*.bundle`, `qa/*.webp`, `qa/*.png` and the credential are ignored — a checkout is source + the built `WACRM-CMS.html` + the mocks, and runs immediately.
- A commit claims green tests only when the suites were run at that commit; the numbers live in the commit message or the tag annotation.
- History rewrites are range-limited (`git filter-branch … -- <base>..main`) so the fast-forward to `origin` survives. A bare `--all` rewrites the root and breaks it.
