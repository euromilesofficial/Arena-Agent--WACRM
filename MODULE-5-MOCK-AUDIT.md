# Module 5 — Mock vs build audit

**Scope:** the ten Block Library mocks in `uploads/` (two batches, `07_03_43…07_04_00` is the
*Visual Builder*, so the Module 5 set is `08_05_53 → 08_06_08`, ten screens) plus
`WACRM Block Library Dashboard.webp`. Compared against build `10530b7`.

**Question asked:** is the Native Blocks screen built the way the mock shows it, and is
anything missing across the whole module.

---

## 1 · Verdict

**Structure: yes. Detail: no — roughly 75 % faithful, and the gap is concentrated in four
places** — the native card anatomy, the category taxonomy, the native inspector's Overview
content, and the fidelity of the card thumbnails.

Nothing in the module is *wrong*, but several things are **ours rather than the mock's**:

| # | Area | Mock | Build `10530b7` |
|---|---|---|---|
| 1 | Native card anatomy | icon + title + 2-line description + `Preview` / `+ Insert`, drag handle `⋮⋮` top-right, **no thumbnail** | 104 px wireframe thumbnail + badges row + description + buttons, kebab on the thumb |
| 2 | Native grid density | **5 cards per row**, all four category groups visible in one 941 px screen | **4 per row** (`minmax(184px)`), ~2 groups visible before scrolling |
| 3 | Category taxonomy | Content · Layout · **Interactive** · **Engagement** | Content · Media · Layout · **Form** |
| 4 | Native inspector Overview | "About this block" → "Key supported properties" (Label, Link, Style, Size, Icon, State) → "Compatibility" → "Where you can use it" | the section-style **flowchart** (`Component Structure` → diagram → responsive → used → kv grid) |
| 5 | Diagram tiles | **5** fit across the 330 px rail (Heading · Text · Buttons · Image · Background) | **4** then a `+N` tile |
| 6 | Tile qualifiers | `Item (×3)`, `Image (Background)` | `×3` chip, bare `Image` |
| 7 | Card thumbnails | rendered designs — real type, colour, photography | grey placeholder bars (`LibThumb`) |
| 8 | Compatibility filter | checkboxes: Schema-validated (20) · **Built-in (20)** · **Reusable (20)** | Schema-validated · Responsive (2 rows, not the mock's 3) |
| 9 | View title | `Native Blocks (20)` + subtitle; `Templates (6) — Hero` when a category is active | `Native Blocks` + a count chip; no subtitle, no category suffix |
| 10 | Inspector footer CTA | native: **`+ Insert Block`**; section: `+ Insert into Page`; saved: `+ Use Template` | `+ Insert into Page` everywhere; cards say `Insert` for saved too |
| 11 | Saved cards | creator avatar + name, `Updated Jan 18, 2025`, **6 per page**, pagination `1 2 3 4 ›` | no creator line, 12 per page (pagination exists) |
| 12 | Usage tab | 4 KPI cards + table with **Last Updated** and **View Placement** | 4 KPI cards + table with Status and `Open` only |
| 13 | Structure tab | expand-all + per-row `⋯`, `(Optional)` rows, type chip per node, footer cards *Responsive / Validation / Block Types* | tree with type chip + 3 mini cards; no expand-all, no row menus |
| 14 | Card `⋯` menu | Preview · Insert into Page · **Duplicate to My Templates** · **Save as Template** · ─ · Delete Template (greyed on built-in) | Preview · Insert into Page · Duplicate **saved-only** · Delete **saved-only**. No "Save as Template", and a built-in cannot be duplicated |

## 2 · What matches exactly

- Four-view rail (All · Native · Section Templates · Saved Templates), counts on Saved.
- KPI strip: 20 Native · Section Templates · Saved Templates · In Use, same icons and order.
- Header: Website selector, `Import Template`, `+ Create Template`.
- Search, category chips with counts, Scope filters, `Reset filters` + site footer.
- Grouped section grid: icon + `Heading (n)` + right-aligned one-line explanation, per group.
- Card button pair (`Preview` outline + `Insert` purple), selected-card ring + top-right `⋯`.
- Saved-card `Use Template` (mock) vs `Insert` (ours) is the only card-label drift.
- Kebab menu exists on every card with `Preview` / `Insert into Page` / duplicate / delete, and
  Delete is correctly disabled on built-ins — structurally the 11th mock's menu, minus
  `Save as Template` and with duplicate restricted to entries you already own (row 14).
- Inspector: preview panel, badge row, `Overview / Structure / Usage` for sections,
  `Overview / Properties / Compatibility` for blocks, `Preview` + primary CTA footer.
- Section Overview: `Component Structure` → description → diagram → `Responsive: Desktop ✓
  Tablet ✓ Mobile ✓` → `Used on N pages ›` — this is the AM-1/AM-3/AM-6/AM-7 layout, built last turn.

## 3 · Inventory: 15 of 20 native blocks are the same, 5 differ each way

| Mock block | Ours | Mock block | Ours |
|---|---|---|---|
| Text | Text ✓ | Container | Container ✓ |
| Heading | Heading ✓ | Columns | Columns ✓ |
| Image | Image ✓ | Divider | Divider ✓ |
| Video | Video ✓ | Table | Table ✓ |
| Button | Button ✓ | List | List ✓ |
| Form | Form ✓ | Quote | Quote ✓ |
| CTA Section | CTA Section ✓ | Alert | Alert ✓ |
| Testimonials | Testimonials ✓ | — | — |
| **Rich Text** | ✗ (folded into Text's rich variant) | **Hero** | ours only |
| **Spacer** | ✗ (folded into Divider) | **Footer** | ours only |
| **Accordion** | ✗ (ours is FAQ) | **Pricing** | ours only |
| **Stats Strip** | ✗ (Feature Grid variant) | **Feature Grid** | ours only |
| **Icon Grid** | ✗ (Feature Grid variant) | **FAQ** | ours only |

The five mock-only blocks exist here as **variants of four existing types**, so nothing a user
needs is unreachable — but the catalogue reads differently. The five ours-only entries
(Hero, Footer, Pricing, Feature Grid, FAQ) are the mock's *section templates*, surfaced as
blocks as well. That is why `In Use` shows 31 rather than the mock's 3: our Hero block is
genuinely on 60+ pages.

## 4 · Where the mocks contradict each other

Four mocks (AM-1, AM-3, AM-6, AM-7) show the section Overview as the **flowchart**; four
(AM-8, AM-9, AM-10 and AM-2) show it as **Summary → Supported Breakpoints (Desktop ≥1200 px /
Tablet 768–1199 / Mobile ≤767) → Component Summary → Usage**. AM-1 shows 3 grid columns,
AM-2 shows 5. Badge order flips between `Built-in · Schema validated` and `Section · Built-in`.

Rule I would apply: **the flowchart wins for sections** (it is the later decision you approved
last turn and it carries the most information), **the property list wins for native blocks**
(AM-2, the screen you just sent — a block has properties, not composition), and grid density
follows each view's own mock (5 native, 3–4 sections).

## 5 · Cost to close

| Phase | Items | Est. |
|---|---|---|
| **A — Native screen fidelity** | 1, 2, 3, 8, 9, 10, 14 (card anatomy, 5-col density, taxonomy rename, compatibility filter, view titles, per-kind CTA labels, menu items) | ~1 session, CSS + `library-db.ts` taxonomy, no data risk |
| **B — Inspector depth** | 4, 5, 6, 12, 13 (native property Overview, 5 tiles, qualifiers, Usage columns, Structure extras) | ~1 session |
| **C — Saved view** | 11 (creator, updated line, 6/page, inspector kv-with-icons + per-site usage) | small, ~half session |
| **D — Inventory** | add `richText`, `spacer`, `accordion`, `statsStrip`, `iconGrid` to the **builder registry** (they must exist there too, or Insert breaks), then to the library | ~1 session, touches M4 palette + QA |
| **E — Thumbnails** | 7: real miniatures. Either CSS-rendered minis from our own tokens, or generated photography embedded as base64 WebP in the single-file build (+~0.6–1 MB) | ~1 session, largest visual payoff |

**My recommendation:** A → B → C now (three sessions, pure fidelity, no architecture change),
then D, and only do E if you want the grid to look photographic — it is the one item that
changes the artefact's weight.

## 6 · One decision I need

The five mock-only blocks (Rich Text, Spacer, Accordion, Stats Strip, Icon Grid): **add them as
first-class types** (bigger catalogue, touches the builder's registry and palette) or **keep them
as documented variants** of Text / Divider / FAQ / Feature Grid (no new types, catalogue stays at
20, everything remains reachable and QA-covered)?

I would add them — you asked for a bigger library, and a 20-block catalogue that matches the
mock 1:1 is easier to defend than "these five are variants, trust me". It costs one session
because each new type needs a definition, content fields, a thumbnail, an AI mapping and QA.
