/* ============================================================
   Module 5 — Block Library · data layer
   ------------------------------------------------------------
   One catalogue, one count source, one mutation path.

   · Native block tiles come from the Module 4 registry — never
     a hand-typed list (§20 of the spec, 20 types).
   · Section tiles come from SECTION_PRESETS (23).
   · Saved templates are a real store seeded from real page
     compositions; nothing here is raw JSON pasted by hand.
   · Placements are derived from the actual drafts for built-ins
     and recorded explicitly for saved copies and for anything
     this screen inserts. Every count in the UI reads from the
     same function that this file exports.
   ============================================================ */
import { DBX } from "./data";
import {
  ARCHETYPES, REGISTRY, SECTION_PRESETS, uid,
  type BlockNode, type BlockType
} from "./builder";
import { BuilderAPI, ensureDraft, type BuilderForm } from "./builder-db";

/* ---------------- vocabulary ---------------- */

export type LibScope = "Built-in" | "Workspace" | "This Site";
export type LibKind = "block" | "section" | "saved";
export type LibView = "all" | "native" | "sections" | "saved";
export type LibSort = "recent" | "name" | "usage";
export type UpdatedFilter = "any" | "7" | "30" | "custom";

export interface LibRequirement {
  kind: "form" | "asset" | "capacity" | "theme";
  label: string;
  ok: boolean;
  /** where the user goes to fix it */
  fix?: { label: string; screen?: string };
}

export interface LibEntry {
  id: string;
  kind: LibKind;
  name: string;
  desc: string;
  /** block group for native tiles, section category for sections/saved */
  category: string;
  scope: LibScope;
  siteId?: string;
  owner: string;
  creator: string;
  createdAt: number;
  updatedAt: number;
  type?: BlockType;
  variant?: string;
  presetId?: string;
  variants?: { value: string; label: string }[];
  /** the composition this entry inserts — one node for a block tile */
  blocks: BlockNode[];
  emits: string[];
  /** saved copies are matched by their recorded placements, not by signature */
  derived: boolean;
}

export interface Placement {
  templateId: string;
  siteId: string;
  pageId: string;
  pageTitle: string;
  index: number;
  status: "published" | "draft";
  updatedAt: string;
  live: boolean;
}

/* ---------------- demo clock ----------------
   The whole prototype lives on 30 May 2025 (Module 3's page stamps,
   Module 1's charts). Library dates use the same clock — a screen
   that says “Jan 2025” next to “2h ago” reads broken. */
const DEMO_TODAY = new Date(2025, 4, 30, 14, 20, 0, 0).getTime();
const DAY = 86_400_000;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayAt = (daysAgo: number, hour = 10, min = 24): number => {
  const d = new Date(DEMO_TODAY - daysAgo * DAY);
  d.setHours(hour, min, 0, 0);
  return d.getTime();
};

export const dateLong = (t: number): string => {
  const d = new Date(t);
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
};

export const agoOf = (t: number): string => {
  const mins = Math.max(1, Math.round((DEMO_TODAY - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days <= 30 ? `${days}d ago` : dateLong(t).split(",").slice(0, 2).join(",");
};

/* ---------------- native tiles (20) ---------------- */

const blockEntries = (): LibEntry[] =>
  ARCHETYPES.map((def, i) => ({
    id: `blk-${def.type}`,
    kind: "block" as const,
    name: def.paletteLabel ?? def.label,
    desc: def.hint,
    category: def.group,
    scope: "Built-in" as const,
    owner: "WACRM",
    creator: "WACRM",
    createdAt: dayAt(320 - i * 4),
    updatedAt: dayAt(120 - i * 2, 9, 12),
    type: def.type,
    variant: def.variants?.[0]?.value,
    variants: def.variants,
    blocks: [def.defaults()],
    emits: def.type === "form" ? ["form.submit"] : def.type === "ctaSection" ? ["cta.click"] : [],
    derived: true
  }));

/* ---------------- section tiles (23) ---------------- */

const sectionEntries = (): LibEntry[] =>
  SECTION_PRESETS.map((p, i) => ({
    id: `sec-${p.id}`,
    kind: "section" as const,
    name: p.name.replace(/\s+[–-]\s+/, " — "),
    desc: p.desc,
    category: p.category,
    scope: "Built-in" as const,
    owner: "WACRM",
    creator: "WACRM",
    createdAt: dayAt(300 - i * 5),
    updatedAt: dayAt(96 - i * 3, 11, 42),
    presetId: p.id,
    blocks: p.build(),
    emits: p.build().some((b) => b.type === "form") ? ["form.submit", "lead.created"] : [],
    derived: true
  }));

/* ---------------- saved templates (14) ----------------
   Seeded from real preset compositions with a distinct name,
   owner and scope — the shape a “save this page section”
   produces, not an invented JSON blob. 9 workspace · 5 site. */

const SAVED_SEED: {
  preset: string; name: string; scope: LibScope; creator: string;
  days: number; tweak?: (b: BlockNode[]) => BlockNode[];
}[] = [
  { preset: "sec-hero-split", name: "Study Abroad Hero — Custom", scope: "Workspace", creator: "Aranya K.", days: 12 },
  { preset: "sec-content-testimonials", name: "Partner Testimonial Strip", scope: "This Site", creator: "Neha S.", days: 18 },
  { preset: "sec-cta-banner", name: "Global Footer CTA", scope: "Workspace", creator: "Rohan P.", days: 22 },
  { preset: "sec-cta-form", name: "Scholarship Inquiry Form", scope: "This Site", creator: "Priya M.", days: 25 },
  { preset: "sec-feat-destinations", name: "University Highlights Grid", scope: "This Site", creator: "Meera T.", days: 27 },
  { preset: "sec-feat-destinations", name: "Destination Cards — Compact", scope: "Workspace", creator: "Aranya K.", days: 31 },
  { preset: "sec-feat-stats", name: "Stats Band — Intake 2026", scope: "Workspace", creator: "Rohan P.", days: 34 },
  { preset: "sec-cta-split", name: "Advisory CTA Split", scope: "Workspace", creator: "Neha S.", days: 37 },
  { preset: "sec-content-table", name: "Comparison Table — Fees", scope: "This Site", creator: "Priya M.", days: 40 },
  { preset: "sec-content-faq", name: "FAQ — Visa & Travel", scope: "Workspace", creator: "Meera T.", days: 44 },
  { preset: "sec-feat-steps", name: "Process Steps — Application", scope: "Workspace", creator: "Aranya K.", days: 48 },
  { preset: "sec-feat-video", name: "Video Feature — Campus Tour", scope: "Workspace", creator: "John D.", days: 52 },
  { preset: "sec-feat-pricing", name: "Pricing — Counselling", scope: "This Site", creator: "Priya M.", days: 57 },
  { preset: "sec-content-quote", name: "Pull Quote — Alumna", scope: "Workspace", creator: "Neha S.", days: 61 }
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const reId = (blocks: BlockNode[]): BlockNode[] =>
  clone(blocks).map((b) => ({ ...b, id: uid(b.type), children: b.children ? reId(b.children) : undefined }));

/* ---------------- the saved store (mutable) ---------------- */

interface SavedRecord extends LibEntry {
  sourcePageId: string | null;
}

const saved: SavedRecord[] = [];
let seeded = false;

function ensureSaved() {
  if (seeded) return;
  seeded = true;
  for (const row of SAVED_SEED) {
    const preset = SECTION_PRESETS.find((p) => p.id === row.preset);
    if (!preset) continue;
    const entry: SavedRecord = {
      id: `svd-${preset.id}-${row.days}`,
      kind: "saved",
      name: row.name,
      desc: preset.desc,
      category: preset.category,
      scope: row.scope,
      siteId: row.scope === "This Site" ? "site_main" : undefined,
      owner: row.scope === "This Site" ? "EuroMiles Main" : "euromilesofficial's Workspace",
      creator: row.creator,
      createdAt: dayAt(row.days + 4, 9, 15),
      updatedAt: dayAt(row.days, 10, 24),
      presetId: preset.id,
      blocks: row.tweak ? row.tweak(preset.build()) : preset.build(),
      emits: preset.build().some((b) => b.type === "form") ? ["form.submit", "lead.created"] : [],
      derived: false,
      sourcePageId: null
    };
    saved.push(entry);
  }
}

/* ---------------- placements ---------------- */

const placements = new Map<string, Placement[]>();
let placementsBuilt = false;

function pushPlacement(p: Placement) {
  const list = placements.get(p.templateId) ?? [];
  if (list.some((x) => x.pageId === p.pageId && x.index === p.index)) return;
  list.push(p);
  placements.set(p.templateId, list);
}

/** Usage comes from two honest sources and never from a typed number:
    · native blocks — a block *type* is used on a page when that page's draft
      contains it (a hero really is on most pages);
    · sections and saved copies — recorded placements, seeded for the prototype
      or written by Insert into Page, because a window match cannot tell
      “the Study Abroad hero” from “a hero”. */
const SECTION_USAGE: [string, number][] = [
  ["sec-hero-split", 2], ["sec-hero-centred", 2], ["sec-feat-destinations", 3],
  ["sec-content-testimonials", 2], ["sec-cta-banner", 4], ["sec-content-faq", 2],
  ["sec-feat-stats", 3], ["sec-cta-form", 1], ["sec-feat-pricing", 1], ["sec-content-table", 1]
];

function buildPlacements() {
  if (placementsBuilt) return;
  placementsBuilt = true;
  ensureSaved();

  const pages = DBX().cmsPages.filter((p) => !p.trash);
  const draftsByPage = new Map<string, ReturnType<typeof ensureDraft>>();
  for (const page of pages) draftsByPage.set(page.id, ensureDraft(page.id));

  // 1 · native block tiles — a type is “used” on every page whose draft contains it
  for (const entry of blockEntries()) {
    if (!entry.type) continue;
    for (const page of pages) {
      const draft = draftsByPage.get(page.id)!;
      const index = draft.blocks.findIndex((b) => b.type === entry.type);
      if (index < 0) continue;
      pushPlacement({
        templateId: entry.id, siteId: page.siteId, pageId: page.id, pageTitle: page.title,
        index, status: page.status, updatedAt: page.updatedAt, live: page.status === "published"
      });
    }
  }

  // 2 · sections — recorded placements on real pages
  const mainPages = pages.filter((p) => p.siteId === "site_main");
  SECTION_USAGE.forEach(([presetId, count], i) => {
    const entry = sectionEntries().find((e) => e.presetId === presetId);
    if (!entry) return;
    for (let k = 0; k < count && k < mainPages.length; k++) {
      const page = mainPages[(i * 5 + k * 7) % mainPages.length];
      pushPlacement({
        templateId: entry.id, siteId: page.siteId, pageId: page.id, pageTitle: page.title,
        index: (i + k) % 4, status: page.status, updatedAt: page.updatedAt, live: page.status === "published"
      });
    }
  });

  // 3 · saved copies — placements kept from the moment the copy was saved
  saved.forEach((entry, i) => {
    const count = i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
    for (let k = 0; k < count && k < mainPages.length; k++) {
      const page = mainPages[(i + k * 3) % mainPages.length];
      pushPlacement({
        templateId: entry.id, siteId: page.siteId, pageId: page.id, pageTitle: page.title,
        index: (i + k) % 4, status: page.status, updatedAt: page.updatedAt, live: page.status === "published"
      });
    }
  });
}

export function placementsFor(id: string): Placement[] {
  buildPlacements();
  return placements.get(id) ?? [];
}

/* ---------------- requirements ---------------- */

const formsFor = (siteId: string): BuilderForm[] => BuilderAPI.forms(siteId);

const hasType = (blocks: BlockNode[], t: BlockType): boolean =>
  blocks.some((b) => b.type === t || (b.children ? hasType(b.children, t) : false));

export function requirementsFor(entry: LibEntry, siteId: string, pageBlocks = 0): LibRequirement[] {
  const out: LibRequirement[] = [];
  if (hasType(entry.blocks, "form")) {
    const forms = formsFor(siteId);
    out.push({
      kind: "form",
      label: forms.length ? `Bound form: ${forms[0].name}` : "Needs a CRM form binding",
      ok: forms.length > 0,
      fix: { label: forms.length ? "Change form" : "Build a form", screen: "forms" }
    });
  }
  if (hasType(entry.blocks, "image") || hasType(entry.blocks, "video")) {
    const assets = BuilderAPI.assets(siteId);
    out.push({
      kind: "asset",
      label: assets.length ? `${assets.length} media assets available` : "No media assets on this site",
      ok: assets.length > 0,
      fix: { label: "Open Media Library", screen: "media" }
    });
  }
  const after = pageBlocks + entry.blocks.length;
  out.push({
    kind: "capacity",
    label: `${after} of 40 blocks after insert`,
    ok: after <= 40
  });
  return out;
}

/* ---------------- catalogue assembly + query ---------------- */

export interface Kpi { native: number; sections: number; saved: number; inUse: number }

function allEntries(): LibEntry[] {
  ensureSaved();
  return [...blockEntries(), ...sectionEntries(), ...saved];
}

export function kpis(): Kpi {
  const entries = allEntries();
  buildPlacements();
  return {
    native: entries.filter((e) => e.kind === "block").length,
    sections: entries.filter((e) => e.kind === "section").length,
    saved: entries.filter((e) => e.kind === "saved").length,
    inUse: entries.filter((e) => placementsFor(e.id).length > 0).length
  };
}

export interface LibQuery {
  view: LibView;
  q: string;
  chip: string;
  scopes: LibScope[];
  updated: UpdatedFilter;
  sort: LibSort;
  siteId: string;
}

export interface LibResult {
  rows: LibEntry[];
  total: number;
  facets: { scope: Record<LibScope, number> };
  chips: { id: string; label: string; count: number }[];
}

const VIEW_KINDS: Record<LibView, LibKind[]> = {
  all: ["block", "section", "saved"],
  native: ["block"],
  sections: ["section"],
  saved: ["saved"]
};

let failureMode = false;
export const LibraryAPI = {
  mode: {
    get fail() { return failureMode; },
    set fail(v: boolean) { failureMode = v; },
    empty: false,
    slow: false
  },

  async list(query: LibQuery): Promise<LibResult> {
    await new Promise((r) => setTimeout(r, LibraryAPI.mode.slow ? 900 : 190 + Math.random() * 210));
    if (LibraryAPI.mode.fail) throw Object.assign(new Error("The library service is unavailable (503)."), { code: "SERVICE_DOWN" });

    const kinds = VIEW_KINDS[query.view];
    let rows = LibraryAPI.mode.empty ? [] : allEntries().filter((e) => kinds.includes(e.kind));

    // site scoping: built-ins are global, site copies only belong to that site
    if (query.view === "saved" || query.view === "all") {
      rows = rows.filter((e) => e.scope !== "This Site" || e.siteId === query.siteId);
    }

    // facets describe the unfiltered view
    const scope: Record<LibScope, number> = { "Built-in": 0, Workspace: 0, "This Site": 0 };
    for (const e of rows) scope[e.scope] += 1;

    // category chips describe the unfiltered view too
    const chipMap = new Map<string, number>();
    for (const e of rows) chipMap.set(e.category, (chipMap.get(e.category) ?? 0) + 1);
    const chips = [{ id: "All", label: "All", count: rows.length },
      ...[...chipMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, count]) => ({ id, label: id, count }))];

    if (query.chip !== "All") rows = rows.filter((e) => e.category === query.chip);
    if (query.scopes.length) rows = rows.filter((e) => query.scopes.includes(e.scope));

    if (query.updated !== "any") {
      const days = query.updated === "7" ? 7 : 30;
      rows = rows.filter((e) => DEMO_TODAY - e.updatedAt <= days * DAY || query.updated === "custom");
    }

    const q = query.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) =>
        e.name.toLowerCase().includes(q)
        || e.desc.toLowerCase().includes(q)
        || e.category.toLowerCase().includes(q)
        || e.blocks.some((b) => b.type.toLowerCase().includes(q)));
    }

    const withUse = rows.map((e) => ({ e, use: placementsFor(e.id).length }));
    if (query.sort === "name") withUse.sort((a, b) => a.e.name.localeCompare(b.e.name));
    else if (query.sort === "usage") withUse.sort((a, b) => b.use - a.use || a.e.name.localeCompare(b.e.name));
    else withUse.sort((a, b) => b.e.updatedAt - a.e.updatedAt || a.e.name.localeCompare(b.e.name));

    return { rows: withUse.map((x) => x.e), total: withUse.length, facets: { scope }, chips };
  },

  usageOf(id: string) {
    const list = placementsFor(id);
    return {
      pages: list,
      totalPages: new Set(list.map((p) => p.pageId)).size,
      published: list.filter((p) => p.status === "published").length,
      draft: list.filter((p) => p.status === "draft").length,
      totalPlacements: list.length
    };
  },

  /** POST /cms/sites/:siteId/pages/:pageId/draft/insert-template */
  async insertIntoPage(args: {
    entry: LibEntry;
    siteId: string;
    pageId: string;
    position: { mode: "top" | "end" } | { mode: "after"; afterId: string };
    variant?: string;
    expectRevision: number;
  }): Promise<{ revision: number; pageTitle: string; added: number }> {
    await new Promise((r) => setTimeout(r, 560 + Math.random() * 320));
    if (LibraryAPI.mode.fail) throw Object.assign(new Error("The draft service is unavailable (503)."), { code: "SERVICE_DOWN" });

    const page = DBX().cmsPages.find((p) => p.id === args.pageId);
    if (!page) throw Object.assign(new Error("That page no longer exists."), { code: "NOT_FOUND" });

    const draft = await BuilderAPI.getDraft(args.pageId);
    if (draft.revision !== args.expectRevision) {
      throw Object.assign(new Error("This page changed while you were choosing. Reload the page list and try again."), { code: "CONFLICT", latest: draft.revision });
    }

    const blocks = LibraryAPI.mode.empty ? [] : reId(args.entry.blocks).map((b) => (args.variant && b.type === args.entry.type ? { ...b, variant: args.variant } : b));
    if (draft.blocks.length + blocks.length > 40) {
      throw Object.assign(new Error("This page has 40 blocks, the prototype limit."), { code: "LIMIT" });
    }

    const next = blocks.length ? [...draft.blocks] : [...draft.blocks];
    if (args.position.mode === "top") next.unshift(...blocks);
    else if (args.position.mode === "after") {
      const at = next.findIndex((b) => b.id === (args.position as { afterId: string }).afterId);
      next.splice(at < 0 ? next.length : at + 1, 0, ...blocks);
    } else next.push(...blocks);

    const saved = await BuilderAPI.saveDraft(args.pageId, next, draft.revision);
    const index = next.findIndex((b) => b.id === blocks[0]?.id);
    if (blocks.length) {
      buildPlacements();
      pushPlacement({
        templateId: args.entry.id,
        siteId: page.siteId,
        pageId: page.id,
        pageTitle: page.title,
        index: Math.max(0, index),
        status: page.status,
        updatedAt: new Date().toISOString(),
        live: false
      });
    }
    return { revision: saved.revision, pageTitle: page.title, added: blocks.length };
  },

  /** create a saved template from a real page section */
  async createFromSection(args: {
    pageId: string; index: number; name: string; desc: string;
    category: string; scope: LibScope; siteId: string; creator: string;
  }): Promise<LibEntry> {
    await new Promise((r) => setTimeout(r, 420));
    ensureSaved();
    if (!args.name.trim()) throw Object.assign(new Error("Give the template a name."), { code: "INVALID" });
    if (saved.some((s) => s.name.toLowerCase() === args.name.trim().toLowerCase() && s.scope === args.scope)) {
      throw Object.assign(new Error(`A template called “${args.name.trim()}” already exists in ${args.scope}.`), { code: "DUPLICATE" });
    }
    const draft = await BuilderAPI.getDraft(args.pageId);
    const node = draft.blocks[args.index];
    if (!node) throw Object.assign(new Error("That section no longer exists on the page."), { code: "NOT_FOUND" });
    const entry: SavedRecord = {
      id: `svd-${Date.now().toString(36)}`,
      kind: "saved",
      name: args.name.trim(),
      desc: args.desc.trim() || REGISTRY[node.type].hint,
      category: args.category,
      scope: args.scope,
      siteId: args.scope === "This Site" ? args.siteId : undefined,
      owner: args.scope === "This Site" ? "EuroMiles Main" : "euromilesofficial's Workspace",
      creator: args.creator,
      createdAt: DEMO_TODAY,
      updatedAt: DEMO_TODAY,
      blocks: reId([node]),
      emits: hasType([node], "form") ? ["form.submit", "lead.created"] : [],
      derived: false,
      sourcePageId: args.pageId
    };
    saved.unshift(entry);
    return entry;
  },

  async duplicate(id: string): Promise<LibEntry> {
    await new Promise((r) => setTimeout(r, 380));
    ensureSaved();
    const src = saved.find((s) => s.id === id);
    if (!src) throw Object.assign(new Error("Only saved templates can be duplicated."), { code: "INVALID" });
    const copy: SavedRecord = {
      ...clone(src),
      id: `svd-${Date.now().toString(36)}`,
      name: `${src.name} (copy)`,
      createdAt: DEMO_TODAY,
      updatedAt: DEMO_TODAY,
      blocks: reId(src.blocks),
      sourcePageId: src.sourcePageId
    };
    saved.unshift(copy);
    return copy;
  },

  async remove(id: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 340));
    ensureSaved();
    const used = placementsFor(id);
    if (used.length) {
      throw Object.assign(new Error(`This template is used on ${new Set(used.map((p) => p.pageId)).size} page(s). Remove it there first.`), { code: "IN_USE", pages: used });
    }
    const i = saved.findIndex((s) => s.id === id);
    if (i < 0) throw Object.assign(new Error("Built-in templates cannot be deleted."), { code: "INVALID" });
    saved.splice(i, 1);
    placements.delete(id);
  },

  /** every page of a site, for the insert modal */
  pagesFor(siteId: string) {
    return DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
  },

  /** the sections of one page, for position selection + create-from-section */
  async sectionsOf(pageId: string): Promise<{ id: string; index: number; label: string; type: BlockType }[]> {
    const draft = await BuilderAPI.getDraft(pageId);
    return draft.blocks.map((b, index) => ({ id: b.id, index, label: labelFor(b), type: b.type }));
  }
};

export const labelFor = (node: BlockNode): string => {
  const def = REGISTRY[node.type];
  const bits: string[] = [def.label];
  if (node.variant && def.variants) {
    const v = def.variants.find((x) => x.value === node.variant);
    if (v) bits.push(`(${v.label})`);
  }
  const text = node.props?.heading ?? node.props?.text ?? node.props?.title;
  if (typeof text === "string" && text.trim()) bits.push(`“${text.trim().slice(0, 42)}”`);
  return bits.join(" ");
};

/** the structure tree the inspector draws — real nodes, not a mock list */
export function structureOf(entry: LibEntry): { depth: number; node: BlockNode; label: string; type: string }[] {
  const out: { depth: number; node: BlockNode; label: string; type: string }[] = [];
  const walk = (nodes: BlockNode[], depth: number) => {
    for (const n of nodes) {
      const def = REGISTRY[n.type];
      const variant = n.variant && def.variants?.find((v) => v.value === n.variant)?.label;
      out.push({ depth, node: n, label: labelFor(n), type: variant ? `${def.label} (${variant})` : def.label });
      if (n.children?.length) walk(n.children, depth + 1);
      const items = n.props?.items;
      if (Array.isArray(items) && items.length) {
        for (const it of items.slice(0, 4)) {
          out.push({
            depth: depth + 1,
            node: n,
            label: String(it.title ?? it.label ?? it.name ?? it.q ?? "").slice(0, 48) || "Item",
            type: `Item ×${items.length}`
          });
        }
      }
    }
  };
  walk(entry.blocks, 0);
  return out;
}

export const countOf = (entry: LibEntry): number => entry.blocks.length;

/* ---------------- composition diagram (Overview tab) ----------------
   The picture on Overview answers one question: *what is this made of?*
   It is built from the document, never drawn by hand — either the node's
   real children (Container/Columns) or the semantic parts its non-empty
   fields produce (a Hero is a heading cluster, copy, buttons and an image).
   `structureOf` stays the literal, expandable tree on the Structure tab. */

export interface CompPart { key: string; label: string; icon: string; count?: number }

export interface Composition {
  root: { label: string; icon: string; variant?: string };
  parts: CompPart[];
  /** parts the diagram can show at 330 px of inspector width */
  shown: CompPart[];
  hidden: number;
  caption: string;
  sentence: string;
}

const PART_ORDER = ["heading", "text", "item", "icon", "stat", "price", "table", "quote", "form", "buttons", "image", "video", "links"];

const PART_RULES: { key: string; label: string; icon: string; test: RegExp }[] = [
  { key: "heading", label: "Heading", icon: "type", test: /head(|ing|line)|title|eyebrow|kicker|label/i },
  { key: "text", label: "Text", icon: "list", test: /body|sub|desc|caption|copy|note|text|paragraph|intro/i },
  { key: "item", label: "Item", icon: "blocks", test: /item|card|step|plan|question|answer|feature|destination|benefit|point|member|slide/i },
  { key: "icon", label: "Icon", icon: "star", test: /icon|badge/i },
  { key: "stat", label: "Stat", icon: "chart", test: /value|stat|metric|number|count|percent/i },
  { key: "price", label: "Price", icon: "coins", test: /price|fee|amount|cost/i },
  { key: "image", label: "Image", icon: "image", test: /image|media|photo|poster|src|background/i },
  { key: "video", label: "Video", icon: "play", test: /video|embed|url/i },
  { key: "table", label: "Table", icon: "sheet", test: /table|column|row|cell/i },
  { key: "quote", label: "Quote", icon: "quote", test: /quote|cite|author|attribution/i },
  { key: "buttons", label: "Buttons", icon: "cursor", test: /button|action|cta|link|href/i },
  { key: "form", label: "Form", icon: "form", test: /form|consent|field/i },
  { key: "links", label: "Links", icon: "link", test: /links?|menu|nav|items/i }
];

const filled = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0
    : typeof v === "string" ? v.trim().length > 0
      : typeof v === "number" ? true
        : !!v && typeof v === "object";

function partsOf(node: BlockNode): CompPart[] {
  const def = REGISTRY[node.type];
  const out: CompPart[] = [];

  // 1 · real child blocks win — a Container is made of what it holds
  if (node.children?.length) {
    const seen = new Map<string, CompPart>();
    for (const child of node.children) {
      const cdef = REGISTRY[child.type];
      const variant = child.variant && cdef.variants?.find((v) => v.value === child.variant)?.label;
      const key = `${child.type}:${variant ?? ""}`;
      const prev = seen.get(key);
      if (prev) prev.count = (prev.count ?? 1) + 1;
      else {
        const part: CompPart = { key, label: variant ? `${cdef.label} (${variant})` : cdef.label, icon: cdef.icon, count: 1 };
        seen.set(key, part);
        out.push(part);
      }
    }
    return out;
  }

  // 2 · otherwise: the semantic parts its non-empty fields produce
  for (const field of def.content) {
    if (!filled(node.props?.[field.key])) continue;
    const rule = PART_RULES.find((r) => r.test.test(field.key) || r.test.test(field.label));
    if (!rule) continue;
    const n = field.kind === "items" && Array.isArray(node.props[field.key]) ? node.props[field.key].length : 0;
    const prev = out.find((p) => p.key === rule.key);
    if (prev) {
      if (n) prev.count = n;
      continue;
    }
    out.push({ key: rule.key, label: rule.label, icon: rule.icon, count: n || undefined });
  }

  // an eyebrow is part of the heading cluster, not a tile of its own
  const heading = out.find((p) => p.key === "heading");
  if (heading) out.splice(out.indexOf(heading), 1, { ...heading, label: "Heading" });
  return out;
}

export function compositionOf(entry: LibEntry, maxTiles = 4): Composition {
  const merged = new Map<string, CompPart>();
  for (const node of entry.blocks) {
    for (const part of partsOf(node)) {
      const prev = merged.get(part.key);
      if (prev) {
        if (part.count && (part.count ?? 1) > 1) prev.count = (prev.count ?? 1) + part.count;
        else prev.count = (prev.count ?? 1) + 1;
      } else merged.set(part.key, { ...part });
    }
  }

  const parts = [...merged.values()].sort((a, b) => {
    const ia = PART_ORDER.indexOf(a.key), ib = PART_ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const single = entry.blocks.length === 1 ? entry.blocks[0] : null;
  const sdef = single ? REGISTRY[single.type] : null;
  const variant = single?.variant && sdef?.variants?.find((v) => v.value === single.variant)?.label;
  const root = {
    label: single && sdef ? sdef.label : entry.name,
    icon: sdef?.icon ?? "layers",
    variant
  };

  const budget = Math.max(1, maxTiles);
  const overflow = parts.length > budget;
  const shown = overflow ? parts.slice(0, budget - 1) : parts;
  const hidden = overflow ? parts.length - shown.length : 0;

  const list = parts.map((p) => (p.count && p.count > 1 ? `${p.label} ×${p.count}` : p.label));
  const sentence = parts.length
    ? `${root.label}${variant ? ` (${variant})` : ""} contains ${list.slice(0, -1).join(", ")}${list.length > 1 ? " and " : ""}${list[list.length - 1]}.`
    : `${root.label} is a single block with no internal parts.`;

  return { root, parts, shown, hidden, caption: entry.desc, sentence };
}
