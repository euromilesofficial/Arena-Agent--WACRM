# Module 5 — Block Library · gap & decision review

**Reviewed** your specification v1.0 (31 sections, 14 Nov 2026) · 11 reference mocks · the shipped codebase at `725c9da`
**Method** every claim below is checked against a file line or a mock pixel, not against memory
**Status** decisions taken and built — see `MODULE-5-DECISIONS.md`. This review is kept as the record of what was wrong with the specification, not as a to-do list.

**Verdict** the spec is buildable, but **nine decisions are open and three of them are blocking** — the headline numbers, the taxonomy, and the fact that Saved Templates does not exist as data anywhere yet. Nothing was built. Findings first, as you asked.

---

## 1. Mock inventory

All 11 files read. Every PNG is **1672 × 941** (16:9, exactly the app's own viewport), now stored as WebP q86 in `uploads/` (168–193 kB each, 2.1 MB total).

| # | File | What it actually shows |
| --- | --- | --- |
| 0 | `WACRM Block Library Dashboard.webp` | **All** view · card menu open · section inspector (Overview) |
| 1 | `…08_05_53 AM-1` | identical to #0 without the menu — a clean state shot |
| 2 | `…08_05_56 AM-2` | **Native Blocks** view · grouped, drag grips, Compatibility rail, native inspector (`Overview·Properties·Compatibility`) |
| 3 | `…08_05_58 AM-3` | **Section Templates** view (`Section Templates (12)`) |
| 4 | `…08_05_59 AM-4` | **Saved Templates** view (`Saved Templates (24)`) · Owner + Updated filters · pagination · richer inspector |
| 5 | `…08_06_00 AM-5` | Section Templates filtered to **Hero** (`Templates (6) — Hero`) |
| 6 | `…08_06_02 AM-6` | Section Templates filtered to **Features** — a different tile family (Stats Strip, Benefits Grid, Icon Features, Destination Cards, Comparison Table, Trust Highlights) |
| 7 | `…08_06_03 AM-7` | Section Templates filtered to **CTA** — includes sticky-bar tiles and one skeleton card |
| 8 | `…08_06_05 AM-8` | Inspector **Overview**: Summary · Supported Breakpoints · Component Summary · Usage |
| 9 | `…08_06_06 AM-9` | Inspector **Structure**: composition tree with per-row type tags, 3 summary tiles |
| 10 | `…08_06_08 AM-10` | Inspector **Usage**: 4 mini-KPIs + usage table with `Open Page ↗` / `View Placement ↗` |

**Not shown anywhere in the set:** the `Insert into Page` modal, `Create Template`, `Import Template`, delete confirm, list view, and every error / empty / denied / conflict state. Those are the states the module is judged on (§25 of the spec), and they will be built from the written contract, not from a picture.

---

## 2. Findings

Severity: **Blocker** = cannot build correctly without a decision · **High** = will produce a wrong or dead surface · **Medium** = visible inconsistency · **Low** = polish.
"Phase-1" = must exist in this module's first delivery.

### A — Numbers that cannot all be true

**A1 · Blocker · Phase-1: yes** — *There are three different "20"s.*
Evidence: your canonical list (spec §20) is Text · Heading · List · Table · Quote · Image · Video · Button · Alert · Separator · Container · Columns · Hero · **Feature Grid** · **Pricing** · Testimonials · CTA · **Lead Form** · FAQ · **Footer**. The mock's 20 tiles (AM-2) are Text · Heading · Rich Text · Image · Video · Container · Columns · Divider · **Spacer** · Table · Button · Form · CTA Section · **Accordion** · List · Quote · Alert · Testimonials · **Stats Strip** · **Icon Grid** — no Hero, no Pricing, no Footer, and four tiles that are *variants*, not types. The code registry (`src/lib/builder.ts`) has 20 keys but only **19 offered** — `ARCHETYPE_COUNT = 19` (line 472), `Footer` is `offered: false`.
Recommendation: **type = 20 (the spec's list, which maps 1:1 onto the registry)**, **tile = type × variant**, variants are never counted as types. Rich Text → `text/rich`; Spacer → `divider/spacer`; Accordion → `faq/accordion`; Stats Strip + Icon Grid → `featureGrid/*`. The registry already carries 74 named variant options across the 20 types, so this is data we have, not data we invent. Fix the code so all 20 are offered, Footer included, with a placement restriction (it inserts into the page's footer slot, not the body).
Acceptance test: `ARCHETYPE_COUNT === 20`, `new Set(tiles.map(t => t.type)).size === 20`, and for every tile `REGISTRY[tile.type].variants` contains `tile.variant`.

**A2 · Blocker · Phase-1: yes** — *Section Templates: 12 in the spec and the mock, 23 in the code.*
Evidence: the code ships **23** presets (Hero 5, Content 6, Features 6, CTA 6 — `builder.ts:509`), the builder palette renders 23, and `qa_builder.py:98` asserts `23`. The spec's KPI and three mock frames say **12**, and the rail facets say 12 / 0 / 0 in one frame and 12 / 6 / 4 in another.
Recommendation: **keep all 23** — you have said twice that the library is too small; cutting 23 → 12 to match a placeholder number would be the wrong direction. The KPI becomes computed (23), and the spec's "12" is treated as a placeholder.
Acceptance test: KPI text == `SECTION_PRESETS.length`; grid row count for `Section Templates / All` == 23.

**A3 · High · Phase-1: yes** — *Saved Templates: 5 in the KPI, 24 in the view header, 18 + 8 in the facets.*
Evidence: AM-4's KPI card reads 5, the same screen's grid header reads `Saved Templates (24)`, and the Owner facets read Workspace (18) / This Site (8). 18 + 8 = 26 ≠ 24 ≠ 5.
Recommendation: one seeded set of **5** (KPI), and the header/facets computed from it, so all three agree by construction. If you want the Saved view to feel lived-in, seed 12 and let the KPI say 12 — but one number, one source.
Acceptance test: header count == facet sum == rows rendered == KPI.

**A4 · High · Phase-1: yes** — *Facets do not sum to the view count in any frame.* All view: `Templates (6)` with facets Built-in (20) / Workspace (4) / This Site (3). Sections view: 12 with 12 / 0 / 0. Features: 6 with 20 / 4 / 3.
Recommendation: facets are counts of the **unfiltered view result set**, and the header is the **filtered** count. The invariant goes into QA (§19 of the spec).
Acceptance test: for each view and each chip, `sum(scopeFacets) == viewTotal` and `headerCount == renderedRows`.

**A5 · High · Phase-1: yes** — *The same template has three different usage numbers.* `Used on 2 pages` (AM-1, AM-8), `Used in 8 pages` (AM-3), and the Usage tab says `3 Total Pages / 3 Total Placements` (AM-10) — while AM-10's own table lists only 3 rows, one of which (`Partner Portal Hero`) belongs to the *Partner Portal* site but is labelled `EuroMiles Main`.
Recommendation: one placement index feeds the card badge, the Overview line and the Usage tab; the badge reads `Used on N pages` from that index and nothing else. Site column comes from the placement, not from the header selector.
Acceptance test: badge, Overview and Usage tab read from one function; a seeded template with 3 placements shows 3 in all three places.

**A6 · High · Phase-1: yes** — *"In Use 3" has no definition.* AM-10 shows 3 placements for a single template, so "In Use" cannot mean placements. It also cannot mean pages.
Recommendation: **In Use = templates with ≥ 1 placement** (label kept, definition written in the KPI tooltip). With 23 sections + 5 saved seeded across 3 sites, the value is computed and will not be 3 — that is fine and honest.
Acceptance test: `inUseCount === items.filter(i => placements(i).length > 0).length`.

**A7 · Medium · Phase-1: yes** — *Every timestamp in the mocks is January 2025.* Today is 13 Nov 2026; a library whose newest item is 22 months old reads dead.
Recommendation: seed timestamps relative to `now` (2 h / 3 d / 11 d / 26 d ago), formatted `Jan 18, 2025, 10:24 AM` style as the mocks do.
Acceptance test: every seeded `updatedAt ∈ (now − 30 d, now]`.

**A8 · Low · Phase-1: yes** — *Cross-screen contradiction:* the library KPI says 20 Native Blocks while the Visual Builder palette chip says `All 19` (`qa_builder.py:76-79`).
Recommendation: both screens import one constant; QA asserts equality across screens, not per screen.
Acceptance test: library KPI text == builder palette chip count.

### B — Taxonomy collisions

**B1 · Blocker · Phase-1: yes** — *Four competing groupings, none of them the same.*
Evidence:

| Source | Grouping |
| --- | --- |
| Your spec §20 totals | Content 10 · Media 2 · Layout 5 · Form 3 |
| Mock AM-2 group headers | Content 5 · Layout 5 · Interactive 4 · Engagement 6 |
| Code registry `BlockGroup` | Content 9 · Media 2 · Actions 2 · Layout 5 · Form & Engagement 2 |
| Code chips (`CHIPS`) | All · Content · Media · Layout · Form (Actions + Form merged) |

The mock files Table under Layout, Form and CTA under Interactive, List/Testimonials/Stats under Engagement; the code files Table under Content, Button/Alert under Actions.
Recommendation: **adopt your spec's four names exactly**, and get there by re-filing two registry entries — `button → Form`, `alert → Content`. That reproduces your totals precisely (10 / 2 / 5 / 3 = 20) with **zero** new types, zero new renderers and no schema change. Mock group names (`Interactive`, `Engagement`) are dropped; the mock's *group header treatment* (icon + name + count + one-line hint) is kept.
Acceptance test: `categoryCounts()` deep-equals `{Content:10, Media:2, Layout:5, Form:3}`; no type appears under two categories; builder palette chips show the same four.

**B2 · High · Phase-1: yes** — *The category chips are view-scoped but the All view's chips are undefined.* The All view shows section categories (`Hero · Features · Content · CTA · Forms`), which are meaningless for native blocks; the native view shows the four block categories; the sections view shows the section categories; the saved view shows `Hero · CTA · Forms · Testimonials · Other`.
Recommendation: chips are derived **per view** — All shows the union with counts (a chip is only rendered if its count in that view is > 0), Native shows the four block categories, Sections/Saved show section categories. `Forms` is a real category only for sections/saved, so it must not be listed in the native view.
Acceptance test: switching views re-derives the chip row; no chip with a zero count is rendered (except to keep layout stability, in which case it is `disabled` with `0`).

**B3 · Medium · Phase-1: yes** — *The `Forms` chip may be empty.* Section presets are categorised Hero / Content / Features / CTA only (`SECTION_CATEGORIES`), yet the mock shows a `Forms` chip and a CTA card named `Lead Form CTA`.
Recommendation: add `Forms` as a real 5th section category and re-file the two lead-form presets (`sec-cta-form` "Lead Form", `sec-cta-split` "Split CTA with Form") into it — 23 → Hero 5 · Content 6 · Features 6 · CTA 4 · Forms 2.
Acceptance test: `sectionCount("Forms") === 2`, and `sum(all categories) === 23`.

**B4 · Low · Phase-1: yes** — *Card titles are inconsistent:* `Hero — Study Abroad` (em dash, AM-1/3/4/5/10), `Hero – Study Abroad` (en dash, code), `Hero - Study Abroad` (hyphen, AM-6/8).
Recommendation: `Category — Name` with an em dash, generated, never typed into the name field.
Acceptance test: a single `titleOf()` formatter; no literal dash in preset names.

### C — Missing data entities

**C1 · Blocker · Phase-1: yes** — *Saved Templates does not exist.*
Evidence: no `SavedTemplate`, `saved-section` or `placement` symbol exists anywhere in `src/` (grep, 0 hits). `CmsPage` stores `blocks: number` (`cms-pages.ts:18-50`) — a count, not identities. Nothing can currently be "saved", "owned", "duplicated" or "used".
Recommendation: add one store — `savedTemplates` (id, name, description, category, scope workspaced|site, siteId, owner, createdAt, updatedAt, blockTree, sourcePageId?, sourceSectionId?) — plus three flows: save-from-page-section (spec §15), duplicate, delete. Seed 5 from real drafts of `site_main`, not from invented JSON.
Acceptance test: create from a page section → appears in Saved view, KPI +1, opening it shows the same block tree as the source section.

**C2 · Blocker · Phase-1: yes** — *Placements do not exist, so §13 Usage cannot be built as drawn.*
Evidence: `Used on N pages`, the Usage table and `View Placement ↗` need per-page, per-section identity; the page record has only a block count.
Recommendation: a derived **placement index**: on read, scan each draft (`BuilderAPI.getDraft`) and match section signatures (type sequence + preset key) against library items; on insert, record an explicit `placement {templateId, siteId, pageId, sectionIndex, materializedAt}` so the count is exact for anything inserted (and best-effort for seeded content). Both feed one function.
Acceptance test: insert a section into a page → its badge increments by 1 and the Usage table lists that page with the right status; delete the block in the builder → the badge decrements.

**C3 · High · Phase-1: yes** — *Ownership model is 3 scopes but only 2 dimensions are shown.* Cards say `Built-in` / `Workspace` / `This Site`; the inspector says `Owner: Workspace` and `Created by Aranya K.`; the seeded personas exist nowhere.
Recommendation: three scopes — **Built-in** (global, immutable) · **Workspace** (workspace-owned saved template) · **This Site** (bound to one `siteId`). `owner` and `createdBy` come from the existing demo identity set; no new personas.
Acceptance test: facet counts per scope sum to the view total; a site-scoped template disappears when the header site selector changes.

**C4 · Medium · Phase-1: yes** — *"Recently Updated" is the default sort, but built-ins have no timestamps.* A static registry cannot be "updated".
Recommendation: every catalogue entry carries `releasedAt` (built-ins: library release dates, deterministic and in the past) and `updatedAt` (saved only); the sort uses `updatedAt ?? releasedAt`.
Acceptance test: the first card under Recently Updated is the newest of the two fields; sort is stable on ties (name A→Z).

**C5 · Medium · Phase-2: no** — *The Saved inspector's breakdown mixes dimensions:* `Total usage 12 pages`, then `EuroMiles Main (9)` and `Study Abroad (3)` — but Study Abroad is a page *inside* EuroMiles Main, so 9 + 3 ≠ 12 in the way a reader assumes.
Recommendation: two levels only — site → page list, with the page count rolled up per site.
Acceptance test: `sum(perSite pages) === totalPages`.

### D — Interaction contradictions

**D1 · Blocker · Phase-1: yes** — *The native cards carry drag grips (⠿, AM-2) but the spec says the insert modal is the only mutation path.* A grip that does nothing is a lie; a grip that drags contradicts §14.
Recommendation: **no drag in this module.** The grip is removed; the card's affordances are `Preview`, `Insert`, `…`. Dragging stays a builder gesture.
Acceptance test: no `draggable` handler on any library card; `Insert` is the only path that mutates a page.

**D2 · High · Phase-1: yes** — *Four verbs for one action:* `Insert` (cards), `Insert Block` (native inspector), `Insert into Page` (section inspector), `Use Template` (saved inspector), plus `Duplicate` on *some* saved cards.
Recommendation: card footer = `Insert` everywhere; inspector primary = `Insert into Page` for all three types (opening the same modal); saved-only `Duplicate` moves into the `…` menu.
Acceptance test: a string audit finds exactly two insert labels in the module, and both open the same modal.

**D3 · High · Phase-1: yes** — *The card menu has two entries that do the same thing:* `Duplicate to My Templates` **and** `Save as Template` (AM-0). "My Templates" is not a view that exists in the spec (it is called Saved Templates), and for a built-in both entries produce the same copy.
Recommendation: one entry — `Duplicate to Saved Templates`. `Create Template` (header, §15) remains the only "save from a page" path.
Acceptance test: menu has exactly 4 items; no menu string contains "My Templates".

**D4 · High · Phase-1: yes** — *`Delete Template` is disabled on built-ins (right) but there is no confirm, no reference check and no rule for the copies already on pages.*
Recommendation: delete = confirm modal → if placements exist, refuse and list them (`Used in 3 pages → open`); if none, delete the library entry and **leave every materialized page copy untouched** (spec §18).
Acceptance test: deleting a template used on 2 pages is refused with both pages named; after force-delete-by-0-placements the pages' block trees are byte-identical.

**D5 · Medium · Phase-1: yes** — *Selection is drawn two different ways:* AM-8/9/10 put a purple check circle on the selected card, AM-0/1/2/3 don't.
Recommendation: selected = purple 2 px border **and** the check disc, always; hovering never mimics it.
Acceptance test: exactly one card carries `aria-selected="true"`; it has both the border class and the check element.

**D6 · Medium · Phase-1: yes** — *What the right column shows when nothing is selected is undefined,* and closing it (×) must not reflow the grid.
Recommendation: closing keeps the 3-column grid and shows a slim "inspector closed" rail with a reopen affordance; the empty selection state inside an open inspector says `Select a template to see its structure, usage and actions`.
Acceptance test: grid column count is identical open vs closed; the empty state has a screenshot.

**D7 · Medium · Phase-1: yes** — *Loading is inconsistent:* one card in AM-4 and one in AM-7 is a grey skeleton while its neighbours are painted.
Recommendation: per-view skeleton grid on first paint (9 cards), per-thumbnail shimmer only for slow images, and a `Refreshing…` pill on filter changes instead of a wipe.
Acceptance test: `mode.fail`/slow-network state produces the skeleton grid, not a half-painted one.

**D8 · Medium · Phase-1: yes** — *Pagination exists only in the Saved view* (`Showing 1–6 of 24`, four pages), while All / Native / Sections are unpaginated.
Recommendation: Saved paginates 12 per page; the grid view of the other three scrolls with a sticky grid header; the list view paginates 25 per page for all four (a table without pagination at 23+ rows is worse than a grid).
Acceptance test: page-size constants exported and asserted; changing view resets to page 1.

**D9 · Low · Phase-1: yes** — *Card body click is undefined* (the only explicit affordance is `…`).
Recommendation: body click = select (inspector); double-click = open `Insert into Page`; `Preview` = full-size preview overlay. Stated in the card's `title` attribute.
Acceptance test: keyboard `Enter` on a card = select; a11y note in the help popover.

### E — States no mock covers

**E1 · Blocker · Phase-1: yes** — *The insert modal — the only mutation path — has no design.*
Recommendation: build it exactly as spec §14 (site → page → position → dependencies → confirm) with all six outcomes: 200 + toast + `Open page in builder →`, 403, 409 (reload / keep mine), 413 page block limit (`PAGE_TOO_LARGE` copy already exists at `builder-db.ts:151`), 422 dependency, 503.
Acceptance test: six scripted runs, one screenshot each; after the 200 the target page's `revision` is +1 and the block is present at the chosen index.

**E2 · High · Phase-1: yes** — *Create Template has no design.* Site → page → section → meta → save, with the section rendered as a live preview. Refuse: empty section, duplicate name in scope, name that is only whitespace.
**E3 · High · Phase-1: yes** — *Import Template has no design and no format.* Ship a documented v1 JSON interchange with a validator that rejects unknown types, unknown props, and anything that would not schema-validate; errors listed per line. Until that validator exists the control is disabled with a reason (spec §16).
**E4 · High · Phase-1: yes** — *List view has no mock.* Build it as a real table: thumbnail · name · category · scope · blocks · usage · updated · `…`. Same row actions as the card.
**E5 · High · Phase-1: yes** — *Empty / no-results / error / denied are unbuilt.* `BuilderAPI.mode.emptyLibrary` and `mode.fail` already exist (`builder-db.ts:154`) and the module must wire to them.
**E6 · Medium · Phase-1: yes** — *No success feedback is drawn:* insert, duplicate, import, delete all need a toast with an undo where the action is reversible.
**E7 · Medium · Phase-1: yes** — *No keyboard path is drawn:* the header search advertises `⌘K`, so it must actually focus; arrow keys move between cards; `Esc` closes the inspector; modals trap focus.

### F — The dependency model is named but never defined

**F1 · Blocker · Phase-1: yes** — spec §14 says "dependency validation" and the module has no schema for it.
Recommendation: every catalogue entry declares `requires[]` and `emits[]` — `form` (a CRM form id), `asset` (image/video), `themeToken`, `planCapacity`. A requirement that is unmet renders the card as insertable-but-blocked with the reason and a link, never a silently broken insert. This is the same `emits/requires` contract already agreed as decision D4 in `INTERLINK-PLAN.md`, which was never implemented in the registry — Module 5 is where it must land.
Acceptance test: a Lead Form section with no bound form opens the modal with the confirm disabled and `Bind a form →` linking to Forms & Leads.

**F2 · High · Phase-1: yes** — *Lead Form cards show hardcoded fields.* Your standing rule: forms are imported from the CRM by name.
Recommendation: the Lead Form archetype binds `formId`; the card preview draws from the bound form's field list (or the placeholder field set when nothing is bound); insertion carries the binding.
Acceptance test: change the bound form in the builder → the library thumbnail's field list changes.

**F3 · Medium · Phase-1: yes** — *Consent is missing from the conversion tiles.* Meta requires an unticked, explicit, channel-named opt-in on anything that can message, and several CTA tiles (`Contact Advisor CTA`, `Talk to an Advisor`) imply a WhatsApp conversation.
Recommendation: the library never *renders* a form submission path, so it shows the consent line only inside previews, sourced from the form contract — never a hardcoded checkbox in a template.

### G — Authority, scope, safety

**G1 · High · Phase-1: yes** — *No role states.* The store already models `role` (`store.tsx:17`), but every mock shows an Owner's full controls.
Recommendation: Editor+ for Create/Import/Duplicate, Manager+ for Delete, all disabled-with-reason for Viewer.
**G2 · High · Phase-1: yes** — *The site selector's effect is undefined.* `site_main` EuroMiles Main is `published`; `site_portal` is a `draft` site (`data.ts:126-142`).
Recommendation: the selector scopes **This Site** items, the usage column and the default site in the insert modal; Built-in stays global; switching sites keeps the view and drops filters that no longer resolve.
**G3 · Medium · Phase-1: yes** — *Insert-time conflict.* The builder already has a conflict path and `mode.conflict`; the library must reuse it (`expectRevision`) rather than grow a second one.
**G4 · Medium · Phase-1: yes** — *Undo.* The insert must be one undo entry in the builder's history (`snapshot()` + revisions), not one per block.
**G5 · Medium · Phase-1: yes** — *Publish boundary.* Inserting into a published page sets `hasChanges`, bumps `revision`, and leaves `live_release_id` alone; nothing in this module publishes.

### H — Content the mocks introduce that your own rules exclude

**H1 · High · Phase-1: yes** — *`Sticky Bottom CTA` (AM-7) and `Sticky Advisor Banner` (AM-4) are sticky bars,* which is exactly what D5 deferred ("no popups, no exit-intent, no sticky bars in this round").
Recommendation: drop both tiles from Module 5 and record them as deferred with the rest. If you want them, say so and they ship as a separate, clearly-labelled `Sticky` category with its own rules — but not silently inside CTA.
**H2 · Medium · Phase-1: yes** — *The mock's section names do not match the shipped presets at all:* mock CTA group = Lead Form CTA, Simple CTA Banner, Split CTA, Contact Advisor CTA, Enrollment CTA, Sticky Bottom CTA; code = CTA Banner, Lead Form, Button Pair, Deadline Alert, Split CTA with Form, Boxed CTA.
Recommendation: keep the shipped names (they are already referenced by the builder and by `qa_builder.py`), and adopt the mock's *thumbnails* as the visual target. Renaming 23 presets to chase a placeholder is churn with no product value.
**H3 · Low · Phase-1: yes** — *Confirmed:* no `Code`/HTML block appears anywhere, and `Embed` is not a separate type (YouTube lives inside Video). Both match the spec's prohibitions — no action, recorded so it is not re-litigated.

### I — Spec hygiene

**I1 · High · Phase-1: yes** — *The spec cites two files that do not exist:* `CLAUDE_PROPOSAL.md` and `MODULE_4_VISUAL_BUILDER_SPECIFICATION.md`. The repo's actual Module 4 artefacts are `MODULE-4-REVIEW.md` and `AI-BUILDER-SPEC.md`.
Recommendation: correct the references (I have mapped them in §20/§28 of the persisted spec). Anything that was only in those two files is not binding, because nobody has ever read them.
**I2 · Medium · Phase-1: yes** — *§28's mock→row table could not be checked against your text* (it did not survive the paste intact). I rebuilt the mapping from the images themselves — table in `MODULE-5-BLOCK-LIBRARY-SPEC.md` §28. Confirm or correct it.
**I3 · Medium · Phase-1: yes** — *There is already a pre-spec `MODULE-5-REVIEW.md` in the repo (32.7 kB)* whose §4 default `D4` proposed **19 → 38 offered blocks** in 8 chips. That was never approved, and it contradicts the new canonical 20.
Recommendation: the new spec **supersedes** it for the catalogue scope; the 38-block expansion becomes a separate deferred item (it is a builder-palette change, not a library-screen change). I will stamp `MODULE-5-REVIEW.md` as superseded rather than delete it, so the reasoning survives.
**I4 · Low · Phase-1: no** — the spec's own section count (31) and the numbering in your paste do not line up one-to-one with the headings I could recover; the persisted copy is numbered 0–31 and is the working authority.

---

## 3. Decisions I need

Each has a default. Say "approved, use your defaults" and I build against the right-hand column.

| # | Decision | Options | Default |
| --- | --- | --- | --- |
| **M5-1** | What the "20" counts | **(a)** 20 types, variants shown as tiles · (b) 20 tiles, variants accepted as types · (c) keep 19 | **a** |
| **M5-2** | Section-template count | **(a)** keep all 23 · (b) trim to the spec's 12 | **a** |
| **M5-3** | Saved-template seed size | **(a)** 5 (spec KPI) · (b)** 12 (feels lived-in) | **5**, header computed |
| **M5-4** | Category taxonomy | **(a)** your four: Content 10 · Media 2 · Layout 5 · Form 3 (re-file Button→Form, Alert→Content) · (b) the code's five registry groups · (c) the mock's Content/Layout/Interactive/Engagement | **a** |
| **M5-5** | Sticky bars | **(a)** drop `Sticky Bottom CTA`, `Sticky Advisor Banner` · (b) ship them with a `Sticky` category | **a** (D5 stands) |
| **M5-6** | Saved Templates | **(a)** build the entity + placement index + save-from-section + duplicate + delete · (b) show it read-only | **a** |
| **M5-7** | Insert verbs | **(a)** `Insert` on cards, `Insert into Page` in every inspector · (b) keep the mocks' four labels | **a** |
| **M5-8** | Drag grips | **(a)** remove — modal is the only path · (b) keep as decorative | **a** |
| **M5-9** | Import Template | **(a)** ship the v1 JSON interchange + validator · (b) ship disabled-with-reason and defer the format to Module 7 | **b** (a is a real subsystem; b keeps this module honest) |
| **M5-10** | Role gating | **(a)** Editor+ create/import, Manager+ delete, Viewer read-only · (b) all-owner | **a** |
| **M5-11** | `emits`/`requires` | **(a)** implement now on every catalogue entry · (b) later | **a** — the insert modal is worthless without it |
| **M5-12** | Old `MODULE-5-REVIEW.md` | **(a)** stamp superseded, keep · (b) delete | **a** |

---

## 4. What I build once you approve

**One screen, one store, one modal.**

| File | Content | Est. |
| --- | --- | --- |
| `src/lib/library-db.ts` | catalogue assembly (20 types × variants, 23 sections, 5 saved), taxonomy re-filing, filters/sort/search, placement index, `emits/requires`, save/duplicate/delete, `insertIntoPage`, latency + `mode` toggles | ~520 lines |
| `src/views/Library.tsx` | header, KPI strip, rail, grid header, grid, list, footer, view/selection state | ~700 lines |
| `src/components/library/Card.tsx` | card, badges, menu, selection, skeleton | ~180 lines |
| `src/components/library/Inspector.tsx` | 3 tab sets, preview, structure tree, usage table, footer | ~420 lines |
| `src/components/library/Modals.tsx` | Insert into Page, Create Template, Import, Delete, Preview overlay | ~480 lines |
| `src/lib/library-db.ts` taxonomy touch on `builder.ts` | Button→Form, Alert→Content, Footer offered, `Forms` section category | ~30 lines edited |
| styles | all of it, in the existing token system | ~600 lines |
| `qa_library.py` | new suite | ~60 assertions |

**QA plan** — counts asserted against the registry, not against text; facet/header/KPI invariant per view; all four views; all three inspector tab sets; six insert outcomes; create/duplicate/delete; viewer role; 12 states; keyboard; and a regression run of the existing 9 suites (475 assertions) so Module 4's builder palette is not disturbed.

**Then, unprompted:** rebuild `WACRM-CMS.html` + `wacrm-app.zip`, refresh `HANDOVER.md`, and `bash checkpoint.sh "feat(module-5): desktop block library" module-5-complete`.

---

## 5. What changed on disk in this review

- `MODULE-5-BLOCK-LIBRARY-SPEC.md` — your spec, persisted (you cannot upload `.md`; chat is not a filing system)
- `MODULE-5-GAP-REVIEW.md` — this document
- `uploads/` — 11 new mocks, PNG → WebP q86 (**2.1 MB** for 11 full-resolution 1672×941 frames), `MANIFEST.sha256` regenerated (29 files), README updated

No application code was changed. The build starts after your decisions.
