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
import { LayoutsAPI, layoutSnapshot, type LayoutDraft, type SharedRegion, type RegionVariant, type MenuTree, type MenuTreeNode } from "./layout-db";
import { DEFAULT_LOCALE, isLocale, localeLabel } from "./locales";
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
  /** optional icon from MENU_ICONS, shown beside the label in the preview */
  icon?: string;
  /** optional one-line description, shown under the label in dropdown and mega panels */
  description?: string;
}

/** Icons an item or mega link can carry. Ids are Icon component names. */
export const MENU_ICONS: { id: string; label: string }[] = [
  { id: "star", label: "Star" }, { id: "book", label: "Book" }, { id: "globe", label: "Globe" },
  { id: "users", label: "People" }, { id: "coins", label: "Money" }, { id: "building", label: "Building" },
  { id: "rocket", label: "Rocket" }, { id: "help", label: "Help" }, { id: "languages", label: "Languages" },
  { id: "shield", label: "Shield" }, { id: "chart", label: "Chart" }, { id: "file", label: "Page" },
];
export const MENU_ICON_IDS = MENU_ICONS.map((i) => i.id);

/** Look and motion of a menu. Optional on the document, so older drafts keep working. */
export type Preset = "classic" | "minimal" | "pill" | "underline" | "bold";
export type DropAnim = "fade" | "slide" | "scale" | "stagger" | "blur" | "flip" | "none";
export type HoverFx = "none" | "underline" | "lift" | "highlight" | "sweep" | "glow" | "arrow";
export interface MenuStyle { preset: Preset; dropAnim: DropAnim; hoverFx: HoverFx }
export const PRESETS: { id: Preset; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Plain text, thin active line" },
  { id: "minimal", label: "Minimal", hint: "Small caps, generous spacing" },
  { id: "pill", label: "Pill", hint: "Rounded highlight behind the item" },
  { id: "underline", label: "Underline", hint: "Accent line grows under the item" },
  { id: "bold", label: "Bold", hint: "Heavy weight on a dark bar" },
];
export const DROP_ANIMS: { id: DropAnim; label: string }[] = [
  { id: "fade", label: "Fade in" }, { id: "slide", label: "Slide down" }, { id: "scale", label: "Scale up" },
  { id: "stagger", label: "Stagger columns" }, { id: "blur", label: "Blur in" }, { id: "flip", label: "Flip down" }, { id: "none", label: "No animation" },
];
export const HOVER_FX: { id: HoverFx; label: string }[] = [
  { id: "underline", label: "Underline" }, { id: "lift", label: "Lift" }, { id: "highlight", label: "Highlight" },
  { id: "sweep", label: "Sweep" }, { id: "glow", label: "Glow" }, { id: "arrow", label: "Arrow" }, { id: "none", label: "None" },
];
export const MENU_STYLE_DEFAULT: MenuStyle = { preset: "classic", dropAnim: "fade", hoverFx: "underline" };
export const styleOf = (d: { style?: Partial<MenuStyle> }): MenuStyle => ({ ...MENU_STYLE_DEFAULT, ...(d.style ?? {}) });

export interface MenuDoc {
  name: string;
  description: string;
  type: MenuType;
  items: MenuItem[];
  mobile: { behaviour: MobileBehaviour; openFirstLevel: boolean };
  style?: MenuStyle;
}
/** a layout slot this menu was compiled into, and the live revision it carried */
export interface AppliedRef { layoutId: string; slot: Slot; regionId: string; variantId: string; variantName: string; at: string; liveRev: number }
export interface MenuRec {
  id: string;
  siteId: string;
  rev: number;
  updatedAt: string;
  updatedBy: string;
  /** the language this menu serves (a locale id from locales.ts) */
  locale: string;
  draft: MenuDoc;
  live: MenuDoc | null;
  liveAt: string | null;
  /** the layout slots this menu is compiled into on publish */
  applied: AppliedRef[];
  /** increments on every publish of this menu; used by the header/footer reference check */
  liveRev: number;
}

export interface MegaLink { id: string; label: string; link: LinkRef | null; icon?: string; description?: string }
export interface MegaColumn { id: string; title: string; links: MegaLink[]; /** optional "View all" link at the foot of the column */ viewAll?: { label: string; link: LinkRef | null } | null }
/** image: a FEATURED_IMAGES id (drawn art) or a media asset id from the Media Library */
export interface MegaFeatured { enabled: boolean; image: string; title: string; text: string; ctaLabel: string; ctaLink: LinkRef | null }
export type Surface = "card" | "flat" | "bordered";
/** Mega panel themes. Each is a complete look (type, colour, rules, featured card), pre-built in CSS. */
export type MegaTheme = "classic" | "editorial" | "dark" | "minimal" | "image" | "brand";
export const MEGA_THEMES: { id: MegaTheme; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "White card, bold headings, violet accents" },
  { id: "editorial", label: "Editorial", hint: "Serif headings, ruled columns, magazine feel" },
  { id: "dark", label: "Dark", hint: "Night panel, light text, glowing accent" },
  { id: "minimal", label: "Minimal", hint: "Whitespace, small caps headings, no boxes" },
  { id: "image", label: "Image cards", hint: "Each column leads with a picture card" },
  { id: "brand", label: "Brand bar", hint: "Coloured header band over the columns" },
];
export interface MegaDoc { name: string; gap: Gap; columns: MegaColumn[]; featured: MegaFeatured; surface?: Surface; dropAnim?: DropAnim; theme?: MegaTheme }
export const SURFACES: { id: Surface; label: string }[] = [{ id: "card", label: "Card" }, { id: "flat", label: "Flat" }, { id: "bordered", label: "Bordered" }];
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
/* ---------- drag and drop (visual) ----------
   A drop lands before a row, after it, or inside it (as its last child). Returns null when the drop
   breaks a rule: more than 3 levels, a mega item below the top level, or a mega item receiving children. */
export type DropWhere = "before" | "after" | "inside";

function insertRelative(items: MenuItem[], targetId: string, where: "before" | "after", node: MenuItem): MenuItem[] | null {
  const i = items.findIndex((x) => x.id === targetId);
  if (i >= 0) { const out = [...items]; out.splice(where === "before" ? i : i + 1, 0, node); return out; }
  for (let k = 0; k < items.length; k++) {
    const sub = insertRelative(items[k].children, targetId, where, node);
    if (sub) { const out = [...items]; out[k] = { ...items[k], children: sub }; return out; }
  }
  return null;
}

/** Places `node` (not yet in `items`) at a drop position. */
export function dropNode(items: MenuItem[], node: MenuItem, targetId: string, where: DropWhere): { items: MenuItem[] } | { error: string } {
  const target = findItem(items, targetId);
  if (!target) return { error: "That row is no longer in the menu." };
  let next: MenuItem[] | null;
  if (where === "inside") {
    if (target.behaviour === "mega") return { error: "A mega menu's top item opens its panel, so it can't hold sub-items." };
    if (levelOf(items, targetId) >= MENU_LIMITS.maxDepth - 1) return { error: `Maximum depth is ${MENU_LIMITS.maxDepth} levels. Move it up first.` };
    next = addChild(items, targetId, node);
    if (next === items) return { error: "That drop is not allowed." };
  } else {
    next = insertRelative(items, targetId, where, node);
    if (!next) return { error: "That drop is not allowed." };
  }
  if (depthOf(next) > MENU_LIMITS.maxDepth) return { error: `Maximum depth is ${MENU_LIMITS.maxDepth} levels.` };
  if (node.behaviour === "mega" && levelOf(next, node.id) > 0) return { error: "Mega menus attach to top-level items only." };
  if (countItems(next) > MENU_LIMITS.maxItems) return { error: `A menu takes ${MENU_LIMITS.maxItems} items at most.` };
  return { items: next };
}

/** The chain of ids from the top level down to an item, inclusive. */
export function chainTo(items: MenuItem[], id: string, acc: string[] = []): string[] | null {
  for (const it of items) {
    if (it.id === id) return [...acc, it.id];
    const r = chainTo(it.children, id, [...acc, it.id]);
    if (r) return r;
  }
  return null;
}

/**
 * Places `node` at a hierarchy depth next to a target row. Depth 0 is the top level.
 * - depth <= target's level: the node becomes a sibling of the target's ancestor at that depth,
 *   before or after it (the drop lands in the target's own list when depth equals its level).
 * - depth = target's level + 1: the node becomes the target's child (the target becomes a dropdown).
 * Every rule that dropNode enforces still applies (depth limit, mega placement, item limit).
 */
export function dropAtDepth(items: MenuItem[], node: MenuItem, targetId: string, where: "before" | "after", depth: number): { items: MenuItem[] } | { error: string } {
  const chain = chainTo(items, targetId);
  if (!chain) return { error: "That row is no longer in the menu." };
  const tLevel = chain.length - 1;
  if (depth > tLevel + 1 || depth < 0) return { error: "That level is not available here." };
  if (depth === tLevel + 1) return dropNode(items, node, targetId, "inside");
  return dropNode(items, node, chain[depth], where);
}

/** Replaces the item with the given id, wherever it is in the tree. */
function replaceItem(items: MenuItem[], id: string, node: MenuItem): MenuItem[] {
  return items.map((it) => (it.id === id ? node : { ...it, children: replaceItem(it.children, id, node) }));
}
/** Swaps a submenu item with its main menu item. The submenu item takes the parent's place, and the parent becomes its first child. The parent keeps its other children. */
export function swapWithParent(items: MenuItem[], childId: string): { items: MenuItem[] } | { error: string } {
  const chain = chainTo(items, childId);
  if (!chain || chain.length < 2) return { error: "Only a submenu item has a main menu item to swap with." };
  const parent = findItem(items, chain[chain.length - 2]);
  const child = findItem(items, childId);
  if (!parent || !child) return { error: "That item is no longer in the menu." };
  if (parent.behaviour === "mega") return { error: "A mega menu's top item keeps its panel. Detach the panel first." };
  const remaining = parent.children.filter((c) => c.id !== childId);
  const parentNext: MenuItem = { ...parent, children: remaining, behaviour: remaining.length || parent.behaviour !== "dropdown" ? parent.behaviour : "link" };
  const childNext: MenuItem = { ...child, behaviour: "dropdown", megaId: null, children: [parentNext, ...child.children] };
  const next = replaceItem(items, parent.id, childNext);
  if (depthOf(next) > MENU_LIMITS.maxDepth) return { error: `Swapping would make the menu deeper than ${MENU_LIMITS.maxDepth} levels.` };
  return { items: next };
}
/** Swaps an item with the next item in the same list. Each item keeps its own submenu. */
export function swapWithNext(items: MenuItem[], id: string): { items: MenuItem[] } | { error: string } {
  const loc = locate(items, id);
  if (!loc) return { error: "That item is no longer in the menu." };
  const nextItem = loc.list[loc.index + 1];
  if (!nextItem) return { error: "There is no item below this one to swap with." };
  const swapList = (list: MenuItem[]): MenuItem[] => { const out = [...list]; out[loc.index] = list[loc.index + 1]; out[loc.index + 1] = list[loc.index]; return out; };
  const rebuild = (list: MenuItem[]): MenuItem[] => {
    if (list === loc.list) return swapList(list);
    return list.map((it) => ({ ...it, children: rebuild(it.children) }));
  };
  return { items: rebuild(items) };
}

/** Moves an existing row to a depth next to a target. Same guards as moveNode. */
export function moveAtDepth(items: MenuItem[], dragId: string, targetId: string, where: "before" | "after", depth: number): { items: MenuItem[] } | { error: string } {
  if (dragId === targetId) return { error: "Drop it somewhere else." };
  const dragged = findItem(items, dragId);
  if (!dragged) return { error: "That item is no longer in the menu." };
  if (findItem(dragged.children, targetId)) return { error: "An item can't move inside itself." };
  const without = removeItem(items, dragId);
  return dropAtDepth(without, dragged, targetId, where, depth);
}

/** Moves an existing item to a drop position. Refuses to drop a row into its own subtree. */
export function moveNode(items: MenuItem[], dragId: string, targetId: string, where: DropWhere): { items: MenuItem[] } | { error: string } {
  if (dragId === targetId) return { error: "Drop it somewhere else." };
  const dragged = findItem(items, dragId);
  if (!dragged) return { error: "That item is no longer in the menu." };
  if (findItem(dragged.children, targetId)) return { error: "An item can't move inside itself." };
  const without = removeItem(items, dragId);
  return dropNode(without, dragged, targetId, where);
}

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
    id: ids[i], siteId: SITE, rev: 1, updatedAt: stamp, updatedBy: "Priya Nair", locale: DEFAULT_LOCALE, draft: clone(d),
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

/** true when a menu sits in any slot, in the draft or the live placements */
function menuPlaced(siteId: string, menuId: string): boolean {
  const p = store().placements[siteId];
  if (!p) return false;
  return [p.draft, p.live].some((pl) => pl && LOCATIONS.some((slot) => Object.keys(pl).some((lid) => slotsOf(pl, lid)[slot] === menuId)));
}

/** The menu as a tree for the header variant: visible items only, each mega panel's live copy attached. */
function menuTreeOf(rec: MenuRec, megas: MegaRec[]): MenuTree {
  const conv = (items: MenuItem[]): MenuTreeNode[] => items.filter((i) => i.audience === "everyone").map((i) => {
    const g = i.megaId ? megas.find((x) => x.id === i.megaId) : undefined;
    const d = g ? (g.live ?? g.draft) : null;
    return { id: i.id, label: i.label.trim(), link: i.link, newTab: i.newTab, behaviour: i.behaviour, icon: i.icon, description: i.description,
      children: conv(i.children), mega: d ? clone(d) : null };
  });
  return { items: conv((rec.live ?? rec.draft).items) };
}

/* ---------- JSON export and import ---------- */
export const MENU_EXPORT_KIND = "wacrm.menu";
export const MENU_EXPORT_VERSION = 1;

/** Serialises a menu and the mega panels its items use. Panels no item uses are left out. */
export function exportMenuJson(doc: MenuDoc, megas: { id: string; doc: MegaDoc }[]): string {
  const used = new Set<string>();
  walk(doc.items, 0, null, (it) => { if (it.megaId) used.add(it.megaId); });
  return JSON.stringify({
    kind: MENU_EXPORT_KIND, version: MENU_EXPORT_VERSION,
    menu: doc, megas: megas.filter((g) => used.has(g.id)),
  }, null, 2);
}

type ParsedImport = { ok: true; menu: MenuDoc; megas: { id: string; doc: MegaDoc }[] } | { ok: false; error: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

/** Reads a link. Returns null for "no link", undefined when the link is malformed. */
function readLink(v: unknown): LinkRef | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) return undefined;
  if (v.kind === "page" && typeof v.pageId === "string" && v.pageId) return { kind: "page", pageId: v.pageId };
  if (v.kind === "url" && typeof v.url === "string") return { kind: "url", url: v.url.slice(0, 2000) };
  if (v.kind === "anchor" && typeof v.anchor === "string") return { kind: "anchor", anchor: v.anchor.slice(0, 200) };
  return undefined;
}

/**
 * Reads an export file. Ids are regenerated so an import never collides with existing items.
 * Structural limits are enforced here (levels, item count, mega placement); the usual
 * menu checks run again when the imported menu is saved.
 */
export function parseMenuImport(text: string): ParsedImport {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "This file is not valid JSON." }; }
  if (!isObj(raw) || raw.kind !== MENU_EXPORT_KIND) return { ok: false, error: "This file is not a WACRM menu export." };
  if (raw.version !== MENU_EXPORT_VERSION) return { ok: false, error: `Export version ${String(raw.version)} is not supported.` };
  if (!isObj(raw.menu) || !Array.isArray(raw.menu.items)) return { ok: false, error: "The export has no menu items." };
  try {
    const megaMap = new Map<string, string>();
    const megas: { id: string; doc: MegaDoc }[] = [];
    if (Array.isArray(raw.megas)) for (const g of raw.megas) {
      if (!isObj(g) || typeof g.id !== "string" || !isObj(g.doc)) throw new Error("A mega panel in the export is malformed.");
      const d = g.doc;
      if (!Array.isArray(d.columns) || d.columns.length < 1 || d.columns.length > MENU_LIMITS.maxColumns) throw new Error("A mega panel needs 1 to 4 columns.");
      const columns: MegaColumn[] = d.columns.map((c) => {
        if (!isObj(c)) throw new Error("A mega column in the export is malformed.");
        const links: MegaLink[] = (Array.isArray(c.links) ? c.links : []).slice(0, MENU_LIMITS.maxLinksPerColumn).map((l) => {
          if (!isObj(l)) throw new Error("A mega link in the export is malformed.");
          const link = readLink(l.link);
          if (link === undefined) throw new Error(`The link on "${str(l.label, 40) || "a mega link"}" is not valid.`);
          const out: MegaLink = { id: newId("ml"), label: str(l.label, MENU_LIMITS.maxLabel), link };
          if (typeof l.icon === "string" && MENU_ICON_IDS.includes(l.icon)) out.icon = l.icon;
          if (typeof l.description === "string") out.description = str(l.description, 140);
          return out;
        });
        let viewAll: MegaColumn["viewAll"] = null;
        if (isObj(c.viewAll)) {
          const link = readLink(c.viewAll.link);
          if (link === undefined) throw new Error("A column's View all link is not valid.");
          viewAll = { label: str(c.viewAll.label, MENU_LIMITS.maxLabel) || "View all", link };
        }
        return { id: newId("mc"), title: str(c.title, 60), links, viewAll };
      });
      const f = isObj(d.featured) ? d.featured : {};
      const featured: MegaFeatured = {
        enabled: f.enabled === true, image: str(f.image, 200), title: str(f.title, 120), text: str(f.text, 400),
        ctaLabel: str(f.ctaLabel, 40), ctaLink: readLink(f.ctaLink) ?? null,
      };
      const id = newId("mega");
      megaMap.set(g.id, id);
      megas.push({ id, doc: {
        name: str(d.name, 80) || "Imported panel", gap: oneOf(d.gap, ["small", "medium", "large"] as const, "medium"),
        columns, featured,
        surface: oneOf(d.surface, ["card", "flat", "bordered"] as const, "card"),
        dropAnim: oneOf(d.dropAnim, DROP_ANIMS.map((x) => x.id), "fade"),
        theme: oneOf(d.theme, MEGA_THEMES.map((x) => x.id), "classic"),
      } });
    }

    const readItem = (v: unknown, depth: number): MenuItem => {
      if (!isObj(v)) throw new Error("A menu item in the export is malformed.");
      const label = str(v.label, MENU_LIMITS.maxLabel);
      const named = label || "an item";
      let behaviour = oneOf(v.behaviour, ["link", "dropdown", "mega"] as const, "link");
      if (behaviour === "mega" && depth > 0) throw new Error(`"${named}" is a mega panel below the top level. Mega panels sit at the top level only.`);
      const link = readLink(v.link);
      if (link === undefined) throw new Error(`The link on "${named}" is not valid.`);
      if (depth > MENU_LIMITS.maxDepth - 1) throw new Error(`"${named}" is nested deeper than ${MENU_LIMITS.maxDepth} levels.`);
      const kids = Array.isArray(v.children) ? v.children.map((c) => readItem(c, depth + 1)) : [];
      if (behaviour === "mega" && kids.length) throw new Error(`"${named}" is a mega panel, so it can't also have submenu items.`);
      if (kids.length && behaviour === "link") behaviour = "dropdown";
      const src = typeof v.megaId === "string" ? v.megaId : "";
      const item: MenuItem = {
        id: newItemId(), label, link, newTab: v.newTab === true,
        audience: oneOf(v.audience, ["everyone", "members", "hidden"] as const, "everyone"),
        behaviour, megaId: behaviour === "mega" && megaMap.has(src) ? megaMap.get(src)! : null,
        children: kids, cssClass: str(v.cssClass, 200), rel: oneOf(v.rel, ["", "nofollow", "sponsored"] as const, ""),
      };
      if (typeof v.icon === "string" && MENU_ICON_IDS.includes(v.icon)) item.icon = v.icon;
      if (typeof v.description === "string") item.description = str(v.description, 140);
      return item;
    };

    const m = raw.menu;
    const items = (m.items as unknown[]).map((i) => readItem(i, 0));
    if (countItems(items) > MENU_LIMITS.maxItems) throw new Error(`This menu has more than ${MENU_LIMITS.maxItems} items.`);
    const style = isObj(m.style) ? { preset: oneOf(m.style.preset, PRESETS.map((x) => x.id), "classic"), dropAnim: oneOf(m.style.dropAnim, DROP_ANIMS.map((x) => x.id), "fade"), hoverFx: oneOf(m.style.hoverFx, HOVER_FX.map((x) => x.id), "underline") } : undefined;
    const mob = isObj(m.mobile) ? m.mobile : {};
    const menu: MenuDoc = {
      name: str(m.name, 120) || "Imported menu", description: str(m.description, 300),
      type: oneOf(m.type, ["main", "footer", "utility"] as const, "main"), items,
      mobile: { behaviour: oneOf(mob.behaviour, ["drawer", "accordion"] as const, "drawer"), openFirstLevel: mob.openFirstLevel === true },
      ...(style ? { style } : {}),
    };
    return { ok: true, menu, megas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The export could not be read." };
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

  async createMenu(siteId: string, name: string, description: string, type: MenuType = "main", locale: string = DEFAULT_LOCALE): Promise<MenuRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was created.");
    if (siteMenus(siteId).length >= 12) throw new MenuError("E_LIMIT", "A website can have 12 menus at most.");
    const rec: MenuRec = { id: newId("menu"), siteId, rev: 1, updatedAt: now(), updatedBy: "You", locale,
      draft: { name, description, type, items: [], mobile: { behaviour: "drawer", openFirstLevel: false } }, live: null, liveAt: null, applied: [], liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  async duplicateMenu(menuId: string): Promise<MenuRec> {
    await pause(200);
    const src = store().menus.find((m) => m.id === menuId);
    if (!src) throw new MenuError("E_MISSING", "That menu no longer exists.");
    const copy = (items: MenuItem[]): MenuItem[] => items.map((i) => ({ ...i, id: newItemId(), children: copy(i.children) }));
    const rec: MenuRec = { id: newId("menu"), siteId: src.siteId, rev: 1, updatedAt: now(), updatedBy: "You", locale: src.locale,
      draft: { ...clone(src.draft), name: `${src.draft.name} (copy)`, items: copy(src.draft.items) }, live: null, liveAt: null, applied: [], liveRev: 0 };
    store().menus.push(rec);
    return clone(rec);
  },

  /** Changes a menu's locale. Refused while the menu sits in a slot or was applied to chrome. */
  async setMenuLocale(menuId: string, locale: string): Promise<MenuRec> {
    await pause(140);
    const rec = store().menus.find((m) => m.id === menuId);
    if (!rec) throw new MenuError("E_MISSING", "That menu no longer exists.");
    if (!isLocale(locale)) throw new MenuError("E_VALID", "That locale is not supported.");
    if (menuPlaced(rec.siteId, menuId) || rec.applied.length > 0) throw new MenuError("E_VALID", "Move this menu out of its slots before changing its locale.");
    rec.locale = locale; rec.updatedAt = now(); rec.updatedBy = "You";
    return clone(rec);
  },

  /**
   * Copies a menu, with its mega panels, into another locale. Labels are copied as they are, so the
   * new menu is a draft to translate before it is published. Refused when the locale is the same.
   */
  async translateMenu(menuId: string, locale: string): Promise<MenuRec> {
    await pause(220);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was copied.");
    const s = store();
    const src = s.menus.find((m) => m.id === menuId);
    if (!src) throw new MenuError("E_MISSING", "That menu no longer exists.");
    if (!isLocale(locale)) throw new MenuError("E_VALID", "That locale is not supported.");
    if (locale === src.locale) throw new MenuError("E_VALID", `${src.draft.name} is already ${localeLabel(locale)}.`);
    if (siteMenus(src.siteId).length >= 12) throw new MenuError("E_LIMIT", "A website can have 12 menus at most.");
    const megaCopy = new Map<string, string>();
    const copyMega = (id: string): string | null => {
      if (megaCopy.has(id)) return megaCopy.get(id)!;
      const g = s.megas.find((x) => x.id === id);
      if (!g) return null;
      const nid = newId("mega");
      megaCopy.set(id, nid);
      s.megas.push({ id: nid, siteId: g.siteId, rev: 1, updatedAt: now(), updatedBy: "You", draft: clone(g.draft), live: null, liveAt: null, liveRev: 0 });
      return nid;
    };
    const copy = (items: MenuItem[]): MenuItem[] => items.map((i) => ({ ...clone(i), id: newItemId(), megaId: i.megaId ? copyMega(i.megaId) : null, children: copy(i.children) }));
    const draft: MenuDoc = { ...clone(src.draft), name: `${src.draft.name} (${locale})`, items: copy(src.draft.items) };
    const rec: MenuRec = { id: newId("menu"), siteId: src.siteId, rev: 1, updatedAt: now(), updatedBy: "You", locale, draft, live: null, liveAt: null, applied: [], liveRev: 0 };
    s.menus.push(rec);
    return clone(rec);
  },

  /** Sets a layout's locale. Refused while a menu of another locale fills one of its slots. */
  async setLayoutLocale(siteId: string, layoutId: string, locale: string): Promise<void> {
    await pause(120);
    if (!isLocale(locale)) throw new MenuError("E_VALID", "That locale is not supported.");
    const p = store().placements[siteId];
    const menus = siteMenus(siteId);
    for (const pl of [p?.draft, p?.live]) {
      if (!pl) continue;
      for (const slot of LOCATIONS) {
        const id = slotsOf(pl, layoutId)[slot];
        const m = id ? menus.find((x) => x.id === id) : undefined;
        if (m && m.locale !== locale) throw new MenuError("E_VALID", `${m.draft.name} is ${localeLabel(m.locale)}. Move it out of this layout before changing the layout's locale.`);
      }
    }
    await LayoutsAPI.setLocale(layoutId, locale);
  },

  /** Creates a new menu (and its mega panels) from an export file. The import is a draft; nothing goes live. */
  async importMenu(siteId: string, text: string): Promise<MenuRec> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "The import service is unreachable. Nothing was imported.");
    const parsed = parseMenuImport(text);
    if (!parsed.ok) throw new MenuError("E_VALID", parsed.error);
    if (siteMenus(siteId).length >= 12) throw new MenuError("E_LIMIT", "A website can have 12 menus at most.");
    const s = store();
    for (const g of parsed.megas) {
      s.megas.push({ id: g.id, siteId, rev: 1, updatedAt: now(), updatedBy: "You", draft: g.doc, live: null, liveAt: null, liveRev: 0 });
    }
    const rec: MenuRec = { id: newId("menu"), siteId, rev: 1, updatedAt: now(), updatedBy: "You", locale: DEFAULT_LOCALE, draft: parsed.menu, live: null, liveAt: null, applied: [], liveRev: 0 };
    s.menus.push(rec);
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
        const chosen = id ? menus.find((m) => m.id === id) : undefined;
        const lt = layout.locale ?? DEFAULT_LOCALE;
        if (chosen && chosen.locale !== lt) throw new MenuError("E_VALID", `${chosen.draft.name} is ${localeLabel(chosen.locale)}, but ${layout.name} is ${localeLabel(lt)}. A menu fills only layouts in its own locale.`);
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
      props.nav = visible.map((i) => i.label.trim()).filter(Boolean);
      props.menuStyle = styleOf(live);
      props.menuTree = menuTreeOf(rec, siteMegas(rec.siteId));
      written = (props.nav as string[]).length;
    } else if (region.kind === "footer") {
      const groups: FooterGroup[] = live.items
        .filter((i) => i.children.length > 0 && i.audience === "everyone")
        .map((i) => ({ title: i.label.trim(), links: i.children.filter((c) => c.audience === "everyone").map((c) => c.label.trim()).filter(Boolean) }));
      const flat = live.items.filter((i) => i.children.length === 0 && i.behaviour !== "mega").map((i) => i.label);
      if (flat.length) omitted.push(`links with no column: ${flat.join(", ")}`);
      if (groups.length > 3) { omitted.push(`columns past the third: ${groups.slice(3).map((g) => g.title).join(", ")}`); groups.length = 3; }
      props.groups = groups;
      props.menuStyle = styleOf(live);
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
