# WACRM Website CMS — Backend Specification

**Document:** `BACKEND-PLAN.md`
**Version:** 1.3 — 13 Nov 2026
**Scope:** Everything that must exist on the server, database, and infrastructure side before Module 1 (Overview) can run on real data, and through the remaining CMS modules.
**Audience:** Backend engineers, SRE/DevOps, the front-end engineer who owns `src/lib/data.ts`.
**Change log:** v1.3 (13 Nov 2026) — Module 2 was rebuilt to the approved reference layout (registry + inline inspector + connected domains). §7.17 was rewritten against that layout; §7.2 gained `GET /v1/domains/{id}/verification` (the four-step stepper), `GET /v1/domains/{id}/activity`, and the KPI-trend read. v1.2 (13 Nov 2026) — Module 2 (Sites & Domains) is now built, so §7.2 gained five domain routes (`:set-primary`, `/options`, workspace `GET /v1/domains`, `/records`, `/activity`), §10.1 gained the record + verify-failure contract, a new **§7.17** maps every element of the screen to its endpoint, and §7.16 gained eight action rows. Nothing was removed. v1.1 (13 Nov 2026) — added §7.10–7.16 (forms, goals, support, meta/freshness, session, conflict rebase), the full **§7.16 action matrix** mapping every interactive element in the UI to one contract, and the partial-failure response contract in §9.4. No endpoint was removed; `/v1/exports` gained a body. **Status of the front end:** Module 1 is built against an in-browser mock (`src/lib/data.ts` → `API.*`, persisted to `localStorage`). Every function in that mock maps to exactly one contract in §7. When a contract here is implemented, the mock function is deleted and replaced by an HTTP call with the same shape — the UI must not need changes.

**Nothing in this document is needed to view or demo the product.** Module 1 runs entirely in the browser today; this file is the contract that the server must satisfy when backend work starts. Keeping it current is the only place backend interaction is tracked.

### Contents

| § | Section | § | Section |
| --- | --- | --- | --- |
| 0 | How to read this | 11 | Media, forms, other pipelines |
| 1 | Product invariants | 12 | Jobs, scheduling, idempotency |
| 2 | Architecture | 13 | Observability & SLOs |
| 3 | Identity, tenancy, RBAC | 14 | Security & compliance |
| 4 | Data model | 15 | Performance budgets |
| 5 | API conventions & errors | 16 | Environments & delivery |
| 6 | Public site & ingest | 17 | Build order |
| 7 | Endpoint catalogue (7.1–7.17) | 18 | Reference dataset |
| 8 | Publishing pipeline | 19 | Front-end handshake (19.1) |
| 9 | Analytics & metrics | 20 | Open decisions |
| 10 | Domains, DNS, TLS | 21 | Appendix |

---

## 0. How to read this document

| Marker | Meaning |
| --- | --- |
| **MUST** | Required for Module 1 to ship on real data. Blocking. |
| **SHOULD** | Required before the module's public launch, may trail one sprint. |
| **LATER** | Designed here so the schema does not have to change later; not built in the Module 1 sprint. |
| `⇒` | Direct mapping to a function currently faked in `src/lib/data.ts`. |

Sections 1–6 are decisions and rules. Section 7 is the endpoint catalogue — the part the front end is written against. Sections 8–12 are the pipelines that make those endpoints truthful. Sections 13–17 are operations, security, and delivery order. Section 18 is the reference dataset that lets the backend be validated against the existing UI pixel-for-pixel.

---

## 1. Product invariants

These are non-negotiable; any endpoint that violates them is a bug, not a design choice.

1. **Tenant isolation is absolute.** Every row that a customer can see carries `org_id`. A request is scoped to one org at a time. Cross-org reads are impossible by construction (row-level security), not by careful query writing.
2. **Published content is immutable.** A release is a frozen snapshot. Editing a page after publishing never changes what the public site serves until a new release lands. Rollback is a pointer move, never a rewriting of history.
3. **No silent overwrites.** Publish is a compare-and-swap against the draft ETag the editor started from. Two editors publishing concurrently results in one success and one `409 CONFLICT` with a machine-readable description of what changed.
4. **Every number on screen is reproducible.** Each metric has one definition (see §9.3), one source table, and one aggregation job. The dashboard never sums pre-aggregated averages.
5. **Analytics failure never blocks content work.** Dashboard widgets degrade to a stale/error state per region; the publishing surface stays usable.
6. **Nothing destructive is undoable-by-accident.** Delete is soft (archive) for 30 days. Release history is retained for the life of the site. Audit events are append-only.
7. **Time is explicit.** Every timestamp is stored UTC (`timestamptz`); every analytics bucket is computed in the site's IANA timezone and returned with that timezone and the exact window boundaries.
8. **The API is boring.** One envelope, one pagination style, one error taxonomy, one idempotency mechanism, identical for every module.

---

## 2. Architecture

### 2.1 Shape

```
                    ┌──────────────────────────────────────────────┐
  Browser (SPA) ───▶│  Edge: CDN + WAF + rate limit                │
                    └───────────────┬──────────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────────┐
                    │  API gateway (authn, org scoping, quota)     │
                    └───┬───────────┬────────────┬─────────────────┘
                        │           │            │
              ┌─────────▼──┐  ┌─────▼─────┐  ┌───▼─────────────┐
              │ core-api   │  │ analytics │  │ publish-worker  │
              │ (CMS CRUD, │  │  -api     │  │ (manifest, CDN, │
              │  publishing│  │ (read     │  │  rollback, DNS) │
              │  control)  │  │  models)  │  └───────┬─────────┘
              └─────┬──────┘  └─────┬─────┘          │
                    │               │                │
        ┌───────────▼───────────────▼────────────────▼───────────┐
        │ PostgreSQL 16 (primary + read replica)                 │
        │   schema: core | analytics | ops                       │
        ├────────────────────────────────────────────────────────┤
        │ Redis (sessions, rate limits, ETag cache, job queues)  │
        │ S3-compatible object store (drafts, CAS assets, jobs)  │
        │ ClickHouse / Timescale  (event + rollup store)         │
        │ Queue broker (SQS or Redis Streams)                    │
        └────────────────────────────────────────────────────────┘
```

### 2.2 Services

| Service | Responsibility | Scaling |
| --- | --- | --- |
| `core-api` | Auth, orgs, sites, pages, blocks, media metadata, releases, notifications, audit | stateless, HPA on RPS |
| `analytics-api` | Read-only metric endpoints; never writes content | stateless, cache-heavy |
| `ingest` | Public event collector (`POST /e`, form submissions), edge-terminated, no auth cookie access | stateless, high throughput, separate WAF profile |
| `publish-worker` | Preflight, manifest build, CAS upload, CDN purge, TLS orchestration, domain verification | queue-driven, small |
| `export-worker` | CSV/PDF generation into object storage | queue-driven |
| `scheduler` | Cron: hourly rollups, daily rollups, SSL renewals, link crawls, retention sweeps | singleton w/ leader lock |

**Why split `analytics-api` from `core-api`:** the dashboard must survive an analytics outage (§1.5). Separate deployables let an analytics incident page nobody and leave publishing untouched; the UI already renders per-region error states for exactly this case.

### 2.3 Runtime choices (recommended, changeable with notice)

| Concern | Choice | Note |
| --- | --- | --- |
| Language | TypeScript (Node 22, Fastify) or Go | Shared types with the front end if TS; generate OpenAPI either way |
| DB | PostgreSQL 16, one schema per domain (`core`, `analytics`, `ops`) | RLS everywhere |
| Events/rollups | Timescale hypertable in the same PG first; ClickHouse only past ~2B events/month | keeps ops simple at MVP |
| Objects | S3-compatible (R2/S3/MinIO) with content-addressed keys | `cas/sha256/<hash>` |
| Queue | SQS (or Redis Streams for local) | at-least-once, so all consumers idempotent |
| Search | Postgres FTS (`tsvector`) for the command palette | no Elasticsearch at this stage |

---

## 3. Identity, tenancy, and permissions

### 3.1 Objects

```
Organization (tenant)  ──< Membership >──  User
       │                                     │
       └──< Site ──< Domain                 └──< Session / RefreshToken
              │
              ├──< Page ──< PageRevision
              ├──< Menu ──< MenuItem
              ├──< MediaAsset
              ├──< Form ──< FormSubmission
              ├──< Release ──< ReleaseItem
              ├──< Goal, Issue, Notification
              └──< AnalyticsEvent (partitioned by org + day)
```

### 3.2 Roles

Four roles, matching the UI's `can()` gate in `src/lib/store.tsx`.

| Action | Owner | Admin | Editor | Viewer |
| --- | :---: | :---: | :---: | :---: |
| View dashboard/analytics | ✓ | ✓ | ✓ | ✓ |
| Create/rename/duplicate site | ✓ | ✓ | ✓ | ✗ |
| Delete site (archive) | ✓ | ✓ | ✗ | ✗ |
| Manage domains / verify DNS / provision TLS | ✓ | ✓ | ✗ | ✗ |
| Edit pages, blocks, menus, media | ✓ | ✓ | ✓ | ✗ |
| Publish a release | ✓ | ✓ | ✓* | ✗ |
| Rollback a release | ✓ | ✓ | ✗ | ✗ |
| Manage members & roles | ✓ | ✓ | ✗ | ✗ |
| Billing, org deletion | ✓ | ✗ | ✗ | ✗ |

\* site-scoped: a site may require `publish_requires_admin` (§11.7). The API enforces; the UI reflects `permissions` in the dashboard payload.

`⇒` maps to `permissions: { role, canCreate, canPublish, canManageDomain, canDelete }` already returned by `API.getOverview`.

### 3.3 Auth flows

| Flow | Detail |
| --- | --- |
| Session | HttpOnly `Secure` `SameSite=Lax` cookie holding an opaque session id; server-side session in Redis, 30-day sliding, 12-hour idle timeout |
| Access token | Short-lived (10 min) signed JWT for API calls made by the SPA — or cookie-only; pick one and never mix |
| Refresh | Rotation with reuse detection: a reused refresh token revokes the whole family and emails the user |
| Step-up | WebAuthn or TOTP within 5 minutes for: publish to a custom domain, rollback, domain delete, member role change, org delete |
| SSO | SAML/OIDC at Admin+; `LATER` |
| Service tokens | `api_keys` table, hashed with Argon2id, scope = role + site list, used by CI publish |

`GET /v1/me` returns `{ user, org, memberships[], role, permissions{} }`.

### 3.4 Row-level security

Every tenant table:

```sql
ALTER TABLE core.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pages_tenant ON core.pages
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
```

The app sets `app.org_id` and `app.user_id` per transaction from the verified token — never from a request header alone. Integration tests MUST include a cross-tenant probe that asserts `0 rows` rather than relying on application filters.

---

## 4. Data model

### 4.1 `core` schema

**`orgs`** — `id uuid pk`, `name`, `slug unique`, `plan`, `created_at`, `settings jsonb` (default locale, tz), `deleted_at`.

**`users`** — `id uuid pk`, `email citext unique`, `name`, `avatar_url`, `password_hash`, `mfa_secret`, `email_verified_at`, `last_seen_at`.

**`memberships`** — `org_id`, `user_id`, `role enum(owner|admin|editor|viewer)`, `site_scope uuid[] null`, `created_at`; PK `(org_id,user_id)`; index `(user_id)`.

**`sessions`** — `id`, `user_id`, `org_id`, `ip inet`, `ua text`, `created_at`, `last_used_at`, `revoked_at`.

**`sites`** — `id uuid pk`, `org_id`, `name`, `slug`, `status enum(published|draft|archived)`, `primary_domain_id`, `locale`, `timezone`, `theme_key`, `draft_etag text` (opaque, bumped on every draft mutation), `live_release_id`, `created_at`, `archived_at`.
Indexes: `(org_id, status)`, `unique(org_id, slug)`.

**`site_domains`** — `id`, `site_id`, `hostname citext`, `is_primary bool`, `dns_status enum(pending|verified|failed)`, `dns_checked_at`, `ssl_status enum(provisioning|active|failed)`, `ssl_issued_at`, `ssl_expires_at`, `verification_token`, `last_error jsonb`.
`unique(hostname)` globally — one hostname can belong to exactly one site.

**`pages`** — `id`, `site_id`, `org_id`, `parent_id`, `title`, `slug`, `path` (materialized, `/study-in-italy`), `status enum(draft|in_review|published|archived)`, `draft_revision_id`, `published_revision_id`, `seo jsonb`, `locale`, `sort_index`, `views_30d bigint` (denormalized read model, refreshed hourly), `leads_30d bigint`, `created_by`, `updated_by`, `updated_at`.
Indexes: `(site_id, status)`, `unique(site_id, locale, path)`, FTS on `title`.

**`page_revisions`** — `id`, `page_id`, `org_id`, `seq bigint`, `blocks jsonb`, `content_hash char(64)`, `author_id`, `created_at`, `message`.
Append-only. `unique(page_id, seq)`. `content_hash` is the CAS unit.

**`menus`**, **`menu_items`** — nav trees; `menu_items.parent_id`, `sort_index`, `target_path`, `depth` (constraint ≤ 3).

**`blocks_library`** — reusable block definitions: `id`, `org_id`, `key`, `name`, `schema jsonb`, `variants jsonb`, `deprecated_at`.

**`media_assets`** — `id`, `org_id`, `site_id null` (null = org-wide), `kind enum(image|video|doc)`, `filename`, `mime`, `bytes`, `width`, `height`, `sha256`, `cas_key`, `variants jsonb` (`[{w,h,format,key}]`), `focal_point jsonb`, `alt`, `usage_count`, `created_by`.

**`releases`** — `id`, `org_id`, `site_id`, `version text` (`v1.24`), `seq int`, `manifest_key`, `manifest_hash char(64)`, `status enum(building|live|superseded|failed|rolled_back)`, `item_count`, `byte_size`, `created_by`, `created_at`, `activated_at`, `rolled_back_from uuid null`, `notes`.
`unique(site_id, seq)`, `unique(site_id, version)`.

**`release_items`** — `release_id`, `page_id`, `page_revision_id`, `content_hash`, `path`, `asset_hashes text[]`.

**`forms`** — `id`, `org_id`, `site_id`, `name`, `fields jsonb`, `settings jsonb` (consent, honeypot, redirect), `status`.
**`form_sessions`** — `id`, `form_id`, `visitor_id`, `started_at`, `last_field_at`, `submitted_at` — this is how *starts* are counted honestly (§9.3).
**`form_submissions`** — `id`, `org_id`, `form_id`, `session_id`, `payload jsonb` (PII, encrypted at rest), `consent jsonb` `{granted,purpose,text_version,ip,ua,at}`, `lead_id`, `spam_score`, `created_at`.
`unique(form_id, client_submission_id)` for idempotent resubmits.

**`goals`** — `id`, `org_id`, `site_id`, `name`, `metric enum(leads|bookings|submissions|revenue)`, `target int`, `window enum(month|quarter)`, `current int` (materialized).

**`issues`** — `id`, `org_id`, `site_id`, `kind enum(warn|info|amber|error)`, `code text` (`ssl_pending`, `broken_link`, `unpublished_changes`, `vitals_regression`), `label`, `sub`, `payload jsonb`, `severity smallint`, `state enum(open|resolved|snoozed)`, `detected_at`, `resolved_at`, `dedupe_key unique`.
The banner and the Action Center both read this table — one source, so the banner count and the list can never disagree.

**`notifications`** — `id`, `org_id`, `user_id null` (null = org-wide), `kind enum(info|ok|warn|error)`, `title`, `body`, `route text` (`#/pages?site=…`), `read_at`, `created_at`, `expires_at`.

**`activity_events`** — `id`, `org_id`, `site_id null`, `actor_id`, `kind` (`publish|edit|rollback|domain|member|delete`), `title`, `meta`, `tone`, `created_at`, `subject_type`, `subject_id`.
Backs both "Recent Activity" and the audit log; the audit view adds `diff jsonb`.

**`audit_events`** — append-only, `prev_hash`/`hash` chain per org, `actor_ip`, `ua`, `request_id`, `before jsonb`, `after jsonb`. Never updated or deleted.

**`feature_flags`** — `org_id`, `key`, `enabled`, `rollout jsonb`.

### 4.2 `analytics` schema

**`events`** (hypertable, partitioned by day) — `id`, `org_id`, `site_id`, `received_at`, `occurred_at`, `name enum(pageview|form_start|form_submit|cta_click|booking|vital)`, `visitor_id` (daily-rotating hash), `session_id`, `path`, `referrer_host`, `utm jsonb`, `channel enum(search|social|direct|referral|email|paid)`, `device`, `country`, `props jsonb`.

Retention: raw 400 days, then dropped. Rollups kept forever.

**`sessions`** (derived) — `id`, `visitor_id`, `site_id`, `started_at`, `ended_at`, `pageviews`, `channel_first`, `channel_last`, `is_bounce`.

**`rollup_daily`** — grain `(org_id, site_id, day, path)` → `visitors, pageviews, leads, bookings, starts, bounces`; unique on the grain; rebuilt idempotently (`INSERT … ON CONFLICT DO UPDATE`).
**`rollup_channel_daily`** — grain `(org_id, site_id, day, channel)`.
**`vitals_daily`** — grain `(org_id, site_id, day, metric, device)` → `p75, samples`.
**`metric_snapshots`** — materialized KPI responses for fast dashboard reads (§7.3), keyed `(org_id, site_id, range, gran, computed_at)`.

### 4.3 `ops` schema

**`jobs`** — `id`, `type`, `payload jsonb`, `state enum(queued|running|done|failed)`, `attempts`, `last_error`, `run_after`, `started_at`, `finished_at`, `idempotency_key unique`.
**`export_files`** — `id`, `org_id`, `kind csv|pdf`, `params jsonb`, `object_key`, `bytes`, `expires_at`.
**`webhook_endpoints`**, **`webhook_deliveries`** — HMAC secret, retries, DLQ.
**`domain_checks`** — history of DNS lookups with resolver + raw answer (support evidence).

### 4.4 Sizing assumptions

- 10k orgs, 40k sites, 300k pages, 12M events/day peak.
- `events` at ~120 bytes → ~1.5 GB/day raw, 550 GB/year before retention drop; Timescale compression at 7 days cuts this ~12×.
- Dashboard read path must never touch `events`; it reads `rollup_daily` / `metric_snapshots`.

---

## 5. API conventions

| Concern | Rule |
| --- | --- |
| Base | `https://api.wacrm.io/v1` |
| Versioning | Path major (`/v1`), additive changes only within a major; breaking changes ship `/v2` and both live 90 days |
| Content type | `application/json; charset=utf-8` |
| Auth | Session cookie **or** `Authorization: Bearer <jwt>`; `X-Org-Id` selects the tenant and MUST match a membership |
| Envelope | Success `{ "data": …, "meta": { "requestId", "asOf", "stale" } }`; error `{ "error": { "code", "message", "details", "requestId" } }` |
| Pagination | Cursor: `?limit=50&cursor=<opaque>` → `meta.nextCursor`; `limit` max 200. Offset pagination only for exports |
| Filtering | Explicit typed query params, never a query DSL |
| Time window | Three accepted forms: `range=7\|14\|30\|90` (whole days ending today), `range=<n>&end=<n>` (n days ending n days ago — the calendar presets and the custom picker send this), or `start=<ISO date>&end=<ISO date>` (inclusive, ≤ 366 days). Echo the resolved `window:{start,end,timezone,days}` in the response; reject mixes with `422 VALIDATION_FAILED` |
| Sorting | `?sort=-views,title` (leading `-` = desc), whitelist per endpoint |
| Idempotency | `Idempotency-Key: <uuid>` required on all `POST` that create or mutate money/state (publish, rollback, create site, export). Replay returns the original response, 24-hour window |
| Concurrency | `ETag` + `If-Match` on any mutated resource; `412 PRECONDITION_FAILED` when missing, `409 CONFLICT` when stale |
| Time | ISO-8601 UTC with `Z`. Analytics responses also return `window: { start, end, timezone }` |
| Rate limits | 600 req/min per user, 60/min on `POST /v1/releases`, 30/min on export, 300/min per IP on ingest. `429` + `Retry-After` + `X-RateLimit-*` |
| Compression | gzip/br above 1 KB; responses over 100 KB are paginated instead |
| CORS | Exactly the CMS origin(s), credentials allowed, no wildcard |
| Tracing | `X-Request-Id` echoed; `traceparent` propagated (W3C) |
| Deprecation | `Sunset` and `Deprecation` headers, changelog entry, in-app notice |

### 5.1 Error taxonomy

| `code` | HTTP | When | UI behaviour |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | 422 | Field-level problems | Inline errors from `details.fields` |
| `UNAUTHENTICATED` | 401 | No/expired session | Redirect to sign-in, preserve return hash |
| `FORBIDDEN_ROLE` | 403 | Role lacks permission | Disable-then-toast pattern already implemented |
| `NOT_FOUND` | 404 | Missing or cross-tenant resource | Empty state, never leak existence |
| `CONFLICT` | 409 | CAS failure, duplicate hostname, version clash | Publish conflict modal `⇒ { kind:"conflict" }` |
| `PRECONDITION_FAILED` | 412 | Missing `If-Match`, unverified domain | Inline remediation |
| `STEP_UP_REQUIRED` | 428 | Destructive action without fresh MFA | Step-up dialog, then retry |
| `RATE_LIMITED` | 429 | Quota | Toast with retry timer |
| `DEPENDENCY_UNAVAILABLE` | 502/503 | Analytics/DB/CDN degraded | Per-region error card; **must not** white-screen the dashboard |
| `PAYLOAD_TOO_LARGE` | 413 | Upload limits | Upload dialog error |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong file kind | Same |

`details` is always an object: `{ fields?, conflict?, retryAfter?, resource? }`. Never a string.

---

## 6. Authentication of the public site & ingest

Public page delivery does not go through `core-api`:

1. Edge resolves `Host` → `site_domains.hostname` → `site_id` + `live_release_id` from a 60-second edge cache.
2. Edge serves the manifest's page HTML/CSS/JS straight from the object store / edge cache.
3. `POST /e` (ingest) receives batched events (`sendBeacon`, ≤ 32 events, ≤ 16 KB). It is cookie-less, uses the site's public write key, sets a first-party `visitor_id` via a `/e/px.gif` beacon, honours Do-Not-Track and consent state, and drops bot traffic by UA + ASN + timing heuristics.
4. Ingest writes to a queue, responds `204` in ≤ 20 ms. Aggregation happens out of band.

Ingest is the only unauthenticated write surface in the system. It MUST be isolated (separate service, separate bucket/policy, no DB credentials beyond an insert-only role) and MUST NOT be able to write the `core` schema.

---

## 7. Endpoint catalogue

Every endpoint below is consumed by the current UI. Path parameters are `{id}`. All list endpoints accept `cursor`, `limit`, `sort`. All are org-scoped.

### 7.1 Dashboard (Module 1)

#### `GET /v1/dashboard`
The single composite call the Overview screen makes on mount. Returns everything in §7.2–7.9 in one payload, with per-region freshness metadata so one slow subsystem does not blank the page.

**Query:** `siteId=all|<uuid>` (default `all`), `range=7|14|30|90` (default 30), `gran=daily|weekly|monthly`.
Calendar windows are sent as an explicit `end` offset (`range=11&end=10` = the 11 days ending 10 days ago); the backend MUST also accept absolute `start`/`end` ISO dates for the custom-range picker, and echo them back in `window`.

**Response** (abbreviated, with the reference numbers from §18):

```jsonc
{
  "data": {
    "scope": { "siteId": "all", "siteName": "All websites", "sites": 3 },
    "window": { "start": "2025-05-01T00:00:00Z", "end": "2025-05-30T23:59:59Z",
                "timezone": "Asia/Kolkata", "days": 30, "label": "Last 30 days" },
    "etag": "W/\"s_9f2c:30\"",
    "kpis": {
      "websites": { "value": 3, "delta": { "kind": "flat", "label": "No change" } },
      "visitors": { "value": 5420, "delta": { "kind": "pct", "value": 28 },
                    "spark": [172,163,188] },
      "leads":    { "value": 26, "delta": { "kind": "pct", "value": 36 }, "spark": [1,0,2] },
      "leadRate": { "value": 0.48, "unit": "%", "delta": { "kind": "pp", "value": 0.03 } },
      "bookings": { "value": 8, "delta": { "kind": "pct", "value": 33 } },
      "lcp":      { "value": 2.1, "unit": "s", "grade": "good",
                    "delta": { "kind": "abs", "value": -0.4 },
                    "source": "rum", "window": "28d_p75" }
    },
    "series": {
      "mode": "cumulative",            // <- the chart draws running totals; the label must say so
      "points": [{ "date": "2025-05-01", "visitors": 172, "leads": 0, "event": null }],
      "cumulative": { "visitors": 5420, "leads": 26 },
      "granularity": "daily",
      "releases": [{ "version": "v1.23", "at": "2025-05-08T09:12:00Z", "index": 7 }]
    },
    "funnel": [{ "id": "visitors", "name": "Visitors", "value": 5420, "pctOfPrevious": null }],
    "forms": { "starts": 112, "submissions": 26, "completionRate": 0.2321,
               "leadCount": 26, "name": "Study Enquiry Form",
               "definition": "submissions / starts" },
    "goals": [{ "id": "g1", "name": "Qualified Leads", "value": 26, "target": 40 }],
    "vitals": { "lcp": 2.1, "inp": 92, "cls": 0.03, "grade": "good",
                "source": "rum", "window": "28d_p75", "samples": 18422 },
    "publishing": { "drafts": 4, "ready": 2, "liveVersion": "v1.24",
                    "publishedAt": "2025-05-29T08:40:00Z",
                    "liveSite": "EuroMiles Main", "pendingChanges": 2 },
    "issues": [{ "id": "iss_ssl", "code": "ssl_pending", "kind": "warn", "label": "SSL Pending",
                 "sub": "partners.euromiles.in", "siteId": "…", "cta": "Resolve",
                 "severity": 2 }],
    "banner": { "state": "warning", "count": 3, "dismissed": false,
                "message": "3 items require your action", "route": "#/issues" },
    "sites": [{ "id": "…", "name": "EuroMiles Main", "host": "euromiles.in",
                "status": "published", "dns": "verified", "ssl": "active",
                "pages": 48, "leads": 18, "release": "v1.24", "releasedAt": "2h ago",
                "share": 0.615 }],
    "activity": [{ "id": "a1", "kind": "publish", "title": "v1.24 published",
                   "meta": "EuroMiles Main · 2h ago", "tone": "green" }],
    "notifications": { "unread": 3, "items": [] },
    "permissions": { "role": "owner", "canCreate": true, "canPublish": true,
                     "canManageDomain": true, "canDelete": true }
  },
  "meta": {
    "requestId": "req_01H…",
    "asOf": { "analytics": "2025-05-30T10:20:00Z", "publishing": "2025-05-30T10:24:00Z" },
    "stale": { "analytics": false, "vitals": true }     // vitals rollup is 26 min old
  }
}
```

`⇒ API.getOverview(opts)`. Response cache: `ETag` strong on `(org, site, range, gran, data_version)`; `Cache-Control: private, max-age=30, stale-while-revalidate=120`. Server latency budget p95 ≤ 300 ms; when `stale.analytics` is true the UI shows the "syncing…" status-bar state instead of erroring.

The composite endpoint exists for first paint only. Every widget also has a granular endpoint so refresh/poll does not re-fetch 40 KB.

#### `GET /v1/analytics/timeseries`
`?siteId&range&gran&metric=visitors,leads&mode=daily|cumulative`.
Returns `{ points:[{date,visitors,leads,event}], mode, totals }`. `⇒ API.getSeries`.
Never returns pre-aggregated averages; `mode` is explicit so the frontend cannot mislabel the axis.

#### `GET /v1/analytics/summary`
KPI block only (cheap; used by the 60-second poll). `⇒ totals`.

#### `GET /v1/analytics/pages` / `channels` / `funnel` / `forms` / `goals` / `vitals`
Per-widget endpoints. Each accepts `siteId`, `range`, plus widget-specific params (`limit`, `metric`). Same numbers as `/v1/dashboard` — enforced by a contract test that diffs the two paths for the reference fixture.

`GET /v1/analytics/vitals` returns `{ lcp:{p75,samples,grade}, inp:{…}, cls:{…}, source:"rum"|"lab", window:"28d" }`. **Core Web Vitals are always a 28-day p75 at p75 field data, independent of the selected dashboard range.** The UI labels it accordingly; the backend must never rescale CWV to the range.

### 7.2 Sites & Domains

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/sites` | `?status&q&cursor` |
| `POST` | `/v1/sites` | body `{name, host, locale, tz, template}`; creates draft site + domain row `dns_status=pending`; `Idempotency-Key` ⇒ `API.createSite` |
| `GET` | `/v1/sites/{id}` | includes `publishing`, `domains[]`, `liveUrl`, `previewUrl` |
| `PATCH` | `/v1/sites/{id}` | `{name?, locale?, tz?, themeKey?}`; `If-Match` ⇒ `API.renameSite` |
| `POST` | `/v1/sites/{id}:duplicate` | deep copy drafts only; assets referenced, not copied ⇒ `API.duplicateSite` |
| `POST` | `/v1/sites/{id}:archive` / `:restore` | soft state ⇒ `API.archiveSite` / `API.restoreSite` |
| `DELETE` | `/v1/sites/{id}` | 30-day tombstone; returns `{purgeAt}` ⇒ `API.deleteSite` |
| `GET` | `/v1/sites/{id}/domains` | |
| `POST` | `/v1/sites/{id}/domains` | `{hostname}`; 409 if globally taken |
| `POST` | `/v1/domains/{id}:verify` | enqueues DNS job; returns `202 {jobId}`; poll `/v1/jobs/{id}` ⇒ `API.verifyDomain` |
| `POST` | `/v1/domains/{id}:provision-ssl` | ⇒ `API.provisionSsl` |
| `DELETE` | `/v1/domains/{id}` | primary domain requires `?force`; `409 PRIMARY_IN_USE` if the site would end with zero hostnames and no replacement is supplied (§10.3) |
| `POST` | `/v1/domains/{id}:set-primary` | body `{siteId}`; atomically clears the previous primary and rewrites canonical URLs, sitemap base and redirect targets; `422 PRECONDITION_FAILED` when `dns_status≠verified`; `202` with `{jobId}` because the CDN rewrite is async ⇒ `API.setPrimaryDomain` |
| `PATCH` | `/v1/domains/{id}/options` | body `{forceHttps?, redirectWww?, hsts?}`; only meaningful when `dns_status=verified` else `422 PRECONDITION_FAILED`; returns the updated domain ⇒ `API.setDomainOption` |
| `GET` | `/v1/domains` | workspace-wide hostname list for the Sites & Domains screen: `?siteId&status&q`; each row `{id, siteId, hostname, primary, dnsStatus, sslStatus, sslIssuer, sslExpires, addedAt, verifiedAt, lastCheckedAt, records[]}` ⇒ `API.listDomains` |
| `GET` | `/v1/domains/{id}/records` | expected vs observed DNS records (§10.1 response shape) ⇒ used by the *Records we expect* card and the drawer's DNS tab |
| `GET` | `/v1/domains/activity` | `?limit=5` verification / issuance / renewal events, newest first ⇒ *Domain activity* card |
| `GET` | `/v1/domains/{id}/verification` | the ordered steps the inspector renders: `[{key, title, detail, status: done|active|pending|failed, at}]`; derived server-side from `domain_checks` + certificate job, never composed in the browser |
| `GET` | `/v1/domains/{id}/activity` | `?limit=4` hostname-scoped events for *Recent Verification Activity* (`dns_check_started`, `record_detected`, `cert_requested`, `cert_active`, `verify_failed`) |
| `GET` | `/v1/sites/domain-summary` | one call for the five summary cards: `{websites, domains, dnsVerified, dnsTotal, sslActive, pending, trends:{key:[12 points]}}`; series are monthly snapshots, omitted when history is shorter than 3 points |


**Live and preview URLs.** The site resource carries two derived fields:

```jsonc
"liveUrl":    "https://euromiles.in",                  // null until dns_status=verified AND ssl_status=active
"previewUrl": "https://preview-{releaseId}.wacrm.site" // always present; noindex, authenticated
```

`liveUrl` is what the **Open Live Website** menu item opens and what the site card's host link targets. If it is `null` the UI must open the preview instead and say why (`dns_status` / `ssl_status`), never a dead link.

Site status semantics: `draft` = never published; `published` = has a live release; `archived` = hidden, not billable. There is **no** `scheduled` state — publishing is immediate or not at all in v1 (§11.8).

### 7.3 Pages

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/pages` | `?siteId&status&q&sort=-views&cursor` |
| `POST` | `/v1/pages` | creates draft + revision 1 |
| `GET` | `/v1/pages/{id}` | includes `draft`, `published`, `seo`, `revisions[]` (paged) |
| `PATCH` | `/v1/pages/{id}` | metadata only (`title`, `slug`, `seo`, `parentId`); `If-Match` required |
| `PUT` | `/v1/pages/{id}/draft` | replaces draft `blocks`, creates a new `page_revision`; returns `{revisionId, etag}` |
| `POST` | `/v1/pages/{id}:publish` | single-page publish (creates a release scoped to that page) |
| `POST` | `/v1/pages/{id}:duplicate` | |
| `POST` | `/v1/pages/{id}:archive` / `:restore` | restore always returns the page as a **draft** |
| `DELETE` | `/v1/pages/{id}?hard=1` | only for pages already trashed; `409 HOME` / `409 CHILDREN` otherwise; writes an audit entry and a `redirects` tombstone |
| `GET` | `/v1/pages/{id}/revisions` | history for the drawer |
| `POST` | `/v1/pages/{id}/revisions/{revId}:restore` | restores into draft (never publishes) |

Slug rename MUST create a `redirects` row automatically (301, `reason: slug_rename`) — the SEO module depends on it.

### 7.4 Publishing & Releases

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/sites/{id}/publishing` | the dashboard card `{drafts,ready,liveVersion,publishedAt,pendingChanges}` |
| `POST` | `/v1/releases:preflight` | dry run; body `{siteId, pageIds?}`; returns checks with severity and blocking flag ⇒ preflight modal |
| `POST` | `/v1/releases` | the publish. Requires `If-Match: <site.draft_etag>` and `Idempotency-Key`. Returns `202 {releaseId, version, jobId}` ⇒ `API.publishRelease` |
| `GET` | `/v1/releases` | `?siteId&cursor` history |
| `GET` | `/v1/releases/{id}` | manifest summary, items, diff vs previous |
| `POST` | `/v1/releases/{id}:rollback` | step-up; creates a **new** release pointing at the old manifest, records `rolled_back_from` |
| `GET` | `/v1/jobs/{id}` | poll for publish progress: `queued → building → purging → live` |

`POST /v1/releases` error shape on CAS failure:

```json
{ "error": { "code": "CONFLICT",
  "message": "Release v1.25 was created by Anita N. while you were editing.",
  "details": { "conflict": { "serverEtag": "W/\"s_9f31:31\"", "serverVersion": "v1.25",
                             "changedBy": "Anita N.", "changedAt": "2025-05-30T10:12:41Z",
                             "changedPages": 2, "resolution": ["rebase","discard","open_diff"] } },
  "requestId": "req_…" } }
```

The UI's conflict modal already expects exactly `code: "CONFLICT"` and renders the resolution choices.

### 7.5 Notifications, activity, issues

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/notifications` | `?unread=true&cursor`; returns `{items, unread}` |
| `POST` | `/v1/notifications/{id}:read` | idempotent ⇒ `API.readNotification` |
| `POST` | `/v1/notifications:read-all` | ⇒ `API.markAllRead` |
| `GET` | `/v1/activity` | `?siteId&cursor` ⇒ Recent Activity |
| `GET` | `/v1/issues` | `?siteId&state=open`, sorted by severity |
| `POST` | `/v1/issues/{id}:resolve` | ⇒ `API.resolveIssue`; resolution is recomputed by the detector, so a resolved issue can reopen |
| `POST` | `/v1/banner:dismiss` | per-user dismissal; re-arms when a **new** issue id appears ⇒ `API.dismissBanner` |

Banner state is derived server-side: `error` if any `severity=1` open issue, `warning` if any open, `resolved` otherwise. The frontend never computes it.

### 7.6 Search (command palette)

`GET /v1/search?q=` → `{ groups: [{ type: "site|page|media|setting", items: [{id,title,subtitle,route,icon}] }] }`.
Backed by Postgres FTS + trigram, ≤ 80 ms p95, permission-filtered. `⇒` the ⌘K palette currently searches a static list.

### 7.7 Members & settings

`GET/POST/PATCH/DELETE /v1/members`, `GET /v1/org`, `PATCH /v1/org`, `GET /v1/orgs` (workspace switcher), `POST /v1/orgs/{id}:switch`.
`GET/PUT /v1/settings/{siteId}` for site settings, integrations, and feature flags.

### 7.8 Exports

`POST /v1/exports` → `202 {jobId}`. The dashboard's **Export report** dialog sends exactly this body:

```jsonc
{
  "format": "csv",                     // csv | json | pdf
  "scope":  { "siteId": "all", "range": 30, "end": 0 },   // same window the screen is showing
  "sections": ["kpis", "series", "pages", "channels"],     // the four toggles in the dialog
  "target": "dashboard"                                    // dashboard | pages | leads
}
```

`sections` is an enum: `kpis` (metric summary), `series` (one row per day), `pages` (landing pages), `channels` (acquisition). Empty `sections` → `422 VALIDATION_FAILED`. The job writes a file whose columns are fixed per section and documented in the UI; JSON output is `{section: rows[]}` so the CSV and JSON never diverge from the screen.

`GET /v1/exports/{jobId}` → `{state: "queued"|"running"|"done"|"failed", url, bytes, expiresAt, rowCount}` (signed URL, 15 min). The UI toast reports `rowCount` and `format`, so the job MUST return both.

### 7.9 Contract-test rules

1. Every endpoint has a recorded fixture (request → response) committed next to the code.
2. `/v1/dashboard` MUST equal the union of the granular endpoints for the same scope; a test diffs them for 20 fixture combinations (site × range × gran).
3. The front end runs the same fixtures against the mock to catch drift in either direction.

---


### 7.10 Forms, goals, menus, media

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/forms` | `?siteId&status&cursor` — form list for the Forms module and the rail |
| `POST` | `/v1/forms` | `{siteId, name, fields[], settings}` — the **New form** quick action |
| `GET` | `/v1/forms/{id}` | schema + submission counts |
| `PATCH` | `/v1/forms/{id}` | fields/settings; `If-Match` required |
| `GET` | `/v1/forms/{id}/submissions` | `?cursor&from&to&state` |
| `GET` | `/v1/analytics/forms` | the rail's **Form performance** card: `{starts, submissions, completionRate, name, leadCount, definition}` |
| `GET` | `/v1/goals` | goal list with `current` / `target` |
| `PUT` | `/v1/goals` | bulk replace targets from the **Edit targets** dialog: `{goals:[{id, target}]}` |

Menus and media, needed by the Quick Create actions even though their modules land later:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/menus` | `?siteId&cursor` |
| `POST` | `/v1/menus` | `{siteId, name, handle, items[]}` — **New menu**; `409` on duplicate handle |
| `PATCH` | `/v1/menus/{id}` | `If-Match`; depth ≤ 3 enforced here, not in the UI |
| `POST` | `/v1/media:sign` | `{filename, mime, bytes, siteId?}` → `200 {uploadUrl, objectKey, expiresAt}`; rejects > 50 MB with `413` and non-image/video/doc with `415` **before** the client uploads |
| `POST` | `/v1/media` | register after the PUT: `{objectKey, sha256, alt?, siteId?}` → `201` asset. Idempotent on `sha256` (re-upload of identical bytes returns the existing asset, `200` not `201`) |
| `GET` | `/v1/media` | `?siteId&q&kind&cursor` — the library grid and the picker |

`completionRate` is `submissions / starts` and MUST equal `forms.submissions / forms.starts` from `/v1/dashboard` — the two are read on the same screen (23.2 % for the reference fixture, never 76.8 %).

### 7.11 Support and product content

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/support/sessions` | opens a support chat; returns `{sessionId, widgetUrl}` — the **Chat with support** item |
| `POST` | `/v1/support/tickets` | **Report an issue**: `{kind, message, context:{route, siteId, appVersion, userAgent}, screenshotObjectKey?}` → `201 {ticketId, url}` |
| `GET` | `/v1/content/changelog` | **Product updates**: `{entries:[{version, date, title, body, route}]}` |
| `GET` | `/v1/content/tutorials` | **Video tutorials**: `{items:[{title, durationSec, thumbnailUrl, videoUrl, module}]}` |

Documentation and keyboard shortcuts are static — no endpoint, no tracking.

### 7.12 Meta: freshness, live checks

`GET /v1/meta/freshness` → the **Last updated** popover:

```jsonc
{ "data": { "sources": [
  { "key": "analytics",  "label": "Analytics",        "state": "current"|"delayed"|"stale"|"unavailable",
    "asOf": "2025-05-30T10:20:00Z", "lagSeconds": 240 },
  { "key": "publishing", "label": "Publishing state", "state": "current", "asOf": "2025-05-30T10:24:00Z" },
  { "key": "vitals",     "label": "Core Web Vitals",  "state": "delayed", "asOf": "2025-05-30T09:58:00Z", "lagSeconds": 1560 },
  { "key": "search",     "label": "Search index",     "state": "current", "asOf": "2025-05-30T10:23:00Z" }
] } }
```

Rules: `current` ≤ 15 min, `delayed` 15–60 min, `stale` > 60 min, `unavailable` when the source last errored. The same four entries appear as `meta.sources[]` inside `/v1/dashboard` so the first paint needs no second call.

`POST /v1/checks:run` → `202 {jobId}` — **Re-run checks** on the all-clear banner. Enqueues DNS, TLS, link crawl, and unpublished-drift checks for every site in scope; the banner state is then derived from `issues`, never set directly by the client.

### 7.13 Session and account

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/auth/logout` | **Sign out**; revokes the session immediately, clears the cookie |
| `GET` | `/v1/me` | profile menu: name, email, initials, role, `permissions{}` |
| `PATCH` | `/v1/me` | **Account settings** |
| `GET` | `/v1/me/sessions` | **Security**: active sessions, device, last used |
| `DELETE` | `/v1/me/sessions/{id}` | revoke one device |

`GET /v1/me` also returns `memberships[]` so the workspace switcher can render without a second call; **switch** is `POST /v1/orgs/{id}:switch` (returns a new session bound to that org, 200 ms budget).

### 7.14 Conflict resolution

When `POST /v1/releases` fails with `409 CONFLICT`, the dialog offers exactly three resolutions:

| UI action | Contract |
| --- | --- |
| **Reload latest** | `GET /v1/sites/{id}/publishing` — discards the local draft selection, keeps the server draft |
| **Rebase & publish** | `POST /v1/releases:rebase` `{baseReleaseId, pageIds[]}` → `202 {releaseId, version, jobId}`; server merges the selected pages onto the newer release and publishes |
| **Open diff** | `GET /v1/releases/{id}/diff?against={baseReleaseId}` → `{pages:[{path, change:"added"|"modified"|"removed", hunks}]}` |

`rebase` requires the same `Idempotency-Key` semantics as `POST /v1/releases`; a second rebase on a release that has already moved returns `409` again with the newer conflict body.

### 7.15 Drill-down endpoints

Every card opens a drawer; each drawer is one call. None of them may recompute a headline number differently from `/v1/dashboard`.

| Drawer | Contract | Payload |
| --- | --- | --- |
| KPI detail | `GET /v1/analytics/kpi/{id}` | `{metric, value, delta, definition, series[], breakdown[]}` |
| Funnel stage | `GET /v1/analytics/funnel/{stageId}` | `{stage, value, pctOfPrevious, definition, sources[], samplePaths[]}` |
| Channel | `GET /v1/analytics/channels/{id}` | `{channel, visitors, pct, pages[], referrers[]}` |
| Day point | `GET /v1/analytics/point?date=` | `{date, visitors, leads, events[], topPages[]}` |
| Site health | `GET /v1/sites/health` | `{dns:{verified,total}, ssl:{active,total}, releases:{healthy,sites[]}, vitals:{grade,lcp,inp,cls}}` |
| SSL / domain | `GET /v1/domains/{id}` | `{hostname, dns_status, ssl_status, records[], checks[], remediation}` |
| Broken link | `GET /v1/issues/{id}` | `{issue, links:[{from, to, status, firstSeenAt, occurrences}]}` |
| Page detail | `GET /v1/pages/{id}` | page + `revisions[]` + 30-day metrics |
| Form detail | `GET /v1/analytics/forms?formId=` | per-field completion, drop-off step |
| Vitals | `GET /v1/analytics/vitals` | §7.1 |
| Issue list | `GET /v1/issues` | §7.5 |
| Activity | `GET /v1/activity` | §7.5 |
| Site workspace | `GET /v1/sites/{id}` | §7.2 |
| Publish queue | `GET /v1/pages?status=draft|ready` | §7.3 |

### 7.16 Action matrix — every interactive element in the UI

One row per thing a user can click. `P` is the minimum role (§3.2); `Idem` means `Idempotency-Key` is required.

**Shell and global**

| UI element | Action | Contract | P | Idem | On failure |
| --- | --- | --- | ------- | --- | --- |
| Workspace card → org row | Switch workspace | `POST /v1/orgs/{id}:switch` | Viewer | — | toast, stay on org |
| Workspace card → Workspace settings | Open settings | `GET /v1/org` | Viewer | — | inline error |
| Workspace card → Members & roles | Open members | `GET /v1/members` | Viewer | — | inline error |
| CRM nav items (Inbox, Dashboard, CRM & Sales…) | Leave CMS | *external product, no contract* | — | — | — |
| CMS nav item (15 screens) | Navigate | per-module `GET` (Module 1 → `/v1/dashboard`) | Viewer | — | route-level empty/error state |
| Sidebar collapse | Client only | — | — | — | — |
| Quick Create → New website | Open wizard | `POST /v1/sites` on submit | Editor | ✓ | field errors from `details.fields` |
| Quick Create → New page | Open composer | `POST /v1/pages` | Editor | ✓ | 409 on duplicate path |
| Quick Create → New form | Open builder | `POST /v1/forms` | Editor | ✓ | 409 on duplicate name |
| Quick Create → New menu | Open menu editor | `POST /v1/menus` | Editor | ✓ | 409 on duplicate handle |
| Quick Create → Upload media | Upload | `POST /v1/media:sign` → `POST /v1/media` | Editor | hash | 413 / 415 |
| Quick Create → Search everything | Palette | `GET /v1/search?q=` | Viewer | — | empty state |
| Breadcrumb / home | Navigate | — | Viewer | — | — |
| Search trigger / ⌘K | Palette | `GET /v1/search?q=` (debounced 150 ms) | Viewer | — | keep last results, mark stale |
| Help → Documentation | External link | — | — | — | — |
| Help → Video tutorials | Open list | `GET /v1/content/tutorials` | Viewer | — | toast |
| Help → Product updates | Open changelog | `GET /v1/content/changelog` | Viewer | — | toast |
| Help → Chat with support | Start chat | `POST /v1/support/sessions` | Viewer | — | toast with fallback email |
| Help → Report an issue | Open form | `POST /v1/support/tickets` | Viewer | ✓ | draft kept locally |
| Help → Keyboard shortcuts | Client only | — | — | — | — |
| Bell | Open notifications | `GET /v1/notifications` | Viewer | — | last cached list + stale chip |
| Bell → All / Unread | Filter | `GET /v1/notifications?unread=true` | Viewer | — | keep current tab |
| Bell → notification row | Mark read + open target | `POST /v1/notifications/{id}:read` | Viewer | — | mark locally, retry silently |
| Bell → Mark all read | Bulk read | `POST /v1/notifications:read-all` | Viewer | ✓ | optimistic rollback |
| Bell → View all notifications | Open inbox | `GET /v1/notifications?cursor=` | Viewer | — | — |
| Profile → Account settings / Your role / Security | Open | `GET /v1/me`, `GET /v1/me/sessions` | Viewer | — | — |
| Profile → Sign out | End session | `POST /v1/auth/logout` | Viewer | — | force local sign-out anyway |
| Status bar → Last updated | Freshness popover | `GET /v1/meta/freshness` | Viewer | — | show last known |
| Status bar → Docs / Support | External / ticket | `POST /v1/support/sessions` | Viewer | — | — |
| Status bar → Export Report | Open export dialog | `POST /v1/exports` | Viewer | ✓ | job failure toast |
| Prototype states (beaker) | Force UI state | **dev-only, never shipped** | — | — | — |

**Dashboard**

| UI element | Action | Contract | P | Idem | On failure |
| --- | --- | --- | --- | --- | --- |
| Site filter, any row | Re-scope | `GET /v1/dashboard?siteId=` | Viewer | — | previous scope kept |
| Site filter → search field | Filter list | `GET /v1/sites?q=` | Viewer | — | — |
| Site filter → Add website | `POST /v1/sites` | Editor | ✓ | field errors |
| Range → 7/14/30/90 | Re-query | `GET /v1/dashboard?range=` | Viewer | — | previous window kept |
| Range → This month / Last month | Calendar window | `GET /v1/dashboard?range=&end=` | Viewer | — | — |
| Range → Apply custom range | Explicit window | `GET /v1/dashboard?start=&end=` (ISO) | Viewer | — | 422 on `end < start` |
| New Website | `POST /v1/sites` | Editor | ✓ | field errors |
| Sites & Domains → status pill (DNS) | Re-verify that hostname | `POST /v1/domains/{id}:verify` | Editor | ✓ | `422 VERIFY_FAILED` / `NXDOMAIN` inline on the domain card |
| Sites & Domains → status pill (TLS) | Provision certificate | `POST /v1/domains/{id}:provision-ssl` | Editor | ✓ | `sslStatus=failed` + issue raised |
| Sites & Domains → row menu → Make primary | Confirm → switch canonical host | `POST /v1/domains/{id}:set-primary` | Admin | ✓ | `422` when DNS unverified; previous primary restored on failure |
| Sites & Domains → row menu → Copy hostname | Clipboard only | — | Viewer | — | — |
| Sites & Domains → Needs action → Verify / Issue TLS | Same writes as above | as above | Editor | ✓ | as above |
| Site drawer → Add domain | Validate → `POST /v1/sites/{id}/domains` | Editor | ✓ | `409 CONFLICT`, hostname regex errors |
| Site drawer → Remove domain | Confirm → `DELETE /v1/domains/{id}` | Admin | ✓ | `409 PRIMARY_IN_USE` when it is the last hostname |
| Site drawer → behaviour switch | `PATCH /v1/domains/{id}/options` | Editor | ✓ | `422` when DNS unverified; switch reverts |
| Sites & Domains → Connect Domain wizard | 4 steps: `POST /v1/sites/{id}/domains` → `POST /v1/domains/{id}:verify` | Editor | ✓ | `409` global conflict (no tenant detail), `422` hostname syntax, `429` throttle |
| Sites & Domains → attention strip → Review & Fix | Selects the failing site, opens the inspector | Viewer | — | — |
| Sites & Domains → KPI card | Tab / inspector shortcut | Viewer | — | — |
| Sites & Domains → inspector → Verify Again | `POST /v1/domains/{id}:verify` | Editor | ✓ | stays on the same tab, reason inline |
| Sites & Domains → SSL pill (row) | `GET /v1/domains/{id}/certificate` | Viewer | — | `sslStatus=failed` shows the Provider reason |
| Attention → View All Issues | `GET /v1/issues` | Viewer | — | — |
| Attention → Resolve (SSL) | `POST /v1/domains/{id}:verify` → `POST …:provision-ssl` | Admin | ✓ | issue stays open with error |
| Attention → Review (link) | `GET /v1/issues/{id}` | Viewer | — | — |
| Attention → Preflight | `POST /v1/releases:preflight` | Editor | — | modal shows blocking checks |
| Attention → Re-run checks | `POST /v1/checks:run` | Admin | ✓ | toast |
| Publishing Status → Drafts / Ready | `GET /v1/pages?status=` | Viewer | — | — |
| Publishing Status → Live release | `GET /v1/releases/{id}` | Viewer | — | — |
| Publishing Status → History | `GET /v1/releases` | Viewer | — | — |
| History → Roll back | `POST /v1/releases/{id}:rollback` | Admin + step-up | ✓ | confirm dialog, audit note |
| Publishing Status → Release | `POST /v1/releases:preflight` → `POST /v1/releases` | Editor | ✓ | 409 → conflict dialog |
| Preflight step 1 → page checkboxes | Client only (selection) | — | — | — |
| Preflight step 2 → Publish | `POST /v1/releases` with `If-Match: draft_etag` | Editor | ✓ | 409 / 422 / 428 |
| Conflict → Reload latest / Rebase & publish / Open diff | §7.14 | Editor | ✓ (rebase) | second conflict re-opens dialog |
| KPI card (×6) | Drill-down | `GET /v1/analytics/kpi/{id}` | Viewer | — | drawer error state |
| Chart → series toggle / Events | Client only | — | — | — |
| Chart granularity | Re-query | `GET /v1/analytics/timeseries?gran=` | Viewer | — | — |
| Chart point click | Day detail | `GET /v1/analytics/point?date=` | Viewer | — | — |
| Funnel stage | Drill-down | `GET /v1/analytics/funnel/{stageId}` | Viewer | — | — |
| Top pages → sort header | Re-query | `GET /v1/analytics/pages?sort=-views` | Viewer | — | — |
| Top pages → row | Page drawer | `GET /v1/pages/{id}` | Viewer | — | — |
| Acquisition row | Channel drawer | `GET /v1/analytics/channels/{id}` | Viewer | — | — |
| Site Health → View Details | Overlay | `GET /v1/sites/health` | Viewer | — | — |
| Site card → name | Re-scope | `GET /v1/dashboard?siteId=` | Viewer | — | — |
| Site card → host / Open Live Website | Open `liveUrl` | `GET /v1/sites/{id}` (URL derived) | Viewer | — | open preview + explain why |
| Site card → ⋯ Preview Site | Open `previewUrl` | `GET /v1/sites/{id}` → `previewUrl` | Viewer | — | item disabled when there is nothing to preview |
| Site card → ⋯ Manage | Workspace drawer | `GET /v1/sites/{id}` | Viewer | — | — |
| ⋯ Edit Website | Navigate to Pages for that site | `GET /v1/pages?siteId=` | Viewer | — | — |
| ⋯ Domain Settings | Domain drawer | `GET /v1/domains/{id}` | Viewer (edit: Admin) | — | — |
| ⋯ Website Settings | Settings | `GET /v1/settings/{siteId}` | Viewer | — | — |
| ⋯ Duplicate / Rename / Archive / Delete | §7.2 | Editor / **Admin for delete** | ✓ | 403 → disabled item + toast |
| Recent Activity → View All | `GET /v1/activity` | Viewer | — | — |
| Form performance tiles / form row | Drawer | `GET /v1/analytics/forms?formId=` | Viewer | — | — |
| Goal tracking → Edit targets | `PUT /v1/goals` | Editor | ✓ | field errors |
| Performance snapshot | Vitals drawer | `GET /v1/analytics/vitals` | Viewer | — | — |
| Export dialog → Export | `POST /v1/exports` | Viewer | ✓ | toast + retry |

**Not part of the API** (must not be implemented server-side): prototype-state switching, series visibility toggles, sidebar collapse, keyboard-shortcut sheet, chart hover cards, sort of an already-loaded 3-row list, and any UI-side arithmetic on published metrics.

### 7.17 Module 2 — Sites & Domains screen surfaces (v2 layout)

One row per element of `MODULE-2-SPEC.md`; each maps to exactly one read or one mutation. Everything not listed as a write is a read.

| UI element | Endpoint | Notes |
| --- | --- | --- |
| Page-head *Website scope* | `GET /v1/sites` | `?status=&q=`; scope also accepted by every domain read as `?siteId=` |
| Page-head *Domain scope* | `GET /v1/domains?dnsStatus=` | filters on the **primary** hostname state |
| Page-head *Connect Domain* | `POST /v1/sites/{id}/domains` | wizard step 2 calls it; response carries `records[]` for step 3 |
| Page-head *New Website* | `POST /v1/sites` | Module 1 wizard |
| Attention strip | `GET /v1/domains?attention=true` | `{count, first:{siteId, hostname, dnsStatus, sslStatus}}` — the strip never invents a summary string |
| 5 summary cards | `GET /v1/sites/domain-summary` | one call, denominators included |
| Registry tab pills + counts | client-side over the scoped rows | counts must equal the filtered row count, so the API returns the full scoped page |
| Registry table | `GET /v1/sites` + `GET /v1/domains` | site row carries `primaryHostname`, `aliasCount`, `dnsStatus`, `sslStatus`, `liveReleaseId`, `pageCount`, `leadCount`, `updatedAt` |
| DNS pill (row) | `POST /v1/domains/{id}:verify` | job, not a synchronous answer |
| SSL pill (row) | `GET /v1/domains/{id}/certificate` | opens the SSL tab |
| Row menu → Open site | `liveUrl` (§7.2) | item hidden when `liveUrl` is null |
| Row menu → Manage / Preview / Rename / Duplicate / Archive / Delete | `GET /v1/sites/{id}`, `PATCH`, `:duplicate`, `:archive`, `DELETE` | §7.2 |
| Row menu → Verify / SSL details / Make primary / Copy | `:verify`, `GET /certificate`, `:set-primary`, client clipboard | — |
| Inspector header + meta | `GET /v1/sites/{id}` (domains embedded) | `primaryDomain`, `aliases[]`, `latestRelease` |
| Inspector *Overview* stepper | `GET /v1/domains/{id}/verification` | four steps, server-authored |
| Inspector actions | `:verify`, `GET /v1/sites/{id}/domains` | — |
| Inspector DNS mini-table / DNS tab | `GET /v1/domains/{id}/records` | expected vs observed (§10.1) |
| Inspector SSL tab | `GET /v1/domains/{id}/certificate` + `PATCH /v1/domains/{id}/options` | — |
| Recent Verification Activity | `GET /v1/domains/{id}/activity` | — |
| Connected Domains card row | `GET /v1/domains` | `{primaryCount, aliasCount, pendingCount, rows[]}` |
| Domain settings dialog | `GET /v1/sites/{id}/domains`, `PATCH /options`, `:set-primary`, `DELETE /v1/domains/{id}`, `POST /v1/sites/{id}/domains` | the only place a hostname is added or removed |
| Status bar | `GET /v1/meta/freshness` | `lastSyncedAt` per scope |

**Ordering and rate rules.** Manual verification is throttled to 1/minute/hostname (`429 RATE_LIMITED`, surfaced inline). The registry refetches on focus if its data is older than 30 s; certificate data is cached 5 minutes; the summary cards refresh after any domain mutation.

**States the screen must handle** (each maps to a contract): loading skeleton (`GET /v1/sites` in flight), error strip + retry (`5xx`, keeping last valid rows), empty workspace (`200 []`), no-results (client filter), Viewer (`403` on writes → controls disabled with reason), DNS unverified/pending/failed, TLS provisioning/active/failed, no-domain site (`primaryHostname: null`).

**Known prototype gaps.** `Site` still carries `host` rather than the server-derived `liveUrl`/`previewUrl`; the UI composes `https://${hostname}` for *Open site* and hides it when the primary hostname is not fully live. The five KPI deltas are seeded strings in `data.ts` (`DOMAIN_TRENDS`) — the API returns real monthly snapshots or omits the delta entirely.

### 7.18 Module 3 — Pages & Routes screen surfaces

One row per element of the Pages screen; each maps to exactly one read or one mutation.

| UI element | Endpoint | Notes |
| --- | --- | --- |
| Website switcher | `GET /v1/sites` | `{id,name,pageCount,latestRelease}`; a website without a release disables *View Live Site* |
| *View Live Site* | `liveUrl` from `GET /v1/sites/{id}` | never composed client-side; disabled when `latestRelease` is null |
| *Preview* (toolbar) | `POST /v1/pages/{id}:preview` | `{token, url, expiresIn}`; tokens are single-use, 15 min, `noindex` |
| *New Page* | `POST /v1/pages` | 4-step wizard; step 1 calls `GET /v1/pages:slug-available` on every keystroke (debounced 260 ms) |
| KPI cards (4) + gauge | `GET /v1/pages/summary` | `{total, published, drafts, trash, changes, issues, gauge}`; gauge is `round(published/active×100)` and `null` at 0 |
| Registry tabs | client-side over the scoped page | counts come from the summary, never from the visible rows |
| Registry search | `GET /v1/pages?q=` | debounced 250 ms; matches title, path, template and author |
| Registry selects (type / status / author) | `GET /v1/pages?type&status&author` | author list comes back with every list response |
| Filter panel switches | `GET /v1/pages?onlyIssues&onlyLanding` | compose with the selects; the funnel button shows an active dot |
| Sortable headers | `GET /v1/pages?sort&dir` | `title`, `path`, `type`, `status`, `updated`; `aria-sort` mirrors the state |
| Pagination + page size | `GET /v1/pages?cursor|page&pageSize` | 8 / 16 / 25 per page |
| Bulk bar | `POST /v1/pages:bulk-archive` | returns per-page results; the selection is pruned to the visible page so a filtered-away row can never be touched |
| Page structure tree | `GET /v1/pages/tree?siteId` | flat list with `parentId` + `depth`; trashed pages excluded |
| Tree menu | client-side + `GET /v1/pages/tree` | *Expand all* / *Collapse all* are view state, *Refresh* re-reads |
| Row menu (open page) | `GET /v1/pages/{id}` | supplies `parent`, `children[]`, `issues[]` |
| Row menu → Edit Page Details | `PATCH /v1/pages/{id}` | `If-Match: revision`; `409 REVISION_CONFLICT` returns the other editor's name |
| Row menu → Duplicate | `POST /v1/pages/{id}:duplicate` | `{title, slug, parentId, includeSeo}` |
| Row menu → Set as Homepage | `POST /v1/sites/{id}:homepage` | `{pageId}`; exactly one homepage, `409 HOME` when the target is trashed |
| Row menu → Move Page | `PATCH /v1/pages/{id}` with `parentId` | cycles and subtree moves are rejected server-side (`422 CYCLE`), not just hidden |
| Row menu → Move to Trash | `POST /v1/pages/{id}:archive` | `409 HOME`, `409 CHILDREN` (lists the children by name); 30-day window |
| Trash tab → Restore | `POST /v1/pages/{id}:restore` | returns to **draft**; a taken slug forces a rename first |
| Trash tab → Delete permanently | `DELETE /v1/pages/{id}?hard=1` | separate confirm, no undo |
| Inspector | `GET /v1/pages/{id}` | performance block only renders when `views30d > 0`; otherwise `Analytics not available` |
| Inspector *Unpublished changes* chip | route to Module 6 | `#/publishing?page=` |
| Inspector *Edit Page* / row pencil | Module 4 | the handoff carries `{pageId, siteId, revision}` |
| Status bar | `GET /v1/meta/freshness` | plus client-side keyboard hints |

**Ordering and rate rules.** Slug availability is throttled to 10/s per user; the list refetches on window focus when older than 30 s; every mutation returns the mutated row so the view never guesses; `If-Match` is mandatory on `PATCH` and missing it is `428 PRECONDITION_REQUIRED`.

**States the screen must handle** (each maps to a contract): loading skeletons (list + tree + inspector), error strip keeping last good state (`5xx`), empty website (`200 []`), empty trash, no search results, tree no-match, stale selection (`404` on the inspector), Viewer (`403` → controls disabled with a reason), slug taken (`409`), reserved slug (`422`), route change with inbound links (301 proposal), revision conflict (`409` with the competing editor), homepage and parent-with-children guards, move cycle, bulk partial failure, preview token expiry, permanent delete.

**Known prototype gaps.** `sites.pages` is a denormalised counter in the seed; the API derives it. `views30d` / `leads30d` are seeded per page — the real numbers come from `analytics.page_metrics` and the UI must render `Analytics not available` when the window has no rows. The issue list (`issuesFor`) is computed client-side from page fields; the server version is a `GET /v1/pages/{id}/issues` read so the copy can change without a release.

### 7.19 Module 4 — Visual Builder screen surfaces

The builder is the only screen that writes a *document*. Everything it edits is one JSONB column (`pages.draft_document`) guarded by a monotonic counter (`pages.draft_revision`), never a bag of per-field PATCHes.

| Element | Endpoint | Contract notes |
| --- | --- | --- |
| Screen entry | `GET /v1/pages/{id}/draft` | `{revision, document, baseReleaseId, updatedAt, updatedBy}`; `document` is the block tree (`{id, type, variant, parentId, order, props, style, advanced}`); `404 PAGE_GONE` when the page was trashed/deleted while the tab was open |
| Autosave (2 s debounce) | `PATCH /v1/pages/{id}/draft` | `If-Match: <draftRevision>`; body is a **block-level diff** (`{ops:[{op:"insert"\|move\|update\|remove", id, parentId?, index?, props?, style?}]}`), not the whole tree, so two editors on different blocks do not collide |
| Save conflict | `409 REVISION_CONFLICT` on `PATCH` | returns `{currentRevision, updatedBy, updatedAt, changedBlockIds[]}`; the UI shows *Saved elsewhere* with **Reload theirs** / **Keep mine**; *Keep mine* retries with `?strategy=force` and a fresh `If-Match` |
| Leave guard | client-side only until the draft is acknowledged | `beforeunload` never fires on an acknowledged save |
| Revision history | `GET /v1/pages/{id}/revisions?cursor&pageSize` | `{revision, author, createdAt, summary, blockDiff:{added,removed,changed}}`; server recomputes the diff, the UI prints it |
| Restore a revision | `POST /v1/pages/{id}/revisions/{rev}:restore` | writes a **new** revision whose document equals `rev`; never rewinds the counter |
| Block / section catalogue | `GET /v1/library/blocks`, `GET /v1/library/sections` | `{id, name, group, variants[], offersCount}`; counts are computed server-side over *offered* archetypes (19 blocks / 23 sections / 5 page templates) and must not be hard-coded in the view |
| Save selection as a section | `POST /v1/library/sections` | `{name, category, document}`; returns the new preset with a server id |
| Delete a user section | `DELETE /v1/library/sections/{id}` | built-in presets are `403 BUILTIN`; user presets are soft-deleted so in-flight revisions keep resolving |
| Page templates | `GET /v1/library/page-templates` | 5 entries; applying one is a client-side compose, then a normal draft PATCH |
| Media picker | `GET /v1/media?siteId&q&kind` | same catalogue as Module 5; the builder inserts a stable URL + hash, never a data URI |
| Link picker | `GET /v1/pages/tree?siteId`, `GET /v1/forms?siteId` | three sources (page / form / external); external URLs are validated server-side on save |
| AI copy (stream) | `POST /v1/ai/copy:stream` | SSE: `token` events, then `done` with the final string; `{sourceText, action:"improve"\|"punchier"\|"shorten", target}`; `429 AI_QUOTA`, `502 AI_UNAVAILABLE` are UI states, and the draft is never mutated by the stream — acceptance is a separate `PATCH` |
| AI page / section plan (stream) | `POST /v1/ai/plan:stream` | SSE: `step` events `{index,type,label,why}` while planning, one `plan` event `{sections:[{type,variant,label,why}]}`, then `done`; body `{prompt, pageId?, scope:"page"\|"section", libraryVersion}`. The server returns a **plan of registry types**, never a document — the client composes nodes and commits them as one draft PATCH, so repair, limits (40 blocks) and undo stay client-side. `libraryVersion` pins the palette the plan was made against; a stale version is `409 LIBRARY_STALE` and the UI re-plans. `422 PROMPT_TOO_SHORT`, `429 AI_QUOTA`, `502 AI_UNAVAILABLE`, `409 AI_NO_PROVIDER` are distinct UI states |
| AI rewrite (stream) — composer task | `POST /v1/ai/rewrite:stream` | same contract as the copy stream below, but the instruction is free text (`{instruction, sourceText, target}`) mapped server-side to a rewrite rule; must return `changed:false` when the rewrite would not alter the text, so the UI can say *"already that short — nothing to cut"* instead of faking an edit |
| AI usage | `GET /v1/ai/usage` | `{used, cap, resetsAt, provider:{label, model}}` per workspace per day; the composer renders it and disables *Generate* at the cap |
| Presence | `GET /v1/pages/{id}/presence` (SSE) | the banner names other editors; presence is advisory and never blocks a save (no co-editing, per §20 decision) |
| Preview | `POST /v1/pages/{id}:preview` | same single-use `pv_…` token as Module 3, but built from the **draft** document |
| Publish handoff | `POST /v1/releases` (Module 1 pipeline) | the builder freezes `draftRevision` into the release manifest; a dirty draft is refused client-side with *Save your changes before publishing*, and server-side with `409 DRAFT_DIRTY` |
| Publish split menu | `GET /v1/releases?siteId&pageId` | *Review & publish…*, *Compare with live*, *Release & revision history* are all reads of the release API |
| Undo / redo, zoom, device morph, selection | — | pure view state; never persisted, never an endpoint |

**Ordering and rate rules.** Autosave is client-debounced 2 s and coalesced per block id; the server also coalesces identical ops inside 250 ms. `If-Match` is mandatory — a missing header is `428 PRECONDITION_REQUIRED`. AI streaming is capped at 20 requests/minute/user and 1 concurrent stream per page; a second stream cancels the first (the UI mirrors this: Escape aborts).

**States the screen must handle** (each maps to a contract): skeleton → canvas, empty page (`200` with `document: []`), draft load failure (`5xx`, blocking, named, retryable), page gone (`404`), Viewer (`403` → read-only shell, publish disabled), CAS conflict, save failure (`5xx` with the draft preserved in memory + *Retry*), AI error/abort/quota, empty catalogue (`library` returns no offers), empty form picker, deleted page mid-session, publish held while dirty, reduced motion, keyboard-only insert/select, empty search.

**Known prototype gaps.** The document lives in memory (`BuilderAPI`) with a simulated 2 s autosave and a seeded revision list; `draftRevision` is a number that only the client increments, so the server must own it. Presence is a timer, not a socket. The AI rewrite is a deterministic local transform (`improve | punchier | shorten`), chosen so the prototype has no network and no invented claims; the real endpoint replaces it behind the same `streamCopy` signature. AI page generation is likewise a deterministic **composer** (`planFor` → `streamPlan` → registry nodes), not a model call: it plans from the editor's words, composes real blocks, and injects only a three-word eyebrow — so the prototype cannot invent a stat, a price or a testimonial. The real endpoint keeps the same shape (plan in, client composes), documented in `AI-BUILDER-SPEC.md`.

### 7.20 Interlink — forms, consent, attribution, page stats

The CMS owns pages and form *definitions*; the CRM owns people, consent and automation. One writer per fact (see `INTERLINK-PLAN.md` D7). Every row below is a contract only — nothing in this prototype calls a network.

| Element | Endpoint | Contract notes |
| --- | --- | --- |
| Published page | `GET /api/public/pages/{siteSlug}/{pageSlug}` | `{document, forms:[{blockId, publicToken, fields, consent}], tracking:{chatbotId, visitorKeySeed}, version}`. Served from the release manifest, not the draft; `404` for a page that is unpublished or scheduled in the future |
| Form submit | `POST /api/public/forms/{publicToken}/submit` | body `{identity:{phone?,email?,name?}, answers, consent:{channel,granted,text,version}, attribution:{siteId,pageId,blockId,sessionId,utm{},referrer,landingUrl}, formVersion}`. `202 {submissionId}`; **idempotent** on `(publicToken, sessionId, formVersion)` for 10 min → `409 DUPLICATE_SUBMIT`; `422 CONSENT_REQUIRED` when the block's consent field group is missing; `410 FORM_CLOSED`; rate-limited per IP exactly like `surveys/submit`; client-supplied `siteId` is validated against the token's workspace, never trusted |
| What submit writes (CRM side) | — | `resolveIdentity(phone → email → create)` → contact; lead with `source = "cms_form:<slug>"` and `source_detail = page route`; attribution on the **lead**, not the contact; a `consent_records` row whether granted or declined (text, ts, ip, formVersion); then `trigger.lead.created` with the source filter already supported by the automation engine |
| Consent rule | — | a form cannot publish with a phone/WhatsApp field unless it carries an unticked consent block naming the business, the channel and the message types. Execution-time check: a workflow's WhatsApp action skips a lead whose `whatsapp_opt_in = false`, and the skip is recorded in the run log |
| Form definitions | `GET /v1/forms?siteId`, `POST /v1/forms`, `PATCH /v1/forms/{id}` | `{name, slug, fields[], steps[{fields[]}], consent, status, publicToken, source:"cms"}`. `steps[]` exists from day one (D6) but only one step is authored today. A form edit that a published page references creates a new `formVersion`; the release pins the version it shipped |
| Submissions index (counts only) | `GET /v1/pages/{pageId}/stats` | `{views, submissions, conversion, byBlock[], byUtm[], byCity[]}` — aggregates, **no PII**; a "who submitted" view is a link into the CRM, never a CMS table |
| Automation suggestions | `GET /v1/automation-suggestions?block=form` | `[{trigger, actions[], rationale}]` drawn from the CRM's real catalog (`trigger.lead.created`, `action.whatsapp.send_template`, `action.task.create`, `action.deal.create`, …); read-only, the CMS never executes a workflow |
| Publish snapshot | `POST /v1/sites/{siteId}/pages/{pageId}/publish` | freezes `{document, formVersions[], libraryVersion}` into an immutable page version; a draft that references a closed or deleted form is refused with `409 FORM_UNAVAILABLE` |
| Interactions (analytics) | `POST /api/public/widget/track` (existing) | `pageview` / `custom` / `identify` already carry `page`, `referrer` and `utm{}`; the CMS adds `blockId` inside `properties`. A **click is never a workflow trigger** — only a submitted form or a started conversation is |

**The rule that makes the loop safe:** the CMS never renders automation state to the visitor (D8). The thank-you copy is static; whether a workflow ran, skipped or failed is visible only in the CRM's run log.

## 8. Publishing pipeline (the hard part)

### 8.1 Objects

- **Draft state** lives in `pages.draft_revision_id` and rows in `page_revisions`. Every draft mutation appends a revision and bumps `sites.draft_etag`.
- **Release** = an immutable manifest listing `(page_id, revision_id, content_hash)` plus asset hashes.
- **CAS** = content-addressed storage. Any block HTML, CSS bundle, or media variant is stored at `cas/sha256/<hash>`. Identical content is stored once; manifests therefore dedupe naturally.

### 8.2 Publish sequence

```
1. Client POST /v1/releases  (If-Match: draft_etag, Idempotency-Key)
2. core-api: BEGIN
     SELECT … FROM sites WHERE id=… FOR UPDATE
     if site.draft_etag <> If-Match       → ROLLBACK, 409 CONFLICT
     if open blocking issue (severity=1)  → ROLLBACK, 422 PREFLIGHT_BLOCKED
     INSERT releases(status='building', seq=nextval, version=…) RETURNING id
     INSERT release_items(…) from current draft revisions
     INSERT job(type='build_release', payload={releaseId})
   COMMIT
3. Worker: render each page → HTML; collect assets; upload to CAS (idempotent by hash)
4. Worker: write manifest.json to releases/{siteId}/{version}/manifest.json
             releases.manifest_hash = sha256(manifest), status='built'
5. Worker: atomically UPDATE sites SET live_release_id=…, releases.status='live'
             (previous release → 'superseded')
6. Worker: purge edge cache by site tag; wait for 95% edge confirmation (≤ 30 s)
7. Worker: emit activity_event(publish), notification to watchers, webhook `release.published`
8. Client polls /v1/jobs/{id} → state 'live' → toast + optimistic UI settle
```

Any failure at 3–6 leaves the previous release live. `releases.status='failed'` with `last_error`; the publish button returns to idle with a retry. **A half-published site is not a reachable state.**

### 8.3 Rollback

`POST /v1/releases/{id}:rollback` builds a new release whose manifest is the old manifest (no re-render), so it lands in the same time budget as a purge (~seconds). History shows both the rollback and its cause. Rollback never deletes the newer release; it can itself be superseded.

### 8.4 Preflight checks

| Check | Blocking | Typical remediation |
| --- | --- | --- |
| Broken internal links | yes | link checker list with "Go to page" |
| Missing required metadata (title/description) | yes | per-page inline fix |
| Assets referenced but not uploaded / hash mismatch | yes | "Re-upload media" |
| Unpublished referenced pages | warn | "Include these pages" |
| Domain unverified or TLS not active | yes (for that domain) | "Verify DNS" |
| Image weight budget exceeded (page > 1.2 MB) | warn | compression suggestion |
| Contrast/a11y violation in changed blocks | warn | theme fix |
| Draft edited by another user since ETag | yes → 409 | conflict modal |

### 8.5 CDN & caching contract

- HTML: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, purged by tag `site:{id}` on publish.
- Assets in CAS: `Cache-Control: public, max-age=31536000, immutable`.
- Preview/draft surface: `no-store`, authenticated, `X-Robots-Tag: noindex`.
- `Vary: Accept-Encoding`, `X-Site-Id` response header for debugging.

### 8.6 Scheduling

**Not in v1.** No `scheduled` site, page, or release state is exposed, in the API or the UI. Scheduled publishing is a Phase 2 feature and will be additive: `releases.publish_at` + a scheduler job + a `scheduled` status, gated behind a feature flag, with the UI introducing it module by module.

---

## 9. Analytics pipeline

### 9.1 Flow

```
browser (sendBeacon) → POST /e  → queue → ingest worker
   → validate (schema, site key, consent, bot filter)
   → events (partitioned) 
   → 5-min streaming rollup (sessions, realtime visitor count)
   → hourly rollup_daily + rollup_channel_daily
   → daily vitals_daily (p75)
   → metric_snapshots refresh (dashboard cache)
```

### 9.2 Identity, consent, privacy

- `visitor_id`: first-party cookie, rotating daily salt hash — cannot be joined across sites, expires 30 days.
- Consent: if the visitor has not granted analytics consent, only cookieless aggregate counts are emitted (`visitor_id = null`, dedupe off). The dashboard marks those ranges `approximate: true`.
- Bot filtering: UA list, headless fingerprints, ASN list, request-timing heuristics. Dropped events are counted (`bots_dropped`) for transparency.
- PII never enters `events`. Form payloads live only in `form_submissions`, encrypted (KMS envelope, per-org data key), retained per org policy (default 24 months).

### 9.3 Metric definitions (single source of truth)

| Metric | Definition | Excludes |
| --- | --- | --- |
| **Visitors** | `COUNT(DISTINCT visitor_id)` with ≥ 1 `pageview` in window; sessions end after 30 min idle | bots, internal IPs, preview traffic |
| **Pageviews** | `COUNT(events WHERE name='pageview')` | 404s, `utm_source=wacrm-preview` |
| **Leads** | distinct `form_submissions` that produced a CRM lead; duplicates within 24 h collapse | spam-scored > 0.8, test submissions |
| **Visitor-to-lead rate** | `leads / visitors × 100`, 2 dp; deltas in **percentage points** | — |
| **Bookings** | `booking` events attributed to a CMS lead | cancelled bookings |
| **Form starts** | `form_sessions` with ≥ 1 field focus ≥ 1 s | sessions that never focused a field |
| **Form completion** | `submissions / starts` — **26 / 112 = 23.2 %** | abandoned + spam |
| **Page conversion** | `leads / pageviews × 100` per path, 2 dp | — |
| **Channel** | last non-direct touch within 30 days, first-touch stored alongside | unknown → `direct` |
| **LCP / INP / CLS** | **p75 over 28 days, field (RUM)**; `source:"lab"` when RUM < 500 samples, and the UI must show the source | — |
| **Delta** | current window vs the immediately preceding window of equal length; `null` when no comparison data | — |

Two rules the front end depends on:
1. **Whatever `funnel[0].value` is, it MUST equal `kpis.visitors.value`.** The Conversion Journey and the KPI row are read side by side.
2. **A cumulative chart says so.** `series.mode = "cumulative"` is part of the contract; when the API returns `mode: "daily"` the chart plots daily bars without the running-total label.

### 9.4 Freshness & failure

- `meta.asOf.analytics` = timestamp of the newest completed rollup; the status bar renders "Last updated" from it.
- If the rollup is > 15 min stale, `meta.stale.analytics = true` → UI shows `syncing…`, keeps the last values, and does **not** show an error.
- If `analytics-api` is down (`DEPENDENCY_UNAVAILABLE`), only the analytics regions render their error card; sites/publishing/notifications still load. `/v1/dashboard` MUST return **HTTP 200** with a partial body, never a 5xx:

```jsonc
{
  "data": {
    "scope": { … }, "window": { … }, "etag": "…",
    "sites": [ … ], "publishing": { … }, "issues": [ … ], "banner": { … },
    "activity": [ … ], "notifications": { … }, "permissions": { … },
    "kpis": null, "series": null, "funnel": null, "forms": null,
    "goals": null, "vitals": null, "pages": null, "channels": null
  },
  "meta": { "requestId": "req_…", "partial": true,
            "sources": [ { "key": "analytics", "state": "unavailable", "asOf": null } ] },
  "errors": [ { "region": "analytics", "code": "DEPENDENCY_UNAVAILABLE",
                "message": "Analytics service unavailable (502)", "retryAfter": 30 } ]
}
```

Region keys are fixed: eight card keys plus one umbrella key, mapping 1:1 to what the UI draws — `analytics` (umbrella), `kpis`, `series`, `funnel`, `pages`, `channels`, `forms`, `goals`, `vitals`. A region that fails on its own is nulled individually and reported in `errors[]` with its own `region`; a client MUST render everything that is non-null and show a retry card only for the null ones. The umbrella `analytics` entry is what the top banner reads — omit it and the banner stays hidden even though cards failed.

### 9.5 Reconciliation & backfill

Daily job recomputes the previous 3 days from `events` and asserts `rollup_daily` equality; a mismatch opens an internal issue and pages only if it exceeds 0.5 %. Backfills are idempotent jobs keyed `(site_id, day)`.

---

## 10. Domains, DNS, TLS

### 10.1 Verify

1. `POST /v1/domains/{id}:verify` → job. Resolver queries `TXT _wacrm-verify.<host>` with `wacrm-verify=<token>` and/or `CNAME`/`A` to the platform target. Two independent resolvers must agree (avoid split-horizon false negatives). Backoff: 5 s, 15 s, 60 s, then hourly for 24 h.
2. Result → `site_domains.dns_status`, `domain_checks` row with raw answers. Emits `issue` on failure with the exact expected record text so the UI can offer copy-to-clipboard.

**Record contract** (rendered by the drawer's DNS tab and the *Records we expect* card):

```jsonc
{
  "domainId": "dom_portal",
  "hostname": "partners.euromiles.in",
  "dnsStatus": "pending",              // verified | pending | failed
  "lastCheckedAt": "2025-05-30T10:20:00Z",
  "records": [
    { "type": "CNAME", "name": "partners.euromiles.in", "value": "cname.wacrm.site",
      "ttl": 3600, "status": "missing", "found": null },          // ok | missing | mismatch
    { "type": "TXT", "name": "_wacrm-verify.partners.euromiles.in", "value": "wacrm-verify=1c7b55",
      "ttl": 300, "status": "missing", "found": null }
  ]
}
```

`status=mismatch` must carry `found` (the observed value) so the UI can show *expected vs found* side by side. `ttl` is advisory — the UI prints it, never enforces it.

**Verify failures.** `POST /v1/domains/{id}:verify` resolves to one of:

| HTTP | `code` | UI behaviour |
| --- | --- | --- |
| `200` | — | `dnsStatus=verified`, certificate provisioning auto-enqueued (`sslStatus=provisioning`), success toast |
| `422` | `VERIFY_FAILED` | keep `pending`, write `domain.lastError`, show the inline red line on the domain card, offer **Verify DNS** again |
| `422` | `NXDOMAIN` | same, copy says the resolver saw no record at all |
| `429` | `RATE_LIMITED` | manual re-check throttled to 1 per minute per hostname; button disabled with a countdown |
| `409` | `ALREADY_VERIFIED` | idempotent no-op; return the current domain row |

The 18 % simulated failure in the prototype (`data.ts::verifyDomainRecord`) exists to exercise the `422` branch — it is not a real probability.

### 10.2 TLS

`pending → provisioning → active`. ACME (HTTP-01 or DNS-01 delegated), 90-day certs, renew at 30 days remaining, auto-revoke + alert on failure. Failed provisioning raises a `severity=1` issue and blocks publish **for that domain only** (the apex may stay live).

### 10.3 Domain deletion

Removing a primary domain requires a replacement primary; the API refuses to leave a site with zero hostnames (`422`).

---

## 11. Media, forms, and other pipelines (needed by later modules, schema now)

### 11.1 Media upload

Two-step: `POST /v1/media:sign` → pre-signed PUT URL (≤ 50 MB) → `POST /v1/media` with the returned sha256. Server verifies hash, extracts dimensions, stitches with sharp/libvips into `{w: 320/640/960/1280/1920} × {avif,webp,jpeg}`, uploads variants to CAS, writes `media_assets.variants`. EXIF stripped; IPTC retained for rights. Deleting an asset with `usage_count > 0` is refused (`409`) unless `?force` — usage is computed nightly plus on-write.

### 11.2 Forms

`POST /f/{publicKey}` from the public site handles submissions: rate limit, honeypot, optional Turnstile, spam score, consent capture, idempotency by `client_submission_id`, then transactionally insert submission + create CRM lead (or enqueue if the CRM is slow). The CMS inbox reads `form_submissions` with cursor pagination and never exposes payloads to a Viewer role without `leads:read`.

### 11.3 Menus, SEO, redirects, localization

Schema in §4.1 covers these now; endpoints follow the same conventions (`/v1/menus`, `/v1/redirects`, `/v1/locales`, `/v1/pages/{id}/translations`). Two invariants: redirect chains are collapsed to a single hop at write time; a locale deletion cannot orphan a page (fallback resolution is deterministic and tested).

### 11.4 Notifications fan-out

In-app notifications are written transactionally with the event that caused them (one row per watcher). Email is a queued side effect with a per-user digest window (15 min) so a 40-page publish does not send 40 emails.

### 11.5 Webhooks

`release.published`, `form.submitted`, `domain.verified`, `issue.opened`, `member.invited`. HMAC-SHA256 signature over `timestamp + body`, 5-minute tolerance, exponential backoff (1 m, 5 m, 30 m, 2 h, 6 h) with a 6-attempt cap and DLQ. Deliveries carry the event id so receivers can dedupe.

---

## 12. Jobs, scheduling, and idempotency

| Job | Trigger | Cadence | Idempotency key |
| --- | --- | --- | --- |
| `build_release` | publish | on demand | `release_id` |
| `purge_cdn` | after build | on demand | `site_id:manifest_hash` |
| `verify_domain` | API | retry ladder | `domain_id:attempt_bucket` |
| `provision_ssl` | verify success | on demand | `domain_id` |
| `rollup_5m` / `rollup_hourly` / `rollup_daily` | cron | 5 m / 1 h / 03:10 site-local | `site_id:day:grain` |
| `recompute_kpi_snapshots` | after rollup | hourly | `site_id:range:gran` |
| `vitals_p75` | cron | hourly | `site_id:day:metric` |
| `link_crawl` | nightly + on publish | daily | `site_id:release_id` |
| `dns_ssl_expiry` | cron | daily | `day` |
| `retention_sweep` | cron | daily | `day` |
| `export_build` | API | on demand | `export_id` |

Every worker is at-least-once safe: `SELECT … FOR UPDATE SKIP LOCKED`, state machine transitions guarded by `WHERE state = expected`, and side effects (S3 puts, webhooks) keyed by content hash or event id.

---

## 13. Observability & SLOs

### 13.1 Instrumentation

- **Logs:** structured JSON, `requestId`, `orgId`, `userId`, `route`, `latencyMs`, `status`. PII scrubbed at the logger boundary.
- **Metrics:** RED per endpoint, USE per host, plus domain metrics: `publish_duration_seconds`, `publish_failures_total{reason}`, `rollup_lag_seconds`, `ingest_queue_depth`, `cdn_purge_seconds`, `dns_verify_failures_total`, `cas_gc_bytes`.
- **Traces:** OpenTelemetry across gateway → service → DB; 10 % head sampling, 100 % on errors.

### 13.2 SLOs

| SLO | Target | Error budget |
| --- | --- | --- |
| `/v1/dashboard` availability | 99.9 % / 30 d | 43 min |
| `/v1/dashboard` p95 latency | ≤ 300 ms (cached ≤ 60 ms) | 5 % of requests |
| Publish success rate (excluding user conflicts) | ≥ 99.5 % | 0.5 % |
| Publish → live propagation | p95 ≤ 30 s | 5 % |
| Ingest accept p95 | ≤ 20 ms, drop rate < 0.1 % | 0.1 % |
| Analytics rollup lag | p95 ≤ 15 min | 5 % of hours |

Alerts page on: publish failure spike, rollup lag > 30 min, DB replica lag > 10 s, ingest queue > 100k, TLS provisioning failures, 5xx rate > 0.5 %.

### 13.3 Audit

Every mutating request writes an `audit_events` row in the same transaction: actor, IP, UA, request id, before/after diff (field-level, PII-redacted). Audit is immutable, exportable, and retained 24 months (7 years for publish/rollback/domain events).

---

## 14. Security & compliance

| Area | Requirement |
| --- | --- |
| Transport | TLS 1.2+ only, HSTS 1 year with preload, no mixed content |
| Secrets | KMS/Secrets Manager, no secrets in env files or images; 90-day rotation |
| Passwords | Argon2id (t=3, m=64 MB), breached-password check, min 12 chars |
| Session | Cookie `HttpOnly; Secure; SameSite=Lax`; rotate on privilege change; revoke-all endpoint |
| CSRF | Double-submit token on cookie-authenticated mutations + `Origin` check |
| XSS | Strict CSP (`default-src 'self'; script-src 'self' 'nonce-…'; object-src 'none'`); user content rendered as text or sanitized through an allow-list |
| Uploads | Type sniffing (magic bytes), re-encode images, strip metadata, virus scan (ClamAV) before publish |
| SSRF | Domain verification and link crawling run through an egress proxy with a public-IP allow-list |
| Tenant isolation | RLS + integration test per table asserting cross-tenant 404 |
| Rate limits | Per user, per IP, per org plan; ingest separate |
| PII | Encrypted at rest per-org keys; field-level encryption for submission payloads; redaction in logs/traces |
| Privacy | DPDP Act 2023 (India) + GDPR: consent evidence stored, DSAR export & erasure jobs, 30-day SLA, sub-processor register |
| Residency | Primary PG + object store in `ap-south-1`; analytics secondary in same region |
| Backups | PITR 35 days, daily logical dump to a second region, quarterly restore drill |
| Dependency hygiene | SCA in CI, block high-severity, monthly patch window |
| Pentest | Before GA, then annually; publish a security.txt and a disclosure policy |

---

## 15. Performance budgets

| Surface | Budget |
| --- | --- |
| `/v1/dashboard` payload | ≤ 60 KB gzip |
| Any list endpoint | ≤ 100 items/page, ≤ 200 KB |
| SPA first paint (published single-file build) | ≤ 200 KB gzip JS, LCP ≤ 2.5 s on 4G |
| Publish job | p95 ≤ 30 s end-to-end for a 50-page site |
| Ingest | 10k events/s sustained, burst 40k |
| DB | no query > 100 ms on dashboard path; every dashboard query covered by an index; `EXPLAIN` gate in CI for the top 10 queries |

Caching layers, in order: edge (60 s) → Redis response cache (30 s, keyed by org/site/range/gran/data-version) → `metric_snapshots` table (materialized) → live aggregation (never on the request path).

---

## 16. Environments & delivery

| Environment | Purpose | Data |
| --- | --- | --- |
| `local` | docker-compose: PG, Redis, MinIO, mailhog | seeded fixture |
| `dev` | auto-deploy on `main` | synthetic |
| `staging` | release candidates, DNS/ACME against a test zone | anonymised |
| `production` | `ap-south-1`, blue-green | real |

- **IaC:** Terraform for infrastructure, migrations via a versioned tool (Prisma Migrate / Atlas / golang-migrate) — expand-contract only, never a destructive migration in the same release as the code that needs it.
- **CI gates:** typecheck, unit, contract tests (§7.9), `EXPLAIN` regression, SCA, migration dry-run, seed-and-screenshot diff against the front end's reference images.
- **Release process:** trunk-based, feature flags for user-visible behaviour, every flag documented with an owner and an expiry date.

---

## 17. Build order (parallel to the front-end modules)

Each phase is independently shippable and unblocks exactly one front-end module.

### Phase 0 — Foundations (1 sprint)
Org/user/membership/session, RLS scaffolding, API envelope, error taxonomy, request ids, audit skeleton, migrations, CI, seed loader that produces §18 numbers.
**Exit:** `GET /v1/me` and `GET /v1/dashboard` return the reference fixture; cross-tenant probe returns 404.

### Phase 1 — Module 1 end-to-end (1–2 sprints)
`sites`, `pages` (read), `issues`, `notifications`, `activity_events`, `rollup_daily` + `metric_snapshots` fed by a synthetic backfill, `/v1/dashboard` composite, `/v1/search`.
**Exit:** Overview renders identically from HTTP; analytics outage degrades only analytics regions (partial-body contract, §9.4); p95 ≤ 300 ms on the 30-day fixture; `tsc` + contract tests green; **every row of the §7.16 action matrix that the Overview screen exposes resolves to a live endpoint**, with unknown ones returning `501 NOT_IMPLEMENTED_YET` rather than 404 so the UI can tell "not built" from "gone".

### Phase 2 — Sites & Domains
Site CRUD, clone, archive, delete tombstone, DNS verify job, ACME/TLS, domain issues.
**Exit:** create → verify → SSL active on a real test domain; failure paths produce actionable issues.

### Phase 3 — Pages & Visual Builder
Revisions, draft PUT with ETag, block schema validation, autosave (debounced revision), revision restore, slug redirects.
**Exit:** two editors on one page cannot silently overwrite; a rename writes a 301.

### Phase 4 — Publishing & Releases
Preflight, manifest build, CAS, purge, rollback, publish job polling, webhooks.
**Exit:** publish is atomic under injected CDN/CAS failures; rollback ≤ 30 s; conflict returns the documented 409.

### Phase 5 — Real analytics ingestion
Ingest service, consent, bot filter, sessionization, hourly/daily rollups, vitals RUM, reconciliation job.
**Exit:** 7 days of production-shaped traffic reconciles within 0.5 %; completion rate and CWV match the definitions in §9.3.

### Phase 6 — Media, Forms & Leads, SEO, Localization, Settings
Per-module as the front end reaches them.

### Phase 7 — Hardening
Penetration test, load test at 3× peak, DR drill, a11y of the public site, docs, runbooks, on-call rotation.

---

## 18. Reference dataset (fixture contract)

The UI was designed against these numbers. Load them in every environment so screenshots, contract tests, and demos agree.

| Entity | Values |
| --- | --- |
| Org | EuroMiles Consultancy Pvt Ltd (`ap-south-1`, `Asia/Kolkata`) |
| Sites | **EuroMiles Main** (euromiles.in, published, DNS verified, SSL active, 48 pages, v1.24, 61.5 % share) · **EuroMiles Rewards** (rewards.euromiles.in, published, 16 pages, v0.9, 27.5 %) · **Partner Portal** (partners.euromiles.in, draft, DNS pending, SSL provisioning, 12 pages, 11 %) |
| Range | last 30 days, daily, 2025-05-01 → 2025-05-30, Asia/Kolkata |
| KPIs | Websites 3 · Visitors 5,420 · Leads 26 · Lead rate 0.48 % · Bookings 8 · LCP 2.1 s (good) |
| Funnel | Visitors 5,420 → Form starts 112 (2.07 %) → Leads 26 (23.2 %) → Bookings 8 (30.8 %) |
| Form | Study Enquiry Form — starts 112, submissions 26, **completion 23.2 %**, 26 leads |
| Channels | Search 56 % · Social 22 % · Direct 14 % · Referral 8 % |
| Pages | Study in Italy 2,814 views / 14 leads · IMAT Medicine 1,620 / 8 · Scholarship Guide 986 / 4 |
| Publishing | drafts 4 · ready 2 · live v1.24 · published May 29, 2025 · 2 pending pages |
| Issues | SSL Pending (Partners) · 1 Broken Link (Scholarship Guide) · 2 Unpublished Changes |
| Vitals | LCP 2.1 s · INP 92 ms · CLS 0.03 · source RUM · 28-day p75 · grade good |
| Activity | v1.24 published · menu edit by Anita N. · page update by John D. · rollback to v1.23 |

Rules the fixture enforces (these were defects in the mock and are now fixed):
- `funnel[0].value === kpis.visitors.value`.
- `completionRate === submissions / starts` — 26/112 = 0.2321, rendered `23.2 %`. It is **not** 76.8 % (that is the non-completion share).
- No `scheduled` site/page/release status exists in v1.
- The traffic chart is cumulative and is labelled cumulative.

---

## 19. Front-end handshake

The front end keeps `src/lib/data.ts` as the single seam. Replace it in this order so the UI never breaks:

1. Add `src/lib/http.ts` (fetch wrapper: envelope unwrap, error → typed `ApiError`, request id surfaced in the status bar).
2. Keep the `API` object's method names and signatures; reimplement each body as an HTTP call. TypeScript then proves the contract at compile time.
3. Swap `getOverview` → `/v1/dashboard` first (single call, biggest win).
4. Replace `localStorage` persistence with server state; delete `seedDB`, `persist`, `reset`.
5. Delete the demo state machine (`applyForcedState` roles `Viewer`, error 502, empty, conflict) only after the real endpoints can reproduce those states via fixtures/toggles; the UI states themselves stay.
6. Move `markRead`, `publishRelease`, `rollback`, `verifyDomain` to optimistic-update + revalidate; each already returns the shapes documented above.

#### 19.1 Current data-layer calls → endpoints

Every symbol the UI imports today, and where it must go. Anything marked *dev* is a harness for the prototype and must be deleted, not reimplemented.

| `src/lib/data.ts` / `store.tsx` | Endpoint | Notes |
| --- | --- | --- |
| `API.getOverview(opts)` | `GET /v1/dashboard?siteId&range&end` | first paint |
| `API.getSeries(opts)` | `GET /v1/analytics/timeseries?siteId&range&gran&mode` | `mode=cumulative` is explicit |
| `API.getSite(id)` | `GET /v1/sites/{id}` | |
| `API.createSite(input)` | `POST /v1/sites` | + `Idempotency-Key` |
| `API.renameSite(id,name)` | `PATCH /v1/sites/{id}` | `If-Match` |
| `API.duplicateSite(id)` | `POST /v1/sites/{id}:duplicate` | |
| `API.setSiteStatus(id,status)` | `POST /v1/sites/{id}:archive` / `:restore` | no free-form status setter server-side |
| `API.archiveSite` / `restoreSite` / `deleteSite` | `POST …:archive`, `POST …:restore`, `DELETE /v1/sites/{id}` | |
| `API.verifyDomain(id)` | `POST /v1/domains/{id}:verify` + `GET /v1/jobs/{id}` | async; poll |
| `API.provisionSsl(id)` | `POST /v1/domains/{id}:provision-ssl` | |
| `API.resolveIssue(id)` | `POST /v1/issues/{id}:resolve` | detector may reopen |
| `API.dismissBanner()` | `POST /v1/banner:dismiss` | per-user |
| `API.markAllRead()` | `POST /v1/notifications:read-all` | |
| `API.readNotification(id)` | `POST /v1/notifications/{id}:read` | |
| `API.publishRelease()` | `POST /v1/releases` (+ `:preflight` first) | `If-Match` + `Idempotency-Key` |
| `store.rollback(version)` | `POST /v1/releases/{id}:rollback` | step-up |
| `store.setDays(n)` / `store.setRange(days,end,name)` | refetch with the new window | label is echoed by the server |
| `store.setGran(g)` | `GET /v1/analytics/timeseries?gran=` | |
| `API.reset()` / `API.raw()` / `API.mode` / `FAIL` | — | *dev only, delete* |
| `API.restoreBanner()` / `API.setBannerState()` | — | *dev only*; banner state is derived from `issues` |
| `applyForcedState()` (prototype beaker) | — | *dev only* |
| `BuilderAPI.loadDraft(pageId)` (M4) | `GET /v1/pages/{id}/draft` | seeds `draftRevision` from the server |
| `BuilderAPI.saveDraft(doc, rev)` (M4) | `PATCH /v1/pages/{id}/draft` | `If-Match: draftRevision`; sends ops, not the tree |
| `BuilderAPI.revisions(pageId)` (M4) | `GET /v1/pages/{id}/revisions` | diff is server-computed |
| `BuilderAPI.restore(pageId, rev)` (M4) | `POST /v1/pages/{id}/revisions/{rev}:restore` | forward-only |
| `BuilderAPI.library(siteId)` (M4) | `GET /v1/library/blocks` + `/sections` + `/page-templates` | three reads, counts computed |
| `BuilderAPI.saveSection` / `deleteSection` (M4) | `POST /v1/library/sections`, `DELETE …/{id}` | built-ins are `403` |
| `streamCopy(text, action)` (M4) | `POST /v1/ai/copy:stream` (SSE) | same callback signature `onToken / onDone / onError`; `cancel()` = abort the request |
| `BuilderAPI.mode` (M4) | — | *dev only, delete* |

Things the mock currently invents that the backend must **not** inherit:

| Mock behaviour | Real behaviour |
| --- | --- |
| `publishRelease` fails ~34 % of the time at random | fails only on a real CAS conflict, preflight block, or dependency error |
| Latency `320–620 ms` on every call | p95 ≤ 300 ms for dashboard; latency is real, skeletons show only past 150 ms |
| Numbers scaled by `scaleRange()` multipliers per range | real rollups per window |
| `verifyDomain` flips to verified after a timeout | resolver-backed job with honest failure states |
| Activity feed generated locally | `activity_events` written transactionally by the action that caused them |

---

## 20. Open decisions (need an owner before Phase 1)

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| 1 | Analytics store | Timescale (one DB) vs ClickHouse | Timescale at MVP; ClickHouse when > 2B events/month |
| 2 | Auth transport | Cookie-only vs cookie + JWT | Cookie-only for the SPA; JWT for service tokens/CI |
| 3 | Publish granularity | whole-site release vs per-page releases | whole-site (matches the UI, guarantees consistency) |
| 4 | Preview URLs | signed per-release hostnames vs token query param | signed hostname `preview-{release}.wacrm.site`, `noindex` |
| 5 | CWV source | CrUX API vs own RUM | own RUM + CrUX as a cross-check; label the source |
| 6 | Lead ownership | CMS-owned CRM vs sync to external CRM | CMS owns the lead record; CRM sync is a webhook |
| 7 | Delete policy | 30-day tombstone vs immediate | 30-day tombstone, purge job, audit retained |
| 8 | Region | single `ap-south-1` vs multi-region | single region + cross-region backups at MVP |

---

## 21. Appendix

### 21.1 Enum reference

`site.status`: `draft | published | archived`
`dns_status`: `pending | verified | failed`
`ssl_status`: `provisioning | active | failed | expired`
`page.status`: `draft | in_review | published | archived`
`release.status`: `building | built | live | superseded | failed | rolled_back`
`issue.state`: `open | resolved | snoozed`
`notification.kind`: `info | ok | warn | error`
`role`: `owner | admin | editor | viewer`
`channel`: `search | social | direct | referral | email | paid`

### 21.2 Glossary

- **CAS** — content-addressed storage; file identity is its SHA-256.
- **Release** — immutable manifest of page revisions + asset hashes that the public site serves.
- **Manifest** — JSON file listing that release's content, stored at a versioned key.
- **Preflight** — validation pass that can block a publish.
- **Rollup** — pre-aggregated metric table the dashboard reads instead of raw events.
- **Window** — explicit `{start, end, timezone}` used for every analytic number.

### 21.3 Definition of done for any backend module

1. Endpoint implemented with the exact contract in §7, envelope and errors included.
2. Contract fixture committed; `/v1/dashboard` parity test green; every §7.16 row for the module is implemented or explicitly deferred in this document.
3. RLS test proves cross-tenant isolation.
4. Audit row written for every mutation.
5. p95 latency inside budget, verified by a load test at 2× expected peak.
6. Failure modes exercised: dependency down, timeout, conflict, rate limit — each produces the documented error code and a usable UI state.
7. Runbook entry: what breaks, how to detect, how to recover.

---

## 7.26 Module 5 — Block Library contracts

Catalogue reads and the single mutation path. Nothing here publishes; every insert lands as one draft revision.

```
GET    /cms/sites/:siteId/library?view=&q=&category=&scope=&sort=&page=&pageSize=
       → { rows[], total, facets:{builtin,workspace,site}, chips:[{id,label,count}],
           kpi:{native,sections,saved,inUse} }

GET    /cms/sites/:siteId/library/:templateId/usage
       → { pages:[{pageId,pageTitle,siteId,status,index,updatedAt}],
           totals:{pages,published,draft,placements} }

POST   /cms/sites/:siteId/pages/:pageId/draft/insert-template
       body  { templateId, variant?, position:{mode:"top"|"end"|"after", afterId?}, expectRevision }
       200   { revision, sectionIds[], placementId }
       403   denied            — role cannot edit this page
       409   conflict          — { latestRevision } (client reloads or keeps its copy)
       413   page_limit        — 40-block prototype ceiling
       422   dependency_unmet  — { requirements:[{kind,label,fixUrl}] }
       503   service_down

POST   /cms/sites/:siteId/library/templates            (create from page section)
       body { pageId, sectionIndex, name, description, category, scope }
       409 name_taken (per scope)

POST   /cms/sites/:siteId/library/templates/:id/duplicate
DELETE /cms/sites/:siteId/library/templates/:id         → 409 in_use { pages[] }
POST   /cms/sites/:siteId/library/import                → gated until the v1 interchange validates
```

**Invariants the API must hold** (they are QA-asserted in the prototype): `kpi.*` and the `rows` for the
same query come from one snapshot; `sum(facets.*) == total` before chips/scope filters; a placement row
exists for every materialized copy and survives template deletion; `expectRevision` is mandatory.
