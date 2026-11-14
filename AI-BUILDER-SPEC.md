# AI mode in the visual builder — spec, as built

**Scope:** Module 4 (Visual Builder). **Status:** built and shipping in `WACRM-CMS.html`.
**Source of the requirement:** the supplied mock (`EuroMiles Study Abroad Visual Builder`) shows an **AI Copy** chip floating beside the selected hero block with *Make Punchier* / *Shorten* quick actions — and your round-4 instruction that a **blank page must be buildable from a prompt**.

This document is the written UI/UX architecture for that surface: what it does, what it refuses to do, how each state is rendered, and the endpoint contract the prototype is standing in for.

---

## 1. Why it is one surface and not five

The temptation is a chat panel in a drawer. That fails this builder for three reasons: it hides the canvas (the thing being edited), it has no block context (so the model guesses), and it produces text with nowhere to land. The AI here is a **composer docked over the canvas** with three explicit tasks, each of which ends in a document change the editor can undo.

```
                  ┌──────────────────────────────────────────────┐
   toolbar  →     │ ✦ AI Copy                                    │   ← always reachable
                  └──────────────────────────────────────────────┘
                                    │ opens
   empty page  →  [ Build this page with AI ]  ──►  docked composer (bottom of stage)
   selection   →  ✦ AI Copy chip on the element  ──►  same composer, Rewrite task
                                                     │
                    ┌────────────────────────────────┴─────────────────────────────┐
                    │ Build a page   Add a section   Rewrite copy                  │  tasks
                    │ prompt · suggestions · budget · provider                     │
                    │ plan rows (or streamed rewrite)                              │  reasoning
                    │ hint: what it will not do        Discard · Insert 4 sections │  commit gate
                    └──────────────────────────────────────────────────────────────┘
```

Three tasks, one component (`src/components/builder/AiPanel.tsx`), one state object in `Builder.tsx`:

| Task | Entry | What it produces | Commit |
|---|---|---|---|
| **Build a page** | empty-canvas card, toolbar, or page scope chip | 3–6 planned sections from the registry | `commit(blocks)` — one undo step |
| **Add a section** | toolbar, section scope chip | exactly one planned section | `insertNode` at the selection |
| **Rewrite copy** | in-canvas chip (existing) or copy scope chip | a rewrite of the author's own line | `replaceNode` on accept only |

---

## 2. Build a page: intent → plan → compose

The visible behaviour is a staged progress list, because a page that appears fully formed looks untrustworthy. What actually happens:

1. **Plan** (`planFor(prompt)`) — intent matching over the editor's own words against six curated plans (booking / funding / programme / about / event / contact) plus a default. Precedence is fixed and testable: "university fair" plans as a **programme** page, not an event page.
2. **Stream the plan** (`streamPlan`) — rows arrive one at a time (~300–520 ms apart), each with a *why*: `Hero — states the offer in one line`, `Booking form — the conversion point`. The editor sees the reasoning before the result. The page is provably untouched while this runs (asserted in QA).
3. **Compose** — each plan row becomes a real `REGISTRY[type].defaults()` node with the plan's variant (`steps` / `stats` / `media` / `icons`). Nothing is synthesised markup: what lands is exactly what the library would insert by hand.
4. **Wire the form** — a generated `form` block is bound to the site's first saved form (`formId`), so a generated page is *live*, not a picture of a form. If the workspace has no form, the toast says `form needs a saved form` rather than pretending.
5. **Commit** — a single `commit()`: one undo step, an autosave, a revision-history entry.

**What the copy is, honestly.** Generated headings and body copy are the library's own draft copy. The only thing injected from the prompt is the hero **eyebrow**, derived by `topicFrom()` — stopword-stripped, three words, uppercase (`"a landing page to book a free counselling call"` → `BOOK COUNSELLING CALL`). The UI states this in three places: the plan footer (*"draft copy you can edit"*), the hint (*"no invented stats, claims or names"*), and the toast (*"draft copy, editable"*). No number, testimonial, award, price or date is ever generated — those come from the editor or the CRM.

**Why not generate prose from a model.** Because the brief for this prototype is *no backend*, and because a marketing page whose claims are invented is a liability the product would be shipping to its customers. The deterministic composer produces a page that is correct-by-construction; the endpoint contract below is where a model plugs in later, and it is deliberately shaped so the UI does not change when it does.

---

## 3. Rewrite copy: the mock's chip, made safe

Two entry points, one pipeline (`streamCopy` + `transform`):

- **In canvas** — the mock's popover: ✦ AI Copy over the selected text element, with *Improve*, *Make Punchier*, *Shorten*, *Rewrite formally*, footer *"Rewrites your words only — no new claims."*
- **In the composer** — the *Rewrite copy* task accepts a sentence of instruction (*"make it shorter"*, *"lead with the offer"*) and maps it to the same four deterministic rules.

The transform is a **pure rewrite of the author's own words**: filler removal, contraction, first-sentence truncation, formality expansion. If the rules would produce nothing (`"Study Abroad with Confidence"` → `shorten`), the panel says **"This line is already that short — nothing to cut"** instead of manufacturing a change. Acceptance is explicit — *Replace copy* — and undo is one keystroke.

**Guard:** both surfaces are never visible at once. While the composer is open, the in-canvas popover is suppressed (`ai: aiPanel ? null : ai`). QA asserts it.

---

## 4. States — the full matrix

| State | Trigger | What the editor sees |
|---|---|---|
| **idle** | panel opens | task chips, prompt box with placeholder, 4 suggestion chips (per task), char count `0/240`, disabled *Generate*, footer hint |
| **no selection** (rewrite) | rewrite task without a text element | amber note *"Select a text element in the canvas, then rewrite it here."*, *Generate* stays disabled |
| **over budget** | `AI_BUDGET.used >= cap` | primary button replaced by disabled *Budget reached* |
| **running** | *Generate* | live step row with spinner, plan rows appearing, page untouched, *Stop* replaces *Insert*, hint *"You can stop this — nothing has been written to the page yet."* |
| **ready** | stream completes | plan rows complete, summary *"4 sections planned · fits this page · draft copy you can edit"*, *Discard* + *Insert N sections* |
| **truncated** | page near the 40-block limit | summary *"only 2 of 4 will fit before the 40-block limit"*; insert clamps |
| **no-op rewrite** | rewrite equals the source | *"This line is already that short — nothing to cut."*, *Replace copy* still available |
| **provider error** | `mode.aiError` | red note *"The assistant could not be reached. Nothing was added to the page."*, *Try again*, nothing committed |
| **no provider** | `mode.noAiProvider` | *"No AI provider is connected to this workspace."* |
| **quota** | `mode.aiQuota` | *"The workspace used its daily AI budget. It resets at midnight UTC."* |
| **abort** | *Stop* or `Escape` | returns to idle, stream cancelled, document untouched |
| **viewer** | role Viewer | panel opens read-only task set (rewrite disabled), same as the rest of the builder |

Empty page: the `.wb-empty-canvas` state now leads with the AI card — *"Build this page with AI — one sentence is enough, you edit every block after"* — above the three manual routes (Add your first block / Browse sections / Use a template), which are unchanged.

---

## 5. Entry points

1. **Empty canvas card** (`data-empty-ai="1"`) → *Build a page*.
2. **Toolbar `✦ AI Copy`** (right cluster, `data-ai-open="1"`) → *Rewrite copy* if a text element is selected, otherwise *Build a page*. Pressed state mirrors the panel.
3. **In-canvas chip** on a selected text element → *Rewrite copy* (unchanged from the mock).
4. **Keyboard** — `Enter` runs, `Shift+Enter` newlines, `Escape` closes and cancels.

---

## 6. Backend contract (not built — see `BACKEND-PLAN.md` §7.19)

The prototype never calls a network. These are the shapes the UI is already coded against, so the swap is one module:

```
POST /api/sites/:siteId/ai/plan        { prompt, pageId?, scope: "page"|"section" }
  → SSE  event: step  { index, type, label, why }
         event: plan  { sections: [{ type, variant, label, why }] }
         event: error { code: "no_provider"|"quota"|"model_error", message }

POST /api/sites/:siteId/ai/rewrite     { text, action, elKey, locale }
  → SSE  event: token { t }  …  event: done { text, changed: boolean }

GET  /api/sites/:siteId/ai/usage       → { used, cap, resetsAt }
```

Invariants the server must keep, or this UI breaks: **no write until the client commits** (the model returns a plan, never a document), **`changed: false` when the rewrite would not change the text**, **`used`/`cap` per workspace per day**, and **errors are typed** so the three messages above stay distinct.

---

## 7. Verification

`qa_ai.py` — **60 checks, all passing**: entry points, prompt composer, running state, plan content and precedence, insert, single-step undo, section mode, the "no selection" guard, the rewrite pipeline on a real `heading` element, the no-op message, all three failure states and recovery, and the blank-page → generated-page → undo round trip. Screenshots in `qa/ai-01…ai-12`. Existing suites unaffected: `qa_builder` 97, `qa_states_m4` 47, `qa_pages` 106, `qa_states_m3` 40, `qa_module2` 48, `qa_states_m1` 39, `qa_flows` 38, `qa_react` clean.

---

## 8. Non-goals

No free-form chatbot, no image generation, no page-level SEO copy, no multi-page generation in one shot, no AI-edited style tokens, no model choice per request (the workspace provider is fixed and named). AI never edits a published page directly — it edits the draft, and publishing stays the human step.
