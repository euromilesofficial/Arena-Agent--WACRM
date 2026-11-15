# Module 6 — Theme Studio · decisions

**Built:** 2026-11-15 · route `#/theme` · `qa_theme.py` 127/127
**Inputs:** `MODULE-6-THEME-STUDIO-SPEC.md` (pasted spec, persisted verbatim), `MODULE-6-GAP-REVIEW.md` (31 findings,
10 contradictions, 10 proposed decisions), the three reference mocks in `uploads/` (T01, T03, T05 — T02/T04/T06 were
prose only), and the code Modules 1–5 actually ship.

This file records **what was decided, why, and what it cost**. The gap review proposed the decisions; this is the
record of them being built, plus the ones that only surfaced once the code met the pixels.

---

## 1 · The decisions in force

| # | Decision | Why it is not the literal spec | Cost / consequence |
|---|---|---|---|
| **D1** | **Theme Studio publishes nothing.** `Save Brand Tokens` writes a draft revision; `Review for Publish` opens Module 4's release dialog with the theme revision preselected. | The spec routes every publish path to "Publishing & Releases", which does not exist. Building a second publish implementation is the one thing §11.4 forbids. | One extra modal (`PublishReviewModal`) that states the hand-off, its readiness checks and the token diff — and no publish button anywhere in the module. |
| **D2** | **Nine persisted colour roles + one derived value.** `primary, secondary, accent, success, warning, error, background, surface, text` — plus a derived on-primary label colour. | §0.1 says "five core groups", §5.2 requires background/surface/text, the mocks persist accent/success/warning/error. Five *groups* ≠ five *values*; the stored document has to have one shape. | The summary, the validator, the importer and the exporter all agree on nine. The "5 tokens" claim is documented as five groups. |
| **D3** | **`onPrimary` is derived, read-only, and tested.** White or `#0F172A`, whichever measures higher against `primary`. | §5.4 tests "the actual CTA foreground against primary" but no DTO defines it — every mock's `CTA text 7.2:1` was unfalsifiable. | The CTA pair is now a real measurement (5.96:1 on the seeded violet), and the value is recomputed rather than stored, so an export cannot disagree with the renderer. |
| **D4** | **Spacing = `base (4\|8) × density (compact/comfortable/spacious)`**, scale = `base × {1,2,4,6,8}`, density multiplies section padding `0.75 / 1 / 1.25`. | The spec carried three incompatible models (named presets, enumerated steps, a single `spacingStepPx`). | Both halves are visible in the editor and both are in the JSON, so an imported theme reproduces its spacing exactly. |
| **D5** | **Six font families are embedded** as subsetted woff2 inside the artifact (Geist, Inter, Montserrat, DM Sans, Lora, Poppins — 242 KB, all OFL 1.1). Three catalogue entries without an asset are listed but not selectable. | §6.6 fetches Google Fonts at save time; the deliverable must open with no network and no CDN. Selecting "Poppins" would otherwise silently render as a system fallback — the Typography tab would be lying. | +334 KB of base64 in the single HTML file, `FONT-LICENSES.md`, a fetch script (`scripts/fetch-theme-fonts.mjs`) and latin-only subsetting (latin-ext doubled the bytes for glyphs nothing renders). |
| **D6** | **The preview is a real page draft rendered by Module 4's `Node` renderer**, at 1440/768/375, scaled to fit, with every handler inert. | §9.1 wants authorised site content, §9.4 wants the EuroMiles sample; either reading alone produces a fake preview or a second renderer that drifts. | Theme variables are written to the preview root only (`--t-*` on `.m6-pv`), so a token edit repaints the website and never the admin shell. Empty pages fall back to a labelled sample composition. |
| **D7** | **Block styling is a closed enum of two token-level treatments** (`cardDensity`, `elevation`); unknown keys fail validation with a field path. | §7.6/§8.3 mention "whitelisted compatible block styling variants" and define nothing, while Module 5 already owns block variants. | Two segmented controls, two JSON fields, no second styling system. |
| **D8** | **T02, T04 and T06 were built from the contract**, in the same visual grammar as T01/T03/T05. | Those three states existed only as prose. | Per-row contrast chips, the Editing→Saved Draft→Published rail and the preset `•••` menu with a guarded delete are all real; nothing pretends to be a pixel match. |
| **D9** | **Import is validate-only and always lands in the Preset Library.** Applying is a separate explicit step. 256 KB, depth 8, `schemaVersion: 1`, prototype-key guard, `$.path` errors. | §8.4 leaves "apply immediately or save as preset" open; §8.2 leaves limits open. | One import state machine for all three entry points, and a file that cannot be applied by accident. |
| **D10** | **"Present in file — not applied"** for starter layouts and navigation; the `Replace layout after review` radio is present, disabled, with the reason. | Layouts & Templates is still a placeholder (Module 7). | The theme contract reserves the fields so Module 7 can switch them on without a schema migration. |

## 2 · Decisions the gap review did not anticipate

| # | Decision | Trigger |
|---|---|---|
| **D11** | **Contrast never blocks a save; warnings are advisories.** Saving a draft with two failing pairs is allowed, and the publish review lists them. | Once the engine was real, the seeded Modern Violet palette turned out to fail *two* non-text pairs (warning 2.15:1, accent 2.77:1). Blocking a save on a colour a designer is mid-way through fixing would be a worse product than showing the number. |
| **D12** | **"Active source" is computed from the tokens, not from a provenance id.** A preset card shows *Active* only while the working tokens are byte-identical to that preset. | The seed had `draft.presetId = preset_modern_violet` while the draft had been hand-edited — the card claimed a match it no longer had. |
| **D13** | **The seeded draft deliberately differs from the seeded live revision** (radius 16, container 1280 vs 12/1200). | With live == draft on load, "draft is ahead of live" and the publish review's diff were both vacuous. The two revisions are now different objects with different ids *and* different values, which is the state model §10.6 asks for. |
| **D14** | **The conflict state is driven by the shared Prototype-states menu** (beaker) and produces a real CAS failure: a teammate revision lands behind the studio's back, so the next save returns 409 with a genuine diff. | A single-browser prototype can otherwise never reach its own conflict dialog. The store's global "publish conflict" modal is suppressed on `#/theme` so the theme's own dialog owns the moment. |
| **D15** | **Undo is real (20 steps, ⌘/Ctrl+Z) and lives in the editor's own toolbar**, not the header. | §11.2 only asks for a draft revision; §4.5 asks to "retain an undo path where supported". Twenty steps is enough to un-pick a palette, and the header was already at its width budget at 1440. |
| **D16** | **`Delete Token Set` is deferred**, not hidden. | No mock shows it, there is no multi-token-set story, and the spec itself marks the permission "highly restricted". It is written into `BACKEND-PLAN.md` instead of being faked with a disabled button nobody asked for. |

## 3 · What the screen does, in one paragraph

Three tabs on the left (`Brand Tokens`, `Typography`, `Presets`), a read-only website preview in the middle with a
Desktop/Tablet/Mobile switch and a page picker, and a five-panel Theme Overview on the right. Editing anything writes a
working copy, the header says `Unsaved changes`, and `Save Brand Tokens` persists an immutable draft revision with
compare-and-swap. Publishing is somebody else's job. Every ratio on screen is computed; every count is projected from
this workspace's CMS content; every font is embedded; every state (loading, error, empty, viewer, conflict, unsaved
navigation) is reachable from the beaker menu or from ordinary use.

## 4 · Verification

```
qa_theme.py                    127/127   (contrast ratios recomputed in Python)
qa_ai.py                        60/60
qa_builder.py                   98/98
qa_states_m4.py                 47/47
qa_pages.py                    106/106
qa_states_m3.py                 40/40
qa_module2.py                   48/48
qa_states_m1.py                 39/39
qa_flows.py                     38/38
qa_react.py                      ok
qa_library.py                   90/90
                               ------
11/11 suites green
```

The arithmetic checks are the ones worth trusting: `qa_theme.py` reads the nine hex values out of the DOM, reads the
ratios the screen is showing, recomputes both with the WCAG relative-luminance formula in Python, and fails if any pair
is off by more than 0.02. A hardcoded ratio — which is what the mocks contained — cannot pass that test.

## 5 · Honest deltas

- **T02/T04/T06 have no pixel reference.** Built from the contract; flagged rather than dressed up.
- **The preview is a rendering of a draft, not a signed preview origin.** `BACKEND-PLAN.md` keeps the signed-origin
  contract; the prototype renders in-document with inert handlers.
- **Three families say "Requires ingestion".** They are listed, disabled, and explained; making them selectable needs
  the server font pipeline, not more UI.
- **The `Workspace` preset scope is stored and labelled but not permission-checked** — the prototype is a single
  workspace. The rule is written down rather than faked with a disabled radio.
- **`Release history` leaves the module.** It routes to the dashboard's publishing panel until Module 11 exists, and
  says so in a toast instead of pretending a release screen is behind it.
