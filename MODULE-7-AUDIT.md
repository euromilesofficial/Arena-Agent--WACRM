# Module 7 — audit: achieved vs left

Question asked: *"whatever we have planned to build in this module has been achieved, or have you
left something?"*

Short answer: **the spec's normative surface is built and tested; five things from the spec's
"recommended/mockup-only" list are deliberately not built; one blueprint requirement, the
mapping editor, the revision history and three cross-module read-outs were missing and are
now built.** What genuinely remains is the list in §4 — shorter than it was, and nothing in it
is a hole in the spec.

Evidence base: `MODULE-7-SPEC.md` (spec), `MODULE-7-GAP-REVIEW.md` (22 findings, F1–F22),
`MODULE-7-BUILD.md` (what shipped), `qa_layouts.py` 99 + `qa_states_m7.py` 38 +
`qa_import.py` 65 + `qa_m7_links.py` 33 (235 assertions on this module alone), 15/15 suites ·
1042 assertions overall.

---

## 1. Spec §21 "Explicit blueprint requirements"

These are the requirements the spec marked as coming from the source blueprint rather than
from taste. All nine are built.

| Requirement | Built | Evidence |
|---|---|---|
| Master header/footer layouts | yes | `SharedRegion` + `RegionRef`; chrome is referenced, never copied |
| Explicit content slot injection | yes | `slot.seed` + `slot.policy`; one required, non-removable slot drawn with a `Required` pill |
| Website default + specialised layout assignment | yes | `isDefault` on the layout, `resolveLayoutId(CmsPage.layout)`; bulk reassign with an impact step |
| `master_layouts` / `layout_revisions` / `page_layout_bindings` | yes, with one deliberate difference | layouts + revisions exist; bindings are the `CmsPage.layout` string M3 already owns, resolved in one function — no second table that can drift (`MODULE-7-BUILD.md` §1.3) |
| Full-page starter template library | yes | 12 built-ins + 14 prebuilt open-source starters + anything imported |
| **Save Page as Template** | **was missing — now fixed** | the builder's *Save current page as template* wrote only to a local ref; it now writes through `LayoutsAPI.importTemplates` with `origin.kind = "builder"`. `qa_import.py` G1–G3 prove the template appears in `/layouts` |
| `page_templates` / `template_revisions` | yes | `PageTemplateDoc.rev`, `saveTemplate(doc, expectedRev)` CAS, snapshots on every write |
| Guarded delete of layout in use / template | yes | archive dialog opens with the destructive button disabled and the reason in full; `qa_layouts.py` D-series |
| Native block schema, CAS publishing, tenant isolation | schema yes, publishing elsewhere | blocks are M4's `REGISTRY`; CAS via `expectedRev`; site scoping on every call. Publishing stays in M1/M3 by design |

## 2. Spec §21 "Mockup-only or recommended"

| Item | State |
|---|---|
| Four KPI cards | built, each derived, each with a definition tooltip |
| Three inspector tabs | built |
| Optional announcement + explicit header/footer variant selectors | built |
| Colour/status chips, right-side sticky Save | built |
| Editable template SEO-ready flag | built (`seoChecklist`, computed readiness + manual override) |
| Page groups + detailed Usage table | built (six groups derived from routes; 8-row paged table) |
| Exact entry names, owners, timestamps | built from the seed data, labelled as sample |
| Bulk Reassign | built (pick → impact → move, 40-page cap) |
| **Customisable region reorder (drag)** | **not built — deliberate.** Only one order is valid (announcement → header → slot → footer) because the regions are the shell's contract. The strip states the order instead of pretending to reorder it (`MODULE-7-BUILD.md` §5) |
| Export Template independent of the Theme Studio export | **was missing — now built**: row menu → *Export as JSON*, `{ kind: "wacrm.templates", schemaVersion: 1 }`, round-trip proven by `qa_import.py` E1–E5 |

## 3. The new request — prebuilt templates + upload

| Ask | State |
|---|---|
| Find real prebuilt layouts/templates and put them inside | 14 MIT templates committed in `templates/prebuilt/` **and** inlined into the artefact (`src/lib/prebuilt-kits.ts`), 88 KB, provenance per file |
| Upload HTML templates | **Import → HTML file** (drop, choose, or paste). Extracted to registry blocks; sanitised before parsing; scripts/styles/iframes/handlers never read |
| Upload JSON templates | **Import → JSON bundle** (WACRM export, bare block array, `{blocks}`, or a page-builder project whose HTML goes through the same extractor) |
| Import never executes third-party code | `sanitizeHtml()` + `DOMParser`; `qa_import.py` C12 asserts an uploaded `window.__pwned = 1` never ran |
| Honest about what an import cannot carry | the report lists what lands, what is dropped and **why** (nav/footer are Global Regions here; CSS is the theme's), and shows brand hints without applying them |

## 4. What is still left — the honest list

Ordered by how much a real user would notice.

1. **No layout import — only templates.** A layout is a shell that references shared regions
   and a slot policy; those ids do not exist in a third-party file, so an imported layout
   would arrive with a dangling header and footer. Layouts are created and bound here.
2. ~~No mapping editor in the import dialog.~~ **Built** — every row in the prebuilt browser and
   the import dialog can be retyped before it lands, with the shared fields preserved and an
   undo back to the curated mapping (`qa_import.py` H1–H10).
3. **No CSS / design import.** Colour, type and spacing always come from the active theme;
   there is no CSS-to-token mapper or image downloader. This is a policy, not an oversight:
   the Theme Studio owns those tokens.
4. ~~No ZIP / batch upload.~~ **Built** — a ZIP of HTML files imports as one batch with one report
   entry per file. Limits: archive 2 MB, 200 entries, 400 KB per HTML file, 4 MB uncompressed in
   total, 20 templates per bundle, 120 per workspace. Encrypted, ZIP64 and path-escaping (zip-slip)
   entries are refused (`qa_m7_zip.py` 20/20).
5. **Chrome is summarised, not edited block-by-block.** *Decision (this pass):* this stays open
   on purpose. The header variant stores a flat `nav` list and a CTA, not blocks, so there is no
   block tree to edit. Footer is edited in the Global Footer drawer only, never inline, because a
   shared footer changes every layout that uses it; the drawer lists those layouts. Menu structure
   now lives in Module 8. Revisit only if headers become block-based.
6. ~~Templates are composed in the builder.~~ **Built in part.** Every starter block is edited in
   place: click a block on the canvas, or pick it in the Structure list, and its fields appear in
   one inspector. Text, select, segmented, toggle, number, link (page or URL), media (from the
   site's assets) and item lists (add, remove, move) are all editable there. The same inspector
   edits master-layout seed blocks (`qa_m7_export_edit.py` Y1–Y10). What stays in the Visual
   Builder and Theme Studio: style tokens, and adding a block that was not in the starter.
   Text is edited inline on the canvas itself (MODULE-7-BUILD §8.1, `qa_m7_inline.py`).
7. ~~`Draft Changes` is a count, not a diff.~~ **Built** — each revision row has a Changes panel
   that compares the two structures: regions, blocks, variant fields and the shared footer, listed as
   added, removed or changed (`qa_m7_diff.py` 16/16).
8. **No rendered preview / thumbnail.** The canvas is a schematic of the resolved shell. There
   is no page renderer in a file-based prototype, so the stored `{url, revHash, renderedAt}`
   field stays empty.
9. **No AI in this module.** AI generation and in-canvas rewriting are M4 features; a
   "generate starter blocks from a prompt" affordance inside the import dialog does not exist.
10. **No approval, scheduling or audience targeting on bindings.** A reassignment is a draft
    change; publishing stays in M1/M3 (also explicitly deferred by spec §21).
11. **No cross-site clone.** Duplicating a layout or template works inside one website; copying
    a layout between websites is not offered.
12. ~~Three interlinks are still open.~~ **Built**: M3 names the resolved shell and deep-links
    to it, M5 counts layout and template usage per block, and M8 (Menus & Navigation, now built)
    reads and writes the header and footer variants (`qa_m7_links.py` C1–E5, `qa_m8_menus.py`).
14. ~~Export offers JSON only.~~ **Built**: each template exports as JSON (round-trips through
    Import), XML (`wacrm-templates`, props carry their kind) or CSV (one row per prop, RFC 4180
    quoting, CRLF). XML and CSV are cross-checked against each other (`qa_m7_export_edit.py`
    X1–X13). Export is one template at a time; a whole-workspace export is not offered.
13. **One state row is covered by construction, not by a test.** Spec §13's *broken shared
    reference* cannot be reached because variants can be edited but never deleted — so there is
    no dangling-reference state to test. If variant deletion is ever added, that state becomes
    reachable and needs a suite.

## 5. What I did next, and what would come after

Done in earlier passes: the mapping editor, the revision-history drawer with real structure
restore, and the three interlinks (`MODULE-7-BUILD.md` §7).

Done in this pass: the revision diff (item 7) and the ZIP batch import (item 4).

Remaining candidates, in order of user-visible value:

1. **Region reorder inside the slot** — the shell order is fixed by contract, but the seed
   blocks could be dragged in the canvas instead of the Structure list.
2. **Rendered thumbnail** (item 8) — needs a page renderer; not possible in this prototype.
3. **Whole-workspace export** (item 14 note) — one template at a time today.

## 6. Module 8 integration pass (spec v1.1 §31)

Recorded against the M7 spec. What changed, and what is still open.

- **Publish preflight blocks broken menu references (M7 spec L778): built.** The release modal's
  "No broken menu references" check is computed from live menus, live placements and each variant's
  `menuRef`, and Freeze manifest is disabled while it fails. `publishRelease` in the store refuses the
  same release. The previous check was a fixed pass. Covered by `qa_m8_v3.py` (U3 clean baseline) and
  the browser release modal; a dedicated broken-reference browser test is still to add.
- **Release snapshot (M7 spec item 5, L854): built as a numbered version.** Each publish stores the
  live menus, mega panels and layout bindings. Rollback restores all three together (`qa_m8_v3.py` U10, U11).
- **Preview pinning (L854): partial.** The Menus preview shows the draft and says so. The Layouts
  preview does not pin a menu revision yet.
- **Footer edited only in the Global Footer drawer: unchanged and not re-verified** against the
  menu-derived footer groups in this pass.
- **Layouts owns the slot bindings: data built, UI partial.** The bindings are keyed by layout id and
  slot. The Layouts header modal shows the bound menu, its sync state and an Edit in Menus link, and
  replaces the free comma list with the menu's links. Editing bindings from Layouts is still open;
  they are edited from Menus (Manage Placements).
- **Release modal other checks** (DNS, SSL, Core Web Vitals) remain fixed passes, as before.
