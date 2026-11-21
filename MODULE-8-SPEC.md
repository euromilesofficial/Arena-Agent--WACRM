# Module 8 · Menus & Navigation — specification (v1.1 working copy)

**Status:** owner-approved spec **v1.1**, §31 mandatory for production acceptance and superseding earlier conditional wording.
§§1–30 are the design contract. §31 is the acceptance list.

> **Honest note on this file.** The verbatim v1.1 text was pasted into the conversation and was not saved to the workspace
> before this revision. This file is a working copy written from the approval record: the §31 capabilities, the placement rule,
> the footer rule, the exclusions and the decisions that follow from them. The owner should re-paste the exact v1.1 text so it can
> replace this copy section by section. Where this file and the approved text differ, the approved text governs.

Reference mockups: `uploads/Module 8_ Menus & Navigation UI-3.webp`, `uploads/SaaS Menus and Navigation Dashboard-2.webp`,
`uploads/WACRM Menus & Navigation Dashboard-1.webp`. Earlier v2 decisions D-M8-1..12 and the v2 mockup inventory (M1–M14) are kept
in `MODULE-8-SPEC.md` history (git `3b646ff`). Decisions D-M8-13..16 still stand. **D-M8-17 is superseded by §31.3** (see below).

## 1. Experience

WordPress-familiar ease on a WACRM-native foundation. This is not a plugin or database clone.
Default flow: **add left, organise centre, configure right, preview below**. No top-level tabs added just to expose features.

## 2. §31.1 — eleven required capabilities

| # | Capability | Built | Where / how it is verified |
|---|---|---|---|
| 1 | Multiple menus (up to 12 per website) | Yes | Manage Menus, menu picker; limit enforced in `createMenu` |
| 2 | Add pages and custom links | Yes | Add Items column; custom link validated by `urlOk` (U15–U18) |
| 3 | Custom labels | Yes | Item Settings → Label; unique label per row |
| 4 | Drag and keyboard reorder | Yes | Grip drag among siblings; Alt+↑/↓ reorder; Alt+Shift+←/→ level (B6, B7) |
| 5 | Nested dropdowns to level 3 | Yes | `MENU_LIMITS.maxDepth = 3`; indent refused past the limit (U19–U22) |
| 6 | Header and footer assignment | Yes, per layout slot | Layout slots, see §31.3 (U1, U2, U6) |
| 7 | Mega builder, 2–4 columns | Yes | Mega Menus tab; featured card; column gap |
| 8 | Mobile drawer and accordion below 1024 px | Yes, in the preview | Tablet and phone preview use the drawer (B8). The live site header is still a flat `nav`; see §5 |
| 9 | Draft and live separation | Yes | Save Draft writes drafts; Publish copies them live as a numbered version (U9) |
| 10 | Link validation with blocking | Yes | Validate Links; Publish blocked on errors; release gate blocks on broken menu refs (§4) |
| 11 | Rollback | Yes, as a new version | Rollback restores menus and placements together (U10, U11) |

## 3. §31.2 — create and manage menus

Create Menu takes a name, a type (Main, Footer, Utility) and a description. Duplicate, Delete and Edit are on each row.
Delete is refused while a menu is placed in a layout slot or compiled into one (U12, U13). Its Settings → Danger zone shows
the same guard (B9). Copy uses plain words: "Move this menu out of its slots first."

## 4. §31.3 — placements (decision replaces D-M8-17)

- **Layouts & Templates owns the slot bindings.** A binding is `layout_id`, `slot_key` (`header` | `footer`) and `menu_id`,
  all site-scoped. There is no independent menu location field.
- **Manage Placements** in Menus is a shortcut that edits the same bindings.
- Placement edits are a draft, saved with **Save Placement Draft** (toast `Navigation placement saved as draft.`) and go live
  with Publish (U6, B5).
- Replacing an occupied slot asks first: **Replace in Draft** (B2–B4).
- **Unassigning a layout's header is refused** unless the layout shows no navigation (U4). The header select has no empty option (B1).
- **One menu may fill many slots** across compatible layouts. One menu per single-menu slot per layout revision.
  This supersedes D-M8-17 ("one placement per location per menu").
- **One header or footer design cannot show two different menus.** If two layouts share a design and place different menus,
  the release gate blocks publishing and asks for a separate design.
- Footer menus render as footer navigation only. They are not used as mobile header content. A separate mobile menu is deferred.
- The utility location has no layout slot yet. Utility menus can be created and edited but are shown as unassigned.

## 5. §31.4 — item editing, parent disclosure, custom-link validation

- A parent with children is not a link on mobile. It opens to show its children (drawer and accordion).
- Custom links accept `https://`, `http://`, `mailto:` and `tel:`. Refused: embedded credentials, protocol-relative `//`, `javascript:`,
  and whitespace in web addresses (U15–U18). The message is "Address not allowed. Use https://, http://, mailto: or tel:."
- The live site header is a flat `nav` of top-level labels. Dropdowns and mega panels show in the preview and in the menu, and are
  omitted from the header with a note at apply time. This is the current chrome limit.

## 6. §31.5 — draft and rollback

- Save Draft writes menus and mega panels. Save Placement Draft writes bindings. Publish writes both live as one numbered version.
- Publish compiles each live menu into the layout slots that place it. Each header or footer variant records a `menuRef`
  (`menuId`, `name`, `liveRev`). The Layouts header modal shows the menu, its sync state, and an Edit in Menus link.
- Rollback publishes an older version as a new version. It restores menus, mega panels and bindings together, and it
  recompiles the chrome (U10, U11).
- Chrome status per compiled slot: **current**, **stale** (menu published since it compiled, or the design was edited by hand)
  or **missing** (the variant was removed).

## 7. §31.6–31.7 — behaviour and copy

Copy follows the approved wording where it was quoted. Examples in use: "Navigation placement saved as draft.",
"Publishing is blocked. Fix these menu references in Menus & Navigation first.", "Read-only. Your role can view menus but not
change them.", "Publish changes", "Roll back and publish".

## 8. Release gate (M7 spec L778 and item 5, L854)

- The release modal's check **"No broken menu references"** is live, not a fixed pass. It checks live menus and mega panels for
  broken links, live placements that point at deleted or never-published menus, `menuRef`s to deleted menus, and shared designs
  that place different menus. Freeze manifest is disabled while any of these fail. The store refuses the same release (`publishRelease`).
- Preview pinning: the Menus preview shows the draft and is labelled as a draft. The release snapshot is the numbered version,
  which holds the live menus and bindings. **Partial:** the Layouts preview does not yet pin a menu revision.

## 9. §31.8 — acceptance tests

Mapped to the suites in this repo:

| Test area | Suite |
|---|---|
| Data rules: placements, apply, publish, rollback, delete guards, URL policy, tree operations | `qa_m8_v3.py` U1–U25 |
| Screen: tabs, picker, add items, settings, mega editor, preview, validate, publish, rollback, placements, states | `qa_m8_menus.py` (69) |
| Placement dialog, Replace in Draft, toast, header unassign blocked, keyboard reorder, tablet drawer, settings guard | `qa_m8_v3.py` B1–B10 |
| M7 links and M8 in the release | `qa_m7_links.py` |

## 10. Excluded from Phase 1

Arbitrary HTML, CSS or JS in menus; WordPress plugin compatibility; audience personalisation; separate mobile trees;
scheduled visibility; animation timeline editors; menu-click analytics without a pipeline.

## 11. Open items (not claimed as done)

Closed in the completion pass (see §13). Still open:

- The release modal's DNS, SSL and Core Web Vitals checks were fixed passes. Closed in §16: they now read the release site's domains and the vitals grade.
- §31.8 mapping is approximate until the owner re-pastes the verbatim v1.1 text. The text is not in the workspace, so this cannot be closed here.
- README §18 conflict (M8 "after M11" vs built, sidebar under Manage): owner decision.
- Tablet and mobile layouts: checked by `qa_m8_responsive.py` (no sideways scroll at 1280, 1024 and 768; builder stacks and tablet drawer at 768) and by screenshot at 768 px. Phone width (390 px) is in the QA suite (R9).

## 12. Mockup-to-build mapping (v4 visual pass)

The three mockups are `uploads/Module 8_ Menus & Navigation UI-3.webp` (panels 1–4), `uploads/SaaS Menus and Navigation Dashboard-2.webp` (1 of 3 to 3 of 3) and `uploads/WACRM Menus & Navigation Dashboard-1.webp`. The screen is now five tabs: Menu Builder, Manage Menus, Menu Placements, Mega Menus, Version History. Settings is no longer a tab. Menu settings live in the builder's left panel ("Menu Settings"), as the mockups show.

| Mockup element | Build |
|---|---|
| Title, subtitle, Website selector | Page header; website name shown as a pill (one website per screen) |
| Preview, Save Draft, Publish Changes (count) | Page header; Validate Links beside them |
| KPI strip: Menus, Assigned, Draft (Unpublished), Link Issues, Version History | Five KPI cards; Link Issues opens Validate Links, Version History opens its tab |
| Menu picker with Published (Live)/Draft status and Header/Footer/Utility tags | Builder toolbar picker; each menu shows its slot tags |
| Assigned: Header pill | Builder toolbar pill listing the slots the menu fills |
| Preview Menu, Create Menu | Builder toolbar |
| Add Items: Pages / Custom Link; Pages (n), Landing pages (n), Add to Menu (n) | Left panel; Custom Link is a radio beside Pages |
| Menu Structure: Expand All / Collapse All, Maximum depth warning, type badges, ⋯ menu | Centre panel; depth banner always shown (3 levels) |
| Menu Item Settings: Label, Link To, Behaviour, Visibility, Mega Menu / Advanced tabs | Right panel |
| Mega Menu Layout cards 2/3/4 columns; Column Content list; Add Column | Right panel, Mega Menu tab; changes the attached panel's column count and refuses to drop filled columns |
| Manage Menus table (name, status, used in, updated) | Manage Menus tab |
| Menu Placements (Header (Primary), Footer, Top Bar / Utility, Mobile (Auto)) with Mobile auto-generated note | Manage Menus right card (per layout) and Menu Placements tab. Utility has no slot in layouts yet, so it is shown but not placeable |
| Mega Menus list, panel editor with Layout, Column Gap, Show Featured Content, columns, Featured card | Mega Menus tab. The list sits above the editor; the editor uses full width |
| Navigation Preview (Desktop/Mobile/Tablet) bar with the menu rendered | Builder preview bar below the structure; History tab preview |
| Preview Navigation, Publishing Status (Published Live / Draft changes / View changes), Publish, Validate, View Release History, Rollback to Previous Version | Version History tab left column |
| Version History table (version, summary, published by, date, actions) | Version History tab right column |

### Open gaps (verified, not claimed as done)

- Closed in §15: the Mega Menus editor collapses to two columns at 1366 px and one at 1100 px. The column cards no longer scroll sideways.
- "Custom" column layout (the fourth mockup card) is not offered. Phase 1 uses 2, 3 and 4 columns.
- The Menu Placements tab's Utility row can be seen but not used, because layouts have no utility slot.
- Layouts preview pinning was closed in §13 (`qa_m8_final.py` L4a–d).
- Visual checks were made with screenshots at 1440 px, 1280 px and 768 px.

## 13. Completion pass (gaps closed)

| Gap | Resolution | Evidence |
|---|---|---|
| Layouts owns slot bindings; screen was read-only | Layouts > Regions shows a header menu and a footer menu selector per layout. They write the same placement draft as Menus. Replacing an occupied slot asks first ("Replace in Draft"). The header cannot be set to None. | `qa_m8_final.py` L1a–L3 |
| Layouts preview did not pin a menu revision (M7 spec: pin layout rev, menu rev, tokens) | The preview is captured when it opens. A banner shows the layout revision, the live menu revision and version for the header and footer, and the theme. The header nav and footer groups come from the live placement's menu. Changes made while it is open do not move it. | `qa_m8_final.py` L4a–L4d |
| Footer drawer could overwrite menu-derived groups with typed values | When the footer is menu-bound, the drawer shows its sync state and makes the link columns read-only ("Edit them in Menus & Navigation, then publish"). Save keeps the stored groups. | `qa_m8_final.py` L5a–L5c |
| Git history used 61 MB | `git gc` (no history removed). `.git` went from 61 MB to 33 MB. | `git count-objects`, `git fsck` clean |

Decisions kept:

- The Mega Menu layout cards offer 2, 3 and 4 columns. The mockup's "Custom" card is not offered, because the spec's column limits are 2 to 4 (`MENU_LIMITS`).
- Utility menus can be created and edited but not placed, because layouts have no utility slot.
- Footer menus render as footer navigation only. A separate mobile menu is deferred.

## 14. Drag and drop, style, and beautify pass (v4)

Decisions (taken without the owner; reported in the handover):

| Area | Decision | Evidence |
|---|---|---|
| Drag and drop | A row drop lands in the top quarter (before), bottom quarter (after) or middle (inside) of a row. Pages dragged from Add Items use the same zones. Refusals show the reason as a toast and change nothing: depth above 3 levels, inside a mega item, a mega item below the top level, a mega item with children, dropping into its own subtree, and more than 80 items. Alt+arrow keyboard reorder stays as the fallback. | `qa_m8_dnd.py` D1–D11, DB1–DB8 |
| Menu presets | Five presets: Classic, Minimal, Pill, Underline, Bold. Chosen in Menu Settings > Appearance. | `qa_m8_dnd.py` DS1, D12–D13 |
| Dropdown animation | Fade (default), Slide, Scale, None. Honours reduced motion. | `qa_m8_dnd.py` DS3, DS7 |
| Hover effect | Underline (default), Lift, Highlight, None. | `qa_m8_dnd.py` DS2 |
| Mega panel | Surface Card (default), Flat, Bordered. Its own drop animation. | `qa_m8_dnd.py` DS5–DS7 |
| Publish parity | `menuStyle` is compiled into the header and footer variant props, carried through `layoutSnapshot`, and applied in the layout canvas and the Layouts preview. | `src/lib/menu-db.ts` compileChrome, `src/lib/layout-db.ts` |

Fixes in this pass:

- The depth helper was duplicated during drag-and-drop work. The new one was removed. Inside-drops check the target's level with `levelOf`.
- B0 in `qa_m8_menus.py` now matches "Add to Menu" exactly. It previously collided with "Add to Menu (1)".
- Preset cards overflowed the left column. They now wrap in two columns.

Open gaps after this pass:

- Preset demo chips: closed in §15 (two chips per card).
- Mega panels do not compile into the published header (the header is a flat `nav`, per scope).
- §31.8 fifteen-test mapping is still approximate (§9).

## 15. Responsive and open-gap pass

| Gap (from §12, §14) | Resolution | Evidence |
|---|---|---|
| Mega editor columns cramped and off the fold at 1280 px | Editor collapses to two columns at 1366 px and one column at 1100 px (CSS, `!important` over the inline grid) | `qa_m8_responsive.py` R4a, R4b |
| Preset demo chips clipped | Two chips per demo card; cards wrap in two columns in the settings column | `qa_m8_responsive.py` R7 |
| Tablet and mobile not checked by screenshot | 1280, 1024 and 768 checked for overflow; 768 screenshot confirms the stacked builder and the tablet drawer | `qa_m8_responsive.py` R1–R6, `/tmp/resp_768_builder.png` |
| Stale open-gap text (§11, §12) | Corrected; Layouts pinning was closed in §13 | this section |

Decision: README §18 says M8 comes "after M11", but the built module sits under Manage in the sidebar and has its own tab set. The assistant decided to keep the built position and record it as a deliberate placement, not a bug. The owner can overrule it later.

Still deliberately out of scope: mega panels on the live header (the header is a flat `nav`, per M7); a "Custom" column layout (limits are 2 to 4 columns); a separate phone-width screenshot suite.

## 16. Release checks and phone width

| Gap | Resolution | Evidence |
|---|---|---|
| Release modal DNS, SSL and Core Web Vitals were hard-coded to pass | DNS and SSL read the release site's domains (`site_main`, the site the modal publishes). Vitals reads the live grade. A failed check disables Publish with a reason. | `ModalHost.tsx` preflight; `qa_flows.py` 15 (publish passes on seed data), 38/38 |
| Scope choice | A pending domain on another site does not block EuroMiles Main's release. The first version checked all sites and blocked the release, which the assistant judged too broad; this was corrected and re-tested. | `qa_flows.py` 38/38 |
| Phone width (390 px) not tested | Added to the responsive suite: builder stacks, phone drawer, tappable rows at least 36 px | `qa_m8_responsive.py` R9a–c, `/tmp/resp_390_builder.png` |

Still open: §31.8 verbatim text is not in the workspace, so the fifteen-test mapping cannot be fully verified here.

## 17. Hierarchy drag and drop, mega themes, effects, and model review (v5)

### 17.1 Research that shaped the decisions

- Nested menus in enterprise tools use three gestures. Drop below a parent and shift right to indent, with a visible indicator. Drop on top of an item to make it a submenu. Keep indent and outdent buttons as the keyboard and accessible path. Sources: Experro multi-level menus (help.experro.com) for the shift-right indicator; Aether CMS menu editor for the indent and outdent controls and the hierarchy rules; UX Stack Exchange "Menu builder suggestions" for dropping onto an item and for keeping buttons beside drag-and-drop.
- Nesting depth is limited in practice to two or three levels. Sources: Experro ("2–3 levels is typical"); ProcessWire Menu Builder uses a `maxLevels` setting for the same reason.
- Mega menu styles cluster into four families: editorial (serif type, ruled columns, a featured article), image cards (each destination is a picture, with the box reserved before the image loads), minimal whitespace (Walmart, Nike, Home Depot), and category-first panels (Target, Best Buy). Sources: CodeFronts editorial mega menus (Aug 2026 and Oct 2026 pages); CodeFronts "Mega Menu with Category Image Cards"; Exclusive Addons "7 examples of mega menus"; mycodelesswebsite 2026 examples.

### 17.2 What was built

| Area | Built | Evidence |
|---|---|---|
| Hierarchy drop | The pointer's x chooses the level, 36px per level, from the parent level to the grandchild level. The drop surface is the whole tree, so a pointer far to the left still reaches a row. | `qa_m8_hier.py` H1–H9, HB1, HB2 |
| Refusals | Past the third level, a subtree that would exceed three levels, a mega item below the top level, into its own subtree, onto itself. Each refusal is a toast. | H5–H9 |
| Mega themes | Six: Classic, Editorial, Dark, Minimal, Image cards, Brand bar. Each is a complete look with its own type, colour and layout. | `qa_m8_hier.py` HS1–HS2; screenshots `/tmp/theme_*.png` (checked: editorial serif and rules, dark glow, image blocks) |
| Drop animations | Added Stagger columns, Blur in, Flip down (alongside Fade, Slide, Scale, None). Reduced motion turns them off. | HS4 |
| Hover effects | Added Sweep (underline draws in), Glow, Arrow (an arrow reveals). Alongside Underline, Lift, Highlight, None. | HS3 |
| Keyboard | Alt+arrows still move, indent and outdent. Keyboard depth is unchanged. | `qa_m8_dnd.py` DB8 |

### 17.3 Model review: gaps found

Built in this pass: hierarchy drop, six themes, new effects.

Found and not built. Each is a real gap against enterprise menu builders and is listed so the owner can prioritise it:

1. Per-item icon and short description. Mega and dropdown items in the research examples carry icons and one-line descriptions (weDevs, Fiverr, Miro). Not in the model.
2. Per-column "View all" link. Common in mega panels. Not in the model.
3. Media for mega images. The image cards and featured art use CSS and drawn placeholders, not uploaded media from the Media Library.
4. Per-locale menus. The Localization module exists, but menus have one language. Not built.
5. Menu export and import (JSON). Not built.
6. Auto-expand a collapsed parent when a drag hovers its middle, and auto-scroll near the tree edges. Not built.
7. Themes on the live site. Mega panels are not part of the live header (flat `nav`, per the M7 scope), so the six themes show only in the builder preview.

### 17.4 Verification limits, stated plainly

- The drop indicator line was not verified visually during a live drag. In a headless drag the indicator stayed on an earlier row while the drop itself used the drop event's own coordinates, and those landed correctly (HB1, HB2). Real browsers fire drag-over continuously, so the indicator should follow the pointer, but this is not proven here.
- The §31.8 verbatim text is still missing from the workspace.

## 18. Gap closure (v6)

Re-checked against the three mockups, the v1.1 spec text in the workspace, and the open list in §17.3 and §17.4.

### 18.1 Closed in this pass

| Gap | What was built | Evidence |
|---|---|---|
| Swap a submenu item with its main item, and a row with the next row | Row menu: "Swap with Main Menu Item", "Swap with Next Item". Refusals are toasts. | `qa_m8_swap.py` 12/12 (W1–W9, S1–S3) |
| Drop indicator verified during a live drag (§17.4) | The indicator follows the pointer: above row one, then below row three. Headless Chromium delivers `dragover` late, so the test moves in small steps. | `qa_m8_gaps.py` B8a–c |
| Drag over a collapsed parent (§17.3 item 6) | A drag resting in the middle of a collapsed parent opens it after 650 ms. | B6 |
| Auto-scroll near the viewport edges (§17.3 item 6) | A drag within 80 px of the top or bottom scrolls the nearest scrolling ancestor. | B7 |
| Item icon and description (§17.3 item 1) | Item Settings: Icon and Description. Shown in the preview's dropdowns and mobile accordion. | G3, G4, G16, G17, B4 |
| "View all" per mega column (§17.3 item 2) | Column toggle, label and link. Shown at the foot of the column in the panel preview. | G7, B5a, B5b |
| Mega link icon and description | Per-link Icon select and Description field in the mega editor. | G7, B5d, B5e |
| Media for mega images (§17.3 item 3) | The featured image lists Media Library assets. An asset with artwork renders as a real image. | B5c |
| Menu export and import (§17.3 item 5) | Export JSON downloads the draft and only the panels its items use. Import JSON creates a new draft menu. The file is validated: kind, version, depth, mega placement, item limit, links. | G1–G22, B2, B3, B3b |
| Toolbar wrap at 768 px (§15 screenshot) | Collapse, Undo and Redo stay on one line. | B1 |
| Mockup: "Show in Mega Menu" switch (panel 1) | Turns a top-level link into a mega item and back. Refused with a toast for submenu items or nested items. | B9a, B9b |
| Mockup labels "Column Gap", "Show Featured Content" | Casing aligned with the mockup. | `qa_m8_menus.py` B19 (matching is case-insensitive) |

### 18.2 Still open, with the reason

1. **Per-locale menus (§17.3 item 4).** Not built. It needs a locale on each menu and on each placement, and a link to the Localization module's translations. Those contracts do not exist yet. Phase 2, owner to confirm.
2. **Mega panels and themes on the live site (§17.3 item 7).** Not built, and this is a scope change, not a bug. M7 scope keeps the live header a flat `nav`. Showing panels live needs a header variant that renders panels, which is a separate decision for the owner.
3. **Mockup 4 "Menu Status" card.** The build puts publishing status, Validate Links, Release History and Rollback in the Version History tab. The mockup places them beside the preview. A layout delta, not a missing function.
4. **§31.8 verbatim text.** Not in the workspace. The fifteen tests cannot be mapped one by one. §9 maps by area, and §18.1 adds the new tests. This stays open until the owner pastes the text.

### 18.3 Suite totals after this pass

`qa-all` runs 32 suites. The Module 8 suites are `qa_m8_dnd` 29, `qa_m8_hier` 16, `qa_m8_swap` 12, `qa_m8_gaps` 41, `qa_m8_menus` 69, `qa_m8_v3` 35, `qa_m8_final` 14, `qa_m8_responsive` 13.
