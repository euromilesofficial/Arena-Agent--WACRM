# Module 6 · Theme Studio — M6.2 review and audit

**Scope of this pass:** ten presets, a real font download, a complete theme bundle,
an honest function-by-function audit, and the interlinks to the modules that are
already built plus the hooks for the ones that are not.

**Result:** `qa_theme.py` 241/241 · full suite 11/11 · 807 assertions green.
Nothing here is claimed as passing without a check that runs it.

---

## 1 · What changed in M6.2

| # | Ask | What was wrong before | What it is now |
|---|-----|----------------------|----------------|
| 1 | "Only 5 presets — increase to 10" | 5 seeds, three of them variations on one idea | 10 presets: 5 built-in, 3 workspace, 2 site-scoped. Each with its own palette, both font roles, geometry rhythm and description |
| 2 | "No option to download the font" | "Get" handed you a `npm run fonts` command — a build step dressed as a download | "Get" fetches the family's real latin woff2 from Google and saves it to the browser's download list (`Abril-Fatface-latin.woff2`, verified `wOF2`, 25–120 KB). The build command stays as the way to make it permanent, and the backend contract as the way to make it a service |
| 3 | "Export light theme must export the complete theme" | `exportDocument()` emitted `colors / typography / geometry / blockStyling` + a fingerprint. No fonts, no imagery, no layout, no pages | A **complete bundle** (`schemaVersion 3`, `kind: wacrm.theme.bundle`): token document, font faces as base64 woff2, every image the site's pages reference, layout slots, the reference page trees, computed type sizes, WCAG verdicts, provenance and an integrity stamp |
| 4 | "Review the module — all functions, interconnections, hooks" | Theme Studio was an island: nothing else in the app read the theme | The **Visual Builder canvas now renders with the site's draft theme** (`M6 → M4`), and the remaining links are enumerated below as deltas with the exact reason |

---

## 2 · Presets: the ten

Built-in (read-only, model-authored, cannot be renamed or deleted):

| Preset | Character | Heading / body | Radius · container |
|--------|-----------|----------------|--------------------|
| Modern Violet | the product default | Geist 700 / Inter 400 | 12 · 1200 |
| Ocean Professional | education & consultancy, trusted | Poppins 600 / Inter 400 | 8 · 1200 |
| Warm Editorial | storytelling, campaign | Lora 600 / Inter 400 | 16 · 1280 |
| **Midnight Product** | dark product surface, violet signal on near-black | Space Grotesk 700 / Inter 400 | 16 · 1200 |
| **Cobalt Corporate** | institutional finance & government | Manrope 700 / Source Sans 3 400 | 8 · 1200 |

Workspace / site (editable, with an author and an updated-at):

| Preset | Scope | Character |
|--------|-------|-----------|
| EuroMiles Brand 2026 | Workspace | refreshed brand set, radius 16 |
| **Coral Campaign** | Workspace | warm coral, pill geometry, spacious |
| **Sage Campus** | Workspace | calm green, compact rhythm, long reading lists |
| Admissions Campaign | This Site | warmer accent for the scholarship push |
| **Monograph** | This Site | high-contrast serif editorial, zero radius, one red accent |

Every family used is one of the 50 embedded families, so **all ten apply with no
network** — a preset that needed a download would be a broken promise in an
offline artifact. `qa_theme.py` proves this end-to-end: applying Midnight Product
in the studio repaints the preview to `#0B1020` and swaps the heading stack to
Space Grotesk (6.3e–6.3g), and undo returns it (6.3h).

**Bug found and fixed while doing it:** the Ocean preset carried
`containerWidthPx: 1140 as 1280` — a value the container select does not offer, so
that preset's geometry select had no matching option. It is 1200 now, in the
allowed set.

---

## 3 · Fonts: what "Get" does now

Before: a panel with a command. No file, anywhere.

Now, in order, when you press **Download Abril Fatface.woff2**:

1. `GET https://fonts.googleapis.com/css2?family=…&display=swap`
2. pick the **latin** `@font-face` block out of the response (Google returns
   Cyrillic/Greek/Vietnamese subsets too)
3. `GET` that woff2
4. hand the bytes to the browser as `Abril-Fatface-latin.woff2`

States, all implemented: idle → *Asking Google Fonts…* → *Downloading…* →
**Saved ‹file› · ‹n› KB, latin subset, woff2** … or a red state that says exactly
what failed and why the artifact still works (`14.22–14.25`).

The banner also grew a **Browse all 1,746** action that opens the family picker on
the full index instead of the embedded 50 (`14.26–14.28`), so the long tail is
reachable in one click rather than by discovering a toggle.

Honest limits: the download needs a connected browser. The artifact itself never
fetches a font at runtime — 50 families are embedded (2.48 MB) and render offline.
With no network the panel says so; it does not pretend.

---

## 4 · The complete bundle

`Export ▾` now has two groups. **Tokens only** is the old v2 file, unchanged, for
interop. **Complete bundle** is the answer to "including its image content and
everything":

```
schemaVersion       3
kind                wacrm.theme.bundle
theme               { colors, typography, geometry, blockStyling }   ← the v2 document, in full
fonts[2]            role, family, weight, fallback, licence, designers
                    faces[]: weight, style, format=woff2, bytes, fnv1a, content(base64)
assets.images[n]    id, source, mime, fnv1a, content(base64)         ← every image the pages use
assets.logo         null + note: owned by Media (M9), exported with the site
layout              container, radius, spacing{base,density,scalePx}, blockStyling
                    starterLayouts{} → deferredTo "Module 7 · Layouts"
                    navigation{}     → deferredTo "Module 8 · Navigation"
computed.typeScale  h1…caption in px, plus fluid flag
computed.contrast   14 WCAG pairs with ratio, need, verdict, advisory
pages[n]            the reference page trees the theme was judged against
x-wacrm             site, revision id, seq, status, exportedAt, exportedBy,
                    fontsEmbedded, fontsTotalBytes, integrity{algorithm, theme}
```

Measured on the seed site: **> 200 KB**, 2 font roles with real faces, 4 images,
3 pages (`7.1a–7.1q`). The file imports back: `validateImport()` recognises
`kind: wacrm.theme.bundle`, unwraps `theme`, and reports what it did **not** take
(fonts/imagery/pages stay in their own modules) instead of failing on fields it
does not own yet.

**Why the layout slots are empty objects and not invented data:** Module 7 owns
layouts and Module 8 owns navigation. Shipping a made-up `starterLayouts` tree
would be exactly the fabrication the rest of this build avoids. The keys exist,
`deferredTo` names the owner, and the importer already understands both fields —
so the day M7 lands, the bundle carries them without a format change.

---

## 5 · Function audit

Every `ThemeAPI` operation, and what proves it:

| Operation | State | Evidence |
|-----------|-------|----------|
| `load` (async, slow/fail/empty modes) | works | 1.x, forced-state checks |
| `saveDraft` (compare-and-swap on `baseId`) | works | 22.1, conflict suite |
| `saveElsewhere` (teammate writes under you) | works | conflict state, 12.x |
| `apply` (preset → working copy) | works | 6.12, 6.3e |
| `reset` (defaults) | works | reset modal |
| `diff` / `revisionDiff` | works | revision diff rows |
| `presets` / `selectable` (archive-aware) | works | 6.19–6.20, archive |
| `archivePreset` / `deletePreset` (reference guard) | works | delete guard on referenced presets |
| `addPreset` / `renamePreset` / `duplicatePreset` | works | 6.18, 6.19, 6.14 |
| `verifyFonts` | works | typography tab warning |
| `validateImport` (v1, v2, v3 bundle, prototype keys, size caps) | works | 7.x, 19.x |
| `exportDocument` (tokens v2) | works | 7.1 |
| **`exportBundle` (complete v3)** | **new** | 7.1a–7.1q |
| `evaluate` (14 WCAG pairs, recomputed in Python) | works | 3.x, 16.x |
| `compiledVars` (release manifest shape) | **built, no consumer** | see delta D2 |
| `ensureFontFaces` (injects @font-face for embedded families) | works | 14.13 |

---

## 6 · Interlinks

**Live now**

| From → To | What crosses the boundary | Proof |
|-----------|---------------------------|-------|
| Sites → Theme Studio | the selected site owns its own draft/live revisions | site switch reloads the payload |
| Theme Studio → **Visual Builder** | the canvas renders `.wb-themed` with the draft's tokens: background, surface, border, ink, primary, radius, container, band spacing, heading family/weight/tracking, secondary button, table chrome | **22.3–22.10** |
| Theme Studio → Preview (blocks) | block background roles (`wb-bg-white/soft/brand/dark`), headings, cards, form fields | 17.x |
| Theme Studio → Import/Export | v2 tokens and v3 bundles both parse; bundle round-trips to a preset | 7.1e, 19.x |
| Theme Studio → Fonts | embedded families registered before the preview paints | 14.13 |

**Hooks present, consumer not built yet** — named so nobody has to guess:

| Hook | State | Owner |
|------|-------|-------|
| `layout.starterLayouts` in the bundle + importer branch | declared, empty, `deferredTo` | Module 7 · Layouts |
| `layout.navigation` in the bundle + importer branch | declared, empty, `deferredTo` | Module 8 · Navigation |
| `compiledVars()` — the published `--brand-*` shape | computed, no caller | Publishing & Releases |
| `assets.logo` | declared `null` with the owning module named | Module 9 · Media |
| `POST /theme/fonts/{family}/ingest` | documented contract only | backend, per BACKEND-PLAN §7.28.3 |

**Real deltas — things that are *not* wired, stated plainly**

- **D1 · Overview has no theme card.** The dashboard does not mention which theme
  revision is live. It should (one line: `Theme · draft #7 · live #6`). Not built
  this pass because it changes a screen the user has already signed off.
- **D2 · `compiledVars()` has no consumer.** The release manifest would use it;
  there is no release flow in this build yet. The function is correct and tested
  by inspection only.
- **D3 · Pages list does not show a theme badge.** Each page renders under the
  site theme, but the Pages table says nothing about it.
- **D4 · M5 block library is theme-blind by design.** A block's saved style is
  per-block; the theme supplies the defaults. That is the correct precedence, but
  there is no UI that shows "inherited from theme" versus "overridden".
- **D5 · Bundle imagery is the sample library.** The bundle exports the real
  base64 bytes the pages reference; those bytes are this build's generated sample
  assets, labelled as such in the Media panel.
- **D6 · Dev server still crashes on hook order** (documented since M6). The
  built artifact is unaffected; 807 assertions run against it.

---

## 7 · Verification

```
qa_theme.py     241/241   (was 198 — +43 for presets, bundle, download, interlinks)
qa_ai.py         60/60
qa_builder.py    98/98    ← unaffected by the canvas theming
qa_states_m4.py  47/47
qa_pages.py     106/106
qa_states_m3.py  40/40
qa_module2.py    48/48
qa_states_m1.py  39/39
qa_flows.py      38/38
qa_react.py        ok
qa_library.py    90/90
─────────────────────────
11/11 suites · 807 assertions
```

Captures: `qa/m62-presets10.webp`, `qa/m62-font-download.webp`,
`qa/m62-export-menu.webp`, `qa/m62-builder-themed.webp` (the Builder canvas
rendering Midnight Product after a save — the M6 → M4 proof, photographed).
