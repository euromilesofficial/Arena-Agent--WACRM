# Module 8 — Menus & Navigation: specification

Status of this document: written by the build team, not supplied by the product owner. The
owner waived the mock-and-spec gate for this module ("take your own decision, build everything"),
so there is **no approved mock image**. The layout follows the Module 7 visual language and the
interaction patterns below. Where this spec and a later mock disagree, the mock wins.

## 1. Purpose

A visitor reads the site's navigation in the header and the footer. Editors need one place to
decide what those links are, check that they work, and write them into the shared chrome that
real pages use. Module 7 owns the header and footer regions and their variants. Module 8 owns the
link tree that feeds them.

## 2. Scope

| In scope | Out of scope (and where it goes) |
|---|---|
| Menus per website: a header menu, a footer menu, custom menus | Publishing the chrome live (Module 11) |
| Ordered link tree, up to 3 levels, reorder, add, remove | Per-locale menus (Localization, unsequenced) |
| Link types: page, web address, anchor on page | Redirect creation when a page moves (SEO & Redirects) |
| Visibility per link: everyone, signed-in members, hidden | Enforcing visibility on the live site (needs the site runtime) |
| Mega menu on a top-level link: up to 4 columns | Rich media and promo cards inside a mega menu (see §9) |
| Mobile output: drawer or accordion, first level open or closed | Rendering the real site on a device |
| Broken-link checks before save and apply | Fetching external URLs to test them (no network in this product) |
| Apply to the header or footer variant, explicit, with a report | Automatic apply on save |
| Create, delete (unless applied) | Menu revision history with restore (see §9) |

## 3. Data model

- **Menu**: id, website, name, location (`header` | `footer` | `custom`), items, mobile settings,
  revision, last editor, and the variant it was last applied to.
- **Item**: id, label, link kind, target, opens in new tab, visibility, mega flag, children.
- Depth: level 0 (top), level 1 (child, or a mega column), level 2 (link inside a column).
  A fourth level is refused in the editor and in the data layer.
- A mega flag is allowed on top-level items only. Its children are columns; a column holds links.

## 4. Decisions

| # | Decision | Why | Source |
|---|---|---|---|
| D-M8-1 | Three levels maximum | Deeper trees are hard to scan and to operate with a keyboard. The cap is enforced in the data layer, not only in the UI. | Editorial convention; the WCAG navigation guidance asks for predictable, keyboard-operable structures. | [1] |
| D-M8-2 | At most four mega columns | Three to four columns is the range the guide recommends for mega menus. | [2] |
| D-M8-3 | Mega and dropdown panels open on click, Enter or Space, not on hover alone | Hover-only menus exclude touch and keyboard users. | [3] recommends against hover-only interactions; WCAG keyboard guidance [1]. |
| D-M8-4 | Escape closes an open panel and focus returns to its trigger | Standard keyboard behaviour for disclosure menus. | [1], [2] |
| D-M8-5 | Errors block Save and Apply; warnings do not | A broken link must not reach the chrome. A warning (a draft target, a long label, a duplicate) is the editor's call. | Product rule, recorded here. |
| D-M8-6 | `javascript:` and other non-web schemes are refused as addresses | A menu link is a navigation target; script URLs are an injection vector. Only `https:`, `mailto:` and `tel:` are accepted. | Security baseline, stated for this module. |
| D-M8-7 | A page link is checked against the site's live page registry; a trashed page is an error, a draft page is a warning | The seed draft "Study in France" must show a warning, not a silent dead link. | Product rule. |
| D-M8-8 | Apply is explicit and writes a copy into the variant | A flat header list cannot hold a tree without losing structure, so the menu stays the source and the header gets the visible top-level labels. The report says what was left out. | Module 7 header variant stores a flat `nav` list (layout-db.ts). |
| D-M8-9 | Footer apply turns each top-level link with children into one column, capped at three | The footer variant stores columns; the builder's footer supports up to four columns including the brand. | footer.ts (`footerCols`, `footerGroups`). |
| D-M8-10 | A menu that is applied cannot be deleted | Deleting it would leave the chrome pointing at nothing. | Product rule. |
| D-M8-11 | A Viewer or a denied role can read menus and cannot change them | Matches Module 7 and the permission model. | Layouts (`readOnly`). |
| D-M8-12 | Save is compare-and-swap on the menu revision; a stale save is a conflict, shown inline with the draft kept | Two editors must not overwrite each other silently. | Module 3 and 7 convention. |

## 5. States (each one reachable from the prototype states menu)

| State | What the editor shows |
|---|---|
| Loading | Skeleton on first open, or after a change of website or state. A save does not blank the screen. |
| Empty (no menus) | "No menus yet", with New menu. |
| Error (service down) | "Menus did not load", with Try again. Nothing is written. |
| Conflict (save loses the race) | Inline banner: someone saved while you were editing. The draft stays. "Reload theirs" resets the draft to the saved menu. |
| Permission denied / Viewer | Read-only banner. Every editing control is disabled; the menu list still opens. |
| Validation errors | Save and Apply disabled, banner names the first blocking problem, the row is marked, "Show" focuses it. |
| Applied vs. not applied | Apply card shows "In sync" or "Differs from this menu" against what the chrome holds now. |

## 6. Accessibility

- Every field has a label that names its row ("Label for Pricing", "Move Pricing up").
- Focus moves to a new row when it is added, and to the flagged row when "Show" is used.
- Status is announced: the banner for blocking errors and the conflict use `role="alert"` or
  `role="status"`.
- The read-only state is a status banner and disabled controls, not a hidden editor.
- Mega and dropdown previews are buttons with `aria-expanded`, not hover-only.

## 7. Interconnections

| From → To | What crosses | Check |
|---|---|---|
| Module 3 pages → Module 8 | Page paths and draft or trash status feed the link checks | `checkMenu` against `DBX().cmsPages` |
| Module 8 → Module 7 header variant | Visible top-level labels become `nav` | `MenusAPI.apply` → `LayoutsAPI.saveRegionVariant` |
| Module 8 → Module 7 footer variant | Columns become `groups` | same path |
| Module 7 → Module 8 | "Open in Layouts" | `app.go("layouts")` |
| Module 7 footer drawer → Module 8 | Both edit the footer variant; the drawer is the manual path | Same variant id |

## 8. Acceptance criteria

1. A link to a missing, trashed, or draft page is flagged as described in D-M8-7.
2. A `javascript:` address cannot be saved.
3. A fourth level cannot be created.
4. Save is refused with errors; a stale save is a conflict.
5. Apply writes the header or footer and reports what was left out.
6. Every state in §5 is reachable and tested.
7. Keyboard: every control has a visible focus style and a name.

## 9. Not built, on purpose

- **Mega-menu media and promo slots.** The sitemap calls for them; they need the media library
  (Module 9). Until then a column holds links only.
- **Menu revision history and restore.** Menus save revisions, but the drawer from Module 7 is
  not reused here. Add it when the publish flow (Module 11) exists.
- **Per-locale menus.** Localization is unsequenced.
- **Live visibility enforcement.** "Members only" and "hidden" are stored and shown in the editor;
  the live site does not exist in this prototype to enforce them.
- **Real URL reachability.** Links are checked for form, not for response.

## Sources

1. [The WCAG navigation guide](https://www.thewcag.com/examples/navigation): keyboard operation and focus order for navigation.
2. [Responsive Menu, WordPress mega menu guide (2026)](https://responsive.menu/wordpress-mega-menu-complete-guide-2026/): three to four columns; return focus to the trigger on close.
3. [Design Shack, mega menu UX (2025)](https://designshack.net/articles/ux-design/mega-menus-ux/): avoid hover-only interactions; test with the keyboard.
