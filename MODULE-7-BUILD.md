# Module 7 — Layouts & Templates · build record

Reviewed first (`MODULE-7-SPEC.md`, `MODULE-7-BENCHMARK.md`, `MODULE-7-GAP-REVIEW.md` — 22
findings, 16 decisions), then built. This is what actually shipped, how it is wired to the
other modules, and what is honestly still missing.

Screen: `#/layouts?site=&tab=&itab=&sel=`. QA: `qa_layouts.py` (99) + `qa_states_m7.py` (38) +
`qa_import.py` (65) + `qa_m7_links.py` (33).

---

## 1. The model

```
SharedRegion { id, kind: announcement|header|footer, name, locked, variants: RegionVariant[] }
RegionVariant { id, name, note, blocks: BlockNode[], rev, updatedAt }
RegionRef    { regionId, variantId, visible, hideReason? }

SlotPolicy   { allow: BlockType[], deny: BlockType[], maxBlocks }
MasterLayout { id, siteId, name, desc, scope, isDefault, archived,
               announcement: RegionRef, header: RegionRef, footer: RegionRef,
               slot: { seed: BlockNode[], policy: SlotPolicy },
               seoChecklist: SeoCheck[], thumbnail, dirty, rev, updatedAt, updatedBy }
PageTemplate { id, name, intent, desc, scope, builtIn, layoutId, blocks[], seoReady, rev }
```

Three rules the code enforces rather than documents:

1. **Chrome is referenced.** A layout stores ids, never blocks. Editing `Global Header v2`
   marks every layout pinned to it as a draft change and names them in the drawer
   ("Blast radius").
2. **One slot.** `slot` is not a list of regions; it is the single Main Content Slot, and it
   cannot be removed — the inspector draws it with a `Required` pill and the canvas labels it.
3. **Bindings are not a second table.** A page's shell is the string Module 3 already
   stores (`CmsPage.layout`), resolved in exactly one function (`resolveLayoutId`). `Site
   default` means "follows the default", any other value is an explicit pin. There is no
   `page_layout_bindings` table to drift out of sync.

## 2. What the screen does

| Area | Behaviour |
|---|---|
| Header | Website selector (all screens share it), **Prebuilt** (14) library, **Import** (HTML / JSON), **Preflight** with a live finding count, **Preview Layout**, contextual **+ Create Layout / + Create Template** |
| KPIs | Master Layouts · Page Templates · Pages Assigned · Draft Changes — each derived, each with a definition tooltip (`Tip`) because "assigned" has three plausible meanings |
| Library | Master Layouts \| Page Templates with counts; search; sort (updated / name / pages); archived opt-in; per-row menu (preview, reassign, set default, duplicate, archive/restore) |
| Canvas | The resolved shell drawn from the working copy: announcement text, header brand/nav/CTA, slot seed blocks, footer columns. 1440 / 768 / 375 with a fit scale that never exceeds 1:1, zoom, and a **Draft preview — not live** chip |
| Slot bar | Allowed-type count (opens the policy editor), seed count, ceiling, "Compose in builder" |
| Page groups | Six cards derived from routes (Main 9, Landing 1, Program 8, University 6, Information 8, Other 16 on the seed site) — click filters Usage |
| Inspector · Overview | Inline name, description, website-default switch, three region rows (variant select, visibility switch, required reason when hidden, edit shared variant), the slot summary, computed SEO readiness, applied-to count, last save, author, revision; Undo / Revert / Save |
| Inspector · Structure | Fixed region order, policy chips + editor, block ceiling, seed list (add / reorder / remove), binding facts |
| Inspector · Usage | Pages bound / published / draft changes, search, 8-row pages, binding-mode labels, "Open in builder", row selection, bulk reassign with an impact step |
| Templates | 12 starters + anything imported, with intent, blocks, bound layout, revision; create page (copy-on-create), duplicate, **export as JSON**, **import a file**, delete guard for built-ins, starter preview in the shell it would use |
| Overlays | Create layout, create template, archive (guarded), bulk reassign (pick → impact → move), preview (page + width), shared-region editor with blast radius, SEO checklist, preflight, policy editor, **prebuilt browser**, **import dialog**, CAS conflict, unsaved-leave |

## 3. Interlinks, and the proof for each

| From | To | Mechanism | Proof |
|---|---|---|---|
| M7 → M3 | `CmsPage.layout` written on bulk reassign | `LayoutsAPI.reassign` mutates the page registry, bumps `revision`, sets `hasChanges` | `qa_layouts.py` G11–G13; the Pages screen shows the new shell immediately |
| M3 → M7 | the create-page wizard offers the site's live layouts | `LayoutsAPI.sync()` inside `CreatePageModal` | `qa_states_m7.py` I1–I3 |
| M3 → M7 | the edit-details "Master layout" select lists real layouts and never silently rebinds an archived one | `LayoutsAPI.sync(page.siteId)` | same file, `LAYOUTS` memo |
| M7 → M4 | the canvas header/footer/announcement are the **resolved** layout, not a hardcoded mock | `frameFor(siteId, page.layout)` → `Canvas` `frame` prop | `qa_states_m7.py` J3–J5 (Blank Landing: chip reads the real name, announcement correctly absent) |
| M7 → M4 | slot policy filters the library and marks denied blocks | `Library` `policy` prop; `data-policy` banner | `qa_states_m7.py` J6–J7 |
| M7 → M4 | "Open in builder" from a usage row, and "Create page" from a template, both deep-link | `#/builder?site=&page=` | `qa_layouts.py` H7, `qa_states_m7.py` J2 |
| M7 → M5 | the slot policy uses the same registry the library lists (20 types), and an allow-list is filtered against it so a typo cannot hide everything | `REGISTRY` parity | policy editor lists 20; `qa_layouts.py` F9 |
| M4 → M7 | **Save current page as template** writes a real template into this registry, not a tab-local copy, and carries its origin (`builder`) and the page it came from | `LayoutsAPI.importTemplates` inside `SaveTemplateModal`'s handler | `qa_import.py` G1–G3 (saved in `#/builder`, asserted in `#/layouts`) |
| M7 → M6 | the theme bundle's `layout.starterLayouts` is now filled: every live layout with its region refs and policy, plus all 12 templates | `LayoutsAPI.exportStarterLayouts()` in `exportBundle()` | `qa_theme.py` 7.1l (was asserting `{}`) |
| M7 → M1 | `Pages Assigned` / draft-change counts agree with the Pages registry; preflight is the shell-level counterpart of the release preflight | shared `DBX().cmsPages` | `qa_layouts.py` B5 |
| M7 → CRM | none directly — bindings, slots and templates are workspace config, not lead events. Form blocks reach the CRM through D1/D6 in `INTERLINK-PLAN.md` | — | — |

## 4. States

Loading skeletons (list + stage) · empty (only the default layout survives, templates empty
state) · error with retry · slow transport (skeletons held) · Viewer (create/rename/select/
save disabled) · CAS conflict (three-way dialog: keep editing, overwrite, load theirs) ·
unsaved-leave guard · refused deletion with the reason and the count · protected built-in
templates · preflight clean and dirty · hidden-region-without-a-reason warning.

## 5. Honest deltas — what this module does not do

- **Thumbnails are drawn, not rendered.** There is no server-side page renderer in a
  file-based prototype, so the "thumbnail" is the canvas itself; the stored
  `{url, revHash, renderedAt}` field exists but stays empty until a real renderer exists.
- **Region reorder is fixed by contract.** The mock showed a drag strip; only the order
  announcement → header → slot → footer is valid, so the strip states the order instead of
  pretending to reorder. Header and footer cannot be swapped, which is a deliberate
  narrowing of the mock.
- **Chrome blocks are summarised, not edited block-by-block.** The shared-region drawer
  edits the variant's name, announcement text, brand, nav list and CTA. Deep block editing
  of chrome belongs to Module 4 and is not wired back yet.
- **Template bodies are composed in the builder.** The Structure tab reorders and removes
  starter blocks; adding blocks links to the library instead of embedding a second editor.
- **Import covers templates, not master layouts.** A layout is a shell that references
  shared regions and a slot policy; those ids do not exist in an arbitrary file, so an
  imported layout would arrive with a dangling header and footer. Layouts are created and
  bound here; *templates* are what a third-party HTML page can honestly become.
- **Import reads structure and copy, not design.** CSS, fonts, background images and
  JavaScript are discarded by contract. There is no CSS-to-token mapper, no image
  downloader and no style importer — the Theme Studio owns those tokens.
- ~~No mapping editor.~~ **Built** — see §7.2: every row in the prebuilt browser and the
  import dialog can be retyped before it lands.
- **No ZIP import.** One file at a time (.html, .htm, .json), 400 KB, 40 blocks.
- **No scheduling or approval on bindings.** A reassignment is a draft change; publishing
  stays where it already lived — Modules 1 and 3.
- **`Draft Changes` is a count of dirty layouts plus workspace templates**, not a
  per-property diff. The revision drawer shows what each step changed about the *block
  count* and restores a whole structure; it does not diff two revisions field by field.
- **Locale-neutral copy.** The module is written without a locale assumption, and the
  seed content is sample data — not verified fact about any real institution.

## 6. Import & the prebuilt library

Added after the build, on request: real third-party starters in the artefact, and a
user-facing door for any HTML or JSON template.

### 6.1 What ships inside the build

`templates/` holds 14 open-source templates (MIT, from
`github.com/mmrahmanbappi/free-html-templates`, commit `bab6ec6c8900`), fetched by
`scripts/fetch-prebuilt.mjs`, cleaned of scripts/styles/iframes/inline handlers/inline SVG,
and committed with their upstream licence text. `templates/PROVENANCE.md` is generated and
lists every file, its category, its raw and cleaned size, and the commit it came from.
`src/lib/prebuilt-kits.ts` inlines the same HTML into the artefact, so the artefact opens
offline with no runtime fetch and the zip stays self-contained.

The 14 kits: university, language school, online course, tutoring, coding bootcamp, travel
agency, consulting firm, creative agency, webinar signup, ebook download, product launch,
conference event, nonprofit/charity, SaaS product. 88 KB total, 3–12 KB each.

**The library and the importer are the same code.** `prebuilt-db.ts` parses each kit with
`importHtml()` on first use, so a fix to the extractor fixes the library too, and the
"what will land" list a user sees for a kit is the same list the extractor produced.

### 6.2 The import contract

`src/lib/html-import.ts`:

- `sanitizeHtml()` strips `<script>`, `<style>`, `<noscript>`, `<iframe>`, `<object>`,
  `<embed>`, `<canvas>`, inline `on*` handlers and `javascript:` URLs **before** a node is
  read. Nothing in an uploaded file is executed; `qa_import.py` C12 proves it by asserting
  a `window.__pwned` script never ran.
- The document is parsed with `DOMParser`, not inserted into the page.
- Sections are ranked and mapped to registry blocks: first section with a heading + copy →
  `hero`; `b`+`span` pairs → `featureGrid · stats`; repeated heading+copy children →
  `featureGrid`; `<table>` → `table`; `<details>` or headed pairs → `faq`; `<blockquote>` →
  `testimonials`; a form → `form`; a long `<ul>` → `list`; otherwise `heading` + `text`.
- Chrome is dropped **with a reason**: nav/header/footer are Global Regions in this module,
  so repeating them inside a template would double the shell. The report says so.
- `JSON` accepts four shapes: a WACRM export (`kind: "wacrm.templates"`), a bare block
  array, `{ blocks: [...] }`, and a GrapesJS-style `{ pages: [{ html }] }` whose HTML goes
  through the *same* extractor. Unknown block types are named in the report, never silently
  replaced (`qa_import.py` D3).
- Limits: 400 KB, 40 blocks, 20 templates per bundle, 120 templates per workspace; every
  refusal states the number (`E_SIZE`, `E_JSON`, `E_SHAPE`, `E_EMPTY`, `E_VALID`,
  `E_LIMIT`).

### 6.3 Provenance is stored, not implied

`PageTemplate.origin = { kind: builtin | prebuilt | html | json, name, source, license,
commit, importedAt }` is written by `LayoutsAPI.importTemplates()`, shown as a pill in the
library row and in the inspector (`Prebuilt · MIT`, `Imported · HTML`), and repeated as
`Origin / Source / Commit / Imported` key-value rows. Imported copy is labelled sample
content — it is never presented as verified fact (`qa_import.py` B10, B13).

### 6.4 Round trip

`Export as JSON` writes `{ kind: "wacrm.templates", schemaVersion: 1, site, template,
revision, templates: [{ name, intent, layout, blocks: [{ type, variant, props }] }] }`.
`qa_import.py` E1–E5 downloads a real file, parses it in Python, re-imports it through the
dialog and asserts the block count survives.

## 7. After the audit: mapping, history, and the three open interlinks

The audit (`MODULE-7-AUDIT.md`) named four gaps. All four are now built.

### 7.1 Revision history — the drawer that replaced a fake Revert

`Revert` used to bump the revision counter and toast *"the previous structure was restored"*
without restoring anything. Now:

- `StructureSnapshot` is stored on every write (`structureOf`) — region refs, slot seed +
  policy, or template blocks, plus the block count.
- Seeded history entries predate stored structures; rather than leave them dead they are
  back-filled with the structure the seed describes, because that is what they claim.
- `LayoutsAPI.history(kind, id)` returns `RevisionEntry[]` with `restorable`, `isCurrent`
  and a block-count `delta` against the entry below it.
- `LayoutsAPI.revert(kind, id, rev)` restores the stored structure **as a new revision**;
  it refuses with a reason when the entry has no snapshot or the layout is archived.
- `HistoryModal` lists them, marks the current draft, guards restore behind an inline
  confirm, and says in its footer that restoring never rewrites in place.
- Both layouts and templates have the entry point in the inspector footer.

Proof: `qa_m7_links.py` A1–A14 (34 → 15 assertions on restore semantics) and B1–B3.

### 7.2 Mapping editor

Retype any block — in the import dialog and in the prebuilt browser — before it lands.
`remapBlock()` keeps the props whose key exists on the target type (coercing numbers and
booleans to text where the target wants a string) and falls back to that type's defaults for
the rest, so nothing silently keeps a field the new type cannot render. Retyped rows are
highlighted and counted; the prebuilt browser can undo its edits back to the curated mapping.

Proof: `qa_import.py` H1–H10, including the round trip through Structure after saving.

### 7.3 The three open interlinks, closed

| Interlink | What it does now | Proof |
|---|---|---|
| **M3 → M7** | the page inspector names the *resolved* layout, says whether the page follows the website default or is pinned, and shows the header variant with its link count; the variant name deep-links to that layout | `qa_m7_links.py` C1–C6 |
| **M5 → M7** | every native block card shows `nL · nT` — layouts and templates that actually use it — and the inspector lists layout seeds, templates and chrome variants separately | `qa_m7_links.py` D1–D4 |
| **M8 ← M7** | Module 8 is not built, so its placeholder now shows the navigation it will inherit: the header variant the site default resolves to, its links in order, and a deep link to the one place they can be edited today | `qa_m7_links.py` E1–E5 |

The M8 card is deliberately labelled as the current source, not as a finished menu editor —
the module is still a placeholder and the copy says so.

In-app deep links also got a fix found by these tests: `#/layouts?tab=&itab=&sel=` arriving as
a **hash change** (from Module 3) never reached the module-scope boot parse, so the selection
was dropped. The screen now listens for `hashchange` and applies whatever parameters are
present, idempotently, because the store rewrites the hash itself.

## 8. Editing a template where it is seen

**Problem.** The Page Templates preview was read-only. A template's copy could only be changed
after leaving the screen, so the screen was a viewer rather than an editor.

**Decision.** Edit in place, in the same screen, and keep structure separate:

- Click any starter block on the canvas. Its own fields open in the Structure inspector, taken
  from the block registry, so the editor and the renderer never disagree.
- Changes stay in the template draft until **Save**, which writes a revision. The canvas updates
  as you type.
- Reorder and remove stay in the Structure list. Every content kind is edited in place: text,
  textarea, select, segmented, toggle, number, link (a page or a URL), media (from the site's
  assets) and item lists (add, remove, move). One component, `BlockFields.tsx`, renders all of
  them, for both template starters and master-layout seed blocks. Style tokens stay in the
  Visual Builder and Theme Studio, because they are workspace-level settings, not block content.

**Why this model.** Two established systems converge on it. WordPress's Site Editor lets you
click a block inside a template part and edit its content directly, while the structural
wrapper stays locked behind an explicit "Edit original" step
(<https://wordpress.com/support/template-part-block/>). Shopify's theme editor opens a section's
settings when you click it, and its preview inspector lets you select an element in the preview
to change it (<https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview>).
Both separate content editing from structural editing; neither makes the user leave to change a
headline.

**Proof.** `qa_m7_links.py` H1–H5: blocks are selectable, selecting opens the editor, a field
edit updates the canvas, Save survives a reopen, and the demo copy is restored afterwards.
`qa_m7_export_edit.py` Y1–Y10: the same inspector works on master-layout seed blocks, covering
text, link and item edits, and Save is enabled by an edit.

## 9. Export: JSON, XML and CSV

**Decision.** Export from the template row menu in three formats, one template per file.

- **JSON** is the round-trip format. It imports back through the same path as any bundle.
- **XML** (`wacrm-templates`) is for reading and for other tools. Each prop carries a `kind`
  attribute (string, number, boolean, null, object, array), so a reader can tell a text value
  from structured data without guessing.
- **CSV** has one row per prop, with columns template, intent, layout, position, block type,
  variant, prop, prop kind and value. Non-text values are JSON text in the value column. It is
  written as RFC 4180 with CRLF line endings and a BOM, so spreadsheets open it correctly.

**Why one template at a time.** A whole-workspace export is a backup concern, not a template
concern, and it belongs with the data-export work in Settings. It is not built here.

**Proof.** `qa_m7_export_edit.py` X1–X13: the three formats are offered, the XML is well-formed,
the CSV has the expected header, width and line endings, quoting is correct, and XML and CSV
agree on every prop value.

