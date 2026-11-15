# WACRM — Website CMS (React + TypeScript + Vite)

A desktop-first Website CMS built module by module: **Overview** (M1),
**Sites & Domains** (M2), **Pages & Routes** (M3), the **Visual Builder** (M4),
the **Block Library** (M5) and the **Theme Studio** (M6, extended in M6.1).
Every screen ships with all of its CTAs, dropdowns and operation states wired to
a simulated backend, so it can be reviewed as a product rather than a picture.

## View it

| Goal | Do this |
| --- | --- |
| Use it | open **`WACRM-CMS.html`** — one self-contained file, no install, no server, no network |
| Serve it locally | `python3 serve.py` → http://localhost:4173 (no npm needed) |
| Develop it | `npm install && npm run dev` → http://localhost:5173 |
| Rebuild the single file | `npm run build` (type-checks, then writes one HTML file) |

`index.html` is Vite's dev entry only. Opened from disk it explains this and
forwards to `WACRM-CMS.html`, so a double-click never lands on a blank page.
`START-HERE.txt` is the one-minute version.

## Stack

- **React 19 + TypeScript** (strict), **Vite 7** with `vite-plugin-singlefile` —
  the whole app inlines into one HTML file.
- **Plain CSS** (`src/styles/app.css`, ~4.2k lines) as a tokenised design system:
  custom properties, 4 px spacing scale, 6 px radii, tabular numerals, motion at
  150–300 ms `cubic-bezier(.16,1,.3,1)`.
- **No runtime dependencies beyond React.** Icons are inline SVG, charts are
  hand-drawn SVG, photos are inlined at build time, and the Theme Studio carries
  **247 self-hosted Google Fonts families** (10.5 MB of subsetted woff2, inlined
  at build time) with a searchable 1,746-family index behind them — nothing is
  fetched from a CDN, so the file works offline.

## Layout of the source

```
src/
  App.tsx                   provider + shell + hash router (#/overview … #/builder)
  lib/
    data.ts                 seeded database (sites, pages, releases, issues, forms…)
    store.tsx               AppProvider: async facade, optimistic state, toasts,
                            drawers, modals, notifications, route guard
    cms-pages.ts            Module 3 page registry: filters, tree, slug rules, seeds
    library-db.ts           Module 5 catalogue, saved templates, placement index
    builder.ts              Module 4 block registry, 23 section presets, 5 page
                            templates, the seeded Study Abroad document
    builder-db.ts           draft load/save (CAS), revisions, library reads,
                            AI copy stream, presence
    builder-images.ts       5 inlined photos used by the seeded document
    builder-handoff.ts      one-shot Pages → Builder page handoff
    theme-db.ts             Module 6 token document: 13 colour roles + groups,
                            derived six-step type scale, WCAG pair engine,
                            presets, CAS draft save, revisions + token diffs,
                            v1/v2 import-export, presets seed
    theme-font-data.ts      247 embedded font families (generated, ~14 MB base64)
    theme-font-catalog.ts   the full 1,746-family Google Fonts index (generated)
    nav.ts, format.ts, thumbs.ts
  components/
    Icon.tsx                81 inline SVG icons
    ui.tsx                  Card, Btn, Pill, Drawer, Modal, Menu, Switch, Skeleton…
    charts.tsx              Sparkline, AreaChart, Donut, Ring, Bars (pure SVG)
    Shell.tsx               sidebar, nested nav, topbar, palette, notifications
    dashboard/              M1 cards, one file per region
    pages/                  M3 page tree, inspector, 8 modals
    builder/                M4 Library, Canvas, Inspector, BuilderModals
    theme/                  M6 ThemeControls, ThemePreview, ThemeSpecimen,
                            ThemeOverview, ThemeModals
    overlays/               drawers, wizards, modal host
  views/
    Overview.tsx  Sites.tsx  Pages.tsx  Builder.tsx  Library.tsx
    ThemeStudio.tsx  Placeholder.tsx
qa/                         WebP captures of every audited state
```

## How the data behaves

`lib/store.tsx` and `lib/builder-db.ts` are the only seams to a backend. Both add
real latency (180–600 ms), real failure paths and real ordering rules over an
in-memory database, so the UI is never a static mock:

- **States:** loading, empty, service down (`502`), publish conflict (`409`),
  Viewer read-only (`403`) — reachable from the **Prototype states** menu
  (beaker icon, top-right) and, for M3/M4, from deep links.
- **Optimistic everything:** rename a site, duplicate a page, insert a block,
  accept an AI rewrite — KPIs, timelines, inspectors, toasts and the activity feed
  all follow.
- **The builder owns a document:** 2 s debounced autosave with `If-Match` CAS,
  409 conflict resolution, 40-step undo/redo, revision history with block diffs
  and restore, and a publish handoff into Module 1's release pipeline.

## Flows that work end to end

Command palette (⌘K), notifications, site filter, six KPI drawers, funnel stages,
acquisition channels, site-health rows, publish → success → rollback, the
create-website wizard, domain verification, the page registry with its tree and
eight dialogs, **and** Pages → Builder → publish: pick a page, edit it in three
panels, drag blocks, rewrite copy with the assistant, save, conflict, restore a
revision, publish.

## Where the bytes live

Two files — the 14 MB font library and the 15.5 MB single-file app — carry 90 % of
this project's weight, and they used to be stored three times (app folder, Git clone,
zip). They now live **once on disk** as links into the clone, the zip omits what it can
regenerate, and history is repacked. `STORAGE.md` has the map, the savings per item and
the checks that keep a build through a symlink honest.

```bash
npm run fonts    # regenerate the 247-family library (14 MB, generated, in Git)
```

## Handover (for a human or an AI agent picking this up cold)

`HANDOVER.md` is **generated**, never hand-written. It carries the current module
status, the measured build artifact (bytes, gzip, md5), the last QA tallies, the
source inventory, the locked decisions, the next tasks and the traps that cost
time last time.

```bash
npm run handover    # regenerate from handover.config.json + live repo facts
npm run qa          # run every suite → qa/last-run.json → regenerate the handover
npm run qa:check    # exit 1 when HANDOVER.md is stale (CI gate); masks the
                    # commit ids, timestamps and the git section, which are one
                    # commit behind by construction
npm run build       # also regenerates the handover
```

- `handover.config.json` is the human-owned half: intent, decisions, next steps,
  traps, contracts. Edit it, never the markdown.
- `scripts/handover.mjs` measures everything else (git, artifact hashes, file
  inventory, QA tallies) so the document can never quote a stale number.
- `scripts/qa-all.mjs` runs the suites, parses each summary line and writes
  `qa/last-run.json` as machine-readable evidence.
- `.githooks/pre-commit` regenerates and stages `HANDOVER.md`, so a commit can
  never carry a stale handover. Enable it once per clone:
  `git config core.hooksPath .githooks`.

## Reviews and specs

- `MODULE-1-REVIEW.md` … `MODULE-4-REVIEW.md` — per-module build-versus-spec
  reviews: what shipped, the defects found and fixed, what is deferred and why.
- `MODULE-5-REVIEW.md` — block library vs the industry (Elementor / Webflow /
  Gutenberg / HubSpot), the WACRM CRM integration map, and the form-builder
  verdict: what the CRM has, what it lacks, and the three ways to close it.
- `AI-BUILDER-SPEC.md` — AI mode in the visual builder: the three tasks, the
  plan-then-compose pipeline, every state, and the endpoint contract behind it.
- `INTERLINK-PLAN.md` — the decided CMS ⇄ CRM architecture (D1–D8), the
  block → trigger → action automation matrix, and the loop end to end.
- `MODULE-6-THEME-STUDIO-SPEC.md` · `MODULE-6-GAP-REVIEW.md` · `MODULE-6-DECISIONS.md`
  (D1–D16) · `MODULE-6-UI-UX-REVIEW.md` — the Theme Studio.
- `THEME-STUDIO-BENCHMARK.md` — the competitive study (Shopify, Elementor,
  Framer, Squarespace, Material 3, shadcn, DTCG) that produced gaps G1–G9; M6.1
  implements the four Tier-A ones.
- `MODULE-6.1-SPEC.md` · `MODULE-6.1-DECISIONS.md` (D1–D15) · `MODULE-6.1-UI-UX-REVIEW.md`
  — the type scale, the four new roles, the specimen sheet, revisions, and the
  Google Fonts library. `FONT-LICENSES.md` is its per-family licence register.
- `MODULE-2-SPEC.md` — the accepted v2 layout for Sites & Domains.
- `BACKEND-PLAN.md` — the backend contract: data model, every endpoint and CTA,
  RBAC/tenancy, publishing with compare-and-swap, analytics, jobs, SLOs,
  security, build order (§7.19 the builder, §7.20 the CMS ⇄ CRM interlink,
  §7.27 the Theme Studio, §7.28 its version-2 document and font pipeline).
- `uploads/` — the reference mocks the product was specified against, kept in
  Git with a manifest and a restore recipe (`uploads/README.md`).
- `PUSH-TO-GIT.md` — the exact state of the GitHub push: what is on
  `origin/main`, what is local only, and the two credential-free routes.
- `STATE-COVERAGE.md` — the state matrix for all four modules, with the trigger
  and the contract for each state.
- `SPEC-AUDIT.md` — dissection of the reference mockups.
- `ROLLBACK.md` — tags, revert recipes and what each release contains.
- `STORAGE.md` — where the 80 MB goes: the symlink layout, the zip's omissions,
  and the one remaining lever (the font budget).

## QA

Playwright + Chromium suites, all green against `WACRM-CMS.html` at 1440×900:

| Suite | Covers | Result |
| --- | --- | --- |
| `qa_builder.py` | Module 4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths | 97/97 |
| `qa_states_m4.py` | Module 4 state matrix | 47/47 |
| `qa_library.py` | Module 5 catalogue, four views, inspector tabs, composition diagram, insert path, 12 states | 90/90 |
| `qa_pages.py` | Module 3 registry, tree, inspector, modals, deep links | 106/106 |
| `qa_states_m3.py` | Module 3 state matrix | 40/40 |
| `qa_module2.py` | Module 2 layout, geometry, consistency | 48/48 |
| `qa_states_m1.py` | Module 1 state matrix | 39/39 |
| `qa_flows.py` | cross-module interaction script | 38 ok / 0 |
| `qa_react.py` | full-page render, console clean, no overflow | pass |

```bash
python3 -m playwright install chromium-headless-shell
python3 qa_builder.py && python3 qa_states_m4.py
```
