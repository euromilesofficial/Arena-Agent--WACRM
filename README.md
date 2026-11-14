# WACRM — Website CMS (React + TypeScript + Vite)

A desktop-first Website CMS built module by module: **Overview** (M1),
**Sites & Domains** (M2), **Pages & Routes** (M3) and the **Visual Builder** (M4).
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
- **Plain CSS** (`src/styles/app.css`, ~3.1k lines) as a tokenised design system:
  custom properties, 4 px spacing scale, 6 px radii, tabular numerals, motion at
  150–300 ms `cubic-bezier(.16,1,.3,1)`.
- **No runtime dependencies beyond React.** Icons are inline SVG, charts are
  hand-drawn SVG, photos are inlined at build time, fonts are system stacks —
  nothing is fetched from a CDN, so the file works offline.

## Layout of the source

```
src/
  App.tsx                   provider + shell + hash router (#/overview … #/builder)
  lib/
    data.ts                 seeded database (sites, pages, releases, issues, forms…)
    store.tsx               AppProvider: async facade, optimistic state, toasts,
                            drawers, modals, notifications, route guard
    cms-pages.ts            Module 3 page registry: filters, tree, slug rules, seeds
    builder.ts              Module 4 block registry, 23 section presets, 5 page
                            templates, the seeded Study Abroad document
    builder-db.ts           draft load/save (CAS), revisions, library reads,
                            AI copy stream, presence
    builder-images.ts       5 inlined photos used by the seeded document
    builder-handoff.ts      one-shot Pages → Builder page handoff
    nav.ts, format.ts, thumbs.ts
  components/
    Icon.tsx                81 inline SVG icons
    ui.tsx                  Card, Btn, Pill, Drawer, Modal, Menu, Switch, Skeleton…
    charts.tsx              Sparkline, AreaChart, Donut, Ring, Bars (pure SVG)
    Shell.tsx               sidebar, nested nav, topbar, palette, notifications
    dashboard/              M1 cards, one file per region
    pages/                  M3 page tree, inspector, 8 modals
    builder/                M4 Library, Canvas, Inspector, BuilderModals
    overlays/               drawers, wizards, modal host
  views/
    Overview.tsx  Sites.tsx  Pages.tsx  Builder.tsx  Placeholder.tsx
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

## Reviews and specs

- `MODULE-1-REVIEW.md` … `MODULE-4-REVIEW.md` — per-module build-versus-spec
  reviews: what shipped, the defects found and fixed, what is deferred and why.
- `MODULE-2-SPEC.md` — the accepted v2 layout for Sites & Domains.
- `BACKEND-PLAN.md` — the backend contract: data model, every endpoint and CTA,
  RBAC/tenancy, publishing with compare-and-swap, analytics, jobs, SLOs,
  security, build order (§7.19 covers the builder).
- `STATE-COVERAGE.md` — the state matrix for all four modules, with the trigger
  and the contract for each state.
- `SPEC-AUDIT.md` — dissection of the reference mockups.
- `ROLLBACK.md` — tags, revert recipes and what each release contains.

## QA

Playwright + Chromium suites, all green against `WACRM-CMS.html` at 1440×900:

| Suite | Covers | Result |
| --- | --- | --- |
| `qa_builder.py` | Module 4 screen, panels, drag, AI, autosave, publish, revisions, 3 widths | 97/97 |
| `qa_states_m4.py` | Module 4 state matrix | 47/47 |
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
