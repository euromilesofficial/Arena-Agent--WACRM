# Module 6 — Theme Studio · UI/UX architecture review

**Scope of this document:** the screen as built, its controls, its states, its flows, and what was deliberately left
out. It is the written review that accompanies every module in this project, and it is meant to be read against
`MODULE-6-THEME-STUDIO-SPEC.md` (the pasted brief), `MODULE-6-GAP-REVIEW.md` (the pre-build audit) and
`MODULE-6-DECISIONS.md` (what was decided).

**Routes:** `#/theme` · **Files:** `src/views/ThemeStudio.tsx`, `src/components/theme/{ThemeControls,ThemePreview,ThemeOverview,ThemeModals}.tsx`,
`src/lib/theme-db.ts`, `src/lib/theme-font-data.ts` (generated), `m6-*` block at the end of `src/styles/app.css`.

---

## 1 · The one-sentence model

> A theme is one typed token document per website. The studio edits a **working copy**, saves **draft revisions** with
> compare-and-swap, and gets its pixels from **the same renderer the public site uses**. Publishing belongs to the release
> flow, so this screen never says "live".

Everything else in this document follows from that sentence.

## 2 · Screen anatomy (1600 × 940 desktop, ≥1440 target)

```
┌ header ────────────────────────────────────────────────────────────────────────────────┐
│ breadcrumb · H1 Theme Studio · subtitle      [Website ▾] [Saved draft 11:42] [Import][Export][Save] │
├ status banner ─────────────────────────────────────────────────────────────────────────┤
│ "Saved draft #7 is what the next release will carry…" / amber dirty / red invalid       │
├───────────────┬───────────────────────────────────────┬────────────────────────────────┤
│ EDITOR 366px  │ PREVIEW flex                          │ OVERVIEW 318px                 │
│ tabs          │  head: title · mode chip · page · 3×   │  1 Token Summary               │
│  pane (scroll)│        device buttons                 │  2 Typography Summary          │
│               │  stage: 1440/768/375 page, scaled      │  3 Accessibility Checks        │
│               │        to fit, read-only              │  4 Usage                       │
│               │                                       │  5 Theme Status                │
└───────────────┴───────────────────────────────────────┴────────────────────────────────┘
```

- **Column widths** 366 / fluid / 318 at ≥1440. The right rail scrolls independently; the editor scrolls
  independently; the stage scrolls the website, not the studio. No panel is ever taller than its content column.
- **Type scale** mirrors Modules 4–5: 23 px H1, 12 px subtitle, 10–11.5 px control labels, 9–10 px meta, tabular
  numerals everywhere a measurement appears.
- **Colour** violet `#6D4AFF` for primary actions and the active tab, amber for dirty/pending, green **only** for
  verified success (saved draft, passing contrast), red for errors and destructive controls, neutral greys for chrome.
  The dark WACRM sidebar is untouched — module accent colours never leak into the admin shell.
- **The website preview never inherits the admin theme.** All of its colour, type and geometry come from `--t-*`
  variables written on the preview root, and the two systems share no class names except the renderer's `wb-*`.

## 3 · Control inventory

### 3.1 Header

| Control | Behaviour | States |
|---|---|---|
| `Website ▾` | Switches the site the theme belongs to. | Guarded when dirty (`You have unsaved theme changes`). |
| Draft chip | One state at a time: `Saved draft · 11:42` (green) / `Unsaved changes` (amber) / `Saving…` (spinner). | Never both, which is the mock's X1 contradiction. |
| `Draft #n · Live #m` | Both revision identities, always. | — |
| `Import JSON` | Opens the one import flow (also reachable from the Presets drop zone). | Disabled for Viewer. |
| `Export ▾` | Menu: `Export saved draft #7` / `Export live theme #6` / `Import JSON…`. | Download is a sanitised document with an `x-wacrm` provenance block. |
| `Save Brand Tokens` | Validate → CAS draft revision → toast. | Disabled when pristine, invalid, saving, or read-only; each has its own reason tooltip. |

### 3.2 Brand Tokens tab

Nine rows. Each row is a 38 px swatch button (opens the picker), the role name, its semantic usage, the normalised hex
(a copy affordance), and the measured ratio for the pair that role actually participates in. `background` and `surface`
show `base` instead of a ratio — they are what other things are measured *against*, and inventing a ratio for them
would be the exact kind of number the mocks were full of.

Below: Border Radius (6 values), Spacing base (4/8), the printed scale (`8·16·32·48·64`), Density (3), Container Width
(4), Block styling (`cardDensity`, `elevation` — labelled *closed enum*), a Typography summary that links to the
Typography tab instead of duplicating the editor, and a footer with `Reset to Defaults` and `Undo (n)`.

**Colour picker** (246 px anchored popover): an HSV field, a hue rail, a hex input that normalises on Enter/blur and
rejects anything that is not a six-digit hex with a reason, a copy button, six recent colours for the session, and
`Reset this token`. It never enters an invalid value into the token document — the preview keeps the last valid pair.

### 3.3 Typography tab

A banner that is now literally true (`the woff2 files ship inside this build`), a Heading card and a Body card (family
combobox, weights restricted to what the family ships, fallback from four vetted stacks), six pairing shortcuts that
set both roles at once, a pairing preview rendered with the actual families at the actual weights against the actual
background, and a font-verification row (`Preparing fonts…` → `Fonts verified · 2 families · 10 weight declarations ·
checksums match`, or a failure with `Retry` / `Choose another font`).

**The family combobox** lists all nine catalogue entries: six selectable with a live `Aa` sample, three disabled rows
that say `Requires ingestion` and cannot be picked. The studio never previews a font it cannot render.

### 3.4 Presets tab

Search, four scope chips with computed counts, cards carrying a four-swatch strip and the font/radius/container summary,
`Preview` / `Apply` / `•••` per card, and a drop zone for JSON. `Apply` is disabled on the card whose tokens *are* the
working theme, labelled `Applied`.

`•••` is exactly the spec's five actions: Preview, Duplicate, Rename, Export JSON, Delete. Built-ins cannot be renamed
or deleted (disabled with the reason); a preset that a revision is built from cannot be deleted at all — the dialog
offers `Archive instead`, which removes it from the apply list while its references keep resolving.

### 3.5 Preview

`Website Preview · [mode chip] · [page ▾] · [Desktop|Tablet|Mobile]`, then the stage: `1440 px · scaled to fit the
studio · Read-only`. The mode chip is the honest one — `Showing saved draft #7`, `Using unsaved values (editing)` or
`Previewing “Ocean Professional” — not applied` with `Return to Draft` / `Apply Preset` beside it.

Device buttons are three distinct glyphs (monitor / tablet / phone), not one morphing icon. Mobile renders at 375 px at
actual size; the container width token clamps to the viewport rather than overflowing.

### 3.6 Theme Overview

1. **Token Summary** — nine swatches with hex + usage on hover, the derived on-primary row (marked `DERIVED`), then
   radius / container / spacing scale / density. Clicking a swatch jumps to that row in the editor.
2. **Typography Summary** — both roles at their real families and weights, the fallback, and the verification line.
3. **Accessibility Checks** — a pill derived from the rows (`8 passed · 2 warnings`), warnings sorted to the top, each
   with the measured ratio, the requirement, and a `Fix` action that lands on the offending token. Closing line:
   *"Token contrast only — this is not a claim that the site is WCAG compliant."*
4. **Usage** — pages / block types / section templates / website, each with a tooltip stating how it is derived.
5. **Theme Status** — the Editing → Saved Draft → Published rail as a *legend* (not a wizard), both revision ids,
   `Review for Publish` (disabled while dirty, with the reason) and `Release history`.

## 4 · State matrix (all reachable, all QA-asserted)

| Screen | State | How it looks | How it is reached |
|---|---|---|---|
| Whole screen | Loading | Layout-matched skeletons (`3` in the editor column) | cold load |
| Whole screen | Service down | `ErrorState` with Retry | beaker → *Error / service down* |
| Whole screen | Read-only role | Save/Import/Reset disabled, picker not openable, contrast still computed | beaker → *Permission denied (Viewer)* |
| Whole screen | Empty library | `No presets match` block instead of a blank pane | beaker → *Empty* |
| Colour | Picker open | 246 px anchored popover, clipped to viewport | click a swatch |
| Colour | Invalid hex | inline `Enter a valid 6-digit hex colour`, token unchanged | type `#12345` |
| Colour | Pass / warning | green or amber ratio chip per row, warnings first in the rail | always |
| Typography | Font preparing / verified / failed | three-row job panel with Retry + Choose another | family change; failure via harness |
| Geometry | Selected value | violet segmented control; radius/density write the preview immediately | click |
| Presets | Previewing | violet card ring + strip in the preview + `not applied` | `Preview` |
| Presets | Apply review | wide modal, semantic diff, scope radio | `Apply` |
| Presets | Delete blocked | `In use — deletion is blocked` + `Archive instead` | `••• → Delete` on a referenced preset |
| Import | Invalid | counted errors with `$.paths`, no Apply button, draft untouched | any malformed file |
| Import | Valid | summary rows, `Present in file — not applied` for layouts/nav, Keep-layout default | a valid file |
| Draft | Dirty / saving / saved / conflict / save failed | amber chip + banner / spinner / green chip + toast / `Theme Updated Elsewhere` / error toast with the edits retained | ordinary use, beaker → *Publish conflict* |
| Navigation | Unsaved guard | `You have unsaved theme changes` with `Stay` / `Discard Changes` / `Save Draft & Continue` | switch site, or `Release history` while dirty |
| Publish | Review modal | readiness checks, token diff, `Open release review` → Module 4's dialog | `Review for Publish` |

## 5 · Flows worth walking end to end

1. **Change a brand colour → ship nothing.** Swatch → picker → hex → preview repaints → `Unsaved changes` → `Save
   Brand Tokens` → `Saving…` → toast *"Brand tokens saved as a draft. Revision #8 · changes are not live until you
   publish a release."* → chip `Saved draft · 2:25 AM` → `Review for Publish` → readiness (2 warnings listed, not
   blocking) → `Open release review` → Module 4's `Publish release`.
2. **Preset apply without surprises.** Presets → `Preview` (strip says *not applied*) → `Apply Preset` → diff of the 13
   changed values → `Apply to Draft` → dirty → `Save Brand Tokens`. The pages, layouts and menus never appear in the
   diff because they were never in scope.
3. **Import a file you did not write.** Drop `theme.json` → validation runs before anything else → 17 errors with
   `$.colors.primary`, `$.geometry.radiusPx`, `$.stray`, `$.schemaVersion` → nothing was written. Fix the file → review
   → `Import Preset` → the card appears in the library, **not** applied.
4. **Someone else saved first.** Beaker → *Publish conflict* → a teammate revision lands → edit → Save → 409 → `Theme
   Updated Elsewhere` with the three differing values, `theirs → yours` → `Review latest` or `Keep my draft as a copy`.
5. **Leave with unsaved work.** Switch site → guard → `Save Draft & Continue` saves the revision *then* navigates;
   `Discard Changes` reverts to the last saved revision; `Stay` keeps everything.

## 6 · Interconnection

- **Module 4 (Visual Builder)** renders the preview (`Node`, `DEVICE_W`) and its release dialog is the only publish
  path. Theme variables are additive: the builder keeps working with no theme loaded because every rule falls back.
- **Module 5 (Block Library)** is where `blocks` and `templates` usage numbers come from; the theme does not own block
  variants.
- **Module 2 (Sites)** supplies the site list and the read-only rule for archived sites.
- **Module 3 (Pages)** supplies the preview page picker and the page list behind the Usage panel.
- **Module 7 (Layouts)** is the reason `Replace layout after review` is disabled and the import reports
  `Present in file — not applied`.
- **Module 11 (Publishing)** inherits the `theme_revision_id` contract; nothing in this screen has to change when that
  screen exists — the `Review for Publish` hand-off simply starts landing on the real preflight.

## 7 · Deliberate non-goals

No raw CSS field, no custom HTML, no shadow/animation/breakpoint token editors, no dark mode, no AI theme generator, no
marketplace, no "publish theme" button, no second block-style system, no free-text font fallback. Each of these was
either excluded by the master proposal or would duplicate a module that already owns the capability.

## 8 · Known deltas (stated, not hidden)

1. T02/T04/T06 had **no pixel reference** — built from the written contract.
2. The preview is an **in-document render**, not a signed short-lived preview origin; the origin model lives in
   `BACKEND-PLAN.md` §7.27.
3. **Three catalogue families** are listed but not selectable until the ingestion pipeline exists.
4. **Workspace preset scope** is stored and labelled; the permission rule is written down, not enforced (single-workspace
   prototype).
5. **`Release history`** leaves the module for the dashboard's publishing panel and says so, because Module 11 does not
   exist yet.
6. The seeded theme ships with **two advisory contrast warnings** on purpose: a warning-free opening screen would hide
   the one state the module exists to communicate.
