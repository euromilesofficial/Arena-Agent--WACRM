# Module 6 — Theme Studio · gap review and build contract

**Reviewed:** specification v1.0 (24 sections, pasted 15 Nov 2026, persisted verbatim as
`MODULE-6-THEME-STUDIO-SPEC.md`) against the three reference mocks now in
`uploads/` — `WACRM Theme Studio Dashboard.webp` (T01, brand tokens with picker + pairing
menu open, save toast), `WACRM Theme Studio Typography Dashboard-2.webp` (T03) and
`Modern Violet Theme Studio Dashboard-3.webp` (T05, presets + import review) — and against
what Modules 1–5 actually implement.

**Method:** every claim in the spec was traced to a mock, to a module we have already
built, or to arithmetic. Contrast ratios were computed with the WCAG relative-luminance
formula rather than read off the images; font feasibility was tested by fetching a real
family file (below).

**Verdict:** the spec is strong — the state model, the save/publish split and the import
safety rules are better than most production specs. It is **not buildable as written**
without ten decisions, because it points at three things that do not exist in this
product yet (a Publishing module, a defined CTA-foreground token, and an offline-capable
font pipeline) and it carries **31 gaps and 10 internal contradictions**. All are
resolvable; §5 states the decision I recommend for each so this can move to build in one
round.

| Severity | Count | Meaning |
|---|---|---|
| **P0 — blocker** | 7 | The spec cannot be implemented without choosing something; building the literal text produces a lie or a dead control. |
| **P1 — must fix** | 12 | Implementable but wrong-by-default: would ship inconsistent counts, orphaned references, unprotected routes or a broken offline artefact. |
| **P2 — polish** | 12 | Detail that separates "matches the mock" from "production-grade". |
| **Contradiction** | 10 | Spec vs mock, or spec vs itself. One reading must win. |

---

## 1 · Mock ↔ spec contradictions (one reading must win)

| # | The mock shows | The spec says | What I will build |
|---|---|---|---|
| X1 | T01: `Unsaved changes` chip **and** a green `Brand tokens saved` toast in the same frame | §1 forbids both for one revision | One state at a time. After save the chip becomes `Saved draft · 11:42`, and the toast is the only success surface. A newer edit flips it back to `Unsaved changes`. |
| X2 | Three mocks give the right rail three different contents (T01: Font Pairing + JSON Presets; T03: Typography Summary + Fallback + Usage; T05: Radius/Container + Accessibility + Usage) | §10.1 fixes five panels | Canonical order **Token Summary → Typography Summary → Accessibility → Usage → Status**; each tab scrolls its own most-relevant panel into view rather than swapping the rail. |
| X3 | T01 puts a full Typography block (heading/body/pairing) inside Brand Tokens | §5.1: no duplicate editor | Summary + `Edit in Typography` link. |
| X4 | T05: the active preset still shows a violet `✓ Apply` | An active preset is already applied | `Applied` badge, button disabled with reason `This is the active theme source`. |
| X5 | T05 right rail: `AI text on primary: 7.2:1`, `Text on secondary 14.1:1`, `All passed` | §5.4: compute, never hardcode | Computed: **18.81:1**, **5.96:1** for those pairs — the mock's numbers are invented in every frame. See §4.4. |
| X6 | Secondary is `#0B1026`, i.e. near-black | §5.2 calls Secondary a "brand accent, do not conflate with text" | Keep the mock's value but label it **Secondary (headings, dark surfaces)** and keep `text` separate; contrast is tested against both. |
| X7 | T01 has a JSON drop zone plus `Import JSON` in the header | §8.1: one flow | Both open the same importer; the drop zone is a surface, not a second state machine. |
| X8 | T01's `Used across 48 pages` | §10.5: only when computable | Computable from real CMS pages — we have them. Shown with a derivation tooltip. |
| X9 | T03 banner: "Selected fonts are self-hosted and validated before saving" | §6.6: fonts are fetched at save time | Fonts ship inside the artefact (see D5), so the banner is true without a network call; the ingestion job becomes a verification job. |
| X10 | T05 import review sits inside the left column | §8.4 calls it a dialog | A modal, as the spec says; the in-column panel is its summary state. |

---

## 2 · P0 — the seven blockers

| ID | Area | Problem | Production impact | Correction (proposed) |
|---|---|---|---|---|
| **G01** | Publish destination | Every publish path routes to "Publishing & Releases" — a module that **does not exist**; Module 4 owns the only release flow we have. | A `Publish Theme` button that leads nowhere, or a second publish implementation — the exact thing §11.4 forbids. | Reuse Module 4's publish dialog as the single release path; the release payload gains `themeRevisionId`. Top CTA becomes **`Review for Publish`**, disabled with reason until a saved draft exists. (D1) |
| **G02** | Token taxonomy | §0.1 says five core groups; §5.2 *requires* background/surface/text; mocks persist accent/success/warning/error. Counts and validation therefore have no fixed target. | Schema drift on day one; "5 tokens" claims that don't match the 9 stored values. | Persist **9 colour roles + 1 derived**, 2 font roles, 3 geometry families. Document the source's "5 core" as the *five groups*, not five values. (D2, §4.2) |
| **G03** | CTA foreground | §5.4 tests "actual CTA foreground against primary" but no such token exists in any DTO. | The most important contrast check in the product cannot be implemented; every mock's "CTA text 7.2:1" is unfalsifiable. | Derive `onPrimary` automatically: pick `#FFFFFF` or `#101828` by whichever passes, expose as a **read-only derived token** in the summary and in exports, and test it in the pair registry. (D3) |
| **G04** | Spacing model | Three incompatible models in one document: presets (Compact/Comfortable/Spacious), enumerated steps (4/8/16/24/32), and `spacingStepPx: 8` in the DTO. | A slider with nothing to snap to; block padding that can't be reproduced from an export. | Persist **`spacing.base` (4 or 8)** and **`spacing.density` (compact/comfortable/spacious)**; the scale is `base × {1,2,4,6,8}` and density multiplies section padding `0.75 / 1 / 1.25`. Both appear in the UI and the JSON. (D4) |
| **G05** | Fonts vs offline artefact | §6.6 requires fetching Google Fonts at save; our deliverable must open **with no network** and no CDN. | Selecting "Poppins" would silently render as a system fallback — the Typography tab would be lying, and every pairing preview with it. | **Embed** the catalogue as variable woff2 inside the single-file build (all six families are OFL 1.1). Verified feasible: a real Inter woff2 fetched at 48 KB; six families ≈ 300 KB → ~400 KB base64, +`LICENSES.md`. Families not embedded stay in the catalogue as `Requires ingestion` and are disabled with a reason. (D5, §4.5) |
| **G06** | Preview source | §9.1 wants authorised site content, §9.4 wants the EuroMiles sample; neither says where pixels come from. | Either a fake preview that ignores the theme, or a second renderer that drifts from Module 4. | Render **a real page draft through Module 4's `Node` renderer** with theme variables scoped to the preview root. Page picker defaults to the site's home page; forms render inert with a `Preview — submissions disabled` chip. (D6) |
| **G07** | "Block Styling" in presets | Presets claim to carry block styling, §8.3 calls it "whitelisted compatible block styling variants", and nothing defines what they are — while Module 5 already owns block variants. | A second, conflicting styling system, or an import field that silently does nothing. | Phase 1 defines it as a **closed enum of two token-level treatments** (`cardDensity`, `elevation`) applied through tokens only. Unknown keys **fail validation with a field path**, never pass silently. (D7) |

---

## 3 · P1 — twelve that would ship wrong

| ID | Area | Problem → correction |
|---|---|---|
| **G08** | Revision identity | The spec describes live/saved/working but gives them no identity, so the UI cannot say *which* revision it is showing. → Every save creates a revision `{id, baseId, createdAt, createdBy, schemaVersion, tokens, status}`; only publish sets `site.liveThemeRevisionId`. The header shows `Draft #7 · saved 11:42` and `Live #6` side by side. Reuses Module 4's revision pattern. |
| **G09** | Missing mock evidence | T02, T04 and T06 (contrast-per-row, the three-step status rail, preset `•••` + delete) exist only as prose. → Build them from the contract, in the same visual grammar as T01/T03/T05, and flag in the decisions log that no pixel reference existed. |
| **G10** | Dirty-state protection | §11.3 wants a guard on site change, route change and browser navigation; our shell routes by hash and has no guard anywhere. → One `useDirtyGuard` on the Theme Studio route: hash-change interception, `beforeunload`, and the `Stay / Discard / Save draft & continue` modal. |
| **G11** | Import contract | No size cap, no version negotiation, no unknown-key policy, no decision whether import creates a preset or applies directly. → 256 KB / depth 8 / `schemaVersion: 1` only; unknown top-level key = error with `$.path`; **import always lands in the Preset Library**, applying is a separate explicit step. One code path for all three entry points. |
| **G12** | Export provenance | "Export Theme JSON" doesn't say which revision is exported. → A small menu: `Export saved draft` / `Export live theme` (the second disabled with reason when nothing is live), filename `euromiles-main-theme-<draft|live>-v<n>.json`, plus `x-wacrm` provenance block (site name, revision, exportedAt, exporter) and nothing else tenant-identifying. |
| **G13** | Preset deletion | §7.9 hedges between blocking and soft delete. → Block when referenced by any theme revision or saved template, listing them, with `Archive instead` as the escape hatch. Same guard shape as Module 5's in-use delete. |
| **G14** | RBAC mapping | The matrix invents Designer/Manager/Admin; the app has **Owner / Editor / Viewer**. → Viewer: read, preview, per-row contrast, no save; Editor: edit, save draft, import, apply, create/rename/duplicate presets; Owner: delete preset, reset to defaults, review for publish. Archived site = read-only for everyone. |
| **G15** | Contrast policy | §5.4 and §10.7 leave advisory-vs-blocking ambiguous. → Contrast **never blocks saving** (a draft may be in-progress), but a `preflight` summary marks `2 warnings` and the publish review shows them as advisories. Deterministic rule, stated in the UI: `Warnings do not block drafts; they are listed in the publish review.` |
| **G16** | Conflict has no way to occur | Single-browser prototype: a 409 can never happen, so the `Theme Updated Elsewhere` dialog would be untestable dead UI. → Real CAS in the data layer **plus** a `simulate teammate save` action inside the existing dev/states harness so the conflict, its diff and `Keep my draft as a copy` are all reachable and QA-able. |
| **G17** | Usage counts | `Used across 48 pages`, `Used by 20 blocks` are presented as facts. → Computed live: pages = site pages whose draft uses at least one token-consuming block; blocks = distinct block types in use; templates = section templates in the library; websites = 1 for a site-scoped theme. Each number carries `ⓘ` showing its derivation, and shows `Usage details unavailable` when the projection can't run. |
| **G18** | Ingestion states offline | §6.7 wants `Ingestion pending/failed` with retry; we have no server to ingest. → Model it as a local **font verification job** (asset present, weights declared, checksum ok) that can be made to fail from the states harness; wording stays `Preparing font…` and the real server contract is written into `BACKEND-PLAN.md`. |
| **G19** | Accessibility claims | A green `All passed` beside failing rows is forbidden by the spec but produced by the mock's own palette — the mock's `#F59E0B` on white is **2.15:1** and `#0EA5E9` is **2.77:1**, both failing even the 3:1 non-text rule. → The pill is *derived* from the rows (`5 passed · 2 warnings`), the copy never says "the site is WCAG compliant", and the seeded Modern Violet preset genuinely shows two warnings with `Use suggested colour` available. |

---

## 4 · P2 — twelve details, and the schema they hang on

| ID | Detail |
|---|---|
| G20 | Per-pair applicability: a role that is never used as text gets `Not applicable` (non-text) instead of a fabricated ratio; component-boundary roles are tested at 3:1. |
| G21 | Undo: 20-step in-memory token undo, `⌘/Ctrl+Z`, cleared by save (the spec asks to "retain an undo path where supported"). |
| G22 | Recent colours: last 6, session-scoped, shown in the picker; copy announces `Copied #6941E8` through an `aria-live` region. |
| G23 | Hex normalisation: `#abc → #AABBCC`, trim, uppercase on blur; 8-digit/alpha rejected with a reason (no alpha in the token contract). |
| G24 | Device widths 1440 / 768 / 375 with scale-to-fit inside the canvas, container width clamped to viewport, scroll position preserved across morphs. |
| G25 | Motion: tokens 160–300 ms `cubic-bezier(.16,1,.3,1)`, CSS variables written to a scoped root (no React re-render per pointer move), `prefers-reduced-motion` kills shimmer and morphs. |
| G26 | Empty states the spec forgets: site with no pages (preview offers the sample + `Choose another page`), archived site, theme never saved, presets empty after delete-all. |
| G27 | `Delete Token Set` from the source has no UI in T01–T06 and no multi-set story here → `[DEFER]`, recorded as a backend contract, not a hidden control. |
| G28 | `Workspace` preset scope: the prototype is single-workspace, so the scope is stored and labelled, and the permission check is written as a contract rather than faked with a disabled radio. |
| G29 | `Replace layout after review` — Layouts & Templates is still a placeholder screen → radio present, disabled, reason `Layouts import isn't enabled in this workspace`. Truthful and matches the spec's guard. |
| G30 | The T04 "Editing → Saved draft → Published" three-step rail is a *legend*, not a wizard; it becomes a status chip + popover explanation, and the data model keeps live and draft revisions non-exclusive. |
| G31 | Auditability: `Last saved by` / `Last published` lines in Theme Status, plus the audit contract in `BACKEND-PLAN.md` (who saved, imported, applied, exported, deleted, published). |

### 4.1 The token document I will implement

```jsonc
{
  "schemaVersion": 1,
  "siteId": "site_main",
  "revisionId": "thm_01J…",
  "baseRevisionId": "thm_01H…",
  "colors": {              // 9 persisted roles
    "primary": "#6941E8", "secondary": "#0B1026", "accent": "#0EA5E9",
    "success": "#16A34A", "warning": "#F59E0B", "error": "#EF4444",
    "background": "#FFFFFF", "surface": "#F8FAFC", "text": "#0B1026"
  },
  "typography": {
    "heading": { "family": "Geist",  "weight": 700, "fallback": "system-ui-stack" },
    "body":    { "family": "Inter",  "weight": 400, "fallback": "system-ui-stack" }
  },
  "geometry": {
    "radiusPx": 12,                       // 0 | 4 | 8 | 12 | 16 | 24
    "spacing": { "base": 8, "density": "comfortable" },   // base 4|8
    "containerWidthPx": 1200              // 960 | 1080 | 1200 | 1280
  },
  "blockStyling": { "cardDensity": "comfortable", "elevation": "soft" }, // closed enum, D7
  "status": "draft",
  "provenance": { "presetId": "preset_modern_violet", "createdBy": "Aranya K." }
}
```

Derived, never stored: `colors.onPrimary` (auto-picked for ≥4.5:1 against `primary`), the
spacing scale, and the compiled CSS variables `--brand-*`, `--radius-md`, `--space-*`,
`--container`, `--font-heading`, `--font-body`.

### 4.2 Contrast engine — the pairs, and the real numbers

Computed with WCAG relative luminance (`0.2126R + 0.7152G + 0.0722B`, sRGB linearised):

| Pair | Requirement | Modern Violet (mock palette) | Verdict |
|---|---|---|---|
| `text` on `background` | 4.5 | **18.81 : 1** | pass |
| `text` on `surface` | 4.5 | **17.98 : 1** | pass |
| `onPrimary` on `primary` (CTA) | 4.5 | **5.96 : 1** | pass |
| `primary` as link on `background` | 4.5 | **5.96 : 1** | pass |
| `primary` as link on `surface` | 4.5 | **5.70 : 1** | pass |
| `secondary` as heading on `background` | 4.5 | **18.81 : 1** | pass |
| `success` as non-text marker on `background` | 3.0 | **3.30 : 1** | pass |
| `error` as non-text marker on `background` | 3.0 | **3.76 : 1** | pass |
| `warning` as non-text marker on `background` | 3.0 | **2.15 : 1** | **warning** |
| `accent` as non-text marker on `background` | 3.0 | **2.77 : 1** | **warning** |

The mock's chips (`12.6:1`, `14.1:1`, `7.2:1`, `5.1:1`) do not match any of these, and its
`All checks passed` badge is impossible for that palette. The build will therefore open on
**5 passed · 2 warnings** with `Use suggested colour` offered for warning and accent —
the honest version of the mock, and a live demo of the engine.

### 4.5 Fonts — verified, not assumed

`curl` against Google's static font host returned a real **Inter variable woff2, 48,256 bytes**
inside this sandbox, and `fontTools 4.68.0` is available for subsetting if a family ships
static-only. All six catalogue families (Geist, Inter, Poppins, Montserrat, DM Sans, Lora)
are SIL OFL 1.1, so embedding is licence-clean with attribution. Budget: ~300–450 KB of
woff2 → ~400–600 KB base64 inside the single HTML file, which pushes `WACRM-CMS.html` from
1.1 MB to roughly 1.6 MB and the zip by a similar amount. That is the price of a
typography tab that tells the truth offline; I recommend paying it. Weights come from the
variable axis where available, so "Supported weights" is a real constraint, not a list
pretending.

---

## 5 · The ten decisions I recommend

| # | Question | Recommendation |
|---|---|---|
| **D1** | Where does publishing go? | `Review for Publish` opens **Module 4's existing publish dialog**, carrying `themeRevisionId` into the same release. No Publishing module is invented; no second publish path exists. Disabled with `Save your theme draft first` until a draft exists. |
| **D2** | Token set | 9 colour roles + derived `onPrimary`, 2 font roles, radius, spacing (base + density), container, closed `blockStyling` enum. "Five core groups" is documented as source parity, not five values. |
| **D3** | CTA text colour | Derived `onPrimary`, shown read-only, exported, tested. Never user-editable in Phase 1. |
| **D4** | Spacing | `base` (4/8) × `density` (compact/comfortable/spacious). Slider snaps to scale steps; JSON carries both. |
| **D5** | Fonts | Embed six OFL families as woff2 (variable where possible) + `LICENSES.md`; catalogue beyond those = `Requires ingestion`, disabled with reason. Ingestion modelled as a verification job. |
| **D6** | Preview source | Real page draft through Module 4's renderer, page picker, inert forms, scoped CSS variables. Sample content only as an explicit fallback. |
| **D7** | Preset block styling | Closed enum `cardDensity` + `elevation`; unknown keys fail validation. No second styling system. |
| **D8** | Missing mock states (T02/T04/T06) | Build them from the contract in the same visual grammar; log that no pixel reference existed. |
| **D9** | Import | Validate-only first, always into the Preset Library, apply as a separate step; 256 KB cap, version 1 only, unknown keys rejected with a path. |
| **D10** | Layouts/navigation in presets | Visible in the review panel as `Present in file — not applied`, radio disabled with reason. Nothing structural is ever overwritten by a theme import. |

---

## 6 · How it plugs into Modules 1–5 (and why that is the whole point)

| Module | Interconnection | Why it matters |
|---|---|---|
| **M2 Sites & Domains** | Theme is per-site; the site switcher respects the dirty guard; archived sites are read-only; site status drives `Live revision` display. | Otherwise two sites could share one palette silently. |
| **M3 Pages** | The preview's page picker lists real pages; `Used across N pages` is computed from those pages and their drafts. | Makes the usage numbers true instead of decorative. |
| **M4 Visual Builder** | Theme tokens become the builder's **defaults and CSS variables**; the builder's inspector keeps per-block overrides (spec §0.2 boundary). Publish is shared. | One design system, two surfaces — the alternative is theme values that never appear on the canvas. |
| **M5 Block Library** | Section-template thumbnails and the inspector preview render with the draft theme's variables; `Applied to N section templates` is a real count. | The library stops looking like a different product the moment the brand colour changes. |
| **M1 Dashboard** | A `Theme` line on the CMS overview (current revision + last publish) links here. | Cheap, and it makes the module discoverable. |

---

## 7 · What I will not build (explicit non-scope)

No publishing module, no marketplace, no custom CSS/JS, no dark-mode token set, no
per-block style editor here (Module 4 owns it), no layout/navigation import, no shadow or
animation token tabs, no AI theme generation, no multi-token-set switcher, no theme-level
responsive typography scales. Anything the spec marks `[DEFER]` stays a written contract
in `BACKEND-PLAN.md`, not a disabled button pretending to be a feature.

---

## 8 · Build plan and QA

| Phase | Contents | QA |
|---|---|---|
| **6A · Tokens + preview** | Screen shell, Brand Tokens tab (9 roles, picker, hex, copy, recent), contrast engine, geometry, reset modal, real-page preview with device morph, right rail, revision store + CAS, dirty guard | `qa_theme.py` ~45 assertions |
| **6B · Typography** | Embedded fonts, accordions, weights, fallbacks, pairing menu + preview, verification job states | +15 assertions |
| **6C · Presets + JSON** | Library (built-in 3 + workspace), preview mode, apply diff, create/duplicate/rename/delete with guards, import review, export draft/live | +25 assertions |
| **6D · States, motion, docs** | Full state matrix, reduced motion, conflict via harness, publish handoff, decisions log, BACKEND-PLAN §7.27, HANDOVER | +20 assertions |

Target: **~105 Theme Studio assertions**, plus the existing 566 staying green. Three to
four sessions, same discipline as Module 5: findings → decisions → build → QA → checkpoint.

## 9 · Acceptance additions the spec is missing

1. Saving with an invalid hex **anywhere** in the document blocks save and names the field.
2. A preset preview must not survive a tab switch **or** a site switch unnoticed.
3. `Export` of a draft that has never been saved must be impossible (nothing to export).
4. Re-importing an exported file must round-trip **byte-identical tokens** (proving export
   isn't lossy and validation isn't stricter than the exporter).
5. Deleting the preset a live theme was built from must be blocked, and the block message
   must name the release.
6. The preview must remain interactive on all three devices without horizontal overflow.
7. Every contrast number on screen must equal the engine's output to 2 dp — asserted by QA,
   not by eye.
8. `⌘S` saves a draft; `Esc` closes every popover and returns focus; tab order never leaves
   the viewport.
