# Module 6.1 — UI/UX review

Scope: what changed on screen, why, and what it now proves. Everything below is verifiable in `WACRM-CMS.html` and asserted in `qa_theme.py` §14–19.

---

## 1. Anatomy (unchanged three columns, four new surfaces inside them)

```
┌ header ─────────────────────────────────────────────────────────────────┐
│ Theme Studio   ·  Website select · draft chip · Import · Export · Save   │
│ banner: draft is not live (or: unsaved working copy)                     │
├──────────────┬──────────────────────────────────┬────────────────────────┤
│ LEFT  editor │ CENTRE  preview                  │ RIGHT  overview         │
│ 3 tabs       │ [Page | Specimen]  page select   │ Token Summary 13 roles  │
│              │ [Desktop | Tablet | Mobile]      │ Typography Summary      │
│ Brand Tokens │                                  │ Accessibility 14 pairs  │
│  ├ Brand marks (6)                               │ Usage                   │
│  └ Surface, text & lines (7)                     │ Revisions (NEW)         │
│ Typography   │                                  │ Theme Status            │
│  ├ Heading font (1,746-row picker)               │                         │
│  ├ Body font                                     │                         │
│  ├ Type Scale (NEW)                              │                         │
│  ├ Pairings (12)                                 │                         │
│  └ Pairing preview                               │                         │
│ Presets      │                                  │                         │
└──────────────┴──────────────────────────────────┴────────────────────────┘
```

Four things were added and nothing was removed. The three-tab model, the read-only centre pane and the fixed overview order survive the change, which was the point of doing M6.1 as an increment rather than a redesign.

---

## 2. New surfaces

### 2.1 Type Scale card (Typography tab)

Order inside the card follows the decision chain a designer actually makes: *how big is body* → *how far apart are the steps* → *how tight is the leading* → *does it scale down* → *does it look right*.

| Control | Type | Values | Live feedback |
|---|---|---|---|
| Base size | segmented ×5 | 14 · 15 · 16 · 17 · 18 | ramp re-derives instantly |
| Ratio | select ×4 | 1.200 / 1.250 / 1.333 / 1.500, each with its use ("Major third — the safe marketing default") | card meta shows `31/25/20/16 px` |
| Heading leading | slider | 1.00–1.40, step 0.05 | numeric readout |
| Body leading | slider | 1.40–1.80, step 0.05 | numeric readout |
| Heading tracking | slider | −0.030–0 em, step 0.005 | numeric readout |
| Body tracking | slider | 0–0.010 em, step 0.001 | numeric readout |
| Fluid headings | checkbox | on/off | ramp line switches between `clamp()` and px |

The **ramp** is the point: six rows, each `step · px · leading · tracking` above a specimen line rendered at that exact size in the chosen family, with muted colour for `small`/`caption`. It is the only place in the product where you can see all six steps at once, and it is the reason the tab no longer lies about "16 px" being fixed.

### 2.2 Role grouping (Brand Tokens tab)

13 roles split into **Brand marks** (primary, secondary, accent, success, warning, error) and **Surface, text & lines** (background, surface, text, muted, link, border, ring), each group header carrying one line of intent. The split is not cosmetic: the two groups are measured against different thresholds, and the second group is where the four new roles live.

`border` is the only row whose ratio pill can read "advisory" in its tooltip; its hint names WCAG 1.4.11 explicitly so the number is never mistaken for a failure.

### 2.3 Specimen sheet (centre pane)

`Page | Specimen` sits before the page selector because it changes what the whole pane is. Nine sections in a fixed order:

1. Type scale — 6 steps with px annotations
2. Colour roles — 13 swatches, each with its measured ratio badge or a `mark`/`text` marker for the two base surfaces
3. Buttons — default · hover · focus (real ring) · disabled, then secondary · ghost · destructive
4. Inputs & controls — default · focus · error (with message) · select, plus the consent block
5. Feedback — three alert severities with coloured rules, five pills, an inline link and muted inline text
6. Surfaces — a card and a table row
7. Radius — six swatches at the real radii
8. Spacing — the five-step scale as bars
9. *(header)* — the audit score, `12 of 14 pairs pass`

Every value is computed. The specimen cannot disagree with the site because both read `--t-*` from the same compile.

### 2.4 Revisions (right rail + modal)

Rail panel: three rows, each `#seq · status · changed-count · time` with a **Restore** button; then *Compare every revision*. Modal: history on the left (scrollable, `#seq · status · author · date` with `live`/`draft` pills), diff on the right — before selection, a hint that explains what a diff will show; after selection, a four-column table (Group · Token · From · To) and the sentence that matters: *restoring loads these values into the working copy, nothing is written until you press Save*.

---

## 3. State matrix (new states only)

| Surface | Default | Loading | Empty | Error | Permission | Conflict |
|---|---|---|---|---|---|---|
| Font picker | 60 windowed rows, embedded-only | — | "No embedded family matches" + escape hatch to the full index | row disabled + reason | rows disabled for Viewer, search still works | — |
| Type scale | ramp rendered | — | — | invalid value blocks save (banner) | sliders/segments disabled, ramp still renders | — |
| Specimen | rendered at studio width | — | page with no blocks still shows the specimen | theme service down → whole-screen retry (inherited) | renders (read-only by nature) | — |
| Revisions rail | 3 rows | inherited skeleton | single revision → "initial" label, Restore disabled on the draft | — | Restore disabled | — |
| Revisions modal | hint state | — | diff empty → "changed nothing in the token document" | — | primary action disabled | — |

The picker's empty state is the one worth calling out: a search miss **never dead-ends**. It says how many families exist and offers one click into the full index, because a locked library is only honest if it is also navigable.

---

## 4. Flows added

**F1 · Change the type rhythm in three moves.** Typography → drag *Heading leading* to 1.10 → ramp re-renders → ⌘Z restores 1.15 → Save Brand Tokens writes a draft. No number is typed; nothing is stored twice.

**F2 · Prove a theme is usable, not just pretty.** Set a muted colour → read its ratio in the Brand row → switch to Specimen → see it as caption text, table header and helper copy → the specimen's score drops from 12 to 11 → fix the colour → score returns.

**F3 · Undo a week of theming.** Revisions → Compare every revision → pick `#4` → read the diff (`Geometry · Radius 8px → 16px`, `Typography · Heading family Poppins → Geist`) → Restore into working copy → banner turns amber → Save (or ⌘Z to back out).

**F4 · Bring in a file made elsewhere.** Import a v1 document → review says *4 roles were derived from the file's own palette* and *carries no type scale* → import → working copy dirty → the derived roles are visible in the editor and can be corrected before saving.

**F5 · Find a font in the long tail.** Typography → open the picker (1,746 searchable) → type "grotesk" → Space Grotesk appears **and is selectable**, because M6.1 embedded it → the preview heading changes and `document.fonts.check()` is true.

---

## 5. Interconnection

- **Tokens → preview → specimen → manifest** is one compile (`previewVars` / `compiledVars`). The specimen is a second consumer of the same variables, which is why it can never drift.
- **Revisions → working copy → Save → draft → publish review (M4)**. Restore deliberately joins at the working-copy end, so the only write path stays single.
- **Fonts → block renderer**: the compiled `--font-heading` / `--font-body` stacks are what Module 4's renderer already reads, so a 247-family library needed no change in the renderer.
- **Contrast engine → right rail → role rows → specimen badges**: one `summarise()` call, three renderings, identical numbers.
- **Import → preset library → apply**: unchanged from M6, but a v2 document now round-trips with its scale intact.

---

## 6. Deltas against the M6 review (honest list)

| Was | Now | Still open |
|---|---|---|
| Typography = family + weight, body pinned at 16 px | 6 derived steps, 4 sliders, fluid clamp | per-breakpoint type (G1b) — `clamp()` covers 80% for 5% of the cost |
| 9 roles, no border/ring/muted/link, audit measured a `link` that did not exist | 13 roles, 14 pairs, thresholds per role | dark mode / modes (G5) |
| Preview = one real page | page + 1:1 specimen | per-section colour schemes (block library work) |
| History loaded, rendered nowhere | rail + diff modal + restore | scheduled publish (M11) |
| 9 fonts, 3 locked | 50 embedded, 1,746 indexed, 0 locked in the default view, and every locked row has a **Get** that names the fetch command | ingestion job for the long tail (server contract) |

Two things this module did **not** fix and should not be read as fixed: the picker is a list of families, not of **pairs** (you still choose two roles); and `accent` and `warning` still measure below 3:1 in the Modern Violet seed — both predate this module and both remain visible rather than hidden.
