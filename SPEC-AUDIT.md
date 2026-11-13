# Module 01 — Overview: reference audit & match report

Source of truth: `WACRM Website CMS Dashboard Overview.png` (the screen) and
`WACRM Website CMS Dashboard Spec.png` (sections, CTAs, dropdowns, states,
motion). This document is the dissection of both, what the build had, what it
was missing, and what changed in this pass.

Every item below is implemented in `src/` and verified in
`WACRM-CMS.html` (a single-file production build of the same code).

---

## 1. Section-by-section dissection

The spec names nine regions. Each one was compared field by field.

### 1 · Top bar
| Reference | Built now |
| --- | --- |
| Home icon › `Website CMS` › **Overview** breadcrumb | ✅ same, middle crumb is clickable |
| Search field `Search WACRM…` with ⌘K chip | ✅ opens the command palette (⌘K / Ctrl-K) |
| Bell with unread dot, help `?`, avatar + chevron | ✅ bell dot = unread count; help and profile menus |
| Avatar is a photo | ⚠️ initials avatar (no stock photography in the bundle) |

### 2 · Workspace card
| Reference | Built now |
| --- | --- |
| `EU` lime avatar, `euromilesofficial's Workspace`, `EuroMiles Consultancy Pvt. Ltd.` | ✅ two-line card, chevron opens the workspace switcher |

### 3 · Sidebar tree
| Reference | Built now |
| --- | --- |
| CRM rows first (Inbox 12, Dashboard, CRM & Sales, Marketing, Automation & Bots, Reports & Insights) | ✅ |
| `Website CMS` as a filled green module header with chevron | ✅ |
| Flat module tree on a guide line: Overview, Sites & Domains, Pages, Visual Builder, **Block Library**, Theme Studio, Layouts & Templates, Menus & Navigation, Media Library, Forms & Leads, SEO & Redirects, Publishing & Releases, Localization, **Security & Audit**, **CMS Settings** | ✅ 15 items, no sub-group headings | 
| Active child = solid green pill | ✅ |
| Footer: Settings, Platform, Quick Create ⌘K | ✅ |

*Missing before this pass:* Block Library did not exist, Security & Audit and CMS
Settings existed but were pushed out of view by three group headers
(Build/Manage/Govern). The tree guide line and the green module header were absent.

### 4 · KPI cards (6)
| Reference | Built now |
| --- | --- |
| Tinted icon chip left, value over label, sparkline right, delta line beneath | ✅ grid anatomy `ico · value · spark / label / foot` |
| Websites 3 · *No change* (neutral) | ✅ |
| Visitors 5,420 · ↑ +28% | ✅ |
| Leads 26 · ↑ +36% | ✅ |
| Visitor-to-lead rate 0.48% · ↑ +0.03 pp | ✅ (pp, never a percent change) |
| Bookings 8 · ↑ +33% | ✅ |
| LCP 2.1s · ↓ −0.4s + green **Good** pill, label carries a dotted “Core Web Vital” hint | ✅ dotted hint with a tooltip definition |
| Count-up on entry (600 ms) | ✅ |
| Click = drilldown | ✅ each card opens its own drawer with series, breakdown and definition |

*Deviation:* at 1440 the card is ~135 px wide, so two labels use their short
form (“Lead rate”, “LCP Core Vital”) instead of truncating with an ellipsis.

### 5 · Needs Attention banner
| Reference | Built now |
| --- | --- |
| Amber card, ⚠ icon, **Needs Attention**, red “3 items”, “require your action”, `View All Issues →` | ✅ |
| Three white sub-cards: icon · title · subtitle · small action button | ✅ SSL Pending / partners.euromiles.in / **Resolve**; 1 Broken Link / Scholarship Guide / **Review**; 2 Unpublished Changes / Across 2 pages / **Preflight** |
| Resolved + dismissed variants | ✅ all-clear state with “Re-run checks” |

### 6 · Publishing status strip
| Reference | Built now |
| --- | --- |
| `4 Drafts` (plain) | ✅ opens the drafts queue |
| `2 Ready to Publish` (boxed) | ✅ opens the ready queue |
| `Live Release v1.24 · Published May 29, 2025` (green tint) | ✅ (year dropped when the card is narrow, full date in the tooltip) |
| `Release →` outline button | ✅ preflight → publish |
| — | ✅ conflict (409) path with a three-way diff modal |

### 7 · Traffic & Conversions
| Reference | Built now |
| --- | --- |
| Title + “Visitors, leads, and key events over time.” | ✅ |
| Legend Visitors / Leads **and an Events toggle chip** | ✅ Events chip shows/hides annotations + lead bars |
| `Daily` select | ✅ Daily / Weekly / Monthly, weekly+monthly locked under 14/30 days |
| Y axis 0 → 6,000 in thousands, dotted gridlines | ✅ auto-scales to the range (6,000 for 30 days), thousands separators |
| X axis May 1 … May 30, every third day | ✅ range is pinned to the reference window (May 2025) |
| Rising visitors area + end dot, leads riding the baseline | ✅ cumulative curve (ends exactly on the KPI total) + daily-lead bars |
| Annotation pills with dashed leaders (v1.23 released, Campaign: Italy Intake) | ✅ |
| Hover card `May 30, 2025 / Visitors 5,420 / Leads 26` | ✅ follows the cursor, 280 ms fade |
| Click a point | ✅ opens the day drawer |

### 8 · Conversion journey
| Reference | Built now |
| --- | --- |
| Four trapezoids 5,420 → 112 → 26 → 8, dark → light violet | ✅ |
| Right legend with stage, value and green conversion pill (2.07% / 23.2% / 30.8%) | ✅ percentages round to 1 decimal above 10% |
| ⓘ explainer | ✅ toast with the counting rule |

### 9 · Top landing pages
| Reference | Built now |
| --- | --- |
| `# · Landing Page · Views · Leads · Conv. Rate`, 3 rows | ✅ sortable columns |
| Photo thumbnails per page | ✅ real previews (Colosseum, medical, campus) |
| Conv. rate as a green pill (0.50% / 0.49% / 0.41%) | ✅ |
| `View Pages →` | ✅ routes to the Pages module |

### 10 · Traffic acquisition
| Reference | Built now |
| --- | --- |
| Donut with 5,420 Visitors in the middle | ✅ animated arcs, hover dims the other slices |
| Legend: dot, channel, parenthetical source, % and absolute value | ✅ Search 56% 3,035 · Social 22% 1,192 · Direct 14% 759 · Referral 8% 434 |
| Click a channel | ✅ channel drawer |

### 11 · Site health
| Reference | Built now |
| --- | --- |
| `Site Health (All Websites)` + `View Details →` | ✅ the parenthetical follows the site filter |
| DNS `2 / 3 verified` + amber `⚠ 1 pending` | ✅ |
| SSL `2 active, 1 pending` | ✅ |
| Releases `✓ All sites healthy` + `v1.24 (May 29)` | ✅ |
| Core Web Vitals `✓ Good` + `LCP 2.1s · INP 92ms · CLS 0.03` | ✅ |
| Row click | ✅ DNS / SSL / releases / vitals drawers with the remediation path |

### 12 · Your Websites
| Reference | Built now |
| --- | --- |
| `Your Websites (3)` | ✅ |
| Horizontal card: photo left, status pill, name, domain + external icon, stacked DNS/SSL pills, `48 Pages · 18 Leads` | ✅ |
| Footer `Manage` (soft violet) · `Analytics` · `⋯` | ✅ |
| `⋯` = Preview Site, Duplicate, Rename, Archive, Delete | ✅ exactly those five, destructive one in red |
| Hover: lift + focus ring, CTAs prominent | ✅ 160 ms lift, violet ring on hover/focus/selected |
| Warning variant: `DNS Pending` + `SSL Pending` on Partner Portal | ✅ |

Before this pass the cards were vertical (photo on top) with a different pill
layout and a longer overflow menu — both now match the reference.

### 13 · Right rail
| Reference | Built now |
| --- | --- |
| Recent Activity: timeline dots + icon chips, `v1.24 published · EuroMiles Main · 2h ago`, edited menu, updated page, rollback; `View All →` | ✅ with the connecting timeline spine |
| Form Performance: `Last 30 days`, tiles 112 Form starts / 26 Submissions / **76.8% Completion** (green tile), `Most used form` row with chevron | ✅ tiles are clickable, row opens the forms drawer |
| Goal Tracking: `This month`, 26 / 40 and 8 / 10, green bar with a % pill | ✅ bars animate on entry, click opens target editing |
| Performance Snapshot: LCP / INP / CLS tiles with green Good pills | ✅ (sparkline bars removed — the reference has none) |

### 14 · Status bar
| Reference | Built now |
| --- | --- |
| `ⓘ Data: All websites | Last updated: May 30, 2025 at 10:24 AM • ✓ Live` | ✅ (shows “syncing…” while refetching) |
| `Docs · Support · Export Report` with dividers | ✅ Export writes a real CSV |

---

## 2. CTA & action inventory (all live)

| Control | Behaviour |
| --- | --- |
| **New Website** | 4-step wizard: name → domain → locale/zone → template → review; inline validation, duplicate-host error, creates the site, DNS pending |
| **All Websites (3)** | site filter; scopes every card, the footer and the page title |
| **Last 30 days** | 7 / 14 / 30 / 90 day ranges; KPI, funnel, chart, table and funnel conversion all recompute |
| **Resolve / Review / Preflight** (attention cards) | SSL remediation drawer · broken-link report · publish preflight |
| **View All Issues** | issue queue drawer, resolves items one by one |
| **Drafts / Ready / Live release** | queue modals / release history |
| **Release →** | preflight → publish → success (v1.25) or 409 conflict with a rebase modal |
| **View Pages / View Details** | module routing / health & diagnostics drawer |
| **Manage** (site) | site workspace drawer (pages, design, settings, team, domain) |
| **Analytics** (site) | scopes the dashboard to that site + toast |
| **⋯** (site) | Preview Site · Duplicate · Rename · Archive · Delete (delete is blocked on published sites — the API rejects it) |
| **KPI / funnel / channel / health / table row / activity / forms / goals / vitals** | each opens a drawer or modal with its own data |
| **Search / ⌘K** | command palette over modules, actions, pages and issues |
| **Bell / help / avatar** | notifications (mark-all-read) · help menu · account menu |
| **Docs / Support / Export Report** | toast + docs · support · CSV download |
| **Quick Create** | command palette |
| Prototype switcher (beaker) | default / loading / empty / error / conflict / denied |

## 3. State matrix

| State | How to reach it | What you see |
| --- | --- | --- |
| Idle / default | first load | reference dashboard |
| Hover / active | hover any site card, KPI, row | lift, ring, CTA emphasis |
| Loading | first paint and the beaker → Loading | content-shaped shimmer skeleton (same grid, no layout shift) |
| Empty | beaker → Empty, or a site with no data | zeroed KPIs, empty table and site states with CTAs |
| Error | beaker → Error | error card with retry, last good data preserved |
| Conflict | beaker → Publish conflict, or a publish that 409s | diff modal: both edited / only you / only Anita, rebase or reload |
| Denied | beaker → Permission denied (Viewer) | read-only banner, destructive actions disabled |
| Success | complete a release, duplicate, rename, verify DNS | toast (green check, title + sub) |
| Resolved | fix the last issue | all-clear banner with “Re-run checks” |

## 4. Motion (spec → implementation)

| Interaction | Spec | Built |
| --- | --- | --- |
| Page load | fade + 8 px up, 300 ms, cubic-bezier(.16,1,.3,1) | ✅ |
| KPI counter | count-up 600 ms ease-out | ✅ |
| Card hover | lift + shadow, 160 ms | ✅ |
| Dropdown open | scale(.96→1) + fade, 180 ms | ✅ |
| Toast | slide up, 300 ms | ✅ |
| Chart tooltip | fade, 280 ms | ✅ |
| State change / filters | crossfade, 220 ms | ✅ |
| `prefers-reduced-motion` | — | ✅ animations and transitions collapse |

## 5. Data & clock

The workspace is pinned to **May 2025** so every date the mock shows matches:
axis ticks (`May 1 … May 30`), `Published May 29, 2025`, `Last updated: May 30,
2025 at 10:24 AM`, activity timestamps. `DEMO_CLOCK` in `src/lib/data.ts` is the
single place to switch back to the live clock. All figures roll up from one
store: the chart's final point is the Visitors KPI, the funnel is derived from
the same totals, and the acquisition split sums to the visitor count.

## 6. Known deviations

1. Avatar is initials, not a photograph (no bundled stock imagery).
2. Two KPI labels use short forms at ≤1440 px; the full terms live in the drawer.
3. The publishing strip drops the year from “Published May 29, 2025” when the
   card is narrow; the full date is in the tooltip and the release drawer.
4. The success confirmation is a dedicated release modal (ring + diff counts)
   in addition to the spec's toast pattern, because it carries the rollback
   action.

## 7. Ready for module 02

Module pages (Sites & Domains, Pages, Visual Builder, …) render through
`views/Placeholder.tsx`, which already reads the nav model's label, description
and four capability cards. Each new module replaces that placeholder with its
own view, its own store selectors and its own state set — the shell, the
dashboard, the palette and the flows stay untouched.
