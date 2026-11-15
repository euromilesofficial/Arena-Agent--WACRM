# EUROMILES WACRM — NATIVE WEBSITE CMS
## MODULE 6: DESKTOP THEME STUDIO
### Complete Product Architecture, Tab/Control Contracts, CTA Flows, Working States, Motion, Security, Validation, and Acceptance Specification

**Specification version:** 1.0 — proposed implementation contract for architectural review
**Date:** 15 November 2026
**Application:** `wacrm-app`
**Navigation:** Website CMS → **Theme Studio**
**UI module sequence:** **Module 6** (the sixth approved desktop screen, after Block Library)
**Architectural mapping:** `CLAUDE_PROPOSAL.md` → Domain 02, **Module 2.2 Theme Studio & Design Token System**, **Module 2.3 JSON Theme Preset Importer & Exporter**, with dependencies on Modules 2.1, 3.x, 5.x, 6.x, 8.x and 11.x.
**Primary personas:** Brand Designer, Site Manager; Admin/Owner for controlled site-wide preset or destructive operations, subject to actual role policy.
**Companion specifications:** Modules 1–5, especially Module 4 Visual Builder and Module 5 Block Library.
**Implementation status:** This is an actionable design/specification derived from source architecture and reference images; it does **not** assert these interfaces, API routes, or analytics are already implemented.

## 0. Scope labels and source-of-truth rules

Use labels consistently:

- **[BASE]** Explicit in `CLAUDE_PROPOSAL.md`: governed brand tokens, self-hosted fonts, discrete geometry, Zod-validated JSON presets, SSR CSS variables, organization/site isolation, immutable release manifests and CAS publication.
- **[VISUAL]** Visible in one or more generated Theme Studio mockups, including alternative states.
- **[DESIGN]** Detailed behavior chosen to make the approved visual actionable; requires approval if it affects implementation scope.
- **[DEPENDENCY]** Already belongs to a different CMS module (Visual Builder, Pages, Layouts, Publishing, Assets, Security).
- **[DEFER]** Not required in Phase 1; do not build as an implicit consequence of a screenshot.

**Fundamental contract:** The three primary tabs are **Brand Tokens | Typography | Presets**. The center is a **read-only responsive preview** and the right is a **Theme Overview**. The layout remains the approved dark WACRM sidebar + light workspace with **violet primary CTAs**, despite one alternate generated mockup showing a white standalone navigation shell. Theme Studio is **not** a freeform CSS editor, a second Visual Builder, or a second Publishing module.

### 0.1 Source-derived architecture

From master proposal Domain 02:

1. Five core groups: **Primary/Secondary Colors**, **Heading/Body Fonts**, **Border Radius**, and **Container Width** (the combined grouping is called "5 core tokens" in its pipeline even though UI exposes their concrete values).
2. Color roles additionally include **background, surface and text**, with contrast calculation.
3. Discrete spacing steps and geometry are required; values compile to scoped CSS variables.
4. Google Fonts are **fetched, subsetted, stored in tenant storage and served self-hosted**, with CSP `font-src 'self'`.
5. `theme_token_sets`, `theme_tokens` are named data structures; exact current table migrations are not established by the Markdown alone.
6. JSON presets include color palette, typography, block styling, starter layouts and navigation; imports are Zod validated, IDs stripped/remapped; `theme_presets` is named.
7. Source-defined CTAs: **Save Brand Tokens**, **Reset to Defaults**, guarded **Delete Token Set**; **Apply Preset**, **Export Theme JSON**, guarded **Overwrite Active Preset**.
8. Tokens, layouts and menus are included in immutable publishing manifests; save does **not** automatically update the public live site.

### 0.2 Deliberate simplicity

Deliver a complete, understandable Phase 1 Theme Studio with these areas only. Do not introduce extra top-level tabs for shadows, animations, responsive design tokens, dark modes, AI themes, gradients, custom CSS, variable dependency graphs or a marketplace. Advanced block-level appearance belongs to the Module 4 right inspector; header/footer architecture belongs to Layouts & Templates.

## 1. Reference-image inventory and reconciliation

The approved series consists of the following visible design states, all from the same Theme Studio module:

| Ref | Screen/state depicted | Canonical implementation meaning |
|---|---|---|
| T01 | Original Theme Studio with open color picker, open font pairing selector, import drop zone and save toast | **Reference for editor controls**, not a single physically consistent state; popovers should be mutually managed and save/dirty messages must not conflict |
| T02 | Revised Brand Tokens editor with color-role contrast results, geometry and live preview | **Brand Tokens — standard editor** |
| T03 | Typography editor with font family/weights, fallback fields and pairing preview | **Typography — standard editor** |
| T04 | Brand Tokens accessibility warning and three-step Editing → Saved Draft → Published rail | **Validation warning and publishing-state explainer**, not evidence Publish is always enabled |
| T05 | Presets library showing Modern Violet / Ocean Professional / Warm Editorial, preset preview and JSON import review | **Presets — selection, safe import and apply** |
| T06 | Presets saved-list with `•••` menu and delete confirmation | **Preset management and guarded deletion** |

The generated images also show alternate card counts, dates, website copy, exact contrast ratios, statuses and navigation chrome. These are **illustrative**, never seed requirements or verified facts. Sample contrast ratios must be calculated by code for the actual foreground/background pair, not copied from the image. A green "Saved" toast cannot coexist as the *same revision state* with "Unsaved changes"; the latter may remain only if additional edits were made after the save, explicitly represented as a newer dirty revision.

## 2. Product purpose and mental model

**One sentence:** Theme Studio allows an authorized user to edit brand-wide visual design tokens, preview their impact, safely save a draft token revision, and include that revision in the next validated website release.

A user must be able to answer:

1. Which **website** am I editing?
2. Which **theme revision** is live, which is saved as a draft, and what is currently unsaved?
3. Which color and typography choices apply globally, and are important text/button contrasts readable?
4. How does the current draft look on desktop, tablet and mobile?
5. Can I apply a curated or imported preset without unexpectedly replacing website pages, master layouts or menus?
6. How do I safely save and then publish these changes?

Terminology:

- **Current live theme:** token revision referenced by the site's currently active immutable release.
- **Saved draft theme:** persisted revision not necessarily referenced by the live release.
- **Working edit:** unsaved local modifications to draft editor state.
- **Preset:** versioned, validated reusable JSON bundle; previewing/choosing one is not publishing.
- **Theme token:** whitelisted, typed design variable with semantic use.
- **Theme usage:** only an authorized, appropriately scoped summary of where tokens or preset are applied; not proof of individual page customization.

## 3. Desktop shell and layout

### 3.1 App chrome [VISUAL]

Preserve the full WACRM global sidebar used throughout Modules 1–5. It remains dark navy with Website CMS expanded, **Theme Studio** selected in the CMS list, and existing platform navigation unchanged. Header includes breadcrumb `Website CMS › Theme Studio`, global search, notifications, help and user avatar. It inherits keyboard, workspace switching and notification behavior from Module 1 rather than duplicating those screens.

### 3.2 Screen header [VISUAL]

- H1: **Theme Studio**.
- Subtitle: **Define brand colors, typography, and layout tokens for your website.**
- Site selector: `Website: EuroMiles Main ▾`.
- Secondary actions: `Import JSON`, `Export Theme JSON` (in the Presets screen they may appear within the tab instead; do not duplicate actions needlessly).
- Draft badge: `Unsaved changes` / `Saved draft` / `Up to date` / `Saving…`.
- Violet primary CTA: **Save Brand Tokens**.
- Optional disabled link/action: **Publish Theme** — should route through the existing Publishing & Releases workflow, never a competing direct publish implementation.

### 3.3 Three-column proportions [DESIGN]

- Left editor: ~350–390px preferred, `Brand Tokens | Typography | Presets`.
- Center preview: flexible, minimum useful width ~500px at wide desktop.
- Right overview: ~295–335px, summary, accessibility, usage and release status.
- Wide desktop reference ≥1440px, sidebar ~240–248px, global header 56–64px, main gutters 16–24px, cards 10–12px radius.
- When space is insufficient, right overview becomes a collapsible drawer or below-preview region; never shrink inputs into unreadability.

### 3.4 Colors and elevation

- Main workspace: white / near-white (`#F8F9FC` sample).
- Border: 1px neutral (`#E6E9F0` sample).
- Text: dark near-black (`#101828` sample).
- Primary action and active tab: **violet** (`#6941E8` sample).
- Green: **validation and success only** (`#16A34A` sample).
- Amber: unsaved/pending/warnings.
- Red: errors and guarded destructive controls.
- Use restrained 1–2px micro-elevations; selected tab indicator should not shift layout.

## 4. Complete high-level navigation and interactions

| Trigger | Result | UI surface | Guard/notes |
|---|---|---|---|
| Brand Tokens tab | Select color + geometry editor | Left in-place pane | Preserve working edits |
| Typography tab | Select font editor | Left in-place pane | No implicit save |
| Presets tab | Select preset list + import area | Left in-place pane | Applying is explicit |
| Website selector | Search authorized sites | Anchored popover | Switching with dirty edits requires Stay / Discard / Save Draft |
| Import JSON | Choose or drop `.json`, validate | File picker then review dialog/inline panel | Never blindly apply |
| Export Theme JSON | Download sanitized versioned JSON | Export flow | Site permissions, no secret refs |
| Save Brand Tokens | Validate and persist draft theme revision | Async button + toast | Live website unchanged |
| Reset to Defaults | Show delta and confirmation | Modal | Undo-safe draft operation |
| Publish Theme / Review for Publish | Open release preflight with token draft | Full Publishing screen | CAS publish, no direct public mutation |
| Desktop / Tablet / Mobile | Change canvas viewport | Center preview | Does not change page content |
| Overview → Token Summary | Show semantic swatches and values | Right in-place | Read-only |
| Overview → Accessibility | Show role-specific contrast tests | Right expandable panel | No fabricated "all pass" |
| Overview → Usage | Show authorized page/block/site applicability | Right expandable panel/full list | Derived/aggregated counts |
| Color swatch | Open color popover | Anchored popover | Valid hex, semantic contrasts |
| Font family | Open font selector | Combobox/popover | Only approved fonts/weights |
| Preset card Preview | Preview token bundle in center | Preview-only state | Never mutate saved draft |
| Preset card Apply | Open scope/diff review | Modal | Explicit confirmation |
| Preset card `•••` | Preset-specific actions | Menu | Role + built-in restrictions |
| Delete preset | Guarded confirmation | Modal | Cannot break references |

## 5. Brand Tokens tab — precise UI contract

### 5.1 Section structure

Top-level left pane contains:

1. `Colors` heading + explanatory copy.
2. Semantic color rows with swatch, hex input, copy icon, contrast result/issue icon.
3. `Geometry & Layout Tokens` heading.
4. Border Radius.
5. Spacing Scale (discrete).
6. Container Width.
7. `Reset to Defaults` secondary button.

If the mockup displays "Typography" collapsible in Brand Tokens as well as the top-level Typography tab, do not keep a second full editor: show only a short **Typography summary** with `Edit in Typography` link to avoid duplication.

### 5.2 Canonical semantic color roles

| Token key (proposed) | UI label | Intended usage | Required input | Notes |
|---|---|---|---|---|
| `colors.primary` | Primary | Main CTAs, links, highlights | Hex `#RRGGBB` | Violet default in WACRM is illustrative; brand may customize per site |
| `colors.secondary` | Secondary | Secondary brand accents/actions | Hex | Do not conflate with foreground text |
| `colors.background` | Background | Page background | Hex | Base contrast background |
| `colors.surface` | Surface | Panels/cards/sections | Hex | Separate from background |
| `colors.text` | Text | Main foreground/body/heading text | Hex | Must test against background AND surface where used |

Additional visual roles **Accent**, **Success**, **Warning**, **Error** appear in the mockups. Treat as **[DESIGN] optional or fixed semantic UI values**, not additional mandatory core tokens from the master proposal. If included in stored site theme, their usage and contrast pairings must be explicitly typed and versioned; do not let changing "Success" recolor WACRM admin shell. Core CMS admin status colors are independent from public website brand tokens.

### 5.3 Color-row behavior

Idle: 32px-ish swatch, label, semantic description, hex value, ratio/pass warning only for a defined pair. Hover: subtle border, copy affordance, accessible tooltip. Click swatch: anchored picker with 2D saturation/value field, hue control, validated hex field, recent colors; selecting a color updates the local working revision and center preview immediately. Click hex: select text, accept valid six-digit hex after normalization; pressing Enter commits local edit, Escape reverts current field, blur validates. Click copy: copy normalized value and announce `Copied #6941E8` (example). Optional reset-one-token action appears on hover/focus in popover.

An invalid hex does not enter the compiled CSS preview. Show `Enter a valid 6-digit hex color` below the field, retain last valid preview, and mark working state invalid until resolved or reverted.

### 5.4 Contrast calculation — mandatory precision

Compute actual contrast using the configured foreground/background pair (WCAG relative luminance). Test at minimum:

- `colors.text` on `colors.background`.
- `colors.text` on `colors.surface`.
- Actual CTA foreground against `colors.primary`.
- Links against their actual surface when link styling uses primary.
- Other semantic colored text/icon uses only when text/icons truly appear in those colors.

Reference WCAG 2.2 AA criteria: typical text ≥4.5:1; large text ≥3:1; meaningful UI component boundaries/states ≥3:1 where applicable. Large-text threshold follows WCAG's definitions; do not claim every color token must achieve 4.5:1 against white when it is not used as text there. Distinguish `Pass`, `Warning/Fail` and `Not applicable`.

**Mockup reconciliation:** "Warning `#F59E0B` on white 2.84:1" is only an example and must be computed, not hardcoded. A screen labeled `All checks passed` cannot also show an unresolved contrast failure for the same revision. The actual warning color may be visually retained as a nontext status treatment if contrast requirements are satisfied via label/icon/border design.

**Suggested fix CTA:** `Use Suggested Color` previews a calculated candidate after explaining which role/pair changes; user must explicitly accept. Do not auto-replace brand colors.

### 5.5 Border Radius

Label: **Border Radius**. Preferred control: dropdown or segmented discrete presets, optional slider snapping to allowed values, e.g. `0, 4, 8, 12, 16, 24px`, exact list from schema. Live changes apply only to supported website components, not to the admin UI. Tooltip: `Changes the default rounding for cards, inputs and buttons that use the global radius token.`

### 5.6 Spacing

Label: **Spacing**. A small selected preset with visible step scale. Suggested choices: `Compact`, `Comfortable`, `Spacious`, backed by enumerated multiples/steps such as `4 / 8 / 16 / 24 / 32px`. Source requires **discrete spacing**, not arbitrary CSS values. Moving a slider snaps to allowed steps; displays numeric result; actual block layout still respects per-block schemas and responsive constraints.

### 5.7 Container Width

Label: **Container Width**. Schema-validated dropdown or snapped slider such as `960px`, `1080px`, `1200px`, `1280px` (illustrative). Min and max are backend-defined. Preview at narrow device width must clamp container width to viewport, not overflow horizontally. Changes apply to compatible page containers; not a global raw CSS injection field.

### 5.8 Reset to Defaults

Click opens `Reset Brand Tokens?` modal showing affected token categories and warning that changes will affect **draft preview**, not existing public release. Buttons `Cancel`, `Reset Draft Tokens`; after confirmation restore schema defaults to local working state, mark unsaved, retain undo path where supported. **No live publication.** If the reset is persisted, that still requires `Save Brand Tokens` and later publishing.

### 5.9 Brand Tokens-specific states

`Pristine`, `Focused Input`, `Color Picker Open`, `Valid Local Edit`, `Contrast Pass`, `Contrast Warning`, `Invalid Value`, `Dirty`, `Saving`, `Saved Draft`, `Save Failed`, `Revision Conflict`, `Read-only Role`, `Reset Confirmation`. Components never simultaneously show contradictory values/states.

## 6. Typography tab — precise UI contract

### 6.1 Screen layout [VISUAL]

- Information banner: fonts are self-hosted and validated before save.
- `Heading Font` accordion.
- `Body Font` accordion.
- Font Family combobox per role.
- Supported Weights choices with clear selected/available state.
- Fallback Font field/select (prefer vetted allowed stacks).
- `Font Pairing Preview` showing heading, paragraph and representative button/link.
- Right `Typography Summary` and `Accessibility` sections.

### 6.2 Heading font

UI label: `Heading Font`.

Dropdown options illustrate `Geist`, `Inter`, `Poppins`, `Montserrat`, `DM Sans`, `Lora` and/or curated others; exact allowed font catalog comes from backend. Search within selector; show live font samples; do not imply all weights exist. Font family selection updates local preview only after font asset is available to renderer. Weight selector uses actual supported family weights, such as 300/400/500/600/700, but disable unavailable weights.

### 6.3 Body font

UI label: `Body Font`. Same controls; default Body font example `Inter`. Show a representative text passage and link/button samples. Do not permit a selection that cannot load or that generates an invalid font manifest.

### 6.4 Font pairing

The preview explicitly shows `Geist (Headings) + Inter (Body)` (illustrative). Optionally offer a curated pairing combobox; picking a pairing changes both working fields and marks draft dirty. Pairings must remain safe shortcuts, not separate unsynchronized state. `Font Pairing Preview` always reflects actual selected fonts; if still fetching, show `Loading preview font…` and a fallback rendering indicator.

### 6.5 Fallback font

Choose approved fallback CSS font stacks (e.g. `system-ui, -apple-system, sans-serif`) or schema-controlled values. The user must not type arbitrary CSS expressions into a fallback field. UI should display the selected stack in an accessible, understandable way.

### 6.6 Self-hosted ingestion [BASE]

The master proposal states: selected Google Fonts are fetched, subsetted, stored in tenant storage at **theme save time**, and served under `font-src 'self'`. Saving a draft must not report full success if required ingestion/validation fails. Use explicit ingestion job status if the process is async; compiled theme references immutable approved font artifacts, not dynamic external fonts. Confirm licensing/attribution obligations and subset completeness with the approved font provider and deployment policies.

### 6.7 Font load states

- `Available`: validated, preview loaded.
- `Previewing`: font being fetched/rendered; fallback clearly labeled.
- `Unrecognized`: font not in catalog → cannot apply.
- `Unsupported Weight`: choose supported weight.
- `Ingestion Pending`: save operation not yet fully validated.
- `Ingestion Failed`: error with `Retry Font Processing` and `Choose Another Font`.
- `Saved Draft`: persisted font reference and theme tokens.
- `Site Live`: only after release manifest publish.

### 6.8 Typography accessibility

Show a concise preview and associated contrast checks. Do not claim accessibility based solely on font family. Responsive font sizing and text wrapping must be checked in preview; exact scale tokens follow block schema and theme contract. Avoid promising advanced fluid-typography formulas absent from source.

## 7. Presets tab — catalog, actions and ownership

### 7.1 Default Presets UI [VISUAL]

Left editor displays:

- `Preset Library` or `Saved Presets` heading.
- `+ Create Preset` CTA.
- Search input `Search presets…` when saved list is long.
- Filter `All presets` (recommended options `All`, `Built-in`, `Workspace`, `This Site`, subject to supported scope).
- Curated sample cards `Modern Violet`, `Ocean Professional`, `Warm Editorial` with small preview, swatches, font pairing, radius and container width.
- Each card has `Preview`, `Apply` and `•••` if owned/eligible.
- `JSON Preset (Import / Export)` area, optionally an upload dropzone.
- An inline `Import Theme Preset — Review Changes` panel after JSON validation.

### 7.2 Preset card content

Title, one-line description, swatch strip, headings/body fonts, geometry summary, `Active` only if the active theme is actually based on that preset, ownership/scope, updated timestamp where available, Preview and Apply controls. `Active` does not mean a draft preset has already been published; distinguish **Selected for Draft** and **Live Theme** if needed.

### 7.3 Preview preset

Click `Preview` overlays the preset's tokens on the central preview without mutating the saved draft. Show clear marker `Previewing "Ocean Professional" — not applied`, and actions `Apply Preset` / `Return to Draft`. Switching tabs or sites exits preview or asks only if there is a pending destructive apply decision. Do not display `Unsaved changes` merely from transient preset preview.

### 7.4 Apply preset

Click `Apply` opens **Review Preset Changes** with semantic before/after diff and source/target site. Default safe mode is **Theme Only**: colors, typography, geometry, and compatible block styling, with exact fields enumerated. If the imported JSON also includes starter layouts or navigation, surface a **separate explicit choice** `Replace Starter Layouts / Navigation` only if Domain 03/04 import and conflict validation are implemented. Default **Keep Existing Pages, Layouts & Menus**. Apply updates **working draft state** only; `Save Brand Tokens` persists, then the existing release flow publishes. Never implicitly replace live structures or issue public release.

### 7.5 Create Preset

Opens modal `Create Theme Preset`:

- `Preset Name *`.
- `Description` (optional).
- `Scope`: This Site / Workspace (if authorized).
- `Include`: Colors & Typography; Geometry; Compatible Block Styles; optional Starter Layout/Navigation only if supported.
- `Preview Summary`.
- Buttons `Cancel`, `Save Preset`.

Default name must be distinct within the relevant scope under a defined normalization rule. If a permission or scope conflict occurs, no partial preset remains. Save creates a validated snapshot with ID/remapping strategy, without publishing.

### 7.6 Card overflow menu — exact copy

For editable saved presets:

1. `Preview`.
2. `Duplicate`.
3. `Rename`.
4. `Export JSON`.
5. `Delete` (red, separated).

Built-in presets cannot be renamed or deleted; `Duplicate to Workspace` may be available instead. Optional `Edit Preset` routes to a safe editing flow only if implemented; do not silently create a second full token editor.

### 7.7 Duplicate

Modal title `Duplicate Preset`. Fields: `New Name *`, `Scope`. Actions `Cancel`, `Duplicate`. Deep-copy safe JSON data; generate new IDs; preserve source references only as nonauthoritative provenance metadata. Success `Preset duplicated.` and select new card.

### 7.8 Rename

Modal title `Rename Preset`. Field `Preset Name *`. Actions `Cancel`, `Save Name`. Updates metadata, not all already instantiated theme revisions. Error on conflicting/invalid name.

### 7.9 Delete preset

Modal title `Delete preset?`.

Copy: `This will delete "{presetName}" from the reusable preset library. Existing published website releases will not be altered.`

If referenced by an existing draft or governed dependency, either block deletion with `View Usage` or apply documented soft-delete/retention semantics; no silent broken references. Buttons `Cancel`, `Delete preset` (red). Built-in presets: disabled/hidden. If the preset is currently active as a theme **source**, require explicit acknowledgement or block according to final lifecycle policy. Modal should not assert permanent deletion until retention policy is confirmed.

### 7.10 Preset ownership and cross-site reuse

- `Built-in`: product-provided, read-only definition, user can instantiate into authorized site.
- `Workspace`: accessible only to authorized sites inside same organization.
- `This Site`: only active `site_id`.
- No cross-tenant preset discovery or implicit access to foreign asset/media/form refs.
- Instantiation must strip/remap IDs and validate external references via target site rules.

## 8. JSON import/export — full contract

### 8.1 Import entry points

The header `Import JSON`, Presets tab `Import JSON` and drag/drop area are **aliases for one canonical import flow**. All lead to the same validation/review; avoid duplicate import state machines.

### 8.2 File intake

Accept UTF-8 `.json` in configured size limit (product decision). Reject binary/non-JSON, oversized, malformed, unsupported schema version, dangerous prototype keys, unknown token types, invalid colors, fonts, spacing, or foreign references. Parsing occurs in a safe server-side validation boundary as well as client-side for immediate feedback. Never execute JSON strings as JS, CSS or HTML.

### 8.3 Expected schema groups [BASE]

- Version/format metadata.
- Colors (including core roles).
- Typography (heading/body families/weights/fallback).
- Geometry (radius, discrete spacing, container width).
- Whitelisted compatible block styling variants.
- Optional starter page layouts.
- Optional default navigation.

Template/revision IDs are stripped and reassigned. Assets and links must be validated and remapped or explicitly handled. A preset claiming unsupported functionality should fail or show accurately enumerated ignored optional fields according to an approved version policy, not silently execute them.

### 8.4 Review Changes dialog/panel [VISUAL]

Title: `Import Theme Preset — Review Changes`.

Summary rows:

- `Colors`.
- `Typography`.
- `Block Styling`.
- `Starter Layout`.
- `Navigation`.

For each row show `Present in file`, `Current`, `Proposed`, compatibility and count. Radio group (default):

- **Keep existing layout** — apply approved theme settings only.
- **Replace layout after review** — enabled only when migration, permissions and dependencies are actually supported.

Buttons `Cancel`, `Import Preset` (violet). Import may create a saved preset record before application or apply directly to working draft **only if the UI explicitly distinguishes the two options**. Recommended default: `Import to Preset Library` then separate `Apply Preset` step; a one-step apply option may be offered with its own clear confirmation.

### 8.5 Export

`Export Theme JSON` downloads a versioned, sanitized preset containing only authorized, schema-approved fields, no tenant IDs, auth tokens, signed URLs, sensitive CRM data, or private file references. Filename suggestion: `euromiles-main-theme-v1.json`; actual site name sanitized. Export must not suggest a published theme if selected content is an unsaved local working draft; offer `Export Saved Draft` and/or `Export Live Theme` only when both datasets are available and clearly labeled.

### 8.6 Import error states

`File too large`, `Invalid JSON`, `Unsupported version`, `Invalid color`, `Unknown font`, `Missing required token`, `Unrecognized block style`, `Asset/link reference not valid for this website`, `Insufficient permission`, `Conflict with existing preset`, `Server validation failed`. Errors list field paths and remedy. An invalid import does not modify current saved draft.

## 9. Center live website preview

### 9.1 Purpose

The center canvas is a **read-only token test environment**, not an editing surface. It renders an authorized representative website page using the current draft tokens or a temporary preset preview. It must be rendered from safe native block schemas and isolate preview/private content according to the master blueprint's signed short-lived preview origin model.

### 9.2 Header and modes

- Heading: `Live Website Preview` (preferred label may be `Website Preview` to avoid suggesting the preview is live/published).
- State annotation: `Using unsaved values (editing)` / `Previewing preset "…"` / `Showing saved draft` / `Showing live release`.
- Device segmented control: `Desktop`, `Tablet`, `Mobile`.
- Optional `Open Preview` expansion icon.

### 9.3 Responsive dimensions

- Desktop nominal 1440px canvas rendered within available preview viewport/scaled responsibly.
- Tablet nominal 768px.
- Mobile nominal 375px.
- Canvas transitions use width/scale morph; maintain scroll continuity when possible.
- On narrow devices, show vertical scrolling of the page; do not clip content purely to fit one screenshot.

### 9.4 Sample preview content [VISUAL]

EuroMiles Main — navigation, hero `Study Abroad with Confidence`, violet `Explore Programs` CTA, secondary `Talk to an Expert`, statistics strip, destination cards for Italy/Germany/France/UK and footer. **All sample numbers, images and text are decorative reference data**, not theme configuration or claims about the business. The preview should load actual selected site's safe draft/live content where available, or a clearly marked representative sample.

### 9.5 Working-value interpolation

Changing color/font/geometry updates the preview immediately with CSS variables in preview scope only. Duration ~180–240ms for color/background transitions; typography swap waits for font readiness, avoids misleading transient FOUT/CLS when possible. No per-keystroke expensive server release or public site invalidation. If current hex is invalid, retain last valid preview.

### 9.6 Preview failures

- `Loading page preview…` with geometry-stable skeleton.
- `Unable to load preview. Retry` with safe fallback.
- `Preview font unavailable` with labeled fallback.
- `Some components do not support this token` only when true, linking to compatibility details.
- `No page available for preview` → choose page or use sample, not a blank/unlabeled canvas.

### 9.7 Interaction limits

The preview page's call-to-action buttons must not submit real CRM forms or trigger production changes. In interactive preview mode, links use safe interception or open sandbox preview routes; any real form preview is non-submitting/dummy unless deliberately put in a guarded test mode by Forms module.

## 10. Right Theme Overview

### 10.1 Default panels

1. `Token Summary`: semantic swatches plus hex role labels.
2. `Typography Summary`: selected Heading/Body families, weights and fallback.
3. `Accessibility Checks`: actual computed pairs and pass/fail.
4. `Usage`: website, page, and compatible block/template counts if projections exist.
5. `Theme Status`: Editing, Saved Draft, Published.
6. Optional `Preflight for Publishing` summary when authoritative preflight data is available.

### 10.2 Token Summary

Read-only; swatch hover shows role+hex+usage. Clicking a swatch may focus relevant left token control. Values always reflect current indicated mode (`Working`, `Saved Draft`, `Live`, `Preview Preset`). Avoid showing old saved data while claiming to preview unsaved colors.

### 10.3 Typography Summary

Render headings/body samples and the exact current font pairing. `Edit Typography` link switches left tab; does not change global route.

### 10.4 Accessibility Checks

Expandable list of the actual checked pairs. Show `3 Passed · 1 Warning` when true; do not mix a global "All passed" pill with a failing row. Each issue: affected role, actual ratio, requirement, and `Fix` CTA taking user to the associated control. Do not imply WCAG AA compliance of the entire public website from token contrast alone; report `Token contrast checks passed` rather than `Site is WCAG compliant`.

### 10.5 Usage Summary

Show `Used across {n} pages`, `Applied to {n} section templates`, `Used by {n} blocks`, or relevant site count **only when computable**. Distinguish "available to all pages" from "actively referenced by N revisions." Click opens usage detail list scoped to authorized site/workspace, no leakage of other tenant content. For no usage projection show `Usage details unavailable` rather than 0.

### 10.6 Theme Status

- **Editing**: local changes not saved.
- **Saved Draft**: persisted token revision not necessarily published.
- **Published**: current live release references token revision.

This is a state model, not a three-step asynchronous wizard that progresses by timer. An already live site can simultaneously have a **Published live revision** and a **new unsaved draft**; UI must explicitly label both revision identities rather than making them mutually exclusive in the data model.

### 10.7 Preflight for Publishing

Overview may display `Token schema valid`, `Contrast checks`, `Font availability`, `Warnings` as a **preview of readiness**, not a replacement for full release preflight. `Review for Publish` routes to Publishing & Releases; final preflight revalidates a frozen revision manifest. If warnings block publication depends on the source's defined preflight policy (not specified in detail for each contrast pair). Avoid automatically classifying all WCAG advisory warnings as hard publishing blockers without an approved rule.

## 11. Save, draft and release lifecycle — authoritative states

### 11.1 State graph

`Loaded Saved Draft/Live Baseline` → `Local Edit (dirty)` → `Validate` → `Font Processing if needed` → `Persist Immutable Draft Revision` → `Saved Draft` → `Publishing Preflight` → `CAS Release Pointer Update` → `Published`; independent failure branches include validation, ingestion failure, version conflict, permission denial and server failure.

### 11.2 Save Brand Tokens CTA

- Disabled if pristine, invalid, or unauthorized; optionally enabled for re-save after failed server operation.
- Click: immediately set `Saving brand tokens…`, prevent double-submit; validate Zod and constraints; verify assets/fonts and CAS/optimistic base version; persist draft theme revision.
- On confirmed success: toast `Brand tokens saved as a draft.` supporting copy `Changes are not live until you publish a release.` Badge becomes `Saved draft` and displays timestamp.
- On validation failure: inline field messages + summary `Fix {n} issues before saving`.
- On network failure: retain local draft and `Save failed. Retry`.
- On conflict: open `Theme Updated Elsewhere` dialog showing versions and choices `Review Latest`, `Compare Changes`, `Keep My Draft as Copy` if supported; never blindly overwrite.

### 11.3 Dirty-navigation guard

If changing site, route, browser navigation or closing with unsaved edits:

**Title:** `You have unsaved theme changes`.

**Body:** `Save a draft before leaving, or discard your local changes.`

Buttons: `Stay`, `Discard Changes`, `Save Draft & Continue`.

After save failure, remain on the page; do not navigate away silently.

### 11.4 Publish Theme CTA / link

The optional top CTA is subordinate to Module 8 Publishing & Releases and must not bypass its manifest assembly/preflight/CAS rules. If no eligible persisted draft exists, disable with tooltip `Save your theme draft first`. Click opens the existing publish review with theme revision preselected; confirmation and live result occur there. When site release is published, status updates from authoritative server response; public cache/tag invalidation follows existing outbox process.

### 11.5 Rollback

Theme rollback is not an independent "undo live colors" operation: restore the appropriate **entire immutable release** via Publishing & Releases, because releases include token, layout, menu, page and route references. The Overview can link `View Release History`.

## 12. Full screen/component state matrix

| Context | State | Visual treatment | Behavior/next step |
|---|---|---|---|
| Whole screen | Initial loading | Layout-matched skeletons | Fetch authorized site and theme |
| Whole screen | No website | Empty state | `Choose Website` / `Create Website` per role |
| Whole screen | No theme set | Defaults summary | `Use Defaults` then Save Draft |
| Whole screen | Read-only role | Disabled edits, labels | Preview/export only if authorized |
| Whole screen | API partial failure | Local card error | Retry affected card, retain successful data |
| Tabs | Default | Neutral label | Switch without losing working edit |
| Tabs | Hover/focus | Tint/focus ring | Keyboard and pointer parity |
| Tabs | Selected | Violet underline/surface | Active editor pane only |
| Color | Idle | Swatch/hex/ratio | Editable |
| Color | Picker open | Anchored popover | Live local preview |
| Color | Invalid input | Red validation under input | Last valid preview preserved |
| Color | Contrast pass | Green check + actual ratio | No intervention |
| Color | Contrast failure | Amber/red warning + pair | `Use Suggested Color` optionally |
| Font | Combobox open | Searchable font list | Preview each authorized font |
| Font | Loading sample | Static fallback + indicator | No false loaded status |
| Font | Unsupported weight | Warning, disabled weight | Choose supported weight |
| Font | Ingestion failed | Error row and retry | No success toast |
| Geometry | Adjusting slider | Live value bubble | Snap to allowed steps |
| Presets | None available | Empty list | `Create Preset` / `Import JSON` |
| Presets | Previewing | Mode badge | `Apply` / `Return to Draft` |
| Presets | Apply review | Diff modal | No edits until confirm |
| Presets | Apply success | Dirty working revision | Prompt Save Draft |
| Presets | Duplicate/rename conflict | Field inline error | Correct and retry |
| Presets | Delete guard | Modal and references | Block or confirm safe action |
| JSON | Dragover | Dashed violet highlight | Drop `.json` |
| JSON | Parsing | Processing indicator | No theme mutation |
| JSON | Validation error | Field paths + message | Upload corrected file |
| JSON | Validated | Review Changes | Confirm import scope |
| Preview | Loading | Skeleton with stable dimensions | Retry if fails |
| Preview | Device selected | Violet selected state | Update viewport |
| Preview | Unsupported component | Local warning | Show fallback + details |
| Draft | Pristine | `Up to date` | Save disabled |
| Draft | Unsaved | Amber `Unsaved changes` | Save enabled if valid |
| Draft | Saving | Spinner/disabled submit | Wait for result |
| Draft | Saved | `Saved draft` green | Go to publish review |
| Draft | Save error | Error toast/field summary | Retry, retain edits |
| Draft | Conflict | Compare modal | No overwrite |
| Release | Publishing | Progress/status from server | Never infer from timer |
| Release | Published | Green verified + release ID | `View Live Site` / history |
| Release | CAS conflict | Conflict dialog | Rebase/rebuild against latest |
| Any | Network disconnected | Offline status | Retain edits local until permitted retry; don't claim persisted |
| Any | Permission revoked | Disabled editor | Prevent save, maintain safe readable state |

## 13. Every dropdown/popover and exact labels

| Trigger | Menu choices / contents | Selection result |
|---|---|---|
| Website ▾ | `Search websites…`; `EuroMiles Main`, other authorized sites; possibly `All` **not** editable for Theme Studio | Select concrete `site_id`; dirty guard |
| Main tab | `Brand Tokens`, `Typography`, `Presets` | Switch pane |
| Color picker | Hex, 2D picker, Hue, Recent Colors, optional Copy/Reset | Local draft preview |
| Border Radius ▾ | `None`, `Small`, `Medium`, `Large` backed by enumerated px values | Local token update |
| Spacing ▾ | `Compact`, `Comfortable`, `Spacious` or enumerated step | Local token update |
| Container Width ▾ | Approved predefined widths | Local token update |
| Heading Font ▾ | Search + vetted font families (e.g. Geist, Inter, Poppins, Montserrat, DM Sans, Lora) | Preview/supported-weight refresh |
| Body Font ▾ | Same vetted searchable catalog | Preview/supported-weight refresh |
| Font Weight | Available weights for selected family only | Local token update |
| Fallback Font | Approved fallback stacks | Local token update |
| Preset filter | `All presets`, `Built-in`, `Workspace`, `This Site` | Filter without mutating theme |
| Preset card `•••` | `Preview`, `Duplicate`, `Rename`, `Export JSON`, `Delete` | Appropriate popover/modal |
| Preview device | `Desktop`, `Tablet`, `Mobile` | Viewport change |
| Import review mode | `Keep existing layout` (default), `Replace layout after review` (conditional) | Define import scope |
| Usage row | `View affected pages`, `View affected blocks` when supported | Scoped detail view |

For all menus: proper positioning, Escape dismissal, focus return, keyboard arrows, Enter/Space activation, no overlay clipping, and sufficient labels for touch/assistive technology.

## 14. Dialog copy and confirmation contracts

### 14.1 Reset Brand Tokens

Title `Reset Brand Tokens?`.

Body `This will replace your working theme settings with the default values. Your published website will not change until a new release is published.`

Actions `Cancel`, `Reset Draft Tokens`.

### 14.2 Create Theme Preset

Title `Create Theme Preset`.

Fields `Preset Name *`, `Description`, `Scope`, `Include`.

Actions `Cancel`, `Save Preset`.

### 14.3 Apply Theme Preset

Title `Review Preset Changes`.

Body `Compare the selected preset with your current theme before applying it to your draft.`

Scope default `Theme settings only — keep existing layouts and navigation`.

Actions `Cancel`, `Apply to Draft`.

### 14.4 Import Theme Preset

Title `Import Theme Preset — Review Changes`.

Body `The imported file contains theme and optional site structure settings. Choose which changes to apply.`

Actions `Cancel`, `Import Preset`.

### 14.5 Delete Theme Preset

Title `Delete preset?`.

Body `This removes the reusable preset definition. Existing published website releases will remain unchanged.`

Actions `Cancel`, `Delete preset`.

### 14.6 Save Conflict

Title `Theme Updated Elsewhere`.

Body `Someone else saved a newer theme revision while you were editing. Review the differences before continuing.`

Actions `Review Latest`, `Compare Changes`, `Cancel`; `Save as Copy` only if supported.

### 14.7 Unsaved changes guard

Title `You have unsaved theme changes`.

Actions `Stay`, `Discard Changes`, `Save Draft & Continue`.

## 15. Hover and animation choreography

| Element | Enter / exit | Duration | Easing |
|---|---|---|---|
| Left tabs | Violet underline/surface crossfade | 160–200ms | `cubic-bezier(0.16,1,0.3,1)` |
| Color swatch hover | 1px border emphasis, optional shadow | 140ms | `ease-out` |
| Color picker open | Opacity 0→1, scale .97→1, translateY 4→0 | 180ms | `cubic-bezier(0.16,1,0.3,1)` |
| Color token interpolation | CSS variables color fade when compatible | 180–240ms | `ease-out` |
| Text input focus | Border and ring transition | 120ms | `ease-out` |
| Typography font popup | Fade/scale, scroll list | 180ms | standard entrance |
| Font sample switch | Crossfade after font ready, no fake font animation | 160–220ms | `ease-out` |
| Geometry slider | Continuous pointer response; final snap | 120–160ms | `ease-out` |
| Device width morph | Canvas width transition, preserve content anchor | 260–300ms | `cubic-bezier(0.16,1,0.3,1)` |
| Preset card hover | 1–2px lift and shadow | 160ms | standard entrance |
| Preset preview select | Crossfade state, preview marker appears | 220ms | `ease-out` |
| Import dropzone dragover | Violet dashed border/surface tint | 160ms | `ease-out` |
| Accordion expand | Measured height and opacity | 220ms | `cubic-bezier(0.2,0,0,1)` |
| Modal enter | Fade + scale .96→1 | 240ms | `cubic-bezier(0.16,1,0.3,1)` |
| Validation badge change | Text/icon fade, no distracting shake | 180–220ms | `ease-out` |
| Save success toast | Fade + translateY(10px)→0 | 280ms | standard entrance |
| Toast exit | Fade | 180ms | `ease-out` |
| Skeleton loading | Low-contrast shimmer | 1400ms loop | `linear` |

**Reduced motion:** Remove decorative travel, shimmer loops and pulsation under `prefers-reduced-motion: reduce`; use static skeletons, immediate state labels and focus cues. **Performance:** Preview applies CSS variables without forcing per-pointer React rerenders of the entire canvas; debounce expensive recomputation, and animate only compositor-friendly properties where possible. Ensure transitions are never required for correctness.

## 16. Responsive/viewport considerations

- ≥1440px: three-column editor, preview and summary.
- 1024–1439px: left editor + center, right overview collapsible/drawer.
- 768–1023px: icon rail or navigation overlay, editor and preview can switch between panes; retain device controls.
- ≤767px: native mobile management view; tabbed editor/preview/summary rather than tiny side-by-side columns.
- Theme Studio's Desktop/Tablet/Mobile controls describe **preview target widths**, not the editor application's responsive breakpoints.
- Zoom, keyboard focus and color-picker popovers must stay inside viewport; no destructive action is hover-only.

## 17. RBAC, tenancy and audit

### 17.1 Proposed permission matrix

| Action | Suggested minimum role/permission | Notes |
|---|---|---|
| View theme and preview | Authorized Viewer / site read | Do not reveal unauthorized assets |
| Modify tokens / save draft | Explicit theme-edit right, likely Editor/Manager | Backend authoritative |
| Create/edit workspace preset | Explicit workspace design permission | Separate from this-site preset |
| Import JSON / apply preset | Theme-edit + resource-import authorization | Review scope and dependencies |
| Export JSON | Explicit export permission | Sanitized scope |
| Delete custom preset | Owner/Admin or explicit preset-admin | Retention/reference guards |
| Delete token set | Highly restricted | Guarded operation; does not destroy live release |
| Publish theme revision | Publishing role/permission | Existing release flow only |

The exact Role → Permission binding must follow the application's established server-side RBAC and `requireRole` implementation, not this UI table if they differ.

### 17.2 Isolation

`organization_id` from authenticated context, `site_id` verified to belong to organization. Apply RLS and composite site/org foreign-key constraints where applicable. Never permit exported JSON to carry valid references into another tenant; strip IDs and revalidate linked assets/forms/routes during target-site import. Audit who saved, imported, exported, applied, overwrote or deleted presets and who published token revisions.

### 17.3 Security

- Do not execute import file contents.
- No raw CSS, custom script or arbitrary HTML injection.
- Validate allowed fonts and CSS variable values at both client and server.
- Use `font-src 'self'` for public runtime.
- Prevent SSRF/path traversal when fetching provider font files; source-approved ingestion pipeline only.
- Reject dangerous JSON keys and oversized/deep inputs; enforce per-user rate/size limits.
- Do not expose private signed storage URLs in JSON exports.
- Preview origin and authentication must follow existing sandbox/signed-token model.

## 18. Data model and API contracts (proposed, not verified endpoints)

### 18.1 Source-named persistence

- `theme_token_sets`.
- `theme_tokens`.
- `theme_presets`.
- Immutable release manifest references from Publishing domain.

Do not assume exact migrations, field names or endpoint paths beyond these source names. The following represents proposed semantic contracts for engineering review.

### 18.2 Minimal ThemeTokenSet DTO

```json
{
  "siteId": "site-id",
  "revisionId": "draft-revision-id",
  "baseRevisionId": "prior-revision-id",
  "schemaVersion": 1,
  "colors": {
    "primary": "#6941E8",
    "secondary": "#0B1026",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "text": "#0B1026"
  },
  "typography": {
    "heading": {"family": "Geist", "weight": 700, "fallback": "system-ui"},
    "body": {"family": "Inter", "weight": 400, "fallback": "system-ui"}
  },
  "geometry": {"radiusPx": 12, "spacingStepPx": 8, "containerWidthPx": 1200},
  "status": "draft"
}
```

**Illustrative schema only.** Exact naming, defaults, available fonts, CSS variables and identity handling require alignment with the production Zod schema; identifiers are placeholders, not stable runtime references.

### 18.3 Proposed service operations

- Get authorized site theme `live + latest draft + revision metadata`.
- Validate working theme / contrast summaries.
- Resolve approved font catalog and weights.
- Save draft theme using base revision compare-and-set.
- List/get/create/duplicate/rename/delete authorized presets.
- Validate import JSON and return semantic diff/compatibility.
- Export sanitized versioned preset.
- Get scoped usage summary where available.
- Initiate existing Publish & Releases workflow with draft token revision.

Use actual repository conventions for endpoints and job dispatch; do not create a separate unreviewed Theme Studio publish API.

### 18.4 Compilation

The master pipeline maps tokens to per-release scoped CSS variables such as `--brand-primary` and `--radius-md` inside a release `<style>` block. All values are from validated allowlists; no arbitrary serialized CSS from users. Public render resolves a single `live_release_id` per request; token sets are resolved from that immutable release, not a mutable working draft.

## 19. Error messages and success copy

| Event | Exact recommended message | Actions |
|---|---|---|
| Dirty edit | `Unsaved changes` | `Save Brand Tokens` |
| Saving | `Saving brand tokens…` | Button disabled |
| Saved | `Brand tokens saved as a draft.` | `Review for Publish` |
| Invalid hex | `Enter a valid hex color, for example #6941E8.` | Correct field |
| Low contrast | `This color combination may be difficult to read.` | `Review contrast`, optional `Use Suggested Color` |
| Missing font weight | `This font does not support the selected weight.` | `Choose Weight` |
| Font ingestion error | `We couldn't prepare this font for hosting.` | `Retry Font Processing` / `Choose Another Font` |
| JSON malformed | `This file is not valid JSON.` | `Choose Another File` |
| Preset schema mismatch | `This preset version is not supported.` | `View Details` |
| Saving conflict | `A newer theme draft exists.` | `Review Latest`, `Compare Changes` |
| Server save failure | `We couldn't save your theme. Your local changes are still here.` | `Retry Save` |
| Preset applied | `Preset applied to your working draft.` | `Save Brand Tokens` |
| Preset imported | `Preset imported successfully.` | `View Preset` / `Apply` |
| Preset deleted | `Preset deleted.` | Close/toast |
| Publish complete | `Theme changes are live in release {id}.` | `View Live Site` |
| Permission denied | `You don't have permission to edit this site's theme.` | `Contact Administrator` |

## 20. Acceptance tests — functional and UX

### Global and layout

- [ ] Approved dark sidebar, violet primary CTAs and three columns render consistently with Modules 1–5.
- [ ] All three tabs exist with correct active/focus state and do not lose unsaved edits on tab switch.
- [ ] Site selector only shows authorized sites; switching prompts for dirty edits.
- [ ] All header/dropdown/popover actions have correct destinations and focus return.

### Brand Tokens

- [ ] Five core theme groups/roles represented according to source, with background/surface/text roles available.
- [ ] Color swatch and normalized hex inputs stay synchronized.
- [ ] Invalid color never enters preview CSS or saved draft.
- [ ] Actual pair-specific WCAG ratios are recomputed and accessible; misleading mockup ratios not hardcoded.
- [ ] Discrete radius, spacing and container width values snap to schema-approved values.
- [ ] Reset changes draft only and is confirmed.

### Typography

- [ ] Font selectors show approved families and available weights.
- [ ] Pairing preview uses selected fonts and supports fallback/failed-load states.
- [ ] Self-hosting pipeline fetches/subsets/stores fonts at save time or reports authoritative job state.
- [ ] Save does not claim success before required font validation succeeds.
- [ ] Public releases do not pull fonts dynamically from unapproved third-party origins.

### Presets

- [ ] Built-in, Workspace and This Site permissions enforced at server.
- [ ] Preview has no persistent side effects.
- [ ] Apply shows before/after diff; preserves existing layout/menu unless explicitly chosen and supported.
- [ ] Create/duplicate/rename validate names, scope and ownership.
- [ ] Export strips tenant-specific IDs, secrets and private references.
- [ ] Import validates version/schema and remaps IDs; malformed file leaves draft intact.
- [ ] Delete is guarded and safe for active/in-use resources.

### Preview

- [ ] Device controls show Desktop/Tablet/Mobile target sizes with correct wrapping.
- [ ] Preview explicitly labels working/saved/live/preset mode.
- [ ] Preview public form buttons cannot submit real CRM data inadvertently.
- [ ] Preview errors are localized and retryable.
- [ ] Missing actual site preview falls back to clearly labeled sample, not misleading site data.

### Draft/publish

- [ ] `Save Brand Tokens` persists a draft token revision, not a live change.
- [ ] UI differentiates unsaved, saving, saved and published states; no contradictory badge/toast.
- [ ] CAS/optimistic conflict does not overwrite teammate's revision.
- [ ] Publishing uses immutable manifest preflight and authoritative site pointer update.
- [ ] Rollback uses the existing release system, not a second theme-specific live switch.

### Security/accessibility/performance

- [ ] Organization/site isolation on every CRUD/preview/export.
- [ ] All controls keyboard-accessible, WCAG AA contrast in admin interface, focus-visible and labeled.
- [ ] Reduced-motion mode removes animation without losing status communication.
- [ ] No arbitrary CSS/JS/HTML persisted from presets.
- [ ] Editing color sliders does not trigger full-canvas server save or expensive page rerenders.

## 21. Open decisions requiring sign-off

1. Exact production Zod `theme_token_sets` schema/field names and approved enumerations.
2. Whether accent/success/warning/error are persisted site tokens or fixed renderer semantics; separate from admin chrome.
3. Exact contrast enforcement policy at Save versus Publishing preflight: advisory vs blockers by role/pair.
4. Approved public font catalog, licensing/subset policy, and ingestion retry mechanism.
5. Whether workspace presets are shared by reference or cloned per-site; usage/deletion semantics.
6. Whether saved preset **layouts/navigation** may be applied in Phase 1 and under which explicit review/guard flow.
7. Preset import file size/depth/versioning and upgrade policy.
8. The site's representative preview-page selection and isolation behavior.
9. Whether token-level draft CAS is already present; if not, how theme revision conflict aligns with page/release CAS.
10. Exact user/site role policy for saving, importing, exporting, deleting and publishing.
11. Usage counts: current draft vs live only, and how summaries are computed.
12. How to handle partial preview incompatibility and unsupported blocks.
13. Whether the top `Publish Theme` button should appear or only a `Review for Publish` link to avoid misleading one-click publishing.
14. Exact route names and workspace/sidebar CSS inheritance from implementation.

**Do not expand scope just to make mockup fields interactive.** Resolve missing backend support and tag a field `[DEFER]` rather than adding unapproved features.

## 22. Independent architectural/UI review instructions

Review this document in conjunction with `CLAUDE_PROPOSAL.md`, Module 4 Visual Builder, Module 5 Block Library, and Theme Studio reference images. For every finding provide: ID, severity, affected UI element or backend contract, supporting source section, problem, expected production impact, recommended correction, MVP vs deferred priority and owner.

Audit especially:

1. Five core tokens vs expanded color roles without unnecessary new token system.
2. Font self-hosting and actual save-time readiness.
3. JSON import safety and avoiding unintended layout/menu overwrite.
4. Correct distinction between temporary preview, unsaved working edit, saved draft and published release.
5. Real contrast ratio calculation and avoiding false site-wide accessibility certification.
6. Multi-tenant preset/asset/link isolation and secure exports.
7. Release snapshot and CAS consistency when theme and page/menu changes publish together.
8. Consistency of CTA color (violet) and status semantics (green/amber/red).
9. All three tabs and state transitions in desktop and responsive layouts.
10. Phase 1 complexity control — no arbitrary CSS, marketplace or unsupported design-system modes.

## 23. Final approved-build boundary (pending product/engineering acceptance)

Deliver the existing **three-tab Theme Studio** with:

- **Brand Tokens:** semantic colors, real contrast checking, radius, discrete spacing, container width, controlled defaults/reset.
- **Typography:** heading/body families and weights, pairing preview, approved fallbacks and self-hosted font ingestion.
- **Presets:** built-in/saved library, preview, safe apply, create/rename/duplicate/delete controls, strict JSON import/export and explicit layout/navigation review.
- **Preview:** desktop/tablet/mobile live *draft* CSS-variable rendering, no accidental production form submission.
- **Overview:** token/typography/accessibility/usage summaries; accurate editing/saved/published distinctions.
- **Workflow:** working edit → server-validated draft save → existing full publishing preflight → immutable CAS release; never save directly to live site.
- **States:** full hover/focus/loading/dirty/saving/error/conflict/success/restricted/empty coverage, with purposeful motion and reduced-motion support.

Maintain the approved dark WACRM shell, light three-column studio, violet primary controls and restrained enterprise style. **No additional top-level tabs or major redesign.**

**End — Module 6 Theme Studio Desktop Specification.**
