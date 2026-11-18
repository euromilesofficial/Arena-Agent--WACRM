/* ============================================================
   Module 8 · Menus & Navigation — data, rules, and the API.

   A menu is an ordered tree of links. Three levels at most
   (0 = top, 1 = child or mega column, 2 = link inside a column).
   A top-level item can be a mega menu; its children are the columns.

   Two things make a menu more than a list:
     · checkMenu() is the broken-link check. Errors block Save; warnings do not.
     · apply() writes the menu into the shared chrome through the
       layout API (LayoutsAPI.saveRegionVariant), so the header and footer
       variants that real pages use change with it. The write is explicit:
       saving a menu never changes the live chrome by itself.

   Storage is in memory, like the layout store. A backend is in BACKEND-PLAN.md.
   ============================================================ */
import { DBX, type CmsPage } from "./data";
import { LayoutsAPI, type SharedRegion, type RegionVariant } from "./layout-db";
import { footerGroups, type FooterGroup } from "./footer";

/** Prototype states, driven by the app's state menu (see Menus.tsx). Off in normal use. */
export const mode = { fail: false, slow: false, empty: false, conflict: false };
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, mode.slow ? ms * 4 : ms));

export const MENU_LIMITS = { maxDepth: 3, maxColumns: 4, maxTop: 8, maxLabel: 40, maxMenuItems: 60 } as const;

export type LinkKind = "page" | "url" | "anchor";
export type Audience = "everyone" | "members" | "hidden";
export type Location = "header" | "footer" | "custom";
export type MobileBehaviour = "drawer" | "accordion";

export interface MenuItem {
  id: string;
  label: string;
  kind: LinkKind;
  /** page: a route path (/…); url: an absolute http(s) or mailto/tel link; anchor: #section */
  target: string;
  newTab: boolean;
  audience: Audience;
  /** top-level items only: children are columns, columns hold links */
  mega: boolean;
  children: MenuItem[];
}

export interface Menu {
  id: string;
  siteId: string;
  name: string;
  location: Location;
  items: MenuItem[];
  mobile: { behaviour: MobileBehaviour; openFirstLevel: boolean };
  rev: number;
  updatedAt: string;
  updatedBy: string;
  /** the header or footer variant this menu was last applied to, if any */
  appliedTo: { regionId: string; variantId: string; variantName: string; at: string } | null;
}

export type Severity = "error" | "warn";
export interface MenuIssue { id: string; severity: Severity; itemId?: string; label: string; detail: string }

const now = () => new Date().toISOString();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let seq = 0;
export const newItemId = () => `mi_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export const blankItem = (label = "New link"): MenuItem => ({
  id: newItemId(), label, kind: "page", target: "/", newTab: false, audience: "everyone", mega: false, children: []
});

/* ---------------- tree helpers (pure) ---------------- */

export function walk(items: MenuItem[], depth = 0, parent: MenuItem | null = null, fn: (it: MenuItem, depth: number, parent: MenuItem | null) => void) {
  for (const it of items) { fn(it, depth, parent); walk(it.children, depth + 1, it, fn); }
}

export function countItems(items: MenuItem[]): number {
  let n = 0; walk(items, 0, null, () => { n++; }); return n;
}

export function depthOf(items: MenuItem[]): number {
  let d = 0; walk(items, 0, null, (_, depth) => { d = Math.max(d, depth + 1); }); return d;
}

/** Returns a copy of the tree with one item replaced by fn(item). */
export function mapItem(items: MenuItem[], id: string, fn: (it: MenuItem) => MenuItem): MenuItem[] {
  return items.map((it) => (it.id === id ? fn(it) : { ...it, children: mapItem(it.children, id, fn) }));
}

/** Returns a copy with one item removed. */
export function removeItem(items: MenuItem[], id: string): MenuItem[] {
  return items.filter((it) => it.id !== id).map((it) => ({ ...it, children: removeItem(it.children, id) }));
}

/** Moves an item one place up (-1) or down (+1) among its siblings. */
export function moveItem(items: MenuItem[], id: string, dir: -1 | 1): MenuItem[] {
  const i = items.findIndex((it) => it.id === id);
  if (i >= 0) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return items;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }
  return items.map((it) => ({ ...it, children: moveItem(it.children, id, dir) }));
}

/** Appends a child under an item. Refused (returns the same tree) when it would exceed the depth limit. */
export function addChild(items: MenuItem[], parentId: string, child: MenuItem): MenuItem[] {
  return mapItem(items, parentId, (p) => {
    const level = findDepth(items, parentId);
    if (level === null || level + 1 >= MENU_LIMITS.maxDepth) return p;
    return { ...p, children: [...p.children, child] };
  });
}

export function findDepth(items: MenuItem[], id: string, depth = 0): number | null {
  for (const it of items) {
    if (it.id === id) return depth;
    const d = findDepth(it.children, id, depth + 1);
    if (d !== null) return d;
  }
  return null;
}

export function findItem(items: MenuItem[], id: string): MenuItem | null {
  for (const it of items) { if (it.id === id) return it; const f = findItem(it.children, id); if (f) return f; }
  return null;
}

/* ---------------- the broken-link check (pure) ---------------- */

const URL_OK = /^(https?:\/\/[^\s/$.?#].[^\s]*|mailto:[^\s@]+@[^\s@]+|tel:\+?[0-9 ()-]{6,})$/i;
const ANCHOR_OK = /^#[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Every problem a menu has. Errors block Save and apply; warnings are shown and allowed.
 * `pages` is the site's routable pages (not in the trash), so a page link can be checked.
 */
export function checkMenu(menu: Pick<Menu, "items" | "location">, pages: (Pick<CmsPage, "path" | "status" | "title"> & { trash?: unknown })[]): MenuIssue[] {
  const out: MenuIssue[] = [];
  /* a trashed page is not a live destination, whatever the caller passed in */
  const byPath = new Map(pages.filter((p) => !p.trash).map((p) => [p.path, p]));
  const seenTargets = new Map<string, string>();
  if (menu.items.length === 0) out.push({ id: "empty", severity: "warn", label: "This menu is empty", detail: "It renders nothing until a link is added." });
  if (countItems(menu.items) > MENU_LIMITS.maxMenuItems) out.push({ id: "too_many", severity: "error", label: `More than ${MENU_LIMITS.maxMenuItems} links`, detail: "Trim the menu before saving." });
  if (menu.location === "header" && menu.items.length > MENU_LIMITS.maxTop)
    out.push({ id: "top_count", severity: "warn", label: `${menu.items.length} top-level links`, detail: `A header reads best with ${MENU_LIMITS.maxTop} or fewer.` });
  if (depthOf(menu.items) > MENU_LIMITS.maxDepth) out.push({ id: "depth", severity: "error", label: "Too deep", detail: `Menus allow ${MENU_LIMITS.maxDepth} levels.` });

  walk(menu.items, 0, null, (it, depth, parent) => {
    const at = { itemId: it.id };
    const name = it.label.trim() || "(no label)";
    if (!it.label.trim()) out.push({ id: "label_empty", severity: "error", ...at, label: "A link has no label", detail: "Every link needs the text a visitor reads." });
    if (it.label.length > MENU_LIMITS.maxLabel) out.push({ id: "label_long", severity: "warn", ...at, label: `“${name.slice(0, 24)}…” is long`, detail: `${it.label.length} characters. Keep labels under ${MENU_LIMITS.maxLabel}.` });

    if (it.mega) {
      if (depth !== 0) out.push({ id: "mega_depth", severity: "error", ...at, label: `“${name}” cannot be a mega menu`, detail: "Only top-level items open a mega menu." });
      if (it.children.length === 0) out.push({ id: "mega_empty", severity: "warn", ...at, label: `“${name}” has no columns`, detail: "A mega menu with no columns opens an empty panel." });
      if (it.children.length > MENU_LIMITS.maxColumns) out.push({ id: "mega_cols", severity: "error", ...at, label: `“${name}” has ${it.children.length} columns`, detail: `Use ${MENU_LIMITS.maxColumns} or fewer. More columns are hard to scan.` });
    }
    if (parent && parent.audience === "hidden" && it.audience !== "hidden")
      out.push({ id: "hidden_parent", severity: "warn", ...at, label: `“${name}” is hidden with its parent`, detail: "A hidden item hides everything under it." });

    if (it.kind === "page") {
      if (!it.target.startsWith("/")) out.push({ id: "page_target", severity: "error", ...at, label: `“${name}” has no page`, detail: "Choose a page for this link." });
      else {
        const p = byPath.get(it.target);
        if (!p) out.push({ id: "page_missing", severity: "error", ...at, label: `“${name}” links to ${it.target}, which does not exist`, detail: "The page was moved, renamed or deleted. Pick the page again." });
        else if (p.status === "draft") out.push({ id: "page_draft", severity: "warn", ...at, label: `“${name}” links to a draft`, detail: `${p.title} is not published, so visitors will see a dead link.` });
      }
    } else if (it.kind === "url") {
      if (!it.target.trim()) out.push({ id: "url_empty", severity: "error", ...at, label: `“${name}” has no address`, detail: "Enter the full address." });
      else if (!URL_OK.test(it.target.trim())) out.push({ id: "url_bad", severity: "error", ...at, label: `“${name}” is not a valid address`, detail: `${it.target} must start with https://, mailto: or tel:.` });
      else if (/^http:\/\//i.test(it.target.trim())) out.push({ id: "url_http", severity: "warn", ...at, label: `“${name}” uses plain http`, detail: "Use https so visitors are not warned." });
    } else if (it.kind === "anchor") {
      if (!ANCHOR_OK.test(it.target.trim())) out.push({ id: "anchor_bad", severity: "error", ...at, label: `“${name}” has an invalid anchor`, detail: "Anchors look like #pricing or #contact-us." });
    }

    const key = `${it.kind}:${it.target.trim()}`;
    if (it.target.trim() && seenTargets.has(key)) out.push({ id: "dup_target", severity: "warn", ...at, label: `“${name}” duplicates another link`, detail: `Same target as “${seenTargets.get(key)}”.` });
    else if (it.target.trim()) seenTargets.set(key, name);
  });
  return out;
}

export const hasErrors = (issues: MenuIssue[]) => issues.some((i) => i.severity === "error");

/* ---------------- seed ---------------- */

const link = (label: string, target: string, extra: Partial<MenuItem> = {}): MenuItem =>
  ({ ...blankItem(label), label, kind: target.startsWith("/") ? "page" : "url", target, ...extra });

/* Paths match the seeded page tree (cms-pages.ts). "Study in France" is a draft, so its link
   shows a warning on the seed, which is the check working on real data. */
const SEED: Omit<Menu, "rev" | "updatedAt" | "updatedBy" | "appliedTo">[] = [
  {
    id: "menu_primary", siteId: "site_main", name: "Primary navigation", location: "header",
    mobile: { behaviour: "drawer", openFirstLevel: false },
    items: [
      link("Home", "/"),
      { ...link("Study Abroad", "/study-abroad"), mega: true, children: [
        { ...blankItem("Destinations"), kind: "page", target: "/destinations", children: [
          link("Spain", "/destinations/spain"),
          link("Netherlands", "/destinations/netherlands"),
          link("Ireland", "/destinations/ireland")
        ] },
        { ...blankItem("Study in"), kind: "page", target: "/study-abroad", children: [
          link("Italy", "/study-abroad/italy"),
          link("Germany", "/study-abroad/germany"),
          link("France", "/study-abroad/france")
        ] },
        { ...blankItem("Services"), kind: "page", target: "/services", children: [
          link("Career Counselling", "/services/career-counselling"),
          link("Visa Assistance", "/services/visa-assistance")
        ] }
      ] },
      link("Scholarships", "/scholarships"),
      link("Contact Us", "/contact-us")
    ]
  },
  {
    id: "menu_footer", siteId: "site_main", name: "Footer columns", location: "footer",
    mobile: { behaviour: "accordion", openFirstLevel: false },
    items: [
      { ...blankItem("Company"), kind: "page", target: "/about-us", children: [link("About us", "/about-us"), link("Our Story", "/about-us/our-story"), link("Team", "/about-us/team")] },
      { ...blankItem("Study"), kind: "page", target: "/study-abroad", children: [link("Destinations", "/destinations"), link("Scholarships", "/scholarships"), link("Universities", "/universities")] },
      { ...blankItem("Support"), kind: "page", target: "/contact-us", children: [link("Contact", "/contact-us"), link("Blogs", "/resources/blogs"), link("Downloads", "/resources/downloads")] }
    ]
  }
];

let menus: Menu[] | null = null;
function store(): Menu[] {
  if (!menus) menus = SEED.map((m) => ({ ...clone(m), rev: 1, updatedAt: now(), updatedBy: "Priya Nair", appliedTo: null }));
  return menus;
}

/* ---------------- API ---------------- */

export const MenusAPI = {
  /** Menus of one site, plus the pages they can link to. */
  async load(siteId: string) {
    await pause(180);
    if (mode.fail) throw new MenuError("E_LOAD", "Could not reach the menu service. The last good copy is still on disk.");
    const pages = DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
    return { menus: mode.empty ? [] : clone(store().filter((m) => m.siteId === siteId)), pages: clone(pages) };
  },

  /** Compare-and-swap save. Errors block the write; warnings do not. */
  async save(menu: Menu, expectedRev: number): Promise<Menu> {
    await pause(240);
    if (mode.fail) throw new MenuError("E_SAVE", "Save failed. The menu service is unreachable, so nothing was written.");
    const live = store().find((m) => m.id === menu.id);
    if (!live) throw new MenuError("E_MISSING", "That menu was removed in another tab.");
    if (live.rev !== expectedRev || mode.conflict) throw new MenuError("E_CONFLICT", `Someone saved ${live.name} at revision ${live.rev + (mode.conflict ? 1 : 0)} while you were editing.`);
    if (!menu.name.trim()) throw new MenuError("E_VALID", "A menu needs a name.");
    if (store().some((m) => m.id !== menu.id && m.siteId === menu.siteId && m.name.toLowerCase() === menu.name.trim().toLowerCase()))
      throw new MenuError("E_VALID", "That menu name is already in use.");
    const pages = DBX().cmsPages.filter((p) => p.siteId === menu.siteId && !p.trash);
    const errors = checkMenu(menu, pages).filter((i) => i.severity === "error");
    if (errors.length) throw new MenuError("E_VALID", `${errors.length} problem${errors.length === 1 ? "" : "s"} must be fixed before saving: ${errors[0].label}.`);
    const next: Menu = { ...clone(menu), name: menu.name.trim(), rev: live.rev + 1, updatedAt: now(), updatedBy: "Priya Nair" };
    menus = store().map((m) => (m.id === next.id ? next : m));
    return clone(next);
  },

  async create(siteId: string, name: string, location: Location): Promise<Menu> {
    await pause(200);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was created.");
    const clean = name.trim();
    if (!clean) throw new MenuError("E_VALID", "Give the menu a name.");
    if (store().some((m) => m.siteId === siteId && m.name.toLowerCase() === clean.toLowerCase())) throw new MenuError("E_VALID", "That menu name is already in use.");
    const m: Menu = {
      id: `menu_${Date.now().toString(36)}`, siteId, name: clean.slice(0, 60), location, items: [], rev: 1,
      mobile: { behaviour: location === "header" ? "drawer" : "accordion", openFirstLevel: false },
      updatedAt: now(), updatedBy: "Priya Nair", appliedTo: null
    };
    menus = [...store(), m];
    return clone(m);
  },

  async remove(menuId: string): Promise<void> {
    await pause(160);
    if (mode.fail) throw new MenuError("E_SAVE", "The menu service is unreachable. Nothing was deleted.");
    const m = store().find((x) => x.id === menuId);
    if (!m) throw new MenuError("E_MISSING", "That menu no longer exists.");
    if (m.appliedTo) throw new MenuError("E_LOCKED", `${m.name} is applied to ${m.appliedTo.variantName}. Apply another menu there first.`);
    menus = store().filter((x) => x.id !== menuId);
  },

  /**
   * Writes the menu into the shared chrome that real pages use.
   *  header: top-level labels of visible links become the variant's nav list.
   *  footer: each top-level link with children becomes a column; its children become the links.
   * Returns what was written and what was left out, so the UI can say so.
   */
  async apply(menu: Menu, regionId: string, variantId: string, regions: SharedRegion[]): Promise<{ written: number; omitted: string[] }> {
    await pause(260);
    if (mode.fail) throw new MenuError("E_SAVE", "The chrome service is unreachable. The header and footer were not changed.");
    const region = regions.find((r) => r.id === regionId);
    const variant = region?.variants.find((v) => v.id === variantId);
    if (!region || !variant) throw new MenuError("E_MISSING", "That header or footer variant no longer exists.");
    const props = { ...((variant.blocks[0]?.props ?? {}) as Record<string, unknown>) };
    const omitted: string[] = [];
    let written = 0;
    if (region.kind === "header") {
      const visible = menu.items.filter((i) => i.audience === "everyone");
      const hidden = menu.items.filter((i) => i.audience !== "everyone").map((i) => i.label);
      if (hidden.length) omitted.push(`hidden from visitors: ${hidden.join(", ")}`);
      const nested = menu.items.filter((i) => i.children.length > 0).length;
      if (nested) omitted.push(`dropdowns and mega columns (${nested}) — a header shows top-level labels only`);
      props.nav = visible.map((i) => i.label.trim()).filter(Boolean);
      written = (props.nav as string[]).length;
    } else if (region.kind === "footer") {
      const groups: FooterGroup[] = menu.items
        .filter((i) => i.children.length > 0 && i.audience === "everyone")
        .map((i) => ({ title: i.label.trim(), links: i.children.filter((c) => c.audience === "everyone").map((c) => c.label.trim()).filter(Boolean) }));
      const flat = menu.items.filter((i) => i.children.length === 0).map((i) => i.label);
      if (flat.length) omitted.push(`links with no column: ${flat.join(", ")}`);
      if (groups.length > 3) { omitted.push(`columns past the third: ${groups.slice(3).map((g) => g.title).join(", ")}`); groups.length = 3; }
      props.groups = groups;
      written = groups.length;
    } else {
      throw new MenuError("E_VALID", "Only a header or footer menu can be applied to shared chrome.");
    }
    const next: RegionVariant = { ...variant, blocks: [{ ...(variant.blocks[0] ?? { id: "chrome", type: "container", style: {} }), props }] } as RegionVariant;
    await LayoutsAPI.saveRegionVariant(regionId, next);
    const live = store().find((m) => m.id === menu.id);
    if (live) live.appliedTo = { regionId, variantId, variantName: variant.name, at: now() };
    return { written, omitted };
  },

  /** The header or footer variants a menu can be applied to, with what each one shows now. */
  chromeTargets(regions: SharedRegion[], location: Location) {
    if (location === "custom") return [];
    const kind = location === "header" ? "header" : "footer";
    const r = regions.find((x) => x.kind === kind);
    if (!r) return [];
    return r.variants.map((v) => {
      const p = (v.blocks[0]?.props ?? {}) as { nav?: unknown; groups?: unknown };
      const groups = kind === "footer" ? footerGroups(p) : [];
      const nav = kind === "header" && Array.isArray(p.nav) ? (p.nav as string[]) : [];
      return { regionId: r.id, variantId: v.id, name: v.name, note: v.note, nav, groups };
    });
  },

  /** Whether a variant's live content already matches the saved menu. */
  inSync(menu: Menu, target: { nav: string[]; groups: FooterGroup[] }, location: Location): boolean {
    if (location === "header") {
      const want = menu.items.filter((i) => i.audience === "everyone").map((i) => i.label.trim()).filter(Boolean);
      return JSON.stringify(want) === JSON.stringify(target.nav);
    }
    if (location === "footer") {
      const want = menu.items.filter((i) => i.children.length > 0 && i.audience === "everyone")
        .map((i) => ({ title: i.label.trim(), links: i.children.filter((c) => c.audience === "everyone").map((c) => c.label.trim()).filter(Boolean) })).slice(0, 3);
      return JSON.stringify(want) === JSON.stringify(target.groups);
    }
    return true;
  }
};

export class MenuError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "MenuError"; }
}

/** Test hook: restores the seed. Used by the QA suite only. */
export function __resetMenus() { menus = null; }
