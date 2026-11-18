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
import { LayoutsAPI, type SharedRegion, type RegionVariant } from "./layout-db";
import { footerGroups, type FooterGroup } from "./footer";

/** Prototype states, driven by the app's state menu (see Menus.tsx). Off in normal use. */
export const mode = { fail: false, slow: false, empty: false, conflict: false };
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, mode.slow ? ms * 4 : ms));

export const MENU_LIMITS = { maxDepth: 3, maxColumns: 4, minColumns: 1, maxTop: 8, maxLabel: 40, maxLinksPerColumn: 8, maxItems: 80 } as const;

export type LinkRef = { kind: "page"; pageId: string } | { kind: "url"; url: string } | { kind: "anchor"; anchor: string };
export type Behaviour = "link" | "dropdown" | "mega";
export type Audience = "everyone" | "members" | "hidden";
export type Loc = "header" | "footer" | "utility";
export const LOCATIONS: Loc[] = ["header", "footer", "utility"];
export const LOC_LABEL: Record<Loc, string> = { header: "Header (Primary)", footer: "Footer", utility: "Top bar / Utility" };
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
  items: MenuItem[];
  mobile: { behaviour: MobileBehaviour; openFirstLevel: boolean };
}
export interface MenuRec {
  id: string;
  siteId: string;
  rev: number;
  updatedAt: string;
  updatedBy: string;
  draft: MenuDoc;
  live: MenuDoc | null;
  liveAt: string | null;
  /** the header or footer variant this menu was last applied to, and the live revision it carried */
  appliedTo: { regionId: string; variantId: string; variantName: string; at: string; liveRev: number } | null;
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

export type Placements = Record<Loc, string | null>;
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

const URL_OK = /^(https?:\/\/[^\s/$.?#].[^\s]*|mailto:[^\s@]+@[^\s@]+|tel:\+?[0-9 ()-]{6,})$/i;
const ANCHOR_OK = /^#[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const urlOk = (u: string) => URL_OK.test(u.trim());
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
    name: "Primary Navigation", description: "Main website navigation", mobile: { behaviour: "drawer", openFirstLevel: false },
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
    name: "Footer Navigation", description: "Footer links and resources", mobile: { behaviour: "accordion", openFirstLevel: false },
    items: [
      { ...blankItem("Company"), behaviour: "dropdown", link: ID("/about-us"), children: [P("About us", "/about-us"), P("Our story", "/about-us/our-story"), P("Team", "/about-us/team")] },
      { ...blankItem("Study"), behaviour: "dropdown", link: ID("/destinations"), children: [P("Destinations", "/destinations"), P("Scholarships", "/scholarships"), P("Universities", "/universities")] },
      { ...blankItem("Support"), behaviour: "dropdown", link: ID("/contact-us"), children: [P("Contact", "/contact-us"), P("Blogs", "/resources/blogs"), P("Downloads", "/resources/downloads")] },
    ],
  },
  {
    name: "Utility Menu", description: "Top utility bar", mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [P("Contact", "/contact-us"), P("Events", "/resources/events")],
  },
  {
    name: "Campaign Navigation", description: "Campaign and seasonal links", mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [P("Italy Intake 2026", "/study-abroad/italy"), P("Study in France", "/study-abroad/france")],
  },
];

/* ---------------- store ---------------- */
interface State { menus: MenuRec[]; megas: MegaRec[]; placements: Record<string, PlacementRec>; versions: VersionRec[] }
let state: State | null = null;

function store(): State {
  if (state) return state;
  const docs = menuSeed();
  const ids = ["menu_primary", "menu_footer", "menu_utility", "menu_campaign"];
  const stamp = now();
  const megaRecs: MegaRec[] = [
    { id: "mega_study", siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: megaStudy(), live: megaStudy(), liveAt: stamp, liveRev: 1 },
    { id: "mega_dest", siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: megaDest(), live: null, liveAt: null, liveRev: 0 },
  ];
  const menuRecs: MenuRec[] = docs.map((d, i) => ({
    id: ids[i], siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", draft: clone(d),
    live: i === 3 ? null : clone(d), liveAt: i === 3 ? null : stamp, appliedTo: null, liveRev: i === 3 ? 0 : 1,
  }));
  // Study Abroad's panel is attached to the primary menu item (mega_study); the draft of the primary menu carries the id
  // the header variant was built from the live primary menu (its menuRef matches liveRev 1)
  menuRecs[0].appliedTo = { regionId: "reg_header", variantId: "hdr_v2", variantName: "Global Header v2", at: stamp, liveRev: 1 };
  menuRecs[0].draft.items[1].megaId = "mega_study";
  menuRecs[0].live!.items[1].megaId = "mega_study";
  // draft change: the utility menu has one unpublished link
  menuRecs[2].draft.items = [...menuRecs[2].draft.items, P("Careers", "/about-us/team")];
  const placements: Record<string, PlacementRec> = {
    [SITE]: {
      draft: { header: "menu_primary", footer: "menu_footer", utility: "menu_utility" },
      live: { header: "menu_primary", footer: "menu_footer", utility: "menu_utility" },
    },
  };
  const v1: VersionRec = {
    id: "ver_1", siteId: SITE, v: 1, summary: "Initial navigation: primary, footer and utility menus", by: "Priya Nair", at: stamp, kind: "publish",
    snap: { menus: { menu_primary: clone(docs[0]), menu_footer: clone(docs[1]), menu_utility: clone(docs[2]) }, megas: { mega_study: megaStudy() }, placements: { header: "menu_primary", footer: "menu_footer", utility: "menu_utility" } },
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

/** what each menu is used for right now (live placement) */
export function usedInOf(siteId: string, menuId: string, which: "live" | "draft" = "live"): Loc | null {
  const p = store().placements[siteId];
  if (!p) return null;
  const pl = which === "live" ? p.live ?? p.draft : p.draft;
  return LOCATIONS.find((l) => pl[l] === menuId) ?? null;
}
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
  if (p) {
    const seen = new Map<string, Loc>();
    for (const loc of LOCATIONS) {
      const id = p.draft[loc];
      if (!id) continue;
      if (seen.has(id)) global.push({ id: `dup_${id}`, severity: "error", label: "Placements", detail: `The same menu is placed in two locations (${LOC_LABEL[seen.get(id)!]} and ${LOC_LABEL[loc]}).` });
      else seen.set(id, loc);
      if (!siteMenus(siteId).some((m) => m.id === id)) global.push({ id: `pl_${loc}`, severity: "error", label: "Placements", detail: `${LOC_LABEL[loc]} points at a menu that no longer exists.` });
    }
  }
  const issues = [...Object.values(byMenu).flat(), ...global];
  return { errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warn").length, byMenu, global, issues };
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
}
const canon = (rec: { rev: number }, expected: number, what: string) => {
  if (rec.rev !== expected || mode.conflict) throw new MenuError("E_CONFLICT", `Someone saved ${what} while you were editing. Your draft is kept; reload theirs to see the saved version.`);
};

export const MenusAPI = {
  async load(siteId: string): Promise<Loaded> {
    await pause(180);
    if (mode.fail) throw new MenuError("E_LOAD", "Could not reach the menu service. The last published navigation is still live.");
    const s = store();
    const placements = s.placements[siteId] ?? { draft: { header: null, footer: null, utility: null }, live: null };
    return {
      menus: mode.empty ? [] : clone(siteMenus(siteId)),
      megas: mode.empty ? [] : clone(siteMegas(siteId)),
      placements: clone(placements),
      versions: clone(s.versions.filter((v) => v.siteId === siteId)),
      pages: clone(pagesFor(siteId)),
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

  async createMenu(siteId: string, name: string, description: string): Promise<MenuRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was created.");
    if (siteMenus(siteId).length >= 12) throw new MenuError("E_LIMIT", "A website can have 12 menus at most.");
    const rec: MenuRec = { id: newId("menu"), siteId, rev: 1, updatedAt: now(), updatedBy: "You",
      draft: { name, description, items: [], mobile: { behaviour: "drawer", openFirstLevel: false } }, live: null, liveAt: null, appliedTo: null, liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  async duplicateMenu(menuId: string): Promise<MenuRec> {
    await pause(200);
    const src = store().menus.find((m) => m.id === menuId);
    if (!src) throw new MenuError("E_MISSING", "That menu no longer exists.");
    const copy = (items: MenuItem[]): MenuItem[] => items.map((i) => ({ ...i, id: newItemId(), children: copy(i.children) }));
    const rec: MenuRec = { id: newId("menu"), siteId: src.siteId, rev: 1, updatedAt: now(), updatedBy: "You",
      draft: { ...clone(src.draft), name: `${src.draft.name} (copy)`, items: copy(src.draft.items) }, live: null, liveAt: null, appliedTo: null, liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  async deleteMenu(menuId: string): Promise<void> {
    await pause(160);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was deleted.");
    const s = store();
    const rec = s.menus.find((m) => m.id === menuId);
    if (!rec) return;
    if (rec.appliedTo) throw new MenuError("E_IN_USE", `${rec.draft.name} is applied to ${rec.appliedTo.variantName}. Apply another menu there first.`);
    const p = s.placements[rec.siteId];
    if (p && LOCATIONS.some((l) => p.draft[l] === menuId || p.live?.[l] === menuId)) throw new MenuError("E_IN_USE", `${rec.draft.name} is placed on the site. Move it to another location first.`);
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

  async savePlacements(siteId: string, draft: Placements, expectedRev: number | null): Promise<PlacementRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "Save failed. Placements were not changed.");
    const p = store().placements[siteId];
    if (!p) throw new MenuError("E_MISSING", "No placements for this website.");
    if (expectedRev !== null && mode.conflict) throw new MenuError("E_CONFLICT", "Someone changed a placement while you were editing.");
    const seen = new Set<string>();
    for (const l of LOCATIONS) { const id = draft[l]; if (id && seen.has(id)) throw new MenuError("E_VALID", "A menu can sit in one location at a time."); if (id) seen.add(id); }
    p.draft = { ...draft };
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
    if (p) p.live = { ...p.draft };
    const summary = summaryOverride ?? changes.map((c) => `${c.name} ${c.detail}`).join("; ");
    const v = (Math.max(0, ...s.versions.filter((x) => x.siteId === siteId).map((x) => x.v))) + 1;
    const rec: VersionRec = {
      id: newId("ver"), siteId, v, summary, by, at: stamp, kind,
      snap: {
        menus: Object.fromEntries(siteMenus(siteId).filter((m) => m.live).map((m) => [m.id, clone(m.live!)])),
        megas: Object.fromEntries(siteMegas(siteId).filter((m) => m.live).map((m) => [m.id, clone(m.live!)])),
        placements: { ...(p?.live ?? { header: null, footer: null, utility: null }) },
      },
    };
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
  async apply(menuId: string, regionId: string, variantId: string, regions: SharedRegion[]): Promise<{ written: number; omitted: string[] }> {
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
    rec.appliedTo = { regionId, variantId, variantName: variant.name, at: now(), liveRev: rec.liveRev };
    return { written, omitted };
  },

  /** Where a menu is applied and whether that copy is behind the live menu. */
  chromeStatus(menu: MenuRec, regions: SharedRegion[]): { state: "none" | "current" | "stale" | "missing"; variantName: string | null; detail: string } {
    if (!menu.appliedTo) return { state: "none", variantName: null, detail: "Not applied to header or footer" };
    const r = regions.find((x) => x.id === menu.appliedTo!.regionId);
    const v = r?.variants.find((x) => x.id === menu.appliedTo!.variantId);
    if (!v) return { state: "missing", variantName: menu.appliedTo.variantName, detail: "The variant it was applied to was removed" };
    const ref = (v.blocks[0]?.props as { menuRef?: { menuId: string; liveRev: number } } | undefined)?.menuRef;
    if (!ref || ref.menuId !== menu.id) return { state: "stale", variantName: v.name, detail: "The variant was edited by hand since it was applied" };
    if (ref.liveRev !== menu.liveRev) return { state: "stale", variantName: v.name, detail: "The menu was published after it was applied" };
    return { state: "current", variantName: v.name, detail: "In sync with the live menu" };
  },

  /** The header or footer variants a menu can be applied to, with what each one shows now. */
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
