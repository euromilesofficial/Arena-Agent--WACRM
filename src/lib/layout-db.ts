/* ============================================================
   Module 7 — Layouts & Templates · data layer
   ------------------------------------------------------------
   One store, one resolution rule, one count source.

   · A **master layout** owns composition (announcement, header,
     the single required Main Content Slot, footer) and *references*
     shared regions by id — it never copies chrome blocks.
   · A **page template** is a copy-on-create starter: its blocks are
     cloned into a page once and never live-inherited.
   · A page's binding is the single string `CmsPage.layout` that
     Module 3 already writes ("Site default" | a layout name), so
     there is no second source of truth to drift.
   · Every KPI, group card and usage row in the UI is derived here
     from `DBX().cmsPages` — nothing is hand-typed.
   ============================================================ */
import { DBX } from "./data";
import { PAGE_TEMPLATES, REGISTRY, type BlockNode, type BlockType } from "./builder";
import { footerCols, footerGroups, type FooterGroup } from "@/lib/footer";

/* ---------------- shared regions (global chrome) ---------------- */

export type RegionKind = "announcement" | "header" | "footer";

export interface RegionVariant {
  id: string;
  name: string;
  /** one-line behaviour note shown in the picker */
  note: string;
  blocks: BlockNode[];
  rev: number;
  updatedAt: string;
}

/** Set by Menus & Navigation when a menu is applied to a header or footer variant. */
export interface MenuRef {
  menuId: string;
  name: string;
  /** the menu's live revision the applied copy was built from (staleness check) */
  liveRev: number;
}

/** Header variant props. `nav` is the flat list derived from the live menu at apply time. */
export interface HeaderChromeProps {
  brand: string;
  nav: string[];
  cta: string;
  sticky: boolean;
  menuRef?: MenuRef;
}

/** Footer variant props. `groups` is derived from the live menu at apply time; edited only in the Global Footer drawer. */
export interface FooterChromeProps {
  groups: { title: string; links: string[] }[];
  menuRef?: MenuRef;
}

export interface SharedRegion {
  id: string;
  kind: RegionKind;
  name: string;
  /** built-in chrome cannot be renamed or deleted, only variant-swapped */
  locked: boolean;
  variants: RegionVariant[];
}

export interface RegionRef {
  regionId: string;
  variantId: string;
  visible: boolean;
  /** required by the API when `visible` is false */
  hideReason?: string;
}

/* ---------------- slot policy ---------------- */

export interface SlotPolicy {
  /** empty array means every registered block type is allowed */
  allow: BlockType[];
  deny: BlockType[];
  maxBlocks: number;
}

export interface SeoCheck { id: string; label: string; ok: boolean }

export interface LayoutDraft {
  id: string;
  siteId: string;
  name: string;
  desc: string;
  scope: "builtin" | "workspace" | "site";
  isDefault: boolean;
  archived: boolean;
  announcement: RegionRef;
  header: RegionRef;
  footer: RegionRef;
  slot: { seed: BlockNode[]; policy: SlotPolicy; allowedCount: number };
  seoChecklist: SeoCheck[];
  thumbnail: { url: string; revHash: string; renderedAt: string } | null;
  /** true when the working copy differs from the last released revision */
  dirty: boolean;
  rev: number;
  updatedAt: string;
  updatedBy: string;
  createdAt: string;
}

/** Where a template came from. Provenance is stored, not inferred. */
export interface TemplateOrigin {
  kind: "builtin" | "prebuilt" | "html" | "json" | "builder";
  name?: string;
  source?: string;
  license?: string;
  commit?: string;
  importedAt?: string;
}

export interface PageTemplateDoc {
  id: string;
  siteId: string;
  name: string;
  intent: string;
  desc: string;
  scope: "builtin" | "workspace" | "site";
  builtIn: boolean;
  layoutId: string;
  blocks: BlockNode[];
  seoReady: boolean;
  rev: number;
  updatedAt: string;
  updatedBy: string;
  origin?: TemplateOrigin;
}

/** The part of a layout or template a revision can actually restore. */
export interface StructureSnapshot {
  name: string;
  desc: string;
  announcement?: RegionRef;
  header?: RegionRef;
  footer?: RegionRef;
  slot?: { seed: BlockNode[]; policy: SlotPolicy };
  allowedCount?: number;
  blocks?: BlockNode[];
  blocks_n?: number;
}

export interface LayoutRevision {
  id: string;
  targetId: string;
  kind: "layout" | "template";
  rev: number;
  at: string;
  by: string;
  summary: string;
  /** null only for entries recorded before structure history existed */
  snapshot: StructureSnapshot | null;
}

/** What the history drawer renders. */
export interface RevisionEntry extends LayoutRevision {
  restorable: boolean;
  isCurrent: boolean;
  /** +n −n on the block count against the entry below it */
  delta: string;
}

export interface Kpis { layouts: number; templates: number; pagesAssigned: number; draftChanges: number }

export interface UsageRow {
  id: string;
  title: string;
  path: string;
  status: string;
  hasChanges: boolean;
  layoutId: string | null;
  mode: "explicit" | "inherited" | "none";
  updated: string;
}

export interface PageGroupCard { id: string; name: string; hint: string; pages: number; routes: string }

export interface PreflightIssue { id: string; severity: "error" | "warn"; label: string; detail: string; fix?: string }

export interface LayoutPayload {
  siteId: string;
  layouts: LayoutDraft[];
  templates: PageTemplateDoc[];
  regions: SharedRegion[];
  kpis: Kpis;
  groups: PageGroupCard[];
  revisions: LayoutRevision[];
  preflight: PreflightIssue[];
  updatedAt: string;
}

/** What Module 4's canvas needs to draw the page inside real chrome. */
export interface LayoutFrame {
  layoutId: string | null;
  layoutName: string;
  announcement: { text: string; visible: boolean } | null;
  header: { name: string; brand: string; nav: string[]; cta: string; variant: string } | null;
  footer: { name: string; variant: string; columns: string[]; note: string; groups: FooterGroup[] } | null;
  slotPolicy: SlotPolicy;
  issues: PreflightIssue[];
}

export class Err extends Error {
  code: string;
  constructor(code: string, msg: string) { super(msg); this.code = code; }
}

const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------------- seed helpers ---------------- */

const n = (type: BlockType, over: Record<string, any> = {}): BlockNode => {
  const base = clone(REGISTRY[type].defaults());
  return { ...base, ...over, props: { ...(base.props as any), ...(over.props ?? {}) } } as BlockNode;
};

const tpl = (id: string, fallback: () => BlockNode[]): BlockNode[] => {
  const hit = PAGE_TEMPLATES.find((t) => t.id === id);
  return hit ? hit.build() : fallback();
};

const headerBlocks = (brand: string, nav: string[], cta: string, menuRef?: MenuRef) =>
  [n("container", { props: { brand, nav, cta, sticky: true, ...(menuRef ? { menuRef } : {}) } })];

/* ---------------- regions ---------------- */

const REGIONS: SharedRegion[] = [
  {
    id: "reg_header", kind: "header", name: "Global Header", locked: true,
    variants: [
      { id: "hdr_v2", name: "Global Header v2", note: "Sticky, 6 links, Enquire CTA", blocks: headerBlocks("EuroMiles.in", ["Home", "Study Abroad", "Scholarships", "Services", "About Us", "Contact"], "Enquire Now", { menuId: "menu_primary", name: "Primary Navigation", liveRev: 1 }), rev: 2, updatedAt: "2026-11-08T09:12:00Z" },
      { id: "hdr_min", name: "Minimal Header", note: "Logo and one CTA — landing pages", blocks: headerBlocks("EuroMiles.in", ["Home"], "Apply Now"), rev: 1, updatedAt: "2026-10-22T11:40:00Z" },
      { id: "hdr_mega", name: "Mega Header", note: "Two-tier with destinations panel", blocks: headerBlocks("EuroMiles.in", ["Destinations", "Programs", "Universities", "Scholarships", "Guides", "Contact"], "Book a Call"), rev: 3, updatedAt: "2026-11-11T16:05:00Z" }
    ]
  },
  {
    id: "reg_footer", kind: "footer", name: "Global Footer", locked: true,
    variants: [
      { id: "ftr_v1", name: "Global Footer v1", note: "4 columns, social, DPDP note", blocks: [n("footer", { props: { columns: 4, social: true, note: "DPDP consent recorded" } })], rev: 1, updatedAt: "2026-09-30T08:00:00Z" },
      { id: "ftr_v2", name: "Global Footer v2", note: "3 columns, compact legal row", blocks: [n("footer", { props: { columns: 3, social: true, note: "Compact legal row" } })], rev: 2, updatedAt: "2026-11-04T13:20:00Z" },
      { id: "ftr_slim", name: "Slim Footer", note: "Single legal line — funnel pages", blocks: [n("footer", { props: { columns: 1, social: false, note: "Single legal line" } })], rev: 1, updatedAt: "2026-10-14T10:00:00Z" }
    ]
  },
  {
    id: "reg_announce", kind: "announcement", name: "Announcement Bar", locked: true,
    variants: [
      { id: "ann_intake", name: "Fall 2026 Intake", note: "All pages except legal", blocks: [n("alert", { props: { tone: "info", text: "Fall 2026 intake is open — applications close 15 Jan." } })], rev: 4, updatedAt: "2026-11-10T07:55:00Z" },
      { id: "ann_schol", name: "Scholarship Deadline", note: "Programme and landing groups", blocks: [n("alert", { props: { tone: "warn", text: "Scholarship deadline: 30 Nov. Check eligibility before applying." } })], rev: 1, updatedAt: "2026-11-06T12:10:00Z" },
      { id: "ann_none", name: "No Announcement", note: "Bar removed — keeps the slot", blocks: [], rev: 1, updatedAt: "2026-08-01T00:00:00Z" }
    ]
  }
];

const ALL: BlockType[] = Object.keys(REGISTRY) as BlockType[];
/** allow-lists are filtered against the registry so a typo can never ship a
    policy that hides every block. */
const policy = (allow: BlockType[], maxBlocks = 200): SlotPolicy => ({
  allow: allow.filter((t) => ALL.includes(t)),
  deny: [],
  maxBlocks
});

/* ---------------- layouts ---------------- */

const DEFAULT_SLOT: BlockNode[] = tpl("tpl-landing", () => [n("hero"), n("featureGrid")]).slice(0, 4);

const LAYOUTS: LayoutDraft[] = [
  {
    id: "lay_default", siteId: "site_main", name: "Default Website Layout",
    desc: "The workspace-wide shell: announcement, sticky header, content slot, footer.",
    scope: "builtin", isDefault: true, archived: false,
    announcement: { regionId: "reg_announce", variantId: "ann_intake", visible: true },
    header: { regionId: "reg_header", variantId: "hdr_v2", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_v1", visible: true },
    slot: { seed: DEFAULT_SLOT, policy: policy(ALL, 200), allowedCount: ALL.length },
    seoChecklist: [
      { id: "h1", label: "Single H1 per page", ok: true },
      { id: "meta", label: "Title and description inherited", ok: true },
      { id: "schema", label: "Organization schema", ok: true }
    ],
    thumbnail: { url: "", revHash: "a91f0c", renderedAt: "2026-11-08T09:12:00Z" },
    dirty: false, rev: 4, updatedAt: "2026-11-08T09:12:00Z", updatedBy: "Priya Nair", createdAt: "2026-05-02T10:00:00Z"
  },
  {
    id: "lay_blank", siteId: "site_main", name: "Blank Landing Layout",
    desc: "No global nav, 12-block ceiling, form-friendly — paid campaigns only.",
    scope: "workspace", isDefault: false, archived: false,
    announcement: { regionId: "reg_announce", variantId: "ann_none", visible: false, hideReason: "Paid traffic must not see site-wide promos" },
    header: { regionId: "reg_header", variantId: "hdr_min", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_slim", visible: true },
    slot: { seed: [n("hero", { props: { align: "center" } }), n("form")], policy: policy(["hero", "heading", "text", "form", "image", "video", "button", "faq", "testimonials", "divider"], 12), allowedCount: 10 },
    seoChecklist: [
      { id: "h1", label: "Single H1 per page", ok: true },
      { id: "meta", label: "Title and description inherited", ok: true },
      { id: "noindex", label: "No-index flag for paid traffic", ok: true }
    ],
    thumbnail: { url: "", revHash: "7c2b41", renderedAt: "2026-10-28T15:30:00Z" },
    dirty: true, rev: 3, updatedAt: "2026-11-09T11:02:00Z", updatedBy: "Arjun Mehta", createdAt: "2026-07-11T09:00:00Z"
  },
  {
    id: "lay_campaign", siteId: "site_main", name: "Campaign Landing Layout",
    desc: "Announcement-led funnel page with a slim footer and no sidebar links.",
    scope: "site", isDefault: false, archived: false,
    announcement: { regionId: "reg_announce", variantId: "ann_schol", visible: true },
    header: { regionId: "reg_header", variantId: "hdr_min", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_slim", visible: true },
    slot: { seed: [n("hero", { props: { align: "split" } }), n("ctaSection")], policy: policy(["hero", "heading", "text", "image", "video", "form", "ctaSection", "list", "faq", "divider"] as BlockType[], 40), allowedCount: 10 },
    seoChecklist: [
      { id: "h1", label: "Single H1 per page", ok: true },
      { id: "meta", label: "Title and description inherited", ok: false }
    ],
    thumbnail: null,
    dirty: true, rev: 2, updatedAt: "2026-11-12T18:44:00Z", updatedBy: "Priya Nair", createdAt: "2026-09-19T12:30:00Z"
  },
  {
    id: "lay_blog", siteId: "site_main", name: "Blog Article Layout",
    desc: "Wide prose column with breadcrumb-friendly header and 4-column footer.",
    scope: "workspace", isDefault: false, archived: false,
    announcement: { regionId: "reg_announce", variantId: "ann_none", visible: false, hideReason: "Editorial pages stay promo-free" },
    header: { regionId: "reg_header", variantId: "hdr_v2", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_v1", visible: true },
    slot: { seed: tpl("tpl-article", () => [n("heading"), n("text"), n("quote"), n("text")]), policy: policy(["heading", "text", "image", "quote", "table", "list", "divider", "video", "ctaSection"], 120), allowedCount: 9 },
    seoChecklist: [
      { id: "h1", label: "Single H1 per page", ok: true },
      { id: "meta", label: "Title and description inherited", ok: true },
      { id: "author", label: "Author schema", ok: true }
    ],
    thumbnail: { url: "", revHash: "3de8aa", renderedAt: "2026-11-02T08:15:00Z" },
    dirty: false, rev: 6, updatedAt: "2026-11-02T08:15:00Z", updatedBy: "Neha Kulkarni", createdAt: "2026-06-04T14:10:00Z"
  },
  {
    id: "lay_funnel", siteId: "site_main", name: "Application Funnel Layout",
    desc: "Single-objective shell: no announcement, minimal header, legal footer.",
    scope: "site", isDefault: false, archived: false,
    announcement: { regionId: "reg_announce", variantId: "ann_none", visible: false, hideReason: "One objective per page" },
    header: { regionId: "reg_header", variantId: "hdr_min", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_slim", visible: true },
    slot: { seed: [n("heading"), n("form"), n("faq")], policy: policy(["heading", "text", "form", "faq", "testimonials", "button", "divider"], 24), allowedCount: 7 },
    seoChecklist: [
      { id: "h1", label: "Single H1 per page", ok: true },
      { id: "meta", label: "Title and description inherited", ok: false }
    ],
    thumbnail: null,
    dirty: false, rev: 1, updatedAt: "2026-10-30T10:00:00Z", updatedBy: "Arjun Mehta", createdAt: "2026-10-30T10:00:00Z"
  },
  /* one archived layout proves the guarded-delete + preflight paths */
  {
    id: "lay_legacy", siteId: "site_main", name: "2024 Landing Layout", desc: "Retired after the 2025 brand refresh.", scope: "workspace", isDefault: false, archived: true,
    announcement: { regionId: "reg_announce", variantId: "ann_none", visible: false, hideReason: "Archived" },
    header: { regionId: "reg_header", variantId: "hdr_v2", visible: true },
    footer: { regionId: "reg_footer", variantId: "ftr_v1", visible: true },
    slot: { seed: [n("hero")], policy: policy(ALL, 200), allowedCount: ALL.length },
    seoChecklist: [{ id: "h1", label: "Single H1 per page", ok: false }],
    thumbnail: null, dirty: false, rev: 9, updatedAt: "2026-04-18T10:00:00Z", updatedBy: "Priya Nair", createdAt: "2024-11-01T10:00:00Z"
  }
];

/* ---------------- templates (12) ---------------- */

interface TplSeed { name: string; intent: string; desc: string; layoutId: string; from?: string; build: () => BlockNode[]; }

const TP: TplSeed[] = [
  { name: "Lead Generation", intent: "Conversion", desc: "Split hero, three proof points, short enquiry form.", layoutId: "lay_campaign", build: () => [n("hero", { props: { align: "split" } }), n("featureGrid"), n("form"), n("testimonials")] },
  { name: "Product Landing", intent: "Conversion", desc: "Hero, media features, comparison table, CTA form.", layoutId: "lay_campaign", build: () => [n("hero"), n("featureGrid"), n("table"), n("form")] },
  { name: "About Us", intent: "Trust", desc: "Story, numbers, team grid and closing CTA.", layoutId: "lay_default", from: "tpl-about", build: () => [n("heading"), n("text"), n("featureGrid"), n("ctaSection")] },
  { name: "Contact", intent: "Support", desc: "Address block, office hours, enquiry form.", layoutId: "lay_default", build: () => [n("heading"), n("columns"), n("form"), n("faq")] },
  { name: "Study Program", intent: "Programme", desc: "Hero, proof, destinations, enquiry form.", layoutId: "lay_default", from: "tpl-program", build: () => [n("hero"), n("featureGrid"), n("columns"), n("form")] },
  { name: "University Partner", intent: "Programme", desc: "University hero, intake table, testimonials, form.", layoutId: "lay_default", build: () => [n("hero"), n("table"), n("testimonials"), n("form")] },
  { name: "Scholarship", intent: "Programme", desc: "Deadline alert, eligibility list, FAQ, form.", layoutId: "lay_campaign", from: "tpl-scholarship", build: () => [n("alert"), n("list"), n("faq"), n("form")] },
  { name: "Event", intent: "Campaign", desc: "Event hero, agenda list, venue media, RSVP form.", layoutId: "lay_campaign", from: "tpl-event", build: () => [n("hero"), n("list"), n("video"), n("form")] },
  { name: "Blog Article", intent: "Editorial", desc: "Prose column with pull quote and related links.", layoutId: "lay_blog", from: "tpl-article", build: () => [n("heading"), n("text"), n("quote"), n("text"), n("ctaSection")] },
  { name: "Application Funnel", intent: "Conversion", desc: "One objective: step heading, form, objection FAQ.", layoutId: "lay_funnel", build: () => [n("heading"), n("form"), n("faq")] },
  { name: "Intake Landing", intent: "Campaign", desc: "Hero, intake cards, deadline alert, form.", layoutId: "lay_campaign", from: "tpl-landing", build: () => [n("hero"), n("columns"), n("alert"), n("form")] },
  { name: "Policy & Legal", intent: "Trust", desc: "Heading, clauses, revision table, contact line.", layoutId: "lay_blog", build: () => [n("heading"), n("text"), n("table"), n("text")] }
];

const TEMPLATES: PageTemplateDoc[] = TP.map((t, i) => ({
  id: `tpl_${slug(t.name)}`,
  siteId: "site_main",
  name: t.name,
  intent: t.intent,
  desc: t.desc,
  scope: i < 8 ? "builtin" : "workspace",
  builtIn: i < 8,
  layoutId: t.layoutId,
  blocks: t.build(),
  seoReady: i !== 4 && i !== 11,
  rev: 1 + (i % 5),
  updatedAt: `2026-11-0${1 + (i % 9)}T09:${String(10 + i).padStart(2, "0")}:00Z`,
  updatedBy: ["Priya Nair", "Arjun Mehta", "Neha Kulkarni"][i % 3],
  origin: { kind: "builtin" }
}));

/* ---------------- mutable store ---------------- */

interface Db { layouts: LayoutDraft[]; templates: PageTemplateDoc[]; regions: SharedRegion[]; revisions: LayoutRevision[]; seq: number }

let db: Db | null = null;

function get(): Db {
  if (!db) {
    db = {
      layouts: clone(LAYOUTS), templates: clone(TEMPLATES), regions: clone(REGIONS), seq: 0,
      revisions: [
        { id: "rev_seed_1", targetId: "lay_default", kind: "layout", rev: 4, at: "2026-11-08T09:12:00Z", by: "Priya Nair", summary: "Header v2 pinned, announcement updated", snapshot: null },
        { id: "rev_seed_2", targetId: "lay_default", kind: "layout", rev: 3, at: "2026-10-21T15:40:00Z", by: "Arjun Mehta", summary: "Footer moved to v1", snapshot: null },
        { id: "rev_seed_3", targetId: "lay_blank", kind: "layout", rev: 3, at: "2026-11-09T11:02:00Z", by: "Arjun Mehta", summary: "Block ceiling reduced to 12", snapshot: null },
        { id: "rev_seed_4", targetId: "tpl_lead-generation", kind: "template", rev: 1, at: "2026-11-02T10:20:00Z", by: "Priya Nair", summary: "Created from Product Landing", snapshot: null }
      ]
    };
    /* the seeded history predates stored structures; the seed *is* the structure
       those revisions describe, so record it rather than pretending they cannot
       be restored. */
    db.revisions = db.revisions.map((r) => {
      if (r.snapshot) return r;
      const target = r.kind === "layout" ? db!.layouts.find((l) => l.id === r.targetId) : db!.templates.find((t) => t.id === r.targetId);
      return target ? { ...r, snapshot: structureOf(r.kind, target) } : r;
    });
  }
  return db;
}

/* ---------------- resolution ---------------- */

export const DEFAULT_ALIAS = "Site default";
export const BLANK_ALIAS = "Blank landing";

/** the one place a page string becomes a layout id */
export function resolveLayoutId(label: string | null | undefined, layouts = get().layouts): string | null {
  if (!label) return null;
  if (label === DEFAULT_ALIAS) return layouts.find((l) => l.isDefault)?.id ?? null;
  if (label === BLANK_ALIAS) return layouts.find((l) => l.id === "lay_blank")?.id ?? layouts.find((l) => /blank/i.test(l.name))?.id ?? null;
  const byName = layouts.find((l) => l.name.toLowerCase() === label.toLowerCase());
  if (byName) return byName.id;
  const byId = layouts.find((l) => l.id === label);
  return byId ? byId.id : null;
}

/** what Module 3 stores when a layout is chosen */
export function labelFor(layoutId: string | null): string {
  if (!layoutId) return DEFAULT_ALIAS;
  const l = get().layouts.find((x) => x.id === layoutId);
  if (!l) return DEFAULT_ALIAS;
  return l.isDefault ? DEFAULT_ALIAS : l.name;
}

export function pagesFor(siteId: string) {
  return DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
}

export function usageRows(siteId: string, layoutId: string | null): UsageRow[] {
  const layouts = get().layouts;
  return pagesFor(siteId).map((p) => {
    const id = resolveLayoutId(p.layout, layouts);
    const mode: UsageRow["mode"] = id === null ? "none" : p.layout === DEFAULT_ALIAS ? "inherited" : "explicit";
    return { id: p.id, title: p.title, path: p.path, status: p.status, hasChanges: p.hasChanges, layoutId: id, mode, updated: p.updated };
  }).filter((r) => r.layoutId === layoutId);
}

function groupOf(path: string, type: string): string {
  const p = path.toLowerCase();
  if (p === "/" || /\/(about|contact|privacy|terms|faq|refund|disclaimer)/.test(p)) return "Information";
  if (/(scholarship|program|course|intake)/.test(p)) return "Program";
  if (/(universit|partner|college)/.test(p)) return "University";
  if (/(landing|lp|apply|get-started|campaign)/.test(p) || type === "landing") return "Landing";
  if (/(blog|guide|news|article|story)/.test(p)) return "Other";
  if (/(study-abroad|destination|country)/.test(p)) return "Main";
  return "Other";
}

const GROUP_ORDER = ["Main", "Landing", "Program", "University", "Information", "Other"];
const GROUP_HINT: Record<string, string> = {
  Main: "Top-level navigation routes",
  Landing: "Campaign and funnel entries",
  Program: "Programmes, courses, intakes",
  University: "Partner institution pages",
  Information: "Static trust pages",
  Other: "Editorial and long tail"
};

export function groups(siteId: string): PageGroupCard[] {
  const pages = pagesFor(siteId);
  const buckets = new Map<string, string[]>();
  pages.forEach((p) => {
    const g = groupOf(p.path, p.type);
    buckets.set(g, [...(buckets.get(g) ?? []), p.path]);
  });
  return GROUP_ORDER.filter((g) => (buckets.get(g) ?? []).length > 0).map((g) => {
    const routes = buckets.get(g) ?? [];
    return { id: slug(g), name: g, hint: GROUP_HINT[g], pages: routes.length, routes: routes.slice(0, 3).join(" · ") };
  });
}

export function kpis(siteId: string): Kpis {
  const layouts = get().layouts.filter((l) => l.siteId === siteId || l.scope !== "site");
  const live = layouts.filter((l) => !l.archived);
  const pages = pagesFor(siteId);
  return {
    layouts: live.length,
    templates: get().templates.filter((t) => t.siteId === siteId).length,
    pagesAssigned: pages.filter((p) => resolveLayoutId(p.layout) !== null).length,
    draftChanges: live.filter((l) => l.dirty).length + get().templates.filter((t) => !t.builtIn).length
  };
}

export function preflight(siteId: string): PreflightIssue[] {
  const out: PreflightIssue[] = [];
  const layouts = get().layouts;
  const pages = pagesFor(siteId);
  const unknown = pages.filter((p) => resolveLayoutId(p.layout, layouts) === null);
  if (unknown.length) out.push({ id: "pf_unknown", severity: "error", label: `${unknown.length} page${unknown.length > 1 ? "s" : ""} point at a layout that no longer exists`, detail: unknown.slice(0, 3).map((p) => `${p.title} → “${p.layout}”`).join(" · "), fix: "Reassign to the default layout" });
  const orphan = pages.filter((p) => { const id = resolveLayoutId(p.layout, layouts); return id && layouts.find((l) => l.id === id)?.archived; });
  if (orphan.length) out.push({ id: "pf_archived", severity: "error", label: `${orphan.length} page${orphan.length > 1 ? "s" : ""} bound to an archived layout`, detail: orphan.slice(0, 3).map((p) => p.title).join(" · "), fix: "Reassign before publishing" });
  const def = layouts.find((l) => l.isDefault && !l.archived);
  if (!def) out.push({ id: "pf_nodefault", severity: "error", label: "No default layout", detail: "New pages would have no shell.", fix: "Set a layout as website default" });
  const noFooter = layouts.filter((l) => !l.archived && !l.footer.visible);
  if (noFooter.length) out.push({ id: "pf_footer", severity: "warn", label: `${noFooter.length} live layout${noFooter.length > 1 ? "s" : ""} hide the footer`, detail: noFooter.map((l) => l.name).join(" · ") });
  const seo = layouts.filter((l) => !l.archived && l.seoChecklist.some((c) => !c.ok));
  if (seo.length) out.push({ id: "pf_seo", severity: "warn", label: `${seo.length} layout${seo.length > 1 ? "s" : ""} not SEO-ready`, detail: seo.map((l) => l.name).join(" · ") });
  const hidden = layouts.filter((l) => !l.archived && (!l.announcement.visible && !l.announcement.hideReason));
  if (hidden.length) out.push({ id: "pf_reason", severity: "warn", label: "A hidden region has no reason recorded", detail: hidden.map((l) => l.name).join(" · "), fix: "Add a reason" });
  return out;
}

/** Build the frame for a specific layout object — this is what the editor's
    canvas needs, because it must follow the *working copy*, not the store. */
export function frameOf(l: LayoutDraft): LayoutFrame {
  const variant = (ref: RegionRef) => {
    const reg = get().regions.find((r) => r.id === ref.regionId);
    return reg?.variants.find((v) => v.id === ref.variantId) ?? null;
  };
  const h = variant(l.header);
  const f = variant(l.footer);
  const a = variant(l.announcement);
  const textOf = (blocks: BlockNode[]) => {
    const found = blocks.map((b) => (b.props as any)?.text).filter(Boolean)[0];
    return found ? String(found) : "";
  };
  const headerProps = (h?.blocks[0]?.props ?? {}) as any;
  const footerProps = (f?.blocks[0]?.props ?? {}) as any;
  const issues: PreflightIssue[] = [];
  if (l.archived) issues.push({ id: "f_arch", severity: "error", label: "Layout is archived", detail: l.name });
  if (!l.header.visible) issues.push({ id: "f_hdr", severity: "warn", label: "Header hidden", detail: l.header.hideReason ?? "no reason" });
  return {
    layoutId: l.id,
    layoutName: l.name,
    announcement: a && l.announcement.visible ? { text: textOf(a.blocks), visible: true } : null,
    header: h && l.header.visible ? {
      name: h.name,
      brand: headerProps.brand ?? "EuroMiles.in",
      nav: (headerProps.nav as string[]) ?? ["Home"],
      cta: headerProps.cta ?? "Enquire Now",
      variant: h.name
    } : null,
    footer: f && l.footer.visible ? {
      name: f.name,
      variant: f.name,
      columns: ["Brand", ...footerGroups(footerProps).map((g) => g.title)].slice(0, footerCols(footerProps)),
      note: String(footerProps.note ?? ""),
      groups: footerGroups(footerProps)
    } : null,
    slotPolicy: l.slot.policy,
    issues
  };
}

/** How much of the workspace each block type is actually used in.
    Module 5 reads this so the library can rank by real usage, not by taste. */
export interface BlockUsage { layouts: number; templates: number; chrome: number; total: number }

export function blockUsage(): Record<string, BlockUsage> {
  const d = get();
  const out: Record<string, BlockUsage> = {};
  const bump = (type: string, field: "layouts" | "templates" | "chrome") => {
    if (!out[type]) out[type] = { layouts: 0, templates: 0, chrome: 0, total: 0 };
    out[type][field] += 1;
    out[type].total += 1;
  };
  const seenL = new Map<string, Set<string>>();
  const seenT = new Map<string, Set<string>>();
  for (const l of d.layouts) {
    for (const b of l.slot.seed) {
      if (!seenL.has(b.type)) seenL.set(b.type, new Set());
      if (seenL.get(b.type)!.has(l.id)) continue;
      seenL.get(b.type)!.add(l.id);
      bump(b.type, "layouts");
    }
  }
  for (const t of d.templates) {
    for (const b of t.blocks) {
      if (!seenT.has(b.type)) seenT.set(b.type, new Set());
      if (seenT.get(b.type)!.has(t.id)) continue;
      seenT.get(b.type)!.add(t.id);
      bump(b.type, "templates");
    }
  }
  for (const r of d.regions) for (const v of r.variants) for (const b of v.blocks) bump(b.type, "chrome");
  return out;
}

/** The navigation M8 will own: the header variant the resolved layout actually points at. */
export interface HeaderNav {
  layoutId: string | null;
  layoutName: string;
  variantId: string | null;
  variantName: string;
  items: string[];
  visible: boolean;
  hideReason?: string;
}

export function headerNavFor(pageLayout: string): HeaderNav {
  const id = resolveLayoutId(pageLayout);
  const l = get().layouts.find((x) => x.id === id) ?? null;
  if (!l) return { layoutId: null, layoutName: "No layout", variantId: null, variantName: "—", items: [], visible: false };
  const reg = get().regions.find((r) => r.id === l.header.regionId);
  const v = reg?.variants.find((x) => x.id === l.header.variantId) ?? null;
  const props = (v?.blocks[0]?.props ?? {}) as Partial<HeaderChromeProps>;
  return {
    layoutId: l.id,
    layoutName: l.name,
    variantId: v?.id ?? null,
    variantName: v?.name ?? "—",
    items: l.header.visible ? (props.nav ?? []) : [],
    visible: l.header.visible,
    hideReason: l.header.hideReason
  };
}

export function frameFor(_siteId: string, pageLayout: string): LayoutFrame {
  const l = get().layouts.find((x) => x.id === resolveLayoutId(pageLayout));
  if (!l) {
    return { layoutId: null, layoutName: "Unassigned", announcement: null, header: null, footer: null, slotPolicy: policy(ALL, 200), issues: [{ id: "frame_none", severity: "error", label: "No layout resolves for this page", detail: String(pageLayout) }] };
  }
  return frameOf(l);
}

/* ---------------- API ---------------- */

export const mode = { fail: false, slow: false, conflict: false, empty: false };

const wait = (min: number, max: number) =>
  new Promise<void>((r) => setTimeout(r, (mode.slow ? 4 : 1) * (min + Math.random() * (max - min))));

const hash = (v: unknown) => {
  const s = JSON.stringify(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).slice(0, 6);
};

function structureOf(kind: "layout" | "template", target: LayoutDraft | PageTemplateDoc): StructureSnapshot {
  if (kind === "layout") {
    const l = target as LayoutDraft;
    return {
      name: l.name, desc: l.desc,
      announcement: clone(l.announcement), header: clone(l.header), footer: clone(l.footer),
      slot: { seed: clone(l.slot.seed), policy: clone(l.slot.policy) },
      allowedCount: l.slot.policy.allow.length || ALL.length,
      blocks_n: l.slot.seed.length
    };
  }
  const t = target as PageTemplateDoc;
  return { name: t.name, desc: t.desc, blocks: clone(t.blocks), blocks_n: t.blocks.length };
}

function snapshot(target: LayoutDraft | PageTemplateDoc, kind: "layout" | "template", summary: string) {
  const d = get();
  d.seq += 1;
  d.revisions.unshift({
    id: `rev_${d.seq}`, targetId: target.id, kind, rev: target.rev, at: now(), by: "Priya Nair",
    summary, snapshot: structureOf(kind, target)
  });
}

export const LayoutsAPI = {
  async load(siteId: string): Promise<LayoutPayload> {
    await wait(240, 520);
    if (mode.fail) throw new Err("E_LOAD", "Could not reach the layout service. The last good copy is still on disk.");
    const d = get();
    return {
      siteId,
      layouts: mode.empty ? [d.layouts.find((l) => l.isDefault)!] : clone(d.layouts),
      templates: mode.empty ? [] : clone(d.templates),
      regions: clone(d.regions),
      kpis: kpis(siteId),
      groups: groups(siteId),
      revisions: clone(d.revisions.slice(0, 40)),
      preflight: preflight(siteId),
      updatedAt: now()
    };
  },

  /** compare-and-swap: the client sends the revision it opened */
  async saveLayout(draft: LayoutDraft, expectedRev: number): Promise<LayoutDraft> {
    await wait(280, 620);
    if (mode.fail) throw new Err("E_SAVE", "Save failed — the layout service is unreachable.");
    const d = get();
    const live = d.layouts.find((l) => l.id === draft.id);
    if (!live) throw new Err("E_MISSING", "That layout was removed in another tab.");
    if (live.rev !== expectedRev) throw new Err("E_CONFLICT", `Someone saved ${live.name} at revision ${live.rev} while you were editing. Reload their version or overwrite.`);
    if (mode.conflict) throw new Err("E_CONFLICT", `Someone saved ${live.name} at revision ${live.rev + 1} while you were editing.`);
    if (!draft.name.trim()) throw new Err("E_VALID", "A layout needs a name.");
    if (d.layouts.some((l) => l.id !== draft.id && l.name.toLowerCase() === draft.name.trim().toLowerCase())) throw new Err("E_VALID", "That layout name is already in use.");
    if (draft.slot.seed.length > draft.slot.policy.maxBlocks) throw new Err("E_POLICY", `The slot seed exceeds this layout's ${draft.slot.policy.maxBlocks}-block ceiling.`);
    const next: LayoutDraft = {
      ...clone(draft), name: draft.name.trim(), rev: live.rev + 1, updatedAt: now(), updatedBy: "Priya Nair",
      dirty: false, thumbnail: { url: "", revHash: hash(draft), renderedAt: now() },
      slot: { ...draft.slot, allowedCount: draft.slot.policy.allow.length || ALL.length }
    };
    d.layouts = d.layouts.map((l) => (l.id === next.id ? next : l));
    snapshot(next, "layout", "Saved draft");
    return clone(next);
  },

  async saveTemplate(doc: PageTemplateDoc, expectedRev: number): Promise<PageTemplateDoc> {
    await wait(240, 520);
    if (mode.fail) throw new Err("E_SAVE", "Template save failed.");
    const d = get();
    const live = d.templates.find((t) => t.id === doc.id);
    if (!live) throw new Err("E_MISSING", "That template no longer exists.");
    if (live.rev !== expectedRev) throw new Err("E_CONFLICT", `${live.name} moved to revision ${live.rev}.`);
    if (!doc.name.trim()) throw new Err("E_VALID", "A template needs a name.");
    if (d.templates.some((t) => t.id !== doc.id && t.name.toLowerCase() === doc.name.trim().toLowerCase())) throw new Err("E_VALID", "That template name is already in use.");
    const next: PageTemplateDoc = { ...clone(doc), name: doc.name.trim(), rev: live.rev + 1, updatedAt: now(), updatedBy: "Priya Nair" };
    d.templates = d.templates.map((t) => (t.id === next.id ? next : t));
    snapshot(next, "template", "Saved template");
    return clone(next);
  },

  async setDefault(id: string): Promise<LayoutDraft> {
    await wait(200, 400);
    const d = get();
    const target = d.layouts.find((l) => l.id === id);
    if (!target) throw new Err("E_MISSING", "Layout not found.");
    if (target.archived) throw new Err("E_VALID", "An archived layout cannot be the website default.");
    d.layouts = d.layouts.map((l) => ({ ...l, isDefault: l.id === id, rev: l.id === id ? l.rev + 1 : l.rev }));
    snapshot(target, "layout", "Set as website default");
    return clone(d.layouts.find((l) => l.id === id)!);
  },

  async createLayout(siteId: string, name: string, fromId?: string): Promise<LayoutDraft> {
    await wait(260, 520);
    if (mode.fail) throw new Err("E_SAVE", "Could not create the layout.");
    const d = get();
    const clean = name.trim();
    if (!clean) throw new Err("E_VALID", "A layout needs a name.");
    if (clean.length > 60) throw new Err("E_VALID", "Layout names are limited to 60 characters.");
    if (d.layouts.some((l) => l.name.toLowerCase() === clean.toLowerCase())) throw new Err("E_VALID", "That layout name is already in use.");
    const base = d.layouts.find((l) => l.id === fromId) ?? d.layouts.find((l) => l.isDefault)!;
    const id = `lay_${slug(clean)}_${d.layouts.length + 1}`;
    const next: LayoutDraft = {
      ...clone(base), id, name: clean, desc: fromId ? `Copied from ${base.name}.` : "New layout — pick regions and a slot policy.",
      scope: "workspace", isDefault: false, archived: false, dirty: true, rev: 1,
      createdAt: now(), updatedAt: now(), updatedBy: "Priya Nair", thumbnail: null, siteId,
      slot: { ...clone(base.slot), seed: [] }
    };
    d.layouts = [next, ...d.layouts];
    snapshot(next, "layout", fromId ? `Duplicated from ${base.name}` : "Created");
    return clone(next);
  },

  async createTemplate(siteId: string, name: string, layoutId: string, fromId?: string): Promise<PageTemplateDoc> {
    await wait(240, 480);
    const d = get();
    const clean = name.trim();
    if (!clean) throw new Err("E_VALID", "A template needs a name.");
    if (d.templates.some((t) => t.name.toLowerCase() === clean.toLowerCase())) throw new Err("E_VALID", "That template name is already in use.");
    const base = d.templates.find((t) => t.id === fromId);
    const next: PageTemplateDoc = {
      id: `tpl_${slug(clean)}_${d.templates.length + 1}`, siteId, name: clean,
      intent: base?.intent ?? "Custom", desc: base ? `Copied from ${base.name}.` : "New starter — open it in the builder to compose.",
      scope: "workspace", builtIn: false, layoutId: layoutId || "lay_default",
      blocks: clone(base?.blocks ?? [n("heading"), n("text")]),
      seoReady: false, rev: 1, updatedAt: now(), updatedBy: "Priya Nair"
    };
    d.templates = [next, ...d.templates];
    snapshot(next, "template", base ? `Duplicated from ${base.name}` : "Created");
    return clone(next);
  },

  /** archive = soft delete. In-use layouts are refused, not silently cascaded. */
  async archive(kind: "layout" | "template", id: string): Promise<void> {
    await wait(200, 420);
    const d = get();
    if (kind === "layout") {
      const l = d.layouts.find((x) => x.id === id);
      if (!l) throw new Err("E_MISSING", "Layout not found.");
      if (l.isDefault) throw new Err("E_IN_USE", `${l.name} is the website default. Set another default first.`);
      const used = usageRows(l.siteId, l.id).length;
      if (used) throw new Err("E_IN_USE", `${l.name} is bound to ${used} page${used > 1 ? "s" : ""}. Reassign them before deleting.`);
      if (l.archived) throw new Err("E_VALID", "Already archived.");
      d.layouts = d.layouts.map((x) => (x.id === id ? { ...x, archived: true, rev: x.rev + 1 } : x));
      snapshot(l, "layout", "Archived");
      return;
    }
    const t = d.templates.find((x) => x.id === id);
    if (!t) throw new Err("E_MISSING", "Template not found.");
    if (t.builtIn) throw new Err("E_IN_USE", `${t.name} is a built-in template shipped with the workspace. Duplicate it to customise.`);
    d.templates = d.templates.filter((x) => x.id !== id);
    snapshot(t, "template", "Deleted");
  },

  async restore(kind: "layout" | "template", id: string): Promise<void> {
    await wait(160, 320);
    const d = get();
    if (kind === "layout") {
      const l = d.layouts.find((x) => x.id === id);
      if (!l) throw new Err("E_MISSING", "Layout not found.");
      d.layouts = d.layouts.map((x) => (x.id === id ? { ...x, archived: false, rev: x.rev + 1 } : x));
      snapshot(l, "layout", "Restored");
    }
  },

  /** bulk rebind, capped at 40 rows — one audit event, not forty */
  async reassign(siteId: string, pageIds: string[], layoutId: string): Promise<{ moved: number; label: string }> {
    await wait(320, 640);
    if (!pageIds.length) throw new Err("E_VALID", "Select at least one page.");
    if (pageIds.length > 40) throw new Err("E_LIMIT", "Bulk reassign is capped at 40 pages per action.");
    const d = get();
    const target = d.layouts.find((l) => l.id === layoutId);
    if (!target) throw new Err("E_MISSING", "Layout not found.");
    if (target.archived) throw new Err("E_VALID", "Archived layouts cannot take new pages.");
    const label = labelFor(layoutId);
    let moved = 0;
    DBX().cmsPages = DBX().cmsPages.map((p) => {
      if (p.siteId !== siteId || !pageIds.includes(p.id)) return p;
      moved += 1;
      return { ...p, layout: label, hasChanges: true, updatedAt: now(), updated: "just now", revision: p.revision + 1 };
    });
    snapshot(target, "layout", `Reassigned ${moved} page${moved > 1 ? "s" : ""} to this layout`);
    return { moved, label };
  },

  /** import: prebuilt kits, HTML uploads and JSON bundles all land here */
  async importTemplates(siteId: string, items: { name: string; blocks: BlockNode[]; intent?: string; layoutId?: string; origin: TemplateOrigin }[]): Promise<PageTemplateDoc[]> {
    await wait(320, 640);
    if (mode.fail) throw new Err("E_SAVE", "The template service is unreachable — nothing was imported.");
    const d = get();
    if (!items.length) throw new Err("E_VALID", "Nothing to import.");
    const budget = 120;
    if (d.templates.length + items.length > budget) throw new Err("E_LIMIT", `This workspace holds ${budget} templates. Import fewer, or delete one first.`);
    const made: PageTemplateDoc[] = [];
    for (const item of items) {
      const base = (item.name || "Imported template").trim().slice(0, 60);
      let name = base || "Imported template";
      let n = 2;
      while (d.templates.some((t) => t.name.toLowerCase() === name.toLowerCase())) name = `${base} ${n++}`.slice(0, 60);
      const blocks = clone(item.blocks).slice(0, 40);
      if (!blocks.length) throw new Err("E_VALID", `“${base}” produced no blocks.`);
      const doc: PageTemplateDoc = {
        id: `tpl_${slug(name)}_${d.templates.length + 1}`,
        siteId,
        name,
        intent: item.intent ?? "Imported",
        desc: item.origin.kind === "prebuilt"
          ? `Imported from the prebuilt library · ${item.origin.name ?? "open-source starter"} (${item.origin.license ?? "MIT"}). Structure and copy only.`
          : item.origin.kind === "builder"
            ? `Saved from ${item.origin.name ?? "a page"} in the builder. ${blocks.length} sections copied; the page it came from is untouched.`
            : `Imported ${item.origin.kind === "html" ? "from HTML" : "from a JSON bundle"}${item.origin.name ? ` · ${item.origin.name}` : ""}. ${blocks.length} blocks extracted.`,
        scope: "workspace",
        builtIn: false,
        layoutId: item.layoutId || d.layouts.find((l) => l.isDefault)?.id || "lay_default",
        blocks,
        seoReady: false,
        rev: 1,
        updatedAt: now(),
        updatedBy: "Priya Nair",
        origin: { ...item.origin, importedAt: now() }
      };
      d.templates = [doc, ...d.templates];
      snapshot(doc, "template", `Imported (${doc.origin?.kind})`);
      made.push(doc);
    }
    return clone(made);
  },

  /** copy-on-create: template blocks become page blocks, once */
  async createPageFromTemplate(siteId: string, templateId: string, title: string, parentId: string | null): Promise<{ id: string; title: string; path: string }> {
    await wait(300, 600);
    const d = get();
    const t = d.templates.find((x) => x.id === templateId);
    if (!t) throw new Err("E_MISSING", "Template not found.");
    const clean = title.trim() || `${t.name} page`;
    const routes = pagesFor(siteId).filter((p) => p.type === "landing").length + 1;
    const path = `/${slug(clean)}-${routes}`;
    if (pagesFor(siteId).some((p) => p.path === path)) throw new Err("E_VALID", "A page already uses that path.");
    const id = `pg_${slug(clean)}_${routes}`;
    const page: any = {
      id, siteId, title: clean, slug: slug(clean), path, parentId, type: "Landing", status: "draft",
      hasChanges: true, isHome: false, locale: "en-IN", template: t.name, layout: labelFor(t.layoutId),
      order: 99, blocks: t.blocks.length, views: 0, leads: 0,
      createdAt: now(), createdBy: "Priya Nair", updatedAt: now(), updated: "just now", author: "Priya Nair",
      seo: { title: clean, description: t.desc }, revision: 1, trash: null, inbound: 0
    };
    DBX().cmsPages = [page, ...DBX().cmsPages];
    /* hand the composition to Module 4 so "Open in Builder" is not a dead link */
    const builder = (await import("./builder-db")).BuilderAPI;
    try {
      const d0 = await builder.getDraft(id);
      await builder.saveDraft(id, clone(t.blocks), d0.revision);
    } catch { /* the builder store is lazy; the page still opens from Pages */ }
    snapshot(t, "template", `Created page “${clean}”`);
    return { id, title: clean, path };
  },

  async saveRegionVariant(regionId: string, variant: RegionVariant): Promise<SharedRegion> {
    await wait(240, 460);
    const d = get();
    const region = d.regions.find((r) => r.id === regionId);
    if (!region) throw new Err("E_MISSING", "Region not found.");
    if (!variant.name.trim()) throw new Err("E_VALID", "A variant needs a name.");
    d.regions = d.regions.map((r) => r.id !== regionId ? r : {
      ...r,
      variants: r.variants.map((v) => v.id !== variant.id ? v : { ...clone(variant), name: variant.name.trim(), rev: v.rev + 1, updatedAt: now() })
    });
    const touched = d.regions.find((r) => r.id === regionId)!;
    const users = d.layouts.filter((l) => [l.header, l.footer, l.announcement].some((x) => x.regionId === regionId && x.variantId === variant.id));
    users.forEach((l) => {
      const i = d.layouts.findIndex((x) => x.id === l.id);
      d.layouts[i] = { ...l, dirty: true, rev: l.rev + 1, updatedAt: now(), updatedBy: "Priya Nair" };
    });
    return clone(touched);
  },

  /** every recorded revision of one target, newest first, with what can be restored */
  async history(kind: "layout" | "template", id: string): Promise<RevisionEntry[]> {
    await wait(160, 340);
    const d = get();
    const live = kind === "layout" ? d.layouts.find((x) => x.id === id) : d.templates.find((x) => x.id === id);
    const currentRev = live ? live.rev : -1;
    const rows = d.revisions.filter((r) => r.targetId === id && r.kind === kind);
    return rows.map((r, i) => {
      const prev = rows[i + 1];
      const a = r.snapshot?.blocks_n ?? 0;
      const b = prev?.snapshot?.blocks_n ?? 0;
      const diff = a - b;
      return {
        ...clone(r),
        restorable: !!r.snapshot,
        isCurrent: r.rev === currentRev,
        delta: i === rows.length - 1 ? `${a} blocks` : diff === 0 ? "no block change" : diff > 0 ? `+${diff} blocks` : `${diff} blocks`
      };
    });
  },

  /** restore the structure a revision recorded — as a new revision, never in place */
  async revert(kind: "layout" | "template", id: string, rev: number): Promise<void> {
    await wait(240, 460);
    const d = get();
    const entry = d.revisions.find((r) => r.targetId === id && r.kind === kind && r.rev === rev);
    if (!entry) throw new Err("E_MISSING", `Revision ${rev} is not in this record's history.`);
    if (!entry.snapshot) throw new Err("E_MISSING", `Revision ${rev} has no stored structure, so there is nothing to restore.`);
    const snap = entry.snapshot;

    if (kind === "layout") {
      const l = d.layouts.find((x) => x.id === id);
      if (!l) throw new Err("E_MISSING", "Layout not found.");
      if (l.archived) throw new Err("E_POLICY", "Restore the layout before rewinding its structure.");
      const next: LayoutDraft = {
        ...l, rev: l.rev + 1, dirty: true, updatedAt: now(), updatedBy: "Priya Nair",
        name: snap.name, desc: snap.desc,
        announcement: snap.announcement ?? l.announcement,
        header: snap.header ?? l.header,
        footer: snap.footer ?? l.footer,
        slot: snap.slot
          ? { ...clone(snap.slot), allowedCount: snap.slot.policy.allow.length || ALL.length }
          : l.slot
      };
      d.layouts = d.layouts.map((x) => x.id === id ? next : x);
      snapshot(next, "layout", `Restored the structure recorded at r${rev}`);
      return;
    }

    const t = d.templates.find((x) => x.id === id);
    if (!t) throw new Err("E_MISSING", "Template not found.");
    const next: PageTemplateDoc = {
      ...t, rev: t.rev + 1, updatedAt: now(), updatedBy: "Priya Nair",
      name: snap.name, desc: snap.desc, blocks: snap.blocks ? clone(snap.blocks) : t.blocks
    };
    d.templates = d.templates.map((x) => x.id === id ? next : x);
    snapshot(next, "template", `Restored the structure recorded at r${rev}`);
  },

  /** the picker list Module 3 and Module 4 both read */
  async forPicker(siteId: string): Promise<{ id: string; label: string; note: string }[]> {
    const layouts = get().layouts.filter((l) => !l.archived && (l.scope !== "site" || l.siteId === siteId));
    return layouts.map((l) => ({
      id: l.id,
      label: l.isDefault ? DEFAULT_ALIAS : l.name,
      note: l.isDefault ? "Website default — follows future default changes" : l.desc
    }));
  },

  sync(siteId: string) {
    return {
      kpis: kpis(siteId), groups: groups(siteId), preflight: preflight(siteId),
      layouts: clone(get().layouts), templates: clone(get().templates), regions: clone(get().regions),
      revisions: clone(get().revisions.slice(0, 40))
    };
  },

  /** Module 6 bundle hook — starter layouts travel with the theme */
  exportStarterLayouts() {
    const d = get();
    return {
      layouts: d.layouts.filter((l) => !l.archived).map((l) => ({
        id: l.id, name: l.name, isDefault: l.isDefault,
        regions: {
          announcement: { region: l.announcement.regionId, variant: l.announcement.variantId, visible: l.announcement.visible },
          header: { region: l.header.regionId, variant: l.header.variantId, visible: l.header.visible },
          footer: { region: l.footer.regionId, variant: l.footer.variantId, visible: l.footer.visible }
        },
        slot: { policy: l.slot.policy, seedBlocks: l.slot.seed.length }
      })),
      templates: d.templates.map((t) => ({ id: t.id, name: t.name, intent: t.intent, layoutId: t.layoutId, blocks: t.blocks.length }))
    };
  },

  reset() { db = null; }
};

export { GROUP_ORDER };
