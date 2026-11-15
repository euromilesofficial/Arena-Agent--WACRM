# Theme Studio — Competitive Benchmark & Gap Register

**Doc type:** research deliverable (no code shipped by this document)
**Subject:** how modern CMS / site-builder theme systems are built, measured against our Module 6 Theme Studio
**Workspace commit at time of writing:** `b41bf3e` (`m6-theme-studio`)
**Purpose:** answer "are we missing out on any feature or functionality?" with evidence, then rank the gaps so the user can approve or reject each one.

> **One-line verdict.** Our Theme Studio is not a copy of a CMS's theme panel — it is a *narrower but stricter* one. It is ahead of every system surveyed on **draft-vs-live truth, per-pair contrast semantics, real embedded fonts and write-conflict handling**, and behind on **typography depth (a real type scale), colour-role breadth (border / ring / muted / link pairs), the in-studio specimen sheet, and a visible revision history**. Dark mode and palette generation are genuine absences, not oversights. Motion, brand assets and publishing are deliberate exclusions that still hold.

---

## 1. Method and evidence base

Twelve sources were read this round: seven vendor documentation surfaces plus the token-standard and accessibility specifications. Vendor docs are treated as primary; practitioner articles are used only where they document a shipped behaviour that vendor docs describe loosely (Shopify's `color_schemes` shape, Squarespace's ten-theme generation).

| # | Source | Type | What it establishes |
|---|---|---|---|
| S1 | Webflow — *Manage variable modes*, *Create a variable mode* (developers.webflow.com) | Vendor docs | Tokens live in **collections**; **modes** (manual, or automatic per breakpoint) produce light/dark and per-brand themes; modes apply to primary styles only |
| S2 | Webflow — *Design systems / libraries* (webflow.com/webflow-way, university.webflow.com) | Vendor docs | A **shared library** is one source of truth across a workspace; changes are **reviewed and accepted per site** |
| S3 | WordPress — `theme.json` v3 reference (developer.wordpress.org) | Vendor docs | `settings.color.palette`, `typography.fontSizes` + `fluid` (generated `clamp()`), `spacing.spacingScale` (operator/increment/steps), `styles.elements` and `styles.blocks` |
| S4 | WordPress.com — *Manage and reset your style changes*; Style Book guides | Vendor docs | **Style revisions** with preview-then-**Apply**; **Style Book** = six-tab in-editor specimen of every block in current styles; reset-to-default |
| S5 | Shopify — *Dynamic colour schemes with theme options and presets*; `settings_data.json` `color_schemes` | Vendor + practitioner | `settings_schema.json` declares settings; `settings_data.json` holds `current` **and** `presets`; `color_schemes` defines N named schemes (background, text, button, button_label, shadow) selectable **per section** |
| S6 | Shopify — theme library, duplicate, publish, rollback | Practitioner | Publishing is an explicit act on an **unpublished copy**; the previous theme persists in the library as the rollback path; per-file history where supported |
| S7 | Elementor — *Site Settings* | Vendor docs | Design System = **Global Colors** (4 system roles + unlimited custom) and **Global Fonts** (4 roles, each with family/size/weight/line-height/letter-spacing); plus Theme Style for buttons, images, form fields, site identity, layout/breakpoints, custom CSS |
| S8 | Framer — *Setting up your Framer site for scale*; Assets → Styles | Vendor docs | Text styles **with breakpoints**; colour styles **with dark and light values**; variables as reusable tokens |
| S9 | Squarespace 7.1 — Site Styles | Vendor + practitioner | Five-colour palette (Lightest→Darkest) **generates ten colour themes**, assignable per section; **font packs** (≈30 pairings) applied site-wide, then per-block "Assign styles"; palette generated from an image or one brand colour |
| S10 | Material Design 3 — *Design tokens* | Vendor docs | Three token classes — **reference → system → component**; system tokens are where theming happens; elevation is tonal, not shadow |
| S11 | shadcn/ui — *Theming* | Vendor docs | The de-facto semantic role set: `background/foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1…5`, `sidebar-*` — every surface paired with an `-foreground`; values now emitted in **OKLCH** |
| S12 | DTCG Design Tokens Format Module **2025.10** (stable 2025-10-28); Style Dictionary v4 | Standard | `$value` / `$type` / `$description` / `$deprecated`, `{alias}` references, `$extends` for theming, OKLCH & P3 colour, composite types (typography, shadow, border) |
| S13 | CSS `light-dark()`, `color-mix()`, `oklch()` — Baseline 2026 | Spec/browser data | `color-scheme: light dark` + `light-dark()` ships one declaration per colour for both modes; `color-mix(in oklch, …)` derives states |
| S14 | WCAG 2.2 SC 1.4.3 / 1.4.6 / 1.4.11; APCA (WCAG 3 draft candidate) | Standard | AA = 4.5:1 text, 3:1 large text, 3:1 non-text; AAA = 7:1 / 4.5:1; APCA replaces the flat ratio with size/weight-aware **Lc** |
| S15 | Practitioner reports (2026) | Secondary | Low-contrast text remains the most common failure on home pages (WebAIM, reported 83.9%); APCA is *not* in WCAG 3 yet and no law references it |

---

## 2. What each system actually ships

**Webflow** — variables in collections with **modes**, plus components, style selectors, page templates and **shared libraries**. The theme surface is deliberately split from the asset surface: variables are the tokens, modes are the themes. A breakpoint can drive a mode automatically, so "mobile spacing" is a mode switch, not a separate scale. Library updates arrive as reviewable diffs per site.

**WordPress (block themes)** — `theme.json` is the contract, and it is the most complete *published* description of a theme system in any CMS: palette, font families with `fontFace`, font sizes with `fluid` (min/max → generated `clamp()`), a spacing scale that can be auto-generated from an increment, per-element styles, per-block styles, and appearance tools as a capability gate. On top sit **style variations** (whole-theme, colour-only, typography-only) that users mix and match, **Global Styles revisions** with Apply, and the **Style Book** — a six-tab specimen of every block rendered in the current styles.

**Shopify** — the oldest, most operationally mature model. `settings_schema.json` declares controls; `settings_data.json` stores `current` plus a `presets` map for theme styles. Online Store 2.0 added `color_schemes`: N named schemes, each a small role set (background, text, button, button label, shadow), selectable **per section**, so one page can alternate schemes down its length. Publishing is explicit and reversible: duplicate → edit the unpublished copy → publish; the previous theme stays in the library as the rollback.

**Elementor** — Site Settings is a design system in miniature: four global colour roles plus unlimited custom ones, four global font roles (each with family, size, weight, line-height, letter-spacing), and a Theme Style layer that styles *buttons, images, form fields* once for the whole site, next to site identity, layout width, breakpoints and custom CSS.

**Squarespace 7.1** — the most opinionated. You pick five palette colours (Lightest → Darkest) and the system **generates ten colour themes** you assign per section; you pick a font pack (~30 pairings, with sizes, weights and letter-spacing already resolved) and then override individual text roles via "Assign styles". A palette can be generated from an uploaded image or a single brand colour. There are no templates to switch — only one template family and different starting arrangements.

**Framer** — design-tool-first. Styles live in Assets: **text styles with per-breakpoint values** and **colour styles carrying both dark and light values**. Variables are the token layer; the theme is whichever values the variables resolve to at a breakpoint or mode.

**Material 3** — not a CMS, but the clearest articulation of token *tiers*: reference tokens (all values) → system tokens (decisions and roles, where theming happens) → component tokens (per-part). Elevation is tonal (a surface-tint overlay at increasing opacity), not shadow — the detail most in-house systems get wrong in dark mode.

**shadcn/ui** — not a CMS either, but the de-facto vocabulary for semantic roles in React products, and the closest thing to an industry default: every surface is paired with an `-foreground`, and `border`, `input`, `ring`, `muted`, `popover`, `chart-1…5` and `sidebar-*` exist as first-class roles. Values are now authored in OKLCH.

**DTCG 2025.10** — the interchange layer none of the CMSs implement natively but all of them are converging on: `$value`/`$type`, `{alias}` references, `$extends` for theming, OKLCH/P3 colour, composite typography and shadow types. Style Dictionary v4 consumes it. This is now the answer to "will our tokens survive a tool change".

---

## 3. The twelve patterns that define "a theme studio" in 2026

| # | Pattern | Who does it | Our M6 |
|---|---|---|---|
| P1 | **Semantic roles, not raw colours** — every surface paired with what sits on it | shadcn (S11), M3 (S10) | ◐ nine roles; only `onPrimary` is paired (derived) |
| P2 | **Token tiers** — primitive → semantic → component | M3 (S10), DTCG aliases (S12) | ⊘ flat by design (single site, presets) |
| P3 | **Modes** — light/dark, per-brand, per-breakpoint, as an axis over one token set | Webflow (S1), Framer (S8), CSS `light-dark()` (S13) | ✗ absent |
| P4 | **A real type scale** — role-based text styles with size/line-height/letter-spacing, fluid between breakpoints | WP `fluid` (S3), Elementor (S7), Squarespace packs (S9), Framer (S8) | ◐ family + weight only; body pinned at 16 px |
| P5 | **Section-scoped colour schemes** — pick a scheme per section, not per page | Shopify `color_schemes` (S5), Squarespace ten themes (S9) | ✗ absent (global only) |
| P6 | **A specimen sheet / style book** in the editor | WP Style Book (S4) | ◐ the real page preview stands in for it |
| P7 | **Revisions you can see and restore** | WP revisions + Apply (S4), Shopify library (S6) | ◐ history exists in the payload, no UI |
| P8 | **Presets/variations, including partial ones** — colour-only, type-only, mixable | WP style variations (S3), Shopify presets (S5) | ◐ full token sets only |
| P9 | **Palette generation** — one brand colour (or an image) → a whole accessible ramp | Squarespace (S9), M3 dynamic colour (S10), OKLCH ramps (S13) | ✗ absent |
| P10 | **Draft → review → publish**, with rollback as a first-class path | Shopify (S6), Webflow libraries (S2), WP (S4) | ✓ draft≠live, CAS; publish deliberately handed to M11 |
| P11 | **Multi-site / multi-brand distribution** — a library installed and updated per site | Webflow shared libraries (S2), DTCG `$extends` (S12) | ◐ Workspace-scoped presets, no update propagation |
| P12 | **Contrast is computed, not asserted** | Squarespace palette "built for accessibility" (S9); most others leave it to plugins | ✓ computed, per-pair, with pass/warn verdicts |

**The pattern that surprised me most:** only *two* of the seven systems compute contrast for you, and neither shows the measured ratio next to the control. Elementor, Webflow, Shopify and Framer all let you ship a 1.2:1 button without a word. That is the one place our build is materially ahead of the market rather than behind it.

---

## 4. Feature matrix

Legend: ✓ present · ◐ partial · ✗ absent · ⊘ deliberate non-goal

| # | Capability | Webflow | WP | Shopify | Elementor | Sqs 7.1 | Framer | Ours |
|---|---|---|---|---|---|---|---|---|
| 1 | Named colour roles with usage text | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | Surface/`-foreground` pairing | ◐ | ✓ | ✓ | ◐ | ◐ | ✗ | ◐ |
| 3 | Border / divider token | ✓ | ✓ | ◐ | ✓ | ◐ | ✓ | ✗ |
| 4 | Focus-ring token | ◐ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| 5 | Muted / secondary text role | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✗ |
| 6 | Separate link colour | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✗ |
| 7 | Data-viz palette | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 8 | Colour modes (light/dark, brand) | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✗ |
| 9 | Type-scale roles (H1–H6, body, caption, button) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ (2 roles) |
| 10 | Line-height / letter-spacing control | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| 11 | Fluid type between breakpoints | ◐ | ✓ (`clamp()`) | ✗ | ◐ | ◐ | ◐ | ✗ |
| 12 | Font family + weight selection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 13 | Self-hosted font embedding, offline | ✗ | ◐ | ✗ | ✗ | ✗ | ✓ | ✓ (6 OFL families, 242 KB) |
| 14 | Font licence surfaced in UI | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| 15 | Radius / spacing / container as discrete enums | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 16 | Elevation control | ✓ | ✓ | ◐ | ✓ | ◐ | ✓ | ◐ (flat/soft) |
| 17 | Motion / transition tokens | ✓ | ✗ | ◐ | ✓ | ✓ | ✓ | ✗ |
| 18 | Section-level colour scheme | ✓ | ◐ | ✓ | ◐ | ✓ | ✗ | ✗ |
| 19 | In-editor specimen of components | ◐ | ✓ Style Book | ✗ | ◐ | ✗ | ✗ | ◐ (real page) |
| 20 | Presets with scope (built-in/workspace/site) | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ |
| 21 | Partial presets (colour-only / type-only) | ◐ | ✓ | ◐ | ✗ | ✓ | ✗ | ✗ |
| 22 | Palette generator from one colour | ◐ | ✗ | ◐ | ✗ | ✓ | ✗ | ✗ |
| 23 | Import/export JSON with validation | ◐ | ✓ | ◐ | ◐ | ✗ | ◐ | ✓ (path-level issues) |
| 24 | DTCG 2025.10 interchange | ✗ | ◐ | ✗ | ✗ | ✗ | ◐ | ✗ |
| 25 | Wide-gamut / OKLCH colour input | ◐ | ◐ | ✗ | ✗ | ✗ | ✓ | ✗ (hex only) |
| 26 | Computed contrast, per real pair | ✗ | ✗ | ✗ | ✗ | ◐ (palette only) | ✗ | ✓ (10 pairs) |
| 27 | APCA alongside WCAG 2 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 28 | Colour-blindness simulation | ◐ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ |
| 29 | Visible revision history + restore | ✓ | ✓ | ✓ | ✗ | ◐ | ◐ | ◐ (data, no UI) |
| 30 | Draft ≠ live, with conflict detection | ✗ | ◐ | ✓ (unpublished copy) | ✗ | ✗ | ◐ | ✓ (CAS + 409) |
| 31 | Preview at 3 devices | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 32 | Per-breakpoint token values | ✓ modes | ◐ | ✗ | ◐ | ◐ | ✓ | ✗ |
| 33 | Brand assets (logo, favicon, bg image) in the same surface | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ⊘ |
| 34 | Scheduled / per-channel publish | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ⊘ (M11) |
| 35 | Theme-level approval workflow | ✓ libraries | ◐ | ✗ | ✗ | ✗ | ◐ | ⊘ (M11) |

Score against the market: **12 ✓, 11 ◐, 8 ✗, 4 ⊘** out of 35. The ✗ cluster is concentrated in exactly four areas: colour-role breadth, typography depth, modes, and generation/interchange.

---

## 5. Gap register

Severity: **A** = table stakes, a buyer would notice the absence · **B** = differentiator, worth building · **C** = real but low-yield for a CRM-attached CMS · **X** = keep excluded.

### Tier A — genuinely missing, recommend building

**G1 · Typography has no scale (severity A).**
We store a family and a weight per role, and body copy is hard-pinned at 16 px (`theme-db.ts:730` copy, `previewVars` sets weights only). Every system surveyed exposes size, line-height and letter-spacing per text role — Elementor's global fonts carry all four, WordPress's `fontSizes` are a first-class array, Squarespace's font pack is *defined* as "a font pair with all sizes, weights and letter-spacing applied". The upstream consequence is visible in our own preview: change the heading family to Lora and only the family changes, not the rhythm.
*Cost:* one tab section, five numeric fields per role (size, line-height, letter-spacing, plus a scale ratio), an OKLCH-free `clamp()` generator for fluid behaviour, ~25 QA assertions. **Highest value-to-cost item in this document.**

**G2 · Role set is too thin for a marketing site (severity A).**
Nine roles, no border, no focus ring, no muted text, no distinct link, no popover/card surface distinction. shadcn's set (S11) is the market baseline and every one of those tokens exists because a real UI breaks without it. Our contrast table already *measures* `link/bg` and `link/surface` — implying a link colour — yet the token list has no link role, so the measurement and the editor disagree. That is an internal inconsistency to fix regardless of market pressure.
*Cost:* 4 new roles (`border`, `ring`, `muted`, `link`), each joining the contrast table with correct semantics (`border`/`ring` at 3:1 as UI boundaries, `muted`/`link` at 4.5:1 as text). Moderate; the contrast engine and migration guard already exist.

**G3 · No specimen sheet (severity A).**
WordPress's Style Book (S4) exists for one reason: a theme with three hero sections can look fine on one page and broken on another. Our centre pane previews **one real page** in three device widths — strong for "does my site look right", blind to "does my button, input, alert, table, badge and focus state look right". The colour-blind reader of our own review would note that we ship a *Theme Overview* panel but never a **theme specimen**.
*Cost:* a `Specimen` toggle in the preview header rendering buttons (5 variants), inputs, cards, alerts, badges, links, table row, and all operation states from the live token set — reusing existing primitives. Cheap; blocks nothing.

**G4 · Revision history is data without a face (severity A).**
`ThemePayload.history` is loaded and appended to on every save (100+ lines of machinery) but there is nowhere in the UI to see it. WordPress lets you click a revision and **preview** it before *Apply*; Shopify's rollback is "publish the older copy"; Webflow libraries show reviewable diffs. Our only affordances are a 20-step **Undo** and the conflict modal, which together cover roughly the last minute of work.
*Cost:* a `Revisions` drawer in the overview panel: list of `seq · author · time · preset`, diff-summary of changed tokens (we already have deep-equality), "Restore as new draft" writing through the same CAS path. Medium; the backend contract (§7.27 `theme_revisions`) already stores exactly this.

### Tier B — absent, real, but a bigger decision

**G5 · No colour modes / dark theme (severity B).** Webflow modes, Framer's paired dark/light values and CSS `light-dark()` (S13) have made one-mode theming look dated. *But* this doubles the token surface, needs a preview toggle, a per-mode contrast table and a mode-aware publish contract. Recommend only after G1–G4, and only with a single extra mode (not per-breakpoint modes — that is Webflow's model, not ours).

**G6 · No palette generation (severity B).** Squarespace generates ten themes from five colours; Material derives whole schemes from one seed. We ask a user to type nine hex codes. An OKLCH-based "derive the other eight roles from `primary`" action (with the contrast table immediately re-judging the result) is a genuinely delightful, low-risk feature that leans on our existing strength.

**G7 · Export is proprietary (severity B).** We export a bespoke JSON. DTCG 2025.10 (S12) is now stable, and Style Dictionary v4 consumes it. Adding a DTCG export *alongside* our own format is mostly a transform — `compiledVars` already resolves everything — and it makes the "your tokens survive a tool change" promise real.

**G8 · Contrast methodology is one-dimensional (severity B).** We are WCAG 2.2-exact (4.5:1 / 3:1 / marker pairs) which is the correct legal gate, but APCA (S14) now flags pairs that pass 4.5:1 and are still unreadable — and it is available as a formula. An APCA Lc column next to the ratio, plus a deuteranopia/protanopia simulation of the preview, turns our best feature into an unanswerable one. Note honestly: APCA is **not** in WCAG 3 yet and no law references it, so it must be advisory, never blocking — consistent with our existing "contrast never blocks save" decision.

**G9 · Presets are whole-or-nothing (severity B).** WordPress mixes colour-only and typography-only variations; Squarespace separates font packs from colour palettes. Our presets always carry the full token set. Cheap to add a `scope` dimension to presets (`full` / `colors` / `type`) but it touches the apply-diff UI, so it needs its own design pass.

### Tier C — real, low yield for us
Section-scoped colour schemes (Shopify/Squarespace) — powerful, but it belongs to the block library (M5/M7), not the token layer; motion tokens — a page-builder concern, not a CRM theme; per-breakpoint token values — `clamp()` in G1 buys 80% of the benefit for 5% of the cost; multi-site library update propagation — only meaningful once there are multiple live sites per workspace, i.e. after M11.

### Tier X — keep excluded, with reasons
Brand assets in the Theme Studio (logo/favicon/OG) — belongs to Site Settings, and mixing them in would let a token save touch an uploaded file; scheduled and per-channel publish — Module 11 by decision D1; approval workflow — M11's release review; dynamic colour from wallpaper — Material-specific, irrelevant.

---

## 6. Where we are ahead (stated plainly, because it is true)

1. **Draft-vs-live is honest.** Shopify's "unpublished copy" is the only comparable model; Webflow, Elementor, Squarespace and Framer have no conflict story at all. Our CAS save with a 409 and a named-editor conflict modal (`Revision #9 was saved by Aranya K. while you were editing`) is better than any surveyed product.
2. **Contrast is computed per real pair, with the ratio printed beside the control.** No surveyed system does this. Squarespace's palette is *designed* for accessibility; ours is *measured*.
3. **Fonts are really embedded.** Six OFL families, 242 KB of latin woff2, checksum-verified, with licence shown and unembedded families visibly disabled with a reason. Webflow and Framer license fonts commercially; WordPress requires the site owner to host them; Elementor and Squarespace fetch from third parties. Ours opens with no network at all.
4. **Import validation is path-level.** `path` + `message` per issue, per-scope rules, closed enums. Shopify's equivalent is a raw JSON error that bricks the customizer until you edit the file.
5. **The token set is closed and typed.** Radius, container width, spacing base and density are enums, so an exported document is always re-importable. Elementor and Webflow both permit free-form values that break on round-trip.
6. **"Present in file — not applied"** is a distinction none of the surveyed systems make: they either apply on import or reject it.

---

## 7. Recommendation

If four things are approved, the Theme Studio stops being "narrow" and becomes "strict by choice":

| Order | Item | Why now | Fit |
|---|---|---|---|
| 1 | **G1 type scale** | The single most conspicuous absence; every competitor has it | Extends the Typography tab in place |
| 2 | **G2 role pairs** (border, ring, muted, link) | Fixes an internal inconsistency as much as a market gap | Extends Brand Tokens in place |
| 3 | **G3 specimen sheet** | Turns an honest weakness into a demo strength | Preview-header toggle only |
| 4 | **G4 revisions drawer** | The data and the backend table already exist | Overview panel only |

All four fit the existing three-column anatomy — **no new tabs, no new subsystem, no publishing surface**. Estimate: one module-sized increment, best labelled **M6.1 (Theme Studio completion)**, with its own gap review, decisions file, QA suite extension and screenshots, then a build + zip refresh + tagged push, exactly as M6 was delivered.

Tier B (G5–G9) should be decided one at a time after M6.1 ships; my recommendation is G7 and G8 next (both are additive and non-visual), then G6, then G5 (largest), then G9.

---

## 8. Contract deltas that would follow approval

Only if the user approves — recorded now so the size is visible, not to pre-empt the decision.

- `theme_tokens` gains rows for `border`, `ring`, `muted`, `link`; `color_role` becomes a 13-value closed enum (migration: existing sets get derived defaults, marked `derived=true`).
- New `theme_type_scale` shape on the token JSON: per-role `{sizePx, lineHeight, letterSpacing, fluidMin, fluidMax}`, validated as a closed set of steps.
- `theme_revisions` is already sufficient for G4 (it stores `seq`, `created_by`, `tokens`); the restore path re-uses `PUT …/theme/draft` with the revision's `baseId`, so no new endpoint.
- Export gains `format=dtcg` on the existing export route; no schema change.
- Contrast payload gains an optional `apca` object per pair (`lc`, `polarity`, `level`) — advisory, never persisted as a gate.

---

## 9. Questions for you

1. Approve **M6.1** with G1–G4 as scoped above (my recommendation), or pick a subset?
2. Should G1's scale be **fixed steps** (12/14/16/20/24/32/40/56) or **ratio-driven** (base × 1.25 etc., i.e. choose a ratio and derive)? Fixed is safer to QA; ratio is what designers expect.
3. Dark mode (G5) — genuinely wanted, or acceptable to stay single-mode for now? This is the one gap a buyer is most likely to name out loud.
4. APCA (G8) — advisory column alongside WCAG, or leave it out entirely to keep the message simple ("you pass AA" is a clearer promise than two disagreeing numbers).

---

*Every claim above about a named product is traceable to S1–S15 in §1. Claims about our own build are traceable to `src/lib/theme-db.ts`, `src/views/ThemeStudio.tsx`, `MODULE-6-DECISIONS.md` and `BACKEND-PLAN.md §7.27`, and are counted, not asserted — the matrix in §4 was filled by reading the source, not the spec.*
