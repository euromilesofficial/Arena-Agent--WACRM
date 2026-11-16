# State coverage — Modules 1, 2, 3, 4 & 7

Every state below is code-backed in `WACRM-CMS.html` (React 19 + TS build; all reads go through `src/lib/data.ts`, which adds latency and failure paths, so nothing is a static mock in the view layer).

| Audit | Covers | Result |
| --- | --- | --- |
| `qa_states_m1.py` | Module 1 — Overview states, drilldowns, publishing, permissions, guards | **39/39** |
| `qa_states.py` | Module 2 — Sites & Domains states | **25/25** |
| `qa_module2.py` | Module 2 layout, geometry, data consistency, overflow | **48/48** |
| `qa_flows.py` | cross-module flows: navigation, publish wizard, palette, drawers | **38 ok / 0 failed** |
| `qa_pages.py` | Module 3 — Pages & Routes: registry, tree, inspector, 8 modals, guards, deep links, 3 widths | **106/106** |
| `qa_states_m3.py` | Module 3 — loading, empty, 503, conflict, viewer, empty trash, stale inspector, bulk partial failure, undo | **40/40** |
| `qa_builder.py` | Module 4 — Visual Builder: 3 panels, header, status strip, library (19/23/5), stage, inspector, drag, AI, autosave, publish, revisions, 3 widths | **97/97** |
| `qa_states_m4.py` | Module 4 — skeleton, empty page, draft failure, viewer, CAS conflict, save failure, AI error/abort, empty catalogue, deleted page, publish guards, reduced motion, keyboard, dialog dismissal | **47/47** |
| `qa_layouts.py` | Module 7 — geometry, derived KPIs, library, canvas at three widths, inspector saves, policy, seed editing, bulk reassign, templates, guarded deletion, preview/SEO/preflight, keyboard | **99/99** |
| `qa_states_m7.py` | Module 7 — skeleton, slow transport, empty, error + retry, Viewer, CAS conflict, unsaved-leave guard, protected deletions, M3 and M4 interlinks, cold deep links | **38/38** |

**Triggering states by hand:** open `WACRM-CMS.html`, then use the `Prototype states` menu (beaker icon, top-right) for Default / Empty (no data in range) / Error / Publish conflict / Permission denied (Viewer). Everything else happens by clicking.

---

## Module 1 — Overview

| # | State | What you see | How to reach it | Backend contract |
| --- | --- | --- | --- | --- |
| 1 | Loading | 79 shimmer blocks on the content grid, same row heights as the real cards | first paint (~0.8 s) or `Prototype states → Loading` | `GET /v1/analytics/overview` |
| 2 | Refreshing | every region keeps its data; `syncing` cue in the header while the new window loads | change the date range | same endpoint, revalidated |
| 3 | Analytics down (partial failure) | red strip `Analytics service unavailable (502)` + `Retry`; **9** analytics regions each render their own failure card with a `Retry`; **Publishing, Site Health, Your Websites, Recent Activity stay live** | `Prototype states → Error` | `502` on the analytics service only |
| 4 | Retry recovers | failed regions repopulate, the strip disappears | `Retry` | retry with backoff |
| 5 | Empty range | range-scoped KPIs go to 0, LCP shows `—`; chart `No traffic recorded for this period`; funnel 0 at every stage; acquisition `0 Visitors` with `—` sources; `No pages tracked yet`; rail shows 0 starts / 0 submissions / 0 % / 0 of 40 | `Prototype states → Empty (no data in range)` | `200` with an empty series |
| 6 | Publishing conflict | `Publish conflict detected` modal naming the competing release and which pages were edited, with `Reload latest` and `Rebase & publish` | `Prototype states → Publish conflict`, or a live 409 during publish | `409 RELEASE_CONFLICT` |
| 7 | Viewer / permission denied | violet read-only strip; **4** write controls disabled, including `Release` and the two publish segments; blocked clicks open nothing | `Prototype states → Permission denied (Viewer)` | `403` on any write |
| 8 | Publish wizard | 3 steps: choose changes → `Freeze manifest · N pages` → `Publish v1.25` → `Release v1.25 is live` | `Release` / `Preflight` | `POST /v1/releases`, `POST /v1/releases/{id}:publish` |
| 9 | Invalid date range | `Dates are in the future` / `Check the dates` warning, popover stays open for correction, the window is not applied | custom range in the date picker | client-side guard |
| 10 | Single-site scope | every region refetches for one website, the scope button shows its name | website dropdown | `?site=` |
| 11 | Archive guard | dialog naming what archiving unpublishes before it happens | site card `⋯` → Archive | `422 DEPENDENTS` |
| 12 | Drilldowns | KPI, funnel stage, acquisition channel, site health and vitals each open a drawer with its own numbers and trend | click any KPI / row | `/v1/analytics/*` |
| 13 | Overlays | command palette (`⌘K`), notifications with unread state, quick create, workspace and profile menus | keyboard / header icons | `/v1/search`, `/v1/notifications` |
| 14 | Layout | no horizontal overflow at 1280 / 1440 / 1600, with overlays open | resize | — |

### Fixed in this audit (they were real, not cosmetic)

- **The future-date guard never fired.** `offsetOf()` clamped negatives to 0, so `offsetOf(d) < 0` was always false and a 2026 range applied silently, leaving the dashboard on a window the dataset has no data for. The guard now compares unclamped day offsets.
- **The Empty state showed stale numbers.** `Prototype states → Empty` only flipped a flag; the payload was never refetched, so full KPIs stayed on screen. Forced states now refetch.
- **The rail contradicted the KPIs.** With leads zeroed, Form Performance still read `112 starts / 26 submissions / 23.2%` and Goal Tracking `26 / 40` — both hard-coded to "Last 30 days / This month" while the toolbar said something else. Empty now zeroes forms and goals too, and both cards label themselves with the selected range.
- **LCP survived an empty range** as `2.1s` (with a footnote claiming no telemetry). It now renders `—`, in the KPI and in Performance Snapshot.
- **`Release` was not role-gated** — a Viewer could still open the publish wizard. Publish segments, `Release`, `New Website`, `Create a page`, `Rename` and `Duplicate` are now gated, with a read-only strip explaining why.
- **Site cards mixed lifetime and range numbers** silently; the lead count now says "Leads all time".

### Still not modelled in Module 1

- **Per-widget refresh** — regions share one request; there is no per-card `↻`.
- **429 / rate-limit state** on analytics re-fetch.
- **Slow upstream (>5 s)** — no "still loading, taking longer than usual" copy on the skeleton.
- **Timezone mismatch warning** for scheduling.
- **Editor role** exists in `can()` but has no distinct visual state (same treatment for Editor and Viewer strips).

---

## Module 2 — Sites & Domains

| # | State | What you see | How to reach it | Backend contract |
| --- | --- | --- | --- | --- |
| 1 | Loading | 22 skeleton blocks in the registry card, KPI and inspector boxes keep their geometry | reload (1.4 s) or `Prototype states → Loading` | `GET /v1/sites`, `/v1/sites/domain-summary` |
| 2 | Refreshing | rows stay, `syncing…` in the registry footer, `Synced just now` on resolve | `Refresh` | revalidation |
| 3 | Error | red strip `Sites and domains service unavailable (503)` + `Retry`, last good rows kept | `Prototype states → Error` | `503` |
| 4 | Empty workspace | counters 0, `Create Your First Website`, empty connected-domains, inspector hint | `Prototype states → Empty` | empty collections |
| 5 | No results | `No websites match your filters` + `Clear Filters`; scope, search and pills survive | type `zzz` | client-side |
| 6 | Viewer / read-only | violet strip, 10 write controls disabled, pills and row menus inert | `Prototype states → Viewer` | `403` |
| 7 | DNS unverified | amber `Pending`, records copyable, steps 1–2 pending | seeded — Partner Portal | `dns_status: pending` |
| 8 | DNS checking | row pill becomes a pulsing `Checking…` for the request's duration | DNS pill / `Verify Again` | `202` + job |
| 9 | DNS failed | red `Failed` on row, tile and inspector; steps 1–2 red with the resolver reason; retry clears it | `Verify Again` (18 % failure) | `{status:"failed", reason}` |
| 10 | Certificate held | step 3 states the certificate waits for DNS; TLS never claims `Active` over a failed DNS | follows #9 | job dependency |
| 11 | TLS provisioning | amber pill, step 3 pulsing | verify a pending host | `202` |
| 12 | TLS active | green pill, issuer + expiry in the SSL tab | seeded ×3 | `cert.status: active` |
| 13 | TLS failed | red pill, cause, `Issue certificate` retry | `Connect Domain` on a new host | `cert.status: failed` |
| 14 | No domains | `Not connected` / `No alias` / `—` / `—`, `+ Connect` affordance, no invented hostname, DNS-tab empty state | create a website without a domain | empty domain list |
| 15 | Partial failure | `2 domains need attention — … and 1 more`, `Review & Fix` | first load | `/v1/sites/domain-summary` |
| 16 | Destructive guard | dependency summary + typed confirmation + a blocked state that explains itself | row menu → Delete | `409` / `422` |
| 17 | Success | toast, counters update from the refetch — never optimistically | any write | `200` / `201` |
| 18 | Inspector ↔ drawer | inline ≥ 1200 px, drawer below, `Esc` closes; SSL pill lands on the SSL tab | resize under 1200 px | — |

### Still not modelled in Module 2

- **429 rate limit** — verification is throttled 1/min per host in the backend plan; the UI just re-enables the button.
- **409 hostname conflict inline** — a duplicate hostname fails as a toast, not as a field-level error.
- **Stale cache indicator** — `Synced 2 min ago` exists, no "served from cache" signal.
- **Failure list beyond the strip** — `and N more` names the worst host; there is no expandable list of all failures.
- **TLS `expiring` / renewal failure** — label and colour exist, no seed reaches them.

Each gap has a contract row in `BACKEND-PLAN.md` §7.17, so they are additions rather than redesigns.

---

## Module 3 — Pages & Routes

48 pages on EuroMiles Main: **42 published / 6 drafts / 2 in trash**, gauge `42/48 → 88 %`. Three pages carry unpublished changes (`Home`, `Study Abroad`, `Available Scholarships`); 6 issue instances across the site.

| # | State | What you see | How to reach it | Backend contract |
| --- | --- | --- | --- | --- |
| 1 | Loading | 48 skeleton cells in the registry, 8 in the tree, skeleton in the inspector, tab counts show `·` | first paint (~0.6 s) or `Prototype states → Loading` | `GET /v1/pages`, `/v1/page-tree` |
| 2 | Refresh | rows stay, `syncing…` in the status bar, `Synced just now` on resolve | any mutation, `Refresh Structure` | revalidation |
| 3 | Service down | red strip `Pages service unavailable (503) — the hierarchy and registry below hold their last known state.` + `Retry` | `Prototype states → Error` | `503` |
| 4 | Empty website | KPI zeros, gauge `—`, `No pages yet · Create your first page`, tree `No pages yet.`, inspector hint | `Prototype states → Empty` | empty collection |
| 5 | No search results | `No pages match your search` + `Try a different keyword…` | type `zzz` | client-side |
| 6 | Empty trash | `The trash is empty · Deleted pages stay recoverable here for 30 days` | a website with nothing deleted | `?tab=trash` |
| 7 | Tree no-match | `No page matches that search. Clear search` | tree search `zzz` | client-side |
| 8 | Viewer / read-only | violet strip, `New Page` + every edit/restore/delete control disabled, row menus inert, inspector note | `Prototype states → Permission denied (Viewer)` | `403` |
| 9 | Selected page gone | inspector replaces itself with `This page is no longer available` + `Refresh list` | `#/pages?sel=pg_does_not_exist`, or deleting the page in another tab | `404` |
| 10 | Slug taken | inline `This URL is already used by “About Us” on this website.`, `Continue` disabled | create a page with `about-us` | `409 PATH_TAKEN` |
| 11 | Invalid / reserved slug | inline rule from `slugify` / `validateSlug` (`api`, `cms`, `preview` are reserved) | type `API` | `422 VALIDATION` |
| 12 | Route change | `Route change: /a → /b · N internal links point here. A 301 redirect will be proposed` inside the edit modal | change the slug of a page with inbound links | `409` + redirect proposal |
| 13 | Stale save | conflict banner naming the other editor, `Reload theirs` / `Keep mine` | `Prototype states → Publish conflict`, then save any edit | `409 REVISION_CONFLICT` |
| 14 | Homepage guards | `Set as Homepage` hidden on the homepage itself; `Move`/`Trash` disabled with a `homepage` note; trash modal explains the one-homepage rule | open the menu on `Home` | `422 HOME` |
| 15 | Parent with children | trash refuses per page: `3 child pages must be moved first: Study in Italy, …` | bulk-trash `Study Abroad` | `422 CHILDREN` |
| 16 | Move cycle | the page's own subtree is not offered as a new parent; the move button stays disabled until the parent changes | `Move Page…` on any branch | `422 CYCLE` |
| 17 | Bulk partial failure | confirm lists every selected page, failures are reported one by one, successes still land | select a branch + a leaf → `Move to Trash` | per-page result |
| 18 | Delete permanently | separate confirm (`Delete Page Permanently? · This cannot be undone`), no undo offered, links warned about | trash tab → `Delete` | `DELETE /v1/pages/{id}?hard=1` |
| 19 | Restore | modal states the recoverable-until date (`Jun 29, 2025`), restored page returns as a **draft**, `Undo` on the trash toast | trash tab → `Restore Page` | `POST /v1/pages/{id}:restore` |
| 20 | Preview | signed `pv_…` URL, `noindex, nofollow`, 15-minute life; expired token renders `The preview token expired` + `Regenerate` | toolbar `Preview` (8 % of calls expire on purpose) | `POST /v1/pages/{id}:preview` |
| 21 | Builder handoff | Module 4 screen: block rail, document outline, hand-over context (page, route, template, layout, revision), `Preview draft` / `Back to Pages` | `Edit Page` on any row | Module 4 scope |
| 22 | Deep links | `#/pages?site=&tab=&q=&page=&sel=` restore the exact view on a cold load; the URL tracks every change | paste a link | — |
| 23 | Layout | no horizontal overflow at 1280 / 1440 / 1920; the route column and author filter collapse below 1360 px; the inspector is inline at ≥ 1200 px | resize | — |

### Fixed in this audit (Module 3)

- **A trashed row acted on the previously selected page.** Restore/trash/edit modals read `selectedPage`, so opening the row menu on a trashed row restored whatever page was selected before. Modals now carry their own target (`{ kind, page }`).
- **A stale detail response could overwrite the newest selection.** `loadDetail` had no request token; switching pages quickly (or creating a page) could leave the inspector on the previous page. Responses are now sequenced and only the newest wins.
- **Trashing a page reported “deleted permanently”.** The API mutates the page object in place, so `modal.page.trash` was already true by the time the toast was built. The modal reports the mode it ran in.
- **Bulk actions could touch a page you had filtered away.** The selection is now pruned to the visible result set on every load.
- **Creating a page left the inspector on the old page and could hide the new one.** Creation clears every narrowing filter, jumps to page 1 and focuses the new row.
- **The site registry said 48 pages while Pages said 49.** The seed and `sites.pages` now agree (48 live + 2 trashed, counts exclude trash).
- **`Expand All` / `Collapse All` were toasts only.** They now drive the tree through explicit signals.
- **Deep links were documented but not parsed.** `#/pages?…` is read before first paint and kept in sync afterwards.

### Still not modelled in Module 3

- **Multi-select drag on the tree** — moving pages is a dialog, not drag-and-drop.
- **Scheduled publishing per page** — publishing stays a release-level action (Module 6).
- **Per-page revision history** — the menu item names the module that owns it.
- **Locale switcher** — single locale by decision (D9); the row is read-only.
- **Search across websites** — search is scoped to the selected website.
- **Unsaved-changes prompt** in the builder handoff — there is nothing to lose yet (Module 4).

Each gap has a contract row in `BACKEND-PLAN.md` §8.

---

## Module 4 — Visual Builder

One screen, three panels, no fourth rail. Everything below is code-backed in `WACRM-CMS.html`; the document, autosave, revisions, presence and AI stream all go through `src/lib/builder-db.ts`, which adds latency and failure paths, so no state is a static picture.

| # | State | What you see | How to reach it | Backend contract |
| --- | --- | --- | --- | --- |
| 1 | Loading | panel-shaped skeleton (header, 3 library groups, stage, inspector) at the real row heights; no layout shift on swap | first paint, or navigate in again | `GET /v1/pages/{id}/draft` |
| 2 | Empty page | stage shows `This page is empty` + 3 CTAs; the first CTA switches the library to Blocks and focuses the search; the canvas is a live drop target | `Prototype states → Empty`, or `+ Add block` on a fresh page | `200` with `document: []` |
| 3 | Draft load failure | blocking card naming the page and the reason, `Retry`; the shell stays usable (library and inspector render, nothing is editable) | `Prototype states → Error` | `5xx` on the draft read |
| 4 | Viewer / read-only | `.wb-readonly`, violet strip, every field and tile disabled, `Publish` disabled with a reason, selection still works so the page can be inspected | `Prototype states → Permission denied (Viewer)` | `403` on any write |
| 5 | Autosave → saved | strip goes `Unsaved` → `Saving…` → `Draft saved · 2:44 AM` only when the write is acknowledged; 2 s debounce | type in any inspector field | `PATCH …/draft` `If-Match` |
| 6 | CAS conflict | `This draft was saved elsewhere` with the competing editor, `Reload theirs` / `Keep mine`; the local draft survives either way and the strip returns to saved | `Prototype states → Publish conflict`, then edit | `409 REVISION_CONFLICT` |
| 7 | Save failure | strip `Save failed` (`data-status="failed"`), `Retry` inside the pill, and a leave guard offering `Stay here` / `Retry save`; retry succeeds on the second attempt | `Prototype states → Error` while editing | `5xx` on `PATCH` |
| 8 | Undo / redo | 40-step history, both buttons disable at the ends, ⌘Z / ⇧⌘Z, toasts name the step | any structural edit | client-side |
| 9 | Device morph | 1440 / 768 / 375 with the frame resizing and the document reflowing; mobile collapses the nav to a hamburger and stacks the hero | the three device buttons | view state |
| 10 | Zoom | 50 / 75 / 100 / 125 / Fit; `Fit` measures the stage (640 px at 1440) and never changes the document | zoom select | view state |
| 11 | Library tabs | `Blocks` 19 tiles in 5 chips with computed counts (Content 9 · Media 2 · Layout 4 · Form 4 · Actions 2), `Sections` 23 presets in 5 categories, `Pages` 5 templates + Saved Pages + Current Page Structure | the three tabs | `GET /v1/library/*` |
| 12 | Insertion | click a tile, or drag it onto a drop zone with a guide line and an insertion index; a refused drop explains itself (`A Form cannot sit inside a Columns row`) | drag a Form tile into a column | client-side + `PATCH` |
| 13 | Selection | block outline, context toolbar (duplicate / move up / move down / delete / drag), inspector follows, structure row highlights, `Escape` walks the selection back one level | click a block | view state |
| 14 | Inspector | `Content` generated from the registry, `Style` token-bounded with `Inherited` / `Override`, `Advanced` 5 live controls + 4 locked with the reason | the three tabs | `PATCH` on change |
| 15 | AI copy | bubble with `Improve` / `Make punchier` / `Shorten`, token-by-token stream, `Accept` / `Regenerate` / `Discard`, `Escape` aborts mid-stream and the draft is untouched | select a text element | `POST /v1/ai/copy:stream` |
| 16 | AI failure | `[data-ai-stream="error"]`, `Nothing was changed`, `Accept` disabled, `Discard` closes | `Prototype states → Error` then ask the assistant | `502 AI_UNAVAILABLE` |
| 17 | Publish guard | with unsaved edits, `Publish` opens the review with `Save your changes before publishing` and a single `Save first` action; nothing is released | edit, then Publish | `409 DRAFT_DIRTY` |
| 18 | Publish review | `IN THIS RELEASE` lists the editing page plus every other unpublished page, preflight 4 checks, compare-and-swap note, `Publish release` → Module 1 toast + live badge | header `Publish` | `POST /v1/releases` |
| 19 | Revision history | list with author, time and block diff (`+3 −1 ~2`), preview of the diff, `Restore` writes a new revision | `Publish` split → `Release & revision history` | `GET/POST …/revisions` |
| 20 | Presence | banner names other editors working on the same page; advisory only, it never blocks a save | `Prototype states → Publish conflict` | `GET …/presence` (SSE) |
| 21 | Empty catalogue | `No blocks available` with the reason and a `Reload catalogue` action; group headings disappear rather than render empty | `Prototype states → Empty` + library | `200 []` on `/v1/library/blocks` |
| 22 | Empty form picker | a Form block with no forms explains itself and links to Forms & Leads instead of offering an empty select | `Prototype states → Empty`, select the Form block | `200 []` on `/v1/forms` |
| 23 | Deleted page | blocking `wb-blocked` state: `This page no longer exists`, `Back to Pages`, `Nothing was lost`; a page switch clears it and a successful load re-enables the shell | `#/builder?page=pg_does_not_exist`, or delete the page in another tab | `404 PAGE_GONE` |
| 24 | Dialog dismissal | `Escape` closes publish / revisions / conflict / pickers and keeps the block selection; the builder's own shortcuts stand down while a dialog owns the key | open any dialog, press Escape | — |
| 25 | Reduced motion | every transition collapses to ~0 s (`animationDuration ≈ 1e-05`), no parallax, no auto-scroll animation | OS setting | — |
| 26 | Keyboard | tile focus + `Enter` inserts, structure rows select, inspector fields type, dropdowns arrow-navigate | Tab through the screen | — |
| 27 | Empty search | `No blocks match “zzzz”` with a `Clear search` action, counts unchanged | type in the library search | client-side |
| 28 | Deep link | `#/builder?site=&page=&sel=&lib=&insp=` restores the exact panel state on a cold load and survives the store's own hash rewrite | paste a link | — |
| 29 | Layout | no horizontal overflow at 1280 / 1440 / 1920; library 250 px and inspector 292 px stay fixed while the stage takes the remainder (560 / 674 / 1146); the shell never scrolls, only the panels do | resize | — |

### Fixed in this audit (Module 4)

- **The builder CAS conflict hijacked the Module 1 publish dialog.** The store opened its release-conflict modal on any conflict; it is now gated to every screen except the builder, which owns its own resolution.
- **`Escape` did not abort a running AI suggestion.** The key was consumed by the selection chain; the stream is now cancelled explicitly and the draft is left untouched.
- **An empty catalogue still rendered its group headings.** The flag was read from the demo state instead of the builder's own mode, and `Library` rendered `GROUP_ORDER` unconditionally; both are fixed.
- **A deleted or unknown `page=` silently swapped to another page.** It now opens a blocking state naming the page, with `Back to Pages`, instead of quietly editing something else.
- **`Escape` never closed a builder dialog.** The builder's global key handler re-rendered on the same event, which removed the dialog's listener before the browser dispatched to it; the handler now stands down whenever an overlay owns the key.
- **Deep links looked broken.** A hash-only `goto` does not reload, so the restored document was never composed; the builder re-asserts its query string after the store's hash effect, and the QA harness reloads before asserting.

### Still not modelled in Module 4

- **Co-editing** — presence is advisory; two people editing the same block is a conflict, not a merge.
- **Page-level SEO fields** — the inspector stops at content, style and advanced (non-goal).
- **Repeaters / dynamic lists** — every block is static content.
- **Staging and scheduling** — publishing is a release-level action owned by Module 1.
- **Marketplace and custom code** — the library is a fixed catalogue; there is no raw HTML/CSS/JS surface.
- **Drag between windows / cross-page copy** — drag is within one document.

Each gap has a contract row in `BACKEND-PLAN.md` §7.19.

---

## Module 7 — Layouts & Templates

| # | State | What you see | How to reach it | Backend contract |
| --- | --- | --- | --- | --- |
| 1 | Loading | five skeleton rows in the library and a skeleton stage; the header, KPIs and slot bar render immediately | first paint, or `Prototype states → Loading skeletons` | `GET /v1/layouts?site=` |
| 2 | Slow transport | skeletons persist ~4× longer; nothing on screen pretends to be data | `Prototype states → Loading skeletons` | same, with injected latency |
| 3 | Empty | only the website default survives, the templates tab shows `No templates` with a create action, counts drop to 1 / 0 | `Prototype states → Empty (no data in range)` | `200` with one layout, no templates |
| 4 | Service down | the library shows `Could not load` with the reason and `Retry`; the stage shows the error card; retry recovers | `Prototype states → Error / service down` | `503` on `/v1/layouts` |
| 5 | View-only | create / rename / variant select / save disabled; menus still open so capabilities are discoverable | `Prototype states → Permission denied (Viewer)` | `403` on any write |
| 6 | CAS conflict | `This layout moved while you were editing` with your copy vs theirs and three resolutions (keep editing, overwrite, load theirs) | edit a layout while `Prototype states → Publish conflict` | `409 LAYOUT_REVISION_STALE` |
| 7 | Unsaved leave | `Save your changes first?` when switching layouts, with Stay / Discard and leave | edit a region variant, then pick another layout | — |
| 8 | Refused deletion | the dialog opens but the destructive button is disabled with the reason in full: *is the website default*, *N pages still use it*, *built-in templates are protected* | row menu → Archive on the default or any bound layout | `422 LAYOUT_IN_USE` |
| 9 | Restore | an archived layout returns with a new revision and its binding history intact | show archived → row menu → Restore layout | `POST /v1/layouts/{id}:restore` |
| 10 | Hidden region without a reason | the region stays hidden but the row shows `reason required` and preflight lists it as a warning | switch a region off and leave the reason empty | `422 HIDE_REASON_REQUIRED` |
| 11 | Policy over ceiling | saving is refused with the ceiling named; the seed list shows the warning inline before you try | add seed blocks past `maxBlocks` | `422 SLOT_POLICY_LIMIT` |
| 12 | Preflight | blocking vs warning findings, each with its detail and (where one exists) its fix; `Open the affected pages` | header → Preflight | `GET /v1/layouts/preflight?site=` |
| 13 | Empty search | `No layout matches that search` with a clear action; counts unchanged | type nonsense in the library search | client-side |
| 14 | Empty slot | the canvas draws a labelled empty slot (`Empty content slot`), never a fake block | remove every seed block | — |
| 15 | Bulk cap | more than 40 selected pages disables the action and the dialog explains the cap before the request | select all on a 48-page site, then reassign | `422 BULK_LIMIT` |
| 16 | Deep link | `#/layouts?site=&tab=&itab=&sel=` restores tab, inspector and selection on a cold load | paste a link | — |
| 17 | Layout | no page scrollbar at 1440×900; three columns never overlap; the inspector footer stays visible while the pane scrolls | resize | — |

### Fixed while building

- **The canvas showed the saved layout, not the working copy** — `frameFor` resolved from the store, so a variant swap only appeared after Save. It now builds the frame from the draft object (`frameOf`).
- **A slot policy could contain a block type that does not exist** (`stats` had slipped into a seed allow-list); allow-lists are now filtered against `REGISTRY`, so a typo can hide nothing.
- **Re-loading on a demo-state change kept stale numbers** — the payload is dropped when the slow state is forced, so the skeleton is honest.
- **Switching library tab kept the previous inspector tab**, which rendered a layout pane for a template; the switch now resets to Overview.
- **`Preview Layout` was disabled on the templates tab** although a template has a shell to preview.
