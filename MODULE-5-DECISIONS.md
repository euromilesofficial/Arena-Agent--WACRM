# Module 5 — decisions taken, and what was built

**Date** 13 Nov 2026 · **Spec** `MODULE-5-BLOCK-LIBRARY-SPEC.md` · **Gap review** `MODULE-5-GAP-REVIEW.md`
**Instruction** *"Use your super intelligence and choose yourself."* — so every open decision below was taken here, with the reason, and can be reversed by naming the ID.

---

## 1. The twelve decisions

| # | Decision | Taken | Why |
| --- | --- | --- | --- |
| M5-1 | What "20" counts | **20 types**, variants selected in the inspector | The registry has exactly 20 types and 74 named variant options. Counting variants as types would break schema validation and make the KPI lie about what can be inserted. |
| M5-2 | Section templates | **Keep all 23** | You have twice said the library is too small. Cutting 23 → 12 to match a placeholder number was the one option with no upside. |
| M5-3 | Saved templates seed | **14** (not 5) | The mock's own header says 24 while its KPI says 5 — both are placeholders, and 5 leaves the paginator permanently disabled, i.e. a control with no state behind it. 14 exercises page 2 with 12-per-page and still reads as a real workspace. The KPI is computed, so it says 14. |
| M5-4 | Taxonomy | **Your four:** Content 10 · Media 2 · Layout 5 · Form 3 | Reproduced exactly by re-filing two registry entries — `Button → Form`, `Alert → Content` — and dissolving the `Actions` group. Zero new types, zero new renderers, no schema change, and the builder palette now agrees with the library by construction. |
| M5-5 | Sticky bars | **Dropped** (`Sticky Bottom CTA`, `Sticky Advisor Banner`) | D5 deferred sticky bars and popups. A sticky bar hidden inside a CTA category is how that decision gets quietly reversed. |
| M5-6 | Saved Templates | **Built as a real entity** + placement index + save-from-section + duplicate + guarded delete | Without it, three of the four views and the entire Usage tab would be decoration. |
| M5-7 | Insert verbs | `Insert` on cards, `Insert into Page` in every inspector, `Use Template` retired | Four verbs for one action is how users learn the wrong affordance. |
| M5-8 | Drag grips | **Removed** | The mock's grips imply drag-to-builder; the spec says the modal is the only mutation path. A grip that does nothing is worse than no grip. |
| M5-9 | Import Template | **Disabled with a reason** | A file importer without a validated interchange format is a security surface with no product behind it. Ships as a visible, explained control; the format is Module 7 work. |
| M5-10 | Role gating | Editor+ create/duplicate, Owner delete, Viewer read-only | The store already models `role`; the mocks only ever drew an Owner. |
| M5-11 | `emits`/`requires` | **Implemented** on every catalogue entry | "Dependency validation" was named in the spec and defined nowhere. The insert modal's confirm button is now driven by it. |
| M5-12 | Old `MODULE-5-REVIEW.md` | Stamped **superseded**, kept | The industry research and the Module 6 form-builder shape still hold; the 19 → 38 expansion is deferred as a palette change. |

Two deviations from the mocks, both deliberate: **every timestamp is on the app's own demo clock (May 2025)**, not the mocks' January; and **card titles use an em dash** so `Category — Name` is generated, never typed.

---

## 2. What was built

| File | Lines | What it carries |
| --- | --- | --- |
| `src/lib/library-db.ts` | 560 | Catalogue (20 types · 23 sections · 14 saved), taxonomy, filters/sort/search, placement index derived from real drafts, `requires/emits`, save / duplicate / guarded delete, `insertIntoPage` |
| `src/views/Library.tsx` | 700 | Header, KPI strip, filter rail, grouped grid, list view, pager, inspector (3 tab sets), card menu, 12 states |
| `src/components/library/LibraryModals.tsx` | 400 | Insert into Page (6 outcomes), Create Template (2 steps), Delete guard, Preview |
| `src/styles/app.css` | +470 | `m5-*` namespace — Module 4 already owned `lb-*` |
| `src/lib/builder.ts` | edited | Four-category taxonomy, `Forms` section category, Footer offered as type 20 |
| `qa_library.py` | 72 assertions | Counts asserted against the registry, not against text |

**Counts, all computed:** Native **20** · Sections **23** · Saved **14** · In Use **21** (templates with ≥ 1 placement). The All view reads 57 = 20 + 23 + 14, facets sum to it, and the same constants drive the builder palette.

**The insert path** is the only way this screen changes a page: site → page → position (top / end / after a section) → dependency check → confirm. It writes one draft revision through `BuilderAPI.saveDraft(expectRevision)`, so a stale modal produces a 409 rather than a silent overwrite, and the page record in Module 3 flips to "has changes" on the same tick.

**States that exist:** loading skeleton, refreshing, empty, no-results, 503 error with retry, import disabled-with-reason, viewer read-only, conflict, page-limit, dependency-unmet, delete guard, inspector closed, pagination, 72 QA assertions behind them.

---

## 3. QA — 10 suites, 548 assertions, all green

| Suite | Result |
| --- | --- |
| `qa_library.py` (new) | 72/72 |
| `qa_builder.py` | 98/98 (was 97 + 1 new Forms-category check; 6 assertions updated for the new taxonomy) |
| `qa_pages.py` | 106/106 |
| `qa_ai.py` | 60/60 |
| `qa_module2.py` | 48/48 |
| `qa_states_m4.py` | 47/47 |
| `qa_states_m3.py` | 40/40 |
| `qa_states_m1.py` | 39/39 |
| `qa_flows.py` | 38/38 |
| `tsc --noEmit` | clean |

The three builder regressions the re-filing caused were expected and are now asserted in the new shape: four group headers, Footer offered as type 20, CTA 4 + Forms 2.

---

## 4. Known limits, stated rather than hidden

1. **Import** is a disabled control. The v1 interchange format is not written.
2. **Undo of a delete** is a toast, not a real restore — the prototype store has no tombstone. The insert path's undo is real (the builder's revision history).
3. **Placement attribution** for built-ins is derived by matching block-type signatures in each draft; two different sections with identical type sequences resolve to the first entry. Saved copies are attributed only by recorded placements, so they are always exact.
4. **The 40-block page ceiling** is the prototype's limit, inherited from Module 4, and is surfaced as a 413.
5. **Only `Owner`** can delete; `Admin` does not exist in this build's role union, so the spec's five-role model is compressed to three (Owner / Editor / Viewer), same as Modules 1–4.

## 22 · Overview composition diagram (post-shipment addition)

The mock's Overview tab links a section to its constituent parts. Built as a
single-purpose diagram, not a second structure editor:

- **Literal, then collapsing.** Tiles are the parts the document actually has —
  real child blocks first (variant-aware, identical siblings folded into one tile
  with a `×N` count), otherwise non-empty `content` fields matched by `PART_RULES`.
  Empty fields never become tiles, so the diagram cannot claim structure the
  document lacks.
- **Four tiles maximum.** The inspector is 330 px wide; five 66 px tiles leave
  labels unreadable. A `+N` tile carries the remainder, and it opens the Structure
  tab, which stays authoritative. Nothing is hidden behind the diagram that cannot
  be reached in one click.
- **The sentence is not decoration.** `compositionOf().sentence` becomes the
  group's `aria-label`, so the same information reaches assistive tech without
  reading four tiles.
- **Usage is recorded, not inferred.** A block *type* is counted as used on every
  page whose draft contains it (a hero really is on most pages); sections and saved
  copies count recorded placements — seeded, or written by Insert into Page — because
  window-matching cannot tell "the Study Abroad hero" from "a hero". `Used on 2 pages`
  therefore means two rows a user can open, never an estimate.

## 23 · Mock-fidelity pass (audit `10530b7` → this build)

The audit found 14 divergences from the ten mocks. Closed here:

1. **Native catalogue = 25, not 20.** The mock's twenty blocks exist 1:1 — Rich Text,
   Spacer, Stats Strip and Icon Grid are *configurations* of existing types (Text rich,
   Divider space, Feature Grid stats/icons) and Accordion is the FAQ type under its
   generic label. Five domain blocks the workspace already ships (Hero, Footer, Pricing,
   Feature Grid, FAQ) ride along. No type was duplicated: the builder still offers one
   way to make a spacer.
2. **Library categories are the mock's four** — Content · Layout · Interactive ·
   Engagement — computed per catalogue row, not from the builder's palette groups. The
   Visual Builder keeps Content · Media · Layout · Form because that is *its* mock
   (07:03 batch). Two screens, two taxonomies, one registry.
3. **Native cards are icon cards**: icon tile, grip, kebab, three-line copy, `Preview` /
   `Insert` — no thumbnail, so five fit a row and all four groups stay visible.
4. **Section + saved grids are three-up**, the mock's rhythm, so `Use Template` and the
   creator line fit without clipping.
5. **Compatibility facet is real**: Schema-validated / Built-in / Reusable are checkboxes
   that filter (unticking Reusable drops the Footer, the one master layout).
6. **View titles carry counts and a one-line explanation**, and a category filter turns
   the title into `Templates (6) — Hero`.
7. **CTAs are per-kind**: `Insert Block` (native), `Insert into Page` (section),
   `Use Template` (saved) — card and inspector.
8. **Duplicate to My Templates works on a built-in**, as the menu mock shows.
9. **Native Overview is a property view** — About this block · Key supported properties ·
   Compatibility · Where you can use it. Sections keep the composition diagram; the two
   kinds genuinely differ in the mocks and in reality.
10. **Diagram fits five tiles**, renders counts as `(×3)` and qualifies backdrops as
    `Image (Background)`.
11. **Breakpoints are cards** (Desktop ≥1200 / Tablet 768–1199 / Mobile ≤767) instead of a
    one-line strip.
12. **Saved cards** carry creator + `Updated` stamp, paginate six at a time, and the saved
    Overview is the mock's icon-keyed list (Owner · Created by · Last updated · Total
    usage · Used in, per website).
13. **Usage table gains Last Updated and View placement** — the latter resolves the real
    block id and opens the Visual Builder with that placement selected, so it is a link to
    something, not a label.
14. **Structure tab** gains Expand/Collapse.

Left as it is, deliberately: card thumbnails remain wireframe schematics rather than
photographic renders (a generated-image set would add ~0.6–1 MB to a single-file artefact
and would still be fiction); the inspector preview is the same schematic.
