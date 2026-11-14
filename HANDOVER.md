# HANDOVER — WACRM Website CMS

> **This file is generated. Do not edit it by hand.**
> Source of truth: `handover.config.json` (intent, decisions, next steps) + live repo facts.
> Regenerate with `npm run handover`; `npm run build` and `npm run qa` do it for you.

**Generated** 2026-11-14 06:58:06 UTC · **generated against commit** `307a294` · **working tree** 57 uncommitted file(s)

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
| M5 | Block library expansion + CRM integration | `builder` | **review delivered — awaiting approval** | MODULE-5-REVIEW.md (nothing implemented) |

- **M1 Overview** — Dashboard grid, 6 KPI drawers, funnel, acquisition, site health, publishing rail, release wizard, rollback.
- **M2 Sites & Domains** — Define.ai-style two-pane registry, create wizard, DNS/SSL verification, archive/restore, domain checks.
- **M3 Pages & Routes** — Registry + tree + inspector, 8 modals, slug/route guards, deep links, trash with restore window.
- **M4 Visual Builder** — 3-panel editor, 19 blocks / 23 sections / 5 templates, drag with refusal reasons, token-bounded style, autosave 2 s + CAS, revisions with block diff + restore, AI copy stream, publish handoff into M1.
- **M5 Block library expansion + CRM integration** — Industry block-library comparison (19 offered vs ~40 Elementor free / ~60 Webflow / 90+ Gutenberg / 25+ HubSpot) + the CRM integration map. Proposal: 19 → 38 offered blocks in 8 chips, 23 → 32 sections, 5 → 7 templates, plus a Forms module (Module 6). Verdict on the CRM: no web form builder exists — there is a WhatsApp Flows builder, a custom-fields registry (19 types × 6 entities) and four narrow capture points; recommended path is a CMS-side Forms module writing leads + consent into the CRM. §11 of the review explains D1–D6 mechanically and proposes flipping the order: forms/lead-capture spine first, interlink surfaces second, palette expansion third.

## 3. Build artifact (measured now)

| Property | Value |
| --- | --- |
| File | `WACRM-CMS.html` |
| Size | 1,042,053 B (1018 kB) · gzip 367 kB |
| md5 | `119b71ca861482e33f3ea468629dd44a` |
| sha256 (first 16) | `904cf420c6e5e625` |
| Built | 2026-11-14 06:57:02 |

Packaged deliverables: `wacrm-app.zip` · `wacrm-app.bundle` — rebuilt after this document was generated, so their hashes are deliberately not recorded here (they would reference this file).

```bash
npm ci
npm run build      # tsc --noEmit && vite build, copies the single file, regenerates this document, rebuilds wacrm-app.zip
npm run qa         # every Playwright suite, then rewrites qa/last-run.json and this document
npm run dev        # http://localhost:5173 while developing
```

## 4. Verification (last recorded run)

Recorded 2026-11-14 06:32:36 UTC · node v20.20.2. Re-run with `npm run qa`.

| Suite | Passed | Failed | Time | Covers |
| --- | --- | --- | --- | --- |
| `qa_ai.py` | 60 | 0 | 34.4 s | AI mode: composer, page generation, section, rewrite, 5 failure states, empty-page round trip |
| `qa_builder.py` | 97 | 0 | 42.4 s | M4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths |
| `qa_states_m4.py` | 47 | 0 | 43.6 s | M4 state matrix |
| `qa_pages.py` | 106 | 0 | 121.2 s | M3 registry, tree, inspector, modals, deep links |
| `qa_states_m3.py` | 40 | 0 | 56.7 s | M3 state matrix |
| `qa_module2.py` | 48 | 0 | 34.8 s | M2 layout, geometry, data consistency |
| `qa_states_m1.py` | 39 | 0 | 45.7 s | M1 state matrix |
| `qa_flows.py` | 38 | 0 | 59.1 s | cross-module interaction script |
| `qa_react.py` | — | 0 | 4.4 s | full-page render, console clean, no overflow |

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

Source inventory: **50 source files, 15,858 lines** of TS/TSX/CSS (22,425 lines across all tracked text files).

| Area | Files | Lines | Purpose |
| --- | --- | --- | --- |
| `src/lib/` | 10 | 3,327 | data seams, registries, formatting, no JSX |
| `src/components/` | 29 | 6,747 | reusable UI: shell, ui kit, charts, and per-module parts |
| `src/views/` | 5 | 2,536 | one file per screen; routes are hash-based |
| `src/styles/` | 1 | 3,160 | one tokenised stylesheet (design system) |
| `qa/` | 0 | — | 0 WebP captures of audited states (evidence, not fixtures) |

Top files by size:

| File | Lines |
| --- | --- |
| `src/styles/app.css` | 3,160 |
| `BACKEND-PLAN.md` | 1,338 |
| `src/views/Builder.tsx` | 1,018 |
| `src/lib/data.ts` | 974 |
| `src/lib/builder.ts` | 824 |
| `src/views/Pages.tsx` | 789 |
| `src/lib/store.tsx` | 569 |
| `src/components/pages/PageModals.tsx` | 552 |
| `src/views/Sites.tsx` | 538 |
| `src/components/builder/Blocks.tsx` | 520 |
| `src/components/Shell.tsx` | 501 |
| `src/lib/builder-db.ts` | 460 |

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
| `MODULE-5-REVIEW.md` | §2, §4, §8 | forms verdict, block benchmark, proposed palette and endpoints |
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
- Every build ships a zip: `npm run build` ends with `scripts/package.mjs`, which rewrites /home/user/wacrm-app.zip and verifies the WACRM-CMS.html inside it matches the fresh build.
- Pushing to GitHub needs a credential that this sandbox does not have — run /home/user/push-to-github.sh with GITHUB_TOKEN, or hand over wacrm-app.bundle. See PUSH-TO-GIT.md.

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
| D13 | undefined | undefined |
| D14 | undefined | undefined |

## 8. What is next

**Build the forms spine — the CMS form row, the public submit endpoint contract, consent records and the cms_form source filter on trigger.lead.created. Decisions are closed: see INTERLINK-PLAN.md.**

Blocked on:

- Push to GitHub: needs a write credential (run /home/user/push-to-github.sh with GITHUB_TOKEN, or merge wacrm-app.bundle by hand — see PUSH-TO-GIT.md). Local history is complete: 18 commits ahead of origin/main, 0 behind.

First tasks:

1. Build Module 5 forms: forms list + 3-panel form builder + consent block + public submit + source attribution + submissions index (counts only, no PII in the CMS).
2. Ship the Form and WhatsApp CTA blocks with it: together they complete capture → CRM → automation.
3. Write BACKEND-PLAN.md §7.20 (cms_forms, submit, consent, page stats, automation suggestions, publish snapshot) before the code.
4. Extend the Automation group in the inspector: per-block declared contract + 'Suggest a workflow' handoff into Module 2.
5. Module 6: Integrations pane.

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
- The clean CRM copy (commit c07cbb6) has no CMS module and no GrapesJS — do not look for cms routes or a second editor; the React builder here is the only CMS.
- Workspace snapshots and copies drop the execute bit on .githooks/pre-commit — after any restore run chmod +x .githooks/pre-commit and git update-index --chmod=+x .githooks/pre-commit, or git silently ignores the hook.
- [object Object]
- [object Object]
- [object Object]
- [object Object]
- [object Object]
- [object Object]
- [object Object]

## 10. Repository state and rollback

- Repo: that git directory is `.`; branch `main`; HEAD `307a294` — chore: restore execute bits (lost on copy).
- Working tree: 57 uncommitted file(s).
- Remote: **none configured** — add one before pushing (`git remote add origin <url>`).
- Tags: `module-4-ai` · `module-4-complete` · `module-3-complete` · `module-1-and-2-import` · `module-2-complete`.

| Commit | Date | Subject |
| --- | --- | --- |
| `307a294` | 2026-11-14 | chore: restore execute bits (lost on copy) |
| `fdf0695` | 2026-11-14 | assets: bring the reference mocks into version control (16 images + manifest) |
| `e741b9a` | 2026-11-14 | docs: ship PUSH-TO-GIT.md inside the deliverable and index it in the README |
| `e6d8f58` | 2026-11-14 | chore: restore pre-commit hook execute bit (mode is lost by every copy) |
| `67aa7ea` | 2026-11-14 | build: every build now ships a verified zip; add push tooling |
| `9cac731` | 2026-11-14 | docs: record the packaging commands; bundle is now built on demand (workspace budget) |
| `3eaad5e` | 2026-11-14 | chore: regenerate HANDOVER.md |
| `c330068` | 2026-11-14 | polish: AI Copy toolbar pill contrast (violet tint, pressed-state fill) |
| `070bc5a` | 2026-11-14 | module 4: AI mode in the builder — prompt-to-page generation, plan-then-compose, in-canvas rewrite |
| `c767062` | 2026-11-14 | Handover: record the hook execute-bit trap |
| `4e5b188` | 2026-11-14 | Restore the pre-commit hook's execute bit |
| `2025d0a` | 2026-11-14 | Module 5 review: explain D1-D6 mechanically and propose the spine-first order |

Rollback recipes live in `ROLLBACK.md`; the short version: `git revert <sha>`, `git revert <tag>..HEAD`, or `git show <tag>:WACRM-CMS.html > old.html`.

## 11. Definition of done (apply to every change)

1. The screen works for every CTA and dropdown, in every state listed in STATE-COVERAGE.md.
2. tsc --noEmit is clean and the suite for the module is green; no earlier suite regressed.
3. No horizontal overflow at 1280 / 1440 / 1920.
4. BACKEND-PLAN.md carries a contract row for every new control.
5. The commit is tagged module-N-complete, HANDOVER.md is regenerated, and the zip is rebuilt.

---

_How this document is produced:_ `handover.config.json` holds intent; `scripts/handover.mjs` measures the repository (git, artifact hashes, inventory, QA tallies) and writes this file; `scripts/qa-all.mjs` runs every suite and records `qa/last-run.json`; `npm run build` and `npm run qa` both regenerate it, and `.githooks/pre-commit` refreshes and stages it so a commit can never carry a stale handover.
