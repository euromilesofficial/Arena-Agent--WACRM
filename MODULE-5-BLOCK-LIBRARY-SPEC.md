# Module 5 — Desktop Block Library · specification

**Status** canonical working copy · **Version** 1.0 · **Date** 14 Nov 2026
**Source** the specification you pasted in chat (31 sections, v1.0), kept here because you cannot upload `.md` files and chat history is not a filing system. Sections are numbered 0–31 to match the count of your document; the original heading numbers are not reproduced word-for-word.

Where your text and the mock screens disagreed with each other or with the shipped registry, the disagreement is recorded in `MODULE-5-GAP-REVIEW.md` — **not** silently resolved here. §20–§25 and §28 carry the reconciliation state.

---

## 0. Purpose

One catalogue surface for every block, section and saved template in the workspace, so an editor can find a proofed component, understand what it is made of and where it is already used, and put it on a page — without opening the Visual Builder and without authoring content here.

## 1. Scope — what Module 5 is

A **catalogue + management** surface. Four mutually exclusive views, KPI counts, filter rail, card grid, per-item inspector, and one mutation path (`Insert into Page`).

## 2. Non-goals — what Module 5 is not

- Not a second Visual Builder: no Content / Style / Advanced editing, no HTML, CSS or JS, no in-canvas editing.
- No marketplace, no third-party store, no public sharing.
- **Nothing publishes from the library.** No `live_release_id` mutation, no preflight, no release creation.
- No page creation, no page deletion, no site creation.
- No CRM mutation (no lead, contact or form write) — forms are *bound*, not collected, here.

## 3. Screen layout

Full-width, desktop-first, no empty gutters.

| Region | Content |
| --- | --- |
| Global chrome | WACRM sidebar (Website CMS tree, Block Library active), breadcrumb `Website CMS › Block Library` |
| Header row | `Block Library` + subtitle · right side: `Website:` selector, `Import Template`, `Create Template` |
| KPI strip | 4 cards, full content width |
| Below the strip | left filter rail · centre card grid · right inspector |
| Footer strip | one-line guidance, page-level |

## 4. Header

- H1 `Block Library`; subtitle `Manage curated blocks and reusable section templates across your websites.`
- `Website:` selector lists the workspace's sites; the default is the primary site.
- `Import Template` — gated, see §16.
- `Create Template` — primary action, see §15.
- Global search field in the top chrome with `⌘K`; breadcrumb links back to Website CMS.

## 5. KPI cards

| # | Label | Sub-line | Rule |
| --- | --- | --- | --- |
| 1 | Native Blocks | Core, schema-validated blocks | count of registered, offered block types |
| 2 | Section Templates | Prebuilt, ready-to-use sections | count of section presets |
| 3 | Saved Templates | Your reusable templates | count of saved templates in scope |
| 4 | In Use | Actively used across pages | count of templates with ≥ 1 placement |

**No KPI is ever hardcoded.** Every number is derived from the same store the grid renders, and the grid, the rail facets and the KPI strip must agree at all times.

## 6. The four views

Mutually exclusive, one visible at a time, state preserved per view:

1. **All** — native blocks + section templates + saved templates, one mixed grid.
2. **Native Blocks** — the 20 types, grouped under presentation headers.
3. **Section Templates** — prebuilt sections only.
4. **Saved Templates** — workspace- and site-owned templates only.

Switching view resets the category chip to `All`, preserves the search string only if the new view's scope contains matches, and never loses the selected item silently.

## 7. Filter rail

| View | Search placeholder | Filters |
| --- | --- | --- |
| All | `Search blocks and templates…` | Category chips · Scope (Built-in / Workspace / This Site) |
| Native Blocks | `Search native blocks…` | Category chips · Compatibility checkboxes |
| Section Templates | `Search section templates…` | Category chips · Scope (Built-in / Workspace / This Site) |
| Saved Templates | `Search saved templates…` | Category chips · Owner (Workspace / This Site) · Updated (Any time / Last 7 days / Last 30 days / Custom range) |

- Rail is fixed width, sticky, independently scrollable; never pushes the grid.
- Chips carry their live count; a chip with zero results stays visible and disabled rather than disappearing.
- Search debounced; the grid shows a pending state, never a blank flash.

## 8. Card grid

- Three columns at ≥ 1440 px, two at 1024–1439 px, one below 1024 px.
- Group headers only where a view groups: Native Blocks groups by category with a count and a one-line description per group; All / Sections / Saved are flat, ordered by the active sort.
- Sort dropdown: **Recently Updated** is the default and the mock's only visible value; the full list and its semantics are in `MODULE-5-GAP-REVIEW.md` §A/C.
- Grid / list toggle in the grid header. Both are first-class; list view is a table with the same data.
- Card anatomy: thumbnail (lazy, WebP), title, up-to-two badges, and a footer action row.
- Card menu (`…`): `Preview`, `Insert into Page`, `Duplicate to Saved Templates`, `Delete Template` (guarded, disabled for built-ins with a reason).
- Selection: one card at a time; selected card gets the purple border; the inspector shows that item.

## 9. Cards — badges

`Built-in` (purple), `Workspace` (green), `This Site` (blue), `Schema validated` (green check). A card shows its scope badge always; the validation badge only where the mock shows it.

## 10. Inspector

Right panel, 310–355 px, closes with `×`, never reflows the grid when it closes.

Order: preview (lazy, full-bleed) → status pill row → tab bar → tab body → footer actions.

Footer actions: `Preview` (secondary) + one primary action that matches the item's type.

## 11. Inspector tabs — by item type

| Item type | Tabs |
| --- | --- |
| Native block | `Overview` · `Properties` · `Compatibility` |
| Section template | `Overview` · `Structure` · `Usage` |
| Saved template | `Overview` · `Structure` · `Usage` |

There is no `Content`, `Style` or `Advanced` tab in this module. Those belong to the Visual Builder (Module 4) and are opened from there.

## 12. `Structure` tab

A collapsible composition tree: the section's root, its blocks, nested groups, each row tagged with its block type (`Text (H1)`, `Image (Hero)`, `Button (Media)`), per-row kebab. Three summary tiles at the bottom: Responsive, Validation, Block Types.

## 13. `Usage` tab

Four mini-KPIs (Total Pages, Published, Draft, Total Placements) and a table: Page / Screen · Website · Status · Last Updated · Actions (`Open Page ↗`, `View Placement ↗`). Empty state when the template has no placements.

## 14. `Insert into Page` — the only mutation path

Every insert — native block, section, saved template — goes through one modal:

1. **Website** — prefilled from the header selector; changeable; only sites the user can edit.
2. **Page** — searchable, site-scoped, shows status (published / draft) and block count.
3. **Position** — `Top of page`, `After a block…`, `End of page`.
4. **Dependency validation** — before the confirm becomes available: form binding, asset availability, theme tokens, plan limits.
5. **Confirm** — `POST /cms/sites/:siteId/pages/:pageId/draft/insert-template` with a fresh ID set and the expected draft revision. Atomic: all blocks land or none.

Outcome: exactly one revision-aware, undoable draft change on that page. Toast on success with `Open page in builder →`. Failure states: 403 denied, 409 revision conflict (with `reload` / `keep mine`), 422 dependency unmet (lists what is missing and links to the fix), 413 page block limit, 503 service down.

## 15. `Create Template`

Save a **section from an existing page** as a saved template — never raw JSON. Flow: pick site → pick page → pick section (live preview of the picked section) → name, description, category, scope (Workspace or This Site) → save. Validation: name unique per scope, category required, section must contain ≥ 1 block.

## 16. `Import Template`

Gated `[VISUAL]/[CONDITIONAL]`: ships only with a validated native interchange format (v1 JSON: schema version, template meta, block tree with type keys that must resolve to registered types, no unknown props). Ungated import is not offered — the control is disabled with a reason until the format is validated.

## 17. `Duplicate`

Copies a template into Saved Templates with a new ID, `name (copy)`, new timestamps, and **no** placements. Usage counts on the copy start at zero.

## 18. `Delete`

Guarded. Refused when placements exist — the modal lists them. Deleting a saved template **preserves the materialized copies already on pages**; it removes the library entry only. Built-ins cannot be deleted; the menu item is disabled with a reason.

## 19. Counts and their invariants

For every view and every filter combination:

```
grid rows            == result count shown in the view header
sum(facet counts)    == unfiltered result count for that view
KPI card             == the same source of truth the grid uses
```

Any number typed by hand is a defect.

## 20. Canonical archetypes — 20 types

| # | Type | Category |
| --- | --- | --- |
| 01 | Text | Content |
| 02 | Heading | Content |
| 03 | List | Content |
| 04 | Table | Content |
| 05 | Quote | Content |
| 06 | Image | Media |
| 07 | Video | Media |
| 08 | Button | Form |
| 09 | Alert | Content |
| 10 | Separator (`Divider` / `Spacer`) | Layout |
| 11 | Container | Layout |
| 12 | Columns | Layout |
| 13 | Hero | Layout |
| 14 | Feature Grid (`Features` / `Benefits`) | Content |
| 15 | Pricing Table | Content |
| 16 | Testimonials | Content |
| 17 | CTA Section | Form |
| 18 | Lead Form | Form |
| 19 | FAQ (`Accordion`) | Content |
| 20 | Footer | Layout |

Category totals: **Content 10 · Media 2 · Layout 5 · Form 3 = 20.**

Rules: `Icon Grid` and `Stats Strip` are Feature Grid variants; `Accordion` is the FAQ variant; `Code` block is **prohibited**; no block may exist that the schema does not validate.

## 21. Variants

A variant is a presentation of a registered type, not a new type. The catalogue may show variant tiles (e.g. `Rich Text`, `Spacer`, `Stats Strip`, `Icon Grid`, `Accordion`) — they insert the parent type with that variant preset, and their count is reported separately from the type count.

## 22. Search

Per-view placeholder as §7. Matches name, description, category, and block types inside a section. Clearing restores the previous filter set.

## 23. Sort

Default `Recently Updated`. Ties break on name A→Z. Sorting never mutates the underlying order of the store.

## 24. Pagination

Saved Templates paginates; the footer shows `Showing a–b of n` plus page numbers. Page size is fixed per view and stated in the review (§D8).

## 25. States — the twelve

For every view and every modal: loading, empty, no-results, error, denied, conflict, success, disabled-with-reason, dirty/pending, partial-failure, stale, overflow. A screen that cannot produce these states is not finished.

## 26. Permissions

Owner, Admin, Manager, Editor, Viewer. `Create Template` and `Import Template` require Editor+; `Delete` requires Manager+; Viewer sees the catalogue read-only with the mutation controls disabled and a reason on hover/focus.

## 27. Accessibility

Keyboard-reachable cards and menus, focus trap in modals, `Esc` closes, visible focus rings, `aria-selected` on cards, tab semantics on the inspector tab bar, WCAG 2.2 AA contrast, targets ≥ 24 px.

## 28. Mock → surface mapping

| Mock | Surface |
| --- | --- |
| `WACRM Block Library Dashboard.webp` | All view + card menu + section inspector (Overview) |
| `…08_05_53 AM-1` | All view, same composition, no menu |
| `…08_05_56 AM-2` | Native Blocks view, grouped, Compatibility rail, native inspector |
| `…08_05_58 AM-3` | Section Templates view, inspector showing `Section Template` summary |
| `…08_05_59 AM-4` | Saved Templates view — owner/updated filters, pagination, Usage-rich inspector |
| `…08_06_00 AM-5` | Section Templates filtered to `Hero` |
| `…08_06_02 AM-6` | Section Templates filtered to `Features` — different tile family |
| `…08_06_03 AM-7` | Section Templates filtered to `CTA`, incl. sticky-bar tiles |
| `…08_06_05 AM-8` | Inspector `Overview` (Summary, Breakpoints, Component Summary, Usage) |
| `…08_06_06 AM-9` | Inspector `Structure` (composition tree + summary tiles) |
| `…08_06_08 AM-10` | Inspector `Usage` (mini-KPIs + usage table) |

Nothing in the set shows: the Insert modal, Create Template, Import Template, Delete confirm, list view, or any error/empty/denied state. Those are built from §14–§18 and §25, not from a picture.

## 29. Backend contract

Prototype only — no backend is built in this round. Contracts recorded in `BACKEND-PLAN.md`:

```
GET    /cms/sites/:siteId/library?view=&q=&category=&scope=&sort=&page=
GET    /cms/sites/:siteId/library/:templateId/usage
POST   /cms/sites/:siteId/pages/:pageId/draft/insert-template
POST   /cms/sites/:siteId/library/templates      (create from page section)
POST   /cms/sites/:siteId/library/templates/:id/duplicate
DELETE /cms/sites/:siteId/library/templates/:id
POST   /cms/sites/:siteId/library/import
```

## 30. Review format

Every module review is a findings list in one fixed shape: **finding → severity → evidence → recommendation → acceptance test → Phase-1 necessity.** No prose without a decision attached.

## 31. Acceptance

Module 5 is done when: the four views render from one store with computed counts; every card action works; the insert modal produces exactly one revision-aware draft change and the page in Module 3/4 reflects it; the twelve states exist per view and per modal; Viewer role is correctly restricted; the QA suite passes with the counts asserted against the registry; `WACRM-CMS.html` and `wacrm-app.zip` are rebuilt and pushed.
