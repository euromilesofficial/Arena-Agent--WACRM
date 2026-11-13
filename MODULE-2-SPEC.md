# Module 2 — Sites & Domains
## UI/UX Architecture Specification

**Product:** WACRM Website CMS · **Screen:** Website CMS → Sites & Domains (`#/sites`)
**Version:** 2.0 · **Date:** 13 November 2026 · **Status:** implemented in `src/views/Sites.tsx` and verified by `qa_module2.py` (48/48)
**Reference:** `uploads/WACRM Sites and Domains Dashboard.png` (pixel reference), Module 1 approved shell (`MODULE-1-REVIEW.md`)
**Companion:** `BACKEND-PLAN.md` §7.2, §7.17, §10 — every endpoint named here lives there and nowhere else.

---

## 1. Purpose and scope

The screen answers five questions and nothing else:

1. Which websites exist in this workspace?
2. Which are live, which are drafts, and what release is serving them?
3. Which hostname has a DNS or certificate problem right now?
4. What is the state of the selected site's domains, records and certificate?
5. What can I do next — open, manage, verify, re-point, add, remove?

**In scope:** website registry, per-site hostnames (primary + aliases), DNS record inspection and verification, certificate lifecycle, primary-domain switching, connected-domain inventory, the Connect Domain flow, the site inspector, every row/dropdown action, every operational state.

**Out of scope (deliberately absent):** a DNS zone editor, certificate authority UI, analytics, staging environments, scheduled publishing, domain registration/purchase, bulk destructive actions. Those belong to Publishing & Releases, SEO & Redirects, and Security & Audit.

---

## 2. Layout architecture

Desktop grid, one screen, no page scroll at 1440 × 900:

```
┌ sidebar 240 ─┬──────────────────────────── content 1184 ─────────────────────────────┐
│              │ header 56 (breadcrumb · search · bell · help · avatar)                  │
│  Website CMS │ page head 64  : title + subtitle            · website scope ▾           │
│  ├ Overview  │                                                 domain scope ▾           │
│  ├ Sites &   │                                                 Connect Domain           │
│  │  Domains  │                                                 + New Website (primary)  │
│  ├ Pages     │ attention strip 36 (only when issues exist)                            │
│  …           │ KPI row 62 : 5 cards                                                    │
│              │ ┌──────────── main column 774 ────────────┐ ┌── inspector 396 ───────┐  │
│              │ │ Site Registry card                      │ │ Domain Details         │  │
│              │ │  header: icon · title · search · view   │ │  head · site · meta    │  │
│              │ │  tab pills: All/Live/Draft/Attention    │ │  tabs (3)              │  │
│              │ │  table: 11 columns                      │ │  stepper (4 steps)     │  │
│              │ │  footer: counts · sync · refresh        │ │  actions (2)           │  │
│              │ ├─ Connected Domains card ────────────────┤ │  DNS records card      │  │
│              │ │  counts + hostname cards (3-up)         │ │  activity card         │  │
│              │ └─────────────────────────────────────────┘ └────────────────────────┘  │
│              │ status bar 34 : ⬤ WACRM CMS · synced · Docs · Support · Status · Privacy │
└──────────────┴────────────────────────────────────────────────────────────────────────┘
```

**Breakpoints**

| Width | Behaviour |
| --- | --- |
| ≥ 1400 px | Full layout: registry + inline inspector (396 px), 5 KPI cards with sparklines, all 11 columns |
| 1200–1399 px | Inspector narrows to 342 px; four low-priority columns (`Additional Domains`, `Live Release`, `Pages`, `Leads`) hide; sparklines hide; connected-domain cards 2-up |
| < 1200 px | Inspector leaves the grid; row click opens the same panel as a right drawer; KPI row becomes 3-up; the table keeps `Website · Primary Domain · DNS · SSL · Last Updated · Actions` |

Nothing scrolls horizontally at any width — verified at 1280/1440/1600 in `qa_module2.py`.

**Rhythm:** 12 px card gaps, 14 px column gap, 10–12 px radii, 1 px `#E8EAEF` borders, white cards on `#F4F5F7`, 10–13 px type, tabular numerals, one filled primary button per screen.

---

## 3. Information hierarchy

1. **Scope** — the two dropdowns decide what every number below them means.
2. **Health** — the attention strip is the only amber surface on the page and appears only when `dns ≠ verified ∨ ssl ≠ active`.
3. **Counts** — five cards, each a different question, never a composite "health %".
4. **Registry** — the object list; dense, sortable, filterable.
5. **Inspector** — depth for one object, never a second dashboard.
6. **Inventory** — connected domains, the hostname-level view of the same data.
7. **Status bar** — scope, freshness, escape hatches.

---

## 4. Component contracts

### 4.1 Toolbar (page head, right aligned)

| Control | Type | Contents | Behaviour |
| --- | --- | --- | --- |
| Website scope | dropdown | All websites (n), each site | Filters registry + KPIs + connected domains. Restores on reload via component state; server contract `?siteId`. |
| Domain scope | dropdown | All domains (n), Verified, Pending, Failed | Filters by the **primary** hostname state so the filter always matches the DNS column. Counts beside each item. |
| Connect Domain | secondary button, link icon | — | Opens the 4-step Connect Domain wizard pre-scoped to the inspected site. Disabled for Viewer. |
| New Website | primary button, plus icon | — | Opens Module 1's 4-step create-site wizard. Disabled for Viewer. |

The mock's header also carries the global search; that is Module 1's shell search (`⌘K`) and is not duplicated here — the registry has its own scoped search.

### 4.2 Attention strip

`[alert] N domains need attention — <Site> <DNS|SSL> <state> (<hostname>) [and N−1 more]  ·  Review & Fix →`

* Single line, 36 px, truncating with `…`, amber tint `#FFF8E8`, border `#F3E0B4`.
* Rendered only when at least one hostname is not fully live.
* `Review & Fix` selects the first offending site and scrolls the inspector to it.
* Error and Viewer banners reuse the same geometry with red/violet tints so the eye does not relearn the position.

### 4.3 KPI cards (5)

| Card | Value | Denominator | Click |
| --- | --- | --- | --- |
| Websites | count of non-archived sites in scope | — | filters registry to all |
| Connected Domains | count of hostnames | — | scrolls to Connected Domains |
| Verified DNS | `verified / total` | hostname bindings | domain scope = Verified |
| SSL Active | count with `ssl = active` | hostname bindings | inspector → SSL Certificate |
| Pending / Failed | `dns ≠ verified ∨ ssl ≠ active` | hostname bindings | registry tab = Needs Attention |

Each card: 28 px tinted icon tile, 17.5 px value, 10 px label, delta line with an arrow (green up / red down), 38 px sparkline. **Never** a single blended "health score": DNS, TLS, release and lifecycle are four independent facts, and a site can be live with a broken alias or verified without a certificate.

### 4.4 Site Registry

**Header:** grid icon, title, right-aligned 208 px search (`Search websites or domains…`, searches name, host, template and every hostname on the site), view toggle (table ⇄ grid).

**Tab pills:** `All n` · `Live n` · `Draft n` · `Needs Attention n`. Pills are single-select, `aria-pressed`, and the attention pill carries an amber tint even when inactive. Counts are always computed from the *scoped* set, so pills and dropdowns compose (AND).

**Table columns**

| # | Column | Content | Sort |
| --- | --- | --- | --- |
| 1 | ☑ | row selection (single-select on row click, multi via checkbox) | — |
| 2 | Website | 40×28 thumbnail, name, lifecycle badge under it (`Live` green / `Draft` amber) | name |
| 3 | Primary Domain | monospace hostname + external-link glyph; click copies | host |
| 4 | Additional Domains | `+N alias` violet pill, or `No alias` | alias count |
| 5 | DNS | pill `Verified` / `Pending` / `Failed`, click re-verifies | rank: failed < pending < verified |
| 6 | SSL | pill `Active` / `Pending` / `Renewing` / `Failed`, click opens the certificate view | same rank |
| 7 | Live Release | `v1.24` violet pill, `Draft` grey pill | string |
| 8 | Pages | integer, right aligned | numeric |
| 9 | Leads | integer, right aligned | numeric |
| 10 | Last Updated | relative (`2h ago`, `Yesterday`, `Not live`) | freshness |
| 11 | Actions | `⋯` 24 px ghost button | — |

*Fixed table layout with explicit per-column widths so no cell reflows on hover or data change.* Sorting is a two-state toggle on the active column, ascending first, with `aria-sort` on the header; ties keep the previous order (stable).

**Row states:** default · hover (`#FAFAFD`, 120 ms) · selected (`#F5F2FF` + violet checkbox, doubles as the inspector target) · focused (2 px focus ring, keyboard `Enter`/`Space`) · checked (bulk). Row height is a constant 44 px — hover never moves geometry.

**Footer:** `Showing N of M websites · K hostnames` on the left; `Synced just now` with a live spinner while refreshing, and a `Refresh` link on the right.

**Grid view:** 2-up cards with 56×44 thumbnail, name + lifecycle badge, hostname, DNS/SSL/release pills, `pages · leads · updated`. Same selection model.

### 4.5 Domain Details inspector

Header `Domain Details` (server icon + copy-hostname button) → site block (44 px thumbnail, name, hostname link, `DNS …` and `SSL …` pills stacked right) → meta row of three cells: **Primary Domain**, **Aliases** (`+1 (partner.euromiles.in)`), **Latest Release** → tab bar.

**Tabs**

| Tab | Content |
| --- | --- |
| Overview | 4-step verification stepper · `Verify Again` + `Open Domain Settings` · DNS Records mini-table (3 rows, `View All →`) · Recent Verification Activity (4 events) |
| DNS Records | every hostname on the site with full record set (Type / Host / Expected value / TTL / copy) + per-host `Verify DNS` and `Copy all`, plus the failure reason when verification failed |
| SSL Certificate | per hostname: state pill, issuer, expiry, Force HTTPS, HSTS, `Issue/Re-issue certificate`, `Behaviour` |

**Verification stepper** — the single most important diagnostic on the screen. Four ordered steps, each with marker, title, one-line explanation, status pill and timestamp:

1. `TXT/CNAME record added` — done when a record validates
2. `Propagation check` — done when the resolver agrees
3. `Certificate provisioning` — `In Progress` (pulsing, 1200 ms) while `ssl = provisioning`, `Failed` in red when the CA rejects
4. `HTTPS validation` — done when `ssl = active`

Markers: green filled check (done), dashed amber ring with pulse (in progress), red cross (failed), hollow grey (pending). A 1.5 px connector turns green as steps complete. **A spinner never produces a state** — the pill text is the state.

**Activity list** — derived, not decorative: `DNS check passed`, `TXT record detected`, `SSL provisioning in progress`, `Certificate active`, `Certificate request failed`, each with a dot (green/amber/red) and relative time.

### 4.6 Connected Domains

Header: title, subtitle `All domains and aliases linked to websites in your workspace.`, three count pills (`Primary n`, `Alias n`, `Pending n`). Body: 3-up cards — hostname (monospace), one status pill (`Pending` wins over `Primary`/`Alias`, exactly as the reference), owning site name, copy-hostname button, `⋯` that opens the same row menu.

No domains → full-width empty row: `No custom domains connected` + `Connect Domain`.

### 4.7 Row / domain overflow menu

| Group | Item | Destination | Guard |
| --- | --- | --- | --- |
| Open | Open site | `https://<primary host>` | disabled when no hostname |
| | Manage website | selects the site (inspector / drawer) | — |
| Domain | Verify DNS | job + toast, pill transitions | disabled when no hostname or Viewer |
| | SSL details | Domain settings dialog | disabled when no hostname |
| | Make primary | Domain settings dialog (confirm inside) | disabled when already primary |
| | Copy hostname | clipboard + toast | — |
| Content | Preview website | preview modal | — |
| Site | Rename | rename dialog | — |
| | Duplicate | clone dialog | Viewer denied |
| Danger | Archive / Delete | guarded dialogs | capability `delete` |

Menu is anchored to the trigger row, flips near the viewport edge, closes on Esc/outside, and every item is keyboard reachable.

---

## 5. Flows

### 5.1 Connect Domain (4 steps)

| Step | Screen | Validation | Failure |
| --- | --- | --- | --- |
| 1 Website | select with `Select a website…`, skipped when the inspector already scopes one | must choose | — |
| 2 Domain | hostname input, `Set as primary domain` checkbox, hint about punycode/paths | regex `^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$`, lowercased + trimmed before send | inline message; `409` → "already attached to another website" without naming the other tenant |
| 3 Records | authoritative record table (Type / Host / Expected value / copy) from the API, banner "Nothing is live until verification passes" | — | `Verify DNS Now` can fail in place and stays available |
| 4 Verified | green confirmation card, hostname/DNS/SSL/primary summary | — | verify failures keep the user on step 3 |

Progress rail marks completed steps green, the current one violet. Closing after step 2 keeps the pending binding; reopening continues from records.

### 5.2 Verify DNS

`Verify DNS` → button enters `Checking…` and disables → server job → success: pill `Verified`, TLS auto-queues (`Pending`), toast; failure: pill stays `Pending`, inline reason appears on the domain card (`Resolver returned NXDOMAIN for the CNAME record.`), button re-enables. Throttled to one manual check per minute (`429` in the contract).

### 5.3 Make primary / Remove domain

Both open a confirm panel inside Domain settings with the impact spelled out (canonical links and sitemaps rewritten; previous primary kept until the new one verifies; traffic to a removed host 404s). Removing the last hostname is blocked with the reason shown.

### 5.4 Site lifecycle

Rename / Duplicate / Archive / Delete reuse Module 1's dialogs, opened from this screen with the correct `siteId`; the registry reflects the result on refetch (duplicate appears as `(copy)`, archive moves to the archived strip, delete removes the row).

---

## 6. State catalogue

Reachability key — **seeded**: present in the prototype data on first load; **event**: produced by an action the reviewer can take in the UI; **forced**: only reachable through the prototype state switcher (`Prototype states` menu); **contract**: defined in `BACKEND-PLAN.md` §7.17 and rendered when the API returns it.

| # | State | Rendering | Reachable by |
| --- | --- | --- | --- |
| 1 | Loading | geometry-matched skeleton inside the registry card (`.sk`, 1.4 s shimmer); KPI values, inspector and connected-domains boxes keep their geometry | seeded (1.4 s on first paint) + forced |
| 2 | Refreshing | rows stay, `syncing…` spinner in the registry footer, `Synced just now` updates on resolve | event (`Refresh`) |
| 3 | Error | red strip `Sites and domains service unavailable (503)` + `Retry`; last valid rows kept, nothing blanked | forced + contract (`503`) |
| 4 | Empty workspace | counters 0, registry empty state with `Create Your First Website`, connected-domains empty row, inspector `Select a website to see its domains.` | forced + contract |
| 5 | No results | in-card `No websites match your filters` + `Clear Filters`; scope and search preserved on clear | event (search / scope + pill filter) |
| 6 | Viewer | violet strip explaining read-only; every write control disabled (pills stop acting, row menus disabled) | forced |
| 7 | DNS unverified | amber pill, records visible to copy, stepper steps 1–2 pending, `Verify Again` enabled | seeded (Partner Portal) |
| 8 | DNS checking | row pill swaps to a pulsing amber `Checking…` (`.pill.is-checking`) for the duration of the job; verdict replaces it on resolve, never before | event (`Verify Again` / DNS pill) |
| 9 | DNS failed | red `Failed` pill on row, connected-domain tile and inspector header; steps 1–2 turn red with the resolver reason inline; step 3 explains the certificate is held; `Verify Again` retries and the failure clears on success | event (18 % resolver failure per host, retryable) |
| 10 | Certificate held | step 3 sub-copy states the certificate waits for DNS; TLS pills never claim `Active` while DNS is failed | event (follows #9) |
| 11 | TLS provisioning | amber `Pending` pill, stepper step 3 in progress with pulse, cert row shows `Requesting` | event (DNS verify on a pending host) |
| 12 | TLS active | green pill, issuer + expiry in the SSL tab, stepper complete | seeded (3 hostnames) |
| 13 | TLS failed | red pill, cause, `Issue certificate` retry | seeded on a newly added hostname (Connect Domain) |
| 14 | No domains | row reads `Not connected` / `No alias` / `—` / `—`; primary cell becomes a `+ Connect` affordance; inspector header shows `Not connected` pill and no fake hostname; DNS tab empty state with `Connect Domain` | event (Create Website without a domain) |
| 15 | Deleting / archiving | dialog with dependency summary and typed confirmation; blocked states explain themselves (`A published website must be archived before deletion`) | event (row menu) |
| 16 | Success | toast bottom-right, row and counters update from the refetch (never optimistically invented) | event (any write) |

Every pill carries text plus a dot; colour alone never communicates a state.

---

## 7. Motion

| Element | Duration | Easing | Effect |
| --- | --- | --- | --- |
| Row hover | 120 ms | ease-out | background tint only |
| Row select | 140 ms | ease-out | tint + checkbox |
| KPI hover | 160 ms | cubic-bezier(.16,1,.3,1) | 1 px lift, border, shadow |
| Grid card hover | 160 ms | same | 1 px lift, border |
| Popover / dropdown | 180 ms | cubic-bezier(.16,1,.3,1) | fade + scale .97→1 |
| Tabs / pills | 130–200 ms | ease-out | background + colour |
| Stepper pulse | 1200 ms loop | ease-in-out | amber halo, only while a job runs |
| Drawer | 280 ms | cubic-bezier(.16,1,.3,1) | slide-in, overlay fade |
| Modal | 240 ms | same | fade + scale .96→1 |
| Skeleton | 1400 ms loop | linear | shimmer |
| Toast | 280 in / 180 out | same | fade + 6 px rise |

`prefers-reduced-motion` removes the pulse, lift and shimmer but keeps every state readable.

---

## 8. Accessibility and keyboard

* Row is a `tabIndex=0` element that responds to `Enter`/`Space`; checkboxes are separately labelled (`Select <site>`), select-all is labelled per page.
* Sort headers are buttons with `aria-sort`; pills use `aria-pressed`; inspector tabs use `role="tablist"` with `aria-selected`.
* Menu triggers expose `aria-haspopup`/`aria-expanded`; menus close on Esc and return focus.
* Focus rings are visible on every interactive element; the drawer/modal trap focus through Module 1's `useDialogFocus`/`useEscape`.
* Contrast: all pill text pairs pass AA at their size; no information is colour-only.
* Copy actions announce through the toast (a live region), not just the clipboard.

---

## 9. Data contract used by this screen

```
Site   { id, name, host, status: live|draft, dns, ssl, pages, leads,
         release: "v1.24" | null, releasedAt, thumb, template, archived? }
Domain { id, siteId, hostname, primary, dns: verified|pending|failed,
         ssl: active|provisioning|failed|expiring, sslIssuer?, sslExpires?,
         addedAt, verifiedAt?, lastChecked, records: DnsRecord[],
         error?, forceHttps, redirectWww, hsts }
DnsRecord { type: A|AAAA|CNAME|TXT, name, value, ttl,
            status: ok|missing|mismatch, found? }
```

Derivations used by the UI — all client-side, all single-source:

| UI fact | Derivation |
| --- | --- |
| Primary domain / aliases | `domains.filter(siteId)` split on `primary` |
| DNS / SSL pills per row | primary domain's states (never the site's legacy fields) |
| Needs attention count | hostnames where `dns ≠ verified ∨ ssl ≠ active` |
| Verified DNS `x/y` | verified hostnames / all hostnames |
| Stepper states | DNS verified → steps 1–2 done; `ssl` → steps 3–4 |
| Activity feed | derived from each hostname's verification and certificate state |

`liveUrl`/`previewUrl` are still composed client-side from the hostname; the server fields in `BACKEND-PLAN.md` §7.2 supersede this when the API lands, and **Open site** must hide itself when `liveUrl` is null.

---

## 10. Interaction matrix (every clickable thing)

| Zone | Control | Effect | Disabled when |
| --- | --- | --- | --- |
| Head | Website scope / Domain scope | filter | — |
| Head | Connect Domain | wizard step 1 (or 2 if scoped) | Viewer |
| Head | New Website | create wizard | Viewer |
| Strip | Review & Fix | select first failing site | — |
| Strip | Retry | refetch | — |
| KPI | any card | tab / inspector shortcut | — |
| Registry | search, ×, clear | filter / reset | — |
| Registry | view toggle | table ⇄ grid | — |
| Registry | 4 pills | status filter | — |
| Registry | select-all, row checkbox | bulk selection + `N selected · Clear` | — |
| Registry | 9 sort headers | toggle sort | — |
| Registry | row / name | select → inspector or drawer | — |
| Registry | hostname | copy | — |
| Registry | DNS pill | verify job | Viewer |
| Registry | SSL pill | open certificate view | — |
| Registry | `⋯` | row menu | — |
| Registry | Refresh | refetch | — |
| Connected | card, copy, `⋯`, Connect Domain | select / copy / menu / wizard | — |
| Inspector | copy host, hostname link, 3 tabs | copy / open site / switch tab | — |
| Inspector | Verify Again, Open Domain Settings | job / settings dialog | no hostname · Viewer |
| Inspector | View All →, All → | DNS tab / activity drawer | — |
| DNS tab | copy, Verify DNS, Copy all | clipboard / job / clipboard | Viewer for verify |
| SSL tab | Issue certificate, Behaviour | job / settings dialog | DNS unverified · Viewer |
| Wizard | Cancel, Back, Next, Connect domain, Verify DNS Now, Done | step machine | validation · Viewer |
| Settings | Verify, Make primary, Remove, switches, Add domain | guarded mutations | Viewer · preconditions |

---

## 11. Non-goals surfaced on purpose

`Scheduled` publishing, a "Renew SSL" button that no provider backs, tenant-owner disclosure on hostname conflicts, a global "67 % healthy" score, bulk archive/delete, and editing third-party DNS zones are all **absent by design** — each would be a promise the backend contract does not make.

---

## 12. Acceptance criteria (all verified)

1. One screen, no horizontal scroll at 1280/1440/1600 — `48/48` in `qa_module2.py`.
2. Registry, KPIs, connected domains and inspector all read the same two collections — no contradictory numbers.
3. Every row, pill, tab, dropdown, menu item and dialog in §10 has a working effect or an explicit disabled reason.
4. All 16 states in §6 render, each with the reachability path listed there — `25/25` in `qa_states.py` (DNS failure is produced deterministically by stubbing `Math.random` for one request, not by retrying until it happens).
5. Verification and certificate states change only after the async call resolves.
6. Module 1 flows still pass: `qa_flows.py` 38/38.
7. Write actions are optimistic-free: a row never shows `Verified`, `Active` or an updated counter before the promise resolves; a failure leaves the previous value and surfaces the cause inline.

### How each state was verified

| Audit | Covers |
| --- | --- |
| `qa_module2.py` (48) | layout, geometry, KPIs ↔ data, columns, inspector, connected domains, overflow at three widths |
| `qa_states.py` (25) | §6 states: loading, refreshing, error, empty, no-results, Viewer, DNS pending/checking/failed/retry, certificate held/provisioning/active/failed, no-domain, delete guard, toast, inspector↔drawer split |
| `qa_flows.py` (38) | Module 1 regression: navigation, publishing, command palette, drawers |
