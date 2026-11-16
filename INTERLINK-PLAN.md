# Interlink plan — CMS ⇄ CRM, decided

You delegated the interconnection architecture ("choose what is best for our case… everything should be in automation"). This is that decision record: **eight decisions, each with the mechanism, the rationale, the risk, and what it costs to build.** It is written against the real CRM in `euromilesofficial/EuroMiles-WACRM` at `c07cbb6` — every "already exists" claim below was verified in that tree, not assumed.

The product thesis it protects: **the CMS is not a website builder with a lead form bolted on. It is the top of the funnel of the CRM, and every interactive block is an automation trigger.**

---

## 0. What already exists on the CRM side (verified)

| Capability | Where | Consequence for us |
|---|---|---|
| Anonymous visitor tracking with `page`, `referrer`, `utm{source,medium,campaign,term,content}`, `event: pageview \| custom \| identify` | `POST /api/public/widget/track` → `upsertVisitor`, `recordEvent`, then `dispatchLivechatAutomations` | The tracking spine is already public, CORS-open, IP rate-limited, and keyed to `chatbotId` + `visitorKey`. We attach to it rather than inventing a parallel one. |
| Pre-chat identity capture (phone/email before the chat starts) and `identifyVisitor` | `src/routes/api/public/widget/session.ts`, livechat engine | Website chat already lands a contact. The CMS form must produce the **same** record shape or the CRM forks into two contact populations. |
| Contact dedupe / identity resolution with auto-merge flags and AI suggestions | livechat visitor engine | We do not merge in the CMS. We send what we know and let the CRM resolve. |
| `trigger.lead.created`, `trigger.contact.created`, `trigger.lead.converted` | automation catalog | A form submit has a **first-class trigger** to start a workflow from — no polling, no webhook glue. |
| 42 actions incl. `action.whatsapp.send_template`, `action.whatsapp.send_message`, `action.sms.send`, `action.email.send`, `action.task.create`, `action.deal.create`, `action.deal.update`, `action.contact.add_tag`, `action.contact.update`, `action.notify.internal`, `action.slack.notify`, `action.booking.create/send_link/schedule_reminders`, `action.marketing.start_campaign`, `action.livechat.create_lead`, `action.database.update`, `action.webhook.send` | automation catalog | Every block in the palette can declare a destination from a catalog that is **already built**. |
| Public-token submit with workspace-scoped foreign-key validation | `POST /api/public/surveys/submit` | The exact pattern a CMS form endpoint needs: untrusted anonymous caller, token → workspace, client-supplied refs validated against that workspace before use. |
| **No `forms` entity, no `form_submissions`, no `sites`/`pages` tables** | absent from the tree | The CMS owns these. Confirms D1. |
| `src/shared/forms/*` is UI standards (wizard, autosave, validation), **not** a form builder | `src/shared/forms/index.ts` | Nothing to import. Confirms the earlier finding — but see D6. |

---

## 1. The eight decisions

### D1 — Forms and pages are authored in the CMS; records are born in the CRM

**Decision.** A form is a CMS row (`cms_forms`) with fields, consent config and a public token. A submission is posted to the **CRM** (`POST /api/public/forms/:publicToken/submit`), which writes `contacts` / `leads` / `consent_records` and fires `trigger.lead.created`. The CMS stores **only counters and a submission index reference**, never the PII.

**Why.** One place owns a person. If the CMS kept a contacts table we would have two customer records, two consent histories, and a GDPR deletion that has to be run twice. Counters are enough for the CMS UI ("34 submissions this week") and carry no PII.

**Risk.** A CMS analytics view that needs a name must call the CRM. Mitigation: the CMS never renders PII in list views — it renders counts and links into the CRM.

### D2 — One submission produces a contact **and** a lead, deduped by the CRM, plus an attribution record

**Decision.** The submit payload carries `identity` (phone/email, in order of confidence), `answers`, `consent`, and `attribution { siteId, pageId, blockId, variantId, sessionId, utm{…}, referrer, landingUrl }`. The CRM resolves identity (`phone → email → create`), attaches the lead with `source = "cms_form:<form_slug>"` and `source_detail` = page route, and stores attribution on the lead, not on the contact.

**Why.** `lead.source` already exists and the `trigger.lead.created` node **has a source filter** — that single field is what lets the same workflow run for a website form and not for a WhatsApp keyword. Attribution belongs to the lead because the same contact can convert twice from two pages.

**Risk.** Source strings become a de-facto API. Mitigation: `cms_form:<slug>` is a frozen format, documented in `BACKEND-PLAN.md`, and the filter UI reads it as *Website form*.

### D3 — Consent is a required field group, unticked, channel-named, and stored as a record

**Decision.** A form cannot be published with a phone/WhatsApp field unless it carries a consent block: unticked by default, naming the business (workspace display name), the channel (WhatsApp / SMS / email), and the message types (updates, offers, reminders). Submission writes a `consent_records` row with text, timestamp, IP, page route and form version. Without it, the CRM **still creates the contact and lead** (it is a legitimate enquiry) but tags `whatsapp_opt_in = false` and every WhatsApp action in a workflow skips that lead.

**Why.** Meta's opt-in policy is a hard constraint and the CRM already has consent tables that nothing currently writes. Enforcing at the block level — not in a policy doc — is the only enforcement that survives a busy marketer.

**Risk.** Extra friction on the highest-converting block. Mitigation: one checkbox, one sentence, no modal; measured as a drop-off in the QA matrix, and the block refuses to save without it rather than silently publishing.

### D4 — The palette declares automation, not wiring

**Decision.** Each of the 20 block types (38 archetypes) ships a **declared contract**: `emits` (events), `requires` (form, consent, provider), `automationHint` (the suggested trigger → action pair). The inspector shows this as a read-only *Automation* group with a "Suggest a workflow" button that opens Module 2's automation canvas pre-filled. No rule engine in the CMS.

**Why.** The user's constraint is that the CMS must not grow a workflow builder. Declaring intent and handing off to the place that executes it keeps one automation engine — the CRM's.

### D5 — One announcement banner, no popups, no exit-intent

**Decision.** The palette offers a **sticky announcement bar** block (dismissible, one per page, one per site) and refuses overlay/exit-intent blocks.

**Why.** The CRM already owns exit-intent at the livechat layer (`trigger.livechat.exit_intent`), so a second, page-level exit-intent would double-fire the same conversation. And a website CMS that ships popups ships a Core Web Vitals and reputation problem the customer cannot debug.

### D6 — Single-step forms now, `steps[]` reserved in the schema

**Decision.** The form block and the (Module 6) form builder support one step. The stored schema is `{ steps: [{ fields[] }] }` from day one.

**Why.** Multi-step converts 20–40 % better on long forms, but it needs wizard state, partial-submit identity and resume links — a module of its own. Reserving the shape means adding it later is additive, not a migration.

### D7 — Bidirectional sync, but with one owner per fact

**Decision.** The link is a loop, with an explicit ownership table:

| Fact | Owner | CMS reads | CMS writes |
|---|---|---|---|
| Page, blocks, form definition, consent copy | **CMS** | — | ✓ |
| Contact, lead, stage, owner, tags | **CRM** | ✓ (read-only, via CRM API) | ✗ |
| Consent record | **CRM** (immutable log) | ✓ | append-only via submit |
| Submission counters, conversion rate per block | **CRM** computes | ✓ | ✗ |
| WhatsApp template approval state | **CRM** | ✓ (blocks publish if the form's template is rejected) | ✗ |

**Why.** "Synced" invites two-way writes on the same fact, which is how systems drift. Every fact has exactly one writer; the other side reads.

### D8 — The invisible-to-visitor rule is a rendering rule, not a promise

**Decision.** Automation never renders inside the page. No "automation ran" toast, no chat hand-off banner, no "we'll WhatsApp you" that depends on a workflow existing. The block's thank-you copy is static and honest; what happens next is the CRM's business and is visible in the CRM's inbox.

**Why.** It is the acceptance criterion, and it is also the only version that survives a workflow being paused or deleted. The visitor sees a submitted form, and that is all.

---

## 2. Automation matrix — block → event → trigger → default action

Every block that a visitor can interact with is listed. "Default" is what the *Suggest a workflow* button pre-fills; the marketer can change it, but the pairing is the one that makes sense for that block's intent.

| Block (archetypes) | Emits | Trigger | Default action chain |
|---|---|---|---|
| **Form** (`form`, `leadForm`, `multiField`) | `form.submitted` | `trigger.lead.created` filtered `source = cms_form:<slug>` | `action.whatsapp.send_template` (if consent + approved template) → `action.contact.add_tag site-form` → `action.task.create` "Call within 24 h" → `action.deal.create` in *New enquiry* |
| **Form** — no phone/WhatsApp field | `form.submitted` | same | `action.email.send` acknowledgement → `action.task.create` |
| **Chat / WhatsApp widget block** (`container` + widget) | `conversation.started` (CRM-side) | `trigger.livechat.message.received` | `action.livechat.start_ai_chat` → on `identify`: contact + lead, `source = cms_chat:<page_slug>` |
| **Button** (`button`, variant `whatsapp` / `call` / `link`) | `cta.clicked` (analytics only) | none | — tracking only; no automation. A click is not consent. |
| **Booking / calendar block** (`form` variant `booking`) | `booking.created` | `trigger.booking.created` | `action.booking.schedule_reminders` → `action.whatsapp.send_template` confirmation → `action.booking.notify` |
| **Pricing** (`pricing`) | `plan.selected` + form submit | `trigger.lead.created` | `action.deal.create` with `value = plan price`, stage *Quote sent* |
| **Testimonials / Quote / FAQ** | `block.viewed` (analytics) | none | — proof, not a funnel step |
| **Hero / Heading / Text / List / Table / Image / Video / Divider** | `block.viewed` | none | — |
| **FeatureGrid / Columns / Container** | — (layout) | none | — |
| **Alert / announcement bar** | `banner.dismissed` | none | — |
| **Footer** | — | none | — |
| **Any block with a `link` to a page** | `page.navigated` | none | — attribution only |

Two rules that keep the matrix honest: **a click is never an event that starts a workflow** (only a submitted form or a started conversation is), and **every action that sends a message checks consent** at execution time, not at design time.

---

## 3. The loop, end to end

```
VISITOR                CMS (pages, blocks, forms)              CRM
  │                              │                              │
  ├─ pageview ──────────────────►│──────── track (page, utm) ──►│ upsertVisitor + recordEvent
  │                              │                              │
  ├─ fills form ────────────────►│  POST /api/public/forms/:token/submit
  │   (name, phone, consent)     │   identity + answers + consent + attribution
  │                              │                              ├─ resolveIdentity (phone → email → create)
  │                              │                              ├─ contact + lead (source = cms_form:<slug>)
  │                              │                              ├─ consent_records (text, ts, ip, form version)
  │                              │                              ├─ trigger.lead.created ──► workflow
  │                              │                              │      WhatsApp template · task · deal · tag
  │◄─ thank-you copy (static) ───┤◄──── 202 { submissionId } ───┤
  │                              │                              │
  │   counters + conversion ◄────┤◄──── GET /cms/pages/:id/stats ┤ (aggregate, no PII)
```

Every arrow on the right-hand side exists in the CRM today except the form submit endpoint, which has a working template in `surveys/submit.ts`.

---

## 4. Endpoints to add (contract only — `BACKEND-PLAN.md` §7.20)

```
GET    /api/public/pages/:siteSlug/:pageSlug          → published document + form tokens + tracking ids
POST   /api/public/forms/:publicToken/submit          → 202 { submissionId } | 409 duplicate | 422 consent_required
GET    /api/sites/:siteId/forms                        → form definitions (name, fields, consent, token state)
GET    /api/sites/:siteId/pages/:pageId/stats          → { views, submissions, conversion, byBlock[], byUtm[] }
GET    /api/sites/:siteId/automation-suggestions?block=form → [{ trigger, actions[], rationale }]
POST   /api/sites/:siteId/pages/:pageId/publish        → immutable snapshot + page version
```

`submit` must be **idempotent** on `(publicToken, sessionId, formVersion)` for 10 minutes — a double-clicked submit must not create two leads. It must also rate-limit per IP the way `surveys/submit` does, and it must never trust client-supplied `siteId` (validate against the token's workspace).

---

## 5. Build order (revised, and why)

1. **Forms spine** — `cms_forms` + form block + public submit + consent + `trigger.lead.created` source filter. *This is the acceptance criterion; nothing else can be validated without it.*
2. **Interlink surfaces** — Automation group in the inspector, "Suggest a workflow", submission counters on the page card, the publish snapshot that pins a form version.
3. **Palette expansion** (M5) — the remaining archetypes, each with its declared contract from §2.
4. **AI mode in the builder** — *shipped ahead of 1–3*, because it is a builder-surface feature with no dependency on the CRM and it was the round-4 requirement.

---

## 6. How this will be proven

| Claim | Test |
|---|---|
| A website submission creates a CRM lead | Endpoint contract test: POST → 202, then `GET /api/v1/contacts` shows one contact, `leads` shows one with `source = cms_form:<slug>` |
| Automation actually starts | Same submit with a workflow on `trigger.lead.created` filtered to that source → `automation_runs` row in < 2 s |
| Chat identifies into the CRM | Widget pre-chat → contact exists with `source = cms_chat:<page>` |
| Consent is enforced | Submit with the box unticked → contact + lead created, `whatsapp_opt_in = false`, WhatsApp action skipped, `consent_records` still written (declined, with text) |
| Duplicate submit is safe | Two POSTs, same sessionId → one lead, second returns 409 |
| Nothing is visible to the visitor | DOM diff of the page before/after submission: only the thank-you state changes |

---

## 7. What I am *not* building, and why that is the right call

- **No rule engine in the CMS** — two engines, two sources of truth, one bug that loses leads.
- **No contacts table in the CMS** — see D1.
- **No popups / exit-intent** — see D5.
- **No multi-step forms yet** — see D6.
- **No CMS-side PII in analytics** — see D1.
- **No CRM form-builder import** — the CRM has no form-builder entity (`src/shared/forms` is UI standards), so "import the CRM's form" has nothing to import. When the CRM grows one, it becomes a `source: "crm"` row in `cms_forms` with a read-through binding — the same shape HubSpot uses (a form module holds a form **ID**, not a copy).

---

## 7. Module 7 wiring — what is actually built

Module 7 (Layouts & Templates) is the first module whose primary job *is* interconnection: it
owns the shell every other screen renders inside, and it binds pages without owning them.

| Contract | Direction | Built as | Where |
|---|---|---|---|
| A page's shell is one resolvable string | M3 ⇄ M7 | `resolveLayoutId(CmsPage.layout)` — `Site default` inherits, any other value is an explicit pin | `src/lib/layout-db.ts` |
| Bulk rebind is a real registry write | M7 → M3 | `LayoutsAPI.reassign` updates `layout`, `revision`, `hasChanged`, `updatedAt` and writes one audit revision | `src/lib/layout-db.ts`, `/layouts` → Usage |
| The builder draws the real shell | M7 → M4 | `frameFor(siteId, page.layout)` feeds `Canvas`, which renders the announcement, brand, nav and CTA of the pinned variant and says so on its chip | `src/views/Builder.tsx`, `src/components/builder/Canvas.tsx` |
| Slot policy is a gate, not a label | M7 → M4/M5 | the library filters to the layout's allow-list and shows `Layout allows N/20 blocks`; denied seed blocks are flagged on the canvas | `src/components/builder/Library.tsx` |
| Layouts travel with a theme bundle | M7 → M6 | `exportBundle().layout.starterLayouts` carries every live layout (regions, policy, seed count) and all 12 templates | `src/lib/theme-db.ts` |
| Creating a page from a template hands over a real draft | M7 → M4 | `createPageFromTemplate` writes the page, then seeds the builder draft with the template's blocks | `src/lib/layout-db.ts` |
| A third-party page enters through one door | outside → M7 | `importHtml()` reduces any HTML file (and the 14 prebuilt starters, through the same function) to registry blocks; `importJson()` accepts a WACRM export, a block array, or a page-builder project whose HTML goes through the same extractor | `src/lib/html-import.ts`, `src/lib/prebuilt-db.ts` |
| Import cannot execute what it imports | outside → M7 | scripts, styles, iframes, media, inline handlers and `javascript:` URLs are stripped before parsing; the document is never inserted into the page; `qa_import.py` C12 asserts an uploaded `window.__pwned = 1` never ran | `sanitizeHtml()` |
| Imported structure is styled by the site, not the file | M7 → M6 | no CSS is read, so colour, type and spacing come from the active theme; the file's own palette and fonts are *reported* as hints and never applied | `ImportReport.brand`, Theme Studio |
| Provenance survives the round trip | M7 ⇄ M7 | `PageTemplate.origin` (kind, name, source, licence, commit, importedAt) is written on import, shown as a pill and as inspector rows, and exported with the JSON bundle | `LayoutsAPI.importTemplates`, `exportTemplatesJson` |
| A page names the shell it actually gets | M7 → M3 | the inspector resolves `CmsPage.layout` and shows the layout name, whether it is inherited or pinned, and the header variant with its link count; the variant name deep-links to that layout | `src/components/pages/PageInspector.tsx`, `qa_m7_links.py` C1–C6 |
| The block library counts real use | M7 → M5 | `blockUsage()` counts the layouts and templates that contain each block type; the card shows `nL · nT` and the inspector splits layout seeds / templates / chrome | `src/lib/layout-db.ts`, `src/views/Library.tsx`, `qa_m7_links.py` D1–D4 |
| Navigation has one source, not two | M7 → M8 | Module 8 is a placeholder, so it reads the header variant the site default resolves to (`headerNavFor`) and deep-links to where those links are edited — instead of owning a second, divergent menu | `src/views/Placeholder.tsx`, `qa_m7_links.py` E1–E5 |
| Revisions restore what they claim | M7 ⇄ M7 | `StructureSnapshot` is stored on every write; `history()` returns restorable entries; `revert()` rewrites the structure as a **new** revision and refuses when nothing was stored | `src/lib/layout-db.ts`, `HistoryModal.tsx`, `qa_m7_links.py` A1–A14 |
| Deep links survive an in-app route change | M3 → M7 | a `hashchange` listener applies `tab` / `itab` / `sel` when the parameters are present, because the store rewrites the hash and a fragment navigation never reloads the document | `src/views/Layouts.tsx` |
| The CMS still owns no customer record | M7 → CRM | layouts and templates carry no PII and fire no lead event; form blocks reach the CRM through D1/D6 above | — |

Deliberately **not** wired: importing a layout from a bundle (a layout can reference regions
that do not exist in the target workspace), editing chrome block-by-block from Module 7
(that is Module 4's editor; the drawer edits variant metadata only), and Module 8 itself —
its screen still belongs to the next iteration, it just no longer invents its own menu.
