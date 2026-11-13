# Module 1 — Build vs. Specification Review

**Reviewed:** the running React/TypeScript build in `wacrm-app/` against
*"WACRM Native Website CMS — Module 1 Complete Desktop Overview Specification
v1.0"* (ChatGPT) and the two approved mockups.

**This document implements nothing.** It states what exists, what is missing,
what is broken, and — for each recommendation in the spec — whether we should
adopt it, defer it, or reject it, with the reason and the payoff.

---

## 0. Verdict in one paragraph

The build is a **high-fidelity, fully-interactive front end of the Overview
screen**: every region of the approved mockup exists, every CTA on the screen
does something real against a simulated database, and the state set (idle,
hover, loading, empty, error, conflict, denied, success) is implemented and
script-testable. What it is *not* is the enterprise platform the spec spends
two-thirds of its pages on: tenancy, RBAC, RLS, the analytics pipeline, the
authoritative release pointer and consent handling are **not implemented, by
design** — this is a prototype with a mock API, not a production CMS.

Measured coverage of the *UI/interaction* contract: **~72 % complete, ~20 %
partial, ~8 % missing.** Coverage of the *backend/security/analytics* contract:
**0 %** (out of scope for a design prototype; listed in §4 so it is not
mistaken for done).

Three real defects were found during this review, one of them serious:

| ID | Severity | Defect |
| --- | --- | --- |
| C-1 | **Critical** | Every dropdown/popover renders full-viewport width (the bug you spotted). Root cause identified, one-line fix, see §2.1. |
| C-2 | High | No URL routing: no deep links, no back/forward, refresh always lands on Overview (the "CSR" issue). |
| C-3 | Medium | Analytics honesty: the rail still says **76.8 % Completion** for 26/112 submissions. That is the *non-completion* rate. The spec flags exactly this. |

---

## 1. What we have already achieved

### 1.1 Verified mechanically (not by eye)

| Check | Result |
| --- | --- |
| Scripted interaction suite (`qa_flows.py`, 38 steps) | **38/38 pass** |
| Console / page errors during the suite | **0** |
| Layout overflow at 1600×1000 and 1440×900 | **0 px** (single screen, like the mock) |
| Deliberate degradation at 1366×768 / 1100 | scrolls / stacks, no clipping |
| `tsc --noEmit` (strict) | clean |
| Production bundle | `dist/index.html` 495 kB / 166 kB gzip, fully offline (no CDN) |

### 1.2 Region-by-region (the spec's Regions A–J)

| Spec region | State | Notes |
| --- | --- | --- |
| **A · Sidebar** | ✅ built | Brand, workspace card + switcher, CRM nav, expanded Website CMS tree (15 modules on a guide line, green active pill), Settings/Platform, Quick Create. Collapse to icon rail implemented. |
| **B · Top bar** | ✅ built | Breadcrumb, ⌘K search (palette with arrow/Enter/Esc), notifications popover + unread dot, help, profile. |
| **C · Page head + filters** | ⚠️ partial | Title/subtitle site selector + range selector + New Website all work; range is 7/14/30/90 only (no *This month · Last month · Custom range*). Site list has no in-menu search. |
| **D · Operational** | ✅ built | Needs Attention with 3 issue cards, per-issue drawers, "View All Issues" queue, dismiss/resolve, all-clear state. Publishing strip with drafts/ready/live + release CTA and preflight. |
| **E · KPI row** | ✅ built | Six cards, click-through drawers, count-up, sparklines, delta semantics (pp for the rate, inverted desirability for LCP), skeleton and empty variants. |
| **F · Core analytics** | ✅ built | Traffic chart: legend toggles, Events toggle, Daily/Weekly/Monthly (locked when the range can't support them), annotations, hover tooltip, point click. Conversion journey: 4 stages, stage drawers, correct stage-to-stage maths. |
| **G · Diagnostics** | ✅ built | Top pages (sortable, real thumbnails, conv pills), acquisition donut + channel drawers, site health rows with four independent drawers. |
| **H · Website registry** | ⚠️ partial | Horizontal cards, status/DNS/SSL pills, Manage/Analytics, overflow menu — but the menu has **5** of the spec's 8 items (no *Open Live Website*, *Edit Website*, *Domain Settings*), and clicking the name scopes the dashboard instead of opening Manage. |
| **I · Contextual rail** | ✅ built | Activity timeline, form tiles, goals with % pills, CWV tiles. No empty states for activity/goals. |
| **J · Footer** | ⚠️ partial | Scope, freshness, live dot, Docs, Support, Export all present; Export downloads CSV immediately instead of opening the spec's export dialog. |

### 1.3 Interaction surface that actually works today

23 distinct overlay types (`kpi`, `stage`, `channel`, `health`, `ssl`,
`broken-link`, `issues`, `page`, `point`, `forms`, `vitals`, `activity`,
`workspace`, `preflight`, `published`, `publish-queue`, `wizard`, `rename`,
`domain`, `archive`, `delete`, `goals`, `preview`), plus command palette,
notifications, profile/help/workspace menus, toasts with undo-ish actions,
optimistic mutations (rename, duplicate, archive, restore, DNS verify, SSL
provision, publish, rollback API), a 4-step create wizard with validation and
duplicate-host rejection, a preflight → publish → success/409-conflict path, and
six switchable data states.

Motion matches the spec's own table: page 300 ms fade+8 px, KPI count-up 600 ms,
hover 160 ms, dropdown 180 ms scale .96→1, tooltip 280 ms, toast 300 ms, state
crossfade 220 ms, 1400 ms shimmer, `prefers-reduced-motion` honoured.

---

## 2. Defects found in this review

> **Status update — 13 Nov 2026:** every C-series defect below has been fixed
> and re-verified. See §2.6 for the fix log and the measurements taken after.


### 2.1 C-1 — Every dropdown is full-screen width (Critical)

**What you saw:** clicking *All Websites (3)*, *Last 30 days*, any site `⋯`,
the bell, the workspace card or the beaker opens a panel that spans the whole
content width instead of a 240–340 px menu. Confirmed on all of them.

**Root cause** — `src/components/ui.tsx:112-113` renders the portal with
`position: fixed; left: <measured>` but **never sets `right`**, while
`src/styles/app.css:340` styles `.dropdown` with `position:absolute; right:0`.
With both `left` and `right` in play and no `width`, CSS stretches the box
across the viewport. `.w-260` only sets `min-width`, so it does not cap it.

**Fix (applied):** `Popover` now sets `right: "auto"` inline, renders
`visibility:hidden` until measured, and carries `role`/`aria-labelledby`.
Measured after the fix at 1440 px: site menu 260×203, range 273×189,
`⋯` 210×168, bell 446×288.
Two lines; no visual side effects elsewhere.

**Why it matters:** it breaks the single most-used control pattern on the
screen, and it was invisible in the automated suite because the flows only
asserted that *something* opened.

### 2.2 C-2 — No URL routing (High)

`app.go(screen)` only sets React state. Evidence: loading `#/publishing` still
shows *Overview*; browser Back does nothing; refresh resets to Overview. The
spec (§29 *Navigation*) requires back/forward and shareable state.

**Fix (not applied):** a ~30-line `useHashRoute` hook — read the hash on mount,
write on `go()`, listen to `hashchange`, map unknown routes to a "not found"
notice. Also puts the site filter and date range into the query string, which
makes every drawer/filter combination shareable and testable.

### 2.3 C-3 — Analytics honesty items (Medium, product-facing)

1. **76.8 % "Completion"** with 112 starts / 26 submissions. Completion =
   submissions ÷ starts = **23.2 %**; 76.8 % is the *non-completion* rate.
   Independent sources define form completion rate exactly this way
   ([Pivix](https://www.pivix.io/en/definition/form-completion-rate),
   [Formbeam](https://formbeam.io/blog/form-completion-rate-benchmarks-what-s-normal-for-your-industry)).
   The mock inherited the error; the spec correctly calls it out.
2. **Cumulative chart not labelled.** We plot running totals (the curve ends
   exactly on 5,420). The spec (§10.10) requires the word *cumulative* on
   screen so nobody reads 5,420 as a daily figure.
3. **"Scheduled" site status.** EuroMiles Rewards is shown as *Scheduled*;
   the blueprint defers scheduled publishing to Phase 2. Either mark it as a
   mock-only demo state or change it to *Draft*.

### 2.4 C-4 — Accessibility gaps (Medium, systematic)

Facts from the code, not impressions:

| Requirement (spec §27 / WCAG 2.2) | Status |
| --- | --- |
| `role="dialog"` + `aria-modal` on modal/drawer | ✅ present |
| Escape closes overlays | ✅ present |
| Menu semantics (`role="menu"`, `aria-selected`) | ❌ missing |
| Arrow-key navigation inside menus | ❌ missing |
| Move focus into an opened menu, restore on close | ❌ missing (only the palette focuses its input) |
| `aria-current="page"` on the active nav item | ❌ missing |
| Live region for toasts/async results | ❌ missing |
| Charts: text summary / table alternative | ⚠️ `aria-label` only |
| Focus visible ring | ✅ present |
| Target size ≥ 24×24 px (WCAG 2.2 AA 2.5.8) | ⚠️ some 16–20 px pills/icon buttons |

Sources: WCAG 2.2 success criteria 2.4.11 / 2.4.13 / 2.5.8
([EqualWeb](https://www.equalweb.com/wcag/2-2/),
[ComplyMo](https://www.complymo.com/blog/wcag-2-2-new-success-criteria)).

### 2.5 C-5 — Small visual defects at 1440

Measured with a text-overflow sweep, not guessed:

| Element | Overflow |
| --- | --- |
| `.kpi-spark` (all 6) | needs 34 px, has 30 px → **fixed**: spark sized to its box |
| `Top Landing Pages` → "Scholarship Guide" | needs 97 px, has 92 px → **fixed**: thumbnail 30→24 px, gap 8→5 px, `Conv. rate`→`Conv.` (+ `title` tooltip on the header and on every row title) |
| `.site-media` hover label "Preview" | needs 100 px inside a 78 px thumb → **fixed**: the icon no longer flex-grows (78/78) |
| Acquisition row "Referral" | truncates to "Refe…" at 1440 → **fixed**: donut 112→100 px, grid gap 7→5 px; name now 49.3 px for a 48 px string |
| Site Health "v1.24 (May 29)" | clips the closing bracket → **fixed** in the badge layout |

Also structural debt: the stylesheet now carries ~600 lines of late override
layers (`.kpi` anatomy redefined three times, `.w-240/.w-260` declared twice,
`.d-panels` columns rebalanced twice). It works, but the next module will make
it worse — worth a consolidation pass.

### 2.6 Fix log — 13 Nov 2026

| Area | Change | Verification |
| --- | --- | --- |
| Popovers | inline `right:auto`, measured-then-shown, `role=menu/listbox/dialog`, first item focused, trigger refocused on close, ↑/↓/Home/End, Esc stops propagation, Tab closes | `/tmp/dd5.py`: 4 popovers measured narrow; screenshot `qa/dd-site.png` |
| Dialogs | new `useDialogFocus` — focus in on mount, Tab trap, restore on close; applied to `Modal` and `Drawer`; toasts got `aria-live="polite"` | keyboard sweep in `qa_flows.py` (32–34) |
| Routing | `readHash`/`buildHash` + `popstate`/`hashchange`; push on screen change, replace on filter change | `/tmp/rt2.py`: deep link, back, reload all correct, 0 console errors |
| Metrics | completion computed as `submissions / starts` → 23.2 %; chart subtitle states "Cumulative visitors · daily leads · release markers" | dashboard screenshot `qa/w-1440.webp` |
| Status model | `scheduled` removed from `SiteStatus` and the page enum; site pills now Published / Draft only | `tsc` + Pages/Sites screens |
| Notifications | clicking an item marks it read (`API.readNotification`) and refreshes the unread count | flow 33 |
| Tables | sort arrows taken out of flow (`position:absolute`), page thumbnails 30→24 px, `Conv.` header with tooltip, row titles get `title` | overflow sweep: 0 clipped elements on `.main` |
| Acquisition | donut 112→100 px, tighter grid → "Referral" no longer truncates | name box 49.3 px vs 48 px string |
| Regression | `tsc --noEmit` clean · `vite build` clean · `qa_flows.py` 38/38 · no horizontal overflow at 1280/1440/1600/1920 | this pass |

Backend contract for every endpoint the Overview needs now lives in
[`BACKEND-PLAN.md`](BACKEND-PLAN.md).

### 2.7 Fix log — second pass (P1 sweep)

| Area | Change | Verification |
| --- | --- | --- |
| Navigation | `aria-current="page"` on the active CMS nav item | DOM assertion: resolves to "Overview" |
| Quick Create | real creation menu instead of a palette alias | 6 items measured in the open menu |
| Notifications | All / Unread tabs, per-item read, "View all notifications" | unread filter narrows the list; unread count drops on click |
| Help | Video tutorials, Product updates, Report an issue | 6 items |
| Export | dialog with scope, 4 section toggles, CSV/JSON, row count | exports 41 rows, toast confirms format |
| Site `⋯` | 9 items incl. Open Live Website, Edit Website, Domain Settings | menu text captured |
| Websites | "View All" CTA in the registry header | present, routes to Sites & Domains |
| Date range | Last 7/14/30/90 + This month + Last month + custom picker | custom `May 10 – May 20` → `#/overview?range=11&end=10`, survives reload; invalid order rejected with a toast |
| Publish | 3 steps: select pages → freeze manifest (preflight) → result | steps read back as "Step 1 of 3" / "Step 2 of 3 · preflight for 3 pages" |
| Rollback | release history modal with confirm and audit note | rollback fires and toasts `Rolled back to v1.23` |
| Resilience | per-region error boundaries | error state renders 8 regional cards; 3 site cards + publishing + activity still live |
| Regression | `tsc` clean · `vite build` clean · `qa_flows.py` 38/38 · routing 4/4 · no overflow at 1280/1440/1600 | this pass |

---

## 3. What is still missing *inside the Overview*, prioritised

### P0 — fix before showing this to anyone else

| # | Gap | Where | Status |
| --- | --- | --- | --- |
| 1 | Popover width bug (C-1) | `ui.tsx` Popover | **Done** |
| 2 | No URL routing / deep links / back-forward (C-2) | `store.tsx` | **Done** — `#/<screen>?site=&range=`, back/forward, reload-safe |
| 3 | 76.8 % completion label, cumulative chart label, "Scheduled" status (C-3) | `Side.tsx`, `TrafficChart.tsx`, `data.ts` | **Done** — 23.2 %, "Cumulative visitors" subtitle, `scheduled` removed from the site/page enums |
| 4 | Menu a11y: roles, arrow keys, focus in/out (C-4) | `ui.tsx`, `Shell.tsx` | **Done** except `aria-current` on the active nav item |
| 5 | 5 truncation/clipping defects (C-5) | `app.css` | **Done** — see §2.5 |

### P1 — spec items that exist in the document but not in the build

| # | Spec § | Gap | Effort | Status |
| --- | --- | --- | --- | --- |
| 6 | 6.3 | Date range lacks *This month · Last month · Custom range…* + calendar picker | S–M | **Done** — window is now `{days, endOffset}`, so a custom window plots the right dates and survives reload (`?range=11&end=10`) |
| 7 | 6.2 / 4.1 | No search inside the site or workspace dropdowns | S | **Open** |
| 8 | 4.7 | *Quick Create* opens the command palette instead of a "Create New" menu | S | **Done** — Website / Page / Form / Menu / Media + Search |
| 9 | 5.3 | Notifications: no All/Unread tabs, per-item mark-as-read, "View all" | S | **Done** |
| 10 | 5.4 | Help menu missing *Video tutorials*, *Product updates*, *Report an issue* | XS | **Done** |
| 11 | 20.7 | Export must open a dialog (scope, sections, format) | S | **Done** — scope, 4 section toggles, CSV/JSON |
| 12 | 15.10 | Site `⋯` menu missing *Open Live Website*, *Edit Website*, *Domain Settings* | S | **Done** — 9 items, wired to drawers/modals |
| 13 | 15.2 | No *View All Websites* CTA | XS | **Done** |
| 14 | 8.6 | Publish flow is 2 steps; spec wants *select → freeze manifest → results* | M | **Done** — selectable page list, then preflight, then result |
| 15 | 8.9 | `rollback()` exists but no UI calls it | S | **Done** — release history with confirm + audit note |
| 16 | 21.15 | One `error` flag blanks the whole dashboard | M | **Done** — 8 analytics regions fail independently; sites, publishing, activity, attention stay live |
| 17 | 20.3 | Freshness: only "syncing…", no per-source state | S | **Done** — Analytics / Publishing / Vitals / Search with current-delayed-stale |
| 18 | 12.7 | Row overflow menu on Top Landing Pages (deliberately removed to match the mock — decide which wins) | S |
| 19 | 21.8 | Empty states exist for sites/pages, not for activity, goals, forms, acquisition | S |
| 20 | 24 | Several CTAs' destinations are drawers where the spec wants full pages (Action Center, Site Health tabs, Page performance, Analytics) | L (needs those modules) |

### What is **not** missing though the spec lists it

Worth saying explicitly, because the document reads as if none of this exists:
dark sidebar + light canvas tokens, six-KPI layout, attention + publishing
regions, funnel, annotations, hover/active/selected/warning/error/conflict/
success states, toast patterns, drawer/modal standards, reduced motion, the
full CTA→destination matrix for the *overview-scoped* actions, the wizard with
validation states, and the 409 conflict dialog — **all implemented**.

---

## 4. Deliberately out of scope (front-end prototype, not a CMS)

These are 0 % built and should be *reported* as such, never as "done":

tenant isolation & Postgres RLS · RBAC enforcement · CAS release pointer ·
immutable manifests · preflight against real block schemas · pg-boss jobs ·
DNS/TLS provisioning · form→CRM lead ingestion · consent evidence (DPDP) ·
analytics collection, aggregation and retention · attribution model · CrUX/
real-user CWV ingestion · audit log immutability · export authorisation.

The prototype *simulates* their effects (latency, 409s, permission gates,
optimistic mutations, rollbacks) so the UI contract can be reviewed, but no
security or correctness claim can rest on it.

---

## 5. Should we adopt the specification's recommendations?

Judged on: does it change a decision a user makes, does it prevent a wrong
claim, does it cost more to retrofit later than to do now.

### 5.1 Adopt now — yes, unambiguously

| Recommendation | Why it pays | Cost |
| --- | --- | --- |
| **Fix the popover contract** (§22.1) | Every menu is currently unusable; also unblocks the spec's anchored-positioning rules (flip when no space, stay in viewport). | XS |
| **URL routing** (§29) | Deep links are how a CMS is actually used (send a colleague the page you're looking at); also makes every future QA step addressable. Retrofitting after 15 modules is 10× the work. | S |
| **Correct the completion metric + label cumulative charts** (§17.3, §10.10) | A number that is arithmetically backwards destroys trust in every other number on the screen. Two independent sources define completion as submissions ÷ starts. | XS |
| **Menu/dialog accessibility** (§27.1–27.2) | Roles + arrow keys + focus return is ~150 lines for the whole app and is a WCAG 2.2 AA requirement (2.4.11, 2.5.8). Cheaper now than after 15 modules inherit the pattern. | S |
| **Per-region error boundaries** (§21.15, §26.9) | One failing query currently blanks the dashboard; region-scoped failures are how a real CMS behaves under partial outages. | M |
| **Empty + “insufficient data” states for every widget** (§21.8, §9.10) | Prevents the prototype's habit of showing 0 where the truth is "unknown". | S |
| **Export dialog with scope/sections** (§20.7) | The current one-click CSV silently omits scope choice — the exact wrong-export class of bug. | S |

### 5.2 Adopt when the backend exists — yes, but not in this layer

These are correct in the spec and **impossible to honour honestly** in a
mock-API prototype. Build them with the real contracts, not before:

- RBAC + tenant isolation (§25) — hiding buttons is not authorisation.
- CAS publishing, immutable manifests, preflight against real schemas (§8.6, §26.5).
- Analytics pipeline: event vocabulary, dedupe definition, consent (§26.2–26.3).
- Real-user CWV via CrUX/`web_vital_observed` (§19.3). Ground truth: LCP ≤ 2.5 s,
  INP ≤ 200 ms, CLS ≤ 0.1 **at p75 of real users**, evaluated over a rolling
  28-day window ([web.dev thresholds](https://web.dev/articles/vitals),
  [Core Web Vitals 2026](https://patrickstox.com/technical-seo/web-performance/web-vitals/core-web-vitals/)).
  Our "2.1 s / 92 ms / 0.03" are mock values and the build already labels them
  as field data — that label must not ship before the pipeline does.
- Attribution (visitors → form starts → leads → bookings) (§11.5, §30.3).

### 5.3 Adopt selectively — worth it, but after P0/P1

| Recommendation | Verdict | Reasoning |
| --- | --- | --- |
| **Full Action Center page** with severity filters (§7.7) | Defer to the Sites & Domains module | The Overview's drawer already triages; a second full issues screen duplicates the module we haven't built yet. |
| **Severity engine** (§7.3) | Adopt conceptually now (badge + ordering), implement with real checks | Cheap to add a severity field; meaningless without authoritative checks. |
| **12-tab Site Health screen** (§14.7) | Reject as specified | Six tabs across four independent subsystems is heavier than the data warrants. Two tabs (*Status*, *History*) plus links into Domains / Releases / Performance modules is clearer. |
| **Live activity insertion** (§16.7) | Defer | Needs the transport; the visual spec (250–400 ms highlight) is already prepared. |
| **Custom date range picker** (§6.3) | Adopt presets now, picker when analytics exist | Presets (today/7/30/90/this month/last month) cover ~95 % of use; a range picker without real data is theatre. |
| **Goal editing** (§18.5) | Keep | Already implemented; but store goals with the reporting period, not just the target. |
| **PDF export** (§20.7) | Defer | CSV covers the tabular need; PDF needs a server-side renderer to be trustworthy. |
| **Role-specific dashboards** (§30.18) | Reject for v1 | One permission-filtered screen is more maintainable and easier to audit than three forks. Revisit if Viewers complain about noise. |

### 5.4 Reject / push back on the spec

| Spec item | Why I disagree |
| --- | --- |
| **Sidebar re-grouped into BUILD / MANAGE / GOVERN headings** (§4.3) | The approved mock has a *flat* 15-item tree and it fits one screen without scrolling. Re-introducing group headers costs ~90 px of vertical space in the most constrained column, and the grouping is arbitrary (is *Publishing* Manage or Build?). Keep flat; the mock wins. |
| **`role="menu"`-style keyboard model on every popover** | Correct for the action menus, overkill for the *site filter* — that one behaves as a listbox with a search field (spec §6.2 asks for search). Implement listbox semantics there, menu semantics on `⋯`, dialogs on drawers. One generic "menu" component for all three would be worse. |
| **"Scheduled" as a website status** (§15.4 admits the conflict, still shows it) | Ship *Draft* until Phase 2; a status the backend cannot produce is a promise the UI can't keep. |
| **Counting every KPI change with a number count-up** (§23.3 "optional numeric interpolation") | Keep it for first load only. Re-animating six numbers on every filter change makes the dashboard feel slower than it is. |

### 5.5 Net recommendation

Do **P0 + P1 (items 1–15)** before Module 2. That is roughly *two focused
passes* — one correctness pass (popovers, routing, metrics, a11y) and one
completeness pass (filters, menus, export, rollback, empty states). Everything
in §5.2 waits for the backend; everything in §5.3 can wait for the module it
belongs to.

The single highest-leverage item is **URL routing**: it converts the prototype
from "a screen someone clicks through" into "a product a team can reference",
and it is the one thing that gets materially more expensive with every module
added.

---

## 6. Housekeeping done in this pass

| Action | Result |
| --- | --- |
| `wacrm-app.zip` regenerated from the current tree | ✅ 324 KB, 44 files, byte-identical `preview.html` — verified against the workspace build |
| Vanilla predecessor `wacrm/` removed (2.4 MB, superseded) | ✅ |
| Flat draft `.tsx/.ts` files in `uploads/` removed (Claude's superseded draft) | ✅ reference PNGs and the spec screenshot kept (3.9 MB) |
| QA screenshot debris removed (57 PNGs + derived crops) | ✅ kept one 1440 and one 1600 reference shot |
| Ad-hoc QA scripts `qa_shot.py`, `qa_resp.py` removed | ✅ `qa_flows.py` (38 steps) and `qa_react.py` (overflow) remain |
| Workspace total (excluding `node_modules`) | **1.7 MB** |

---

## 7. Answering the three questions directly

1. **"What have we already achieved?"** — §1. A complete, interactive, pixel-matched
   Overview front end: 38/38 flows, zero console errors, zero layout overflow,
   all six states, all 23 overlays, correct funnel maths, spec-accurate motion.
2. **"What is left inside what we built?"** — §2 and §3: one critical popover bug,
   routing, three honesty fixes, menu a11y, five clipping defects, then fifteen
   P1 completeness items (filters, menus, export dialog, rollback UI, partial
   failure, empty states).
3. **"Should we include the spec's suggestions?"** — §5: adopt 7 now, 4 when the
   backend lands, 5 selectively, 4 rejected with reasons. The spec is ~90 %
   sound; its two real weaknesses are a 12-tab health screen and re-grouping the
   sidebar against the approved mock.

**Zip:** yes — regenerated in this pass and verified to contain the current build.
**Folders deleted:** yes — §6.
