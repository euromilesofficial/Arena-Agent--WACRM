# Module 6.1 — Theme Studio completion + Google Fonts library

**Status:** built, QA-green, packaged, pushed.
**Baseline:** Module 6 (`b41bf3e`) · **Research input:** `THEME-STUDIO-BENCHMARK.md` (commit `82e207b`)
**Approval:** user instruction *"Please implement the recommendation and increase the fonts under the typography includes almost all the fonts available in Google."*

This module does exactly two things: it closes the four Tier-A gaps the benchmark found (G1–G4), and it turns the nine-family font catalogue into a real library. Nothing else — no new tab, no new subsystem, no publishing surface.

---

## 1. What shipped

### G1 · The type scale (was: family + weight only, body pinned at 16 px)

The token document gained a `typography.scale` object:

```ts
interface TypeScale {
  basePx: number;            // 14–18
  ratio: number;             // 1.2 | 1.25 | 1.333 | 1.5
  leadingHeading: number;    // 1.0–1.4
  leadingBody: number;       // 1.4–1.8
  trackingHeading: number;   // −0.03–0 em
  trackingBody: number;      // 0–0.01 em
  fluid: boolean;            // clamp() between 420 and 1180 px
}
```

Six steps are **derived, never stored**: `h1 = base·r³`, `h2 = base·r²`, `h3 = base·r`, `body = base`, `small = base/r`, `caption = base/r²`. One number changes the whole rhythm — the WordPress `spacingScale` idea applied to type.

- Typography tab gained a **Type Scale card**: base-size segmented control, ratio select with the four named ratios, four sliders (heading/body leading, heading/body tracking) with live numeric readouts, a fluid toggle, and a **live ramp** that renders every step at its real size with its px/leading/tracking printed beside it.
- The scale compiles to `--t-fs-h1 … --t-fs-caption`, `--t-lh-heading`, `--t-lh-body`, `--t-ls-heading`, `--t-ls-body` in the preview and to `--font-size-*` in the published manifest shape.
- **The page preview now obeys it** — `.wb-h1/.wb-h2/.wb-h3` read the compiled sizes, body copy reads `--t-fs-body` and `--t-lh-body`. Module 6 previewed typography as a pair of family names; 6.1 previews it as a scale.
- Fluid headings emit a real `clamp()`: `min` is 72% of the desktop size at 420 px, `max` is the desktop size at 1180 px, solved linearly. Body copy never moves — a deliberate asymmetry (fluid type is not a shrinking page).

### G2 · The four missing roles (was: 9 roles, and a contradiction inside the audit)

| Role | Kind | Threshold | Why |
|---|---|---|---|
| `muted` | text | 4.5:1 | captions, helper copy, table headers |
| `link` | text | 4.5:1 | **was already being measured** as `link-on-bg` while no `link` token existed — the editor and the audit disagreed |
| `border` | marker | **1.5:1 advisory** | dividers are exempt from WCAG 1.4.11; a divider that vanishes is still a design bug, so it is measured against a legibility floor and labelled *advisory* |
| `ring` | marker | 3:1 | keyboard focus, held to the non-text threshold |

The editor groups them: **Brand marks** (6) and **Surface, text & lines** (7). The contrast engine went from 10 to **14 measured pairs**; the five new/changed pairs each carry their own semantics rather than inheriting "3:1 because it is a mark".

### G3 · The specimen sheet (was: one real page in three widths)

A `Page | Specimen` switch in the preview header. The specimen draws, from the same compiled variables as the site:

type ramp (6 steps, annotated) · 13 colour swatches each with its measured ratio · buttons in default/hover/focus/disabled plus secondary, ghost and destructive · four form fields including a focus state and an error state · the **unticked, explicit, channel-specific WhatsApp consent block** · three alert severities · five status pills · an inline link and muted inline text · a destination card · a table with a header row · the radius swatches · the spacing scale.

It renders **1:1 at the studio's own width** rather than being scaled to 42% and turned into unreadable 6 px labels — the specimen is a document, not a page. Tablet and phone still constrain it.

### G4 · Revisions (was: `ThemePayload.history`, loaded and rendered nowhere)

- Right rail gained a **Revisions** panel: the last three revisions with `#seq`, status (Published / Saved draft / Earlier draft), token-change count, time, and a per-row **Restore**.
- **Compare every revision** opens a modal: the full history newest-first, and for any selection a **token-by-token diff** (group · token · from · to) computed by `diffTokens` against the revision before it.
- **Restore loads the revision into the working copy. It does not write.** Save is still the only thing that creates a revision — the one guarantee the module sells. Undo walks back out of a restore, and undoing a restore returns to a clean saved draft.
- The seed history is now five revisions with *real* changes (`#3` violet swap, `#4` radius + Poppins, `#5` back to Geist at ratio 1.333/17 px, `#6` live, `#7` draft) instead of two identical objects — a diff list that shows nothing proves nothing.

### Fonts · from 9 families to 247 embedded + 1,746 indexed

The user's ask was "almost all the fonts in Google". That is a byte question before it is a feature question, so it was answered with two different mechanisms:

| | Count | Mechanism | Truth in the UI |
|---|---|---|---|
| **Embedded** | **247 families**, 10.49 MB of woff2 (14.1 MB base64) | real latin-subset woff2, variable-first (one file = 100–900), static 400+700 fallback | fully selectable, renders offline, weight buttons are the weights the file actually covers |
| **Indexed** | **1,746 families** (every family Google publishes, minus 212 brand fonts and the unlicensed Google Sans family) | metadata only: category, weights, italic, designer, popularity rank | listed, searchable, **locked**, each row says *Requires ingestion* and points at the pipeline |

Why 247 and not 1,746: all of Google Fonts as woff2 is ~70 MB before base64 — impossible inside a single HTML file that must open by double-click with no network. The budget is a constant in the generator (`--budget=10.5` MB) and the selection is **Google popularity order, variable-first**, which is why the set is Roboto, Open Sans, Inter, Montserrat, Poppins, Lato, Arimo, Playfair Display, Nunito, Raleway…

Consequences worth noting:

- **The three families M6 could only list are now embedded.** Playfair Display, Space Grotesk and Merriweather render — QA asserts they are selectable and that `document.fonts.check()` is true, i.e. the face is registered, not merely named.
- Faces are injected **lazily, one family at a time**. M6 built a single 14 MB stylesheet on mount; 6.1 registers only what is on screen (the chosen pair, plus whatever the picker window shows).
- The picker became a search product: query across all 1,746, six category chips with real counts (All 1,746 · Sans 554 · Serif 309 · Display 474 · Handwriting 359 · Mono 50), an **Embedded only** toggle (default on), a windowed list of 60 with "show 120 more", and a miss state that offers the full index.
- `FONT-LICENSES.md` regenerated: 247 rows with category, licence, designer, variable/static and file size. **Google Sans and the other brand fonts are excluded twice** — by the metadata flag and by an explicit denylist — because they ship through the API without a redistribution licence.

### The document contract went to version 2

`exportDocument` writes `schemaVersion: 2`; `validateImport` reads **1 and 2**. A version-1 file still imports:

- the four missing roles are **derived** from the file's own palette (`muted` = text mixed 42% toward background, `border` = 86%, `link`/`ring` = primary) and the review modal **says so**, with the list of derived roles;
- the absent type scale falls back to 16 px / 1.250 and the review says *"carries no type scale (it predates version 2)"*.

Nothing is silently invented, and nothing is silently rejected.

---

## 2. Files

| File | Change |
|---|---|
| `scripts/fetch-theme-fonts.mjs` | rewritten — metadata index + budgeted embedding + licence register |
| `src/lib/theme-font-data.ts` | generated · 247 families, 14.1 MB |
| `src/lib/theme-font-catalog.ts` | generated · 1,746 rows, 137 KB |
| `src/lib/theme-db.ts` | `TypeScale`, `typeSizes`/`typeSizeCss`/`typeStamp`, 13 roles, `mixHex`/`deriveRole`, `diffTokens`/`revisionDiff`, lazy `ensureFontFaces`, `searchFonts`, v2 export/migration |
| `src/components/theme/ThemeSpecimen.tsx` | **new** — the specimen sheet |
| `src/components/theme/ThemeControls.tsx` | font combobox rebuilt for 1,746 rows |
| `src/components/theme/ThemeModals.tsx` | `RevisionsModal` |
| `src/components/theme/ThemeOverview.tsx` | Revisions panel |
| `src/components/theme/ThemePreview.tsx` | Page/Specimen surface switch, 1:1 specimen sizing |
| `src/views/ThemeStudio.tsx` | Type Scale card, role grouping, restore handler, lazy fonts |
| `src/styles/app.css` | `m6-spec-*`, `m6-ramp-*`, `m6-sliders`, `m6-role-group`, `m6-revs*`, `m6-revh*`, `m6-fc-filters`, preview type tokens |
| `qa_theme.py` | 127 → **189** checks (sections 14–19 are new) |
| `FONT-LICENSES.md` | regenerated, 247 rows |

---

## 3. What was deliberately not done

- **No dark mode / modes (G5).** Benchmark Tier B; needs a second token axis, a mode-aware contrast table and a publish contract. Not approved.
- **No palette generation (G6), DTCG export (G7), APCA column (G8), partial presets (G9).** Researched, ranked, unapproved.
- **No section-scoped colour schemes.** Belongs to the block library, not the token layer.
- **No publishing.** Still Module 11 (decision D1).
- **Italic faces are not embedded.** The picker does not offer italic and the theme stores an upright face — stated in `FONT-LICENSES.md` rather than implied.

---

## 4. Acceptance

- `qa_theme.py` — **189 passed, 0 failed** (M6 was 127).
- Full suite — see `qa/last-run.json`; all 11 suites green.
- The four benchmark gaps are each covered by named assertions: **15.x** type scale (ratio arithmetic recomputed in Python, fluid `clamp()`, preview obedience), **16.x** the five new pairs (ratios recomputed independently), **17.x** the specimen (13 swatches, 6 type steps, 4 field states, 3 alerts), **18.x** revisions (diff rows, refusal to restore the active draft, restore-marks-dirty-not-save, undo path), **19.x** the v1 migration, **14.x** the font library.
