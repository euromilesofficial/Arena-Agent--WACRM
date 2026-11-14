/* ============================================================
   Module 4 — builder persistence
   ------------------------------------------------------------
   Drafts, revisions, assets and forms live here. The page record
   itself (`DB.cmsPages`) stays owned by Module 3: a successful
   save writes `hasChanges / blocks / updated` back into it, which
   is what makes the registry's amber chip react to this screen.
   ============================================================ */
import { DBX } from "./data";
import { SAMPLE_IMAGES } from "./builder-images";
import { PAGE_TEMPLATES, seedStudyAbroad, uid, type BlockNode, type BlockType } from "./builder";

export interface Draft {
  pageId: string;
  blocks: BlockNode[];
  /** document revision — the CAS token for the canvas (metadata CAS stays on CmsPage.revision) */
  revision: number;
  savedAt: number | null;
  savedBy: string;
  /** revision the in-memory document was opened from */
  base: number;
}

export interface Revision {
  rev: number;
  at: number;
  by: string;
  blocks: BlockNode[];
  summary: string;
  kind: "manual" | "snapshot" | "restore" | "ai";
}

export interface Asset {
  id: string;
  name: string;
  w: number;
  h: number;
  size: string;
  kind: "image" | "doc";
  siteId: string;
  alt?: string;
}

export interface BuilderForm { id: string; siteId: string; name: string; fields: number; submissions: number }

/* ---------------- seeded side-data ---------------- */
const ASSETS: Asset[] = [
  { id: "hero-student", name: "hero-student.jpg", w: 1920, h: 1080, size: "420 KB", kind: "image", siteId: "site_main", alt: "Student outside a European university" },
  { id: "dest-italy", name: "dest-italy.jpg", w: 1440, h: 960, size: "310 KB", kind: "image", siteId: "site_main", alt: "The Colosseum, Rome" },
  { id: "dest-germany", name: "dest-germany.jpg", w: 1440, h: 960, size: "286 KB", kind: "image", siteId: "site_main", alt: "Brandenburg Gate, Berlin" },
  { id: "dest-france", name: "dest-france.jpg", w: 1440, h: 960, size: "274 KB", kind: "image", siteId: "site_main", alt: "The Eiffel Tower, Paris" },
  { id: "dest-uk", name: "dest-uk.jpg", w: 1440, h: 960, size: "298 KB", kind: "image", siteId: "site_main", alt: "Big Ben, London" },
  { id: "as_brochure", name: "study-abroad-2026.pdf", w: 0, h: 0, size: "1.8 MB", kind: "doc", siteId: "site_main" }
];

const FORMS: BuilderForm[] = [
  { id: "form_eval", siteId: "site_main", name: "Free Profile Evaluation", fields: 6, submissions: 112 },
  { id: "form_fair", siteId: "site_main", name: "Study Abroad Fair RSVP", fields: 4, submissions: 38 },
  { id: "form_callback", siteId: "site_rewards", name: "Referral Callback", fields: 3, submissions: 9 }
];

export const imageFor = (key: string): string => SAMPLE_IMAGES[key] ?? "";

const stableHash = (str: string): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
};

/** Every page has a real composition: a template picked deterministically from
    the page id, so two pages of the same type never look cloned. */
function templateDoc(pageId: string, title: string, landing: boolean): BlockNode[] {
  const pool = landing ? [PAGE_TEMPLATES[1], PAGE_TEMPLATES[4], PAGE_TEMPLATES[0]] : PAGE_TEMPLATES;
  const tpl = pool[stableHash(pageId) % pool.length];
  const blocks = tpl.build();
  for (const b of blocks) {
    if (b.type === "hero") { b.props.heading = title; b.props.eyebrow = "EUROMILES"; break; }
    if (b.type === "heading") { b.props.text = title; break; }
  }
  return bindForms(blocks, pageId);
}

/** seeded pages never ship a form block with nothing attached */
function bindForms(blocks: BlockNode[], siteIdOfPage: string): BlockNode[] {
  const page = DBX().cmsPages.find((p) => p.id === siteIdOfPage);
  const form = FORMS.find((f) => f.siteId === (page?.siteId ?? "site_main"));
  if (!form) return blocks;
  return blocks.map((b) => (b.type === "form" && !b.props.formId ? { ...b, props: { ...b.props, formId: form.id } } : b));
}

/* ---------------- volatile store ---------------- */
const drafts = new Map<string, Draft>();
const revisions = new Map<string, Revision[]>();

export const isStudyPage = (pageId: string): boolean => {
  const p = DBX().cmsPages.find((x) => x.id === pageId);
  return !!p && p.siteId === "site_main" && /study abroad/i.test(p.title);
};

const seedRevisions = (_pageId: string, blocks: BlockNode[]): Revision[] => {
  const now = Date.now();
  const short = blocks.slice(0, 2).map((b) => ({ ...b, id: uid(b.type) }));
  return [
    { rev: 12, at: now - 1000 * 60 * 26, by: "Anita N.", blocks: JSON.parse(JSON.stringify(blocks)), summary: "Updated hero description · 6 sections", kind: "snapshot" },
    { rev: 11, at: now - 1000 * 60 * 60 * 5, by: "John D.", blocks: [...short, ...blocks.slice(2).map((b) => ({ ...b, id: uid(b.type) }))], summary: "Added destinations grid · 6 sections", kind: "manual" },
    { rev: 10, at: now - 1000 * 60 * 60 * 27, by: "Priya S.", blocks: short, summary: "Hero + stats approved for release v1.24", kind: "snapshot" }
  ];
};

export function ensureDraft(pageId: string): Draft {
  if (drafts.has(pageId)) return drafts.get(pageId)!;
  const page = DBX().cmsPages.find((p) => p.id === pageId);
  const blocks = isStudyPage(pageId)
    ? bindForms(seedStudyAbroad(), pageId)
    : templateDoc(pageId, page?.title ?? "Untitled page", page?.type === "landing");
  const d: Draft = { pageId, blocks, revision: 12, savedAt: Date.now() - 1000 * 60 * 3, savedBy: "You", base: 12 };
  drafts.set(pageId, d);
  revisions.set(pageId, seedRevisions(pageId, blocks));
  return d;
}

export const peekDraft = (pageId: string): Draft | undefined => drafts.get(pageId);

const fmt = (t: number): string => {
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};
export const agoLabel = fmt;

/** Write the document back into Module 3's page record. */
function syncPageRecord(pageId: string, blocks: BlockNode[]) {
  const page = DBX().cmsPages.find((p) => p.id === pageId);
  if (!page) return false;
  page.hasChanges = true;
  page.blocks = blocks.length;
  page.updated = "Just now";
  page.updatedAt = new Date().toISOString();
  page.revision += 1;
  return true;
}

function summarise(prev: BlockNode[], next: BlockNode[]): string {
  if (next.length > prev.length) return `Added ${next.length - prev.length} block${next.length - prev.length === 1 ? "" : "s"} · ${next.length} sections`;
  if (next.length < prev.length) return `Removed ${prev.length - next.length} block${prev.length - next.length === 1 ? "" : "s"} · ${next.length} sections`;
  return `Edited content · ${next.length} sections`;
}

export const PAGE_TOO_LARGE = "This page has 40 blocks, the prototype limit.";

export const BuilderAPI = {
  mode: { fail: false, emptyLibrary: false, conflict: false, aiError: false, noAiProvider: false, aiQuota: false },

  async getDraft(pageId: string): Promise<Draft> {
    await wait(180, 380);
    if (this.mode.fail) throw Object.assign(new Error("The draft service is unavailable (503)."), { code: "SERVICE_DOWN" });
    return JSON.parse(JSON.stringify(ensureDraft(pageId)));
  },

  async saveDraft(pageId: string, blocks: BlockNode[], expectRevision: number): Promise<{ revision: number; savedAt: number }> {
    await wait(220, 460);
    const d = ensureDraft(pageId);
    if (this.mode.fail) throw Object.assign(new Error("Save failed — the draft service timed out."), { code: "SAVE_FAILED" });
    if (this.mode.conflict || expectRevision !== d.revision) {
      throw Object.assign(new Error("This page was saved by someone else while you were editing."), { code: "CONFLICT", latest: d.revision });
    }
    const prev = d.blocks;
    d.blocks = JSON.parse(JSON.stringify(blocks));
    d.revision += 1;
    d.savedAt = Date.now();
    const list = revisions.get(pageId) ?? [];
    list.unshift({ rev: d.revision, at: d.savedAt, by: "You", blocks: JSON.parse(JSON.stringify(blocks)), summary: summarise(prev, blocks), kind: "manual" });
    if (list.length > 50) list.length = 50;
    revisions.set(pageId, list);
    syncPageRecord(pageId, blocks);
    return { revision: d.revision, savedAt: d.savedAt };
  },

  /** Conflict resolution: adopt the server copy. */
  async reloadDraft(pageId: string): Promise<Draft> {
    await wait(200, 400);
    return JSON.parse(JSON.stringify(ensureDraft(pageId)));
  },

  /** Conflict resolution: keep mine — write over the newer revision. */
  async forceSave(pageId: string, blocks: BlockNode[]): Promise<{ revision: number; savedAt: number }> {
    await wait(260, 520);
    const d = ensureDraft(pageId);
    d.blocks = JSON.parse(JSON.stringify(blocks));
    d.revision += 1;
    d.savedAt = Date.now();
    const list = revisions.get(pageId) ?? [];
    list.unshift({ rev: d.revision, at: d.savedAt, by: "You", blocks: JSON.parse(JSON.stringify(blocks)), summary: "Overwrote a newer revision · kept my copy", kind: "manual" });
    revisions.set(pageId, list);
    syncPageRecord(pageId, blocks);
    this.mode.conflict = false;
    return { revision: d.revision, savedAt: d.savedAt };
  },

  listRevisions(pageId: string): Revision[] {
    ensureDraft(pageId);
    return revisions.get(pageId) ?? [];
  },

  async restoreRevision(pageId: string, rev: number): Promise<{ blocks: BlockNode[]; revision: number }> {
    await wait(320, 600);
    const list = revisions.get(pageId) ?? [];
    const hit = list.find((r) => r.rev === rev);
    if (!hit) throw Object.assign(new Error("That revision is no longer available."), { code: "NOT_FOUND" });
    const d = ensureDraft(pageId);
    d.blocks = JSON.parse(JSON.stringify(hit.blocks));
    d.revision += 1;
    d.savedAt = Date.now();
    list.unshift({ rev: d.revision, at: d.savedAt, by: "You", blocks: JSON.parse(JSON.stringify(d.blocks)), summary: `Restored r${rev} · ${hit.blocks.length} sections`, kind: "restore" });
    syncPageRecord(pageId, d.blocks);
    return { blocks: d.blocks, revision: d.revision };
  },

  /** Debounced autosave is owned by the view; this is the snapshot cadence. */
  snapshot(pageId: string, blocks: BlockNode[]): void {
    const list = revisions.get(pageId) ?? [];
    const d = ensureDraft(pageId);
    list.unshift({ rev: d.revision, at: Date.now(), by: "You", blocks: JSON.parse(JSON.stringify(blocks)), summary: "Autosave snapshot", kind: "snapshot" });
    if (list.length > 50) list.length = 50;
    revisions.set(pageId, list);
  },

  assets(siteId: string): Asset[] {
    return this.mode.emptyLibrary ? [] : ASSETS.filter((a) => a.siteId === siteId || a.kind === "doc");
  },

  assetInUse(id: string): { pageId: string; pageTitle: string } | null {
    for (const [pageId, d] of drafts) {
      const used = JSON.stringify(d.blocks).includes(`"${id}"`);
      if (used) {
        const page = DBX().cmsPages.find((p) => p.id === pageId);
        return { pageId, pageTitle: page?.title ?? "Page" };
      }
    }
    return null;
  },

  deleteAsset(id: string): { ok: boolean; reason?: string } {
    const use = this.assetInUse(id);
    if (use) return { ok: false, reason: `Used by “${use.pageTitle}”. Remove it there first.` };
    const i = ASSETS.findIndex((a) => a.id === id);
    if (i > -1) ASSETS.splice(i, 1);
    return { ok: true };
  },

  forms(siteId: string): BuilderForm[] {
    return this.mode.emptyLibrary ? [] : FORMS.filter((f) => f.siteId === siteId);
  },

  /** Persist a form binding so the composed form fields are real, not a picture. */
  formById(id: string): BuilderForm | undefined {
    return FORMS.find((f) => f.id === id);
  },

  /** After a successful release, drafts stop being "unpublished". */
  afterPublish(siteId: string, _pageId: string) {
    for (const p of DBX().cmsPages) if (p.siteId === siteId) { p.hasChanges = false; p.status = "published"; }
    for (const [, d] of drafts) { d.base = d.revision; }
  },

  resetDraft(pageId: string) {
    drafts.delete(pageId);
    revisions.delete(pageId);
  }
};

function wait(min: number, max: number) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

/* ---------------- AI copy (deterministic, fact-free) ---------------- */
export type AiAction = "improve" | "punchier" | "shorten" | "formal";

export const AI_ACTIONS: { id: AiAction; label: string }[] = [
  { id: "improve", label: "Improve" },
  { id: "punchier", label: "Make Punchier" },
  { id: "shorten", label: "Shorten" },
  { id: "formal", label: "More formal" }
];

const FILLER = /\b(very|really|quite|just|actually|simply|in order to|a lot of|the fact that)\b/gi;
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();

function firstSentence(s: string): string {
  const m = s.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : s).trim();
}

/** Every transformation is a rewrite of the editor's own words — it never
    introduces a fact, a number or a claim the author did not type. */
export function transform(text: string, action: AiAction): string {
  const src = tidy(text);
  if (!src) return "";
  switch (action) {
    case "punchier": {
      let out = src.replace(FILLER, "").replace(/\bin order to\b/gi, "to").replace(/\s{2,}/g, " ");
      out = out.replace(/\bwe are\b/gi, "we're").replace(/\byou will\b/gi, "you'll").replace(/\bdo not\b/gi, "don't");
      const words = out.split(" ");
      if (words.length > 14) out = `${words.slice(0, 13).join(" ")}…`;
      return cap(tidy(out)).replace(/…$/, ".");
    }
    case "shorten": {
      let one = firstSentence(src).replace(/\.$/, "");
      /* drop trailing qualifiers before truncating words — a comma is the
         strongest signal that the rest is elaboration */
      if (one.split(" ").length > 6 && one.includes(",")) one = one.split(",")[0];
      const words = one.split(" ");
      if (words.length > 8) one = words.slice(0, 7).join(" ");
      /* a short line is already its own short version — don't staple a full stop
         onto a heading that never had one */
      const tail = /[.!?]$/.test(src) ? "." : "";
      return `${cap(tidy(one)).replace(/[.,;:]$/, "")}${tail}`;
    }
    case "formal":
      return cap(tidy(src
        .replace(/\bwe're\b/gi, "we are").replace(/\byou'll\b/gi, "you will").replace(/\bdon't\b/gi, "do not")
        .replace(/\bcan't\b/gi, "cannot").replace(/\bget\b/gi, "obtain").replace(/\bhelp\b/gi, "assist"))).replace(/\.?$/, ".");
    default: {
      const punchy = transform(src, "punchier");
      return punchy.length > 24 ? punchy : `${punchy} ${tidy(cap(firstSentence(src).toLowerCase()))}`.replace(/\s{2,}/g, " ").trim();
    }
  }
}

export interface StreamHandle { text: string; done: boolean; cancel: () => void }

export function streamCopy(text: string, action: AiAction, onToken: (soFar: string) => void, onDone: (final: string) => void, onError: (msg: string) => void): StreamHandle {
  const target = transform(text, action);
  const tokens = target.split(/(\s+)/).filter((t) => t.length);
  let i = 0;
  let alive = true;
  let soFar = "";
  const h: StreamHandle = { text: "", done: false, cancel: () => { alive = false; h.done = true; } };
  const step = () => {
    if (!alive) return;
    if (BuilderAPI.mode.aiError) { onError("The copy assistant could not be reached. Nothing was changed."); h.done = true; return; }
    if (i >= tokens.length) { h.text = soFar; h.done = true; onDone(target); return; }
    soFar += tokens[i++];
    h.text = soFar;
    onToken(soFar);
    window.setTimeout(step, 22 + Math.random() * 34);
  };
  window.setTimeout(step, 260);
  return h;
}


/* ---------------- AI: page generation (deterministic, fact-free) ----------------

   The prototype never calls a model. It plans sections from the words the editor
   typed, then composes real blocks from the registry, so what lands on the canvas
   is inspectable, editable and undoable — and it cannot invent a number, a claim
   or a testimonial. The real endpoint keeps this contract (see BACKEND-PLAN §7.19)
   and the UI does not change. */

export type AiScope = "element" | "block" | "section" | "page";

export const AI_PROVIDER = {
  label: "Gemini 2.5 Flash",
  source: "Workspace AI provider",
  model: "google/gemini-2.5-flash"
};

/** Mirrors `ai_usage_daily` — the workspace's daily budget, not a global one. */
export const AI_BUDGET = { used: 34, cap: 200 };

export interface GenSection { type: BlockType; variant?: string; label: string; why: string }

const PLANS: { match: RegExp; plan: GenSection[] }[] = [
  { match: /book|consult|counsel|appointment|call|demo/i, plan: [
    { type: "hero", label: "Hero", why: "states the offer in one line" },
    { type: "featureGrid", variant: "steps", label: "Three-step booking", why: "removes friction before the form" },
    { type: "form", label: "Booking form", why: "the conversion point, above the fold on mobile" },
    { type: "faq", label: "FAQ", why: "answers the four objections that stop a booking" }
  ] },
  { match: /scholar|fund|grant|fee|tuition/i, plan: [
    { type: "hero", label: "Hero", why: "names the funding outcome" },
    { type: "table", label: "Awards table", why: "compares what a reader can actually get" },
    { type: "faq", label: "Eligibility FAQ", why: "pre-empts the eligibility question" },
    { type: "ctaSection", label: "Closing CTA", why: "one action at the end of the read" }
  ] },
  { match: /program|course|univers|degree|study|master/i, plan: [
    { type: "hero", label: "Hero", why: "leads with the programme promise" },
    { type: "featureGrid", variant: "stats", label: "Proof strip", why: "four numbers a parent can scan" },
    { type: "featureGrid", variant: "media", label: "Destinations", why: "shows where students actually go" },
    { type: "pricing", label: "Packages", why: "puts a price next to the promise" },
    { type: "form", label: "Enquiry form", why: "captures the lead at the decision point" }
  ] },
  { match: /about|team|story|who we are|company/i, plan: [
    { type: "heading", label: "Section intro", why: "frames the story" },
    { type: "text", label: "Body copy", why: "the narrative itself" },
    { type: "testimonials", label: "Student voices", why: "proof that the story is real" },
    { type: "quote", label: "Pull quote", why: "one line that survives a screenshot" }
  ] },
  { match: /event|fair|webinar|workshop|seminar/i, plan: [
    { type: "hero", label: "Hero", why: "date and place first" },
    { type: "list", label: "Agenda", why: "someone decides to attend from the running order" },
    { type: "form", label: "Registration", why: "register while intent is highest" },
    { type: "faq", label: "Logistics FAQ", why: "venue, cost, children, parking" }
  ] },
  { match: /contact|reach|support|talk/i, plan: [
    { type: "heading", label: "Section intro", why: "sets the response expectation" },
    { type: "form", label: "Contact form", why: "the one action on the page" },
    { type: "faq", label: "Support FAQ", why: "deflects what the form would otherwise receive" }
  ] }
];

const DEFAULT_PLAN: GenSection[] = [
  { type: "hero", label: "Hero", why: "one promise, one action" },
  { type: "featureGrid", variant: "icons", label: "Benefits", why: "three reasons to keep reading" },
  { type: "testimonials", label: "Testimonials", why: "someone else says it for you" },
  { type: "form", label: "Lead form", why: "the conversion point" }
];

/** Intent matching over the editor's own words — deterministic, inspectable. */
export function planFor(prompt: string): GenSection[] {
  const hit = PLANS.find((p) => p.match.test(prompt));
  return (hit ? hit.plan : DEFAULT_PLAN).slice(0, 6);
}

/** Derives a 3-word eyebrow from the editor's own words — nothing is invented. */
const STOP = new Set(["a","an","the","to","for","of","in","on","with","and","or","my","our","your","that","this","is","are","be","it","we","i","free","page","landing"]);
export function topicFrom(prompt: string): string {
  const words = prompt.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !STOP.has(w));
  const pick = (keep.length ? keep : words).slice(0, 3).join(" ");
  return pick.toUpperCase();
}

export const AI_PROMPT_MIN = 3;
export const AI_PROMPT_MAX = 240;

/** Streams the plan in, section by section. Same shape the real SSE endpoint returns. */
export function streamPlan(prompt: string, onStep: (rows: GenSection[]) => void, onDone: (rows: GenSection[]) => void, onError: (msg: string) => void, limit = 6): StreamHandle {
  const rows = planFor(prompt).slice(0, limit);
  let i = 0;
  let alive = true;
  const h: StreamHandle = { text: "", done: false, cancel: () => { alive = false; h.done = true; } };
  const step = () => {
    if (!alive) return;
    if (BuilderAPI.mode.noAiProvider) { onError("No AI provider is connected to this workspace."); h.done = true; return; }
    if (BuilderAPI.mode.aiQuota) { onError("The workspace used its daily AI budget. It resets at midnight UTC."); h.done = true; return; }
    if (BuilderAPI.mode.aiError) { onError("The assistant could not be reached. Nothing was added to the page."); h.done = true; return; }
    if (i >= rows.length) { h.done = true; onDone(rows); return; }
    i += 1;
    onStep(rows.slice(0, i));
    window.setTimeout(step, 300 + Math.random() * 220);
  };
  window.setTimeout(step, 380);
  return h;
}
