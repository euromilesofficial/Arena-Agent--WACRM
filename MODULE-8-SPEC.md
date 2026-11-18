# Module 8 · Menus & Navigation — specification (v2, built to the mockup)

Status: **built to the owner's three Module 8 mockups**, not yet owner-approved as a spec.
Reference images: `uploads/Module 8_ Menus & Navigation UI-3.webp`, `uploads/SaaS Menus and Navigation Dashboard-2.webp`,
`uploads/WACRM Menus & Navigation Dashboard-1.webp`. Earlier v1 spec (D-M8-1..12) is kept below; decisions that the mockup
changed are marked **(v2)**.

Sources cited in §4: [1] WCAG navigation examples, https://www.thewcag.com/examples/navigation ·
[2] Responsive Menu, WordPress mega menu guide 2026, https://responsive.menu/wordpress-mega-menu-complete-guide-2026 ·
[3] Design Shack, "Mega menus UX" (2025), https://designshack.net/articles/ux-design/mega-menus-ux

## 1. Mockup features (complete list, from all three images)

| # | Feature | Where it is built |
|---|---|---|
| M1 | KPI strip: Menus, Assigned, Draft (unpublished), Link issues, Version history | `.m8-kpis`; Link issues and Version history are buttons |
| M2 | Six tabs: Menu Builder, Manage Menus, Menu Placements, Mega Menus, Version History, Settings | `renderTabs` |
| M3 | Menu picker: searchable, one badge per placement (Header, Footer, Utility), Published/Draft pill | `.m8-select`, `.m8-pop` |
| M4 | Status pill "Published (live)" / "Draft" | menu bar |
| M5 | Buttons: Preview Menu, Save Draft, Create Menu / New Menu, Publish Changes (count), Edit Menu, Manage Menus | top bar, menu bar, Menu Status card |
| M6 | Add Items: Pages (count, checkboxes, search), Landing pages (count), Custom link (label + address), "Add to Menu (n)" | Add Items column |
| M7 | Menu Structure: drag reorder, Alt+arrow reorder, type badges (Page, Dropdown, Mega Menu), Expand All, depth warning | Menu Structure column |
| M8 | Menu Item Settings: Label (required, 40 max, counter), Link To, Behaviour (Link / Dropdown / Mega), Visibility, Open in new tab, Remove Item | Settings tab |
| M9 | Mega Menu builder: Layout 2/3/4 columns, Column gap, Show Featured Content, columns with items, featured card (image, title, CTA), Add Column, Create Mega Menu, Attach Mega Panel, Edit Column | Mega Menus tab and Mega Panel tab |
| M10 | Manage Menus table: name, description, status, Used In, Updated, row actions, search, filter | Manage Menus tab |
| M11 | Menu Placements: Header (Primary), Footer, Utility (Top bar), Mobile (Drawer, auto responsive), each with a dropdown and Active status | Menu Placements tab |
| M12 | Preview: Desktop, Tablet, Mobile toggle; navigation shown in the site header | Navigation Preview |
| M13 | Publishing Status: live date, draft changes count, View changes; Publish Changes; Rollback to Previous Version; Validate Links (issue count); View Release History | Menu Status card, Publish dialog, Validate dialog |
| M14 | Version History table: Version, Change summary, Published by, Date, Actions (Roll back) | Version History tab |

Mockup items that are **not** built, and why, are in §9.

## 2. Connections to Modules 1–7

| From → To | What crosses | Check |
|---|---|---|
| Pages (M3) → menus | Page list for Add Items; page path and status feed link checks; a trashed page is an error, a draft is a warning | `checkMenu` against `DBX().cmsPages` |
| Menus → Layouts (M7) | Apply writes the live menu into the header (flat `nav`) or footer (`groups`) variant, plus a `menuRef` `{menuId, name, liveRev}` | `MenusAPI.apply` → `LayoutsAPI.saveRegionVariant`; typed as `HeaderChromeProps` / `FooterChromeProps` in `layout-db.ts` |
| Layouts (M7) → menus | "Out of date" when the live menu moved on since apply; "Missing" when the variant is gone | `MenusAPI.chromeStatus` |
| Global Footer drawer (M7) → menus | The drawer is the manual footer path; Apply replaces the footer groups from the live menu and the drawer lists the affected layouts | same variant id |
| Themes (M6) → menus | Preview uses the site's live theme tokens (colours, font, primary) | `themeFor(siteId).live.tokens` |
| Sites → menus | Every menu, panel and placement belongs to one website | `siteId` on every record |
| Roles and permission (M1, M7) | Viewer and denied roles get a read-only screen | `app.role`, `app.demo === "denied"` |
| Publish (M7 release model) | Publish copies drafts to live as a numbered version; the version list is the release history | `MenusAPI.publish`, `versions` |

## 3. Data model (v2)

- **Menu** (`MenuRec`): `draft` and `live` documents, `rev` (draft compare-and-swap), `liveRev`, `appliedTo`, `liveAt`.
- **Mega panel** (`MegaRec`): `draft` and `live` documents, `rev`; columns of links; featured card; gap; layout (2/3/4).
- **Placements** (`PlacementRec`): `draft` and `live` `{header, footer, utility}` menu ids. Mobile is generated from the header menu; it is not stored separately.
- **Versions** (`VersionRec`): numbered, with a change summary, publisher, and time. Rollback publishes an older version as a **new** version, so history is never rewritten.
- **Link** (`LinkRef`, typed): `page` (by page id), `url`, or `anchor`. A page reference is checked against the live page registry.

## 4. Decisions

| ID | Decision | Why | Source |
|---|---|---|---|
| D-M8-1 | Three levels maximum (top, child, grandchild) | Deeper trees are hard to scan and to operate by keyboard. Enforced in the data layer. | Editorial convention; [1] |
| D-M8-2 | At most four mega columns; the mockup's 2, 3 and 4 layouts are offered, plus "custom" is not built | Three to four columns is the range the guide recommends. | [2] |
| D-M8-3 | Mega and dropdown panels open on click, Enter or Space, not on hover alone | Hover-only menus exclude touch and keyboard users. | [3]; [1] |
| D-M8-4 | Escape closes an open panel and focus returns to its trigger | Standard disclosure-menu keyboard behaviour. | [1], [2] |
| D-M8-5 | Errors block Save, Publish and Apply; warnings do not | A broken link must not reach the chrome. A warning (for example a draft target) is the editor's call. | Product rule |
| D-M8-6 | `javascript:` and other non-web schemes are refused. Accepted: `https:`, `mailto:`, `tel:`; anchors must be `#name` | A menu link is a navigation target; script URLs are an injection vector. | Security baseline |
| D-M8-7 | A page link is checked against the live page registry: trashed is an error, draft is a warning, missing is an error | The seeded draft "Study in France" must show a warning, not a silent dead link. | Product rule |
| D-M8-8 | Apply is explicit and writes a copy into the variant with a `menuRef`. The header gets the visible top-level labels; the report lists what was left out | A flat header list cannot hold a tree. The menu stays the source. | Module 7 header variant |
| D-M8-9 | Footer apply turns each top-level link with children into one column, capped at three | The footer variant stores columns; the builder's footer supports up to four columns including the brand. | `footer.ts` |
| D-M8-10 | A menu placed on a location, or applied to a variant, cannot be deleted. The Delete buttons are disabled and say why | Deleting it would leave the chrome or a placement pointing at nothing. | Product rule |
| D-M8-11 | A Viewer or denied role can read menus and cannot change them | Matches Module 7 and the permission model. | Layouts (`readOnly`) |
| D-M8-12 | Save is compare-and-swap on each record's revision. A stale save is a conflict shown inline; the draft is kept | Two editors must not overwrite each other silently. | Modules 3 and 7 |
| D-M8-13 **(v2)** | Drafts and live are separate. Save Draft writes drafts; Publish copies them live as a numbered version and is refused on errors | Matches the mockup's Save Draft / Publish Changes pair and Module 7 release model. | Mockup M5, M13 |
| D-M8-14 **(v2)** | Rollback publishes an older version as a new version | History is never rewritten; the audit trail stays complete. | Mockup M14; Module 7 |
| D-M8-15 **(v2)** | Publishing a menu that is applied to chrome does not change the chrome until Apply runs again. The Menu Status card says "Out of date" | Keeps the header and footer under explicit control. | Module 7 header/footer rule |
| D-M8-16 **(v2)** | Featured cards use built-in art presets, not uploaded media | Uploads need the media library (Module 9). | §9 |
| D-M8-17 **(v2)** | The menu picker shows a badge for each placement, and a menu can hold one placement per location | The mockup shows one badge per placement; a location holds one menu. | Mockup M3, M11 |

## 5. States (each reachable from the Prototype states menu)

| State | What the screen shows |
|---|---|
| Loading | Skeleton blocks, with `aria-busy`, on first open and when the state is forced. |
| Empty (no menus) | "No menus yet", with New menu. |
| Error (service down) | "Menus did not load", with Try again. Nothing is written. |
| Conflict (save loses the race) | Inline banner: someone saved while you were editing. Drafts stay. "Reload theirs" resets them. |
| Permission denied / Viewer | Read-only banner. Every editing control is disabled; the menus still open. |
| Validation errors | Save Draft works; Publish and Apply are disabled. The Validate Links dialog lists every issue with "Show". |
| Unpublished | Menu Status shows "Not live yet". Apply is disabled until the menu is published. |

## 6. Accessibility

- Every field has a label that names its row ("Label", "Link to", "Mega panel name").
- The menu tree is a `tree` with `treeitem`, `aria-level`, `aria-expanded`, and `aria-selected`.
- Reorder works by button, by drag, and by Alt + arrow keys.
- Status is announced: the conflict banner is `role="alert"`; the read-only notice is `role="status"`.
- Device switch is a radio group. Panels are buttons with `aria-expanded`, not hover-only.

## 7. Acceptance criteria

1. Every mockup feature in §1 is present (M1–M14).
2. A link to a missing, trashed, or draft page is flagged per D-M8-7.
3. A `javascript:` address cannot be saved, and a fourth level cannot be created.
4. Save Draft and Publish are refused with errors; a stale save is a conflict.
5. Publish creates a numbered version; a rollback creates a new one.
6. Apply writes the header or footer, stores `menuRef`, reports what was left out, and the chrome shows "In sync" or "Out of date".
7. A placed or applied menu cannot be deleted.
8. Each state in §5 is reachable and tested.
9. Keyboard: every control has a name and a visible focus style.

Verified by `qa_m8_menus.py`: 24 unit checks (Node, the real data layer) and 45 browser checks (the mockup features, states, and interconnections).

## 8. Interconnection test coverage

- Unit: link and depth rules, mega checks, sibling-only reorder, typed links, counts.
- Browser: Pages picker, item settings, mega panel editing, preview device modes, Validate Links, Publish and version numbers, rollback, placements, delete guards, read-only role, prototype states.

## 9. Not built, on purpose

- **Uploaded media for featured cards and mega slots.** Needs the media library (Module 9). Featured cards use built-in art.
- **Scheduled publish and approval of menus.** Module 7 lists approval and scheduling on bindings as open. Menus publish immediately.
- **Custom mega column layouts beyond 2, 3 and 4.** D-M8-2.
- **Block-by-block editing of the header and footer chrome.** Chrome stays open by decision (Module 7 item 5): the header is a flat `nav` and the footer is edited only in the Global Footer drawer.
- **Cross-site menu clone and whole-workspace export.** Open in Module 7.
