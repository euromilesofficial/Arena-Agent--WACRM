# Module 4 — Visual Builder: review before build

**Input reviewed:** the v1.0 spec (26 sections) + `EuroMiles Study Abroad Visual Builder.webp` (1672×941) + the 10 tab renders (Blocks, Sections, Pages, Content, Style, Advanced, hero variants, content/features/CTA libraries).
**Verdict:** the most complete spec of the four, and the most buildable *because* of §23 — it pre-answers its own mock/spec conflicts. What it still lacks is (a) three arithmetic/label errors, (b) six rules that are named but never defined, (c) twelve states a real editor hits in the first week, and (d) every wire into Modules 1–3. Nothing needs a redesign; it needs ~14 decisions named out loud and about a dozen additions. My read of the visual: the spacing is good and I'll take it as-is (three panels, 8px gutters, 1px lines, 12px card rhythm).

---

## A. Contract defects — fix before code, not during

| # | Where | Problem | Correction |
| --- | --- | --- | --- |
| A1 | §5.4 | **Content is labelled "(9)" and then lists 10** — Text, Heading, List, Table, Quote, Alert, Feature Grid, Pricing, Testimonials, FAQ. | Content = **10**. Chips must render a **computed** count (`All 20 · Content 10 · Media 2 · Layout 5 · Form 3`), never a typed label. The spec's own sum (10+2+5+3=20) is right; only the label is wrong. |
| A2 | §5.3 vs §5.4 vs mock | **Hero and Footer are archetypes #13/#20 but appear nowhere in the Blocks palette** in the mock. Either the palette lies or the registry does. | Pick one: **Hero stays a block** (it is literally what the mock's canvas shows as a selected section — you must be able to insert a second one mid-page); **Footer is not a palette tile** — it belongs to the master layout, and inserting one would fight Layouts & Templates. Registry = 20, palette = 19 + "Footer lives in Layouts & Templates" note. |
| A3 | §5.4 grouping vs chips | Mock's group headers are *Content · Media · **Actions** · Layout · **Form & Engagement***; the chips are *All · Content · Media · Layout · **Form***. So `Button` is filed under "Actions" but filtered by "Form", and `Testimonials` is filed under "Form & Engagement" but classified Content. | Keep the five chips exactly as the mock; derive **one** group-header set from the chip taxonomy and place `Button` under **Actions** only when the active chip is All — i.e. group headers are a presentation of the same enum, not a second taxonomy. `Testimonials` moves to the Content group (it is content, and the spec says so). |
| A4 | §15.4 | "Capped snapshots on idle or every 5 minutes **as specified**" — nothing in the doc specifies it. | Define: snapshot on **idle 60 s** or **every 5 minutes of continuous editing**, whichever first; **cap 50**, drop oldest; restoring a revision creates a *new* revision (never mutates history). |
| A5 | §21 | "cap undo snapshots" — no number, no scope. | **50 operations**, grouped (a text edit burst = 1), **per page**, **cleared on page switch**, and **not** cleared by autosave. Undo never crosses a page boundary — that is what revision history is for. |
| A6 | §4 / §14 | Publish has `disabled` and `validating` states but **no rule for "nothing to publish"**. | If the draft has no unpublished diff against the live release, Publish renders **disabled with the reason** `No unpublished changes on this website` — green, not amber. This is the same honest-empty principle as Module 3's `Analytics not available`. |
| A7 | §16.2 | The builder "delegates to the publishing pipeline" but never says **what happens to unsaved edits** when Publish is pressed. | Publish **forces a save first**; if the save fails or hits CAS, publish is blocked with `Save your changes before publishing` + Retry. Never publish a manifest that excludes what is on screen. |

---

## B. Decisions I need from you (defaults are what I'll build)

| # | Decision | Options | My recommendation |
| --- | --- | --- | --- |
| **D1** | Library tabs | 3 tabs (mock) vs blueprint's Page Structure Tree + Block Library | **3 tabs** as the mock, with **Current Page Structure inside Pages** (spec §5.1 already resolves this). No fourth rail. |
| **D2** | Archetype count | 20 with Hero+Footer in the palette, or 19 (+Footer moved out) | **20 registered, 19 offered** (see A2). Variants (`Rich Text`, `Divider/Spacer`) are visible labels, one registry each. |
| **D3** | Advanced tab | Spec defers 4 of 7 groups; the mock shows them live | **Render all seven groups; 5 live, 2 locked with a reason.** Live: Anchor ID, Responsive visibility, Animation, ARIA label/description, Layout behaviour. Locked (visible, disabled, one-line why): *Visibility rules* → "Needs the audience-rule engine (Phase 2)"; *Custom attributes / Analytics / Schema* → "Needs a consent + telemetry contract". Hiding them would break mock fidelity; enabling them would be a lie. |
| **D4** | Publish | Builder-local publish vs hand off to Module 1's release wizard | **Hand off to the one pipeline.** Builder's Publish opens the Module 1 preflight with this site pre-selected and a "N pages with unpublished changes" banner that names the page you are editing. One publish path in the product, not two. |
| **D5** | Preview | New tab (spec) vs the sandboxed preview modal Module 3 already ships | **The Module 3 modal.** A `file://` build cannot carry an auth token to a new tab; the modal already models signing, 15-minute expiry and "not tracked". One preview component, reused. |
| **D6** | Canvas isolation | Spec §8.1 mandates a sandboxed iframe + postMessage | **In-document canvas with a scoped root** (`.wb-canvas`), documented as the single deliberate deviation. Reason: a second React root inside a `srcdoc` frame doubles the bundle's runtime cost and buys nothing in a build where **no user script can exist** (we never accept raw HTML). The security *behaviour* is kept: props are schema-validated, no arbitrary HTML/CSS/JS path exists, and the preview is a separate signed surface. The iframe + RPC boundary stays in `BACKEND-PLAN.md` as the production contract. **Say no if you want the real frame** — it costs about a day and some bundle weight. |
| **D7** | Sample imagery | (a) generated abstract art everywhere, (b) 5 inlined generated photos | **(b)** — the mock's fidelity *is* the photography. I'll generate hero + 4 destination images at build time, inline them as JPEG data URIs (~250 KB total), and label them `sample asset` in the Media panel so nobody mistakes them for client-owned. Total build stays ≈ 1 MB. |
| **D8** | Drag-and-drop | Drag only (mock) vs drag + click-to-insert + keyboard | **All three**, as the spec asks: drag with violet insertion guides and a no-drop reason, click inserts after selection, `Enter` on a palette card opens *Before / After / Inside* with only legal options. Drag is the highest-risk part of this module; the keyboard path is what makes it testable and accessible. |
| **D9** | Autosave | 2 s debounce (spec) | **2 s, as written**, with CAS. Save failure keeps local edits and shows `Save failed · Retry`; the conflict modal is reachable on demand through the existing *Prototype states* menu (the flag I added in Module 3 already forces a stale save). |
| **D10** | Nesting limits | Spec is silent | **Section → (Container \| Columns) → max 2 layout levels**, i.e. no Columns inside Columns inside Columns. Illegal drops explain themselves; depth is enforced in the validator *and* the palette. Without a cap this screen becomes an Easter egg. |
| **D11** | Master layout band | The mock's header (Home / Study Abroad / Scholarships / About / Contact / Enquire Now) is part of the page render | **Render it as a non-selectable band** with a hover chip `Master layout · edit in Layouts & Templates`. Users *will* click the nav; the honest answer is better than a dead selection or a fake editor. |
| **D12** | Copy in seeded content | Mock copy contains claims (`500+ Partner Universities`, `15,000+ Students Guided`, `98% Visa Success Rate`) | Keep the copy (it is the site's own marketing page) but **mark the numbers as editor-supplied** in the Trust Highlights template and never let a *template* insert them — templates ship neutral placeholders, the seeded Study Abroad page carries the real text. |
| **D13** | Deep links | Module 3 already ships `#/pages?…` | `#/builder?site=&page=&sel=&lib=&insp=` — page, selected block, library tab, inspector tab — restored on cold load, kept in sync. This is also how Module 3's **Edit Page** lands here. |

---

## C. Gaps a user hits in the first week (none of these are in the spec)

| # | Gap | Why it bites | Fix (cheap) |
| --- | --- | --- | --- |
| **C1** | **Empty canvas.** A page with zero blocks has no defined state. | Every new page starts here. A blank white stage with no affordance reads as broken. | Centre drop zone: `Add your first block, or start from a section` + `Browse sections` / `Use a page template`. The palette and the stage are both live drop targets. |
| **C2** | **Save failed, then switch page.** Spec offers *Keep editing / Wait for save / Discard* — but if the save *failed*, "wait" is a lie. | Users lose work with a dialog that pretends the network is fine. | Third state: `Retry save` is the primary action; *Leave anyway* is secondary and says exactly what will be lost (the last N edits since the acknowledged revision). |
| **C3** | **Undo after autosave.** Undo is local, but a save may already be in flight or acknowledged. | Undo can visually revert the canvas while the server holds the newer document — then the next reload resurrects the "undone" edit. | Every autosave completion is an **undo checkpoint**; undo after a save issues a **new** save with the older document and a newer revision. The status pill never says `Draft saved` while the canvas is dirty. |
| **C4** | **Publishing while another page is dirty.** Releases are site-level: publishing ships *other* pages' unpublished changes too. | Silent scope expansion — the classic "I only edited one page" incident. | Preflight lists every page in the manifest, with the current page first and the others collapsed under `+3 more pages`. No opt-out in Phase 1 (that is correct — a release is atomic), but never silent. |
| **C5** | **Media asset deleted while referenced.** Spec covers retention for *live* releases only. | The canvas silently renders a broken image; the editor has no idea why. | Block renders a red placeholder with `Asset unavailable` + `Replace`; preflight blocks publish and names the page/block. Media panel shows the reference count. |
| **C6** | **No forms on this website.** Lead Form block exists; the picker has nothing to pick. | Dead-end inspector. | Empty state in the picker: `No forms yet · Create a form in Forms & Leads` (link), and the block itself renders a labelled placeholder rather than a fake form. |
| **C7** | **Zoom × device.** 125 % zoom on a 375 px mobile canvas does not fit a 1440 stage. | The mobile preview becomes unusable exactly when the user is checking mobile. | Stage scrolls with `Fit` as the default when the scaled width exceeds the stage; zoom clamps to the legal set and `Fit` recomputes on resize. |
| **C8** | **Deleted page while open in the builder.** | The editor keeps saving into the void, or 404s mid-keystroke. | Save returns `NOT_FOUND` → blocking state `This page was deleted` with `Back to Pages`; the draft in memory is offered as *Copy blocks* so the work isn't lost. |
| **C9** | **AI accept on a button whose label is also its link.** | Accept could look like it changed the destination. | AI is scoped to the **text prop only**; the LinkRef is rendered beside the candidate as a non-editable chip (`links to /programs`) so the boundary is visible. |
| **C10** | **Template with a missing dependency** (spec §11.3) has no *insert* path — only "map or cancel". | Users abandon the template entirely for one missing image. | Mapping dialog offers **Choose replacement · Remove this element · Cancel**, and `Remove this element` is preselected for optional elements. |
| **C11** | **Structure tree vs canvas scroll.** Clicking a row must scroll the canvas; scrolling the canvas must not steal the selection. | Two-way sync is where builders usually feel broken. | One-way rule made explicit: tree click → scroll+select; canvas scroll → highlight the tree row but **never** change selection. |
| **C12** | **`Reset to inherited` is mentioned but has no visible state.** | Users can't tell an override from an inherited token, so they over-edit. | Every style control renders `Inherited` (grey, value ghosted) vs `Override` (violet dot) with a one-click reset that only appears when overridden. |

---

## D. Interconnections — what must be wired to Modules 1–3 (this is the part the spec cannot know)

| From | To | Wire |
| --- | --- | --- |
| Module 3 *Edit Page* (row pencil, inspector `Edit Page`, builder handoff) | Builder | Replace the Module 3 placeholder handoff screen with a real route into the builder: `#/builder?site=<id>&page=<pageId>`. The 3 handoff checks in `qa_pages.py` get rewritten to assert navigation + correct page loaded. |
| Module 3 `DB.cmsPages` | Builder page selector | The selector lists **real pages** of the selected website (drafts included, trashed excluded), not a fixture list. |
| Builder save | Module 3 page record | Each acknowledged save sets `page.hasChanges = true`, `page.updated = 'Just now'`, `page.blocks = section count`, and writes `DB.pageDrafts[pageId] = {blocks, revision, savedAt, savedBy}`. The amber **Unpublished changes** chip on Pages must react to it — that is the cheapest end-to-end proof that this is one database. |
| Builder **Publish** | Module 1 release wizard | One pipeline: preflight → manifest → CAS → `Release v1.25 is live`. Builder passes the site + the current page as the manifest head. On success: `hasChanges = false` for every published page, `site.release` bumps, Pages and Overview both re-read. |
| Builder **Preview** | Module 3 `PreviewModal` | Same signed-token component, same 15-minute expiry, same `noindex` copy. Nothing new to build. |
| Link picker → *Pages* tab | Module 3 page list | Resolves `{kind:'page', id}` against live pages; a deleted target renders `Broken link` in the canvas **and** blocks preflight (spec §9.2/§16.2). |
| Media picker | Shared `DB.assets` | One asset store with `id, name, w, h, size, dataUri, usage[]`. The retention rule ("don't delete an asset a live release uses") is a guard in the delete path, not a copy in the builder. |
| Lead Form block | `DB.forms` | The inspector picks an **existing form id**; no ad-hoc form schema in this screen (spec §9.2 is right). Empty state links to Forms & Leads. |
| Style tab tokens | `DB.theme` | Fonts, colours, radii, spacing scale, container widths come from **one** token set that Theme Studio will later edit. Every control shows `Inherited` vs `Override`. Hard-coding hexes in the inspector would make Theme Studio impossible to build. |
| Master layout band | Layouts & Templates (Module 5) | Header/footer render from `DB.layouts`, non-selectable, with the "edit in Layouts & Templates" chip. |
| Module 1 *Dashboard* | Builder | `pages` KPI and *Site Health* must reflect builder drafts (`hasChanges` counts), not a static number. |
| Notifications | Builder | `Page X has unpublished changes` and the CAS conflict event route to `#/builder?page=…`. |

**One contract change I'd make:** `CmsPage.revision` (Module 3) stays the **metadata** CAS token; the builder introduces `pageDrafts[pageId].revision` as the **document** CAS token. Two editors changing a title and a headline must not collide, and a title edit must not invalidate an open canvas. The conflict modal and the preflight read the document revision; the Pages edit-details modal reads the metadata revision. I'll document both in `BACKEND-PLAN §9` rather than overloading one counter.

---

## E. What the mock shows that must not ship as a live control

| Mock element | Treatment | Why |
| --- | --- | --- |
| *Visibility rules* (`Show when · Visitor type is Anonymous · + Add Rule`) | Visible, collapsed, **locked** | Audience targeting needs a rule engine + privacy review. |
| *Custom attributes* (`data-section`, `data-campaign`) | Visible, **locked** | Arbitrary attributes are not typed props. |
| *Analytics & tracking* (tag, track impression, track clicks) | Visible, **locked** | No consent/telemetry contract exists. |
| *Schema & SEO metadata* (schema type, about, + property) | Visible, **locked** | Site-level SEO belongs to SEO & Redirects. |
| *Sticky bottom CTA* section template | Present, insertable, **sticky toggle disabled** | Sticky positioning is a renderer capability we have not committed to. |
| *Video background* | `Video` disabled in Background type with a reason | Performance/consent; §9.3 allows deferring it. |
| Free-form px inputs (`Margin 24 / 0 / 16 / 0`) | **Snap-step** controls over the token scale (0,4,8,12,16,24,32,48,64,96) | The numbers stay visible; arbitrary CSS does not. |
| `In-Page Navigation Label` | Live, but footer note: *metadata only — it does not add a menu item* | Otherwise users file a bug against Menus & Navigation. |

Everything else in the ten tab renders is buildable as drawn: the block grid, section cards with `Preview / + Insert`, page templates with `Preview / + Use Template`, the page-structure list, the four-icon context toolbar, the AI bubble with `Make Punchier / Shorten`, and the Content/Style/Advanced layouts.

---

## F. What I will build (finite contract)

**One screen, three panels, no fourth rail, no chat sidebar.**

- **Header** — breadcrumb (`Visual Builder` is `aria-current`), website selector, page selector (real pages, searchable), `Preview`, violet `Publish` split button (Review & Publish · Compare with Live · Release History).
- **Status strip above the canvas** — `Draft saved / Unsaved changes / Saving… / Save failed / Conflict` (green only for acknowledged saves), Desktop·Tablet·Mobile, undo/redo, zoom `50/75/100/125/Fit`, fullscreen.
- **Left library (272 px at 1440)** — `Blocks | Sections | Pages`, per-tab search + chips + scroll retained; Blocks = 19 offered archetypes in 5 chips with computed counts; Sections = 23 configurations in 5 categories (Hero 5 · Content 6 · Features 6 · CTA 6), each with non-mutating preview and `+ Insert`; Pages = 5 templates + Saved Pages + a collapsible **Current Page Structure** tree (sections → blocks, one level) that follows the canvas.
- **Stage** — scoped canvas, master-layout band, selectable blocks with violet outline + handles + 4-icon context toolbar, nested text selection with the AI bubble, device morph 1440/768/375, real drag with insertion guides and refusal reasons, and an empty-canvas state.
- **Inspector (332 px)** — `Content | Style | Advanced`, generated from the block registry: Content fields per block (with the link picker: Pages · External URL · Assets), Style as token-bounded controls with `Inherited/Override`, Advanced with 5 live groups + 4 locked.
- **AI Copy** — simulated stream (~1.2 s, token-by-token into an overlay, never into the draft), `Accept / Regenerate / Discard`, `Esc` aborts, one undo unit on accept, quota + provider + deleted-selection states.
- **Persistence** — 2 s debounced autosave, CAS conflict modal (Reload theirs / Keep mine / Cancel, with the no-data-loss rule), revision history with block-level diff + Restore, soft presence banner.
- **States** — every row of the spec's §14 matrix plus C1–C12 above, each reachable by hand and by the harness.
- **A11y** — tree/tab/menu/dialog roles, roving tabindex, keyboard insert + reorder (`Move up/down/into/out`), focus return, reduced-motion, no colour-only signals.

**Explicit non-goals** (unchanged from spec §1 and §23): raw HTML/CSS/JS, audience rule engine, arbitrary attributes, analytics toggles, page-level SEO editor, marketplace, repeaters/collections, scheduled publishing, staging, per-page live switch, video background, sticky CTA, multi-user live co-editing.

**Build order** (5 slices, each reviewable on its own, all inside one module):
1. Skeleton + registry + canvas render of the seeded Study Abroad page + selection/inspector shell.
2. Inspector tabs (Content/Style/Advanced) + link/media pickers + token system.
3. Library: blocks with drag/keyboard insert, sections with preview/insert, pages with templates + structure tree.
4. Autosave/CAS/conflict/history/presence + AI Copy + preview/publish handoff.
5. States, keyboard/a11y pass, QA harness, screenshots, docs.

---

## G. What I'll add to the backend contract

`BACKEND-PLAN.md §9` gets one row per element, like §7.18: `GET /v1/pages/{id}/draft`, `PATCH /v1/pages/{id}/draft` (`If-Match: draftRevision`), `GET /v1/pages/{id}/revisions`, `POST …/revisions/{rev}:restore`, `GET /v1/library/blocks|sections|page-templates`, `POST /v1/library/sections` (save-as-template), `DELETE /v1/library/sections/{id}`, `POST /v1/ai/copy:stream` (SSE), `POST /v1/pages/{id}:preview`, plus the iframe RPC boundary and the draft-revision CAS rule from §D. The block registry schema (`BlockNode` + per-type Zod) is documented there as the single source of truth both the editor and the (future) SSR renderer read.

---

## H. Verification plan

| Harness | Scope | Target |
| --- | --- | --- |
| `qa_builder.py` | geometry at 1280/1440/1920, 3 library tabs, 19 archetypes + counts, insert via click and keyboard, drag insert + refusal, reorder, delete/duplicate, selection ↔ tree sync, all three inspector tabs, every Content control of the hero, Style token bounds, Advanced lock reasons, device morph widths, zoom, undo/redo across 5 operation types, autosave cycle, publish handoff, link/media pickers, template insert, structure tree | ~95 checks |
| `qa_states_m4.py` | loading, empty page, no pages, no websites, viewer, save failed, CAS conflict, offline, AI streaming/ready/quota/error/cancel, template empty/error/missing-dependency, asset unavailable, form-less picker, deleted page, publish blocked/published, reduced motion, keyboard-only path | ~45 checks |
| Regressions | `qa_pages.py` 105 (3 handoff checks rewritten), `qa_states_m3.py` 40, `qa_module2.py` 48, `qa_states_m1.py` 39, `qa_flows.py` 38 | all green |

---

## I. The three things I need from you

1. **D6** — in-document canvas (my default, cheaper, honest for a no-script build) or the literal sandboxed iframe from §8.1?
2. **D3** — Advanced tab: four groups visible-but-locked (my default, mock-faithful) or hidden entirely?
3. **D7** — five generated photos inlined as sample assets (my default, mock fidelity, +250 KB) or abstract art only?

Everything else is decided above with a default I can defend, so building starts the moment you answer — one commit, `qa_builder.py` + `qa_states_m4.py` green, tag `module-4-complete`, same as Modules 2 and 3.

---

### Note on the repository
Module 3 is committed locally (`d32dfc1`, `module-3-complete` pending) and still needs the PAT to push. This review will ride on top of it as its own commit.
