# Module 5 review — block library vs the industry, and what the WACRM CRM gives us

**Status:** findings and proposals only. **Nothing is implemented.** Sign off on §8 and it becomes Module 5 (blocks) and Module 6 (forms).

Reviewed repository: `euromilesofficial/EuroMiles-WACRM` @ `c07cbb61` — *"feat: initial commit of EuroMiles WACRM parent codebase"*, 14 Nov 2026, 35 MB checkout, 267 authenticated route files, 379 migrations, ~300 tables.

---

## 0. What changed for the better, before anything else

This copy has **no CMS in it**: no `src/components/cms`, no `cms.*` routes, no GrapesJS dependency in `package.json`. The copy I was told not to review had a half-built GrapesJS CMS (`cms.$pageId.tsx`, 2,400 lines, `blocks-config.ts` with 52 blocks, Google Fonts loaded into the canvas).

That is good news. There is nothing to merge, nothing to reconcile and no second editor to keep in step — **our React builder is the only CMS**, and integration collapses to *"the CMS calls the CRM's data"*. The earlier integration risk was "two editors, two schemas"; the actual risk is now just API surface.

What the CRM is built on (so the integration is realistic):

| | |
| --- | --- |
| Framework | React 19 · TanStack Router + **TanStack Start** (SSR/server functions) · Vite |
| Data | Supabase Postgres with RLS on every tenant table, 379 migrations |
| Styling | Tailwind + a `components/ui` kit (shadcn-style) |
| Validation | zod on server functions |
| Channels | `whatsapp`, `instagram`, `messenger`, `telegram`, `sms`, `email`, `livechat`/`web`, `tiktok` |
| Public surface | `/api/public/*` — widget SDK, booking, surveys, webhooks, v1 REST + OpenAPI, `widget.js` |

---

## 1. The device icons — done

You were right the first time: the three buttons reused `dashboard`, `sheet` and `form`, which read as *panels*, not viewports. They are now a purpose-drawn family at the same 24-grid / 1.7 stroke weight as the rest of the icon set, with deliberately different proportions so they are distinguishable at 14 px:

- **Desktop** — monitor with a stand and foot
- **Tablet** — wide body with a home indicator
- **Mobile** — narrow body, speaker slit at the top, home indicator

![The three device buttons](qa/m4-device-icons.webp)

Shipped in `f2ff414` (first pass) and refined after that commit; `qa_builder.py` 97/97 and `qa_states_m4.py` 47/47 both still pass.

---

## 2. "Is there a form builder?" — direct answer

**Not a general web form builder. But you are much closer than "no".** Three adjacent systems exist, and together they are 80 % of what you asked for.

| # | System | Evidence in the repo | What it actually is | Could we import it? |
| --- | --- | --- | --- | --- |
| 1 | **WhatsApp Flows builder** | `whatsapp_forms` (name, `category` ∈ SIGN_UP/SIGN_IN/APPOINTMENT_BOOKING/**LEAD_GENERATION**/CONTACT_US/…, `status` DRAFT→PUBLISHED→DEPRECATED→BLOCKED, `flow_json`, `submissions_count`) · `whatsapp-form-editor-dialog.tsx` · `whatsapp_form_submissions` (`form_id`, `contact_wa_id`, `contact_name`, `response_data jsonb`) · ingestion `whatsapp-forms.server.ts` (Meta `nfm_reply`, dedup on `external_message_id`) · inbox picker to send a form into a chat | A **real visual form builder with named forms** — steps with `text · textarea · email · phone · number · select · multiselect`, required, `field_key`, help text, `validation{min,max,pattern}`, options, drag reorder | **Partly.** The form names exist, so "whatever name we save shows in Forms & Engagement" is real. But the fields are authored for WhatsApp (they become Meta Flow JSON and render *inside* a chat), and submissions only arrive as inbound WhatsApp messages. A website has no path in. |
| 2 | **Custom Fields registry** | `custom_field_definitions` — 19 field types × 6 entities (`contact`, `company`, `lead`, `customer`, `deal`, `task`), with `options`, `default_value`, `is_required`, `is_unique`, `placeholder`, `help_text`, `validation`, `section`, `position`, soft delete · management screen `#/custom-fields` (owner/admin) · `use-custom-fields` · `leads.custom_fields jsonb` | The **field vocabulary** a web form needs, already governed, already per-tenant | **Yes — this is the missing half.** A web form field maps 1:1 onto a custom field definition; the CRM already knows how to store and validate it. |
| 3 | **Adjacent capture points** | Booking (`booking_event_types.questions jsonb`, public `/book/$slug`, price, redirect, confirmation, reminders) · Surveys (`csat_surveys` + `/api/public/surveys/submit` with `public_token`, `responses jsonb`) · Marketing lead form (`marketing_leads`, fixed schema, honeypot, 10-minute per-email throttle, UTM capture) | Four narrow, hard-coded forms | Not directly — but three of them are *precedents* for how a public form endpoint should behave, and one (booking) is worth exposing as a block as-is. |

### What is genuinely missing

1. No `forms` table (only `whatsapp_forms`), no field table, no channel-agnostic submission table.
2. No public "submit a form from a website" endpoint. The only unauthenticated write paths are surveys, booking and the widget.
3. No consent capture attached to a submission — `consent_records` and `cookie_consents` exist, but nothing populates them from a lead form. Meta requires exactly that record before any WhatsApp message (see §10).

### The three ways to close it

| | Option | What it means | Cost | Risk |
| --- | --- | --- | --- | --- |
| **A** | Import WhatsApp Flow forms as website blocks | Read `whatsapp_forms`, render the `FormStep[]` on the page, post nowhere useful | Low | Breaks the moment it is used: fields are flow-JSON semantics, and there is no web submission path. Name-only fidelity. **Not recommended.** |
| **B** | One CRM-side Forms service | New `forms` + `form_fields` + `form_submissions` (channel: `web`, `whatsapp_flow`, `popup`, `embed`); WhatsApp Flows become one renderer of the same definition; custom fields become the field source | High — it is a CRM change, and we do not own that repo here | Correct long-term, but it needs the CRM team, and it blocks the CMS on someone else's roadmap |
| **C** | **Forms module inside the CMS, writing into the CRM** | Module 6 owns the form definition (fields, validation, steps, consent, thank-you, theme). One public endpoint submits: create/update Contact or Lead, map fields into `custom_fields`, write the consent record with `source = cms_form:<slug>`, then fire `trigger.lead.created`. The definition is shaped so it maps 1:1 onto Option B later | Medium — all inside our repo | Duplicate-lead logic and consent correctness have to be right from day one |

**Recommendation: C now, B when the CRM's own Forms module lands.** It is the only option that ships in this repository, it needs no CRM schema change, it makes the form list real (the CMS reads the same `forms` it writes), and the mapping to B later is mechanical. B alone would leave the CMS blocked on work we cannot do.

---

## 3. What the CRM gives the CMS, block by block

This is the part that makes the CMS *this* product rather than a generic builder. Every row is a real capability in the repo, not a proposal.

| CRM capability | Where it lives | Becomes a block | What it must call |
| --- | --- | --- | --- |
| **WhatsApp click-to-chat** | `whatsapp-cta.ts` normalises a number, `wa.me` link or short link into a chat URL; `use-whatsapp-cta` resolves the platform token, a prefilled message with `{site}`/`{page}` placeholders, and a **fallback URL when no token is configured**; `ctaAttrs()` emits an analytics event per placement | **WhatsApp CTA** — button, floating launcher, or inline card | `GET /v1/channels/whatsapp/cta` → `{href, label, message, isFallback}` |
| **Website chat agent** | `chat_widgets` (`config`, `allowed_domains`, `routing_rules`), `widget.js`, `/api/public/widget/{session,chat,typing,upload,track,beacon}` | **Chat launcher** (site-wide, not per page) | `GET /v1/widgets/{id}/embed` → `{scriptUrl, widgetId, allowedDomains}` |
| **Chatbots** | `chatbots`, `chatbot_deployments`, `embed.chatbots.$botId` | **Chatbot inline embed** for a landing page | `GET /v1/chatbots/{id}/embed` |
| **Booking** | `booking_pages`, `booking_event_types` (duration, buffers, `questions`, `price`, `redirect_url`, `confirmation_message`, reminders), public `/book/$slug` | **Booking block** — slot picker or a "book a call" card that deep-links to the booking page | `GET /v1/booking/event-types?siteId` |
| **Intake questions** | `booking_event_types.questions jsonb` | Fields the Booking block shows before handing off | same |
| **Surveys / CSAT** | `csat_surveys` + `/api/public/surveys/submit` (`public_token`, `responses`) | **NPS / survey block** | `GET /v1/surveys/{token}` |
| **Forms (WhatsApp Flows)** | §2 row 1 | **Form block** — shows the form's *name*, renders it on the page, submits to the CRM | `GET /v1/forms`, `POST /public/forms/{id}/submit` |
| **Custom fields** | `custom_field_definitions` | The field palette inside the form builder | `GET /v1/custom-fields?entity=lead` |
| **Consent** | `consent_records`, `cookie_consents` | Consent line inside every form + a cookie banner block | `POST /public/consent` |
| **Leads / contacts / deals** | `leads` (`source`, `score`, `rating`, `custom_fields`, `converted_*`), `contacts`, `deals`, pipelines | Submission destination + attribution | server-side only |
| **Automation** | `workflow_*` engine, `automations`; triggers `trigger.lead.created` (with a **source filter**), `trigger.livechat.*`, `trigger.webhook`, `trigger.api`; actions `whatsapp.send_message`, `whatsapp.send_template`, `sms.send`, `email.send`, `omnichannel.send`, `crm.handoff`, `booking.*` | Nothing new — **a form submission already fires the automation engine** | — |
| **Unified inbox** | `conversations`, `messages`, `message_outbox`, `channel_accounts`, `channel_identities` | A submission can open a conversation thread instead of a dead lead | server-side only |
| **Product / commerce** | `products`, `commerce_*`, `wa_catalog_*` | **Program / product card** (a €-priced course card is the same shape) | `GET /v1/products?siteId` |

**The point of this table:** the differentiator over Elementor/Webflow is not more blocks — it is that *twelve* blocks are wired to systems the customer already pays for. A generic builder's form block emails someone. Ours creates a scored lead, fires a workflow, opens an inbox thread and can send a WhatsApp template.

### One thing to settle about "our SMS"

The CRM **already has SMS**: `sms_accounts` (provider `twilio`, credentials encrypted, status/last-verified), action `sms.send`, trigger `sms.received`. So no SMS block is needed for integration. I read your line as *"our CMS"* — but if you literally meant SMS, tell me and I will treat SMS as a first-class block channel (text-me back, SMS opt-in, "reply YES" keywords) rather than a hidden automation action.

---

## 4. Block library vs the industry

### What the industry actually ships

| Builder | Element count | Structure | Source |
| --- | --- | --- | --- |
| **Elementor** | ~40 free / ~100 with Pro | Basic · General · Pro · Theme · WooCommerce · WordPress | [Pixel Fish](https://www.pixelfish.com.au/blog/elementor-pro-widgets-a-detailed-guide-to-every-widget/) · [PluginTheme](https://plugintheme.net/blog/elementor-guide-2026-everything-you-need-to-know) |
| **Webflow** | ~60 elements | Structure · Typography · Links · CMS · Media · **Forms** (10 separate form elements) · Custom code · Other | [Webflow: the Add panel](https://help.webflow.com/hc/en-us/articles/33961270096659-The-Add-panel) |
| **WordPress Gutenberg** | 90+ core blocks | Text · Media · Design · Widgets · Theme · Embeds | [PluginTheme](https://plugintheme.net/blog/wordpress-gutenberg-block-editor-guide-2026) |
| **HubSpot** | 25+ standard modules | Rich text, image, button, **form (pulls a form by ID)**, menu, video, social, CTA… plus global modules | [Boundev](https://www.boundev.ai/blog/hubspot-modules-guide-for-marketers) · [INSIDEA](https://insidea.com/blog/hubspot/kb/how-to-use-default-modules-in-hubspots-layout-editor/) |
| **Instapage / Unbounce** | (conversion set) | Forms, multi-step forms, countdown timers, exit-intent lightboxes, sticky bars, social proof | [Instapage](https://instapage.com/en/features/forms) · [comparison](https://marketingagency.sg/landing-page-builders-comparison/) |

Two patterns worth copying exactly:

1. **HubSpot's Form module is a pointer, not a copy.** The block holds a form ID; the form itself is edited elsewhere. That is the model you described, and it is the right one — it is why a renamed form updates on every page.
2. **Webflow treats form fields as separate elements** (Label, Input, Text area, Checkbox, Radio, Select, reCAPTCHA, Form button) — full control, but it means every page gets a differently-built form. Our form-builder route avoids that: compose the form once, place it many times.

### Where we stand: 19 offered

Hero · Heading · Text · List · Table · Quote · Feature Grid · Pricing · Testimonials · FAQ · Image · Video · Button · Alert · Container · Columns · Divider · Form · CTA Section (Footer is reserved for the master layout).

That set was chosen to reproduce one page — the Study Abroad mock. It is a *page* palette, not a *site* palette. Compared to the benchmarks it is missing four whole jobs:

| Job | Industry has | We have | Gap |
| --- | --- | --- | --- |
| **Structure** | Spacer, section/band, grid presets, tabs, accordion, stack | Container, Columns, Divider | 4–5 blocks short; no way to build a band with a background, no tabs |
| **Proof & data** | Counter, number strip, logo cloud, rating/review, timeline, team | Feature Grid (holds stats), Testimonials (holds ratings) | No standalone counter, no logo cloud, no timeline |
| **Media** | Gallery, embed (YouTube/Maps), audio, file, lightbox | Image, Video | No gallery, no URL embed — a Maps or YouTube block is a copy-paste-the-iframe job today |
| **Conversion** | Countdown, newsletter, lead magnet, sticky bar, multi-step form, popup | CTA Section, Form | No countdown, no newsletter, no gated download |
| **CRM-native** | — (nobody else has this) | none | WhatsApp CTA, chat launcher, booking, survey, product card — **our whole differentiator is missing from the palette** |

### Proposal: 19 → 38 offered, in 8 chips

**Tier 1 — generic, 12 new** (closes the ordinary gaps; all are single-purpose, no conditionals):

`Spacer` · `Section` (full-bleed band with background + padding) · `Grid` (2×2 / 3×2 preset) · `Tabs` · `Icon` · `Icon Box` · `Icon List` · `Counter` (single KPI) · `Logo Cloud` · `Gallery` · `Embed` (URL → YouTube / Vimeo / Maps) · `Countdown`

**Tier 2 — CRM-native, 7 new** (the reason a WACRM user picks this over Elementor):

`WhatsApp CTA` · `Chat Launcher` · `Booking` · `Survey / NPS` · `Program Card` (product/course) · `Contact Card` (channels + hours) · `Form (CRM)` — the existing Form block upgraded to *pick a form by name*, with a basic inline form kept for people who have not built one yet

**Counts:** 19 + 12 + 7 = **38 offered**, chips recomputed automatically: Content 12 · Media 7 · Layout 7 · Actions 3 · Forms & Engagement 5 · **WACRM 4**.

**Sections** 23 → 32: add *Logo cloud, Stats band, Tabs panel, Timeline / process, Gallery grid, Booking + FAQ, Survey CTA, WhatsApp band, Lead magnet*.
**Templates** 5 → 7: add *Landing (form above the fold)* and *Booking page*.

**Discipline that comes with it** — otherwise the palette rots:
- counts stay **computed** from the registry, never typed (this is already a QA assertion);
- every block ships with: inspector fields generated from the registry, token-bounded style options, an empty state, a keyboard path, and a refusal rule when it is dropped somewhere illegal;
- a block that cannot be *placed* without a second system (e.g. Booking with no event types) must show the reason and a link, exactly like the current empty-form picker;
- 8 chips is the ceiling. If it needs a ninth, a block is in the wrong chip.

---

## 5. The form builder, concretely (Module 6)

If you approve Option C, this is the shape — deliberately the same three-panel grammar as the Visual Builder so it does not feel like a second product.

**Screen** `#/forms` — list (name, fields, submissions, status, updated) + **Form Builder** `#/forms/{id}`:

| Panel | Contents |
| --- | --- |
| Left | Field palette, grouped: **Contact** (name/email/phone/company), **Choice** (select, radio, multi-select, checkbox), **Input** (text, textarea, number, date, URL), **Advanced** (file, rating, consent, hidden/UTM) — 19 types, mirroring `custom_field_definitions` 1:1 |
| Centre | The form itself, in a device frame (reusing the builder's device switch), field chips selectable, drag to reorder, "+ add step" for multi-step |
| Right | Inspector: label, `field_key` (= custom field key), required, placeholder, help text, validation (min/max/pattern), options, mapping (→ which CRM field), consent text |

**Settings tab:** submit button copy · thank-you message or redirect URL · destination (Lead / Contact / both) · source label (`cms_form:<slug>`) · WhatsApp opt-in checkbox (unchecked by default, text editable) · spam protection (honeypot + per-IP throttle + optional captcha) · embed mode (inline / popup / slide-in).

**Submissions tab:** table + CSV export + a link to the created lead in the CRM.

**Then the block:** `Form (CRM)` shows a select of forms **by name** — this is your "whatever name we save shows up" requirement — plus fields-count and last-submission hints, and an empty state that links to `#/forms` when there are none.

---

## 6. Decisions I need (each has a default)

| # | Decision | Options | My default |
| --- | --- | --- | --- |
| D1 | Where the form builder lives | **(a)** CMS module writing into the CRM *(C)* · **(b)** CRM-side Forms service first *(B)* · **(c)** import WhatsApp Flow forms only *(A)* | **a** |
| D2 | Where a submission lands | Lead · Contact · **both, deduped by email then phone** | **both, deduped** |
| D3 | Consent | Require an **unchecked-by-default** WhatsApp opt-in checkbox on any block that can message, and store the consent record | **yes** (Meta requires it — see §10) |
| D4 | Block target | **38 offered** · or the full 45 (adds popup, sticky bar, audio, file, lightbox, team, timeline variants) | **38** |
| D5 | Popup / exit-intent / sticky bar | Include in M5 · **defer** | **defer** — one site-wide banner or nothing; popups need their own rules and QA |
| D6 | Multi-step forms | Include in v1 · **single-step v1, steps in v2** | **single-step v1** |

If you just say "approved, use your defaults", that is D1a · D2 both · D3 yes · D4 38 · D5 defer · D6 single-step, and I start.

---

## 7. What I would build, in order (finite contract)

**Module 5 — the palette (≈ first)**
1. 19 → 38 blocks with the chips above, counts computed, and the 12+7 new blocks drawn to the existing visual language (no new fonts, no new colours).
2. 23 → 32 sections, 5 → 7 templates.
3. `Form (CRM)` block backed by a forms source that returns **names**; empty state links to the form builder.
4. Every new block: inspector fields, style tokens, empty state, keyboard insert, drop-refusal copy, and a QA assertion.
5. `qa_builder.py` grows to cover 38 tiles, the new chips, and each CRM-native block's empty state.

**Module 6 — Forms**
1. `#/forms` list + `#/forms/{id}` builder (3 panels, settings, submissions).
2. Submit path: public endpoint contract in `BACKEND-PLAN.md`, honeypot + throttle + consent snapshot, lead/contact creation with `source = cms_form:<slug>`, then `trigger.lead.created`.
3. Block binding: pick by name → renders in the page → submission lands in the CRM.
4. Screenshot/state evidence per state: empty form, no forms, invalid field, spam-blocked, rate-limited, thank-you, redirect.

Nothing else changes. No new subsystem beyond forms, and no CRM repo edits — the CRM work is expressed as contracts in `BACKEND-PLAN.md`, as we have done for every module so far.

---

## 8. Backend contract additions (`BACKEND-PLAN.md` §7.20, to be written on approval)

```
GET    /v1/forms?siteId=                      → [{id, name, fields, status, submissions, updatedAt}]
POST   /v1/forms                              → create  (fields[] = CustomFieldDefinition-shaped)
GET    /v1/forms/{id}
PATCH  /v1/forms/{id}                         If-Match: revision
POST   /v1/forms/{id}:publish                 draft → live
GET    /v1/forms/{id}/submissions?cursor      → submissions with lead/contact link
POST   /public/forms/{id}/submit              unauth: honeypot, per-IP throttle, optional captcha,
                                              consent snapshot {ts, ip, page, textHash}
GET    /v1/custom-fields?entity=lead          → the field palette
GET    /v1/channels/whatsapp/cta              → {href, label, message, isFallback}
GET    /v1/widgets/{id}/embed                 → {scriptUrl, widgetId, allowedDomains}
GET    /v1/booking/event-types?siteId         → the Booking block's options
GET    /v1/products?siteId                    → the Program card
GET    /v1/surveys/{publicToken}              → the Survey block
POST   /public/consent                        → cookie/consent banner record
```

Submission side effects, in one transaction or an outbox: upsert contact → upsert lead (`source`, `custom_fields`, score) → write consent record → emit `lead.created` → optional `conversation.created` on the visitor's channel.

---

## 9. Risks I will design against

| Risk | Mitigation |
| --- | --- |
| **Duplicate leads** | Dedupe by lowercased email, then normalised phone (E.164), then `(name + company)`. Update the existing record, never silently create a second one; show "already in CRM" in the submissions table. |
| **Form spam** | Honeypot (as `marketing_leads` already does), per-IP + per-email throttle, optional captcha, and a hard cap per form per minute. Rejections are a *state*, with copy — not a silent 200. |
| **Consent / Meta policy** | Unchecked by default, channel named ("WhatsApp"), business named, message types named, record stored with timestamp + IP + page + text hash. Pre-checked = non-compliant (`§10` sources). |
| **Palette bloat** | 38 hard ceiling, 8 chips, every block earns its place by being *unbuildable from two existing blocks*. |
| **Accessibility of the new blocks** | Tabs/accordion/countdown/gallery each need keyboard + ARIA behaviour and a reduced-motion path; WCAG 2.2 AA is the bar (24×24 targets, focus not obscured). |
| **Builder performance at 38 blocks** | Tiles stay lazy (icons only), no per-tile data fetches; the forms list is one call, cached, refreshed on open. |
| **Two sources of truth for forms** | The CMS owns the definition, the CRM owns the record. No syncing of field *values* back into the form. |

---

## 10. Sources

- WhatsApp opt-in rules (unchecked by default, business name, channel, message types, stored proof) — [uptail](https://www.uptail.ai/blog/whatsapp-opt-in-strategies-for-businesses-how-to-build-a-compliant-contact-list), [wuseller](https://www.wuseller.com/whatsapp-business-knowledge-hub/whatsapp-opt-in-setup-for-websites-compliance-steps-that-prevent-api-restrictions/), [auditsocials](https://www.auditsocials.com/blog/whatsapp-business-api-click-to-whatsapp-ads-compliance-guide-2026), [pickyassist](https://pickyassist.com/blog/whatsapp-business-opt-in-guide/)
- WhatsApp Flow components (`TextInput`, `Dropdown`, `RadioButtonsGroup`, `CheckboxGroup`, `DatePicker`, `OptIn`, `Footer`…) — [Kapso: Flow JSON](https://docs.kapso.ai/docs/whatsapp/flows/flow-json), [Exotel](https://developer.exotel.com/docs/whatsapp-support/flows)
- Block library benchmarks — [Elementor widgets](https://www.pixelfish.com.au/blog/elementor-pro-widgets-a-detailed-guide-to-every-widget/), [Webflow Add panel](https://help.webflow.com/hc/en-us/articles/33961270096659-The-Add-panel), [Gutenberg blocks](https://plugintheme.net/blog/wordpress-gutenberg-block-editor-guide-2026), [HubSpot modules](https://www.boundev.ai/blog/hubspot-modules-guide-for-marketers)
- Landing-page conversion blocks (countdown, sticky bar, multi-step: +20–40 % completion) — [Instapage forms](https://instapage.com/en/features/forms), [builder comparison](https://marketingagency.sg/landing-page-builders-comparison/)
- WCAG 2.2 AA — [w3.org](https://www.w3.org/TR/WCAG22/)

---

**Nothing above is built.** Reply with D1–D6 (or "defaults") and I will start with Module 5, then Module 6.

---

## 11. How the interlink works — D1–D6 explained

Your motto is the design constraint: **the CMS captures, the CRM owns, automation reacts, the CMS shows the result back.** One spine, three entry points, every hop attributed.

```
visitor on a CMS page
   │  (site · page · block · UTM · referrer are attached at the source)
   ├── lead form block ──► POST /public/forms/{id}/submit ──┐
   ├── WhatsApp chat widget ─► /api/public/widget/session ──┤
   └── booking block ───────► /book/{slug} ─────────────────┤
                                                            ▼
                                    resolveIdentity()  ── phone, then email, then create
                                                            │
                        contact (+ custom_fields) ──► lead (source = cms_form:<slug>)
                                                            │
                                    consent record ──► workflow trigger.lead.created
                                                            │
                    WhatsApp template · SMS · email · task · deal · inbox thread
                                                            │
                                    counters back on the CMS block / page panel
```

### D1 — the form builder lives in the CRM-facing CMS *(default: a)*

**What it means.** The builder UI, the form definition and the submissions live in the CMS (our repo); the *record* it produces lives in the CRM. No CRM schema change is needed, nothing is blocked on the CRM roadmap.

**How it works.** You compose a form once (fields → `field_key`s that match `custom_field_definitions` for `lead`/`contact`). The block on the page holds only the form id. On submit, the public endpoint: validates → runs `resolveIdentity()` → upserts **contact** (phone first, then email, else create) → upserts **lead** (`source`, `custom_fields`, `status='new'`) → writes the **consent record** → emits `trigger.lead.created` → your existing workflow does the rest.

**Why not the other two.** (A) importing WhatsApp Flow forms renders fields on a page that have nowhere to submit — it looks finished and is not. (B) a CRM-side forms service is the right end state but it is a CRM change we cannot ship from here; **the definition we build maps 1:1 onto it**, so promoting it later is a migration, not a rewrite.

### D2 — a submission lands as contact **and** lead, deduped *(default: both)*

**What it means.** Nobody is lost, nobody is duplicated.

**How it works.** `resolveIdentity()` already does the deterministic match (phone, then email) with `auto_merge_on_phone` / `auto_merge_on_email` flags and AI fuzzy suggestions for the rest. New → create contact + lead. Existing → attach the new values to the same contact, and either update the open lead or create one with `source` naming the page. The submissions table tells the truth: *"new"* vs *"matched Rhea Kulkarni · lead #482"*.

**Why both.** A chat creates a contact but not always a lead; a form should create both, or sales never sees it in the pipeline.

### D3 — unchecked WhatsApp opt-in + stored consent *(default: yes)*

**What it means.** Any block that can message someone carries a checkbox, **off by default**, naming the business, WhatsApp, and the message types. Ticking it writes a consent record (timestamp, IP, page, text hash) that the automation can require as a condition.

**How it works.** The record lands in the CRM's existing consent storage and the workflow gate reads it before `action.whatsapp.send_template`. Meta treats a pre-checked box as non-compliant; a checkbox that is pre-ticked would put the customer's WhatsApp number quality at risk — that is a business risk, not a UI preference.

### D4 — 38 offered blocks *(default)*

**What it means.** 19 today (a one-page palette) → 38 (a site palette): 12 generic + 7 CRM-native.

**How it works.** Every block declares its group, its defaults, its inspector fields and its refusal rules in the registry; counts are computed, never typed, and a QA assertion pins the number so the palette cannot silently drift. The 7 CRM-native blocks are the interlink made visible: WhatsApp CTA, Chat Launcher, Booking, Survey, Program Card, Contact Card, Form-by-name.

### D5 — no popups, no exit-intent, no sticky bars in this round *(default: defer)*

**What it means.** Conversion gimmicks are deferred; one site-wide announcement banner is allowed.

**How it works.** A popup is a second page lifecycle (focus trap, scroll lock, frequency cap, dismiss persistence, SEO/CLS impact). It deserves its own module with its own states, not a corner of the palette.

### D6 — single-step forms in v1, multi-step in v2 *(default)*

**What it means.** One screen per form submission; "add step" exists in the builder but is disabled with the reason, exactly like the Advanced inspector.

**How it works.** Multi-step needs per-step validation, back-navigation state, partial-save and abandonment tracking. The data model already allows it (`steps[]`), so v2 is a UI release, not a migration.

### What already exists versus what I build

| Capability | Status in the CRM today | What the CMS adds |
| --- | --- | --- |
| Chat collects name / email / phone | **Built.** `/api/public/widget/session` *requires* `visitorName`, `visitorEmail`, `visitorPhone` ("the visitor must identify themselves before chatting"), then `identifyVisitor()` matches by phone → email → creates the contact and links `livechat_visitors.contact_id` | The launcher block + the embed, with site/page/UTM passed in, and the counters shown back in the editor |
| Identity matching / de-dup | **Built.** `resolveIdentity()`: deterministic phone/email, auto-merge flags, AI suggestions | Called by the form submit path too, so forms and chats converge on one record |
| Automation on capture | **Built.** `trigger.lead.created` already has a **source filter** ("e.g. web_form"), plus `whatsapp.send_template`, `sms.send`, `email.send`, `omnichannel.send`, `crm.handoff` | The `source` values we emit, and the field→custom-field mapping |
| Consent storage | **Tables exist** (`consent_records`, `cookie_consents`), nothing writes them from a lead form | The unchecked checkbox and the record |
| **Web form submission path** | **Missing** — no `forms` table, no public submit endpoint | Module 5: definition, builder, endpoint, submissions |
| Attribution | partial (`page`, `referrer` on the widget session) | `siteId`, `pageId`, `blockId`, UTM on every submission and session |
| Result visible inside the CMS | none | Read-only counters on the block: submissions, chats, leads |

### Revised build order (proposed, because of your motto)

The spine matters more than the palette, so I would flip the order:

1. **Module 5 — Forms & lead capture (the spine).** Forms list + 3-panel builder + public submit + consent + `source` attribution + submissions table + the `Form (CRM)` block that lists forms by name. Two CRM-native blocks ship with it because they complete the story: Form and WhatsApp CTA.
2. **Module 6 — Interlink surfaces.** An Integrations panel showing what the CRM has connected (chat widgets, WhatsApp CTA token, booking event types, forms) with an honest disconnected state, plus a "captured on this page" read-only panel in the builder.
3. **Module 7 — Palette 19 → 38.** The 12 generic blocks and the remaining 5 CRM-native ones, with sections and templates.

Approving that order means the first thing you can demo is exactly your motto: fill a form on a page, watch a lead appear in the CRM with the automation running.

**Four confirmations I need before writing code:** the order above (spine → surfaces → palette), D2 = contact + lead, D3 = consent required, D4 = 38.
