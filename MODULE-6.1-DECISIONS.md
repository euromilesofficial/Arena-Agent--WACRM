# Module 6.1 — decisions

Numbered to continue from Module 6 (D1–D16). Each one is a fork the build had to settle; anything the user rejects is reversible in isolation.

## Inherited rules this module had to respect

Publish is Module 11 (M6 D1) · contrast never blocks save (D11) · the working copy is real and the preview is honest (D14) · no unrequested subsystems · the artifact opens with **no network**.

---

## D1 — "Almost all Google Fonts" is resolved as *247 embedded + 1,746 indexed*, not as 1,746 embedded

All of Google Fonts as latin woff2 is ≈70 MB before base64. A single HTML file that must double-click open cannot carry that, and a 70 MB page would not be a SaaS-grade artifact.

**Decision:** embed as many as the byte budget allows (10.5 MB of woff2 → 247 families, variable-first so one file covers 100–900), and index **every** family Google publishes with real metadata. Non-embedded rows are visible, searchable, locked, and state the reason. The budget is a flag (`--budget=`) so it can be raised, and the generator is deterministic.

**Rejected:** shipping fonts as sibling files in the zip (breaks the single-file guarantee, and `dist/index.html` must stand alone); CDN `@import` (breaks the no-network rule); silently dropping the long tail (the user asked for it explicitly).

## D2 — Selection is Google popularity order, not a hand-picked list

A hand-curated set would encode my taste. Popularity order is verifiable, reproducible and defensible in a review. Two exceptions are forced: the six M6 families and the three previously-disabled ones are pinned to the front so no existing document breaks, and brand fonts are excluded outright (D3).

## D3 — Brand fonts are excluded twice

`Google Sans`, `Product Sans`, `Google Symbols`, `Material Symbols/Icons` ship through the Google Fonts API but are not licensed for redistribution into another product. The metadata flag `isBrandFont` catches most of them; **Google Sans ships with the flag unset**, so an explicit denylist runs as well. 212 flagged + 3 denylisted families are absent from the index entirely — not listed-and-locked, absent.

## D4 — Faces are injected lazily, per family

M6 injected all faces on mount; with 247 families that is a 14 MB stylesheet built before the first interaction. 6.1 registers a family the first time something asks for it (the chosen pair, plus the visible window of the picker). QA asserts the face is genuinely registered (`document.fonts.check`) and not merely named in a style rule.

## D5 — The divider role is measured against an **advisory 1.5:1 floor**, not WCAG 1.4.11's 3:1

WCAG requires 3:1 for a boundary that *identifies a control*; decorative rules are exempt. Holding cards and dividers to 3:1 would default the whole design system to wireframe weights. So `border` is measured against a legibility floor, the row is labelled `advisory`, and the hint explains the exemption in the same breath. `ring` (the focus indicator) **is** held to 3:1 because that is a control boundary.

## D6 — `link` became a real role and the audit changed with it

M6 measured `link-on-bg` against `primary` while no link token existed — the editor and the audit disagreed. Now `link` is a token, measured from itself, so a brand-coloured button and a readable text link can diverge (which is the normal case). `primary` no longer carries a 4.5:1 text obligation it cannot always meet.

## D7 — Type sizes are derived, never stored

Six numbers per theme invite drift. The document stores a base, a ratio, two leadings, two trackings and a fluid flag; the six sizes are computed. Consequence: import validation only has to range-check seven scalars, and a preset cannot carry a broken ramp.

## D8 — Fluid applies to h1–h3 only

`clamp()` on body copy is how pages end up with 13 px text on phones. Headings breathe; body stays put.

## D9 — The specimen renders 1:1 at the studio's width, not inside the 1440 px device frame

Scaled to fit, the specimen was 42% — 6 px labels, unreadable, and a specimen that cannot be read is not a specimen. Desktop therefore renders the specimen at the stage width; tablet and phone still constrain it. The stage note changes to *rendered at studio width* so the number never lies.

## D10 — Restore does not save

A restore that wrote a revision would be the only action in the module that changes stored state without a press of Save, which would break the module's central guarantee. Restore fills the working copy, marks it dirty, and pushes an undo entry. The toast says exactly what happened and what is still required.

## D11 — The seed history is now five real revisions

With two revisions (`live`, `draft`) a diff table shows nothing, and a feature that cannot demonstrate itself reads as decoration. `#3`–`#5` are real progressions (violet swap → radius + Poppins → back to Geist with a 1.333/17 px scale). `#6` live and `#7` draft are unchanged, so every existing QA assumption and the publish hand-off still hold.

## D12 — Document version 2, with a stated migration

Adding four roles and a scale object to `schemaVersion: 1` would make old files unreadable. Instead: export writes 2, import reads 1 and 2, and a v1 file gets derived roles plus a default scale **with a warning naming every derived field**. Derived values are never presented as if they came from the file.

## D13 — The picker defaults to embedded-only

The honest default is "show me what this build can actually render". The full index is one toggle away and the footer states the split. A user who wants Roboto gets Roboto in the first 60 rows without knowing anything about bytes.

## D14 — 212 brand-font families are removed from the index rather than listed

Listing them as "requires ingestion" would imply we could ingest them. We could not, legally. Absent is the truthful state.

## D15 — Licence text is per family where known, generic where not

`FONT-LICENSES.md` records OFL 1.1 for the vast majority, Apache 2.0 for the Roboto/Arimo/Tinos/Cousine family of faces and UFL 1.0 for Ubuntu. Every row carries a designer and a size, and the file states plainly that italic and latin-ext are **not** embedded.
