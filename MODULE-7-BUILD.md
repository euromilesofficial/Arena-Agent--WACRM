# Module 7 — Layouts & Templates · build record

Reviewed first (`MODULE-7-SPEC.md`, `MODULE-7-BENCHMARK.md`, `MODULE-7-GAP-REVIEW.md` — 22
findings, 16 decisions), then built. This is what actually shipped, how it is wired to the
other modules, and what is honestly still missing.

Screen: `#/layouts?site=&tab=&itab=&sel=`. QA: `qa_layouts.py` (99) + `qa_states_m7.py` (38).

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
| Header | Website selector (all screens share it), **Preflight** with a live finding count, **Preview Layout**, contextual **+ Create Layout / + Create Template** |
| KPIs | Master Layouts · Page Templates · Pages Assigned · Draft Changes — each derived, each with a definition tooltip (`Tip`) because "assigned" has three plausible meanings |
| Library | Master Layouts \| Page Templates with counts; search; sort (updated / name / pages); archived opt-in; per-row menu (preview, reassign, set default, duplicate, archive/restore) |
| Canvas | The resolved shell drawn from the working copy: announcement text, header brand/nav/CTA, slot seed blocks, footer columns. 1440 / 768 / 375 with a fit scale that never exceeds 1:1, zoom, and a **Draft preview — not live** chip |
| Slot bar | Allowed-type count (opens the policy editor), seed count, ceiling, "Compose in builder" |
| Page groups | Six cards derived from routes (Main 9, Landing 1, Program 8, University 6, Information 8, Other 16 on the seed site) — click filters Usage |
| Inspector · Overview | Inline name, description, website-default switch, three region rows (variant select, visibility switch, required reason when hidden, edit shared variant), the slot summary, computed SEO readiness, applied-to count, last save, author, revision; Undo / Revert / Save |
| Inspector · Structure | Fixed region order, policy chips + editor, block ceiling, seed list (add / reorder / remove), binding facts |
| Inspector · Usage | Pages bound / published / draft changes, search, 8-row pages, binding-mode labels, "Open in builder", row selection, bulk reassign with an impact step |
| Templates | 12 starters with intent, blocks, bound layout, revision; create page (copy-on-create), duplicate, delete guard for built-ins, starter preview in the shell it would use |
| Overlays | Create layout, create template, archive (guarded), bulk reassign (pick → impact → move), preview (page + width), shared-region editor with blast radius, SEO checklist, preflight, policy editor, CAS conflict, unsaved-leave |

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
- **No import.** Export is implemented (theme bundle); importing layouts is refused by
  decision, with the reason shown, because a layout can reference regions that do not exist
  in the target workspace.
- **No scheduling or approval on bindings.** A reassignment is a draft change; publishing
  stays where it already lived — Modules 1 and 3.
- **`Draft Changes` is a count of dirty layouts plus workspace templates**, not a diff
  viewer. There is no per-property diff for a layout revision yet.
- **Locale-neutral copy.** The module is written without a locale assumption, and the
  seed content is sample data — not verified fact about any real institution.
