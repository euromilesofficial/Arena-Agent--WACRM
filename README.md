# WACRM — Website CMS (React + TypeScript + Vite)

Module 1 of the WACRM Website CMS: the **Overview dashboard**, built as a real
front-end project rather than a single HTML file.

## View it

| Goal | Do this |
| --- | --- |
| Look at the dashboard | open **`WACRM-CMS.html`** — one self-contained file, no install, no network |
| Serve it locally | `python3 serve.py` → http://localhost:4173 (no npm needed) |
| Develop it | `npm install && npm run dev` → http://localhost:5173 |
| Rebuild the single file | `npm run build` (writes `WACRM-CMS.html` at the root) |

`index.html` is Vite's dev entry only. Opened from disk it explains this and
forwards to `WACRM-CMS.html`, so a double-click never lands on a blank page.
See `START-HERE.txt` for the one-minute version.

## Run it

```bash
npm install      # one time
npm run dev      # http://localhost:5173  (HMR)
npm run build    # type-check + production bundle -> dist/index.html (single file)
npm run preview  # serve the production build
```

`WACRM-CMS.html` is a copy of the built `dist/index.html` — open it directly in a
browser, no server and no network needed (fonts, icons and images are inlined).

## Stack

- **React 19 + TypeScript** — strict mode, no `any` in the app surface
- **Vite 6** with `vite-plugin-singlefile` — the whole app inlines into one HTML file
- **Plain CSS** (`src/styles/app.css`) written as a tokenised design system:
  CSS custom properties, 4 px spacing scale, 6 px radii, tabular numerals.
  The file is Sass-compatible (nesting + variables map 1:1) if you want to rename
  it to `.scss` and add `sass` — nothing in it relies on being flat CSS today.
- **No runtime dependencies** beyond React. Icons are inline SVG components,
  charts are hand-drawn SVG, thumbnails are generated gradients.

## Layout of the source

```
src/
  main.tsx                  React root + global stylesheet
  App.tsx                   provider + shell + screen router (hash routes)
  lib/
    data.ts                 seed database (sites, pages, KPIs, activity, forms…)
    store.tsx               AppProvider: async API facade, optimistic state,
                            toasts, drawers, modals, wizard, notifications
    nav.ts                  navigation tree, route <-> screen mapping
    format.ts               number / date / duration formatters
    thumbs.ts               deterministic generated page thumbnails
  components/
    Icon.tsx                36 inline SVG icons
    ui.tsx                  Card, Btn, Pill, Status, Toolbar, Skeleton, Switch…
    charts.tsx              Sparkline, AreaChart, Donut, Ring, Bars (pure SVG)
    Shell.tsx               sidebar, nested nav, topbar, palette, notifications
    dashboard/              one file per card:
      TopRow (attention + publishing), Kpis, TrafficChart, Funnel,
      TopPages, Acquisition, SiteHealth, Websites, Side (rail cards)
    overlays/
      DrawerHost.tsx        KPI / stage / channel / health / issue drawers + site menu
      Wizard.tsx            4-step New Website wizard with validation
      ModalHost.tsx         release preflight, publish success, rollback, rename…
  views/
    Overview.tsx            the dashboard grid
    Placeholder.tsx         generic page for the modules still to come
```

## How the data behaves

`lib/store.tsx` exposes a tiny async "API" with real latency (180–600 ms) over an
in-memory database. Every surface reads from the same store:

- Loading → skeleton, error → retry state, empty → zeroed dashboard, denied →
  read-only banner, conflict → publish race (409), all reachable from the
  **State** switcher in the toolbar (or `?state=empty|loading|error|conflict|denied`).
- Publishing runs a preflight, then either releases `v1.25` (success modal with
  diff counts) or raises the 409 conflict and offers a reload.
- Everything is optimistic: rename a site, toggle a menu, edit a draft — the
  KPI strip, timelines, toasts and activity feed all update.

## Flows that work end to end

Command palette (⌘K), notifications, site filter, all six KPI drawers,
funnel stages, acquisition channels, site-health rows, the three attention
items (SSL fix, broken-link report, preflight), publish → success → rollback,
landing-page report drawer, menu dropdown (rename / publish / duplicate),
4-step create-website wizard with validation, route changes, and the five
data states.

## Reviews and specs

- `MODULE-1-REVIEW.md` — build vs. the Module 1 specification: what is done,
  what is missing, the defects and their fixes, and which of the spec's
  recommendations we adopt, defer or reject.
- `BACKEND-PLAN.md` — the full backend contract: data model, API surface for
  every screen and CTA, RBAC/tenancy, publishing with compare-and-swap,
  analytics definitions, jobs, SLOs, security, and the build order.
- `SPEC-AUDIT.md` — the earlier dissection of both reference mockups.

## Reference audit

`SPEC-AUDIT.md` dissects both reference mockups (the screen and the spec sheet)
section by section: what each region specifies, what the build does, the CTA and
dropdown inventory, the state matrix, the motion timings and the deliberate
deviations. Read it before starting module 02.

## QA

`qa_react.py` (full-page screenshot + overflow assertion) and `qa_flows.py`
(38 scripted interaction steps, fails on any page or console error) — both drive
`dist/index.html` through Playwright Chromium.
