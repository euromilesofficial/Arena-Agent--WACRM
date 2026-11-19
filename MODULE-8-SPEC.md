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

- Layouts screen does not yet edit bindings. It shows the binding read-only and links to Menus.
- Footer drawer: links still edited there. Not re-verified against menu-derived groups in this pass.
- Layouts preview does not pin a menu revision.
- The release modal's other checks (DNS, SSL, Core Web Vitals) are still fixed passes, as they were before this change.
- The live header is a flat `nav`; dropdowns and mega panels are omitted at apply time.

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

- The Mega Menus editor's column cards are wide. At 1280 px and below they scroll sideways. A dedicated card layout is not built.
- "Custom" column layout (the fourth mockup card) is not offered. Phase 1 uses 2, 3 and 4 columns.
- The Menu Placements tab's Utility row can be seen but not used, because layouts have no utility slot.
- Layouts screen still reads bindings only, and Layouts preview does not pin a menu revision (carried over from section 11).
- Visual checks were made with screenshots at 1440 px. Tablet and mobile widths were checked only through the CSS breakpoints, not by screenshot.
