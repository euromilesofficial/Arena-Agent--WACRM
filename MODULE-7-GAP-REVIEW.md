# Module 7 · Layouts & Templates — gap review, corrections and build contract

**Reviewed:** 13 Nov 2026 · spec `MODULE-7-SPEC.md` (v1.0, 25 sections, 978 lines) ·
6 reference mocks (`uploads/`) · evidence `MODULE-7-BENCHMARK.md` (9 systems) ·
codebase at `949b66f`.

**Verdict.** The spec is structurally sound and gets the two hardest decisions right:
drafts never reach production without a release, and page templates *copy* rather than
*inherit*. It is not ready to build as written, for one structural reason and three
missing layers:

| # | Problem | Consequence if we build as written |
|---|---|---|
| 1 | Header/footer are simultaneously "shared regions" and a per-layout dropdown | Two layouts can disagree about "the same" header; the edit surface is ambiguous; usage counts become fiction |
| 2 | No **slot policy** — nothing restricts what a layout's content slot may contain | "Master layout" degrades into "a page with a different footer" |
| 3 | No **seed content** in the slot | Every page created from a layout starts blank; the layout saves nobody time |
| 4 | No **limits**, and four count columns with four different definitions | Scale failures and numbers nobody can defend |

Everything else is precision work: 18 more findings below, each with a decision, all of
them implementable inside this build.

**Classification used below:** 🔴 must fix before build · 🟠 fix in build · 🟡 decide + document · 🔵 deferred on purpose.

---

## 1 · Findings and decisions

### F1 · 🔴 Chrome is not an object — the same header can drift per layout

**Evidence.** Spec §2.1 says header/footer are "editable shared regions or references to
reusable header/footer variants"; §10.1 then puts *Header* and *Footer* **dropdowns on each
layout**. Both cannot be true. Our mockups show the resolution the industry uses:
`Global (Locked)` chips with *"This is a global region. Changes will update all assigned
pages."* Every comparable system makes chrome a first-class artefact — Shopify **section
groups**, Sitecore SXA **partial designs**, HubSpot **global groups**, WordPress
**template parts**, AEM **locked components in structure mode** (benchmark §1–§3).

**Decision.** Introduce `SharedRegion` (§4 data model): site-level objects of kind
`header | footer | announcement`, each with **variants**. A layout stores
`header: { regionId, variantId, visible }` — a *typed reference*, never a copy.

- Editing a variant opens the **Shared Region editor** (M7 drawer, reusing M4 blocks) for
  footer/announcement; for header navigation it deep-links to **M8 Menus & Navigation**
  once that exists, and shows a "managed in Menus & Navigation" chip until then.
- The Structure row shows `Shared · used by N layouts · M pages`.
- The dropdown becomes **two controls**: variant select **+** a `Show this region` switch
  (see F9). "No Header" disappears as a menu item — it was a suppression wearing a
  variant's clothes.

**Why it matters here.** Our app already has a *typed* `page.layout` string and a static
`<Master>` header/footer inside the M4 canvas. Without F1, M7 would make that static chrome
configurable but still duplicated per layout, and the "42 pages affected" warning would be
a lie the first time two layouts picked different variants.

---

### F2 · 🔴 No slot policy — a layout cannot defend its own content area

**Evidence.** Benchmark §4. AEM: container *policy* → **Allowed Components**, *Default
Components*, *Responsive Settings* — "only the selected components in the policy will be
able to be used by page authors for that specific container". Webflow shipped **slot
restrictions** on 28 Aug 2026 for exactly this reason. WordPress has `allowedBlocks`.
Our spec has a typed slot and 20 registered blocks and no relationship between them.

**Decision.** `slot.policy = { allow: BlockType[], deny: BlockType[], maxBlocks: number }`,
editable in **Structure → Main Content Slot → Allowed blocks** as a chip picker grouped by
M5 category (Content · Media · Layout · Form), defaulting to *all blocks* so nothing breaks.

Enforcement in three places, not one:
1. **M4 inspector/library** filters the block list to the policy and shows
   *"3 blocks hidden — this layout only accepts marketing blocks"*.
2. **M7 preflight** flags a page whose existing blocks violate the policy added later
   (never silently deletes them).
3. **The layout canvas** shows the policy as a chip on the slot: `Slot · 8 of 20 blocks`.

---

### F3 · 🔴 No seed content — every new page starts blank

**Evidence.** Benchmark §5: AEM *Initial Content* mode; Webflow "add default components
inside slots to help marketers get started" + "slot defaults render when no content is
provided"; Sanity initial-value templates.

**Decision.** `slot.seed: BlockNode[]`, authored by dropping blocks into the slot **while in
"Seed" mode** (the canvas shows a `SEED` ribbon so nobody mistakes it for live content).
On page creation the seed is deep-cloned with fresh ids, then the page diverges. The
Structure tab shows `Seed blocks · 2` with a preview and a *Clear seed* action.

This is the layer that makes a "Landing" layout worth having: a blank landing page arrives
with the hero, the proof strip and the form already in place — and the theme applied.

---

### F4 · 🔴 Page templates exist twice (M4 and M7)

**Evidence (our code, not the spec).** `src/lib/builder.ts:609 PAGE_TEMPLATES` already
defines 5 templates (`Programme`, `Intake Landing`, `Scholarship`, `About`, `Event`) with
`build()` functions; `Builder.tsx` already renders `SaveTemplateModal` and
`TemplateUseModal` (lines 18, 860–865). The spec invents `page_templates` as a new store
without mentioning the five that exist.

**Decision.** One store, one owner: **`src/lib/layout-db.ts`** holds `layouts[]`,
`sharedRegions[]`, `templates[]`, `bindings[]`, `layoutRevisions[]`, `templateRevisions[]`.
`builder.ts` keeps the *block builders* (`build()`) and imports the template metadata from
`layout-db` — no second copy of a template name can exist. M4 keeps two actions
(*Save page as template*, *Start from template*); both call the M7 API.

Seed **12 templates** (the mockup's count and categories, mapped onto blocks we actually
have):

| Template | Category | Blocks (existing registry only) |
|---|---|---|
| Lead Generation | Marketing & Conversion | hero + features(stats) + form |
| Product Landing | Marketing & Conversion | hero + features(media) + table(pricing) + form |
| About Us | Information | heading + text + features(team) + quote |
| Contact | Contact | heading + text + form + map/columns |
| Study Program | Programs | (today's `Programme Page`) |
| University Partner | Programs | hero + features(media) + testimonials |
| Scholarship | Programs | (today's `Scholarship Page`: hero + table + FAQ + CTA) |
| Event | Marketing & Conversion | (today's `Event Page`: hero + list + form) |
| Blog Article | Information | heading + text + quote + text |
| Application Funnel | Marketing & Conversion | hero + features(steps) + form + FAQ |
| Intake Landing | Marketing & Conversion | (today's `Intake Landing`) |
| Policy / Legal | Information | heading + text + table + text |

---

### F5 · 🔴 `page.layout` is an untyped string

**Evidence.** `src/lib/cms-pages.ts:34` — `layout: string`, seeded as `"Site default"` /
`"Blank landing"` (line 305). Nothing resolves it; M3 exposes it as free text.

**Decision.** Migrate to `binding: { layoutId: string | null; mode: "inherit" | "explicit" }`
with `null` = website default. Seeded strings map to `inherit` / the Blank Landing layout.
**M3's page-details modal gains a real Layout select** wired to M7's list (this is the
interlink, not a new field), showing `Website default — Default Website Layout` as the
inherit option. No page can be bound to an archived layout; preflight catches the ones that
already are.

---

### F6 · 🟠 Four counts, four meanings — define them once

**Evidence.** The mocks show `Pages Assigned 48` in the KPI strip and `Applied to 42 pages`
in the inspector, plus `Draft Changes 3` vs `1`. The spec (§3, §6) says "must be derived"
but never says derived *how*, so the two mock versions are both "correct".

**Decision — one definition, used everywhere:**

| Number | Definition (distinct, deduplicated) |
|---|---|
| **Explicit bindings** | pages with `mode: "explicit"` pointing at this layout |
| **Inherited** | pages with `mode: "inherit"`, counted for the *default* layout only |
| **Applied to** | explicit + inherited = every page that resolves to this layout |
| **Pages Assigned (KPI)** | distinct pages resolved to *any* layout in this site = same total as the sum of `Applied to`, which is why group subtotals must add up |
| **Draft Changes (KPI)** | objects whose draft revision ≠ live revision, **plus** objects with unsaved local edits (counted separately in the tooltip) |

Every one of those numbers is rendered with a `?` affordance that restates the rule. A count
we cannot explain is a count we do not show.

---

### F7 · 🟠 Page groups exist in the mockup and nowhere in the data

**Evidence.** Usage tab shows `Main Pages 8 · Landing 6 · Program 12 · University 5 ·
Information 7 · Other 4` summing to 42. Our `CmsPage` has `type`, `slug`, `path`,
`parentId` — no group.

**Decision.** Derive deterministically, do not invent a field:
`/` → **Main** · `type: "landing"` → **Landing** · `/programs|/study-abroad/*` → **Program**
· `/universities/*` → **University** · `type: "info"` → **Information** · else **Other**.
The card header says *"derived from route and page type"* and the tooltip lists the rule.
Same function powers announcement targeting (F8), so the two cannot drift.

---

### F8 · 🟠 Announcement targeting is in the mockup, deferred in the spec

**Evidence.** Structure tab: `Assignment: Global (all pages)`, checkboxes `Homepage`,
`Programs`, `Others (40)`. Spec §8.3/§10.3 marks targeting `[PROPOSED]` and defers it.
Elementor ships include/exclude display conditions as its core feature (benchmark §6).

**Decision.** Implement the **constrained** model the mockup implies — no expression builder:

```
scope: "all" | "home" | "groups" | "except"
groups: PageGroup[]        // uses F7's derivation
```

UI: the announcement row's detail panel shows `Show on:  All pages ▾` with a chip list.
Preflight refuses `groups` with an empty selection. Anything beyond this (device, role,
schedule, UTM) is **out**.

---

### F9 · 🟠 "No Header" conflates a variant with a suppression

**Evidence.** Spec §10.1 dropdown options: `Global Header v2 / Minimal Header / No Header`.
Suppressing chrome on a landing page is a real need; modelling it as a *variant* means a
layout can reference a header that does not exist and usage counts break.

**Decision.** Variant list contains only real regions (`Global Header v2`, `Minimal Header`,
`Compact Header`). A separate `Show header on this layout` switch (default on) suppresses
it, with a required one-line reason when off (`"campaign landing — no navigation"`), shown
in the Structure row as `Hidden · campaign landing`. Same for footer.

---

### F10 · 🟠 No limits — nothing stops the editor from becoming unusable

**Evidence.** Benchmark §7 — every mature system publishes caps (Shopify 25 sections/template,
1,250 blocks/template, 8-level nesting, 20 section groups; Webflow 40 templates/site;
AEM `cq:allowedTemplates` per branch).

**Decision — Phase-1 budgets**, enforced in UI (disabled action + reason) and in preflight:

| Budget | Value | Rationale |
|---|---|---|
| Master layouts / site | **40** | Webflow parity; 5 in the mock, 3 needed |
| Page templates / site | **120** | 12 seeded, generous headroom |
| Regions / layout | **1 required slot + ≤3 optional** (header, footer, announcement) | AEM/SXA model |
| Shared region variants / region | **8** | keeps the dropdown scannable |
| Blocks injected by a page | **200** | M4 already caps practical page length |
| Seed blocks / slot | **12** | a seed is a starting point, not a page |
| Usage table rows / page | **25** (paginated) | never load all pages for a count |
| Bulk reassign selection | **≤40 pages** | one transaction, one audit event |
| Names | ≤60 chars, unique per site, case-insensitive | prevents `Layout`, `layout`, `Layout ` |
| Preview sample page | 1, pinned by revision | mixed-version previews are worse than none |

Counter UI: library heading shows `Master Layouts (7/40)`, `Create layout` disables at cap
with *"40-layout limit reached — archive one to add another"*.

---

### F11 · 🟠 Thumbnails have no lifecycle

**Decision.** `thumbnail: { url, revHash, renderedAt } | null`, produced by the shared block
renderer at **1200×900**, keyed by `revHash`; re-rendered on save (async, skeleton until
ready); `stale` badge if `revHash ≠ current draft`; missing → monogram tile (never a
hand-uploaded photo). The library list, the template picker and the Usage "popular
templates" strip all read the same field.

---

### F12 · 🟠 "SEO-ready" is drawn as a toggle; it is a measurement

**Evidence.** Mockup shows a `SEO-ready` switch. Spec §9.2 correctly asks for a
checklist/report but §10.2 still lists it among fields.

**Decision.** Read-only, computed from the template's own metadata: title pattern ·
description · OG image asset · canonical · robots · exactly one H1 in the block tree.
Rendered as `SEO-ready 5/6` with a popover listing each check and a *Fix in Pages → SEO*
link. It can never be switched on. (Baiting a ranking guarantee with a toggle is the kind
of thing that gets a CMS laughed at.)

---

### F13 · 🟠 The authoring boundary between M7 and M4 is undefined

**Evidence.** Spec §9.3 offers both "edit template sections" *and* "Open in Visual Builder";
§8.5 notes a `+ Add Block or Content` affordance that "must route to the page's Visual
Builder or explain slot semantics" — i.e. undecided. Benchmark §9: every system has two
editors over one renderer.

**Decision.**

| Concern | Owner |
|---|---|
| Layout composition, region order, slot policy, seed | **M7 Structure tab** |
| Layout/template metadata, defaults, usage, revisions | **M7 inspector** |
| Block content inside a region (footer, announcement) | **M7 Shared Region drawer** (M4 blocks, scoped) |
| Block content of a *page* | **M4**, deep-linked `#/builder?page=…` |
| Block content of a *template draft* | **M4**, deep-linked `#/builder?template=…` |
| Navigation menu content | **M8** (chip: "managed in Menus & Navigation") |

The M7 canvas is a **live render**, never an editable block surface: clicking a block inside
the slot opens M4 at that block. The slot's `+ Add block` affordance disappears; it is
replaced by `Edit page content →` and `Edit seed blocks`.

---

### F14 · 🟠 No undo, no revert

**Decision.** Reuse the M4/M6 pattern: an undo stack per edited object (⌘Z / ⇧⌘Z) with a
visible counter, plus `Revert to saved draft` (confirmed). Structural ops (variant swap,
region hide, policy change, seed edit, reorder) are all single undoable transactions. A save
clears the stack; switching objects with a dirty stack prompts.

---

### F15 · 🟠 Preview does not say *what* it is previewing

**Evidence.** Spec §5.2 has a `Draft Preview — Not Live` label — necessary, not sufficient.
Mixed-version renders (layout rev 4 + page rev 9 + theme rev 7) are the classic
"why does it look different in the builder" bug.

**Decision.** Preview header shows the pinned set: `Layout v4 · Page “Home” v9 · Theme v7 ·
Draft`, each a chip; any resolution failure replaces the frame with a named error
(`No sample page available for this layout` / `Header variant missing`). No silent fallback.

---

### F16 · 🟡 Naming: duplicate / rename rules

**Decision.** Unique per site, case-insensitive, trimmed, ≤60 chars. Duplicate produces
`Name (copy)` then `Name (copy 2)`. Renaming never changes routes (already in the spec) and
never rewrites existing pages. Slugs/ids are internal and never shown.

---

### F17 · 🟡 Template provenance must be stored, not inferred

**Decision.** `page.sourceTemplate = { templateId, revisionId, at }` written at creation.
Usage tab lists pages created from the template with that revision; if a page predates the
field, the row reads `created before provenance was recorded` — never a guessed count.

---

### F18 · 🟡 One template picker, three entry points

**Decision.** `TemplatePicker` component used by (a) M7 gallery, (b) M3 `+ New page`,
(c) M4 "start from template". Same thumbnails, same categories, same search, same cap
messaging. Three lookalike pickers would drift within a week.

---

### F19 · 🟡 Locale

Our pages carry `locale`. Phase-1 layouts are **locale-neutral** (one shell for all
locales of a site). If a site has >1 locale the Usage tab shows a note:
`Locale variants are not split in this build — every locale renders this layout.` Honest,
explicit, and a hook for the Localization module later.

---

### F20 · 🔵 Duplicate to another site — deferred

Real enterprise need (SXA shares page templates across sites by design). Deferred: it
requires cross-site identity and a policy for cross-tenant copy. Listed in `INTERLINK-PLAN`.

### F21 · 🔵 Raw HTML / custom JS in a region — refused

Already `[BASE]` in the spec and correct; restated so no future ticket reopens it.

### F22 · 🟡 Capabilities surfaced, not implied

**Decision.** Four capability gates, applied in the UI as `disabled + reason tooltip` and
enforced server-side:

`layout.edit` · `layout.default` · `template.manage` · `layout.delete`

The app's existing role model (`Aranya K.` = Owner) unlocks all four; the
**Prototype states** menu gains a `Viewer` demo state that locks all four so the read-only
surface is testable — the same mechanism M1–M6 already use.

---

## 2 · Corrections to the specification's own 16 open questions (§23)

| # | Question | Decision |
|---|---|---|
| 1 | Bootstrap a default layout? | **Yes.** Idempotent provisioner: a site with zero layouts gets `Default Website Layout` (draft) on first open of M7. Matches SXA's "there is always a default template". |
| 2 | One required slot? | **Yes, Phase 1.** Header/footer/announcement are regions, not slots. |
| 3 | Chrome: nodes or references? | **References** to `SharedRegion` variants (F1). |
| 4 | Binding freezes identity or revision? | Binds **identity** (`layoutId`); the release manifest pins `layoutRevisionId` **at assembly**, and the public renderer resolves from the frozen manifest only. |
| 5 | Default resolution for older/imported pages? | `mode: "inherit"` → site default at render time; explicit → that layout. A binding to an archived/removed layout is a **preflight error with a repair action**, never a runtime fallback. |
| 6 | Autosave or explicit save? | **Explicit save** with dirty guard (M7 objects change rarely; two write paths is how conflicts happen). CAS on `expectedRevision`, conflict modal per spec §12.8. |
| 7 | Template scope? | `builtin \| workspace \| site`, same three-chip vocabulary as M6 presets — consistency beats a new taxonomy. |
| 8 | Provenance stored? | **Yes** (F17). |
| 9 | Delete = soft or hard? | **Archive (soft)** by default, retained revisions kept; hard delete only for a layout with zero bindings and zero releases. |
| 10 | Full editor in M7 or M4? | **M4**, deep-linked; M7 owns composition/policy/metadata/usage (F13). |
| 11 | Group targeting + arbitrary reorder in Phase 1? | Targeting: **yes, constrained** (F8). Reorder: **only optional regions**, and only between header and footer — the slot never moves. |
| 12 | Bulk reassign at launch? | **Yes**, guarded: ≤40 pages, impact preview, one CAS transaction, one audit event. The mockup shows the button; a dead button is worse than a small feature. |
| 13 | Role capabilities? | The four in F22. |
| 14 | KPI definitions? | F6, one definition, tooltip on every number. |
| 15 | Template export? | **Export yes** (`wacrm.page-template` v1, mirroring the M6 bundle pattern, no import in Phase 1). Import is refused with an explanation — tenant-safe import needs schema versioning + validation we have not designed yet. |
| 16 | SEO-ready? | Computed checklist (F12). |

---

## 3 · What gets added to the screen (delta against the mockups)

The mockups stay. These are the additions, all inside existing regions:

**Header / toolbar** — `Create` becomes contextual (`+ Create Layout` on the layout tab,
`+ Create Template` on the template tab — spec §5.3's own recommendation). KPI cards become
clickable filters that carry their definition tooltip (F6).

**Left library** — scope chips `All · Built-in · Workspace · This Site` with counts (M6
parity), sort `Recent · Name · Usage`, an `Archived` filter, per-row usage count, thumbnail
with `stale` badge, and a cap counter `(7/40)` (F10, F11).

**Centre canvas** — `Fit` zoom next to device switches (M4 parity); a **pinned revision
strip** in preview (F15); a `SEED` ribbon when editing seed content (F3); slot chip
`8 of 20 blocks allowed` (F2); `Edit page content →` replaces `+ Add Block or Content` (F13).

**Below-canvas strip** — add `Allowed blocks: 8/20` and `Seed blocks: 2` chips beside
`Layout Assignment`; `Open in Builder` for the sample page.

**Right inspector — Overview** — add `Pending release: included / not included` row,
`Undo 3 steps` counter (F14), `Revert to saved draft`, capability-locked controls with
reasons (F22).

**Right inspector — Structure** — the biggest addition:
- `Allowed blocks in this slot` chip picker (F2);
- `Seed blocks` row with preview + `Edit seed` (F3);
- announcement row gains `Show on: …` targeting (F8);
- header/footer rows gain `Show this region` + reason (F9) and `Edit shared region →` (F1);
- `Region order` limited to optional regions with keyboard move up/down (question 11);
- lock badges are explained in text, not just an icon.

**Right inspector — Usage** — explicit vs inherited columns, `Draft`/`Live` status split,
search + pagination, `Bulk reassign` flow (≤40), `Open Template Library`.

**New surfaces (not in the mockups)**
1. **Shared Region drawer** — variant list, block editing, usage warning, "used by N
   layouts / M pages" (F1).
2. **Template picker** — reused by M3/M4/M7 (F18).
3. **Preflight drawer** — the "Draft Changes 3" click target: object · problem · fix link
   (slot missing, broken variant ref, policy violation, binding to archived layout,
   duplicate name, over budget).
4. **Bulk reassign dialog** — impact preview + confirm (question 12).

---

## 4 · Data model (the shape we will actually build)

```ts
// src/lib/layout-db.ts
type RegionKind = "header" | "footer" | "announcement";
type Scope = "builtin" | "workspace" | "site";

interface SharedRegion {                 // F1
  id: string; siteId: string; kind: RegionKind; name: string; scope: Scope;
  variants: RegionVariant[];             // ≤8 (F10)
  updatedAt: number; updatedBy: string;
}
interface RegionVariant {
  id: string; name: string; blocks: BlockNode[]; menuId?: string;  // header nav → M8
  thumbnail?: Thumb; updatedAt: number;
}

interface SlotPolicy { allow: BlockType[]; deny: BlockType[]; maxBlocks: number }  // F2

interface LayoutDraft {
  regions: {
    announcement?: { regionId: string; variantId: string; visible: boolean;
                     scope: "all" | "home" | "groups" | "except"; groups: PageGroupF7[] };
    header:       { regionId: string; variantId: string; visible: boolean; reason?: string };
    slot:         { id: "slot-main"; label: string; policy: SlotPolicy;
                    seed: BlockNode[] /* ≤12 */ };                 // F3
    footer:       { regionId: string; variantId: string; visible: boolean; reason?: string };
  };
  optionalRegions: { id: string; kind: "announcement" | "custom"; order: number }[];
}

interface MasterLayout {
  id: string; siteId: string; name: string; slug: string; isDefault: boolean;
  scope: Scope; draft: LayoutDraft; draftRev: number; liveRev: number | null;
  thumbnail: Thumb | null;                       // F11
  updatedAt: number; updatedBy: string; createdAt: number; createdBy: string;
  archived?: { at: number; by: string };
}

interface PageTemplate {
  id: string; siteId: string; name: string; description: string;
  category: "Marketing & Conversion" | "Information" | "Programs" | "Contact" | "Other";
  scope: Scope; layoutId: string | null;        // null = website default
  blocks: BlockNode[];                          // the starter body
  seo: { titlePattern: string; description: string; ogAssetId: string | null;
         canonical: boolean; robots: string };  // F12 reads this
  draftRev: number; liveRev: number | null; thumbnail: Thumb | null;
  updatedAt: number; updatedBy: string; createdBy: string; archived?: { at: number; by: string };
}

interface PageBinding { pageId: string; layoutId: string | null; mode: "inherit" | "explicit" } // F5
interface PageGroupF7 { key: "main" | "landing" | "program" | "university" | "information" | "other"; label: string }
```

API (same async/loading style as every other module, with `mode.{fail,slow,conflict,empty}`):

```
LayoutsAPI.load(siteId)              → layouts, regions, templates, bindings, kpis
LayoutsAPI.saveLayout(id, draft, expectedRev)      CAS
LayoutsAPI.saveTemplate(id, patch, expectedRev)    CAS
LayoutsAPI.setDefault(id)            guarded, transactional
LayoutsAPI.duplicate(kind, id, name)
LayoutsAPI.rename(kind, id, name)
LayoutsAPI.archive(kind, id) / restore
LayoutsAPI.reassign(pageIds[], layoutId)           ≤40, one audit event (F10)
LayoutsAPI.preview(layoutId, samplePageId)         pinned revisions (F15)
LayoutsAPI.saveRegionVariant(regionId, variant)    F1
LayoutsAPI.saveRegionPolicy?? → part of saveLayout
LayoutsAPI.createPageFromTemplate(templateId, {title, slug, parentId, layoutId})  → M3/M4
```

---

## 5 · Interlink contract (what changes outside M7)

| Module | Change | Why it must be in this build |
|---|---|---|
| **M3 · Pages** | `layout` string → typed binding + real Layout select in page details; `+ New page` offers `TemplatePicker`; page rows show a layout chip | Otherwise M7's bindings have no second end |
| **M4 · Builder** | canvas `<Master>` becomes the **real resolved layout** (header variant, announcement, footer, slot); library filters by slot policy; `Save as template` writes to `layout-db`; deep-link `?page=` / `?template=`; template actions read M7 | This is the visible proof that a layout is live, not a picture |
| **M5 · Library** | library entries gain `Used in N layouts`; block picker respects policy | Policy needs a consumer, and reuse needs a count |
| **M6 · Theme** | `exportBundle().layout.starterLayouts` is filled from M7 templates (it is currently `{}` with `deferredTo: "Module 7"`); layout preview already inherits tokens via `.wb-themed` | Closes the hook M6.2 left open, and makes the theme bundle genuinely complete |
| **M8 · Menus & Navigation** | header region references `menuId`; a `Managed in Menus & Navigation` chip + disabled nav editing until M8 lands; nav placeholder card gains `used by N layouts` | Prevents two sources of truth for navigation |
| **M9 · Media** | logo, OG images for the SEO checklist, thumbnails | Assets have an owner already |
| **M10 · Forms** | templates declare form refs; Lead Generation *must* reference a CRM form; consent block validated against Meta opt-in rules | CMS motto: everything interactive reaches the CRM |
| **M11 · Releases** | preflight consumes M7 validation; `Pending release` row; publish sets `liveRev = draftRev` | Draft→live is the whole point |
| **CRM** | `createPageFromTemplate` → page → form → lead loop; template usage analytics deferred (listed) | Keeps the CRM contract visible |

---

## 6 · State matrix — deltas to spec §13

Adds to the existing matrix (spec's 35 states are otherwise accepted as-is):

| New state | Appearance | Behaviour |
|---|---|---|
| **At cap** | `Create` disabled, `7/40` counter | Reason tooltip: archive one first |
| **Policy violation** | Page can't receive a block type; layout flags existing blocks | Show the violation, never auto-delete |
| **Seed mode** | Canvas ribbon `SEED · not page content` | Blocks dropped here seed new pages only |
| **Variant missing** | Header/footer row in red with `Choose a variant` | Blocks save until fixed |
| **Thumbnail stale** | `stale` badge on the tile | Offer `Re-render`; never silently show an old image |
| **Read-only (Viewer)** | All write CTAs disabled + reason | Prototype states menu can force it |
| **Over budget** | Inline red `41 of 40 layouts` (imported data) | Preflight error with archive suggestion |
| **Provenance unavailable** | Usage row text, not a number | No invented counts |
| **Locale note** | Amber note in Usage when site has >1 locale | Honest limitation (F19) |

---

## 7 · Build plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1 · Data** | `layout-db.ts` (model + seeds: 3 layouts, 3 regions with variants, 12 templates, bindings, revisions), `LayoutsAPI` with CAS + state modes, mount `#/layouts` route, nav entry flips from placeholder to built | `tsc` clean; module loads; seeds consistent with M3 pages |
| **P2 · Screen** | 3-column shell, KPI strip with definitions, library (2 tabs, search, scope chips, caps, overflow menus), canvas render of the resolved layout, device switch, pinned preview | Every CTA in spec §11 reachable or explicitly disabled with reason |
| **P3 · Structure** | region tree, locks, variant swap, show/hide + reason, announcement targeting, **slot policy**, **seed mode**, optional-region order, undo/redo | F1/F2/F3/F8/F9/F14 demonstrable |
| **P4 · Usage + dialogs** | explicit vs inherited counts, groups (F7), table with search/pagination, bulk reassign, all 10 dialogs from spec §12, preflight drawer | Blocked-delete, conflict, default-change all proven |
| **P5 · Interlinks** | M3 binding + picker, M4 canvas master + policy filter + template actions, M5 usage count, M6 bundle `starterLayouts`, page-created-from-template flow into M4 | Round trip: template → page draft → M4 → save as template |
| **P6 · QA + docs** | `qa_layouts.py` (~110 checks), `qa_states_m7.py` (~40), flow additions, README/START-HERE/HANDOVER, screenshots | 11 → 13 suites green; checkpoint pushed |

**QA will assert the things that are easy to fake:** the counts recomputed from the page
table, the policy actually filtering the M4 library, seed blocks appearing in a *new* page
and *not* in an existing one, the M4 canvas painting the assigned header variant, the
bundle carrying `starterLayouts`, and every guard refusing the wrong thing.

---

## 8 · Three decisions I need from you before P1

I have taken a position on all 22 findings and all 16 open questions. Three of them change
what you will see on screen, so I am not deciding them silently:

1. **Announcement targeting** — implement the constrained `All / Homepage / page groups /
   except` model (my recommendation, matches the mockup) **or** ship `All pages` only and
   remove the checkboxes from the mock?
2. **Bulk reassign** — implement the guarded flow (≤40 pages, impact preview) **or** remove
   the button from the Usage tab completely?
3. **Shared regions** — a drawer/modal opened from the region row, keeping the two-tab
   library exactly as designed (my recommendation) **or** a third left tab
   `Shared Regions`?

Everything else: say "go" and I start P1, module by module, committing and pushing as each
phase lands.
