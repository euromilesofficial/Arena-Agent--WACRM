# Module 7 · Layouts & Templates — how production CMSs actually do it

Research pass, 13 Nov 2026. Nine systems, the mechanism each one chose, and what it means
for us. Every claim below is traceable to the quoted vendor documentation in the
**Sources** section at the end; nothing here is inferred from a screenshot.

The question this answers: *a page has a shell and a body. Which of those is a live
reference, which is a copy, and who is allowed to put what inside the body?* Every mature
CMS answers all three. Our M7 specification answers the first, blurs the second, and is
silent on the third.

---

## 1 · The four layers every system converges on

| Layer | What it is | Live reference or copy? | Who edits it |
|---|---|---|---|
| **L1 · Shared chrome** | Header, footer, announcement — the same on every page | **Live reference.** Edit once, every page follows on publish | One "commerce/region" editor, not per layout |
| **L2 · Page design / shell** | chrome + slot order + page-level defaults | **Live reference** for structure, resolved from the frozen release | Designer role |
| **L3 · Slot policy** | which blocks may go inside the body, how many, in what order | Rule, not content | Designer role (policy), not the author |
| **L4 · Starter content** | the blocks a *new* page begins with | **Copy on create.** Never propagates | Marketer / author |

The systems differ in naming, not in the model:

| System | L1 shared chrome | L2 page design | L3 slot policy | L4 starter |
|---|---|---|---|---|
| **Shopify OS 2.0 / Horizon** | *Section groups* (`header-group.json`, `footer-group.json`) rendered by every JSON template | JSON template = ordered section list | section `blocks` schema + `max_blocks` | template's default section set |
| **WordPress block themes** | *Template parts* (synced) | block template (`.html`) | block `allowedBlocks` / block locking | *patterns* — and specifically **unsynced** patterns |
| **Webflow** | Nav/footer inside the page template *or* a component | **Static page template** with a **page slot** | **Slot restrictions** (Aug 2026) — which components may enter a slot | *default components inside the slot* |
| **Elementor Pro** | Theme parts by type: header, footer, single, archive, 404, search | theme-part *template* | widget restrictions per container | saved template inserted into a page |
| **AEM (Cloud Service)** | **locked** components in *Structure* mode | editable template | **Content policy → Allowed Components** (per layout container) | *Initial Content* mode |
| **Sitecore SXA** | **partial designs** (header / footer / main) | **page design** = partial designs mapped to a data template | rendering variants + placeholder settings | page branch / initial content |
| **HubSpot CMS** | *global groups* / global partials | coded or dnd template | module `allowed` fields + dnd area | default modules in the dnd area |
| **Sanity** | n/a (schema-driven) | document type | array `of:` members | **Initial Value Templates**, parameterised |
| **Squarespace 7.1** | global site header/footer | section-based page | n/a — sections are fixed set | n/a |

---

## 2 · The distinction that decides everything: structure vs initial content

AEM states it more precisely than anyone else, and every other system matches it:

| | Structure | Initial content |
|---|---|---|
| Stored in | `structure` node | `initial` node |
| Changes reach existing pages? | **Yes** — "changes made to the structure are reflected in any pages created with the template" | **No** — "any existing pages will not be updated if the initial content is changed after creation" |
| Authors can move/delete it? | No — locked components "cannot be moved on or deleted from any resulting pages" | Yes |
| Unlocking | "After a component is unlocked the `editable` property is set to `true`" | — |

Webflow says the same thing for page templates, in one line: **"Changes made to a template
do not cascade to pages already created from it."** WordPress splits it into two object
types: a *template part* is synced, an *unsynced pattern* is not. Sanity makes the starter
layer a first-class object (*Initial Value Templates*), so one document type can offer
several beginnings.

**Consequence for us:** our spec already separates *layout* (live reference, applied on
publish) from *page template* (copy on create). That is correct and matches all nine. What
it does not do is separate **L1 from L2** — so a header variant can be picked inside a
layout, while the spec also says headers are "shared regions or references". Those two
sentences cannot both be true unless chrome is its own object with its own identity and
usage count. That is finding **F1**.

---

## 3 · Locked chrome, and why the lock is visible everywhere

| System | How the lock is expressed |
|---|---|
| AEM | padlock on locked components; "components defined in the template structure cannot be moved on a resulting page nor deleted" |
| Sitecore SXA | partial design is a separate artefact; "any changes made to an existing partial design are applied on all pages that use it" |
| Shopify | header/footer live in a *section group*, not in a page template at all |
| Webflow | component instances stay connected to the master "unless it is deliberately unlinked" |
| HubSpot | "when global content is updated, the changes apply everywhere that global module or group is used" |

Our mockup already shows the right affordance — `Global (Locked)` chips on Header and
Footer in the Structure tab, plus *"This is a global region. Changes will update all
assigned pages."* The spec should then not also offer "No Header" as a *variant*
(finding **F9**); suppression and variant selection are different operations.

---

## 4 · Slot policy: the layer we are missing entirely

This is the most valuable finding of the research pass, because it is the one thing every
design-system-grade CMS has and our spec does not.

- **AEM**: a container's *policy* carries *Allowed Components*, *Default Components* and
  *Responsive Settings*. "Only the selected components in the policy will be able to be
  used by page authors for that specific container."
- **Webflow**: shipped **slot restrictions** on 28 Aug 2026 — "Designers can now control
  which components are allowed in component slots, helping Marketers build confidently
  while keeping layouts intact."
- **WordPress**: `allowedBlocks` on inner blocks, plus block locking.
- **Sanity / Contentful / Zod-style schemas**: an array field declares its members.

We have a typed block registry (20 registered blocks, 19 archetypes) and a typed slot, but
nothing that says *"a Landing layout may only receive marketing blocks; a Document layout
may only receive text, table, FAQ"*. Without it, a blank landing layout will happily accept
a testimonial carousel and the designer has no lever. That is finding **F2** — a Phase-1
feature, cheap to build (a `string[]` of block type ids on the slot + a filter in the M4
library panel + a preflight check), and it is what makes "master layout" mean something.

---

## 5 · Starter content inside the slot

- **AEM** *Initial Content* mode exists precisely so a new page is not blank.
- **Webflow**: "You may also include default components inside component slots… Add default
  components inside slots to help marketers get started", and "slot defaults render when no
  content is provided".
- **Sanity**: initial-value templates, optionally parameterised and async.

Our spec's slot shows a *preview of a sample page* behind the marker but has no concept of
**seed blocks** the new page inherits. Adding it costs one field on the layout and one step
in the M3 create flow, and it removes the dead first 30 seconds after "Create page" for
every user. That is finding **F3**.

---

## 6 · Targeting / display conditions — the one place the mockup is ahead of the spec

The mockup's Structure tab shows an announcement bar with `Assignment: Global (all pages)`
and checkboxes `Homepage`, `Programs`, `Others (40)`. The spec calls this **[PROPOSED]** and
defers it. Elementor has shipped this as its central feature for years: theme parts with
*include* rules (entire site / singular / archive / specific pages or taxonomies) and
*exclude* rules, plus a per-template *activation* toggle.

Recommendation (**F8**): implement a **constrained** version — `All pages` · `Homepage only`
· `Selected page groups` · `Hidden on selected pages` — no boolean expression builder, no
user-role or device conditions. That matches the mockup, stays inside a model we can
validate, and is honest about its limits in the UI.

---

## 7 · Limits and budgets are a feature, not an omission

Every mature system publishes hard numbers, which is how they keep the editor usable and
how support answers "why can't I add another section":

| System | Published limits |
|---|---|
| Shopify | 25 sections / JSON template · 20 section groups / theme · 25 sections / section group · 50 blocks / section · 1,250 blocks / template · 8 levels of block nesting · 300 theme block files · 1,000 JSON templates |
| Webflow | 40 page templates / site · page slots cannot be nested inside components · templates are Designer-only |
| AEM | templates restricted per site/branch via `cq:allowedTemplates` |
| Elementor | no published cap (its problem: editors get slow) |

Our spec has zero limits. That means no guardrails, no counter UI, and no way to test
"does this scale". Finding **F10** adds a budget table we enforce in the UI and in preflight.

---

## 8 · Thumbnails are a lifecycle, not a field

Template pickers are thumbnail-driven in every system (Sanity: "icons, screenshots or
thumbnails plus groups"; Webflow page-template picker; Elementor template library). The
classic failure is a stale thumbnail that no longer matches the template. The spec mentions
thumbnails twice and never says who renders them, when they expire, or what shows when they
are missing. Finding **F11** makes it explicit: rendered from the same block renderer at a
fixed aspect, keyed by revision hash, refreshed on save, skeleton while pending, never a
hand-uploaded image.

---

## 9 · Where the authoring boundary sits

| System | Template editor | Content editor |
|---|---|---|
| Webflow | Designer (template + slot) | Build mode (marketer drops components into the slot) |
| AEM | Template Editor (structure/policies) | Page Editor (initial content + page) |
| Elementor | Theme Builder | Elementor page editor |
| Shopify | theme code | theme editor |

Two distinct editors, one shared renderer. Our spec wavers: it says "do not replicate the
Visual Builder", yet §9.3 offers "edit template sections … or Open in Visual Builder" and
§8.5 has a `+ Add Block or Content` affordance in the slot. Finding **F13** resolves it the
way the industry does: M7 owns **composition, policy, metadata and usage**; every block edit
is delegated to M4 (deep-linked with the right scope), and the M7 canvas is a live render of
the same components — which we already have (`.wb-themed` canvas from M6.2).

---

## 10 · Deletion, retention and usage — the enterprise differentiator

- AEM/Shopify: a retained release pins its revisions; a live dependency cannot be deleted.
- Webflow/SXA: template deletion never touches pages already created.
- HubSpot: global content edits hit every usage — which is why the warning matters.

The spec gets the policy right (guarded delete, retained-release safety) and the mockup
gets the surface right (`Applied to 42 pages`, `Page Groups`, `Bulk Reassign`,
`Open Template Library`). What is missing is the *derivation* of those numbers — see finding
**F6** (counts) and **F7** (page groups have no data model in M3 today).

---

## 11 · What nobody does (so we should not build it either)

Confirmed absent or explicitly discouraged in the systems studied:

- free-form recursive named slots (Shopify caps nesting at 8; Webflow forbids nesting page
  slots inside components);
- live inheritance from a page template into already-created pages (AEM *initial content*,
  Webflow, WordPress unsynced patterns all agree: no);
- raw HTML/CSS editors inside layout definitions (our spec's [BASE] invariant is right);
- editing the published release directly, bypassing preflight (all use a draft + publish gate);
- arbitrary reordering of header/footer relative to the content slot (AEM locks them;
  SXA places header/footer automatically).

---

## 12 · Verdict

The specification is structurally sound and matches the industry on the two hardest
decisions — *drafts don't reach production without a release* and *templates copy, they
don't cascade*. Three layers need to be added or separated before build:

1. **chrome as an object (L1)** — so "shared header" is not a per-layout opinion;
2. **slot policy (L3)** — so a layout can defend itself;
3. **seed blocks (L4)** — so a new page is not blank.

Everything else in the gap review is precision work on counts, states, budgets, thumbnails,
boundaries and interlinks.

---

## Sources

- Shopify — theme store requirements (section groups, JSON templates): <https://shopify.dev/docs/storefronts/themes/store/requirements>
- Shopify — section limits, section groups, "you can't share section data across JSON theme templates": <https://pagefly.io/blogs/shopify/shopify-sections>
- Shopify — JSON templates, `@app` blocks, theme blocks in `/blocks` (Winter 2024): <https://www.braincuber.com/blog/shopify-2-0-themes-complete-developer-guide>
- WordPress — patterns: synced vs not synced, template parts, user-created patterns: <https://developer.wordpress.org/themes/patterns/introduction-to-patterns/>
- WordPress — inserting a template part creates a reference, a pattern creates a copy: <https://stepfoxthemes.com/wordpress-block-patterns-guide/>
- Webflow — **static page templates**: page slot, defaults inside slots, 40 templates, no cascade, Designer-only, page slots cannot nest in components: <https://webflow.com/webflow-way/design-systems/static-page-templates>
- Webflow — components: properties, variants, slots, connected vs unlinked instances: <https://overflow.agency/concepts/webflow-components>
- Webflow — release note, **slot restrictions** (28 Aug 2026) and page templates (5 Aug 2026): <https://creatorstoolbox.com/tools/webflow/news>
- Elementor — theme parts and display conditions (entire site / singular / archive, include & exclude, activation): <https://elementor.wpxpro.com/theme-builder/>
- AEM — editable templates: Structure vs Initial Content, unlocking components, changes to structure reach pages: <https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/components-templates/templates>
- AEM — content policies: Allowed Components, Default Components, Responsive Settings, `cq:allowedTemplates`: <https://www.aemcq5tutorials.com/tutorials/aem-editable-templates-policies-style-system/>
- Sitecore SXA — partial designs and page designs; "any changes made to an existing partial design are applied on all pages that use it": <https://doc.sitecore.com/sai/en/users/sitecoreai/build-pages/building-page-templates-and-branches/work-with-page-designs.html>
- HubSpot — global groups/global content across templates and its limits: <https://knowledge.hubspot.com/design-manager/use-global-content-across-multiple-templates>
- Sanity — Initial Value Templates, parameterised: <https://www.sanity.io/docs/studio/initial-value-templates>
