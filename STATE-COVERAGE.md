# State coverage — Modules 1 & 2

Every state below is code-backed in `WACRM-CMS.html` (React 19 + TS build; all reads go through `src/lib/data.ts`, which adds latency and failure paths, so nothing is a static mock in the view layer).

| Audit | Covers | Result |
| --- | --- | --- |
| `qa_states_m1.py` | Module 1 — Overview states, drilldowns, publishing, permissions, guards | **39/39** |
| `qa_states.py` | Module 2 — Sites & Domains states | **25/25** |
| `qa_module2.py` | Module 2 layout, geometry, data consistency, overflow | **48/48** |
| `qa_flows.py` | cross-module flows: navigation, publish wizard, palette, drawers | **38 ok / 0 failed** |

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
