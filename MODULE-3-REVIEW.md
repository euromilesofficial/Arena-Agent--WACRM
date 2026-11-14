# Module 3 — Pages & Routes: review before build

**Input reviewed:** the v1.0 spec (34 sections) + `WACRM Pages CMS Dashboard.webp` (1672×941).
**Verdict:** this is the strongest of the three specs. ~85 % is buildable exactly as written. It has **one arithmetic error**, **four places where it contradicts its own mock**, and **nine gaps that a real end user would hit within a week of using the screen**. Nothing here needs a redesign — it needs eight decisions made out loud before I write code, and about a dozen small additions.

---

## A. Conflicts that must be decided, not "handled later"

**A1. The gauge is arithmetically wrong.** 42 / 48 = 87.5 %, which rounds to **88 %**, not the 87 % in the mock. Worse, the spec allows Published and Drafts to overlap (a published page can carry unpublished changes), so 42 + 4 + 2 = 48 is a coincidence, not a rule. Two honest options:

- **Partition (recommended):** Published = present in the live release. Drafts = *not* present in any release. Then Published + Drafts = Total by construction, the tabs never double-count, and "has unpublished changes" becomes a **second, separate flag** rendered as a subtle amber dot + `Unpublished changes` badge beside the green pill (spec §23 already asks for this; the mock flattens it — this fixes both). Seed: 48 total = 42 published + 6 draft-only, gauge `42/48 · 88 %`, plus 3 published pages carrying unpublished edits.
- **Overlap:** keep "Drafts = pages with any unpublished work", accept that the two counts can sum past the total, and show the gauge denominator as "eligible" pages. More precise, harder to explain.

**A2. Scheduled must go, but it is load-bearing in the mock.** Removing the KPI and the tab leaves a gap in a five-tile strip. Final Phase 1 strip: **Total Pages · Published · Drafts · Issues · Published %** (gauge). No Scheduled anywhere, including empty-state and tooltip copy.

**A3. "Archived" vs "Trash".** Spec is right: 30-day recoverable trash, not an archive. Tab reads **Trash**, badge reads **Trashed**, details show **Recoverable until {date}** — server-derived, not a client countdown.

**A4. `Section` is not a page type, but the Type column then has no reason to exist.** If the column, the `All Types` filter and the type chip all render "Page" forever, they are three pieces of dead UI on a screen whose whole premise is "every control has a destination". Recommendation: **two types that actually change behaviour** — `Standard page` (inherits global header/footer) and `Landing page` (full-bleed, no global nav). That justifies the column, gives the filter something to filter, and matches the mock's own `/study-abroad` row being a *page* that has children. `Section` disappears.

---

## B. Things the mock shows that are wrong, per the spec's own §31

Already caught by your spec — I agree with all ten, and they cost nothing to honour: gauge maths (A1), scheduled (A2), Section type (A4), Archived→Trash (A3), Home's `/` vs its tree position, illustrative thumbnails/analytics, `View Live Site` enabled on a draft-only site, flattened published/draft badge, the homepage being a designated ID rather than a page flag, and keeping advanced actions out of the row's default view.

**On Home specifically:** Home must be a root page whose `full_path` is `/`, immovable and un-trashable without a designated replacement. The mock nests `Study Abroad` as a sibling of Home at root level, which is correct only if children of Home are not re-rooted under it. I'll implement: Home is root, its children are root-level pages (no implicit `/study-abroad` under a hidden prefix).

---

## C. Gaps a real end user will hit — missing from both spec and mock

Ordered by how quickly they'd bite. Each has a cheap fix; none require new concepts.

| # | Gap | Why it bites | Fix I propose |
| --- | --- | --- | --- |
| **C1** | **Renaming a page breaks the web silently.** Spec §16 says "changing this route may affect existing links", then defers. | This is the single most common real-world CMS incident: `/about-us` → `/about`, 40 inbound links die, nobody notices until SEO collapses. | On slug/parent change: resolve inbound LinkRefs **before** saving, show `7 links point to this page — a 301 will be proposed at publish`, and a `View affected links` list. Uses the blueprints' own LinkRef resolver; no new subsystem. |
| **C2** | **Trashing a parent with children is undefined.** | Deleting "Scholarships" either orphans 2 pages or silently deletes them with it. Both are unacceptable surprises. | Block by default: `2 child pages must be moved first` + inline "Move children" shortcut. No cascade in Phase 1. |
| **C3** | **The homepage is un-trashable, but the button still says Trash.** | User clicks Trash on Home, gets a generic 422. | Disable the item with the reason, and offer the only legal path: `Set another homepage first`. |
| **C4** | **No undo after trash.** 30-day recovery ≠ undo. | A mis-click costs a trip to the Trash tab and a lost selection. | Toast: `Deleted "How to Apply" · Undo` (8 s), plus the Trash tab as the durable path. |
| **C5** | **Selected page can vanish under you.** Concurrent trash or rename leaves the inspector on a ghost. | Spec §7.7 mentions it; nothing designs it. | Inspector drops to `This page is no longer available` + `Refresh` instead of erroring; selection clears; toast names who/what. |
| **C6** | **A page with unpublished changes is a dead end.** Pages cannot publish, and the screen never says so. | The badge says "unpublished changes" and the only affordance is Edit. Users hunt for a Publish button that must not exist here. | Badge becomes a link: `3 unpublished changes · Review in Publishing & Releases →`. Explicit, no fake publish button. |
| **C7** | **Bulk selection has no stated scope.** "Select all" over a paginated, filtered list is ambiguous and dangerous. | Deleting 48 instead of 8. | Select-all = **this page of results**, with an explicit second action `Select all 23 matching` when the filter spans pages. Bulk bar always shows the count and `Clear`. |
| **C8** | **Sorting and default order are unspecified.** | Table feels arbitrary; every reload reshuffles. | Default `Last Updated ↓` (matches the mock's own emphasis), tie-break on `id`; sortable Title/Slug/Type/Status/Updated with `aria-sort`. |
| **C9** | **No link from this screen to the page's audit story.** | "Who changed this and when" is the first question after any incident. | `Last updated by {actor}, {relative time}` in the inspector and as a row tooltip; `View revision history` opens the (Module 6) placeholder rather than pretending. |

**Smaller, still worth doing:** empty-workspace first-run guidance (`Create your first page` with Home pre-suggested); `Issues` showing a green *No issues* rather than a grey 0; preview token-expired state with `Regenerate preview`; Trash tab empty state; per-row tooltip carrying the full path when truncated; Escape clearing bulk selection; and an explicit `You don't have permission to create pages` for Viewer on the primary button rather than a dead click.

---

## D. Decisions I propose (say the word and I build to these)

| # | Decision | Proposal |
| --- | --- | --- |
| D1 | Drafts vs Published counts | Partition (A1). Drafts = never published. Separate `hasUnpublishedChanges` flag |
| D2 | Gauge denominator | `round(published ÷ active pages × 100)`, `—` when 0 pages, tooltip shows the raw fraction |
| D3 | Page type enum | `Standard page`, `Landing page` (A4) |
| D4 | Hierarchy model | Pages are nodes with real routes; **no folder entity**; Home is a special root |
| D5 | Trash + children | Block, with a "move children first" shortcut |
| D6 | Homepage rules | Exactly one, immovable, un-trashable; removal requires a replacement |
| D7 | Issues definition (Phase 1) | Concrete, checkable set: missing homepage · duplicate/invalid slug · orphan page (no inbound link) · unpublished changes older than 7 days · broken internal link · missing SEO title. Click → filtered list |
| D8 | Analytics panel | Shown only when the page has data; carries source + freshness in the tooltip; `Analytics not available for this page` otherwise — never a fabricated 0 |
| D9 | Locale | Single locale (`English · default`) displayed read-only in details; multi-locale routing is Phase 2 |
| D10 | **Edit Page destination** | Visual Builder is Module 4 and does not exist yet. Options: (a) a real placeholder screen that carries page/site context and says "Visual Builder arrives in Module 4 — your draft is queued", (b) disable the button with a reason. **I recommend (a)** — otherwise the screen's most important CTA is dead, which contradicts the brief |
| D11 | Primary CTA colour | Mock uses green `+ New Page`; Modules 1–2 use violet. Options: match the mock (green on this screen only) or keep the design system (violet). **I recommend violet** for cross-module consistency, unless you want mock-fidelity first |
| D12 | Deep links | `#/pages?site=&tab=&q=&page=&sel=` so refresh/back keep state; needed to demo "restore list context" |

---

## E. What I will build (finite contract)

**One screen, three panes, no new dashboards inside it.**

- **Header:** breadcrumb (Pages is `aria-current`), website selector (thumbnail + hostname + search + check), `View Live Site` (disabled with reason when no release), `Preview`, `+ New Page`.
- **KPI strip:** 5 tiles above, each with a real click target and a tooltip carrying numerator/denominator/source.
- **Left — Page Structure:** search, expand/collapse, `+` (pre-filled parent), `•••` (Expand All · Collapse All · Refresh Structure · Show full paths), selected green accent, keyboard tree (`↑↓←→ Home End Enter`), snapshot-position preserved while filtering.
- **Center — Registry:** 4 tabs (All / Published / Drafts / Trash) with counts, debounced search, `All Types` / `All Status` / `All Authors` + filter popover, 8 columns (checkbox, Page Title+thumb, Slug, Type, Status, Last Updated+actor, Actions), sortable headers, sticky header, pagination (`Showing 1–8 of 48`, page size 8/16/25), row menu with the spec's 12 items, bulk bar with count.
- **Right — Inspector:** thumbnail (generated wireframe per template — no fake screenshots), title + path + status (+ unpublished dot), Page Details (type, layout, created, last updated, parent, locale, live URL/Not published, last live release, draft changes), Page Performance (conditional, honest), `Edit Page` + `More Actions`; empty state `Select a page to view its details`.
- **Modals:** Create (4 steps) · Edit Details · Duplicate · Move · Set as Homepage · Move to Trash · Restore · Restore-with-conflict · Bulk trash · tree options popover · preview panel.
- **States:** skeleton, refreshing, error+retry, empty site, empty pages, zero-results, filtered-empty, viewer, trash-empty, slug-checking, saving, 409 conflict (CAS), 422 cycle/dependency, preview token expired, partial pane failure, success + undo toast — each one reachable by hand.
- **A11y:** tree/tabs/table/menu/dialog roles, roving tabindex, focus return, AA contrast, `prefers-reduced-motion`.
- **Verification:** `qa_pages.py` (~60 checks: geometry, counts reconcile, every control has a destination, keyboard, overflow at 1280/1440/1600) + `qa_states_m3.py` (~30 state checks), both run against the built single file, same as Modules 1–2.

**Explicit non-goals (kept out, as the spec demands):** scheduled publishing, staging, collection/blog engine, drag-and-drop reordering (keyboard `Move to…` only), permanent delete, the Visual Builder itself, publishing, redirects editor, localization, page-level SEO editor.

---

## F. The three things I need from you

1. **D10** — placeholder Visual Builder screen, or disabled button?
2. **D11** — green primary as the mock shows, or violet for consistency with Modules 1–2?
3. **Go/no-go on D1–D9** as written above (I've defaulted to the safest reading in each case; if you don't object I'll build to them).

Everything else is decided and documented above, so building can start the moment you answer — and it will land as one commit with `qa_pages.py` + `qa_states_m3.py` green and a `module-3-complete` tag, exactly like Module 2.

---

## G. As built — what shipped against this contract

| Decision | Landed as |
| --- | --- |
| D1 partition | 48 pages = **42 published + 6 draft-only**; `hasUnpublishedChanges` is a separate amber chip + dot on 3 published pages; tabs never double-count |
| D2 gauge | `round(42/48×100) = 88 %`, `—` when a website has no pages (verified in the empty state) |
| D3 types | `Standard page` / `Landing page` only; the column, the `All Types` select and the "Landing pages only" switch all read the same field (3 landing pages seeded) |
| D4 routes | Pages are real route nodes; no folder entity; Home is the root at `/` and its children are top-level routes |
| D5 children | trashing a parent is refused per page with the children named; the bulk path reports it one-by-one and still lands the successes |
| D6 homepage | exactly one; `Set as Homepage` disappears on Home itself; Move/Trash are disabled with a `homepage` note; the trash dialog explains the rule |
| D7 issues | 6 concrete issue instances (missing SEO title ×2, unpublished changes older than a week ×3, orphan ×1); the inspector lists them per page and the funnel filter narrows the registry to those pages |
| D8 analytics | performance block renders only when the page has views; otherwise `Analytics not available for this page yet` — no fabricated zeros |
| D9 locale | `English · default`, read-only |
| D10 builder | full placeholder screen: block rail, document outline, hand-over context (page / route / website / template / layout / blocks / revision), `Preview draft` + `Back to Pages` |
| D11 colour | violet primary throughout |
| D12 deep links | `#/pages?site=&tab=&q=&page=&sel=` parsed before first paint and kept in sync; covers cold load, refresh and back/forward |

**Beyond the contract** (each was a hole a user would find in a week):

- Modals carry their own target page — the earlier version acted on whatever was selected before.
- Detail requests are sequenced, so a fast tree click can never leave the wrong page in the inspector.
- Bulk selection is pruned to the visible result set.
- Creation clears filters, lands on page 1 and focuses the new row.
- Delete permanently is a separate, explicitly irreversible confirm (`DELETE /v1/pages/{id}?hard=1`).
- Trashed pages get their own inspector (restore window, `Restore Page` / `Delete`) instead of an editor that would fail.

**Verification:** `qa_pages.py` **105/105**, `qa_states_m3.py` **40/40**, plus Module 1–2 regression (`qa_module2.py` 48/48, `qa_states_m1.py` 39/39, `qa_flows.py` 38/38) — all green against `WACRM-CMS.html`. Screenshots: `qa/m3-*.webp` (15 frames: registry, trash, row menu, create steps 1 & 4, bulk, filters, preview, builder, empty, error, viewer, conflict, 1280).
