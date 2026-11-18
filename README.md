# WACRM — Website CMS

A desktop-first **Website CMS** for the WACRM product line, built module by module and shipped as **one self-contained HTML file** that opens by double-click, with no server, no build step and **no network access**.

Every screen ships with its **CTAs wired, its dropdowns working, and its operation states reachable** — loading, empty, error, read-only, conflict, permission-denied — against a simulated backend with real latency and real failure paths. It is a product you can click through, not a picture of one.

```
Modules built   7   ·  M1 Overview · M2 Sites & Domains · M3 Pages & Routes
                       M4 Visual Builder (+ AI) · M5 Block Library
                       M6 Theme Studio · M6.1 type scale, specimen, revisions, fonts
                       M7 Layouts & Templates (+ 14 prebuilt starters, HTML/JSON import)
Suites          15  ·  1042 assertions, all green
Artifact        4.75 MB  ·  WACRM-CMS.html  ·  no network, no dependencies at runtime
Package         3.82 MB  ·  wacrm-app.zip   ·  opens by double-click
Backend         not built — every call is a documented contract in BACKEND-PLAN.md
```

---

## Contents

1. [What this is](#1-what-this-is)
2. [Quick start](#2-quick-start)
3. [Requirements and installation](#3-requirements-and-installation)
4. [Everyday commands](#4-everyday-commands)
5. [What has been built](#5-what-has-been-built)
6. [Navigation map](#6-navigation-map)
7. [Architecture](#7-architecture)
8. [How the data behaves](#8-how-the-data-behaves)
9. [Design system](#9-design-system)
10. [Typography and the font library](#10-typography-and-the-font-library)
11. [Theme Studio internals](#11-theme-studio-internals)
12. [Testing](#12-testing)
13. [Handover automation](#13-handover-automation)
14. [Packaging](#14-packaging)
15. [Git workflow](#15-git-workflow)
16. [Documentation index](#16-documentation-index)
17. [Backend: what exists and what doesn't](#17-backend-what-exists-and-what-doesnt)
18. [Roadmap](#18-roadmap)
19. [Troubleshooting and known issues](#19-troubleshooting-and-known-issues)
20. [Working rules this project follows](#20-working-rules-this-project-follows)

---

## 1. What this is

WACRM is a CRM with a WhatsApp-first messaging stack. This repository is the **Website CMS** module of that product: the place where a tenant's marketing site is assembled, edited, themed and eventually published.

The product is modelled on the same surface area as Shopify's Online Store, Elementor, Webflow and HubSpot's website tool, and the module order follows that shape:

| | Capability | Where it lives |
|---|---|---|
| 1 | Dashboard, KPIs, site health | `#/overview` |
| 2 | Websites, domains, DNS, SSL | `#/sites` |
| 3 | Pages, routes, slugs, redirects, bulk actions | `#/pages` |
| 4 | Visual builder: canvas, blocks, inspector, undo, autosave, publish hand-off | `#/builder` |
| 4b | AI: generate a page from a prompt, rewrite copy in-canvas | `#/builder` |
| 5 | Block library: 20 block types, 24 section presets, 5 page templates, saved templates | `#/library` |
| 6 | Theme Studio: 13 colour roles, type scale, presets, contrast audit, revisions, specimen | `#/theme` |
| 6.1 | Type scale, four new roles, specimen sheet, revision diffs, 50-font library | `#/theme` |
| 7 | Master layouts (shell + required content slot), page templates, usage, bulk reassignment | `#/layouts` |
| 7b | Prebuilt library (14 MIT starters), import of HTML / JSON templates, block mapping, revision history | `#/layouts` |

Three things separate this from a mockup:

1. **State is real.** Saves use compare-and-swap with a `409` conflict path, the builder autosaves with undo/redo, themes write drafts only, and every screen has reachable loading / empty / error / viewer / conflict states.
2. **It is measured.** 1042 Playwright assertions drive the built artifact — not the source, not a dev server — and the count is regenerated into `HANDOVER.md` on every build.
3. **It is documented as a contract.** `BACKEND-PLAN.md` specifies the schema, endpoints, RBAC and job states behind every button, because the backend is deliberately out of scope.

---

## 2. Quick start

### The 30-second path (no tooling at all)

1. Download **`WACRM-CMS.html`** (4.75 MB) — or the zip and unpack it.
2. **Double-click it.**
3. The CMS opens in your browser. Everything works: navigation, drawers, modals, dropdowns, the builder, the theme studio, the AI panel, the prototype-state menu.

No `node_modules`, no server, no internet connection. Fonts, icons, charts and photos are all inside the file.

### The served path (no npm either)

```bash
cd wacrm-app
python3 serve.py            # → http://localhost:4173
PORT=8080 python3 serve.py  # custom port
```

`serve.py` is a 45-line zero-dependency static server; it exists because some browsers behave better over `http://` than over `file://`.

### The development path

```bash
git clone https://github.com/euromilesofficial/Arena-Agent--WACRM.git wacrm-app
cd wacrm-app
npm ci                      # exact versions from package-lock.json
npm run build               # type-check → bundle → single file → handover → zip
```

Then open `WACRM-CMS.html`. See [§19](#19-troubleshooting-and-known-issues) before using `npm run dev` — there is a known dev-mode defect, and the built artifact is the path everything is verified against.

---

## 3. Requirements and installation

### Requirements

| Need | Version | Why |
|---|---|---|
| Node.js | **20 LTS or newer** (built and tested on `v20.20.2`) | Vite 7 requires Node 20.19+ |
| npm | 10+ (tested `10.8.2`) | `npm ci` uses the lockfile |
| A browser | any current Chromium, Firefox or Safari | the artifact targets Baseline-widely-available CSS |
| Python 3 | 3.10+ — **optional** | only for `serve.py` and the QA suites |
| `zip` / `unzip` | any — **optional** | only for `npm run package` |

Nothing else. There is no database, no service to install, no environment variables, no API keys. The entire runtime dependency list is:

```json
"dependencies": { "react": "^19.2.0", "react-dom": "^19.2.0" }
```

### Install, step by step

```bash
# 1 · get the code
git clone https://github.com/euromilesofficial/Arena-Agent--WACRM.git wacrm-app
cd wacrm-app

# 2 · install the toolchain (dev dependencies only — React is bundled at build time)
npm ci

# 3 · build the single file
npm run build
#   tsc --noEmit                          type-check, strict, noUnusedLocals
#   vite build                            bundle + inline everything
#   cp dist/index.html WACRM-CMS.html     the deliverable
#   node scripts/handover.mjs             regenerate HANDOVER.md from live facts
#   node scripts/package.mjs              regenerate ../wacrm-app.zip

# 4 · open it
open WACRM-CMS.html          # macOS   (xdg-open on Linux, start on Windows)
```

`npm ci` is used rather than `npm install` on purpose: the lockfile is the only reproducible path, and a floating `^` range is how a build stops reproducing.

### Fonts

The 50 embedded font families are **generated**, not hand-written — `src/lib/theme-font-data.ts` is 3.2 MB of base64 woff2 and lives in Git. A fresh clone already has it. Regenerate or extend it only when you want a different set:

```bash
npm run fonts                            # rebuild the embedded set (top 50, ~2.5 MB)
npm run fonts -- --only="Bebas Neue"     # pull one named family in from Google Fonts
npm run fonts -- --families=80           # widen the cut (costs bytes in the artifact)
```

`npm run build` and `npm run dev` both start with `scripts/ensure-font-data.mjs`, which **fails loudly** if that file is missing or is the old nine-family stub — a build without fonts would look fine and be wrong.

### Offline install

The zip is the offline path:

```bash
unzip wacrm-app.zip && cd wacrm-app
open WACRM-CMS.html          # done — no install required
```

If you want to *rebuild* offline you also need the dev toolchain available in the npm cache; `npm ci --offline` works once `npm ci` has run at least once on that machine.

---

## 4. Everyday commands

| Command | What it does |
|---|---|
| `npm run build` | type-check → bundle → single file → `HANDOVER.md` → zip. **The one command that produces a shippable state.** |
| `npm run dev` | Vite dev server on `:5173` for editing. See [known issue](#npm-run-dev-fails-with-a-react-hooks-error). |
| `npm run preview` | serve the last build from `dist/` (requires a build first) |
| `npm run serve` | `python3 serve.py` → `:4173`, serves the single file |
| `npm run qa` | run all 15 suites → `qa/last-run.json` → regenerate the handover |
| `npm run qa:check` | exit 1 if `HANDOVER.md` is stale (CI gate) |
| `npm run handover` | regenerate `HANDOVER.md` alone |
| `npm run package` | regenerate `../wacrm-app.zip` alone |
| `npm run fonts` | regenerate the embedded font set |
| `./checkpoint.sh "message" [tag]` | build → commit → push → verify the remote head. The end-of-task routine. |

---

## 5. What has been built

### M1 · Overview — `#/overview`

The landing dashboard: six KPI cards with drawers, a traffic chart, acquisition channels, top pages, top row (sites), funnel stages, site health table, data-freshness panel, activity feed.

- Global site filter and 7/30/90-day range, both of which re-scope every panel.
- 6 KPI drawers, sortable tables, per-row drill-downs.
- States: loading skeletons, empty, service-down `502`, viewer read-only.
- **QA:** `qa_states_m1.py` 39 · covered in `qa_flows.py`.

### M2 · Sites & Domains — `#/sites`

Portfolio of websites, each with domains, DNS verification, SSL status and connect/disconnect flows.

- Create-website wizard (4 steps, validation, async provisioning).
- Domain drawer: settings, DNS records table, "run verification" with a real pending → verified transition, SSL panel.
- The **first layout was rejected** and rebuilt to the accepted v2 spec (`MODULE-2-SPEC.md`); the tree in this repo is the v2 only.
- **QA:** `qa_module2.py` 48 · layout invariants asserted at 1440 and 1600 px.

### M3 · Pages & Routes — `#/pages`

The page registry: tree, filters, search, bulk selection, route/slug rules, redirects, publishing state per page.

- Page tree with drag-free reordering, inspector panel, per-page settings.
- 8 dialogs: create, duplicate, move, slug change with redirect suggestion, delete, bulk publish, bulk unpublish, SEO fields.
- Hand-off into the builder ("Edit in builder") that loads that exact page.
- **QA:** `qa_pages.py` 106 · `qa_states_m3.py` 40.

### M4 · Visual Builder — `#/builder`

The centre of the product: three panels (library · canvas · inspector), a real document, and a publishing hand-off.

- **Canvas** renders real block components at 1440 / 768 / 375 device widths.
- **Document model:** insert, delete, duplicate, reorder, select, per-block props — with **40-step undo/redo** and **2-second debounced autosave** using `If-Match` compare-and-swap.
- **Conflict path:** save against a stale `baseId` returns `409`, the modal shows "Theme/document updated elsewhere" with *review latest* / *keep my draft as a copy*.
- **Revisions:** block-level diffs and restore.
- **Publish hand-off** into M1's release pipeline (the CMS does not publish from inside the builder).
- **AI mode:** generate a page from a prompt (plan → compose → insert), and rewrite a single block's or field's copy in place, with a streaming state, an error state and an accept/reject step.
- **QA:** `qa_builder.py` 98 · `qa_states_m4.py` 47 · `qa_ai.py` 60.

### M5 · Block Library — `#/library`

The shared catalogue the builder draws from.

- **20 registered block types**, **19 archetypes offered** in the library grid, **24 section presets**, **5 page templates**, **4 groups** (Content · Media · Layout · Form), category chips with live counts.
- **Saved templates:** create from a selection, rename, duplicate, delete, use; placed-usage index ("used on 3 pages") that deep-links into the builder.
- Style variants per block (variant, density, align, radius, background), previewed live.
- **Forms:** a block form is named after the CRM's saved form when one exists; the consent block is **unticked, explicit and channel-specific** to satisfy Meta's opt-in policy.
- **QA:** `qa_library.py` 90 (library + placement + saved templates + builder regressions).

### M6 · Theme Studio — `#/theme`

Brand tokens, typography and presets under one roof, with a read-only preview and a draft-only save.

- Three tabs: **Brand Tokens · Typography · Presets**; centre preview with Page/Specimen and Desktop/Tablet/Mobile; right rail with token summary, typography summary, accessibility checks, usage, revisions, theme status.
- **13 colour roles** in two groups, discrete geometry (radius, spacing base × density, container width, card density, elevation).
- **Computed contrast audit:** 14 pairs with per-role thresholds and verdicts; warnings are advisory and never block a save.
- **Save writes a draft only** — publishing belongs to Module 11.
- Preset library (10 seeded) with import/export, apply, rename, duplicate, archive.
- **QA:** `qa_theme.py` 241.

### M6.1 · Theme Studio completion — `#/theme`

Closes the four Tier-A gaps found by a competitive benchmark against Shopify, Elementor, Framer, Squarespace, Material 3 and shadcn/ui (`THEME-STUDIO-BENCHMARK.md`).

| Gap | What shipped |
|---|---|
| **G1** type scale | Six derived steps from one base and a ratio; heading/body leading and tracking; fluid `clamp()` for h1–h3; a live ramp at real sizes; the preview obeys it |
| **G2** role coverage | `muted`, `link`, `border`, `ring` added (13 roles); `border` measured against an advisory 1.5:1 floor, `ring` held to 3:1 |
| **G3** specimen sheet | Type, palette, buttons in four states, four field states, consent block, three alert severities, five pills, card, table, radius, spacing — rendered 1:1 |
| **G4** revisions | Rail panel + diff modal (group · token · from · to); restore **loads the working copy and never saves** |
| **Fonts** | 50 embedded families (2.48 MB woff2) + a searchable **1,746-family** index, each indexed family one **Get** click from its font file download |

Document schema is **version 2**; a version-1 file still imports, with the four derived roles and the default scale named in the review.

### M7 · Layouts & Templates — built · `#/layouts`

Review first (**`MODULE-7-SPEC.md`**, **`MODULE-7-BENCHMARK.md`**, **`MODULE-7-GAP-REVIEW.md`
— 22 findings, 16 decisions), then the build. Full build record, including the honest
deltas: **`MODULE-7-BUILD.md`**.

| Area | What ships |
|---|---|
| **Master layout** | Announcement · Global Header · **one required Main Content Slot** · Global Footer. Chrome is *referenced*, never copied: a `SharedRegion` owns the variants, a layout stores `{regionId, variantId, visible}` and a reason whenever a region is hidden |
| **Slot policy** | An allow-list of block types plus a block ceiling, enforced in the Visual Builder's library (`data-policy`), in the canvas (denied blocks flagged) and at save time |
| **Seed blocks** | Add / reorder / remove; cloned into every page created on the layout |
| **Page templates** | 12 starters across 8 intents. **Copy-on-create** — blocks are cloned once, never live-inherited; "Create page" writes a real draft page and hands its composition to Module 4 |
| **Derived counts** | Master layouts, templates, pages assigned, draft changes, page-group cards and both usage tables are read from `DBX().cmsPages` — no hand-typed number |
| **Bulk reassign** | ≤ 40 pages, impact preview, one audit event, writes `CmsPage.layout` so Pages and the builder follow immediately |
| **Guarded deletion** | Archive-only for layouts; the default and any layout in use are refused *with the reason and the count*; restore is one click |
| **Preflight** | Unknown/archived bindings, missing default, hidden footer, SEO-not-ready, hidden region without a reason — every finding names its fix |
| **States** | Loading skeletons, empty, error + retry, Viewer (read-only, disabled affordances), CAS save conflict, unsaved-leave guard, slow transport |

### M6.2 · Ten presets, real font downloads, the complete bundle — `#/theme`

Full audit: **`MODULE-6.2-REVIEW.md`**.

| Area | Before | Now |
|---|---|---|
| Presets | 5 seeds, three of one idea | **10**: 5 built-in (`Modern Violet`, `Ocean Professional`, `Warm Editorial`, `Midnight Product`, `Cobalt Corporate`), 3 workspace, 2 site-scoped — every family embedded, so all ten apply offline |
| Font "Get" | a shell command | **a file**: fetches the family's latin woff2 from Google and saves it (`Abril-Fatface-latin.woff2`), with busy, saved and offline states, a specimen link, and the banner's **Browse all 1,746** |
| Export | tokens only (`schemaVersion 2`) | **complete bundle** (`schemaVersion 3`, `kind: wacrm.theme.bundle`): token document + font faces as base64 woff2 + every referenced image + layout slots + reference pages + computed type sizes + 14 WCAG verdicts + provenance + `fnv1a-32` integrity stamp. > 200 KB on the seed site, and it imports back |
| Interlink | none — nothing else read the theme | the **Visual Builder canvas renders the site's draft theme** (`.wb-themed`): background, surface, border, ink, primary, radius, container, band spacing, heading stack, table chrome, secondary button |

---

## 6. Navigation map

The sidebar is the product's shape. Built screens navigate; the rest render a deliberate, informative placeholder that states what the module will contain.

| Group | Item | Status |
|---|---|---|
| — | Inbox · Dashboard · CRM & Sales · Marketing · Automation & Bots · Reports & Insights | CRM side, out of scope for this module |
| **Website CMS** | Overview | ✅ M1 |
| | Sites & Domains | ✅ M2 |
| | Pages | ✅ M3 |
| | Visual Builder | ✅ M4 |
| | Block Library | ✅ M5 |
| | Theme Studio | ✅ M6 / M6.1 |
| | Layouts & Templates | ✅ M7 (master layouts, slot policy, templates, usage) |
| | Menus & Navigation | ✅ M8 (spec: MODULE-8-SPEC.md) |
| | Media Library | ⬜ M9 |
| | Forms & Leads | ⬜ M10 |
| | Publishing & Releases | ⬜ **M11** — owns every publish action in the product |
| | SEO & Redirects | ⬜ |
| | Localization | ⬜ |
| | Security & Audit | ⬜ |
| | CMS Settings | ⬜ |

**Prototype states** (beaker icon, top right) switches the whole app between six regimes, because a state you cannot reach is a state that is not built:

`Default` · `Loading skeletons` · `Empty (no data in range)` · `Error / service down` · `Publish conflict` · `Permission denied (Viewer)`

---

## 7. Architecture

```
wacrm-app/
├── index.html                  dev entry only — explains itself and forwards to the build
├── WACRM-CMS.html              THE deliverable: one self-contained file
├── serve.py                    zero-dependency static server (:4173)
├── package.json                scripts; 2 runtime deps
├── vite.config.ts              react + singlefile plugins
├── checkpoint.sh               build → commit → push → verify
├── push-to-github.sh           push only
│
├── src/
│   ├── main.tsx                entry
│   ├── App.tsx                 provider + shell + hash router
│   ├── styles/app.css          ~4.2k lines: tokens, primitives, every module's CSS
│   │
│   ├── lib/
│   │   ├── data.ts             seeded database: sites, pages, releases, issues, forms …
│   │   ├── store.tsx           AppProvider — async facade, optimistic state, toasts,
│   │   │                       drawers, modals, notifications, route guard, undo where
│   │   │                       it belongs to the shell
│   │   ├── nav.ts              sidebar + placeholder manifests
│   │   ├── cms-pages.ts        M3 page registry: filters, tree, slug rules, seeds
│   │   ├── builder.ts          M4 block registry, 24 section presets, 5 templates,
│   │   │                       the seeded Study Abroad document
│   │   ├── builder-db.ts       draft load/save (CAS), revisions, library reads, AI stream
│   │   ├── builder-images.ts   5 inlined photos used by the seeded document
│   │   ├── builder-handoff.ts  one-shot Pages → Builder handoff
│   │   ├── library-db.ts       M5 catalogue, saved templates, placement index
│   │   ├── theme-db.ts         M6 token document: 13 roles, derived type scale, WCAG
│   │   │                       pair engine, presets, CAS draft save, revisions + diffs,
│   │   │                       v1/v2 import-export, 5-revision seed
│   │   ├── theme-font-data.ts  GENERATED: 50 embedded families (3.2 MB base64 woff2)
│   │   ├── theme-font-catalog.ts GENERATED: the 1,746-family index (metadata only)
│   │   ├── format.ts thumbs.ts helpers
│   │
│   ├── components/
│   │   ├── Shell.tsx           sidebar, nested nav, topbar, palette, notifications
│   │   ├── ui.tsx              Card, Btn, Pill, Drawer, Modal, Menu, Switch, Skeleton…
│   │   ├── Icon.tsx            83 inline SVG icons
│   │   ├── charts.tsx          Sparkline, AreaChart, Donut, Ring, Bars (pure SVG)
│   │   ├── dashboard/          M1 regions, one file each
│   │   ├── sites/              M2 site drawer, connect-domain, domain details/settings
│   │   ├── pages/              M3 tree, inspector, 8 modals
│   │   ├── builder/            M4 Library, Canvas, Inspector, Blocks, AiPanel, modals
│   │   ├── library/            M5 library modals
│   │   ├── theme/              M6 Controls, Preview, Specimen, Overview, Modals
│   │   └── overlays/           DrawerHost, ModalHost, Wizard
│   │
│   └── views/
│       ├── Overview.tsx  Sites.tsx  Pages.tsx  Builder.tsx
│       ├── Library.tsx  ThemeStudio.tsx  Placeholder.tsx
│
├── scripts/
│   ├── handover.mjs            measures git, artifact, inventory, QA → HANDOVER.md
│   ├── package.mjs             zip + md5 verification against the build
│   ├── qa-all.mjs              runs every suite, parses summaries → qa/last-run.json
│   ├── qa-env.sh               extracts Chromium's shared libs into /tmp (no root needed)
│   ├── fetch-theme-fonts.mjs   Google Fonts → embedded set + catalogue + licences
│   └── ensure-font-data.mjs    refuses to build with missing/stale font data
│
├── qa/                         78 WebP captures + last-run.json (never shipped)
└── qa_*.py                     11 Playwright suites
```

**Design constraints that shaped this tree**

- **No runtime dependency beyond React.** Icons are inline SVG, charts are hand-drawn SVG, photos are base64 at build time, fonts are inlined woff2. Nothing is fetched, so nothing can fail offline.
- **Two seams to a backend, and no others:** `lib/store.tsx` and `lib/builder-db.ts` / `lib/theme-db.ts`. Everything else is pure rendering. That is what makes the backend contract a realistic swap rather than a rewrite.
- **One CSS file, one token set.** No CSS-in-JS, no utility framework — the design system is 46 custom properties and a 4 px spacing scale.

---

## 8. How the data behaves

The store is not a static fixture. Every mutation goes through an async facade with **180–600 ms latency**, real ordering rules, and real failure paths:

| Behaviour | Where to see it |
|---|---|
| **Optimistic updates** — rename a site, duplicate a page, insert a block, accept an AI rewrite: KPIs, timelines, inspectors and toasts all follow immediately | any module |
| **Compare-and-swap saves** — `If-Match: baseId`; a stale base returns `409` and opens the conflict modal | builder, theme |
| **Undo/redo** — 40 steps in the builder; undo in the theme studio covers restores and edits | `⌘Z` / `⇧⌘Z` |
| **Draft vs live** — the theme studio's Save writes a *draft*; the live site changes only through a release (M11) | Theme Studio |
| **Revision history** — block-level diffs (builder) and token-level diffs (theme) | both |
| **Read-only mode** — Viewer role disables every mutating control, and says so | Prototype states → Permission denied |
| **Service down** — `502` surfaces propagate to inline error states with retry | Prototype states → Error |
| **Empty** — real empty states, not blank panels | Prototype states → Empty |
| **Loading** — skeletons that match the final layout, not spinners | Prototype states → Loading |

Keyboard: `⌘K` command palette, `⌘S` save, `⌘Z`/`⇧⌘Z` undo/redo, `Esc` closes any overlay, `/` focuses search.

---

## 9. Design system

Tokens declared once in `src/styles/app.css`:

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#F4F5F7` | app canvas |
| `--surface` | `#FFFFFF` | cards, panels |
| `--line` | `#E7E9EE` | borders and dividers |
| `--ink` | `#0C1117` | primary text |
| `--muted` | `#69707C` | secondary text |
| `--brand` | `#6D4AFF` | primary actions, active nav, focus |
| `--green` / `--amber` / `--red` | success / warning / destructive | state only |

Rules the UI follows:

- **Violet is the action colour; green is success only; amber is unsaved/dirty only.** A button is never green because it is important.
- **Numbers are tabular** (`font-variant-numeric: tabular-nums`) so columns do not shimmer.
- **Motion is 150–300 ms** on `cubic-bezier(.16,1,.3,1)`; nothing decorative loops.
- **Spacing is 4 px based**; content width `1120px` with `56px` gutters.
- **Focus is always visible** — 3:1 ring against its background, measured by the theme audit.
- Desktop-first at 1440 × 900; tablet and phone are *preview* viewports, not responsive targets for the admin itself.

---

## 10. Typography and the font library

The Theme Studio's Typography tab is a font product, not a dropdown.

| | Count | Mechanism | Behaviour |
|---|---|---|---|
| **Embedded** | **50 families** — 2.48 MB of woff2 (3.2 MB base64) | real latin-subset woff2, variable-first (one file covers 100–900) | fully selectable, renders **offline**, weight chips are the weights the file actually covers |
| **Indexed** | **1,746 families** — every family Google publishes, minus 212 unlicensed brand fonts | metadata only: category, weights, italic, designer, popularity | searchable, locked, and each row carries **Get** |

**Why 50 and not 1,746.** All of Google Fonts as woff2 is ~70 MB before base64 — impossible in a file that must open by double-click with no network. The cut is Google popularity order, with **18 families pinned** because the product itself references them (seeded documents and every pairing shortcut): Geist, Inter, Poppins, DM Sans, Montserrat, Open Sans, DM Serif Display, Playfair Display, Source Sans 3, Lora, Space Grotesk, Oswald, Roboto, Bebas Neue, Libre Baskerville, Nunito Sans, Raleway, Merriweather. QA asserts all twelve pairing chips resolve, so a shortcut can never point at a face the build cannot render.

**Get — the long tail is one command away.** A locked row opens a panel with the exact command, a copy button, what happens next (*the next build renders it offline*), and the production equivalent (`POST /theme/fonts/{family}/ingest`, `BACKEND-PLAN §7.28.3`). Nothing pretends a font can be fetched at runtime.

**Faces are registered lazily**, one family at a time, only for what is on screen — an eager stylesheet of the whole set would cost megabytes before the first keystroke.

**Licences are recorded per family** in `FONT-LICENSES.md`, generated with the assets: OFL 1.1 for most, Apache 2.0 for Roboto/Arimo/Tinos/Cousine, UFL 1.0 for Ubuntu. Italic and latin-ext are **not** embedded, and the file says so.

**Type scale:** six steps derived from one base (`h1 = base·ratio³` … `caption = base/ratio²`), saved as seven scalars — base, ratio, two leadings, two trackings, a fluid flag — never as six typed sizes. Fluid emits `clamp()` between 420 and 1180 px for h1–h3 only; body copy never shrinks.

---

## 11. Theme Studio internals

The token document is `schemaVersion: 2`:

```jsonc
{
  "schemaVersion": 2,
  "colors":       { 13 roles: primary secondary accent success warning error
                    background surface text muted link border ring },
  "typography": { "heading": {family,weight,fallback}, "body": {…},
                  "scale": { basePx, ratio, leadingHeading, leadingBody,
                             trackingHeading, trackingBody, fluid } },
  "geometry":     { radiusPx, containerWidthPx, spacing: {base, density} },
  "blockStyling": { cardDensity, elevation }
}
```

- **Derived, never stored:** the six type sizes, the `clamp()` strings, `onPrimary`. One function feeds the editor, the preview, the specimen, the export and the release manifest, so they cannot disagree.
- **Contrast engine:** 14 pairs, thresholds per role. Text 4.5:1; marks and focus ring 3:1; **dividers an advisory 1.5:1** (WCAG 1.4.11 exempts decorative rules — the row says "advisory", the ring does not). Warnings are advisory and **never block a draft save**.
- **Import/export:** export writes v2; import reads **1 and 2**. A v1 file gets `muted`/`link`/`border`/`ring` derived from its own palette (`muted = mix(text,bg,42%)`, `border = 86%`) and a default scale, and the review **names every derived field** instead of silently inventing them.
- **Revisions:** the seed carries five real revisions plus live and draft, so a diff shows actual changes rather than identical re-saves. **Restore loads the working copy and does not write** — Save is the only write path, which keeps compare-and-swap and the audit log honest.
- **Specimen:** a Page/Specimen switch in the preview. The specimen renders **1:1 at studio width** (scaled to 42 % it was unreadable, and a specimen you cannot read is not a specimen).

---

## 12. Testing

15 Playwright suites, **1042 assertions**, run against **the built artifact** — never the dev server, never the source.

```bash
source scripts/qa-env.sh     # once per shell: extracts Chromium's libs into /tmp
npm run qa                   # → qa/last-run.json + regenerated HANDOVER.md
```

| Suite | Assertions | Covers |
|---|---|---|
| `qa_states_m1.py` | 39 | M1 loading / empty / error / viewer; layout invariants at 1440 and 1600 |
| `qa_module2.py` | 48 | M2 layout, wizard, DNS verification, SSL, drawer states |
| `qa_states_m3.py` | 40 | M3 states and deep-links |
| `qa_pages.py` | 106 | M3 registry, tree, slug rules, 8 dialogs, bulk actions |
| `qa_states_m4.py` | 47 | M4 states, conflict `409`, viewer, service down |
| `qa_builder.py` | 98 | M4 document model, undo/redo, autosave CAS, revisions, publish hand-off |
| `qa_ai.py` | 60 | AI page generation and in-canvas rewrite, streaming and failure |
| `qa_library.py` | 90 | M5 catalogue, placement index, saved templates, form/consent rules |
| `qa_theme.py` | 241 | M6 + M6.1 + M6.2: roles, contrast maths recomputed in Python, type scale arithmetic, specimen, revisions, v1 import, ten presets, font **download**, complete bundle export, M6 → M4 canvas theming |
| `qa_flows.py` | 38 | cross-module journeys (Pages → Builder → publish, theme → preset → release) |
| `qa_layouts.py` | 99 | M7 geometry, derived KPIs, library, canvas at three widths, saves, slot policy, seed editing, bulk reassign, templates, guarded deletion, preview / preflight |
| `qa_states_m7.py` | 38 | M7 skeleton / slow / empty / error / viewer / CAS conflict / unsaved-leave, protected deletions, M3 + M4 interlinks |
| `qa_react.py` | smoke | renders the file and fails on any React warning or console error |

**What the suites are for.** They are not coverage theatre: each one asserts computed values (contrast ratios recomputed independently in Python, type sizes recomputed from base × ratio, diff rows, `document.fonts.check` for real face registration), so a regression in the *maths* fails, not just a missing selector.

`qa/last-run.json` is machine-readable evidence; `HANDOVER.md` quotes it and `npm run qa:check` fails CI when the handover is stale.

**Set-up for the suites** (only needed once per machine): `source scripts/qa-env.sh` installs Playwright and extracts Chromium's shared libraries into `/tmp` — the sandbox has no root, and `/tmp` is wiped between sessions, so re-run it whenever a browser fails with "error while loading shared libraries".

---

## 13. Handover automation

`HANDOVER.md` is **generated, never hand-written**. It carries module status, the measured artifact (bytes, gzip, md5), QA tallies, the source inventory, locked decisions, next tasks and the traps that cost time last time.

```bash
npm run handover     # regenerate from handover.config.json + live repo facts
npm run qa           # run suites → last-run.json → regenerate
npm run qa:check     # exit 1 if HANDOVER.md is stale (CI gate)
```

- `handover.config.json` is the **human-owned half**: intent, decisions (D1–D28), next steps, traps, contracts. Edit it; never edit the markdown.
- `scripts/handover.mjs` measures everything else (git, artifact hashes, file inventory, QA tallies), so the document cannot quote a stale number.
- `.githooks/pre-commit` regenerates and stages the handover, so a commit can never carry a stale one. Enable once per clone: `git config core.hooksPath .githooks`.

---

## 14. Packaging

```bash
npm run package      # → ../wacrm-app.zip
```

3.82 MB, 117 files. It contains the single-file app, the source, the docs and the mocks. It **omits** two things on purpose, and says so when it runs:

| Omitted | Why |
|---|---|
| `src/lib/theme-font-data.ts`, `theme-font-catalog.ts` | 3.4 MB of generated base64 — regenerable with `npm run fonts`, and present in Git |
| `qa/` | captures are evidence for whoever runs the suites, not for whoever reads the zip |

The package step **verifies itself**: it unzips `WACRM-CMS.html` back out and compares md5 with the build in the working tree, failing if they differ. A stale zip is worse than no zip.

---

## 15. Git workflow

**This repository is the app folder.** There is no second clone and no mirror step — one working tree, one `.git`, so no artifact is stored twice (`STORAGE.md`).

```bash
./checkpoint.sh "what changed" [optional-tag]
```

1. **Build** — `npm run build` when `node_modules` is present, otherwise regenerate the handover and the zip.
2. **Commit** — the pre-commit hook regenerates `HANDOVER.md`, refuses deletions under `uploads/`, and refuses any GitHub credential pattern.
3. **Push** — fetches, **refuses a non-fast-forward**, pushes `main` and all tags, then compares `git ls-remote` with the local head and fails loudly if they differ.
4. **Report** — prints the tree, `.git` and zip sizes.

| Tag | State |
|---|---|
| `module-1-and-2-import` | M1 + M2 as first committed |
| `module-2-complete` | M2 rebuild verified |
| `module-3-complete` | M3 verified |
| `module-4-complete` | M4 builder verified |
| `module-4-ai` | AI mode verified (`qa_ai.py` 60) |
| `module-5-complete` | M5 block library merged |
| `m6-theme-studio` | M6 Theme Studio verified (127 assertions) |
| `m6-theme-studio-benchmark` | the competitive study only, no code |
| `m6.1-theme-studio` | M6.1: type scale, roles, specimen, revisions, fonts (189) |
| `m6.1-slim` | right-sized: top-50 fonts, one repository (198) |

**Credentials** are never in the repository: `checkpoint.sh` reads `/home/user/.gh-token` (mode `0600`, outside the tree) or `GH_TOKEN`/`GITHUB_TOKEN`, and warns before the token expires. `.git/config` carries no secret; the push URL is built per run.

---

## 16. Documentation index

| File | What it is |
|---|---|
| `START-HERE.txt` | the one-minute version of this README |
| `HANDOVER.md` | **generated** handover: status, measurements, decisions, next tasks, traps |
| `BACKEND-PLAN.md` | the full backend contract — schema, every endpoint and CTA, RBAC, publishing with CAS, jobs, SLOs, security, build order (§7.27 Theme Studio, §7.28 its v2 document and font pipeline) |
| `INTERLINK-PLAN.md` | the decided CMS ⇄ CRM architecture (D1–D8) and the block → trigger → action matrix |
| `AI-BUILDER-SPEC.md` | AI mode: three tasks, plan-then-compose pipeline, every state, endpoint contract |
| `STATE-COVERAGE.md` | state matrix per module, with the trigger and the contract for each state |
| `MODULE-1-REVIEW.md` | M1 build-vs-spec review |
| `MODULE-2-SPEC.md` | the **accepted v2** layout for Sites & Domains |
| `MODULE-3-REVIEW.md` | M3 review |
| `MODULE-4-REVIEW.md` | M4 review |
| `MODULE-5-BLOCK-LIBRARY-SPEC.md`, `-GAP-REVIEW.md`, `-DECISIONS.md`, `-MOCK-AUDIT.md`, `-REVIEW.md` | M5: spec, gaps, decisions, mock audit vs the industry, review |
| `MODULE-6-THEME-STUDIO-SPEC.md`, `-GAP-REVIEW.md`, `-DECISIONS.md` (D1–D16), `-UI-UX-REVIEW.md` | M6 |
| `THEME-STUDIO-BENCHMARK.md` | the 35-point competitive matrix (Shopify, Elementor, Framer, Squarespace, Material 3, shadcn, DTCG) and gaps G1–G9 |
| `MODULE-6.1-SPEC.md`, `-DECISIONS.md` (D1–D17), `-UI-UX-REVIEW.md` | M6.1 |
| `FONT-LICENSES.md` | **generated** per-family licence register for the embedded set |
| `STORAGE.md` | where the bytes go, and why the workspace is 52 MB rather than 140 |
| `SPEC-AUDIT.md` | dissection of the reference mocks |
| `ROLLBACK.md` | tags, revert recipes, what each release contains |
| `PUSH-TO-GIT.md` | the exact state of the remote, with hashes |
| `uploads/` | the reference mocks the product was specified against, with a manifest |

---

## 17. Backend: what exists and what doesn't

**The backend is deliberately not built.** Every interaction in this repository is a *contract*: `BACKEND-PLAN.md` defines the tables, endpoints, payloads, status codes, RBAC rules and job states behind every button, so the front end can be connected without redesigning it.

Representative surface, from the plan:

```
GET    /sites · /sites/{id}/domains · /pages?site=…&status=…
POST   /sites · /sites/{id}/domains · /sites/{id}/domains/{d}/verify
PUT    /pages/{id}/draft            If-Match: baseId            → 409 on stale
POST   /pages/{id}/revisions/{rev}/restore
PUT    /theme/{site}/draft          If-Match: baseId            → 409 on stale
POST   /theme/import/validate                                    → errors + warnings + derived
POST   /theme/{site}/restore-preview { revisionId }
POST   /theme/fonts/{family}/ingest                              → 202 + job id
GET    /theme/fonts?state=&category=&q=&cursor=
POST   /releases                    the only route that makes anything live
```

Rules baked into those contracts, and into the UI:

- **Nothing publishes except a release.** There is no "publish page" and no "publish theme" endpoint; `site_release_manifest` is the single write that makes anything live.
- **Contrast findings are advisory.** They are stored on the revision and shown in the release review; they never block a draft save.
- **Restore never writes.** It returns a token document; the user's Save is what creates a revision.
- **RBAC is per capability**, not per screen: edit, publish, preset delete and theme import are separate rights.
- **Audit rows** are written for every mutation, including imports, restores and font ingests.

---

## 18. Roadmap

M7 is built (`#/layouts`, 99 + 38 checks) — see `MODULE-7-BUILD.md` for what shipped and
the honest deltas. M8 Menus & Navigation is rebuilt to the owner's three mockups and spec v1.1 §31 (`#/menus`; 69 checks in `qa_m8_menus.py`, 35 in `qa_m8_v3.py`) — see `MODULE-8-SPEC.md`. The v1.1 text was not saved verbatim; a working copy is in the file and the owner should re-paste it.
The remaining modules are below.

> **Open conflict (not resolved here):** the table below lists Menus & Navigation as unsequenced,
> "after M11". The sidebar places it under Manage, and it was built now because the owner asked
> for it. The owner should decide whether M8 keeps its place before M11 or moves back.

| Module | Scope | Depends on |
|---|---|---|
| **M9** | **Media Library** | — |
| **M10** | **Forms & Leads** — CRM-imported forms, consent policy | M5 |
| **M11** | **Publishing & Releases** — the only place anything goes live | everything |
| unsequenced | SEO & Redirects · Localization · Security & Audit · CMS Settings | after M11 |

**Deliberately not built** (researched, ranked, unapproved — Tier B of the benchmark): dark mode / colour modes, palette generation, DTCG token export, an APCA column, partial presets. And nothing publishes anywhere in the product until M11.

---

## 19. Troubleshooting and known issues

### `npm run dev` showed a blank page with a React hooks error (fixed)

**Symptom:** the Vite dev server starts, then the page throws `Rendered fewer hooks than expected` (and logs `Do not call Hooks inside useEffect(...), useMemo(...)`), leaving a partial DOM.

**Status:** fixed. It was a hook-order violation that React's development build enforces and the production build tolerates. The shipped artifact was never affected; it runs the built file.

**Workaround:** use the build. `npm run build && open WACRM-CMS.html`, or `python3 serve.py` for an `http://` origin. If you are editing source and need a live origin, `npm run build && npm run preview` serves the production bundle from `dist/`.

**Fixed.** The cause was a `useCallback` (`setRange`) called inside the `useMemo` that builds the store value in `src/lib/store.tsx`, so the hook count changed between renders. It now lives at the top level of the provider. `npm run dev` renders every route with no console errors; the production build never showed it because it tolerates the violation.

### The browser says "error while loading shared libraries: libnspr4.so"

Only affects the QA suites. Chromium's shared libraries live in `/tmp`, which is wiped between sessions:

```bash
source scripts/qa-env.sh
```

### `file://.../dist/index.html` shows a blank page

By design. `dist/index.html` is Vite's build output; the dev entry explains this and forwards. Always open **`WACRM-CMS.html`**.

### `tsc: not found` or a missing `node_modules`

The workspace does not persist `node_modules`. Run `npm ci` — it takes a few seconds and is the reproducible path.

### A build fails with "theme-font-data.ts is missing / is the old stub"

The generated font asset is not in place:

```bash
git checkout -- src/lib/theme-font-data.ts   # restore from Git
npm run fonts                                # or regenerate from Google Fonts
```

### The artifact is 4.75 MB — is that right?

Yes. It carries 50 embedded font families (2.48 MB of woff2 → ~3.3 MB of base64). Widening the set adds roughly 65 KB of artifact per family; `STORAGE.md` explains the trade and how to change it.

### Nothing is fetched from the network — how do I confirm?

Open the file, then DevTools → Network → reload: there are no external requests. The suites do the same thing with every request blocked, and fail if anything is requested.

---

## 20. Working rules this project follows

These are not aspirations; they are the constraints the build was held to, and the reason it looks the way it does.

1. **One module at a time** — the screen, every CTA and dropdown, and every operation state. Nothing ships half-wired.
2. **Every state is reachable and code-backed** — loading, empty, error, viewer, conflict, permission denied.
3. **The artifact opens by double-click** — single file, no build, no server, no network.
4. **No backend until the backend is scoped** — interactions are contracts, not stubs.
5. **Nothing publishes outside a release** — publishing is Module 11's job alone.
6. **Match the mock** — typography, spacing, alignment, full-screen fit.
7. **Every module ships with a written spec and review**, and gaps are listed *before* the build, not after.
8. **Every build regenerates the handover, the zip and the commit** — a deliverable that exists only on this machine is not a deliverable.
9. **Verified, not assumed** — measured artifact hashes, recomputed accessibility maths, and `git ls-remote` for the remote state.
10. **Honest limits** — fonts that cannot be embedded are listed with the reason, contrast warnings stay visible rather than suppressed, and the dev-mode defect above is documented rather than hidden.

---

*Built with React 19 + TypeScript (strict) + Vite 7. Built artifact and zip sizes are regenerated by `npm run package`; last measured state: 15 suites / 1042 assertions green.*
