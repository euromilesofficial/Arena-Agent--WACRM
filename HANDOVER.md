# HANDOVER — WACRM Website CMS

> **This file is generated. Do not edit it by hand.**
> Source of truth: `handover.config.json` (intent, decisions, next steps) + live repo facts.
> Regenerate with `npm run handover`; `npm run build` and `npm run qa` do it for you.

**Generated** 2026-11-14 03:44:33 UTC · **generated against commit** `0eb8e03` · **working tree** 2 uncommitted file(s)

Desktop-first SaaS Website CMS, built module by module as a front-end prototype over a simulated backend.

## 1. Start here (10 minutes)

| # | Do this | Why |
| --- | --- | --- |
| 1 | Read HANDOVER.md (this file), then MODULE-4-REVIEW.md §J and STATE-COVERAGE.md. | context |
| 2 | Open WACRM-CMS.html and walk #/overview → #/sites → #/pages → #/builder. | orientation |
| 3 | Run npm run qa and confirm the tallies match the table below. | proves the tree is healthy |
| 4 | Read handover.config.json — that is where intent, decisions and next steps live. | orientation |

**The deliverable** is one file: `WACRM-CMS.html` — open it by double-click. No build, no server, no network, no `node_modules`.

**The stack** React 19 + TypeScript (strict) + Vite 7 + vite-plugin-singlefile; plain CSS design system; no runtime dependencies beyond React; nothing fetched from a CDN, so the artifact works offline from file://.

## 2. Where the project stands

| Module | Screen | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| M1 | Overview | `#/overview` | **done** | qa_states_m1.py 39/39 · qa_flows.py 38/0 |
| M2 | Sites & Domains | `#/sites` | **done** | qa_module2.py 48/48 · state matrix in STATE-COVERAGE.md |
| M3 | Pages & Routes | `#/pages?site=&tab=&q=&page=&sel=` | **done** | qa_pages.py 106/106 · qa_states_m3.py 40/40 |
| M4 | Visual Builder | `#/builder?site=&page=&sel=&lib=&insp=` | **done** | qa_builder.py 97/97 · qa_states_m4.py 47/47 |
| M5 | Block library expansion + CRM integration | `builder` | **awaiting approval** | research delivered, nothing implemented |

- **M1 Overview** — Dashboard grid, 6 KPI drawers, funnel, acquisition, site health, publishing rail, release wizard, rollback.
- **M2 Sites & Domains** — Define.ai-style two-pane registry, create wizard, DNS/SSL verification, archive/restore, domain checks.
- **M3 Pages & Routes** — Registry + tree + inspector, 8 modals, slug/route guards, deep links, trash with restore window.
- **M4 Visual Builder** — 3-panel editor, 19 blocks / 23 sections / 5 templates, drag with refusal reasons, token-bounded style, autosave 2 s + CAS, revisions with block diff + restore, AI copy stream, publish handoff into M1.
- **M5 Block library expansion + CRM integration** — Industry block-library comparison and the WACRM CRM integration plan (forms, WhatsApp CTA, lead capture, scheduling). Awaiting the user's approval and the clean CRM repo copy.

## 3. Build artifact (measured now)

| Property | Value |
| --- | --- |
| File | `WACRM-CMS.html` |
| Size | 1,021,827 B (998 kB) · gzip 361 kB |
| md5 | `5f90c7983302f097e005a0246b33874c` |
| sha256 (first 16) | `2c6507a06c7d8ad1` |
| Built | 2026-11-14 03:28:15 |

Packaged deliverables: `wacrm-app.zip` · `wacrm-app.bundle` — rebuilt after this document was generated, so their hashes are deliberately not recorded here (they would reference this file).

```bash
npm ci
npm run build      # tsc --noEmit && vite build, then copies the single file and regenerates this document
npm run qa         # every Playwright suite, then rewrites qa/last-run.json and this document
npm run dev        # http://localhost:5173 while developing
```

## 4. Verification (last recorded run)

Recorded 2026-11-14 03:43:01 UTC · node v20.20.2. Re-run with `npm run qa`.

| Suite | Passed | Failed | Time | Covers |
| --- | --- | --- | --- | --- |
| `qa_builder.py` | 97 | 0 | 41.5 s | M4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths |
| `qa_states_m4.py` | 47 | 0 | 42.7 s | M4 state matrix |
| `qa_pages.py` | 106 | 0 | 123.6 s | M3 registry, tree, inspector, modals, deep links |
| `qa_states_m3.py` | 40 | 0 | 56.4 s | M3 state matrix |
| `qa_module2.py` | 48 | 0 | 34.4 s | M2 layout, geometry, data consistency |
| `qa_states_m1.py` | 39 | 0 | 45.3 s | M1 state matrix |
| `qa_flows.py` | 38 | 0 | 52.1 s | cross-module interaction script |
| `qa_react.py` | — | 0 | 3.9 s | full-page render, console clean, no overflow |

> All recorded suites are green.

Host prerequisite on a bare Linux container (Chromium will not start without it):

```bash
node --version   # 20+ (built and verified on Node 22/26 types)
npm ci
sudo apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64
pip install playwright pillow
python3 -m playwright install chromium-headless-shell
```

## 5. Where the code lives

Source inventory: **48 source files, 15,301 lines** of TS/TSX/CSS (20,488 lines across all tracked text files).

| Area | Files | Lines | Purpose |
| --- | --- | --- | --- |
| `src/lib/` | 10 | 3,218 | data seams, registries, formatting, no JSX |
| `src/components/` | 28 | 6,549 | reusable UI: shell, ui kit, charts, and per-module parts |
| `src/views/` | 5 | 2,400 | one file per screen; routes are hash-based |
| `src/styles/` | 1 | 3,066 | one tokenised stylesheet (design system) |
| `qa/` | 43 | — | 43 WebP captures of audited states (evidence, not fixtures) |

Top files by size:

| File | Lines |
| --- | --- |
| `src/styles/app.css` | 3,066 |
| `BACKEND-PLAN.md` | 1,317 |
| `src/lib/data.ts` | 974 |
| `src/views/Builder.tsx` | 882 |
| `src/lib/builder.ts` | 824 |
| `src/views/Pages.tsx` | 789 |
| `src/lib/store.tsx` | 569 |
| `src/components/pages/PageModals.tsx` | 552 |
| `src/views/Sites.tsx` | 538 |
| `src/components/builder/Blocks.tsx` | 520 |
| `src/components/Shell.tsx` | 501 |
| `qa_pages.py` | 431 |

## 6. Data seam and contracts

Everything the UI reads goes through one seam per area, so swapping in a real backend is a mechanical change:

| Seam | File | Replaced by |
| --- | --- | --- |
| Shell + M1–M2 data | `src/lib/data.ts` via `src/lib/store.tsx` | `GET /v1/dashboard`, `/v1/sites`, `/v1/releases` |
| M3 pages | `src/lib/cms-pages.ts` | `/v1/pages*`, `/v1/pages/tree` |
| M4 document | `src/lib/builder-db.ts` (`BuilderAPI`) | `/v1/pages/{id}/draft` (CAS), `/revisions`, `/v1/library/*`, `/v1/ai/copy:stream` |

| Document | Section | Covers |
| --- | --- | --- |
| `BACKEND-PLAN.md` | §7.1–§7.18 | every screen surface of M1–M3 mapped to an endpoint |
| `BACKEND-PLAN.md` | §7.19 | builder draft CAS, revisions, library, AI stream, publish handoff |
| `BACKEND-PLAN.md` | §8 | publishing pipeline, compare-and-swap, rollback |
| `STATE-COVERAGE.md` | whole file | every state per module, its trigger and its contract |
| `MODULE-4-REVIEW.md` | §F, §J | the binding builder contract and what shipped |
| `ROLLBACK.md` | whole file | tags and revert recipes |

## 7. Rules and locked decisions

Product rules (non-negotiable, they came from the user):

- One module at a time: the screen, every CTA/dropdown action, and every operation state — nothing ships half-wired.
- Every state must be reachable and code-backed: loading, empty, error, viewer/read-only, conflict, permission denied.
- The artifact must open by double-click: single HTML file, no build, no server, no node_modules, no network.
- Match the approved mock: typography, spacing, alignment, full-screen fit, no empty gaps.
- Never present generated copy as verified fact; no invented claims, no fake analytics.
- Dropdown panels must never span the screen. Non-goals: raw HTML/CSS/JS, repeaters, page-level SEO, marketplace, staging, co-editing.
- Commit and tag every milestone; keep rollback tags; never persist the GitHub token; rebuild the zip on every change.

Decisions already made — do not reopen without the user:

| ID | Decision | Status |
| --- | --- | --- |
| D1 | React 19 + TypeScript + Vite single-file build; vanilla JS rejected. | locked |
| D2 | In-document canvas for the builder (not an iframe sandbox). | locked |
| D3 | Advanced inspector visible but locked (4 groups). | locked |
| D4 | 19 offered block archetypes, 5 inlined generated photos. | locked |
| D5 | Violet #6D4AFF primary, dark sidebar, light #F4F5F7 canvas. | locked |
| D6 | Backend is not built now; every contract is written into BACKEND-PLAN.md instead. | locked |
| D7 | Prototype states are reachable from the beaker menu (Default / Empty / Error / Publish conflict / Viewer). | locked |
| D8 | Deep links are the QA contract: every screen must restore from its hash on a cold load. | locked |

## 8. What is next

**PROBE**

Blocked on:

- User is uploading a clean copy of the CRM repo (the current EuroMiles-WACRM checkout is NOT the review target).
- Push to GitHub needs a fresh PAT (Contents: write) — local commits and tags are complete.

First tasks:

1. Re-clone the clean CRM repo and answer three questions against it: does a form builder exist, what channel/inbox APIs exist, how does a public lead endpoint look.
2. Swap the desktop/tablet/mobile icons to a single drawn family (done in the current build; verify visually after the approval round).
3. Extend the block registry from 19 to the approved set, keeping the computed counts and category chips honest.
4. Add a Forms & Engagement source that reads CRM forms by name instead of a hard-coded form block.
5. Wire the WhatsApp CTA block to the CRM's click-to-chat resolver (token, prefilled message, fallback), with opt-in consent recorded, unchecked by default.

## 9. Traps that cost time last time

- Chrome/Chromium will not launch without the apt batch in environment.bootstrap — that is the container, not the app.
- A hash-only goto does not reload; deep-link assertions must goto() then reload().
- The store rewrites #/<screen> from its own filters after child effects; a screen owning query params must re-assert them on a short timer (builder uses 220 ms).
- The builder's global key handler re-registers dialog listeners mid-dispatch — it must stand down while an overlay owns Escape.
- QA counts that depend on a library tab are only valid after switching to that tab (#wb-tab-blocks).
- Screenshots are WebP only; the workspace is capped at 128 MB and pruned dependency folders do not persist.
- The zip must be built with: zip -rq wacrm-app.zip wacrm-app -x 'wacrm-app/node_modules/*' 'wacrm-app/dist/*' 'wacrm-app/.git/*'.
- git commit fails with 'Author identity unknown' until a repo-local user.name/user.email is set.
- The sandbox drops .git/config between turns, so the origin URL has to be re-added before a push.

## 10. Repository state and rollback

- Repo: that git directory is `.`; branch `main`; HEAD `0eb8e03` — Handover: regenerate after the amend.
- Working tree: 2 uncommitted file(s).
- Remote: **none configured** — add one before pushing (`git remote add origin <url>`).
- Tags: `module-4-complete` · `module-3-complete` · `module-1-and-2-import` · `module-2-complete`.

| Commit | Date | Subject |
| --- | --- | --- |
| `0eb8e03` | 2026-11-14 | Handover: regenerate after the amend |
| `ea0fd16` | 2026-11-14 | Handover: keep --check stable across amends |
| `ae3441c` | 2026-11-14 | Handover: label the header 'generated against commit' and prove --check is stable |
| `1ff3cd8` | 2026-11-14 | Automate the handover: generated HANDOVER.md, QA evidence, pre-commit gate |
| `f2ff414` | 2026-11-14 | Builder: draw a real monitor / tablet / phone icon family for the device switch |
| `6e8749e` | 2026-11-14 | Module 4: Visual Builder — 3-panel editor, autosave + CAS, revisions, AI copy |
| `5add3bb` | 2026-11-14 | Add Module 4 (Visual Builder) review: contract defects, 13 decisions, 12 gaps, cross-module wiring |
| `d32dfc1` | 2026-11-14 | Module 3: Pages & Routes — 3-pane registry, 8 modals, guards, deep links |
| `d2dd7db` | 2026-11-13 | Add Module 3 (Pages) spec review: conflicts, gaps, decisions |
| `2d68957` | 2026-11-13 | Ship ROLLBACK.md with the app; rebuild the zip on every checkpoint |
| `b8cb5c2` | 2026-11-13 | Add ROLLBACK.md and checkpoint tags |
| `203abcf` | 2026-11-13 | Add QA harnesses and reference screenshots |

Rollback recipes live in `ROLLBACK.md`; the short version: `git revert <sha>`, `git revert <tag>..HEAD`, or `git show <tag>:WACRM-CMS.html > old.html`.

## 11. Definition of done (apply to every change)

1. The screen works for every CTA and dropdown, in every state listed in STATE-COVERAGE.md.
2. tsc --noEmit is clean and the suite for the module is green; no earlier suite regressed.
3. No horizontal overflow at 1280 / 1440 / 1920.
4. BACKEND-PLAN.md carries a contract row for every new control.
5. The commit is tagged module-N-complete, HANDOVER.md is regenerated, and the zip is rebuilt.

---

_How this document is produced:_ `handover.config.json` holds intent; `scripts/handover.mjs` measures the repository (git, artifact hashes, inventory, QA tallies) and writes this file; `scripts/qa-all.mjs` runs every suite and records `qa/last-run.json`; `npm run build` and `npm run qa` both regenerate it, and `.githooks/pre-commit` refreshes and stages it so a commit can never carry a stale handover.
