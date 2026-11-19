/* ============================================================
   Module 8 · Menus & Navigation — data layer
   ------------------------------------------------------------
   Four kinds of record, each with a DRAFT and a LIVE copy:
     · menus       — ordered link trees (header, footer, utility, custom)
     · mega panels — reusable multi-column panels attached to a top-level item
     · placements  — which menu sits in which site location
     · versions    — numbered publishes; a rollback republishes an old one
   Save writes the draft (compare-and-swap on rev). Publish runs a preflight
   over every draft and copies drafts to live only if it has no errors.
   Links are typed: a page link stores the page id, and its path is resolved
   from the page registry at check time (MODULE-7-SPEC §LinkRef).
   ============================================================ */
import { DBX, type CmsPage } from "./data";
import { LayoutsAPI, layoutSnapshot, type LayoutDraft, type SharedRegion, type RegionVariant } from "./layout-db";
import { footerGroups, type FooterGroup } from "./footer";

/** Prototype states, driven by the app's state menu (see Menus.tsx). Off in normal use. */
export const mode = { fail: false, slow: false, empty: false, conflict: false };
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, mode.slow ? ms * 4 : ms));

export const MENU_LIMITS = { maxDepth: 3, maxColumns: 4, minColumns: 1, maxTop: 8, maxLabel: 40, maxLinksPerColumn: 8, maxItems: 80 } as const;

export type LinkRef = { kind: "page"; pageId: string } | { kind: "url"; url: string } | { kind: "anchor"; anchor: string };
export type Behaviour = "link" | "dropdown" | "mega";
export type Audience = "everyone" | "members" | "hidden";
export type Loc = "header" | "footer" | "utility";
export type Slot = "header" | "footer";
/** The layout slots a menu can fill. Utility needs a utility slot in a layout; none exists yet, so it is not assignable. */
export const LOCATIONS: Slot[] = ["header", "footer"];
export const LOC_LABEL: Record<Loc, string> = { header: "Header", footer: "Footer", utility: "Utility (no layout slot yet)" };
export type MenuType = "main" | "footer" | "utility";
export const MENU_TYPE_LABEL: Record<MenuType, string> = { main: "Main Menu", footer: "Footer Menu", utility: "Utility Menu" };
export type MobileBehaviour = "drawer" | "accordion";
export type Gap = "small" | "medium" | "large";

export interface MenuItem {
  id: string;
  label: string;
  link: LinkRef | null;
  newTab: boolean;
  audience: Audience;
  behaviour: Behaviour;
  /** behaviour "mega": the panel attached to this item */
  megaId: string | null;
  /** behaviour "dropdown": the sub-menu links */
  children: MenuItem[];
  /** Advanced tab: extra CSS class and rel attribute */
  cssClass: string;
  rel: "" | "nofollow" | "sponsored";
}

export interface MenuDoc {
  name: string;
  description: string;
  type: MenuType;
  items: MenuItem[];
  mobile: { behaviour: MobileBehaviour; openFirstLevel: boolean };
}
/** a layout slot this menu was compiled into, and the live revision it carried */
export interface AppliedRef { layoutId: string; slot: Slot; regionId: string; variantId: string; variantName: string; at: string; liveRev: number }
export interface MenuRec {
  id: string;
  siteId: string;
  rev: number;
  updatedAt: string;
  updatedBy: string;
  draft: MenuDoc;
  live: MenuDoc | null;
  liveAt: string | null;
  /** the layout slots this menu is compiled into on publish */
  applied: AppliedRef[];
  /** increments on every publish of this menu; used by the header/footer reference check */
  liveRev: number;
}

export interface MegaLink { id: string; label: string; link: LinkRef | null }
export interface MegaColumn { id: string; title: string; links: MegaLink[] }
export interface MegaFeatured { enabled: boolean; image: string; title: string; text: string; ctaLabel: string; ctaLink: LinkRef | null }
export interface MegaDoc { name: string; gap: Gap; columns: MegaColumn[]; featured: MegaFeatured }
export interface MegaRec {
  id: string; siteId: string; rev: number; updatedAt: string; updatedBy: string;
  draft: MegaDoc; live: MegaDoc | null; liveAt: string | null; liveRev: number;
}

export type LayoutSlots = Record<Slot, string | null>;
/** Per layout: which menu fills each slot. The layout owns the slots; this module edits the menu for each one. */
export type Placements = Record<string, LayoutSlots>;
export interface PlacementRec { draft: Placements; live: Placements | null }

export interface VersionRec {
  id: string; siteId: string; v: number; summary: string; by: string; at: string; kind: "publish" | "rollback";
  snap: { menus: Record<string, MenuDoc>; megas: Record<string, MegaDoc>; placements: Placements };
}

export type Severity = "error" | "warn";
export interface MenuIssue { id: string; severity: Severity; menuId?: string; itemId?: string; label: string; detail: string }

const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let seq = 0;
export const newId = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
export const newItemId = () => newId("mi");
export const blankItem = (label = "New link"): MenuItem => ({
  id: newItemId(), label, link: null, newTab: false, audience: "everyone", behaviour: "link", megaId: null, children: [], cssClass: "", rel: "",
});
export const blankLink = (label = "New link", link: LinkRef | null = null): MenuItem => ({ ...blankItem(label), link });
export const sameDoc = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------- tree helpers (pure) ---------------- */
export function walk(items: MenuItem[], depth = 0, parent: MenuItem | null = null, fn: (it: MenuItem, depth: number, parent: MenuItem | null) => void) {
  for (const it of items) { fn(it, depth, parent); walk(it.children, depth + 1, it, fn); }
}
export function countItems(items: MenuItem[]): number { let n = 0; walk(items, 0, null, () => { n++; }); return n; }
export function depthOf(items: MenuItem[]): number { let d = 0; walk(items, 0, null, (_i, depth) => { d = Math.max(d, depth + 1); }); return d; }
export function mapItem(items: MenuItem[], id: string, fn: (it: MenuItem) => MenuItem): MenuItem[] {
  return items.map((it) => (it.id === id ? fn(it) : { ...it, children: mapItem(it.children, id, fn) }));
}
export function removeItem(items: MenuItem[], id: string): MenuItem[] {
  return items.filter((i) => i.id !== id).map((i) => ({ ...i, children: removeItem(i.children, id) }));
}
export function findItem(items: MenuItem[], id: string): MenuItem | null {
  for (const it of items) { if (it.id === id) return it; const c = findItem(it.children, id); if (c) return c; }
  return null;
}
export function findParentList(items: MenuItem[], id: string): MenuItem[] | null {
  if (items.some((i) => i.id === id)) return items;
  for (const it of items) { const c = findParentList(it.children, id); if (c) return c; }
  return null;
}
/** move within its own sibling list; dir -1 up, +1 down */
export function moveItem(items: MenuItem[], id: string, dir: -1 | 1): MenuItem[] {
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) {
    const c = [...items]; const j = i + dir;
    if (j >= 0 && j < c.length) [c[i], c[j]] = [c[j], c[i]];
    return c;
  }
  return items.map((it) => ({ ...it, children: moveItem(it.children, id, dir) }));
}
/** drop `dragId` directly before `targetId`; only among siblings, so depth never changes by accident */
export function moveBefore(items: MenuItem[], dragId: string, targetId: string): MenuItem[] {
  if (dragId === targetId) return items;
  const dragParent = findParentList(items, dragId);
  const targetParent = findParentList(items, targetId);
  if (!dragParent || dragParent !== targetParent) return items;
  const dragged = dragParent.find((x) => x.id === dragId)!;
  const without = (ls: MenuItem[]): MenuItem[] => ls.filter((x) => x.id !== dragId).map((x) => ({ ...x, children: without(x.children) }));
  const insert = (ls: MenuItem[]): MenuItem[] => {
    if (ls.some((x) => x.id === targetId)) {
      const c = [...ls]; c.splice(c.findIndex((x) => x.id === targetId), 0, dragged); return c;
    }
    return ls.map((x) => ({ ...x, children: insert(x.children) }));
  };
  return insert(without(items));
}
export function addChild(items: MenuItem[], parentId: string, child: MenuItem): MenuItem[] {
  return items.map((it) => (it.id === parentId ? { ...it, behaviour: it.behaviour === "link" ? "dropdown" : it.behaviour, children: [...it.children, child] } : { ...it, children: addChild(it.children, parentId, child) }));
}

/* ---------- tree helpers (pure; they return new trees) ---------- */
/** Where an item sits: the list that holds it, its index, and its parent (null at top level). */
export function locate(items: MenuItem[], id: string, parent: MenuItem | null = null): { list: MenuItem[]; index: number; parent: MenuItem | null } | null {
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) return { list: items, index: i, parent };
  for (const it of items) { const r = locate(it.children, id, it); if (r) return r; }
  return null;
}
/** The level of an item: 0 at top level. -1 if not found. */
export function levelOf(items: MenuItem[], id: string, lvl = 0): number {
  for (const it of items) {
    if (it.id === id) return lvl;
    const r = levelOf(it.children, id, lvl + 1);
    if (r >= 0) return r;
  }
  return -1;
}
/** How many levels an item and its descendants occupy (1 for a leaf). */
export const subtreeDepth = (it: MenuItem): number => 1 + Math.max(0, ...it.children.map(subtreeDepth));
const reid = (it: MenuItem): MenuItem => ({ ...it, id: newItemId(), children: it.children.map(reid) });

/** Make the item a child of the sibling above it. Refused if it would pass the depth limit. */
export function indentItem(items: MenuItem[], id: string): MenuItem[] {
  const t = clone(items);
  const loc = locate(t, id);
  if (!loc || loc.index === 0) return items;
  const prev = loc.list[loc.index - 1];
  const it = loc.list[loc.index];
  if (prev.behaviour === "mega" || it.behaviour === "mega") return items;
  const newLevel = levelOf(t, prev.id) + 1;
  if (newLevel + subtreeDepth(it) - 1 > MENU_LIMITS.maxDepth - 1) return items;
  loc.list.splice(loc.index, 1);
  prev.children.push(it);
  if (prev.behaviour === "link") prev.behaviour = "dropdown";
  return t;
}
/** Move the item out to sit just after its parent. */
export function outdentItem(items: MenuItem[], id: string): MenuItem[] {
  const t = clone(items);
  const loc = locate(t, id);
  if (!loc || !loc.parent) return items;
  const parentLoc = locate(t, loc.parent.id);
  if (!parentLoc) return items;
  const [it] = loc.list.splice(loc.index, 1);
  parentLoc.list.splice(parentLoc.index + 1, 0, it);
  if (loc.parent.children.length === 0 && loc.parent.behaviour === "dropdown") loc.parent.behaviour = "link";
  return t;
}
/** Move the item to the top level, after its top-level ancestor. */
export function toTopLevel(items: MenuItem[], id: string): MenuItem[] {
  let cur = items;
  for (let n = 0; n < MENU_LIMITS.maxDepth; n++) {
    const loc = locate(cur, id);
    if (!loc || !loc.parent) break;
    cur = outdentItem(cur, id);
  }
  return cur;
}
/** Copy an item (and its subtree) directly after the original, with new IDs. */
export function duplicateItem(items: MenuItem[], id: string): MenuItem[] {
  const t = clone(items);
  const loc = locate(t, id);
  if (!loc) return items;
  loc.list.splice(loc.index + 1, 0, reid(loc.list[loc.index]));
  return t;
}

/* ---------- placements (per layout slot) ---------- */
export const slotsOf = (p: Placements | null | undefined, layoutId: string): LayoutSlots => p?.[layoutId] ?? { header: null, footer: null };
/** Every layout slot a menu fills in a placement set. */
export function placedIn(p: Placements | null | undefined, menuId: string): { layoutId: string; slot: Slot }[] {
  const out: { layoutId: string; slot: Slot }[] = [];
  for (const [layoutId, slots] of Object.entries(p ?? {})) for (const slot of LOCATIONS) if (slots[slot] === menuId) out.push({ layoutId, slot });
  return out;
}

/** Accepted: http(s) web addresses with a host and no embedded credentials, mailto: and tel:. Everything else is refused. */
export const urlOk = (u: string) => {
  const t = u.trim();
  if (!t || t.startsWith("//")) return false;
  if (/^tel:/i.test(t)) return /^tel:\+?[0-9 ()-]{6,}$/i.test(t);
  if (/\s/.test(t)) return false;
  if (/^mailto:/i.test(t)) return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(t);
  try {
    const x = new URL(t);
    return (x.protocol === "https:" || x.protocol === "http:") && x.hostname.length > 0 && !x.username && !x.password;
  } catch { return false; }
};
const ANCHOR_OK = /^#[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const anchorOk = (a: string) => ANCHOR_OK.test(a.trim());

/** the live path a page link resolves to, or null when the page is gone */
export function resolvePage(pageId: string, pages: PageLike[]): PageLike | null {
  const p = pages.find((x) => x.id === pageId);
  return p && !p.trash ? p : null;
}
export type PageLike = Pick<CmsPage, "id" | "path" | "title" | "status"> & { trash?: unknown };

/** a readable target for a link: page title, URL, or anchor */
export function linkLabel(link: LinkRef | null, pages: PageLike[]): string {
  if (!link) return "No link";
  if (link.kind === "url") return link.url;
  if (link.kind === "anchor") return link.anchor;
  const p = pages.find((x) => x.id === link.pageId);
  return p ? (p.trash ? `${p.title} (deleted)` : p.title) : "Missing page";
}

/* ---------------- checks ---------------- */
function checkLink(link: LinkRef | null, pages: PageLike[], where: { id: string; label: string; menuId?: string; itemId?: string }, out: MenuIssue[], required = false) {
  if (!link) {
    if (required) out.push({ id: `${where.id}_nolink`, severity: "error", menuId: where.menuId, itemId: where.itemId, label: where.label, detail: "This link has no destination yet." });
    return;
  }
  if (link.kind === "page") {
    const p = pages.find((x) => x.id === link.pageId);
    if (!p || p.trash) out.push({ id: `${where.id}_page`, severity: "error", menuId: where.menuId, itemId: where.itemId, label: where.label, detail: "The page this link points to was deleted or moved to trash." });
    else if (p.status === "draft") out.push({ id: `${where.id}_draft`, severity: "warn", menuId: where.menuId, itemId: where.itemId, label: where.label, detail: `${p.title} is a draft and is not live yet.` });
  } else if (link.kind === "url") {
    if (!urlOk(link.url)) out.push({ id: `${where.id}_url`, severity: "error", menuId: where.menuId, itemId: where.itemId, label: where.label, detail: "Address must start with https://, mailto: or tel:." });
  } else if (!anchorOk(link.anchor)) {
    out.push({ id: `${where.id}_anchor`, severity: "error", menuId: where.menuId, itemId: where.itemId, label: where.label, detail: "Anchor must look like #section-name." });
  }
}

/** Every problem in one menu draft. Pure: pass the page registry and the mega library. */
export function checkMenu(doc: MenuDoc, pages: PageLike[], megaIds: string[], menuId?: string): MenuIssue[] {
  const out: MenuIssue[] = [];
  const top = doc.items;
  if (top.length === 0) out.push({ id: "empty", severity: "warn", menuId, label: doc.name, detail: "This menu has no links yet." });
  if (top.length > MENU_LIMITS.maxTop) out.push({ id: "too_many_top", severity: "error", menuId, label: doc.name, detail: `At most ${MENU_LIMITS.maxTop} top-level links; this menu has ${top.length}.` });
  if (countItems(top) > MENU_LIMITS.maxItems) out.push({ id: "too_many", severity: "error", menuId, label: doc.name, detail: `At most ${MENU_LIMITS.maxItems} links in one menu.` });
  if (depthOf(top) > MENU_LIMITS.maxDepth) out.push({ id: "too_deep", severity: "error", menuId, label: doc.name, detail: `Menus go ${MENU_LIMITS.maxDepth} levels deep at most.` });
  const seen = new Map<string, string>();
  walk(top, 0, null, (it, depth) => {
    const where = { label: it.label.trim() || "Untitled link", menuId, itemId: it.id };
    if (!it.label.trim()) out.push({ id: `${it.id}_label`, severity: "error", ...where, detail: "Every link needs a label." });
    if (it.label.length > MENU_LIMITS.maxLabel) out.push({ id: `${it.id}_long`, severity: "warn", ...where, detail: `Labels over ${MENU_LIMITS.maxLabel} characters get cut off on small screens.` });
    if (it.behaviour === "mega") {
      if (depth !== 0) out.push({ id: `${it.id}_megadepth`, severity: "error", ...where, detail: "A mega panel can only sit on a top-level link." });
      if (!it.megaId) out.push({ id: `${it.id}_nomega`, severity: "error", ...where, detail: "This mega menu has no panel attached. Attach one in the Mega Panel tab." });
      else if (!megaIds.includes(it.megaId)) out.push({ id: `${it.id}_megamissing`, severity: "error", ...where, detail: "The attached mega panel was deleted." });
    }
    if (it.behaviour === "dropdown" && it.children.length === 0) out.push({ id: `${it.id}_emptydrop`, severity: "warn", ...where, detail: "A dropdown with no sub-links behaves like a plain link." });
    if (it.link && it.link.kind === "page") {
      const key = it.link.pageId;
      if (seen.has(key)) out.push({ id: `${it.id}_dup`, severity: "warn", ...where, detail: `Points to the same page as “${seen.get(key)}”.` });
      else seen.set(key, where.label);
    }
    checkLink(it.link, pages, { id: it.id, ...where }, out, it.behaviour === "link");
  });
  return out;
}

/** Checks for one mega panel draft: its links, column count and featured card. */
export function checkMega(doc: MegaDoc, pages: PageLike[], megaId?: string): MenuIssue[] {
  const out: MenuIssue[] = [];
  const where = { id: megaId ?? "mega", label: doc.name || "Mega panel", menuId: undefined };
  if (doc.columns.length < MENU_LIMITS.minColumns || doc.columns.length > MENU_LIMITS.maxColumns) out.push({ id: `${where.id}_cols`, severity: "error", label: where.label, detail: `A mega panel has 1 to ${MENU_LIMITS.maxColumns} columns.` });
  doc.columns.forEach((c) => {
    if (!c.title.trim()) out.push({ id: `${c.id}_t`, severity: "error", label: where.label, detail: "Every column needs a heading." });
    if (c.links.length === 0) out.push({ id: `${c.id}_e`, severity: "warn", label: where.label, detail: `Column “${c.title || "untitled"}” has no links.` });
    if (c.links.length > MENU_LIMITS.maxLinksPerColumn) out.push({ id: `${c.id}_max`, severity: "error", label: where.label, detail: `Column “${c.title}” has more than ${MENU_LIMITS.maxLinksPerColumn} links.` });
    c.links.forEach((l) => checkLink(l.link, pages, { id: l.id, label: l.label || "Untitled link" }, out, true));
  });
  if (doc.featured.enabled) {
    if (!doc.featured.title.trim()) out.push({ id: `${where.id}_ft`, severity: "error", label: where.label, detail: "The featured card needs a title." });
    if (doc.featured.ctaLink || doc.featured.ctaLabel.trim()) checkLink(doc.featured.ctaLink, pages, { id: `${where.id}_cta`, label: "Featured button" }, out, true);
  }
  return out;
}

export const hasErrors = (issues: MenuIssue[]) => issues.some((i) => i.severity === "error");

/* ---------------- seed ---------------- */
const SITE = "site_main";
const pageIdOf = (path: string) => DBX().cmsPages.find((p) => p.siteId === SITE && p.path === path && !p.trash)?.id ?? "missing";
const P = (label: string, path: string, extra: Partial<MenuItem> = {}): MenuItem => ({ ...blankItem(label), link: { kind: "page", pageId: pageIdOf(path) }, ...extra });
const ID = (path: string): LinkRef => ({ kind: "page", pageId: pageIdOf(path) });
const ML = (label: string, path: string): MegaLink => ({ id: newId("ml"), label, link: ID(path) });
const MC = (title: string, links: MegaLink[]): MegaColumn => ({ id: newId("mc"), title, links });

const megaStudy = (): MegaDoc => ({
  name: "Study Abroad mega menu", gap: "medium",
  columns: [
    MC("Destinations", [ML("Spain", "/destinations/spain"), ML("Netherlands", "/destinations/netherlands"), ML("Ireland", "/destinations/ireland"), ML("Poland", "/destinations/poland")]),
    MC("Study in", [ML("Italy", "/study-abroad/italy"), ML("Germany", "/study-abroad/germany"), ML("France", "/study-abroad/france")]),
    MC("Services", [ML("Career counselling", "/services/career-counselling"), ML("Visa assistance", "/services/visa-assistance"), ML("Accommodation", "/services/accommodation")]),
  ],
  featured: { enabled: true, image: "study-uk", title: "Explore your options", text: "Find the right programme for your global career.", ctaLabel: "Get expert advice", ctaLink: ID("/contact-us") },
});
const megaDest = (): MegaDoc => ({
  name: "Destinations mega menu", gap: "small",
  columns: [MC("Europe", [ML("Spain", "/destinations/spain"), ML("Netherlands", "/destinations/netherlands")])],
  featured: { enabled: false, image: "", title: "", text: "", ctaLabel: "", ctaLink: null },
});

const menuSeed = (): MenuDoc[] => [
  {
    name: "Primary Navigation", description: "Main website navigation", type: "main", mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [
      P("Home", "/"),
      { ...blankItem("Study Abroad"), behaviour: "mega", megaId: "mega_study", link: ID("/study-abroad") },
      { ...blankItem("Scholarships"), link: ID("/scholarships") },
      { ...blankItem("Services"), behaviour: "dropdown", link: ID("/services"), children: [
        P("Career counselling", "/services/career-counselling"), P("Visa assistance", "/services/visa-assistance"),
        P("Accommodation", "/services/accommodation"), P("Test preparation", "/services/test-preparation") ] },
      { ...blankItem("About Us"), behaviour: "dropdown", link: ID("/about-us"), children: [P("Our story", "/about-us/our-story"), P("Team", "/about-us/team")] },
      P("Contact", "/contact-us"),
    ],
  },
  {
    name: "Footer Navigation", description: "Footer links and resources", type: "main", mobile: { behaviour: "accordion", openFirstLevel: false },
    items: [
      { ...blankItem("Company"), behaviour: "dropdown", link: ID("/about-us"), children: [P("About us", "/about-us"), P("Our story", "/about-us/our-story"), P("Team", "/about-us/team")] },
      { ...blankItem("Study"), behaviour: "dropdown", link: ID("/destinations"), children: [P("Destinations", "/destinations"), P("Scholarships", "/scholarships"), P("Universities", "/universities")] },
      { ...blankItem("Support"), behaviour: "dropdown", link: ID("/contact-us"), children: [P("Contact", "/contact-us"), P("Blogs", "/resources/blogs"), P("Downloads", "/resources/downloads")] },
    ],
  },
  {
    name: "Utility Menu", description: "Top utility bar", type: "main", mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [P("Contact", "/contact-us"), P("Events", "/resources/events")],
  },
  {
    name: "Campaign Navigation", description: "Campaign and seasonal links", type: "main", mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [P("Italy Intake 2026", "/study-abroad/italy"), P("Study in France", "/study-abroad/france")],
  },
];

/* ---------------- store ---------------- */
interface State { menus: MenuRec[]; megas: MegaRec[]; placements: Record<string, PlacementRec>; versions: VersionRec[] }
let state: State | null = null;

function store(): State {
  if (state) return state;
  const docs = menuSeed().map((d, i) => ({ ...d, type: (["main", "footer", "utility", "main"] as MenuType[])[i] }));
  const ids = ["menu_primary", "menu_footer", "menu_utility", "menu_campaign"];
  const stamp = now();
  const megaRecs: MegaRec[] = [
    { id: "mega_study", siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: megaStudy(), live: megaStudy(), liveAt: stamp, liveRev: 1 },
    { id: "mega_dest", siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: megaDest(), live: null, liveAt: null, liveRev: 0 },
  ];
  const menuRecs: MenuRec[] = docs.map((d, i) => ({
    id: ids[i], siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: clone(d),
    live: i === 3 ? null : clone(d), liveAt: i === 3 ? null : stamp, applied: [], liveRev: i === 3 ? 0 : 1,
  }));
  // Study Abroad's panel is attached to the primary menu item (mega_study); the draft of the primary menu carries the id
  // the header variant was built from the live primary menu (its menuRef matches liveRev 1)
  menuRecs[0].applied = [{ layoutId: "lay_default", slot: "header", regionId: "reg_header", variantId: "hdr_v2", variantName: "Global Header v2", at: stamp, liveRev: 1 }];
  menuRecs[0].draft.items[1].megaId = "mega_study";
  menuRecs[0].live!.items[1].megaId = "mega_study";
  // draft change: the utility menu has one unpublished link
  menuRecs[2].draft.items = [...menuRecs[2].draft.items, P("Careers", "/about-us/team")];
  const seedSlots = (): Placements => ({
    lay_default: { header: "menu_primary", footer: "menu_footer" },
    lay_blank: { header: null, footer: null },
    lay_campaign: { header: null, footer: null },
    lay_blog: { header: null, footer: null },
    lay_funnel: { header: null, footer: null },
  });
  const placements: Record<string, PlacementRec> = { [SITE]: { draft: seedSlots(), live: seedSlots() } };
  const v1: VersionRec = {
    id: "ver_1", siteId: SITE, v: 1, summary: "Initial navigation: primary, footer and utility menus", by: "Priya Nair", at: stamp, kind: "publish",
    snap: { menus: { menu_primary: clone(docs[0]), menu_footer: clone(docs[1]), menu_utility: clone(docs[2]) }, megas: { mega_study: megaStudy() }, placements: seedSlots() },
  };
  state = { menus: menuRecs, megas: megaRecs, placements, versions: [v1] };
  return state;
}

const siteMenus = (siteId: string) => store().menus.filter((m) => m.siteId === siteId);
const siteMegas = (siteId: string) => store().megas.filter((m) => m.siteId === siteId);
const pagesFor = (siteId: string): PageLike[] => DBX().cmsPages.filter((p) => p.siteId === siteId) as PageLike[];

/** a menu's status as the list shows it */
export function statusOf(m: MenuRec): "published" | "draft" {
  return m.live && sameDoc(m.live, m.draft) ? "published" : "draft";
}
export const hasChanges = (m: MenuRec) => !m.live || !sameDoc(m.live, m.draft);
export const megaHasChanges = (m: MegaRec) => !m.live || !sameDoc(m.live, m.draft);

/** the mega panels in the library, with the menus that attach them */
export function megaUsage(siteId: string, megaId: string): { menuId: string; menuName: string; live: boolean }[] {
  const out: { menuId: string; menuName: string; live: boolean }[] = [];
  for (const m of siteMenus(siteId)) {
    let live = false; let hit = false;
    walk(m.draft.items, 0, null, (it) => { if (it.megaId === megaId) hit = true; });
    walk(m.live?.items ?? [], 0, null, (it) => { if (it.megaId === megaId) live = true; });
    if (hit || live) out.push({ menuId: m.id, menuName: m.draft.name, live });
  }
  return out;
}

export interface Preflight { errors: number; warnings: number; byMenu: Record<string, MenuIssue[]>; global: MenuIssue[]; issues: MenuIssue[] }
/** the whole site's checks: every menu draft, every mega panel, and placements */
export function preflight(siteId: string): Preflight {
  const pages = pagesFor(siteId);
  const megas = siteMegas(siteId);
  const byMenu: Record<string, MenuIssue[]> = {};
  const global: MenuIssue[] = [];
  const megaIds = megas.map((m) => m.id);
  for (const m of siteMenus(siteId)) {
    byMenu[m.id] = checkMenu(m.draft, pages, megaIds, m.id);
  }
  for (const mg of megas) {
    const issues = checkMega(mg.draft, pages, mg.id);
    if (issues.length) byMenu[`mega:${mg.id}`] = issues;
  }
  const p = store().placements[siteId];
  if (p) for (const [layoutId, slots] of Object.entries(p.draft)) for (const slot of LOCATIONS) {
    const id = slots[slot];
    if (id && !siteMenus(siteId).some((m) => m.id === id)) global.push({ id: `pl_${layoutId}_${slot}`, severity: "error", label: "Placements", detail: `${LOC_LABEL[slot]} in a layout points at a menu that no longer exists.` });
  }
  const issues = [...Object.values(byMenu).flat(), ...global];
  return { errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warn").length, byMenu, global, issues };
}

/** The menu a header or footer variant reads from (its menuRef), with its current name and live revision. */
export function menuRefInfo(menuId: string): { name: string; liveRev: number; hasLive: boolean } | null {
  const m = store().menus.find((x) => x.id === menuId);
  if (!m) return null;
  return { name: m.draft.name, liveRev: m.liveRev, hasLive: !!m.live };
}

/** The menu the LIVE placement puts in a layout slot (what the site shows), or null. */
export function livePlacementMenu(siteId: string, layoutId: string, slot: Slot): string | null {
  const p = store().placements[siteId];
  return slotsOf(p?.live ?? null, layoutId)[slot];
}

/**
 * The published copy of a menu, read synchronously, for a pinned preview (M7 spec: preview pins the
 * layout revision, the menu revision and the tokens). Reads the live copy only, never a draft.
 */
export function menuPinned(menuId: string): { name: string; liveRev: number; liveVersion: number; nav: string[]; groups: { title: string; links: string[] }[] } | null {
  const s = store();
  const m = s.menus.find((x) => x.id === menuId);
  if (!m || !m.live) return null;
  const everyone = (it: MenuItem) => it.audience === "everyone";
  const top = m.live.items.filter(everyone);
  const withKids = top.filter((i) => i.children.length > 0);
  const groups = withKids.length
    ? withKids.map((i) => ({ title: i.label, links: i.children.filter(everyone).map((c) => c.label) }))
    : [{ title: m.live.name, links: top.map((i) => i.label) }];
  return { name: m.live.name, liveRev: m.liveRev, liveVersion: Math.max(0, ...s.versions.map((v) => v.v)), nav: top.map((i) => i.label), groups };
}

export interface ReleaseIssue { id: string; detail: string }
/**
 * Publish-release gate (M7 spec L778: broken menu references block publish). Checks the immutable LIVE
 * menus and mega panels, the live placements, and the menuRef stored on each header/footer variant.
 */
export function releaseMenuIssues(siteId: string): ReleaseIssue[] {
  const out: ReleaseIssue[] = [];
  const pages = pagesFor(siteId);
  const menus = siteMenus(siteId);
  const megas = siteMegas(siteId);
  for (const m of menus) {
    if (!m.live) continue;
    for (const i of checkMenu(m.live, pages, megas.map((g) => g.id), m.id)) if (i.severity === "error") out.push({ id: `live:${m.id}:${i.id}`, detail: `${m.draft.name}: ${i.detail}` });
  }
  for (const g of megas) {
    if (!g.live) continue;
    for (const i of checkMega(g.live, pages, g.id)) if (i.severity === "error") out.push({ id: `live:${g.id}:${i.id}`, detail: `${g.draft.name}: ${i.detail}` });
  }
  const p = store().placements[siteId];
  const { layouts, regions } = layoutSnapshot();
  for (const [layoutId, slots] of Object.entries(p?.live ?? {})) {
    const lname = layouts.find((l) => l.id === layoutId)?.name ?? "a layout";
    for (const slot of LOCATIONS) {
      const id = slots[slot];
      if (!id) continue;
      const target = menus.find((m) => m.id === id);
      if (!target) out.push({ id: `pl:${layoutId}:${slot}`, detail: `${LOC_LABEL[slot]} in ${lname} points at a menu that no longer exists.` });
      else if (!target.live) out.push({ id: `pl:${layoutId}:${slot}:unpub`, detail: `${LOC_LABEL[slot]} in ${lname} uses ${target.draft.name}, which has never been published.` });
    }
  }
  // one header or footer variant cannot show two different menus
  for (const [, v] of variantKeyOf(layouts, regions)) {
    const placed = new Set(v.uses.map((u) => p?.live?.[u.layoutId]?.[u.slot]).filter(Boolean));
    if (placed.size > 1) {
      const names = v.uses.filter((u) => p?.live?.[u.layoutId]?.[u.slot]).map((u) => layouts.find((x) => x.id === u.layoutId)?.name ?? "a layout");
      out.push({ id: `shared:${v.variantId}`, detail: `${names.join(" and ")} share one header or footer design but place different menus. Give each layout its own design.` });
    }
  }
  for (const l of layouts) {
    if (l.archived) continue;
    for (const slot of LOCATIONS) {
      const ref = l[slot];
      if (!ref?.visible) continue;
      const v = regions.find((r) => r.id === ref.regionId)?.variants.find((x) => x.id === ref.variantId);
      const mr = (v?.blocks[0]?.props as { menuRef?: { menuId: string } } | undefined)?.menuRef;
      if (mr && !menus.some((m) => m.id === mr.menuId)) out.push({ id: `ref:${l.id}:${slot}`, detail: `The ${slot} of ${l.name} refers to a menu that no longer exists.` });
    }
  }
  return out;
}

/** the change list for the Publish review: what differs from live */
export function changeList(siteId: string): { kind: "menu" | "mega" | "placement"; name: string; detail: string }[] {
  const out: { kind: "menu" | "mega" | "placement"; name: string; detail: string }[] = [];
  for (const m of siteMenus(siteId)) {
    if (!hasChanges(m)) continue;
    out.push({ kind: "menu", name: m.draft.name, detail: m.live ? "edited" : "new, never published" });
  }
  for (const g of siteMegas(siteId)) if (megaHasChanges(g)) out.push({ kind: "mega", name: g.draft.name, detail: g.live ? "edited" : "new, never published" });
  const p = store().placements[siteId];
  if (p && (!p.live || !sameDoc(p.live, p.draft))) out.push({ kind: "placement", name: "Placements", detail: "assignment changed" });
  return out;
}

export function draftChangeCount(siteId: string): number { return changeList(siteId).length; }

/* ---------------- API ---------------- */
export interface Loaded {
  menus: MenuRec[]; megas: MegaRec[]; placements: PlacementRec; versions: VersionRec[]; pages: PageLike[];
  layouts: LayoutDraft[]; regions: SharedRegion[];
}
const canon = (rec: { rev: number }, expected: number, what: string) => {
  if (rec.rev !== expected || mode.conflict) throw new MenuError("E_CONFLICT", `Someone saved ${what} while you were editing. Your draft is kept; reload theirs to see the saved version.`);
};

/** The header or footer variant a layout slot shows, keyed so a variant shared by layouts is compiled once. */
function variantKeyOf(layouts: LayoutDraft[], regions: SharedRegion[]): Map<string, { regionId: string; variantId: string; uses: { layoutId: string; slot: Slot }[] }> {
  const map = new Map<string, { regionId: string; variantId: string; uses: { layoutId: string; slot: Slot }[] }>();
  for (const layout of layouts) {
    if (layout.archived) continue;
    for (const slot of LOCATIONS) {
      const ref = layout[slot];
      if (!ref || !ref.visible) continue;
      const region = regions.find((r) => r.id === ref.regionId);
      if (!region || !region.variants.some((v) => v.id === ref.variantId)) continue;
      const key = `${ref.regionId}|${ref.variantId}`;
      const hit = map.get(key) ?? { regionId: ref.regionId, variantId: ref.variantId, uses: [] };
      hit.uses.push({ layoutId: layout.id, slot });
      map.set(key, hit);
    }
  }
  return map;
}

/**
 * Publish-time compile: each header or footer variant takes the live menu its layouts place in it.
 * A variant shared by layouts that place different menus is refused by the release gate, so here the
 * menu is taken from the first layout that places one. Every write re-reads the regions, so no write
 * is overwritten by a stale copy.
 */
async function compileChrome(siteId: string, layouts: LayoutDraft[]): Promise<void> {
  const s = store();
  const p = s.placements[siteId];
  for (const m of siteMenus(siteId)) m.applied = [];
  for (const [, v] of variantKeyOf(layouts, layoutSnapshot().regions)) {
    const wanted = v.uses.map((u) => ({ ...u, menuId: p?.live?.[u.layoutId]?.[u.slot] ?? null })).find((u) => u.menuId);
    const fresh = layoutSnapshot().regions;
    if (wanted) {
      const rec = s.menus.find((m) => m.id === wanted.menuId);
      if (rec?.live) await MenusAPI.apply(rec.id, v.regionId, v.variantId, fresh, { layoutId: wanted.layoutId, slot: wanted.slot });
      continue;
    }
    // no layout places a menu in this variant: drop a previously compiled reference, keep hand-written chrome
    const region = fresh.find((r) => r.id === v.regionId);
    const variant = region?.variants.find((x) => x.id === v.variantId);
    if (!region || !variant) continue;
    const props = { ...((variant.blocks[0]?.props ?? {}) as Record<string, unknown>) };
    if (!props.menuRef) continue;
    delete props.menuRef;
    await LayoutsAPI.saveRegionVariant(region.id, { ...variant, blocks: [{ ...variant.blocks[0], props }] } as RegionVariant);
  }
}

export const MenusAPI = {
  async load(siteId: string): Promise<Loaded> {
    await pause(180);
    if (mode.fail) throw new MenuError("E_LOAD", "Could not reach the menu service. The last published navigation is still live.");
    const s = store();
    const placements = s.placements[siteId] ?? { draft: {}, live: null };
    const lay = await LayoutsAPI.load(siteId);
    return {
      menus: mode.empty ? [] : clone(siteMenus(siteId)),
      megas: mode.empty ? [] : clone(siteMegas(siteId)),
      placements: clone(placements),
      versions: clone(s.versions.filter((v) => v.siteId === siteId)),
      pages: clone(pagesFor(siteId)),
      layouts: clone(lay.layouts),
      regions: clone(lay.regions),
    };
  },

  /** Save a menu draft. Refused with errors; warnings are saved. */
  async saveMenu(menuId: string, doc: MenuDoc, expectedRev: number, by = "You"): Promise<MenuRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "Save failed. The menu service is unreachable, so nothing was written.");
    const rec = store().menus.find((m) => m.id === menuId);
    if (!rec) throw new MenuError("E_MISSING", "That menu was deleted in another tab.");
    canon(rec, expectedRev, rec.draft.name);
    const pages = pagesFor(rec.siteId);
    const megaIds = siteMegas(rec.siteId).map((m) => m.id);
    if (hasErrors(checkMenu(doc, pages, megaIds, menuId))) throw new MenuError("E_VALID", "Fix the errors in this menu before saving.");
    rec.draft = clone(doc); rec.rev += 1; rec.updatedAt = now(); rec.updatedBy = by;
    return clone(rec);
  },

  async createMenu(siteId: string, name: string, description: string, type: MenuType = "main"): Promise<MenuRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was created.");
    if (siteMenus(siteId).length >= 12) throw new MenuError("E_LIMIT", "A website can have 12 menus at most.");
    const rec: MenuRec = { id: newId("menu"), siteId, rev: 1, updatedAt: now(), updatedBy: "You",
      draft: { name, description, type, items: [], mobile: { behaviour: "drawer", openFirstLevel: false } }, live: null, liveAt: null, applied: [], liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  async duplicateMenu(menuId: string): Promise<MenuRec> {
    await pause(200);
    const src = store().menus.find((m) => m.id === menuId);
    if (!src) throw new MenuError("E_MISSING", "That menu no longer exists.");
    const copy = (items: MenuItem[]): MenuItem[] => items.map((i) => ({ ...i, id: newItemId(), children: copy(i.children) }));
    const rec: MenuRec = { id: newId("menu"), siteId: src.siteId, rev: 1, updatedAt: now(), updatedBy: "You",
      draft: { ...clone(src.draft), name: `${src.draft.name} (copy)`, items: copy(src.draft.items) }, live: null, liveAt: null, applied: [], liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  async deleteMenu(menuId: string): Promise<void> {
    await pause(160);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was deleted.");
    const s = store();
    const rec = s.menus.find((m) => m.id === menuId);
    if (!rec) return;
    if (rec.applied.length) throw new MenuError("E_IN_USE", `${rec.draft.name} is compiled into ${rec.applied.map((a) => a.variantName).join(", ")}. Place another menu there first.`);
    const placed = placedIn(s.placements[rec.siteId]?.draft, menuId);
    if (placed.length) throw new MenuError("E_IN_USE", `${rec.draft.name} is placed in ${placed.length} layout slot${placed.length > 1 ? "s" : ""}. Move it first.`);
    s.menus = s.menus.filter((m) => m.id !== menuId);
  },

  async saveMega(megaId: string, doc: MegaDoc, expectedRev: number): Promise<MegaRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "Save failed. The menu service is unreachable, so nothing was written.");
    const rec = store().megas.find((m) => m.id === megaId);
    if (!rec) throw new MenuError("E_MISSING", "That mega panel was deleted in another tab.");
    canon(rec, expectedRev, rec.draft.name);
    if (hasErrors(checkMega(doc, pagesFor(rec.siteId), megaId))) throw new MenuError("E_VALID", "Fix the errors in this mega panel before saving.");
    rec.draft = clone(doc); rec.rev += 1; rec.updatedAt = now(); rec.updatedBy = "You";
    return clone(rec);
  },

  async createMega(siteId: string, name: string): Promise<MegaRec> {
    await pause(200);
    const doc: MegaDoc = { name, gap: "medium", columns: [MC("Column 1", [])], featured: { enabled: false, image: "", title: "", text: "", ctaLabel: "", ctaLink: null } };
    const rec: MegaRec = { id: newId("mega"), siteId, rev: 1, updatedAt: now(), updatedBy: "You", draft: doc, live: null, liveAt: null, liveRev: 0 };
    store().megas.push(rec);
    return clone(rec);
  },

  async deleteMega(megaId: string): Promise<void> {
    await pause(160);
    const s = store();
    const rec = s.megas.find((m) => m.id === megaId);
    if (!rec) return;
    const used = megaUsage(rec.siteId, megaId);
    if (used.length) throw new MenuError("E_IN_USE", `${rec.draft.name} is attached to ${used.map((u) => u.menuName).join(", ")}. Detach it first.`);
    s.megas = s.megas.filter((m) => m.id !== megaId);
  },

  /** Save the placement draft (layout slots). Separate from Save Draft. */
  async savePlacements(siteId: string, draft: Placements, expectedRev: number | null): Promise<PlacementRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "Save failed. Placements were not changed.");
    const p = store().placements[siteId];
    if (!p) throw new MenuError("E_MISSING", "No placements for this website.");
    if (expectedRev !== null && mode.conflict) throw new MenuError("E_CONFLICT", "Someone changed a placement while you were editing.");
    const lay = await LayoutsAPI.load(siteId);
    const menus = siteMenus(siteId);
    for (const layout of lay.layouts) {
      const next = slotsOf(draft, layout.id);
      const prev = slotsOf(p.draft, layout.id);
      for (const slot of LOCATIONS) {
        const id = next[slot];
        if (id && !layout[slot].visible) throw new MenuError("E_VALID", `${layout.name} has no ${slot}. Choose another layout.`);
        if (id && !menus.some((m) => m.id === id)) throw new MenuError("E_MISSING", "A chosen menu no longer exists.");
        if (!id && prev[slot] && layout[slot].visible && slot === "header") throw new MenuError("E_VALID", `${layout.name} needs a header menu. Replace it instead of removing it.`);
      }
    }
    p.draft = clone(draft);
    return clone(p);
  },

  /** Publish all drafts for a site. Blocked while preflight has errors. Returns the new version. */
  async publish(siteId: string, by = "You", kind: "publish" | "rollback" = "publish", summaryOverride?: string): Promise<VersionRec> {
    await pause(260);
    if (mode.fail) throw new MenuError("E_SAVE", "Publish failed. Nothing went live.");
    const pf = preflight(siteId);
    if (pf.errors > 0) throw new MenuError("E_VALID", `${pf.errors} error${pf.errors > 1 ? "s" : ""} block publishing. Fix them first.`);
    const s = store();
    const changes = changeList(siteId);
    if (changes.length === 0) throw new MenuError("E_NOOP", "Nothing to publish. The live navigation already matches the drafts.");
    const stamp = now();
    for (const m of siteMenus(siteId)) if (hasChanges(m)) { m.live = clone(m.draft); m.liveAt = stamp; m.liveRev += 1; }
    for (const g of siteMegas(siteId)) if (megaHasChanges(g)) { g.live = clone(g.draft); g.liveAt = stamp; g.liveRev += 1; }
    const p = s.placements[siteId];
    if (p) p.live = clone(p.draft);
    const summary = summaryOverride ?? changes.map((c) => `${c.name} ${c.detail}`).join("; ");
    const v = (Math.max(0, ...s.versions.filter((x) => x.siteId === siteId).map((x) => x.v))) + 1;
    const rec: VersionRec = {
      id: newId("ver"), siteId, v, summary, by, at: stamp, kind,
      snap: {
        menus: Object.fromEntries(siteMenus(siteId).filter((m) => m.live).map((m) => [m.id, clone(m.live!)])),
        megas: Object.fromEntries(siteMegas(siteId).filter((m) => m.live).map((m) => [m.id, clone(m.live!)])),
        placements: clone(p?.live ?? {}),
      },
    };
    const lay = await LayoutsAPI.load(siteId);
    await compileChrome(siteId, lay.layouts);
    s.versions.push(rec);
    return clone(rec);
  },

  /** Roll back: the drafts become the version's content and are published as a new version. History is never rewritten. */
  async rollback(siteId: string, versionId: string, by = "You"): Promise<VersionRec> {
    const s = store();
    const target = s.versions.find((v) => v.id === versionId && v.siteId === siteId);
    if (!target) throw new MenuError("E_MISSING", "That version no longer exists.");
    for (const [id, doc] of Object.entries(target.snap.menus)) { const m = s.menus.find((x) => x.id === id); if (m) m.draft = clone(doc); }
    for (const [id, doc] of Object.entries(target.snap.megas)) { const g = s.megas.find((x) => x.id === id); if (g) g.draft = clone(doc); }
    const p = s.placements[siteId]; if (p) p.draft = { ...target.snap.placements };
    return MenusAPI.publish(siteId, by, "rollback", `Rolled back to v${target.v}`);
  },

  /** Write the LIVE menu into a header or footer variant, storing a reference to it. */
  async apply(menuId: string, regionId: string, variantId: string, regions: SharedRegion[], ctx: { layoutId: string; slot: Slot }): Promise<{ written: number; omitted: string[] }> {
    await pause(260);
    if (mode.fail) throw new MenuError("E_SAVE", "The chrome service is unreachable. The header and footer were not changed.");
    const rec = store().menus.find((m) => m.id === menuId);
    if (!rec) throw new MenuError("E_MISSING", "That menu no longer exists.");
    if (!rec.live) throw new MenuError("E_VALID", "Publish this menu before applying it. Apply uses the live version.");
    const region = regions.find((r) => r.id === regionId);
    const variant = region?.variants.find((v) => v.id === variantId);
    if (!region || !variant) throw new MenuError("E_MISSING", "That header or footer variant no longer exists.");
    const live = rec.live;
    const props = { ...((variant.blocks[0]?.props ?? {}) as Record<string, unknown>) };
    const omitted: string[] = [];
    let written = 0;
    if (region.kind === "header") {
      const visible = live.items.filter((i) => i.audience === "everyone");
      const hidden = live.items.filter((i) => i.audience !== "everyone").map((i) => i.label);
      if (hidden.length) omitted.push(`hidden from visitors: ${hidden.join(", ")}`);
      const nested = live.items.filter((i) => i.children.length > 0 || i.behaviour === "mega").length;
      if (nested) omitted.push(`dropdowns and mega panels (${nested}) — a header variant shows top-level labels only`);
      props.nav = visible.map((i) => i.label.trim()).filter(Boolean);
      written = (props.nav as string[]).length;
    } else if (region.kind === "footer") {
      const groups: FooterGroup[] = live.items
        .filter((i) => i.children.length > 0 && i.audience === "everyone")
        .map((i) => ({ title: i.label.trim(), links: i.children.filter((c) => c.audience === "everyone").map((c) => c.label.trim()).filter(Boolean) }));
      const flat = live.items.filter((i) => i.children.length === 0 && i.behaviour !== "mega").map((i) => i.label);
      if (flat.length) omitted.push(`links with no column: ${flat.join(", ")}`);
      if (groups.length > 3) { omitted.push(`columns past the third: ${groups.slice(3).map((g) => g.title).join(", ")}`); groups.length = 3; }
      props.groups = groups;
      written = groups.length;
    } else {
      throw new MenuError("E_VALID", "Only a header or footer menu can be applied to shared chrome.");
    }
    props.menuRef = { menuId: rec.id, name: live.name, liveRev: rec.liveRev };
    const next: RegionVariant = { ...variant, blocks: [{ ...(variant.blocks[0] ?? { id: "chrome", type: "container", style: {} }), props }] } as RegionVariant;
    await LayoutsAPI.saveRegionVariant(regionId, next);
    rec.applied = [...rec.applied.filter((a) => !(a.layoutId === ctx.layoutId && a.slot === ctx.slot)), { layoutId: ctx.layoutId, slot: ctx.slot, regionId, variantId, variantName: variant.name, at: now(), liveRev: rec.liveRev }];
    return { written, omitted };
  },

  /** Where a menu is applied and whether that copy is behind the live menu. */
  /** Per compiled slot: whether the layout still shows the live menu. */
  chromeStatus(menu: MenuRec, regions: SharedRegion[]): { layoutId: string; slot: Slot; state: "current" | "stale" | "missing"; variantName: string; detail: string }[] {
    return menu.applied.map((a) => {
      const r = regions.find((x) => x.id === a.regionId);
      const v = r?.variants.find((x) => x.id === a.variantId);
      const base = { layoutId: a.layoutId, slot: a.slot, variantName: a.variantName };
      if (!v) return { ...base, state: "missing", detail: "The variant it compiles into was removed" };
      const ref = (v.blocks[0]?.props as { menuRef?: { menuId: string; liveRev: number } } | undefined)?.menuRef;
      if (!ref || ref.menuId !== menu.id) return { ...base, state: "stale", detail: "The header or footer was edited by hand after it compiled" };
      if (ref.liveRev !== menu.liveRev) return { ...base, state: "stale", detail: "The menu was published after it compiled" };
      return { ...base, state: "current", detail: "In sync with the live menu" };
    });
  },

  chromeTargets(regions: SharedRegion[], loc: Loc) {
    if (loc === "utility") return [];
    const kind = loc === "header" ? "header" : "footer";
    const r = regions.find((x) => x.kind === kind);
    if (!r) return [];
    return r.variants.map((v) => {
      const p = (v.blocks[0]?.props ?? {}) as { nav?: unknown; groups?: unknown };
      const groups = kind === "footer" ? footerGroups(p) : [];
      const nav = kind === "header" && Array.isArray(p.nav) ? (p.nav as string[]) : [];
      return { regionId: r.id, variantId: v.id, name: v.name, note: v.note, nav, groups };
    });
  },
};

export class MenuError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "MenuError"; }
}

/** Test hook: restores the seed. Used by the QA suite only. */
export function __resetMenus() { state = null; }
