# EUROMILES WACRM — NATIVE WEBSITE CMS
# MODULE 7 — LAYOUTS & TEMPLATES (DESKTOP)
## Complete Product, Screen, Tab, CTA, State, Motion, Security and Implementation Specification

> **Provenance:** pasted by the owner on 13 Nov 2026, persisted verbatim so it survives the
> chat. Reference mocks converted to WebP in `uploads/` (5 screens + 1 full editor).
> Review, corrections and additions live in **`MODULE-7-GAP-REVIEW.md`**; the competitive
> evidence behind them in **`MODULE-7-BENCHMARK.md`**. Read this file as the *submitted*
> contract — not as the accepted one.

**Document version:** 1.0 — design/implementation contract for independent review  
**Prepared:** November 2026  
**Application:** `wacrm-app`  
**Sidebar destination:** Website CMS → **Layouts & Templates**  
**Blueprint mapping:** Domain 03, **Module 3.1 Master Layouts & Slot Injection** and **Module 3.2 Page Template Inheritance**  
**Related screen specifications:** Module 3 Pages & Routes; Module 4 Visual Builder; Module 5 Block Library; Module 6 Theme Studio  
**Primary source:** `CLAUDE_PROPOSAL.md`, especially §§1–4, Domain 03, release pipeline and tenant-isolation rules  
**Reference images:** `a_detailed_desktop_web_app_ui_screenshot_a_wacrm.png` (initial overview), `wacrm_website_cms_layout_editor.png` (Master Layouts), `lead_generation_template_editor.png` (Page Templates), `wacrm_layouts_overview_dashboard.png` (Overview inspector), `wacrm_layout_structure_editor.png` (Structure inspector), `wacrm_layout_usage_dashboard.png` (Usage inspector).  
**Status:** Mockup-derived proposed UI specification; **not** an assertion of implemented application behavior.

### Source and scope tags

- **[BASE]** Explicitly required or established in the authoritative master blueprint.
- **[VISUAL]** Visible in one or more generated reference images; illustrative, not verified working software.
- **[DESIGN]** This document's implementation recommendation to make the approved screen behavior deterministic and usable.
- **[PROPOSED]** Extension requiring approval of data model, API and/or product policy.
- **[DEFERRED]** Intentionally not part of the first-release contract.

**Terminology:** This is *Module 7* in the **sidebar design sequence**, not master blueprint *Domain 07* (Forms). Its underlying blueprint functionality is **Domain 03**. Preserve this distinction in engineering tickets.

---

## 1. Executive specification and product purpose

**Purpose:** A site designer creates a single master website shell (announcement/header/page-content slot/footer), assigns it to pages, and manages full-page **starter templates** that initialize editable page drafts. The editor makes structural reuse visible without confusing shared chrome with page-specific content.

**Primary goals:**
1. Edit reusable site-wide layout chrome once rather than individually modifying many pages.
2. Keep an explicit, validated **page-content insertion slot** where each page's native block tree is rendered.
3. Set a website default layout and bind individual pages to a specialized layout when needed.
4. Browse and maintain complete starter page templates (lead generation, product landing, about, contact, etc.).
5. Preview the selected layout/template at desktop, tablet and mobile sizes.
6. Inspect the **impact radius** (the pages using a layout/template), with clear draft/live distinctions.
7. Save draft revisions safely and publish through the existing manifest preflight and atomic CAS workflow.
8. Prevent removal of in-use layouts or inconsistent content-slot configurations.

**Non-goals:** Replicate the full native Visual Builder in this management screen; permit arbitrary HTML/CSS/JS; offer public-facing live edits without a release; build unlimited nested layout slots; introduce Phase-2 staging or scheduling; turn saved page templates into implicitly live-updating linked components.

### 1.1 Precise distinction: master layouts vs page templates

| Concept | Master Layout | Page Template |
|---|---|---|
| Function | Reusable page **shell** | Reusable **starter document** |
| Typical contents | Announcement, shared header/navigation, required content slot, shared footer | Hero, feature/content sections, CTA, forms and page metadata defaults |
| Relation to page | Explicit assignment or default-layout resolution | Copies/inits a new page **draft** at creation time |
| Updates | A changed layout revision affects assigned pages **on the next published site release** | Updating a template does **not** retroactively update pages already created from it |
| Required insertion point | Exactly one clearly designated required `Main Content` slot in Phase 1 [DESIGN] | Page's native block tree is inserted into the assigned master layout slot |
| Primary action | **Save Master Layout** | **Create Page from Template** (source blueprint); management editor may show **Save Template** |
| In-use deletion | Guarded/blocked until reassigned per policy [BASE] | Guarded if referenced or otherwise retained; already-created pages are independent [DESIGN] |

### 1.2 Cross-module ownership

- **Module 3 — Pages:** page registry, routes, page status, page's selected layout and creation from template.
- **Module 4 — Visual Builder:** edit the page's unique block tree and save a page as a template.
- **Module 5 — Block Library:** manages individual blocks and reusable *sections*; does not own page-shell assignment.
- **Module 6 — Theme Studio:** site-wide design tokens; colors/fonts inherit into layout and template rendering.
- **Module 7 — Layouts & Templates:** master shell, page templates, default and page-specific bindings, usage and preview.
- **Publishing & Releases:** entire-site preflight and atomic publish; not duplicated by Module 7.

---

## 2. Blueprint-grounded architecture: hard invariants

1. **[BASE] Canonical native document model.** All editable page and layout content consists of typed native React/Zod block nodes `{ id, type, schemaVersion, props, children }`; never store arbitrary author-supplied raw HTML/CSS.
2. **[BASE] Data entities.** Master layouts: `master_layouts`, `layout_revisions`, `page_layout_bindings`. Page templates: `page_templates`, `template_revisions`.
3. **[BASE] Slot contract.** An explicit `<Slot />`-equivalent typed marker injects the selected page's distinct page-content tree into a master layout. The angle-bracket expression is architectural notation, not permission to persist raw HTML.
4. **[BASE] Default and specialized assignment.** One layout may be the website default; pages may use a specialized layout such as Blank Landing Page.
5. **[BASE] Release snapshot consistency.** Immutable `release_items` include referenced layout revisions. The public Nitro request resolves `host → site → live_release_id` **once**, and renders layouts, page content, menus and tokens from that *same frozen release*.
6. **[BASE] Draft ≠ live.** Saving a layout/template creates or updates a draft revision; it does not mutate the currently served published release.
7. **[BASE] Publish uses manifest-first preflight and CAS.** Assemble a frozen manifest, validate it, and atomically update `sites.live_release_id` only if the expected previous release matches; transactional outbox insertion is in the same transaction.
8. **[BASE] Tenant isolation.** Authenticated CRM workspace (`organization_id`) is parent; every layout, binding and template read/write is organization/site-authorized with composite FKs and RLS/`withTenant` protections.
9. **[BASE] Link semantics.** All navigational links use the typed `LinkRef` resolver: `{kind:'page',id}`, `{kind:'external',url}`, or `{kind:'asset',id}`. The editor must not save stale raw paths as the sole internal target identifier.
10. **[BASE] Shared renderer.** Studio preview and public Nitro SSR must use the same native render components to avoid preview/live divergence. Public runtime ships no React editor hydration.
11. **[BASE] Live dependency safety.** Deleting a layout used in any relevant current/retained release must be guarded; deleting an item from a management list cannot invalidate retained releases.
12. **[BASE] Phase 1 has a *single* live release pointer.** Do not add staging/environment controls or scheduled publishing based solely on visuals.

### 2.1 Proposed simplifying constraints, not source facts

- **[DESIGN]** Exactly one required `Main Content` slot per Phase-1 master layout; at most optional typed announcement/header/footer regions; no arbitrary recursive named-slot composer.
- **[DESIGN]** Header and footer are editable shared regions or references to reusable header/footer variants; prevent accidental divergent ownership between master layout, menu studio and template.
- **[DESIGN]** One designated default master layout per site, validated with a deterministic fallback for older pages.
- **[DESIGN]** A page-template application is copy-on-create, not live inheritance; store provenance for audit but never auto-push changes to existing pages.
- **[PROPOSED]** Region-specific enable flags, page-group targeting, bulk reassign, custom region reorder and dedicated usage aggregates are optional unless further backed by approved schema/API.

---

## 3. Visual references and accuracy reconciliation

| Reference | What it establishes | Caveat |
|---|---|---|
| Initial Module 7 screen | Full desktop shell, 3-column editing, KPIs, layout editor, right settings | Mockup contains illustrative names, dates and counts |
| Master Layouts state | Master Layouts left tab, page slot outline, global header/footer, overview inspector | Shows **5 master layouts** whereas another version shows **3**; count must come from API |
| Page Templates state | Page template list, lead-gen page composition, template fields | Some mockup text says “Active/SEO-ready”; status must reflect validated actual data |
| Overview state | Draft/Valid chips, layout name, default switch, header/footer/slot dropdowns, applied-to usage | “Valid” ≠ “Published”; unsaved/published must be shown separately |
| Structure state | Region tree, locked global regions, visibility/assignment controls, drag handles | Do not implement unrestricted reorder or rule logic from image alone |
| Usage state | Assigned page groups, table, owners/timestamps, drilldown actions | Counts, historical dates, editor names and bulk reassign are illustrative/proposed |

**Canonical count rule:** The screenshot examples show 3 or 5 layouts, 12 page templates, 42/48 assigned pages and 1/3 draft changes. **None** is a hardcoded production quantity. All KPI values and row counts derive from the selected site and permissions, and page group subtotals must sum to their actual distinct assigned-page total rather than exceeding it.

**Color rule:** **Violet** for primary CTAs and selected interaction emphasis; **green** solely for valid/success/published feedback; amber for warning/draft attention, red for destructive/error. Preserve the WACRM dark sidebar and white/light-gray work area.

---

## 4. Desktop screen structure and sizing

### 4.1 Global WACRM shell [VISUAL]

- Left global sidebar: WACRM brand, workspace switcher, CRM navigation; Website CMS expanded, **Layouts & Templates** selected.
- Global top bar: `Website CMS > Layouts & Templates` breadcrumb; WACRM search (`Ctrl/⌘ K`), notifications, help and user profile.
- Header title **Layouts & Templates**; subtitle **Manage global page structure and reusable full-page designs.**
- Header controls: website selector, outlined **Preview Layout**, violet **+ Create Layout**.
- Compact KPI row: **Master Layouts**, **Page Templates**, **Pages Assigned**, **Draft Changes**.
- Main work area: left library ≈270–310px; flexible center editor; right detail inspector ≈300–360px. Shell widths adapt to available desktop viewport.
- White cards with 1px soft borders, ~10–12px radii, compact 13–14px body type, restrained shadows and violet selection indicators.

### 4.2 Logical regions

| Region | Description | Primary purpose |
|---|---|---|
| A | Global navigation | Change CMS module with persistent workspace |
| B | Header/toolbar | Select site, preview, create layout |
| C | KPI strip | Counts and actionable draft summary |
| D | Left library | **Master Layouts** / **Page Templates** tabs and searchable records |
| E | Center editor | Layout shell or template canvas with responsive preview and section boundaries |
| F | Below-canvas strip | Assignment context, preview destinations, popular page templates |
| G | Right inspector | **Overview**, **Structure**, **Usage** contextual tabs |
| H | Sticky inspector bottom | Save Master Layout / Save Template or contextually appropriate action |

### 4.3 Responsive behavior

- At ≥1440px, retain three-column workspace and four KPI cards in one row.
- At 1024–1439px, allow global sidebar collapse, reduce side-panel widths, and wrap KPI cards; maintain minimum useful editor width.
- On narrower tablet, left library and right inspector become collapsible panes/drawers; desktop editing remains preferred.
- Mobile is primarily for **preview**, not a promise of fully featured drag-and-drop editing unless separately designed and accepted.
- Never truncate critical destructive-action warnings to preserve a rigid mockup width.

---

## 5. Header controls and exact interactions

### 5.1 Website selector

**Trigger text example:** `Website: EuroMiles Main`.

**Dropdown:**
- Heading: **Select Website**
- Search placeholder: **Search websites…**
- Options: **EuroMiles Main**, other authorized sites with name and primary domain, and status if relevant.
- Checkmark on currently selected site; disabled/read-only explanation for inaccessible sites rather than exposing hidden data.

**On select:** Re-scope layouts, templates, usage counts and preview to the selected site, discard stale selection IDs and request authorized data. If the current editor is dirty, offer **Save Draft**, **Discard Local Changes**, **Cancel Switch** before switching. No cross-site saving by accident.

### 5.2 Preview Layout button

- **Master layout selected:** Open authenticated sample-page preview (default sample if available) with the selected *draft* layout revision and chosen page content.
- **Page template selected:** Open template preview without creating/publishing a page.
- **No selected item:** Disabled or open an explicit select-item explanation.
- Preview toolbar: **Desktop (1440px)**, **Tablet (768px)**, **Mobile (375px)**; **Close Preview**; clear **Draft Preview — Not Live** label.
- Preview is authorized and isolated; not a public accessible URL exposing drafts.

### 5.3 Create Layout button

**Trigger:** `+ Create Layout` (always violet primary).

**Modal title:** **Create Master Layout**

**Fields:**
- Layout Name * — placeholder **e.g., Campaign Layout**
- Start From: **Blank Layout**, **Duplicate Existing Layout** (if allowed)
- Source Layout — appears only for duplicate option.
- Use as Website Default — unchecked by default, requires explicit confirmation if replacing current default.

**Buttons:** **Cancel**, **Create Layout**.

**On submit:** Validate name and permission, initialize a draft layout with required content slot, create revision with tenant/site scope, select new layout and show **Master layout created.** No live release mutation. If slug/identifier required by backend, generate and validate it; do not invent an exposed field unnecessarily.

**Possible UX ambiguity:** On the Page Templates tab, the global button still reads `+ Create Layout` in the mockup. **[DESIGN]** Prefer contextual label **+ Create Template** *or* maintain the global label but require users to switch to layout mode. Make the decision consistent before implementation; the recommended behavior is contextual primary CTA.

### 5.4 Global CMS controls

Global search, notification bell, help and profile follow the approved Module 1 shell behavior. Do not implement duplicate independent menus that disagree with the wider app.

---

## 6. KPI cards

| KPI | Definition | On click | Empty/unavailable |
|---|---|---|---|
| Master Layouts | Count of accessible master layouts in selected site | Switch left tab to Master Layouts | 0 → empty library with Create Layout |
| Page Templates | Count of accessible page templates under applicable scope | Switch to Page Templates | 0 → starter-template guidance |
| Pages Assigned | Distinct pages assigned to any layout within selected site; specify whether includes default-bound pages | Open Usage assigned pages | `—` if failed; 0 if confirmed empty |
| Draft Changes | Layout/template draft changes distinct from live release (document exact aggregation) | Open draft changes / preflight source list | Zero or clear “No pending changes” |

All values are **data driven** and permission aware, never the screenshot samples. Hover 160ms soft border/shadow change; keyboard focus visible. Define count semantics consistently across dashboard, inspector and filter results.

---

## 7. Left library: two primary tabs

### 7.1 Tab A — Master Layouts

**Tab label:** **Master Layouts**.

**Contents:**
- Search field: **Search master layouts…**
- Heading: **Master Layouts ({count})**
- Optional add icon **+** → Create Master Layout.
- Rows: layout icon, display name, default indicator if applicable, overflow `•••`.
- Example entries: **Default Website Layout**, **Blank Landing Layout**, **Campaign Layout**, **Blog Layout**, **Application Funnel Layout** (examples only).

**Selection:** Row selected in pale violet; center becomes layout editor; inspector updates to selected record, active tab either persists or resets predictably to Overview (recommend reset to Overview on object-type change).

**Row hover:** faint surface tint and overflow reveal without moving text.

**Master layout row overflow exact proposal:**
1. **Open Layout**
2. **Preview on Sample Pages**
3. **Duplicate Layout**
4. **Rename Layout**
5. **Set as Website Default** / **Remove Default** (only where safe)
6. **View Assigned Pages**
7. **Archive / Delete Layout** (guarded; exact archive support depends on schema)

**Not allowed:** Delete current default with active bindings, delete any layout still needed by current or retained releases, silently reassociate pages.

**Search behavior:** Debounced or efficient local search, case-insensitive accessible labels, clear `×`, no-results empty view; retaining selected object until explicitly changed is acceptable if the selected object falls outside filtered rows, but show clear selection context.

### 7.2 Tab B — Page Templates

**Tab label:** **Page Templates**.

**Contents:**
- Search field: **Search page templates…**
- Heading: **Page Templates ({count})**.
- Template list with thumbnail, name, optional brief description, `•••` menu.
- Example starter categories in screenshots: **Lead Generation**, **Product Landing**, **About Us**, **Contact**, **Study Program**, **University Partner**, **Scholarship**, **Event**, **Blog Article**.
- [BASE] Guaranteed initial conceptual categories are **Lead Gen, Product Landing, About and Contact**; the other named examples are curated suggestions, not guaranteed backend resources.

**Selection:** show template's page block composition in center editor; right inspector shows template-specific Overview/Structure/Usage; `Save Template` applies only to authorized editable templates.

**Page template overflow proposed menu:**
1. **Preview Template**
2. **Create Page from Template**
3. **Duplicate Template**
4. **Rename Template**
5. **Export Template** (optional validated portable format)
6. **Delete Template** (guarded; built-in protected)

**User-saved templates:** created via **Save Page as Template** in Module 4 or authorized template management; store immutable/revisioned snapshot of page content.

### 7.3 Cross-tab behavior

- Switching tabs must not discard unsaved edits; prompt when necessary.
- Library search is scoped to active tab, not applied silently to unrelated object types.
- Preserve site filter and last valid responsive preview mode.
- Selecting a different record updates the editor, right inspector and bottom CTA atomically.
- Loading: skeleton list and canvas; empty: dedicated create guidance; permission denied: read-only state.

---

## 8. Master Layout center editor: anatomy and behavior

### 8.1 Default four region composition [VISUAL]

1. **Announcement Bar** — optional, site-wide campaign/notification chrome.
2. **Global Header** — site logo, global menu, primary CTA where configured.
3. **Main Content Slot** — **required typed insertion marker** for page-specific blocks.
4. **Global Footer** — shared site footer/navigation/legal/social sections.

The region descriptions are UI concepts; actual implementation is a schema-defined native block tree plus an explicit slot node, not literal uploaded HTML.

### 8.2 Region selection

- Click region → violet outline/bounding box and label; inspector switches to selected region properties if available.
- Hover region → light violet edge and descriptive tooltip.
- Drag handles only where schema permits reordering; **required slot cannot be removed or moved to an invalid nesting position**.
- Selected object persists while inspector tabs change.
- Tab/keyboard selection exposes the same interaction affordances.

### 8.3 Announcement Bar

**Visible components:** icon, concise message, internal `LinkRef` CTA, optional dismiss affordance in public delivery if implemented.

**Editor controls:** enabled toggle if schema supports; text, link target, style variant, accessible label; optional targeting is **[PROPOSED]** and must be governed rather than arbitrary rules.

**Blank/default state:** soft placeholder **No announcement configured** and **Add Announcement** action; deleting optional announcement does not invalidate the content slot.

### 8.4 Global Header

**Visible components:** brand/logo, resolved navigation menu, CTA (where enabled).

**Editor actions:** **Edit Header**, **Choose Header Variant**, **Open Menu Studio**. A variant change should not imply rewriting the underlying navigation tree.

**Source of truth:** menus are managed by Menus & Navigation; layout stores typed references to approved menu/header structures.

### 8.5 Main Content Slot

**Visual:** dashed violet outline and prominent label **PAGE CONTENT SLOT**; supporting text **This is where each page's unique content appears**.

**Behavior:**
- In layout-edit mode, represent an *injection marker*, not a duplicated page document.
- Clicking **Preview on Sample Pages** binds a specific authorized sample page's draft or live tree for non-destructive preview.
- Placeholder may display illustrative page content behind tint, but must explicitly identify sample page and its draft/live source.
- An apparent **+ Add Block or Content** button in a mockup must route to the page's Visual Builder or explain slot semantics; **do not write page-specific content into a global master-layout slot**.
- Guard remove/duplicate when it would create no primary slot or ambiguous multiple primary slots.

### 8.6 Global Footer

**Editor actions:** **Edit Footer**, **Swap Footer Variant**, **Open Menu Studio** if footer links rely on shared menu resources. Validate LinkRefs and required legal/navigation behaviors.

### 8.7 Region toolbar

When a movable/editable region is selected, show compact controls as allowed:
- **Drag / Reorder** (only schema-safe slots).
- **Edit** → focus contextual inspector.
- **Duplicate** → only optional/allowlisted repeatable region, not required global header/slot blindly.
- **Delete** → confirmation for removable regions; disabled with explanatory tooltip for required content slot and locked regions.
- **More** → accessible context actions if needed.

All actions operate on draft revisions with undo support where supported by the shared editor; destructive action is not a live publish.

### 8.8 Device preview switches

**Desktop**, **Tablet**, **Mobile**; default Desktop. Suggested stage widths 1440/768/375 logical CSS pixels, scaled to fit available canvas. Layout width transforms ≈260–300ms with content reflow driven by the same SSR components and theme tokens. Never claim a tablet view is a separate published version.

### 8.9 Below-editor strip

- **Layout Assignment** — compact count and **View Assigned Pages** link.
- **Popular Page Templates** — small preview cards (Lead Generation, Product Landing, About Us, Contact), selecting one opens template preview/creation flow, **not** silent assignment.
- Counts and titles must come from data or clearly labelled catalog examples.

---

## 9. Page Template center editor

### 9.1 Template preview structure

A selected template (example **Lead Generation**) displays its initial page composition as native typed block sections. Screenshot example:

1. Hero.
2. Benefits/features.
3. Program cards.
4. Conversion CTA.
5. Footer **from assigned master layout**, or an explicit footer section if standalone template model supports it.

**Crucial invariant:** Do not duplicate master-layout chrome into every page template and then render it a second time. The preview distinguishes **template-owned blocks** from the **master layout's shared regions**.

### 9.2 Template metadata [VISUAL / DESIGN]

- **Template Name *** (required editable field for authorized user-owned template).
- **Category** dropdown: **Marketing & Conversion**, **Information**, **Programs**, **Contact**, **Other** (suggested taxonomy).
- **Assigned Layout** dropdown: available master layouts of selected site plus **Use Website Default**.
- **SEO-ready** badge/toggle: **[DESIGN]** treat as a checklist/report summary rather than a universal guarantee of rankings; must validate metadata and heading/route defaults.
- Template summary, status, owner, last edited, usage count where available.

### 9.3 Page template editor behavior

- **Edit template sections:** using the same native block editor primitives as Module 4, in a template-specific draft, or **Open in Visual Builder**.
- **Save Template:** validated revisioned persistence; no modifications to existing pages or live site.
- **Preview on Sample Pages:** non-destructive preview with chosen layout and sample content.
- **Duplicate Template:** creates new independently editable template revision with remapped IDs.
- **Create Page from Template:** requires name, target site, parent/route and assigned layout selection; creates page *draft* with fresh block IDs and unique references, then opens Module 4 Visual Builder.
- **Delete Template:** guarded; built-in templates cannot be deleted by ordinary site users; copied pages remain independent.

### 9.4 Safe template application

On `Create Page from Template` show:

**Title:** Create Page from Template  
**Selected Template:** Lead Generation  
**Fields:** Page Title *, Parent Page (optional), URL Slug *, Layout (Use Default / choose authorized layout), Default Locale (inherited).  
**Actions:** **Cancel**, **Create Page**.  
**On success:** **Page draft created.** → **Open Visual Builder**.  
**No automatic publication.**

If “Apply to Existing Page” is ever added **[PROPOSED]**, require side-by-side diff and an explicit replace/merge choice on a working draft, never overwrite published content silently.

---

## 10. Right inspector — three tabs

The right inspector is contextual: tabs stay **Overview | Structure | Usage**, but their contents differ for a master layout vs page template. All fields are permission-aware and changes remain draft-only until release.

### 10.1 Overview — Master Layout

**Header:** selected layout name; status chips such as **Draft**, **Valid**; optional live-version indicator.

**Fields / controls:**

| Control | Type / choices | On change |
|---|---|---|
| Layout Name * | Text field | Validated draft edit; trim whitespace; show duplicate-name policy |
| Default for Website | Toggle | Requires confirmation if replacing previous default; updates draft default binding/policy |
| Header | Dropdown: Global Header v2 / Minimal Header / No Header where valid | Preview selected variant; save draft reference only |
| Footer | Dropdown: Global Footer v1 / Minimal Footer / No Footer where valid | Preview selected variant; warn about impacted pages |
| Slot | Dropdown: Main Content (or approved schema slot) | Required; invalid options disabled |
| Applied To | Drilldown row | Open Usage tab / assigned pages |
| Preview on Sample Pages | Text CTA | Open authenticated preview with sample page |
| Save Master Layout | Primary sticky violet CTA | Validate, CAS-save draft revision, show save result |

**Status separation:** `Draft` describes revision lifecycle; `Valid` describes schema validation; `Published` describes inclusion in the authoritative live release. These chips are not mutually interchangeable.

**Default toggle warning copy:** **Set this as the default layout for new and eligible pages? Pages with explicit layout overrides will remain unchanged.** Buttons **Cancel** / **Set as Default**.

**Header/Footer dropdown handling:** anchored popover with selected checkmark, optional preview thumbnail, **Edit Shared Header** / **Edit Shared Footer** route when allowed. Never represent a dropdown selection as immediate public modification.

### 10.2 Overview — Page Template

**Header:** Page Template: {name}; badge **Built-in** / **Workspace** / **This Site** if supported by ownership model (do not invent scopes not stored in data model).

**Fields:** Template Name *, Description, Category, Layout assignment, optional SEO starter metadata summary (not an unconditional ranking guarantee), thumbnail preview, current draft revision.

**Actions:** **Save Template**, **Create Page from Template**, **Preview on Sample Pages**, **Duplicate Template**, optional validated export; deletion guarded.

**Existing page impact:** none until a new page is created or an explicitly approved page replacement is performed.

### 10.3 Structure — Master Layout

**Purpose:** Explain composition, order and allowed structural controls.

**Top controls:**
- **Expand All** / **Collapse All**.
- **Swap Header Variant** (approved variants only).
- **Reorder Regions** if approved typed region schema supports it.

**Tree rows:**
1. **Announcement Bar** — optional.
2. **Header** — shared/locked reference.
3. **Main Content Slot** — required.
4. **Footer** — shared/locked reference.

**Row UI:** drag grip if movable; chevron; type icon; name; Required/Optional/Locked badge; visibility toggle only if allowed; `•••` action menu.

**Row detail content:** typed reference and assignment controls where supported, brief usage warning, edit/swap action.

**Important constraints:**
- Never allow removal of required main content slot.
- Do not arbitrarily hide required slot in published view.
- Do not allow header/footer variant removal that leaves invalid references.
- Restrict reorder to predefined permitted region order. A screenshot drag grip is not evidence of generalized freeform positioning.
- **[PROPOSED]** Per-page visibility and group targeting require explicit validated rule model; defer unless approved.
- **[DESIGN]** Global shared regions display lock icon and **Changes to this region may affect all assigned pages when published**.

**Footer action:** **+ Add Optional Region** only if typed region catalog exists; otherwise hide in Phase 1.

**Keyboard reorder:** accessible move up/down actions where drag exists; announcements describe new order or rejected target.

### 10.4 Structure — Page Template

Show native block-section tree with section names and types, required/optional schema properties, collapse/expand, drag ordering where valid and edit links to the template's Visual Builder. No arbitrary HTML nodes. If template composition is read-only, explain **Edit this template in Visual Builder** rather than displaying inert drag handles.

### 10.5 Usage — Master Layout

**Header:** **Applied to {count} pages**.

**Metadata (if supported):** Last Updated, Owner, Recently Edited By.

**Page group cards:** Main Pages, Landing Pages, Program Pages, University Pages, Information Pages, Other — examples only; actual groups must be defined and totals deduplicated.

**Assigned Pages table columns:** Page Name, Layout, Status, Last Updated, Actions. Pagination/search for long lists.

**Row actions:**
- **Open Page** → Module 3 Pages details / Module 4 Visual Builder as appropriate.
- **View Assignment** → page/layout binding details.
- **Preview Page With Layout** → authenticated draft preview.

**Quick links:** **View Assigned Pages**, **Open Template Library**; **Bulk Reassign** is [PROPOSED] and must be hidden until impact-preview, transaction and role policy are approved.

**Counts:** differentiate total bindings, explicit overrides and inherited-default resolution, and published vs draft assignments when necessary; use source data rather than screenshots.

### 10.6 Usage — Page Template

**Usage meaning:** pages *created from* a template, not pages whose content automatically tracks ongoing template edits.

Show provenance table if stored (page title, created date, creator, current status), template revision used, and link to page. If provenance was not recorded, show **Usage history unavailable** rather than invent counts.

---

## 11. Complete CTA and resulting screen matrix

| Screen/source | Control | On click / result | Presentation |
|---|---|---|---|
| Header | Website selector | Authorized site selection + dirty guard | Searchable popover |
| Header | Preview Layout | Authorized draft/sample page preview | Modal/full-page preview |
| Header | + Create Layout | Start master layout creation | Modal / wizard |
| Header (template mode) | + Create Template [DESIGN] | New template workflow | Modal |
| KPI | Master Layouts | Open Master Layouts tab | Inline |
| KPI | Page Templates | Open Page Templates tab | Inline |
| KPI | Pages Assigned | Open Usage / assigned pages | Inspector or page |
| KPI | Draft Changes | Open pending revisions | Drawer or publishing destination |
| Left | Master Layouts tab | Show layout list | Inline |
| Left | Page Templates tab | Show template list | Inline |
| Left | Search | Filter active list | Inline |
| Left | Layout row | Select layout | Canvas+inspector refresh |
| Left | Template row | Select template | Canvas+inspector refresh |
| Layout row menu | Open Layout | Select editor | Inline |
| Layout row menu | Preview on Sample Pages | Choose sample + inspect | Modal/full preview |
| Layout row menu | Duplicate Layout | Confirm new independent layout | Modal |
| Layout row menu | Rename Layout | Rename and validate | Dialog |
| Layout row menu | Set as Website Default | Show impact then confirm | Dialog |
| Layout row menu | View Assigned Pages | Switch inspector Usage | Inline |
| Layout row menu | Delete Layout | Dependency checks and guarded action | Modal |
| Template row menu | Preview Template | Preview draft template | Preview |
| Template row menu | Create Page from Template | Page-creation flow | Wizard |
| Template row menu | Duplicate Template | Clone template and remap IDs | Modal |
| Template row menu | Rename Template | Validated rename | Dialog |
| Template row menu | Delete Template | Ownership/dependency guard | Modal |
| Editor | Announcement region | Select editable region | Outline + inspector |
| Editor | Header region | Select shared chrome reference | Outline + inspector |
| Editor | Main Content Slot | View slot contract, preview content | Selected slot overlay |
| Editor | Footer region | Select shared chrome reference | Outline + inspector |
| Editor | Desktop / Tablet / Mobile | Change viewport | Canvas resize |
| Editor | Drag/reorder grip | Reorder allowed regions | Drop line + preview |
| Editor | Duplicate / Delete region | Schema-guarded action | Inline or confirm |
| Inspector | Overview | Editable metadata and assignment | Tab |
| Inspector | Structure | Region tree and structural controls | Tab |
| Inspector | Usage | Assigned/derived pages and metadata | Tab |
| Inspector | Layout Name | Edit draft value | Inline field |
| Inspector | Default toggle | Show affected binding policy | Confirm dialog |
| Inspector | Header dropdown | Select authorized variant | Popover |
| Inspector | Footer dropdown | Select authorized variant | Popover |
| Inspector | Slot dropdown | Choose schema-valid slot | Popover |
| Inspector | View Assigned Pages | Open scoped page registry | Full page/drawer |
| Inspector | Preview on Sample Pages | Select sample and preview | Modal |
| Inspector | Save Master Layout | Validated CAS draft save | Inline loading+toast |
| Inspector | Save Template | Validated template draft save | Inline loading+toast |
| Inspector | Create Page from Template | Create new page draft | Wizard → Module 4 |
| Inspector | View Usage row | Navigate to page/assignment | Page/drawer |
| Inspector | Bulk Reassign [PROPOSED] | Impact preview + confirmation | Protected flow |

Actions in this table are **contracts** to implement or expressly gate. No table entry implies a functioning route or existing API solely because a mockup shows a button.

---

## 12. Dialogs, menus and exact microcopy

### 12.1 Rename layout

**Title:** Rename Master Layout  
**Field:** Layout Name *  
**Info:** Renaming does not change public page routes.  
**Buttons:** Cancel / Save Name  
**Success:** **Layout renamed.**

### 12.2 Duplicate layout

**Title:** Duplicate Master Layout  
**Field:** New Layout Name *  
**Info:** Creates a separate draft layout. Existing page assignments will not automatically move.  
**Buttons:** Cancel / Duplicate Layout  
**Success:** **Layout duplicated.**

### 12.3 Delete layout in use

**Title:** Cannot Delete Layout  
**Body:** **This layout is assigned to {n} pages or retained by a published release. Reassign eligible pages before deleting the draft resource.**  
**Buttons:** View Assigned Pages / Close  
No destructive confirmation button in a blocked state.

### 12.4 Delete eligible layout

**Title:** Delete Master Layout?  
**Body:** **This removes the editable layout record according to retention policy. It does not rewrite historical published releases.**  
**Confirmation:** Type layout name if destructive action policy requires.  
**Buttons:** Cancel / Delete Layout (red).  
**Success:** **Layout deleted.**

### 12.5 Set default layout

**Title:** Make Website Default?  
**Body:** **This layout will be used by pages configured to inherit the website default. Pages with explicit layout selections will not change. Changes become public only when published.**  
**Buttons:** Cancel / Set as Default.

### 12.6 Unsaved navigation guard

**Title:** You Have Unsaved Layout Changes  
**Body:** **Save your draft before switching, or discard these local edits.**  
**Buttons:** Cancel / Discard Changes / Save Draft.  
Avoid invoking browser-native dialog unless unavoidable.

### 12.7 Template deletion

**Title:** Delete Template?  
**Body:** **New pages will no longer be able to start from this template. Existing pages created from it will remain unchanged.**  
**Buttons:** Cancel / Delete Template (red); show **Protected built-in template** when delete not permitted.

### 12.8 Save conflict

**Title:** Layout Draft Changed Elsewhere  
**Body:** **Another editor saved a newer revision. Review the latest version before applying your changes.**  
**Buttons:** Review Latest / Compare Changes (if implemented) / Cancel.  
Do not silently overwrite newer revisions.

### 12.9 Template creation success

**Title/Toast:** **Page draft created.**  
**Body:** **The template has been copied to a new editable page.**  
**Actions:** Open Visual Builder / View Pages.

### 12.10 Import/export distinction

The blueprint explicitly specifies JSON **theme preset** import/export (Module 6), not arbitrary **page-template** import/export under Module 7. Any **Export Template** entry in the image is [PROPOSED] and must be hidden or disabled with an explanation until a schema-safe interchange format and tenant-safe import validation are approved.

---

## 13. Full UI state matrix and handling

| State | Appearance | Behavior | User action |
|---|---|---|---|
| Idle/default | Neutral surfaces, selected current layout/template | Show authorized records, draft/live indicators | Select record |
| Hover | Subtle violet/neutral tint, contextual action revealed | No data mutation or layout shift | Click/menu |
| Keyboard focus | Visible focus ring | All menus, rows, tabs actionable | Enter/Space |
| Selected | Violet row, region outline, active inspector tab | Keep selection synchronized across panes | Edit/view |
| Searching | Search text, results update | Scope to active library tab | Clear/search |
| No results | **No matching layouts/templates** | No fabricated rows | Clear search |
| Empty site | **No master layouts yet** or **No page templates available** | Offer safe creation/curated starter | Create |
| Initial loading | Geometry-matched skeleton rows/editor | Avoid blank jumps | Await |
| Partial loading | Current inspector shows local skeleton | Preserve unaffected panels | Await |
| Dirty/unsaved | **Unsaved changes** marker | Do not switch silently | Save/cancel/discard |
| Saving | Button disabled, **Saving draft…** | Revision-aware write; prevent duplicate submit | Await |
| Draft saved | **Draft saved** + timestamp | No live-site mutation | Preview/publish separately |
| Validation pending | **Validating…** and affected control | Validate schema and slot refs | Await |
| Validation failed | Inline red message/summary | Block save if invalid | Fix fields |
| Valid draft | **Schema valid** chip | Ready for potential manifest preflight; not yet live | Publish via release module |
| Invalid slot | Required slot missing/duplicated | Block save/publish; highlight slot | Repair |
| Broken shared ref | Header/footer/menu variant missing | Explain affected pages | Choose valid reference |
| Drag start | Elevated region ghost, grip selected | Only allowed region draggable | Move |
| Drag over valid | Violet insertion line | Show target reorder preview | Drop |
| Drag over invalid | Muted indicator; no-drop | Explain slot/locked rule | Cancel |
| Drop success | Tree/canvas reorder, dirty flag | One undoable draft operation | Save |
| Save conflict | Blocking conflict dialog | Do not overwrite remote revision | Review latest |
| Permission denied | Read-only inspector, hidden/disabled write CTA | Server enforces authorization | View/request access |
| In-use delete blocked | Guard modal with dependency count | Do not remove | Reassign or close |
| Error/network | Local panel error; last valid state retained | Retry non-destructive request only | Retry |
| No sample page | **Choose a page to preview this layout** | Cannot fabricate rendered preview | Select page |
| Preview loading | Skeleton inside preview viewport | Existing editor remains stable | Await |
| Preview error | **Preview unavailable** + Retry | Do not imply live error automatically | Retry |
| Successful create | Confirmation toast + selected new draft | New layout/template exists | Edit |
| Successful save | Confirmation toast + revision/timestamp | Draft persisted | Continue |
| Published inclusion | **Published in Release {id}** | Derived from authoritative live release | View release |
| Retained-history use | Protection/lock indication | Historical referenced revisions stay available | Inspect |
| Concurrent publish CAS conflict | Publishing conflict dialog in release module | Never silently overwrite | Review latest |
| Archived/deleted record | Not selectable or clearly marked per policy | Show recovery/retention policy only if supported | Navigate |

### 13.1 Disambiguate revision and validation state

`Draft`, `Unsaved`, `Valid`, `Published`, and `In Use` are **independent** concepts. A draft revision can be schema-valid but unpublished; a currently published layout can have newer unsaved local changes. UI must present those distinctions, never replace “Draft” with “Published” merely because save succeeded.

### 13.2 Partial failures

Search failure should not erase current valid canvas; Usage failure should display error only inside Usage tab; preview failure should not disable a valid draft save. Errors for source data must identify the affected region.

---

## 14. Hover, selection and motion choreography

### 14.1 Recommended motion tokens

- **Micro:** 120–180ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Layout:** 220–300ms `cubic-bezier(0.2, 0, 0, 1)`.
- **Popover:** 160–180ms opacity 0→1 and scale .97→1.
- **Modal:** 220–240ms opacity + scale .96→1.
- **Drawer:** ~280ms right-to-left slide plus backdrop fade.
- **Skeleton:** 1400ms low-contrast shimmer; static when reduced motion.

| Element | Duration | Exact visual change |
|---|---|---|
| Sidebar row hover | 120ms | Background tint and icon contrast, no movement |
| Left library row hover | 120ms | Light neutral tint; overflow appears |
| Left library selection | 180ms | Violet border/tint transition |
| Tab indicator | 180–220ms | Indicator position/opacity interpolate |
| KPI hover | 160ms | Shadow + border emphasis, max 2px lift |
| Region hover | 120–160ms | Thin violet region outline + label |
| Region select | 150ms | Bounding box and handles fade in |
| Region drag ghost | Follow pointer | Transformed clone, elevated shadow, 0.85 opacity |
| Valid insertion guide | 120ms | Violet line fades/scales into place |
| Invalid drop | Immediate | No-drop cursor and concise reason; no shake requirement |
| Region reorder settle | 220–280ms | Neighboring rows translate to final positions |
| Canvas device switch | 260–300ms | Viewport width interpolate, content reflow |
| Accordion expand/collapse | 200–260ms | Measured content-height transition, no max-height guessing |
| Inspector field focus | 120ms | Border and focus-ring change |
| Dropdown | 180ms | Fade and scale, anchored position stable |
| Toast | 280ms in / 180ms out | Fade + translateY(8px) |
| Save-success check | 240ms | SVG path reveal or opacity fade |
| Overlay conflict | 240ms | Modal scale/fade; focus trapped |
| Search results | 140–200ms | Short crossfade, avoid full list stagger on every key |

### 14.2 Functional motion constraints

- No long animation before a save begins or error becomes visible.
- Drag must not mutate backend on every frame; commit after valid drop and draft save.
- Viewport switch should preserve selected region, scroll location when possible and focused editor control.
- **Reduced motion:** remove decorative translations, pulsing and shimmer; keep state/status visibly distinguishable.
- Keyboard accessible reordering must not rely on pointer animation.

---

## 15. Data model and endpoint contracts (conceptual)

### 15.1 Authoritative entities [BASE]

- `master_layouts`: site-scoped layout identity/metadata.
- `layout_revisions`: immutable or revisioned layout content snapshots.
- `page_layout_bindings`: explicit site/page-to-layout assignment semantics.
- `page_templates`: template identity and scope.
- `template_revisions`: versioned template snapshots.
- `sites`: includes `live_release_id` and `previous_release_id`.
- `releases` / `release_items`: frozen release manifest, including the chosen layout revisions.

The blueprint names these tables but does not enumerate every field or complete CRUD API; **do not treat the following proposed fields/endpoints as pre-existing**.

### 15.2 Proposed fields [PROPOSED]

- `master_layouts`: `id`, `organization_id`, `site_id`, `name`, `is_default`, `created_at`, `updated_at`, `created_by`, `draft_revision_id`.
- `layout_revisions`: `id`, `organization_id`, `site_id`, `layout_id`, `revision_no`, `schema_version`, `content_tree`, `content_hash`, `author_id`, `created_at`.
- `page_layout_bindings`: `organization_id`, `site_id`, `page_id`, `layout_id` or explicit inherit-default mode; enforce unambiguous effective layout.
- `page_templates`: `id`, `organization_id`, `site_id` or workspace scope if approved, `name`, `category`, `created_by`, `draft_revision_id`.
- `template_revisions`: template ID, version, schemaVersion, page block tree and optionally explicit allowed defaults.
- Optional provenance relation: page ID, source template ID, source template revision ID.

Where a field is not supported, omit its UI feature rather than backfilling untrusted placeholder data.

### 15.3 Conceptual API operations

- List layouts/templates for authorized site.
- Read selected layout/template, current draft revision and associated usage.
- Create layout/template draft.
- CAS-save layout/template draft with `expectedRevision`.
- Validate layout structure and shared LinkRefs.
- Set default layout (with impact guard).
- Update explicit page binding (permission-checked).
- Preview layout with authorized sample page (revision/scope pinned).
- Duplicate layout/template with ID remapping.
- Delete eligible resource after dependency checks.
- Create page draft from template revision.
- Read current live release membership for published-status indicators.

API paths, verbs, schemas and RPC names are to be finalized in actual repository implementation; they are intentionally not invented here.

### 15.4 Effective layout resolution [DESIGN]

For each page in frozen release:

1. Resolve any explicitly bound layout revision for that page.
2. Otherwise resolve the release-frozen default master layout revision.
3. Verify one required content slot and inject the page's release-frozen block tree.
4. Resolve menu, header/footer variants, CSS tokens and LinkRefs from **the same release manifest**.
5. Failure to resolve required layout/slot is a preflight blocker, not a runtime silent fallback to an arbitrary draft.

### 15.5 Public runtime behavior

Public request resolves site and `live_release_id` once, renders the frozen layout + page content + theme + menu using Nitro SSR and no authoring React hydration. Layout changes purge site-scoped cached content through the transactional outbox/pg-boss pipeline; do not claim global edge visibility faster than measured CDN behavior.

---

## 16. Validation and preflight rules

**Draft edit validation:**
- Layout JSON tree matches native Zod schema/version.
- Exactly one required primary content slot under chosen Phase-1 rule.
- No invalid parent/child composition or unsupported region type.
- Header/footer/menu references exist and are tenant/site-safe.
- LinkRefs are valid; external URL rules respected.
- Theme tokens are defined/compilable for used components.
- Template starter block tree is schema-safe and ID-independent when instantiated.
- Required title/metadata fields validated; duplicate names handled per policy.

**Publish preflight [BASE]:** Freeze manifest then check all layout/page/menu/token/SEO/form relationships together; missing slots, inactive linked targets, missing assets and broken references block publish. Preflight is not a visual “Valid” chip alone; it evaluates the exact immutable manifest later CAS-published.

**Deletion guard:** Prevent deletion of resource referenced by live/retained manifests or current page bindings, regardless of what client says. Where archive soft-deletion is supported, retain immutable published revision rows.

---

## 17. Permission and tenant policy

**Blueprint role families:** Owner, Admin, Manager, Editor, Viewer (precise capability mapping must be confirmed from implemented RBAC).

**Suggested minimal mapping [DESIGN]:**

| Capability | Suggested access | Backend guard |
|---|---|---|
| View layout/template catalog | Authorized Viewer+ | Organization/site membership |
| Preview authorized draft | Editor+ or explicit preview permission | Read draft permission |
| Create/edit/save layout | Site Designer/Editor+ with layout-edit permission | `requireRole`/capability and site scope |
| Create/edit page template | Authorized Editor+ | Template management permission |
| Change default layout | Admin/Manager or explicit layout-governance capability | Transactional guard and audit |
| Reassign page binding | Authorized page/layout manager | Page and layout scope checks |
| Delete layout/template | Admin/Owner or explicit destructive capability | Dependency/retention checks |
| Publish site release | Authorized publisher | Frozen manifest + CAS preflight |
| View usage by other authors | Role-scoped access | No unauthorized user data |

Protect all reads/writes using `withTenant` context and composite `(organization_id, site_id)` FKs. Never trust client-provided site IDs alone; every page/template/layout reference resolves within authorized workspace/site context. Ensure data visibility does not leak across workspaces through thumbnail URLs, cache entries, search results or preview tokens.

---

## 18. Empty, first-run and lifecycle flows

### 18.1 Brand new site

Show: **Set up your website layout** with starter options **Default Website Layout** and **Blank Landing Layout**; selecting creates the required slot layout draft. Do not invent a globally default layout until explicitly created by template/site provisioner. If site bootstrap guarantees one default [PROPOSED], document and test that invariant.

### 18.2 No page templates

Show: **No page templates yet**; explain **Save any eligible page as a template from Visual Builder**, or offer curated built-in templates if shipped. CTA **Open Visual Builder** / **Create From Starter**, whichever is actually available.

### 18.3 Required slot deleted / invalid draft

Immediately show inline error: **Main Content Slot is required and cannot be removed.** Prevent save, restore via Undo or **Add Required Slot** action. Do not allow invalid structure to reach release preflight silently.

### 18.4 Layout replacement across many pages

Before making default change or explicit reassignment, show number of potentially impacted pages and that **changes go live only after publishing**. Preserve explicit overrides. In-use counts must be trustworthy.

### 18.5 Template update after pages created

Show informational text: **Existing pages created from this template will not be updated automatically.** This is critical to avoid implying linked inheritance that the blueprint does not define.

---

## 19. Accessibility, keyboard and internationalization

- Tabs implement proper `tablist`, `tab`, `tabpanel` semantics and keyboard arrows.
- Layout/tree rows expose `aria-expanded`, selected state and drag alternative commands; locks have textual explanations.
- Dropdowns support arrow keys, Enter/Space, Escape, selected checkmark and outside-click dismissal; remain within viewport.
- Modal dialogs trap focus, announce title/description, return focus to trigger, and do not dismiss destructively on accidental outside click.
- Status “Draft”, “Valid”, “Published”, “In Use” use text plus icon, not color alone.
- Canvas preview has accessible control summary or tree alternative for nonvisual editing.
- Buttons/icons have descriptive accessible labels: **Edit header**, **Duplicate layout**, **Delete optional announcement**, **Switch to tablet preview**.
- Color contrast follows WACRM accessibility standard; visible focus not dependent on hover.
- Dates use user's locale/timezone; content labels support localization where authorized, without implying full multilingual layout creation in this module.
- Reduced-motion behavior applies to all transitions and load states.

---

## 20. Performance, reliability and collaboration

- Fetch layout/template metadata separately from heavier selected revision and Usage list; cache with tenant/site keys.
- Avoid rendering all template previews simultaneously at full resolution; use approved thumbnails and lazy loading.
- Independently handle canvas, library and inspector failures; keep last successful content visible when safe.
- Debounce draft autosave if aligned with the Visual Builder's **2-second** revision-aware CAS flow; ensure explicit Save CTA does not race the pending autosave.
- Preserve `expectedRevision` and show conflict UX rather than last-writer-wins.
- Usage lists paginate; do not load all assigned pages just to render a summary count.
- Background publish cache invalidation uses existing outbox queue; do not implement a second direct purging path.
- Preview must pin the layout revision, sample page revision, tokens/menu reference and site context to avoid mixed-version rendering.
- Record audit events for create, update, default assignment, delete attempt, publish inclusion and explicit reassign actions.
- Test edge cases where default binding changes while someone edits a page draft.

---

## 21. Source-alignment and Phase-1 exclusions

### Explicit blueprint requirements

- Master header/footer layouts.
- Explicit content slot injection.
- Website default and specialized page layout assignment.
- `master_layouts`, `layout_revisions`, `page_layout_bindings`.
- Full-page starter template library.
- Save Page as Template.
- `page_templates`, `template_revisions`.
- Guarded delete of layout in use / template.
- Native block schema, release manifests, CAS publishing and tenant isolation.

### Mockup-only or recommended implementation decisions

- Four KPI cards and precise sample counts.
- Three inspector tabs Overview/Structure/Usage.
- Optional announcement region and explicit header/footer variant selectors.
- Color/status chips and right-side sticky Save controls.
- Editable page-template SEO-ready toggle.
- Page groups and detailed Usage table.
- Exact entry names, page owner names and timestamps.
- Bulk Reassign and customizable region reorder.
- Export Template independent of Theme Studio export.

### Explicitly deferred until separately specified

- Arbitrary reusable nested regions or several user-defined slots.
- Generalized conditional visibility targeting across audiences/pages.
- Global live-updating page-template inheritance into existing pages.
- Raw HTML/CSS/JS editors.
- Live editing of published release without preflight/CAS.
- Staging environment dropdown and scheduled site publishing (Phase 2).
- Unreviewed mass reassignment without impact and audit guarantees.

---

## 22. Complete QA test matrix

### Functional

- [ ] Site switch updates all scopes, selection and counts; dirty-edit guard works.
- [ ] Master Layouts and Page Templates tabs show correct authorized data.
- [ ] Search, selected row, overflow menu and no-results state work.
- [ ] New master layout has required content slot.
- [ ] Default layout can be changed safely; explicit page overrides remain intact.
- [ ] Each page resolves exactly one effective release-frozen master layout.
- [ ] Header/footer variant selectors show valid site-safe references.
- [ ] Region selection and inspector changes remain synchronized.
- [ ] Invalid slot delete/reorder is rejected with explanation.
- [ ] Desktop/tablet/mobile previews render actual relevant structure.
- [ ] Layout Usage reflects page assignments accurately.
- [ ] Page templates preview and create independent new draft pages with remapped block IDs.
- [ ] Editing a template does not retroactively modify pages created previously.
- [ ] Save Master Layout persists only a draft revision.
- [ ] Template save persists only template draft/revision.
- [ ] Preflight detects broken layout/menu/slot references before publication.
- [ ] Published release renders page and layout from the same immutable manifest.
- [ ] In-use layout delete is blocked; retained release safety preserved.
- [ ] Delete eligible resource leaves an audit trail.

### States and accessibility

- [ ] Loading, partial error, empty, no-results, dirty, saving, validation, conflict, success, permission, blocked delete and published states exist.
- [ ] No status badge conflates valid with published.
- [ ] Every visible CTA has a real route/action or a clearly disabled explanation.
- [ ] Dropdown keyboard navigation, Escape, focus return and anchor flipping work.
- [ ] Modal focus trapping and accessible validation announcements work.
- [ ] Keyboard user can select structure rows and use alternatives to drag.
- [ ] Hover does not shift text/layout.
- [ ] Reduced motion removes shimmer and spatial animation.

### Security, concurrency, performance

- [ ] Organization/site scoped queries enforce RLS and composite keys.
- [ ] Cross-site layout/template IDs are rejected at API and DB layers.
- [ ] Preview authorization prevents exposure of unpublished pages.
- [ ] CAS draft-save conflict cannot silently overwrite remote changes.
- [ ] Publish CAS conflict preserves current live release.
- [ ] Concurrent default changes follow approved transaction rule.
- [ ] Preview and catalog caches do not leak across tenants.
- [ ] Usage lists paginate; thumbnail previews lazy-load.
- [ ] Publishing and rollback preserve release-frozen layout revisions.

---

## 23. Open implementation decisions requiring owner sign-off

1. Does the product bootstrap a default master layout during site creation? Which starter is guaranteed?
2. Is **exactly one required main slot** the chosen Phase-1 constraint, or does the validated schema permit more?
3. Are announcement/header/footer stored as layout-owned native nodes or separately shared variant references? How do they interact with Menus & Navigation?
4. Does an explicit page binding freeze a layout *identity* resolved to the release version, or a specific revision? Define the manifest contract precisely.
5. How does default resolution work for older pages and pages imported from templates?
6. Does the `Save Master Layout` CTA use the Visual Builder's 2-second autosave and CAS endpoint, or a separate explicit save? Avoid competing write flows.
7. Are page template drafts site-scoped only or can workspaces share them? The blueprint names the tables but does not settle full scope metadata.
8. Do templates record provenance from pages created from them, making Usage meaningful?
9. Is `Delete Template` soft delete, hard delete or archive? Which retained references block it?
10. Is the full template editor inside Module 7 or delegated to Module 4 Visual Builder?
11. Are page-group visibility controls and arbitrary region reordering intentionally allowed in Phase 1? Default recommendation: no.
12. Is bulk reassignment necessary at launch? Default recommendation: defer.
13. What are exact permitted role capabilities for default change, layout edit and template delete?
14. What precise counts/filters populate the four KPI cards across site and workspace scope?
15. Is export of page templates supported, or only the separate JSON **theme preset** import/export already specified by the blueprint?
16. Does template SEO-ready represent simple defaults/checks or a publish validation result? Never imply a ranking guarantee.

---

## 24. Independent reviewer instructions

Act as Principal Enterprise Product Architect, Senior UI/UX Designer, React/Zod Schema Architect and PostgreSQL Tenant-Isolation Reviewer. Compare this Module 7 document with `CLAUDE_PROPOSAL.md` and the five approved Module 7 UI reference images. Classify each requirement as **[BASE]**, **[VISUAL]**, **[DESIGN]**, **[PROPOSED]** or **[DEFERRED]**. Identify incorrect assumptions, unnecessary feature growth, missing UI states, data model constraints, template-vs-layout inheritance ambiguity, security gaps, and mismatches with the authoritative release architecture. For every finding provide severity, evidence, impact, correction, required Phase-1 or optional priority, and the relevant owner. Do not treat screenshots as working application evidence.

---

## 25. Final product contract

Module 7 provides a **simple, governed, native** system for master website shells and reusable page starters. It keeps the two left tabs (**Master Layouts | Page Templates**), three right tabs (**Overview | Structure | Usage**), violet CTAs, and familiar WACRM desktop shell. Shared headers/footers are governed through layout revisions; page-specific blocks are injected only through explicit validated slots; templates create fresh drafts rather than linking live content. Every save is a draft operation, every public change goes through manifest preflight and atomic publishing, and every destructive action checks usage and retained-release dependencies. Advanced conditional regions, arbitrary reorder and bulk assignment remain optional/deferred until separately justified and implemented.

**End of Module 7 — Layouts & Templates Desktop Specification.**
