# HANDOVER — WACRM Website CMS

> **This file is generated. Do not edit it by hand.**
> Source of truth: `handover.config.json` (intent, decisions, next steps) + live repo facts.
> Regenerate with `npm run handover`; `npm run build` and `npm run qa` do it for you.

**Generated** 2026-11-15 19:36:38 UTC · **generated against commit** `fa27d41` · **working tree** 6 uncommitted file(s)

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
| M5 | Block Library | `#/library` | **done** | qa_library.py 90/90 · qa_builder.py 98/98 |
| M6 | Theme Studio | `#/theme` | **done** | qa_theme.py 127/127 |
| M6.1 | Theme Studio completion + Google Fonts library | `#/theme` | **done** | qa_theme.py 189/189 |

- **M1 Overview** — Dashboard grid, 6 KPI drawers, funnel, acquisition, site health, publishing rail, release wizard, rollback.
- **M2 Sites & Domains** — Define.ai-style two-pane registry, create wizard, DNS/SSL verification, archive/restore, domain checks.
- **M3 Pages & Routes** — Registry + tree + inspector, 8 modals, slug/route guards, deep links, trash with restore window.
- **M4 Visual Builder** — 3-panel editor, 19 blocks / 23 sections / 5 templates, drag with refusal reasons, token-bounded style, autosave 2 s + CAS, revisions with block diff + restore, AI copy stream, publish handoff into M1.
- **M5 Block Library** — Four views (All · Native 20 · Sections 23 · Saved 14), computed KPI/in-use counts, filter rail, grouped grid + list, inspector (Overview/Properties/Compatibility · Overview/Structure/Usage), Insert into Page with six outcomes, Create from page section, duplicate, guarded delete.
- **M6 Theme Studio** — Three tabs (Brand Tokens · Typography · Presets), nine colour roles + derived on-primary, computed WCAG pairs, discrete geometry, six embedded self-hosted font families (242 KB woff2 in the artifact), live read-only preview through the M4 renderer at 1440/768/375, preset library with import/export, CAS draft save, conflict + unsaved guards, publish hand-off into M4's release flow.
- **M6.1 Theme Studio completion + Google Fonts library** — Closes the four Tier-A gaps from THEME-STUDIO-BENCHMARK.md: (G1) a derived six-step type scale with ratio, leadings, trackings and fluid clamp(), edited in a Type Scale card and obeyed by the preview; (G2) 13 colour roles adding muted/link/border/ring, 14 measured contrast pairs with per-role thresholds and the divider advisory floor; (G3) a 1:1 specimen sheet covering type, palette, buttons in four states, four field states, alerts, pills, card, table, radius and spacing; (G4) a Revisions rail + diff modal whose restore fills the working copy and never saves. Fonts: 247 embedded families (10.49 MB woff2, variable-first) plus the full 1,746-family Google Fonts index, searchable with category counts and an embedded-only default; locked rows state the reason. Document schema is now version 2 with a stated v1 migration.

## 3. Build artifact (measured now)

| Property | Value |
| --- | --- |
| File | `WACRM-CMS.html` |
| Size | 15,487,295 B (15124 kB) · gzip 10781 kB |
| md5 | `3b6612e18fc6f9c3e81d08b51145d25e` |
| sha256 (first 16) | `dc6ff4d94b849b45` |
| Built | 2026-11-15 19:36:35 |

Packaged deliverables: `wacrm-app.zip` — rebuilt after this document was generated, so their hashes are deliberately not recorded here (they would reference this file).

```bash
npm ci
npm run build      # tsc --noEmit && vite build, copies the single file, regenerates this document, rebuilds wacrm-app.zip
npm run qa         # every Playwright suite, then rewrites qa/last-run.json and this document
npm run dev        # http://localhost:5173 while developing
```

## 4. Verification (last recorded run)

Recorded 2026-11-15 04:31:46 UTC · node v20.20.2. Re-run with `npm run qa`.

| Suite | Passed | Failed | Time | Covers |
| --- | --- | --- | --- | --- |
| `qa_ai.py` | 60 | 0 | 42.8 s | AI mode: composer, page generation, section, rewrite, 5 failure states, empty-page round trip |
| `qa_theme.py` | 189 | 0 | 116.4 s | M6 three tabs, nine colour roles, WCAG ratios recomputed in Python, geometry, typography, presets CRUD, JSON import/export, preview viewports, guards, conflict, states |
| `qa_builder.py` | 98 | 0 | 49.4 s | M4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths |
| `qa_states_m4.py` | 47 | 0 | 50.5 s | M4 state matrix |
| `qa_pages.py` | 106 | 0 | 126.6 s | M3 registry, tree, inspector, modals, deep links |
| `qa_states_m3.py` | 40 | 0 | 59.9 s | M3 state matrix |
| `qa_module2.py` | 48 | 0 | 40.0 s | M2 layout, geometry, data consistency |
| `qa_states_m1.py` | 39 | 0 | 47.9 s | M1 state matrix |
| `qa_flows.py` | 38 | 0 | 73.1 s | cross-module interaction script |
| `qa_react.py` | — | 0 | 6.0 s | full-page render, console clean, no overflow |
| `qa_library.py` | 90 | 0 | 66.7 s | M5 four views, filters, native catalogue, inspector tabs + diagram, insert path |

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

Source inventory: **61 source files, 23,424 lines** of TS/TSX/CSS (34,653 lines across all tracked text files).

| Area | Files | Lines | Purpose |
| --- | --- | --- | --- |
| `src/lib/` | 14 | 5,410 | data seams, registries, formatting, no JSX |
| `src/components/` | 35 | 8,763 | reusable UI: shell, ui kit, charts, and per-module parts |
| `src/views/` | 7 | 5,003 | one file per screen; routes are hash-based |
| `src/styles/` | 1 | 4,176 | one tokenised stylesheet (design system) |
| `qa/` | 0 | — | 0 WebP captures of audited states (evidence, not fixtures) |

Top files by size:

| File | Lines |
| --- | --- |
| `src/styles/app.css` | 4,176 |
| `BACKEND-PLAN.md` | 1,617 |
| `src/views/ThemeStudio.tsx` | 1,397 |
| `src/lib/theme-db.ts` | 1,176 |
| `src/views/Library.tsx` | 1,070 |
| `src/views/Builder.tsx` | 1,018 |
| `src/lib/data.ts` | 974 |
| `MODULE-6-THEME-STUDIO-SPEC.md` | 880 |
| `src/lib/library-db.ts` | 856 |
| `qa_theme.py` | 838 |
| `src/lib/builder.ts` | 828 |
| `src/views/Pages.tsx` | 789 |

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
- The reference mocks live in Git at `uploads/` and nowhere else: 16 WebP files (2.9 MB, re-encoded from 27.1 MB of PNG at q86), committed and marked `skip-worktree`, so no working copy exists on disk. Read one with `git -C repo show HEAD:uploads/<file> > /tmp/<file>`.
- END-OF-TASK ROUTINE (user's standing instruction): every time a file is created, anything is modified, or a task completes — run `/home/user/checkpoint.sh "what changed"`. It rebuilds the app + HANDOVER + zip, mirrors the tree into repo/, commits, pushes main and all tags, and verifies the remote head. Nothing is left uncommitted.
- GitHub credential: /home/user/.gh-token (0600, outside the repo). Expiry date in /home/user/.gh-token-expiry — currently 2026-11-17; checkpoint.sh warns when under 12h remain and prints the regenerate link. Never committed: a pre-commit gate refuses token patterns. If it lapses, the push fails with 401 and nothing is lost — commits stay local until the next checkpoint.
- Catalogue counts are computed from the registry (20 types · 23 sections · 14 saved). If a number appears twice in the source, one of them is a defect, not a default.
- Only Insert into Page may mutate a page from Module 5, and it must pass `expectRevision` so a stale modal gets a 409.

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
| D15 | Theme Studio publishes nothing: Save writes a draft revision, and the release flow (Module 4 today, Module 11 when it ships) is the only publish path. | locked |
| D16 | Nine persisted colour roles plus one derived, read-only on-primary label colour chosen for 4.5:1 — the token the spec assumed but never defined. | locked |
| D17 | Spacing = base (4|8) × density (compact/comfortable/spacious); radius and container width come from closed enums, so every export can be re-imported exactly. | locked |
| D18 | Fonts ship inside the artifact as subsetted woff2 (6 families, OFL 1.1); families without an asset stay visible in the catalogue as Requires ingestion and cannot be selected. | locked |
| D19 | "Almost all Google Fonts" = 247 families embedded (10.5 MB woff2 budget, popularity order, variable-first) + all 1,746 families indexed with real metadata and locked, never silently offered. A single offline HTML cannot carry the whole library; the budget is a generator flag. | locked |
| D20 | Brand fonts (Google Sans, Product Sans, Material Symbols…) are excluded from the catalogue entirely — by the metadata flag and an explicit denylist — because they are not licensed for redistribution. | locked |
| D21 | Font faces are registered lazily per family; M6 built one 14 MB stylesheet on mount. | locked |
| D22 | The divider role is measured against an advisory 1.5:1 legibility floor, not SC 1.4.11's 3:1, because decorative rules are exempt; the focus ring is held to 3:1 because it identifies a control. | locked |
| D23 | `link` is its own role, measured from itself. M6 measured link pairs against primary while no link token existed — the editor and the audit disagreed. | locked |
| D24 | Type sizes are derived (base × ratio^n), never stored; fluid clamp() applies to h1–h3 only so body copy never shrinks with the viewport. | locked |
| D25 | Restore never writes: it loads a revision into the working copy, marks it dirty and pushes an undo entry. Save remains the only write path, so CAS and the audit log stay honest. | locked |
| D26 | Token document is version 2; the reader accepts 1 and 2, derives the four new roles and the default scale for a v1 file, and reports every derived field in the import review. | locked |
| D27 | The specimen renders 1:1 at the studio width rather than scaled inside the 1440 px device frame — a specimen scaled to 42% is unreadable and therefore useless. | locked |

## 8. What is next

**Module 6.1 is complete: the four Tier-A gaps from the competitive benchmark are closed (type scale, 13 role pairs, specimen sheet, revisions) and the Theme Studio carries 247 embedded Google Fonts families with a searchable 1,746-family index. 11/11 suites green. Tier B of the benchmark is researched but unapproved.**

Blocked on:

- Module 7 (Layouts & Templates) waits on its specification; the theme contract already reserves the layout/navigation import fields and keeps them switched off.
- Module 11 (Publishing & Releases) is the future owner of the publish surface — until then the theme draft rides Module 4's release dialog.
- The GitHub token expires 17 Nov 2026 — rotate before then or pushes 401 (commits stay local, nothing is lost).

First tasks:

1. Module 7 (Layouts & Templates) is the next build; the theme's layout/navigation import fields stay switched off until it lands.
2. Decide Tier B of THEME-STUDIO-BENCHMARK.md: dark mode/modes (G5), palette generation (G6), DTCG export (G7), APCA column (G8), partial presets (G9). All researched and ranked; none approved.
3. Rotate the GitHub PAT before 17 Nov 2026 and rewrite /home/user/.gh-token + .gh-token-expiry.
4. Module 7 (Layouts & Templates): headers/footers, reusable blocks, page templates, and only then the theme's 'Replace layout after review' radio becomes reachable.
5. Keep the count contract after every change: the library, the builder palette and the KPI strip must return the same numbers.
6. Font ingestion for the three non-embedded families is a server contract in BACKEND-PLAN.md — implementing it is what unblocks 'Requires ingestion'.

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
- Never run `git sparse-checkout init` in repo/ — with this git build (2.47) it writes `/*` + `!/*/` and removes every directory (src, qa, uploads…) from the working tree, then `set` fails with 'specify directories rather than patterns'. Recover with `git sparse-checkout disable`. Nothing is lost (the objects are in .git), but the tree has to be re-materialised.
- uploads/ is a single copy, inside repo/ — the 26 MB of mocks are committed at repo/uploads with MANIFEST.sha256. There is deliberately no second copy at /home/user/uploads; read them out of git instead of restoring a duplicate.
- uploads/ is skip-worktree — do not be alarmed that the folder is missing: `git ls-files uploads` still lists 19 paths and `git show HEAD:uploads/...` works. To materialise them, `git update-index --no-skip-worktree $(git ls-files uploads)` then `git checkout -- uploads`; re-hide when done.
- History rewrites must be range-limited: `git filter-branch --index-filter … -- d2dd7db..main` keeps the branch base (and therefore the fast-forward to origin) intact. A bare `--all` rewrites the root as well, and the push stops being a fast-forward — recover by re-cloning the pre-rewrite bundle, never by forcing.
- Push state as of the token handover: origin/main was d2dd7db (Module 3 spec only). Everything from Module 3's build onward — 30 commits — was local until the first successful push; if a session ever finds origin behind again, run checkpoint.sh rather than assuming the work is safe.
- Module 4's builder palette already owns the `lb-*` CSS namespace. Module 5 shipped as `m5-*` after a half-rendered grid exposed the collision — never reuse `lb-` for a new screen.
- A card grid whose items are flex columns needs `align-items:start`; with the default `stretch`, Chrome resolves the cyclic height and collapses every card to one text line (thumb computed to 1px).
- The section category `Forms` is separate from the block group `Form` (singular). Both are real and are asserted separately in qa_builder.py (C3/C3b) and qa_library.py (C5).
- Playwright needs `LD_LIBRARY_PATH=/tmp/libs/root/usr/lib/x86_64-linux-gnu` after scripts/qa-env.sh — /tmp is wiped between sessions and the libs must be re-fetched with `apt-get download` (no root available).

## 10. Repository state and rollback

- Repo: that git directory is `.`; branch `main`; HEAD `fa27d41` — docs: PUSH-TO-GIT head + package facts after the M6.1 push.
- Working tree: 6 uncommitted file(s).
- Remote: **none configured** — add one before pushing (`git remote add origin <url>`).
- Tags: `m6.1-theme-studio` · `m6-theme-studio-benchmark` · `m6-theme-studio` · `module-5-complete` · `module-4-ai` · `module-4-complete` · `module-3-complete` · `module-1-and-2-import` · `module-2-complete`.

| Commit | Date | Subject |
| --- | --- | --- |
| `fa27d41` | 2026-11-15 | docs: PUSH-TO-GIT head + package facts after the M6.1 push |
| `99dac4d` | 2026-11-15 | docs: PUSH-TO-GIT and ROLLBACK reflect the M6.1 push (aca7109, 9 tags, 152 files) |
| `aca7109` | 2026-11-15 | M6.1: type scale, 13 colour roles, specimen sheet, revision diffs, 247 embedded + 1,746 indexed Google Fonts |
| `82e207b` | 2026-11-15 | docs(module-6): competitive benchmark of Theme Studio across CMS systems + gap register |
| `b41bf3e` | 2026-11-15 | feat(module-6): Theme Studio — tokens, typography, presets, computed contrast, draft-only save |
| `aa904b7` | 2026-11-15 | docs(module-6): persist the Theme Studio spec and the gap review — 31 findings, 10 decisions |
| `942b600` | 2026-11-15 | docs(uploads): add the three Module 6 Theme Studio mocks; rebuild MANIFEST |
| `f5f0309` | 2026-11-15 | fix(module-5): restore the mock's responsive strip; verify uploads manifest |
| `edc189b` | 2026-11-15 | docs(uploads): add the inspector-overview close-up mock; rebuild MANIFEST; restore script exec bits |
| `78f8fab` | 2026-11-14 | feat(module-5): close the mock-fidelity audit — 25-block catalogue, mock categories, icon cards, property inspector |
| `0fbd45c` | 2026-11-14 | docs(module-5): audit the ten block-library mocks against the build |
| `10530b7` | 2026-11-14 | chore(qa): write screenshots as WebP directly, drop stray PNGs |

Rollback recipes live in `ROLLBACK.md`; the short version: `git revert <sha>`, `git revert <tag>..HEAD`, or `git show <tag>:WACRM-CMS.html > old.html`.

## 11. Definition of done (apply to every change)

1. The screen works for every CTA and dropdown, in every state listed in STATE-COVERAGE.md.
2. tsc --noEmit is clean and the suite for the module is green; no earlier suite regressed.
3. No horizontal overflow at 1280 / 1440 / 1920.
4. BACKEND-PLAN.md carries a contract row for every new control.
5. The commit is tagged module-N-complete, HANDOVER.md is regenerated, and the zip is rebuilt.

---

_How this document is produced:_ `handover.config.json` holds intent; `scripts/handover.mjs` measures the repository (git, artifact hashes, inventory, QA tallies) and writes this file; `scripts/qa-all.mjs` runs every suite and records `qa/last-run.json`; `npm run build` and `npm run qa` both regenerate it, and `.githooks/pre-commit` refreshes and stages it so a commit can never carry a stale handover.
