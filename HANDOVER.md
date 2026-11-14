# HANDOVER — WACRM Website CMS

> **This file is generated. Do not edit it by hand.**
> Source of truth: `handover.config.json` (intent, decisions, next steps) + live repo facts.
> Regenerate with `npm run handover`; `npm run build` and `npm run qa` do it for you.

**Generated** 2026-11-14 04:06:25 UTC · **generated against commit** `b71a563` · **working tree** 1 uncommitted file(s)

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
- **M5 Block library expansion + CRM integration** — Industry block-library comparison (19 offered vs ~40 Elementor free / ~60 Webflow / 90+ Gutenberg / 25+ HubSpot) + the CRM integration map. Proposal: 19 → 38 offered blocks in 8 chips, 23 → 32 sections, 5 → 7 templates, plus a Forms module (Module 6). Verdict on the CRM: no web form builder exists — there is a WhatsApp Flows builder, a custom-fields registry (19 types × 6 entities) and four narrow capture points; recommended path is a CMS-side Forms module writing leads + consent into the CRM.

## 3. Build artifact (measured now)

| Property | Value |
| --- | --- |
| File | `WACRM-CMS.html` |
| Size | 1,021,844 B (998 kB) · gzip 361 kB |
| md5 | `e5853efc3fd48af73798c280f017f585` |
| sha256 (first 16) | `4f927f9573c7c7d6` |
| Built | 2026-11-14 03:59:01 |

Packaged deliverables: `wacrm-app.zip` · `wacrm-app.bundle` — rebuilt after this document was generated, so their hashes are deliberately not recorded here (they would reference this file).

```bash
npm ci
npm run build      # tsc --noEmit && vite build, then copies the single file and regenerates this document
npm run qa         # every Playwright suite, then rewrites qa/last-run.json and this document
npm run dev        # http://localhost:5173 while developing
```

## 4. Verification (last recorded run)

Recorded 2026-11-14 04:06:05 UTC · node v20.20.2. Re-run with `npm run qa`.

| Suite | Passed | Failed | Time | Covers |
| --- | --- | --- | --- | --- |
| `qa_builder.py` | 97 | 0 | 41.7 s | M4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths |
| `qa_states_m4.py` | 47 | 0 | 43.7 s | M4 state matrix |
| `qa_pages.py` | 106 | 0 | 122.1 s | M3 registry, tree, inspector, modals, deep links |
| `qa_states_m3.py` | 40 | 0 | 56.6 s | M3 state matrix |
| `qa_module2.py` | 48 | 0 | 34.7 s | M2 layout, geometry, data consistency |
| `qa_states_m1.py` | 39 | 0 | 45.3 s | M1 state matrix |
| `qa_flows.py` | 38 | 0 | 55.9 s | cross-module interaction script |
| `qa_react.py` | — | 0 | 4.1 s | full-page render, console clean, no overflow |

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

Source inventory: **48 source files, 15,301 lines** of TS/TSX/CSS (20,977 lines across all tracked text files).

| Area | Files | Lines | Purpose |
| --- | --- | --- | --- |
| `src/lib/` | 10 | 3,218 | data seams, registries, formatting, no JSX |
| `src/components/` | 28 | 6,549 | reusable UI: shell, ui kit, charts, and per-module parts |
| `src/views/` | 5 | 2,400 | one file per screen; routes are hash-based |
| `src/styles/` | 1 | 3,066 | one tokenised stylesheet (design system) |
| `qa/` | 44 | — | 44 WebP captures of audited states (evidence, not fixtures) |

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

**Approve MODULE-5-REVIEW.md (D1–D6, or 'defaults'), then build Module 5 (block palette), then Module 6 (Forms).**

Blocked on:

- User approval of D1–D6 in MODULE-5-REVIEW.md §6 — nothing is implemented by design.
- Push to GitHub still needs a fresh PAT (Contents: write); local commits and tags are complete.

First tasks:

1. If approved: extend the block registry 19 → 38 offered in 8 chips (counts stay computed and QA-asserted).
2. Add the 7 CRM-native blocks, each with an empty state that names the missing CRM object and links to it.
3. Grow sections 23 → 32 and templates 5 → 7.
4. Build Module 6: #/forms list + 3-panel form builder + submissions, then the Form (CRM) block that lists forms by name.
5. Write BACKEND-PLAN.md §7.20 (forms, consent, WhatsApp CTA, widget embed, booking, products) before the code.

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

## 10. Repository state and rollback

- Repo: that git directory is `.`; branch `main`; HEAD `b71a563` — Module 5 review: block library vs the industry, and what the CRM actually has.
- Working tree: 1 uncommitted file(s).
- Remote: **none configured** — add one before pushing (`git remote add origin <url>`).
- Tags: `module-4-complete` · `module-3-complete` · `module-1-and-2-import` · `module-2-complete`.

| Commit | Date | Subject |
| --- | --- | --- |
| `b71a563` | 2026-11-14 | Module 5 review: block library vs the industry, and what the CRM actually has |
| `e8b3e7b` | 2026-11-14 | Handover: make the document self-reference-free |
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

Rollback recipes live in `ROLLBACK.md`; the short version: `git revert <sha>`, `git revert <tag>..HEAD`, or `git show <tag>:WACRM-CMS.html > old.html`.

## 11. Definition of done (apply to every change)

1. The screen works for every CTA and dropdown, in every state listed in STATE-COVERAGE.md.
2. tsc --noEmit is clean and the suite for the module is green; no earlier suite regressed.
3. No horizontal overflow at 1280 / 1440 / 1920.
4. BACKEND-PLAN.md carries a contract row for every new control.
5. The commit is tagged module-N-complete, HANDOVER.md is regenerated, and the zip is rebuilt.

---

_How this document is produced:_ `handover.config.json` holds intent; `scripts/handover.mjs` measures the repository (git, artifact hashes, inventory, QA tallies) and writes this file; `scripts/qa-all.mjs` runs every suite and records `qa/last-run.json`; `npm run build` and `npm run qa` both regenerate it, and `.githooks/pre-commit` refreshes and stages it so a commit can never carry a stale handover.
