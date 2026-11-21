/* ============================================================
   Module 8 · Menus & Navigation
   ------------------------------------------------------------
   Menus are trees of links (3 levels). Edits go to a draft per menu, per mega panel and to the
   placement draft. Save Draft saves menus and mega panels. Save Placement Draft saves which menu
   fills each layout slot. Publish copies drafts live as a numbered version and compiles each placed
   menu into its layout's header or footer. Rollback publishes an older version as a new one.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Btn, EmptyState, Field, Modal, Pill, Skel, Switch } from "@/components/ui";
import { useApp } from "@/lib/store";
import { DBX, type CmsPage } from "@/lib/data";
import { themeFor } from "@/lib/theme-db";
import {
  LOCATIONS, LOC_LABEL, MENU_LIMITS, MENU_TYPE_LABEL, MenuError, MenusAPI, addChild, blankLink, checkMega, checkMenu, countItems,
  DropWhere, dropAtDepth, moveAtDepth, swapWithNext, swapWithParent, locate, duplicateItem, findItem, indentItem, levelOf, mapItem, megaHasChanges, megaUsage, mode as MenusMode, moveItem,
  outdentItem, placedIn, removeItem, sameDoc, slotsOf, statusOf, toTopLevel, urlOk, walk, hasChanges,
  type Audience, type Behaviour, type Loaded, type MegaDoc, type MenuDoc, type MenuIssue, type MenuItem, type MenuType, type Placements, type Slot, type VersionRec,
} from "@/lib/menu-db";
import { type Device, LinkEditor, MegaEditor, MegaPanelView, NavPreview } from "@/components/menus/MenuParts";
import { DROP_ANIMS, HOVER_FX, PRESETS, styleOf, type DropAnim, type HoverFx, type Preset } from "@/lib/menu-db";
import { AUD_LABEL, Accordion, ago, ChromeList, CreateMegaModal, CreateMenuModal, Head, Kpi, depthOfId, placeLabel, renderTabs, when, type ModalState, type Tab } from "./MenusParts";

type Draft<T> = { doc: T; base: number };
type Hist = { past: MenuDoc[]; future: MenuDoc[] };
const HIST_LIMIT = 50;

export function Menus() {
  const app = useApp();
  const siteId = app.siteId === "all" ? "site_main" : app.siteId;
  const siteName = DBX().sites.find((s) => s.id === siteId)?.name ?? "Website";
  const readOnly = app.role === "Viewer" || app.demo === "denied";
  MenusMode.fail = app.demo === "error";
  MenusMode.slow = app.demo === "loading";
  MenusMode.empty = app.demo === "empty";
  MenusMode.conflict = app.demo === "conflict";

  const [tab, setTab] = useState<Tab>("builder");
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadErr, setLoadErr] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [mDraft, setMDraft] = useState<Record<string, Draft<MenuDoc>>>({});
  const [gDraft, setGDraft] = useState<Record<string, Draft<MegaDoc>>>({});
  const [pDraft, setPDraft] = useState<Placements | null>(null);
  const [hist, setHist] = useState<Record<string, Hist>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [megaId, setMegaId] = useState<string | null>(null);
  const [itemTab, setItemTab] = useState<"settings" | "mega" | "advanced">("settings");
  const [device, setDevice] = useState<Device>("desktop");
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageQ, setPageQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("https://");
  const [customNewTab, setCustomNewTab] = useState(false);
  const [customErr, setCustomErr] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuQ, setMenuQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageQ, setManageQ] = useState("");
  const [manageFilter, setManageFilter] = useState<"all" | "published" | "draft" | "assigned" | "unassigned">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPage, setDragPage] = useState<string | null>(null);
  /* Hover feedback is painted straight onto the row (see paintHover). It never re-renders the screen. */
  const hoverRef = useRef<{ id: string | null; where: DropWhere | null; depth: number }>({ id: null, where: null, depth: -1 });
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<MenuType>("main");
  const [leftTab, setLeftTab] = useState<"add" | "settings">("add");
  const [addMode, setAddMode] = useState<"pages" | "custom">("pages");
  const [placeLay, setPlaceLay] = useState<string>("");

  /* ---------- load ---------- */
  const reload = useCallback(async () => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    try {
      const m = await MenusAPI.load(siteId);
      setData(m);
      setLoadErr("");
      setStatus("ready");
      // a draft survives a reload only if it still starts from the saved revision
      setMDraft((d) => Object.fromEntries(Object.entries(d).filter(([id, v]) => m.menus.find((x) => x.id === id)?.rev === v.base)));
      setGDraft((d) => Object.fromEntries(Object.entries(d).filter(([id, v]) => m.megas.find((x) => x.id === id)?.rev === v.base)));
      setPDraft((d) => (d && !sameDoc(d, m.placements.draft) ? d : null));
      setMenuId((cur) => (cur && m.menus.some((x) => x.id === cur) ? cur : m.menus[0]?.id ?? null));
      setMegaId((cur) => (cur && m.megas.some((x) => x.id === cur) ? cur : m.megas[0]?.id ?? null));
    } catch (e) {
      setLoadErr(e instanceof MenuError ? e.message : "Could not load menus.");
      setStatus("error");
    }
  }, [siteId]);
  // the loading prototype state shows skeletons even when data is already on screen
  useEffect(() => { if (app.demo === "loading") setStatus("loading"); }, [app.demo]);
  useEffect(() => { void reload(); }, [reload, tick, app.demo]);
  useEffect(() => { setMenuId(null); setItemId(null); setMegaId(null); setMDraft({}); setGDraft({}); setPDraft(null); setHist({}); }, [siteId]);

  /* ---------- derived ---------- */
  const menus = data?.menus ?? [];
  const megas = data?.megas ?? [];
  const pages = (data?.pages ?? []) as CmsPage[];
  const layouts = data?.layouts ?? [];
  const regions = data?.regions ?? [];
  const menu = menus.find((m) => m.id === menuId) ?? null;
  const doc: MenuDoc | null = menu ? mDraft[menu.id]?.doc ?? menu.draft : null;
  const placeDoc: Placements | null = data ? pDraft ?? data.placements.draft : null;
  const placeDirty = !!data && !!pDraft && !sameDoc(pDraft, data.placements.draft);
  const megaDocOf = (id: string): MegaDoc | undefined => {
    const g = megas.find((x) => x.id === id);
    return g ? gDraft[id]?.doc ?? g.draft : undefined;
  };
  const dirtyMenuIds = Object.keys(mDraft).filter((id) => { const m = menus.find((x) => x.id === id); return !!m && !sameDoc(mDraft[id].doc, m.draft); });
  const dirtyMegaIds = Object.keys(gDraft).filter((id) => { const g = megas.find((x) => x.id === id); return !!g && !sameDoc(gDraft[id].doc, g.draft); });
  const anyDirty = dirtyMenuIds.length > 0 || dirtyMegaIds.length > 0;

  /* checks run on the drafts on screen, so errors show before anything is saved */
  const checks = useMemo(() => {
    const byMenu: Record<string, MenuIssue[]> = {};
    if (!data) return { byMenu, errors: 0, warns: 0, all: [] as MenuIssue[] };
    for (const m of data.menus) byMenu[m.id] = checkMenu(mDraft[m.id]?.doc ?? m.draft, data.pages as CmsPage[], data.megas.map((g) => g.id), m.id);
    for (const g of data.megas) {
      const iss = checkMega(gDraft[g.id]?.doc ?? g.draft, data.pages as CmsPage[], g.id);
      if (iss.length) byMenu[`mega:${g.id}`] = iss;
    }
    const all = Object.values(byMenu).flat();
    return { byMenu, errors: all.filter((i) => i.severity === "error").length, warns: all.filter((i) => i.severity === "warn").length, all };
  }, [data, mDraft, gDraft]);

  /* what Publish would ship: menus, mega panels, and saved placement changes */
  const changes = useMemo(() => {
    const out: { kind: string; name: string; detail: string }[] = [];
    if (!data) return out;
    for (const m of data.menus) {
      const d = mDraft[m.id]?.doc ?? m.draft;
      if (!m.live || !sameDoc(m.live, d)) out.push({ kind: "Menu", name: d.name, detail: m.live ? "edited" : "new, never published" });
    }
    for (const g of data.megas) {
      const d = gDraft[g.id]?.doc ?? g.draft;
      if (!g.live || !sameDoc(g.live, d)) out.push({ kind: "Mega panel", name: d.name, detail: g.live ? "edited" : "new, never published" });
    }
    const live = data.placements.live ?? {};
    for (const l of data.layouts) for (const s of LOCATIONS) {
      const a = slotsOf(live, l.id)[s];
      const b = slotsOf(data.placements.draft, l.id)[s];
      if (a !== b) {
        const name = (id: string | null) => (id ? data.menus.find((m) => m.id === id)?.draft.name ?? "menu" : "nothing");
        out.push({ kind: "Placement", name: `${LOC_LABEL[s]} · ${l.name}`, detail: `${name(a)} → ${name(b)}` });
      }
    }
    return out;
  }, [data, mDraft, gDraft]);

  const placedCount = data ? new Set(LOCATIONS.flatMap((s) => data.layouts.map((l) => slotsOf(placeDoc, l.id)[s]).filter(Boolean))).size : 0;
  const liveVersion = data ? Math.max(0, ...data.versions.map((v) => v.v)) : 0;
  const placed = (id: string) => placedIn(placeDoc, id);
  const itemSel = doc && itemId ? findItem(doc.items, itemId) : null;
  const itemDepth = itemSel && doc ? depthOfId(doc.items, itemSel.id) : 0;
  const draftCount = changes.length;
  const pageLinkedIds = (d: MenuDoc) => { const ids: string[] = []; walk(d.items, 0, null, (it) => { if (it.link?.kind === "page") ids.push(it.link.pageId); }); return ids; };

  /* ---------- writers ---------- */
  const setDoc = (next: MenuDoc) => {
    if (!menu || readOnly) return;
    const cur = mDraft[menu.id]?.doc ?? menu.draft;
    if (sameDoc(cur, next)) return;
    setHist((h) => {
      const p = h[menu.id] ?? { past: [], future: [] };
      return { ...h, [menu.id]: { past: [...p.past, cur].slice(-HIST_LIMIT), future: [] } };
    });
    setMDraft((d) => ({ ...d, [menu.id]: { doc: next, base: d[menu.id]?.base ?? menu.rev } }));
  };
  const patchDoc = (fn: (d: MenuDoc) => MenuDoc) => { if (doc) setDoc(fn(doc)); };
  const stepHistory = (dir: "undo" | "redo") => {
    if (!menu) return;
    const h = hist[menu.id] ?? { past: [], future: [] };
    const cur = mDraft[menu.id]?.doc ?? menu.draft;
    if (dir === "undo" && h.past.length) {
      const prev = h.past[h.past.length - 1];
      setHist((x) => ({ ...x, [menu.id]: { past: h.past.slice(0, -1), future: [cur, ...h.future].slice(0, HIST_LIMIT) } }));
      setMDraft((d) => ({ ...d, [menu.id]: { doc: prev, base: d[menu.id]?.base ?? menu.rev } }));
      setAnnounce("Undone.");
    }
    if (dir === "redo" && h.future.length) {
      const next = h.future[0];
      setHist((x) => ({ ...x, [menu.id]: { past: [...h.past, cur].slice(-HIST_LIMIT), future: h.future.slice(1) } }));
      setMDraft((d) => ({ ...d, [menu.id]: { doc: next, base: d[menu.id]?.base ?? menu.rev } }));
      setAnnounce("Redone.");
    }
  };
  const setMegaDoc = (id: string, next: MegaDoc) => {
    const g = megas.find((x) => x.id === id);
    if (!g || readOnly) return;
    setGDraft((d) => ({ ...d, [id]: { doc: next, base: d[id]?.base ?? g.rev } }));
  };
  const setItemField = (fn: (it: MenuItem) => MenuItem) => { if (doc && itemId) setDoc({ ...doc, items: mapItem(doc.items, itemId, fn) }); };
  const toastErr = (e: unknown, title: string) => app.toast({ type: "error", title, sub: e instanceof Error ? e.message : undefined });
  const resetDrafts = () => { setMDraft({}); setGDraft({}); setHist({}); };

  /** Save every dirty menu and mega panel. Placements are saved separately. */
  const saveAll = async (quiet = false): Promise<boolean> => {
    if (!data || readOnly) return false;
    if (!anyDirty) return true;
    setBusy(true);
    try {
      for (const id of dirtyMenuIds) await MenusAPI.saveMenu(id, mDraft[id].doc, menus.find((x) => x.id === id)!.rev);
      for (const id of dirtyMegaIds) await MenusAPI.saveMega(id, gDraft[id].doc, megas.find((x) => x.id === id)!.rev);
      setConflict(null);
      resetDrafts();
      if (!quiet) app.toast({ type: "success", title: "Menu draft saved", sub: "Nothing is live until you publish." });
      setTick((t) => t + 1);
      return true;
    } catch (e) {
      if (e instanceof MenuError && e.code === "E_CONFLICT") { setConflict(e.message); return false; }
      toastErr(e, "Could not save");
      return false;
    } finally { setBusy(false); }
  };

  const savePlacementDraft = async () => {
    if (!data || !pDraft || readOnly) return;
    setBusy(true);
    try {
      await MenusAPI.savePlacements(siteId, pDraft, null);
      setPDraft(null);
      setTick((t) => t + 1);
      app.toast({ type: "success", title: "Navigation placement saved as draft.", sub: "It goes live when you publish." });
    } catch (e) { toastErr(e, "Could not save placement"); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!data || readOnly || checks.errors > 0) return;
    setBusy(true);
    try {
      if (anyDirty) { const ok = await saveAll(true); if (!ok) return; }
      const v = await MenusAPI.publish(siteId, "You");
      resetDrafts();
      setModal(null);
      setTick((t) => t + 1);
      app.toast({ type: "success", title: `Published version ${v.v}`, sub: v.summary });
    } catch (e) { toastErr(e, "Publish blocked"); }
    finally { setBusy(false); }
  };

  const rollback = async (v: VersionRec) => {
    setBusy(true);
    try {
      await MenusAPI.rollback(siteId, v.id);
      resetDrafts();
      setPDraft(null);
      setModal(null);
      setTick((t) => t + 1);
      app.toast({ type: "success", title: `Rolled back to v${v.v}`, sub: "Published as a new version. Menus and their placements were restored together." });
    } catch (e) { toastErr(e, "Could not roll back"); }
    finally { setBusy(false); }
  };

  /* ---------- placements ---------- */
  const setSlot = (lay: string, slot: Slot, to: string | null) => {
    if (!data) return;
    const base = pDraft ?? data.placements.draft;
    const next: Placements = { ...base, [lay]: { ...slotsOf(base, lay), [slot]: to } };
    setPDraft(next);
  };
  /** choosing a menu for a slot that already has another menu asks first */
  const chooseSlot = (lay: string, slot: Slot, to: string | null) => {
    const current = slotsOf(placeDoc, lay)[slot];
    if (to && current && current !== to) { setModal({ kind: "replace", layoutId: lay, slot, to }); return; }
    setSlot(lay, slot, to);
  };
  const doReplace = (lay: string, slot: Slot, to: string) => { setSlot(lay, slot, to); setModal(null); };

  /* ---------- switching menus: unsaved work is never dropped silently ---------- */
  const selectMenu = (id: string, skipGuard = false) => {
    if (!skipGuard && menu && dirtyMenuIds.includes(menu.id) && id !== menu.id) { setModal({ kind: "unsaved", next: id }); setMenuOpen(false); return; }
    setMenuId(id); setItemId(null); setMenuOpen(false); setMenuQ(""); setTab("builder"); setPreviewing(false);
  };

  /* ---------- tree actions ---------- */
  const addPicked = (confirmed = false) => {
    if (!doc) return;
    const existing = new Set(pageLinkedIds(doc));
    const dupes = picked.filter((p) => existing.has(p));
    if (dupes.length && !confirmed) { setModal({ kind: "dup-link", pageIds: picked }); return; }
    const adds = picked.map((pid) => blankLink(pages.find((x) => x.id === pid)?.title ?? "Page", { kind: "page", pageId: pid }));
    if (doc.items.length + adds.length > MENU_LIMITS.maxTop) {
      app.toast({ type: "error", title: "Too many top-level links", sub: `A menu takes ${MENU_LIMITS.maxTop} top-level links. Move some under a dropdown first.` });
      return;
    }
    setDoc({ ...doc, items: [...doc.items, ...adds] });
    setPicked([]);
    setModal(null);
    if (adds[0]) setItemId(adds[0].id);
    setAnnounce(`${adds.length} item${adds.length === 1 ? "" : "s"} added to menu.`);
    app.toast({ type: "success", title: `${adds.length} item${adds.length === 1 ? "" : "s"} added to menu.` });
  };
  const addCustom = () => {
    if (!doc) return;
    if (!urlOk(customUrl)) {
      setCustomErr("Address not allowed. Use https://, http://, mailto: or tel:. Scripts and credentials are refused.");
      return;
    }
    if (!customLabel.trim()) { setCustomErr("Enter a navigation label."); return; }
    setCustomErr("");
    const it = { ...blankLink(customLabel.trim(), { kind: "url", url: customUrl.trim() }), newTab: customNewTab };
    setDoc({ ...doc, items: [...doc.items, it] });
    setItemId(it.id);
    setCustomLabel(""); setCustomUrl("https://"); setCustomNewTab(false);
    setAnnounce(`${it.label} added to menu.`);
  };
  const addUnder = (parentId: string) => {
    if (!doc) return;
    const it = blankLink("New link", null);
    const next = addChild(doc.items, parentId, it);
    if (next === doc.items) { app.toast({ type: "error", title: "Maximum depth is 3 levels", sub: "Move this item up before adding a child." }); return; }
    setDoc({ ...doc, items: next });
    setItemId(it.id);
    setCollapsed((s) => { const n = new Set(s); n.delete(parentId); return n; });
    setAnnounce("Child link added.");
  };
  const removeSel = (id: string) => {
    if (!doc) return;
    const it = findItem(doc.items, id);
    setDoc({ ...doc, items: removeItem(doc.items, id) });
    if (itemId === id) setItemId(null);
    setModal(null);
    setAnnounce(`${it?.label ?? "Item"} removed.`);
  };
  const move = (id: string, dir: -1 | 1) => {
    if (!doc) return;
    const it = findItem(doc.items, id); if (!it) return;
    const next = moveItem(doc.items, id, dir);
    if (next === doc.items) { setAnnounce(`${it.label} is already ${dir < 0 ? "first" : "last"} in its list.`); return; }
    setDoc({ ...doc, items: next });
    setAnnounce(`Moved ${it.label} ${dir < 0 ? "up" : "down"}.`);
  };
  const indent = (id: string) => {
    if (!doc) return;
    const it = findItem(doc.items, id); if (!it) return;
    const next = indentItem(doc.items, id);
    if (next === doc.items) { setAnnounce(`${it.label} cannot be indented here. Check the level limit and the item above.`); return; }
    setDoc({ ...doc, items: next });
    setAnnounce(`Moved ${it.label} to level ${levelOf(next, id) + 1}.`);
  };
  const outdent = (id: string) => {
    if (!doc) return;
    const it = findItem(doc.items, id); if (!it) return;
    const next = outdentItem(doc.items, id);
    if (next === doc.items) { setAnnounce(`${it.label} is already at the top level.`); return; }
    setDoc({ ...doc, items: next });
    setAnnounce(`Moved ${it.label} to level ${levelOf(next, id) + 1}.`);
  };
  /** the overflow menu on each row */
  const rowAction = (id: string, act: "child" | "top" | "dup" | "attach" | "detach" | "remove") => {
    if (!doc || readOnly) return;
    setRowMenu(null);
    const it = findItem(doc.items, id); if (!it) return;
    setItemId(id); setItemTab("settings");
    if (act === "child") addUnder(id);
    if (act === "top") { const next = toTopLevel(doc.items, id); setDoc({ ...doc, items: next }); setAnnounce(`Moved ${it.label} to the top level.`); }
    if (act === "dup") { setDoc({ ...doc, items: duplicateItem(doc.items, id) }); setAnnounce(`Duplicated ${it.label}.`); }
    if (act === "attach") {
      if (depthOfId(doc.items, id) !== 0) { app.toast({ type: "error", title: "Mega menus attach to top-level items only" }); return; }
      setDoc({ ...doc, items: mapItem(doc.items, id, (x) => ({ ...x, behaviour: "mega" as Behaviour })) });
      setItemTab("mega");
    }
    if (act === "detach") { setDoc({ ...doc, items: mapItem(doc.items, id, (x) => ({ ...x, behaviour: "link" as Behaviour, megaId: null })) }); setAnnounce(`Mega panel detached from ${it.label}.`); }
    if (act === "remove") {
      if (it.children.length || it.megaId) setModal({ kind: "remove-item", itemId: id });
      else removeSel(id);
    }
  };

  const q = pageQ.trim().toLowerCase();
  const visiblePages = pages.filter((p) => !p.trash && (p.title + p.path).toLowerCase().includes(q));
  const standardPages = visiblePages.filter((p) => p.type !== "landing");
  const landingPages = visiblePages.filter((p) => p.type === "landing");
  const allStandard = pages.filter((p) => !p.trash && p.type !== "landing").length;
  const allLanding = pages.filter((p) => !p.trash && p.type === "landing").length;

  /* ---------- guards: error, loading, empty ---------- */
  if (status === "error") {
    return (
      <div className="m8-wrap"><Head siteName={siteName} />
        <div className="m8-state"><EmptyState icon="alert" title="Menus did not load" desc={loadErr} action={<Btn onClick={() => void reload()}>Try again</Btn>} /></div>
      </div>
    );
  }
  if (status === "loading" || !data) {
    return (
      <div className="m8-wrap" aria-busy="true"><Head siteName={siteName} />
        <div className="m8-kpis">{[0, 1, 2, 3, 4].map((i) => <Skel key={i} className="m8-skel" />)}</div>
        <div className="m8-builder"><Skel className="m8-skel-tall" /><Skel className="m8-skel-tall" /><Skel className="m8-skel-tall" /></div>
      </div>
    );
  }
  const newMenuModal = modal?.kind === "create-menu" ? (
    <CreateMenuModal name={newName} desc={newDesc} type={newType} setName={setNewName} setDesc={setNewDesc} setType={setNewType} onClose={() => setModal(null)} onCreate={async () => {
      try {
        const x = await MenusAPI.createMenu(siteId, newName.trim() || "Untitled menu", newDesc.trim(), newType);
        setNewName(""); setNewDesc(""); setNewType("main"); setModal(null);
        setMenuId(x.id); setItemId(null); setTab("builder"); setTick((t) => t + 1);
        app.toast({ type: "success", title: `${x.draft.name} created`, sub: "Add links, then publish." });
      } catch (e) { toastErr(e, "Could not create menu"); }
    }} />
  ) : null;
  if (menus.length === 0 && megas.length === 0) {
    return (
      <div className="m8-wrap"><Head siteName={siteName} />
        <div className="m8-state"><EmptyState icon="menu" title="No menus yet" desc="Create your first menu to organize your website links." action={<Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-menu" })}>+ Create Menu</Btn>} /></div>
        {newMenuModal}
      </div>
    );
  }

  const m = menu;
  const d = doc;
  const menuStatus = m ? statusOf(m) : "draft";
  const hasPast = !!menu && (hist[menu.id]?.past.length ?? 0) > 0;
  const hasFuture = !!menu && (hist[menu.id]?.future.length ?? 0) > 0;
  const liveNames = (id: string) => data.menus.find((x) => x.id === id)?.draft.name ?? "menu";
  const parentIds = (items: MenuItem[]): string[] => items.flatMap((it) => (it.children.length ? [it.id, ...parentIds(it.children)] : []));
  const versionsDesc = [...data.versions].sort((a, b) => b.v - a.v);
  const liveRec = versionsDesc.find((v) => v.v === liveVersion) ?? null;
  const prevVersion = versionsDesc.find((v) => v.v < liveVersion) ?? null;
  const placeLayout = layouts.find((l) => l.id === placeLay) ?? layouts[0];
  const attachedMega = itemSel?.megaId ? megaDocOf(itemSel.megaId) : undefined;
  const attachedCols = attachedMega?.columns.length ?? 0;
  const slotNames = (menuId: string) => placed(menuId).map((p) => LOC_LABEL[p.slot]);
  const deviceLabel = device[0].toUpperCase() + device.slice(1);

  /** sets the column count of the mega panel attached to the selected item; refuses to drop filled columns */
  const setMegaCols = (n: number) => {
    if (!itemSel?.megaId || readOnly) return;
    const gd = megaDocOf(itemSel.megaId);
    if (!gd) return;
    if (n < gd.columns.length) {
      const filled = gd.columns.slice(n).findIndex((c) => c.links.length > 0);
      if (filled >= 0) { app.toast({ type: "error", title: "Move the links out of that column first", sub: `Column ${n + filled + 1} still has links.` }); return; }
      setMegaDoc(itemSel.megaId, { ...gd, columns: gd.columns.slice(0, n) });
      return;
    }
    const extra = Array.from({ length: n - gd.columns.length }, (_, i) => ({ id: `mc_${Math.random().toString(36).slice(2, 9)}`, title: `Column ${gd.columns.length + i + 1}`, links: [] }));
    setMegaDoc(itemSel.megaId, { ...gd, columns: [...gd.columns, ...extra] });
  };

  /* ---------- drag and drop ---------- */
  /* A row drop has a place (before, after, or inside) and, for before and after, a hierarchy depth.
     The pointer's horizontal position chooses the depth, so one drag can land at the parent level,
     the child level, or the grandchild level, as enterprise menu builders do. */
  const INDENT_PX = 36;
  const planIn = (rect: DOMRect, clientX: number, clientY: number, level: number, treeLeft: number): { where: DropWhere; depth: number } => {
    const y = (clientY - rect.top) / Math.max(1, rect.height);
    const maxDepth = Math.min(level + 1, MENU_LIMITS.maxDepth - 1);
    if (y >= 0.25 && y <= 0.75) return { where: "inside", depth: level + 1 <= MENU_LIMITS.maxDepth - 1 ? level + 1 : level };
    const want = Math.floor((clientX - treeLeft) / INDENT_PX);
    return { where: y < 0.25 ? "before" : "after", depth: Math.max(0, Math.min(maxDepth, want)) };
  };
  /* The whole tree is the drop surface: the row under the pointer's height is the target, so a
     pointer far to the left (the parent level) still lands on a row that is nested further in. */
  /** Moves the drop indicator to a new target. Only the affected rows change, and no React state is set. */
  const paintHover = (tree: HTMLElement | null, t: { id: string; plan: { where: DropWhere; depth: number } } | null) => {
    const prev = hoverRef.current;
    if (t && prev.id === t.id && prev.where === t.plan.where && prev.depth === t.plan.depth) return;
    if (prev.id && tree) {
      const old = tree.querySelector<HTMLElement>(`.m8-row[data-row-id="${CSS.escape(prev.id)}"]`);
      if (old) { old.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside"); old.style.removeProperty("--drop-indent"); old.removeAttribute("data-drop-level"); }
    }
    if (t && tree) {
      const row = tree.querySelector<HTMLElement>(`.m8-row[data-row-id="${CSS.escape(t.id)}"]`);
      if (row) {
        row.classList.add(`is-drop-${t.plan.where}`);
        row.style.setProperty("--drop-indent", `${t.plan.depth * INDENT_PX}px`);
        row.dataset.dropLevel = String(t.plan.depth + 1);
      }
      hoverRef.current = { id: t.id, where: t.plan.where, depth: t.plan.depth };
    } else {
      hoverRef.current = { id: null, where: null, depth: -1 };
    }
  };
  const treeTarget = (tree: HTMLElement, clientX: number, clientY: number) => {
    const rows = Array.from(tree.querySelectorAll<HTMLElement>(".m8-row[data-row-id]"));
    if (!rows.length) return null;
    let best = rows[0], bestD = Infinity;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      const d = clientY < b.top ? b.top - clientY : clientY > b.bottom ? clientY - b.bottom : 0;
      if (d < bestD) { best = r; bestD = d; if (d === 0) break; }
    }
    const b = best.getBoundingClientRect();
    const level = Number(best.dataset.rowLevel ?? 0);
    const left = tree.getBoundingClientRect().left;
    return { id: best.dataset.rowId as string, label: best.dataset.rowLabel ?? "item", plan: planIn(b, clientX, clientY, level, left) };
  };
  const dropOnRow = (targetId: string, targetLabel: string, plan: { where: DropWhere; depth: number }) => {
    if (!doc || readOnly) return;
    const fromPage = dragPage;
    const fromRow = dragId;
    setDragId(null); setDragPage(null); paintHover(document.querySelector("ul[role=tree]") as HTMLElement | null, null);
    /* "inside" is the target's child level; dropAtDepth turns that into a child append */
    const level = levelOf(doc.items, targetId);
    const where: "before" | "after" = plan.where === "before" ? "before" : "after";
    const depth = plan.where === "inside" ? level + 1 : plan.depth;
    let res: { items: MenuItem[] } | { error: string };
    let verb: string;
    if (fromPage) {
      const page = pages.find((x) => x.id === fromPage);
      res = dropAtDepth(doc.items, blankLink(page?.title ?? "Page", { kind: "page", pageId: fromPage }), targetId, where, depth);
      verb = `Added ${page?.title ?? "page"}`;
    } else if (fromRow) {
      if (fromRow === targetId) return;
      res = moveAtDepth(doc.items, fromRow, targetId, where, depth);
      verb = `Moved ${findItem(doc.items, fromRow)?.label ?? "item"}`;
    } else return;
    if ("error" in res) { app.toast({ type: "error", title: "Can't drop it here", sub: res.error }); setAnnounce(res.error); return; }
    setDoc({ ...doc, items: res.items });
    if (plan.where === "inside") setCollapsed((c) => { const n = new Set(c); n.delete(targetId); return n; });
    const lvlName = depth === 0 ? "top level" : `level ${depth + 1}`;
    const place = plan.where === "inside" ? `inside ${targetLabel}` : `${plan.where} ${targetLabel}, at the ${lvlName}`;
    setAnnounce(`${verb} ${place}.`);
  };

  /* swap: a submenu item trades places with its main menu item, or a row trades with the row below it */
  const swapRow = (id: string, mode: "parent" | "next") => {
    if (!doc || readOnly) return;
    const res = mode === "parent" ? swapWithParent(doc.items, id) : swapWithNext(doc.items, id);
    setRowMenu(null);
    if ("error" in res) { app.toast({ type: "error", title: "Can't swap these", sub: res.error }); setAnnounce(res.error); return; }
    const label = findItem(doc.items, id)?.label ?? "item";
    setDoc({ ...doc, items: res.items });
    const msg = mode === "parent" ? `${label} moved up to take its main item's place. The main item is now its submenu.` : `${label} swapped with the item below.`;
    setAnnounce(msg);
    app.toast({ type: "success", title: "Swapped", sub: msg });
  };

  /* ---------- tree rows ---------- */
  const renderRows = (items: MenuItem[], depth: number): ReactNode =>
    items.map((it) => {
      const kids = it.children.length > 0;
      const isCollapsed = collapsed.has(it.id);
      const sel = itemId === it.id;
      const badge = it.behaviour === "mega" ? "Mega Menu" : it.behaviour === "dropdown" || kids ? "Dropdown" : it.link?.kind === "url" ? "Link" : it.link?.kind === "anchor" ? "Anchor" : "Page";
      const mine = (checks.byMenu[menu?.id ?? ""] ?? []).filter((i) => i.itemId === it.id);
      const hasErr = mine.some((b) => b.severity === "error");
      const hasWarn = mine.some((b) => b.severity === "warn");
      const open = rowMenu === it.id;
      return (
        <li key={it.id} role="none" className={`m8-node depth-${depth}`}>
          <div
            role="treeitem" aria-level={depth + 1} aria-selected={sel} aria-expanded={kids ? !isCollapsed : undefined}
            data-row-id={it.id} data-row-level={depth} data-row-label={it.label || "item"}
            tabIndex={0} className={`m8-row${sel ? " is-sel" : ""}${it.behaviour === "mega" ? " is-mega" : ""}${dragId === it.id ? " is-drag" : ""}`}
            onClick={() => { setItemId(it.id); setItemTab("settings"); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setItemId(it.id); setItemTab("settings"); return; }
              if (readOnly || !e.altKey) return;
              if (e.key === "ArrowUp" && !e.shiftKey) { e.preventDefault(); move(it.id, -1); }
              if (e.key === "ArrowDown" && !e.shiftKey) { e.preventDefault(); move(it.id, 1); }
              if (e.key === "ArrowRight" && e.shiftKey) { e.preventDefault(); indent(it.id); }
              if (e.key === "ArrowLeft" && e.shiftKey) { e.preventDefault(); outdent(it.id); }
            }}
          >
            <span className="m8-grip" draggable={!readOnly} aria-hidden="true" title="Drag to reorder. Or Alt + arrow keys; Alt + Shift + arrows change level."
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; setDragId(it.id); }} onDragEnd={() => setDragId(null)}>
              <Icon name="grip" size={14} />
            </span>
            <Icon name={it.behaviour === "mega" ? "columns" : it.behaviour === "dropdown" || kids ? "layers" : it.link?.kind === "url" ? "link" : "file"} size={14} />
            <span className="m8-row-label">{it.label || <em>Untitled</em>}</span>
            {hasErr && <span className="m8-flag is-err" title="Has errors"><Icon name="alert" size={11} /></span>}
            {!hasErr && hasWarn && <span className="m8-flag is-warn" title="Has warnings"><Icon name="alert" size={11} /></span>}
            {it.audience !== "everyone" && <span className="m8-aud">{AUD_LABEL[it.audience]}</span>}
            <span className={`m8-type${it.behaviour === "mega" ? " is-mega" : ""}`}>{badge}</span>
            {kids && (
              <button type="button" className="m8-chev" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${it.label}`}
                onClick={(e) => { e.stopPropagation(); setCollapsed((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; }); }}>
                <Icon name={isCollapsed ? "chevRight" : "chevDown"} size={12} />
              </button>
            )}
            <span className="m8-row-acts" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="m8-icon" aria-label={`Move ${it.label} up`} disabled={readOnly} onClick={() => move(it.id, -1)}><Icon name="chevUp" size={12} /></button>
              <button type="button" className="m8-icon" aria-label={`Move ${it.label} down`} disabled={readOnly} onClick={() => move(it.id, 1)}><Icon name="chevDown" size={12} /></button>
              <button type="button" className="m8-icon" aria-label={`More actions for ${it.label}`} aria-haspopup="menu" aria-expanded={open} disabled={readOnly}
                onClick={() => setRowMenu(open ? null : it.id)}><Icon name="more" size={13} /></button>
            </span>
          </div>
          {open && (
            <div className="m8-more" role="menu" aria-label={`Actions for ${it.label}`} onKeyDown={(e) => { if (e.key === "Escape") setRowMenu(null); }}>
              <button role="menuitem" onClick={() => { setItemId(it.id); setItemTab("settings"); setRowMenu(null); }}>Edit Item</button>
              <button role="menuitem" disabled={depthOfId(d!.items, it.id) >= MENU_LIMITS.maxDepth - 1 || it.behaviour === "mega"} onClick={() => rowAction(it.id, "child")}>Add Submenu Item</button>
              <button role="menuitem" disabled={readOnly || depthOfId(d!.items, it.id) === 0} title="Swaps this submenu item with its main menu item" onClick={() => swapRow(it.id, "parent")}>Swap with Main Menu Item</button>
              <button role="menuitem" disabled={readOnly || (() => { const loc = locate(d!.items, it.id); return !loc || loc.index >= loc.list.length - 1; })()} title="Trades places with the item below" onClick={() => swapRow(it.id, "next")}>Swap with Next Item</button>
              <button role="menuitem" onClick={() => { move(it.id, -1); setRowMenu(null); }}>Move Up</button>
              <button role="menuitem" onClick={() => { move(it.id, 1); setRowMenu(null); }}>Move Down</button>
              <button role="menuitem" disabled={depthOfId(d!.items, it.id) === 0} onClick={() => rowAction(it.id, "top")}>Move to Top Level</button>
              <button role="menuitem" onClick={() => rowAction(it.id, "dup")}>Duplicate Item</button>
              {it.behaviour === "mega"
                ? <button role="menuitem" onClick={() => rowAction(it.id, "detach")}>Detach Mega Panel</button>
                : <button role="menuitem" disabled={depthOfId(d!.items, it.id) !== 0} onClick={() => rowAction(it.id, "attach")}>Attach Mega Panel</button>}
              <button role="menuitem" className="is-danger" onClick={() => rowAction(it.id, "remove")}>Remove from Menu</button>
            </div>
          )}
          {kids && !isCollapsed && <ul role="group" className="m8-tree m8-sub">{renderRows(it.children, depth + 1)}</ul>}
        </li>
      );
    });

  /** one placement slot row, used on Manage Menus and in Menu Placements */
  const slotRows = (l: (typeof layouts)[number]) => LOCATIONS.map((slot) => {
    const visible = slot === "header" ? l.header.visible : l.footer.visible;
    const cur = slotsOf(placeDoc, l.id)[slot];
    const liveCur = slotsOf(data.placements.live, l.id)[slot];
    const blocked = slot === "header" && !!cur && !visible;
    return (
      <div key={slot} className="m8-slot-row">
        <span className="m8-slot-ic"><Icon name={slot === "header" ? "monitor" : "layers"} size={14} /></span>
        <label htmlFor={`slot-${l.id}-${slot}`} className="m8-slot-lbl">{LOC_LABEL[slot]}{slot === "header" ? " (Primary)" : ""}</label>
        {!visible ? (
          <span className="m8-muted">This layout has no {slot.toLowerCase()}. Show it in Layouts &amp; Templates first.</span>
        ) : (
          <select id={`slot-${l.id}-${slot}`} aria-label={`${LOC_LABEL[slot]} menu for ${l.name}`} value={cur ?? ""} disabled={readOnly}
            onChange={(e) => {
              const v = e.target.value || null;
              if (!v && slot === "header") { app.toast({ type: "error", title: "The header needs a menu", sub: "Choose another menu to replace it, or set this layout's header to None in Layouts." }); return; }
              chooseSlot(l.id, slot, v);
            }}>
            {slot === "footer" && <option value="">None</option>}
            {menus.map((x) => <option key={x.id} value={x.id}>{x.draft.name}</option>)}
            {slot === "header" && !cur && <option value="" disabled>Choose a menu</option>}
          </select>
        )}
        {visible && (cur !== liveCur ? <Pill tone="amber" dot>Draft</Pill> : cur ? <Pill tone="green" dot>Active</Pill> : <Pill tone="grey">Not assigned</Pill>)}
        {blocked && <small className="m8-muted">Unassigning the header is blocked unless the layout supports no navigation.</small>}
      </div>
    );
  });

  const placementFooter = (
    <div className="m8-slot-row is-fixed">
      <span className="m8-slot-ic"><Icon name="monitor" size={14} /></span>
      <span className="m8-slot-lbl">Top Bar / Utility</span>
      <span className="m8-muted">No utility slot in layouts yet. Utility menus stay in the menu list.</span>
    </div>
  );
  const mobileRow = (
    <div className="m8-slot-row is-fixed">
      <span className="m8-slot-ic"><Icon name="phone" size={14} /></span>
      <span className="m8-slot-lbl">Mobile (Auto)</span>
      <span className="m8-muted">Auto (Responsive)</span>
      <Icon name="info" size={13} />
    </div>
  );

  const saveButton = (
    <Btn variant="primary" icon="check" disabled={!anyDirty || busy || readOnly} loading={busy} onClick={() => void saveAll()}>Save Draft</Btn>
  );
  const publishButton = (
    <Btn variant="primary" icon="rocket" disabled={readOnly || busy || checks.errors > 0 || draftCount === 0}
      title={checks.errors ? "Fix the errors first" : draftCount === 0 ? "Nothing to publish" : undefined}
      onClick={() => setModal({ kind: "changes" })}>
      Publish Changes{draftCount ? ` (${draftCount})` : ""}
    </Btn>
  );

  return (
    <div className={`m8-wrap${readOnly ? " is-readonly" : ""}`}>
      <div className="m8-sr" role="status" aria-live="polite">{announce}</div>

      <header className="m8-head">
        <div className="m8-head-l">
          <h1 className="m8-title">Menus &amp; Navigation</h1>
          <p className="m8-desc">Create and manage website menus, build dropdowns and mega menus, assign them to header or footer, and publish changes.</p>
        </div>
        <div className="m8-head-r">
          <span className="m8-website-lbl">Website</span>
          <span className="m8-website"><Icon name="globe" size={13} /> {siteName}</span>
          {anyDirty ? <Pill tone="amber" dot>Unsaved</Pill> : <Pill tone="green" dot>Saved</Pill>}
          <Btn icon="link" onClick={() => setModal({ kind: "validate" })}>Validate Links{checks.errors ? ` (${checks.errors})` : ""}</Btn>
          <Btn icon="eye" disabled={!m} onClick={() => setPreviewing(true)}>Preview</Btn>
          {saveButton}
          {publishButton}
        </div>
      </header>

      {app.demo === "denied" && <div className="m8-banner is-info" role="status"><Icon name="lock" size={13} /><span>Read-only. Your role can view menus but not change them. Ask an Admin or Editor to make changes.</span></div>}
      {app.demo !== "denied" && app.role === "Viewer" && <div className="m8-banner is-info" role="status"><Icon name="lock" size={13} /><span>Viewer: you can read every menu. Editing needs an Editor or Owner role.</span></div>}
      {conflict && (
        <div className="m8-banner is-warn" role="alert">
          <Icon name="alert" size={13} /><span><b>Someone else changed these menus.</b> {conflict} Your drafts are still here.</span>
          <div className="m8-banner-acts">
            <Btn variant="sm" onClick={() => { resetDrafts(); setConflict(null); setTick((t) => t + 1); }}>Reload theirs</Btn>
            <Btn variant="sm" onClick={() => setConflict(null)}>Keep editing</Btn>
          </div>
        </div>
      )}

      <div className="m8-kpis">
        <Kpi icon="menu" n={menus.length} label="Menus" tone="violet" />
        <Kpi icon="check" n={placedCount} label="Assigned" tone="green" />
        <Kpi icon="pencil" n={draftCount} label="Draft (Unpublished)" tone="amber" />
        <Kpi icon="link" n={checks.errors} label="Link Issues" tone={checks.errors ? "red" : "grey"} onClick={() => setModal({ kind: "validate" })} />
        <Kpi icon="clock" n={data.versions.length} label="Version History" tone="blue" onClick={() => setTab("history")} />
      </div>

      <nav className="m8-tabs" role="tablist" aria-label="Menus sections">
        {renderTabs(tab, setTab)}
      </nav>

      {/* ============ MENU BUILDER ============ */}
      {tab === "builder" && (
        <>
          <div className="m8-menubar">
            <span className="m8-lbl">Menu</span>
            <div className="m8-picker" onKeyDown={(e) => { if (e.key === "Escape" && menuOpen) { setMenuOpen(false); } }}>
              <button type="button" className="m8-select m8-picker-btn" aria-haspopup="listbox" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                <Icon name="menu" size={14} /> <b>{m?.draft.name ?? "Choose a menu"}</b>
                {m && <Pill tone={menuStatus === "published" ? "green" : "amber"} dot>{menuStatus === "published" ? "Published (Live)" : "Draft"}</Pill>}
                <Icon name="chevDown" size={12} />
              </button>
              {menuOpen && (
                <div className="m8-picker-pop" role="listbox" aria-label="Menus">
                  <input aria-label="Search menus" placeholder="Search menus..." value={menuQ} onChange={(e) => setMenuQ(e.target.value)} />
                  {menus.filter((x) => x.draft.name.toLowerCase().includes(menuQ.toLowerCase())).map((x) => (
                    <button key={x.id} role="option" aria-selected={x.id === menuId} onClick={() => selectMenu(x.id)}>
                      <span className="m8-pick-check">{x.id === menuId && <Icon name="check" size={12} />}</span>
                      <Icon name="menu" size={13} />
                      <span className="m8-pick-name">{x.draft.name}</span>
                      {placed(x.id).map((p) => <span key={`${p.layoutId}-${p.slot}`} className="m8-loc-tag">{LOC_LABEL[p.slot]}</span>)}
                      {statusOf(x) === "draft" && <span className="m8-draft-tag">Draft</span>}
                    </button>
                  ))}
                  <button className="m8-picker-new" onClick={() => { setMenuOpen(false); setModal({ kind: "create-menu" }); }}><Icon name="plus" size={12} /> Create Menu</button>
                </div>
              )}
            </div>
            {m && (
              <Pill tone={slotNames(m.id).length ? "violet" : "grey"} className="m8-assigned">
                {slotNames(m.id).length ? `Assigned: ${slotNames(m.id).join(", ")}` : "Not assigned to a slot"}
              </Pill>
            )}
            <span className="m8-spacer" />
            <Btn icon="eye" disabled={!m} onClick={() => setPreviewing(true)}>Preview Menu</Btn>
            <Btn variant="primary" icon="plus" disabled={readOnly || menus.length >= 12} title={menus.length >= 12 ? "A website can have 12 menus at most." : undefined} onClick={() => setModal({ kind: "create-menu" })}>Create Menu</Btn>
          </div>

          {!m || !d ? <EmptyState icon="menu" title="Choose a menu" desc="Pick a menu above, or create one." /> : (
            <>
              <div className="m8-builder">
                {/* ---- LEFT: add items, or menu settings ---- */}
                <section className="m8-col m8-add" aria-label="Add items">
                  <div className="m8-seg-tabs" role="tablist" aria-label="Left panel">
                    <button role="tab" aria-selected={leftTab === "add"} className={leftTab === "add" ? "is-on" : ""} onClick={() => setLeftTab("add")}>Add Items</button>
                    <button role="tab" aria-selected={leftTab === "settings"} className={leftTab === "settings" ? "is-on" : ""} onClick={() => setLeftTab("settings")}>Menu Settings</button>
                  </div>

                  {leftTab === "add" && (
                    <>
                      <div className="m8-seg m8-seg-wide" role="radiogroup" aria-label="Add source">
                        <button role="radio" aria-checked={addMode === "pages"} onClick={() => setAddMode("pages")}><Icon name="file" size={13} /> Pages</button>
                        <button role="radio" aria-checked={addMode === "custom"} onClick={() => setAddMode("custom")}><Icon name="link" size={13} /> Custom Link</button>
                      </div>
                      {addMode === "pages" ? (
                        <>
                          <Accordion title={`Pages (${standardPages.length}/${allStandard})`} defaultOpen>
                            <input aria-label="Search pages" className="m8-search" placeholder="Search pages..." value={pageQ} onChange={(e) => setPageQ(e.target.value)} />
                            <ul className="m8-pick m8-check">
                              {standardPages.map((p) => (
                                <li key={p.id} className="m8-pagedrag" draggable={!readOnly} onDragStart={(e) => { e.dataTransfer.setData("text/plain", `page:${p.id}`); e.dataTransfer.effectAllowed = "copy"; setDragPage(p.id); }} onDragEnd={() => { setDragPage(null); }}><label><input type="checkbox" aria-label={`Select ${p.title}`} checked={picked.includes(p.id)} disabled={readOnly}
                                  onChange={(e) => setPicked((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} />
                                  <span>{p.title}{p.status !== "published" && <em className="m8-draft-tag">Draft</em>}</span><small>{p.path}</small></label></li>
                              ))}
                              {standardPages.length === 0 && <li className="m8-muted">No pages match.</li>}
                            </ul>
                          </Accordion>
                          <Accordion title={`Landing pages (${landingPages.length}/${allLanding})`}>
                            <ul className="m8-pick m8-check">
                              {landingPages.map((p) => (
                                <li key={p.id} className="m8-pagedrag" draggable={!readOnly} onDragStart={(e) => { e.dataTransfer.setData("text/plain", `page:${p.id}`); e.dataTransfer.effectAllowed = "copy"; setDragPage(p.id); }} onDragEnd={() => { setDragPage(null); }}><label><input type="checkbox" aria-label={`Select ${p.title}`} checked={picked.includes(p.id)} disabled={readOnly}
                                  onChange={(e) => setPicked((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} />
                                  <span>{p.title}{p.status !== "published" && <em className="m8-draft-tag">Draft</em>}</span><small>{p.path}</small></label></li>
                              ))}
                              {landingPages.length === 0 && <li className="m8-muted">No landing pages match.</li>}
                            </ul>
                          </Accordion>
                          <Btn variant="primary" icon="plus" disabled={readOnly || picked.length === 0} onClick={() => addPicked()}>
                            Add to Menu{picked.length ? ` (${picked.length})` : ""}
                          </Btn>
                        </>
                      ) : (
                        <div className="m8-custom">
                          <Field label="Label"><input aria-label="Custom link label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g., Book a call" /></Field>
                          <Field label="Custom link address" error={customErr && !urlOk(customUrl) ? customErr : undefined}><input aria-label="Custom link address" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} /></Field>
                          <div className="m8-inline"><Switch checked={customNewTab} onChange={setCustomNewTab} label="Open in a new tab" /><span>Open in a new tab</span></div>
                          {customErr && !customLabel.trim() && <p className="m8-err-text">{customErr}</p>}
                          <Btn variant="primary" icon="plus" disabled={readOnly} onClick={addCustom}>Add to Menu</Btn>
                        </div>
                      )}
                    </>
                  )}

                  {leftTab === "settings" && (
                    <div className="m8-cfg-body">
                      <Field label="Menu name">
                        <input aria-label="Menu name" value={d.name} disabled={readOnly} onChange={(e) => patchDoc((x) => ({ ...x, name: e.target.value }))} />
                      </Field>
                      <Field label="Mobile menu">
                        <select aria-label="Mobile style" value={d.mobile.behaviour} disabled={readOnly} onChange={(e) => patchDoc((x) => ({ ...x, mobile: { ...x.mobile, behaviour: e.target.value as "drawer" | "accordion" } }))}>
                          <option value="drawer">Drawer with accordion</option>
                          <option value="accordion">Accordion only</option>
                        </select>
                      </Field>
                      <div className="m8-inline"><Switch checked={d.mobile.openFirstLevel} onChange={(v) => !readOnly && patchDoc((x) => ({ ...x, mobile: { ...x.mobile, openFirstLevel: v } }))} label="Open first group" /><span>Open the first group on mobile</span></div>
                      <p className="m8-muted">Parent items with children are not links on mobile. They open to show their children. Footer menus are not used as mobile header content.</p>
                      <fieldset className="m8-appearance" disabled={readOnly}>
                        <legend className="m8-lbl">Appearance</legend>
                        <div className="m8-presets" role="radiogroup" aria-label="Menu style preset">
                          {PRESETS.map((pr) => (
                            <button key={pr.id} type="button" role="radio" aria-checked={styleOf(d).preset === pr.id}
                              className={`m8-preset-card m8-preset-${pr.id}${styleOf(d).preset === pr.id ? " is-on" : ""}`}
                              onClick={() => patchDoc((x) => ({ ...x, style: { ...styleOf(x), preset: pr.id as Preset } }))}>
                              <span className="m8-preset-demo" aria-hidden="true"><i>Home</i><i>Programs</i></span>
                              <b>{pr.label}</b><small>{pr.hint}</small>
                            </button>
                          ))}
                        </div>
                        <div className="m8-appearance-row">
                          <Field label="Dropdown animation">
                            <select aria-label="Dropdown animation" value={styleOf(d).dropAnim} onChange={(e) => patchDoc((x) => ({ ...x, style: { ...styleOf(x), dropAnim: e.target.value as DropAnim } }))}>
                              {DROP_ANIMS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Hover effect">
                            <select aria-label="Hover effect" value={styleOf(d).hoverFx} onChange={(e) => patchDoc((x) => ({ ...x, style: { ...styleOf(x), hoverFx: e.target.value as HoverFx } }))}>
                              {HOVER_FX.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                            </select>
                          </Field>
                        </div>
                        <p className="m8-muted">Style applies to this menu in the header and footer. Preview and publish use the same style.</p>
                      </fieldset>
                      <div className="m8-acts">
                        <Btn icon="copy" disabled={readOnly || menus.length >= 12} onClick={async () => { try { const c = await MenusAPI.duplicateMenu(m.id); setTick((t) => t + 1); selectMenu(c.id, true); app.toast({ type: "success", title: `${c.draft.name} created` }); } catch (e) { toastErr(e, "Could not duplicate"); } }}>Duplicate Menu</Btn>
                        <Btn icon="link" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
                        <Btn icon="target" onClick={() => setTab("placements")}>Manage Placements</Btn>
                      </div>
                      <h4 className="m8-h4">Limits</h4>
                      <ul className="m8-limits">
                        <li>3 levels deep at most</li>
                        <li>{MENU_LIMITS.maxTop} top-level items per menu</li>
                        <li>Mega panels: up to {MENU_LIMITS.maxColumns} columns</li>
                        <li>{MENU_LIMITS.maxItems} items per menu</li>
                      </ul>
                      <h4 className="m8-h4 is-danger">Danger zone</h4>
                      <p className="m8-muted">A menu that is placed in a layout slot or compiled into one can't be deleted. Move it out first.</p>
                      <Btn variant="danger" icon="trash" disabled={readOnly || placed(m.id).length > 0 || m.applied.length > 0}
                        title={placed(m.id).length || m.applied.length ? "Move this menu out of its slots first." : undefined}
                        onClick={() => setModal({ kind: "delete-menu" })}>Delete {m.draft.name}</Btn>
                    </div>
                  )}
                </section>

                {/* ---- CENTRE: structure ---- */}
                <section className="m8-col m8-tree-col" aria-label="Menu structure">
                  <div className="m8-col-head">
                    <div className="m8-col-title">
                      <h3 className="m8-h3">Menu Structure</h3>
                      <p className="m8-muted">{countItems(d.items)} items · drag and drop to organise. Create dropdowns or a mega menu.</p>
                    </div>
                    <span className="m8-spacer" />
                    {collapsed.size > 0 || parentIds(d.items).length === 0
                      ? <Btn variant="sm" disabled={parentIds(d.items).length === 0} onClick={() => setCollapsed(new Set())}>Expand All</Btn>
                      : <Btn variant="sm" onClick={() => setCollapsed(new Set(parentIds(d.items)))}>Collapse All</Btn>}
                    <Btn variant="sm" icon="undo" aria-label="Undo" disabled={readOnly || !hasPast} onClick={() => stepHistory("undo")}>Undo</Btn>
                    <Btn variant="sm" icon="redo" aria-label="Redo" disabled={readOnly || !hasFuture} onClick={() => stepHistory("redo")}>Redo</Btn>
                  </div>
                  <div className="m8-depth-warn" role="note"><Icon name="alert" size={13} /><span>Maximum depth: {MENU_LIMITS.maxDepth} levels (e.g., Main › Submenu › Sub-item)</span></div>
                  <div className="m8-hint-line">Drag the grip to reorder. Alt + ↑/↓ moves an item, Alt + Shift + →/← changes its level.</div>
                  {d.items.length === 0 ? (
                    <EmptyState icon="menu" title="This menu is empty" desc="Add pages or a custom link from the left." />
                  ) : (
                    <ul role="tree" aria-label="Menu items" className="m8-tree"
                      onDragOver={(e) => {
                        if (!(dragId || dragPage) || readOnly) return;
                        e.preventDefault(); e.dataTransfer.dropEffect = dragPage ? "copy" : "move";
                        const tree = e.currentTarget;
                        paintHover(tree, treeTarget(tree, e.clientX, e.clientY));
                      }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) paintHover(e.currentTarget, null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const t = treeTarget(e.currentTarget, e.clientX, e.clientY);
                        paintHover(e.currentTarget, null);
                        if (t) dropOnRow(t.id, t.label, t.plan); else { setDragId(null); setDragPage(null); }
                      }}
                      onDragEnd={(e) => { paintHover(e.currentTarget, null); setDragId(null); setDragPage(null); }}>
                      {renderRows(d.items, 0)}
                    </ul>
                  )}
                  <div className="m8-tree-acts">
                    <Btn icon="plus" disabled={readOnly || d.items.length >= MENU_LIMITS.maxTop} onClick={() => { const it = blankLink("New link", null); setDoc({ ...d, items: [...d.items, it] }); setItemId(it.id); }}>Add Top-Level Item</Btn>
                    {d.items.length >= MENU_LIMITS.maxTop && <span className="m8-muted">Limit: {MENU_LIMITS.maxTop} top-level items</span>}
                  </div>
                  {m && (
                    <div className="m8-compiled m8-apply m8-target">
                      <h4 className="m8-h4">Header and footer</h4>
                      <ChromeList menu={m} regions={regions} layouts={layouts} placed={placed(m.id)} />
                      <p className="m8-hint">Target: {placed(m.id).length
                        ? placed(m.id).map((p) => { const ref = layouts.find((l) => l.id === p.layoutId)?.[p.slot]; const v = regions.find((r) => r.id === ref?.regionId)?.variants.find((x) => x.id === ref?.variantId); return v ? `${v.name} (${LOC_LABEL[p.slot]})` : LOC_LABEL[p.slot]; }).join(" · ")
                        : "not placed in any layout yet"}</p>
                      <p className="m8-hint">Live now: {m.live ? (m.live.items.filter((i) => i.audience === "everyone").map((i) => i.label).join(" · ") || "nothing") : "not published yet"}</p>
                      <div className="m8-acts">
                        <Btn variant="sm" icon="layers" disabled={readOnly || busy || placed(m.id).length === 0 || !m.live || hasChanges(m)}
                          title={!m.live ? "Publish this menu first" : hasChanges(m) ? "Publish the draft first. Apply uses the live version." : placed(m.id).length === 0 ? "Place this menu in a layout first" : undefined}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              for (const p of placed(m.id)) {
                                const ref = layouts.find((l) => l.id === p.layoutId)?.[p.slot];
                                if (!ref) continue;
                                await MenusAPI.apply(m.id, ref.regionId, ref.variantId, regions, { layoutId: p.layoutId, slot: p.slot });
                              }
                              setTick((t) => t + 1);
                              app.toast({ type: "success", title: "Applied to the live header and footer", sub: "Layouts now show this menu." });
                            } catch (e) { toastErr(e, "Could not apply"); }
                            finally { setBusy(false); }
                          }}>Apply now</Btn>
                        <Btn variant="ghost" icon="arrowRight" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
                      </div>
                    </div>
                  )}
                </section>

                {/* ---- RIGHT: item settings ---- */}
                <section className="m8-col m8-cfg" aria-label="Item settings">
                  {itemSel ? (
                    <>
                      <div className="m8-col-head">
                        <h3 className="m8-h3">Menu Item Settings</h3>
                        <span className="m8-spacer" />
                        {itemSel.behaviour === "mega" && <Pill tone="violet">Mega Menu</Pill>}
                      </div>
                      <div className="m8-itabs" role="tablist" aria-label="Item settings sections">
                        <button role="tab" aria-selected={itemTab === "settings"} onClick={() => setItemTab("settings")}>Settings</button>
                        {itemSel.behaviour === "mega" && <button role="tab" aria-selected={itemTab === "mega"} onClick={() => setItemTab("mega")}>Mega Menu</button>}
                        <button role="tab" aria-selected={itemTab === "advanced"} onClick={() => setItemTab("advanced")}>Advanced</button>
                      </div>
                      {itemTab === "settings" && (
                        <div className="m8-cfg-body">
                          <Field label="Label"><input aria-label="Label" value={itemSel.label} disabled={readOnly} onChange={(e) => setItemField((x) => ({ ...x, label: e.target.value }))} /></Field>
                          <Field label="Link To" hint={itemSel.behaviour === "mega" ? "A mega menu's top item opens its panel, so the link is optional." : undefined}>
                            <LinkEditor link={itemSel.link} pages={pages} idp="item" disabled={readOnly} onChange={(lk) => setItemField((x) => ({ ...x, link: lk }))} compact />
                          </Field>
                          <Field label="Behaviour">
                            <select aria-label="Item behaviour" value={itemSel.behaviour} disabled={readOnly || itemDepth > 0 && itemSel.behaviour === "mega"}
                              onChange={(e) => setItemField((x) => ({ ...x, behaviour: e.target.value as Behaviour }))}>
                              <option value="link">Link</option>
                              <option value="dropdown" disabled={itemDepth >= MENU_LIMITS.maxDepth - 1}>Dropdown (with sub-menu)</option>
                              {itemDepth === 0 && <option value="mega">Mega menu</option>}
                            </select>
                          </Field>
                          <Field label="Visibility">
                            <select aria-label="Item visibility" value={itemSel.audience} disabled={readOnly} onChange={(e) => setItemField((x) => ({ ...x, audience: e.target.value as Audience }))}>
                              {(Object.keys(AUD_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUD_LABEL[a]}</option>)}
                            </select>
                          </Field>
                          <div className="m8-inline"><Switch checked={itemSel.newTab} onChange={(v) => !readOnly && setItemField((x) => ({ ...x, newTab: v }))} label="Open in a new tab" /><span>Open in a new tab</span></div>
                          <div className="m8-cfg-acts">
                            <Btn icon="plus" disabled={readOnly || itemDepth >= MENU_LIMITS.maxDepth - 1 || itemSel.behaviour === "mega"} onClick={() => addUnder(itemSel.id)}>Add Submenu Item</Btn>
                            <Btn variant="danger" icon="trash" disabled={readOnly} onClick={() => rowAction(itemSel.id, "remove")}>Remove Item</Btn>
                          </div>
                        </div>
                      )}
                      {itemTab === "mega" && itemSel.behaviour === "mega" && (
                        <div className="m8-cfg-body">
                          <h4 className="m8-h4">Mega Menu Layout</h4>
                          <div className="m8-layout-cards" role="radiogroup" aria-label="Columns">
                            {[2, 3, 4].map((n) => (
                              <button key={n} type="button" role="radio" aria-checked={attachedCols === n} className={attachedCols === n ? "is-on" : ""}
                                disabled={readOnly || !itemSel.megaId} onClick={() => setMegaCols(n)}>
                                <span className="m8-lc-ic">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
                                <b>{n} Columns</b>
                                {attachedCols === n && <span className="m8-lc-check"><Icon name="check" size={11} /></span>}
                              </button>
                            ))}
                          </div>
                          <Field label="Mega panel">
                            <select aria-label="Attached mega panel" value={itemSel.megaId ?? ""} disabled={readOnly}
                              onChange={(e) => setItemField((x) => ({ ...x, megaId: e.target.value || null }))}>
                              <option value="">None (create or pick a panel)</option>
                              {megas.map((g) => <option key={g.id} value={g.id}>{megaDocOf(g.id)?.name}</option>)}
                            </select>
                          </Field>
                          {attachedMega ? (
                            <>
                              <h4 className="m8-h4">Column Content</h4>
                              <ul className="m8-colcontent">
                                {attachedMega.columns.map((c, i) => (
                                  <li key={c.id}>
                                    <Icon name="grip" size={12} />
                                    <span className="m8-col-name">Column {i + 1}: <b>{c.title || "Untitled"}</b></span>
                                    <span className="m8-muted">({c.links.length} items)</span>
                                    <button type="button" className="m8-icon" aria-label={`Edit column ${i + 1}`} disabled={readOnly} onClick={() => { setMegaId(itemSel.megaId); setTab("mega"); }}><Icon name="pencil" size={12} /></button>
                                  </li>
                                ))}
                              </ul>
                              <div className="m8-acts">
                                <Btn variant="sm" icon="plus" disabled={readOnly || attachedCols >= 4} onClick={() => setMegaCols(Math.min(4, attachedCols + 1))}>Add Column</Btn>
                                <Btn variant="sm" icon="columns" onClick={() => { setMegaId(itemSel.megaId); setTab("mega"); }}>Edit panel in Mega Menus</Btn>
                              </div>
                            </>
                          ) : (
                            <p className="m8-muted">Attach a panel above, or create one in Mega Menus. Mega panels need 2 to 4 columns.</p>
                          )}
                        </div>
                      )}
                      {itemTab === "advanced" && (
                        <div className="m8-cfg-body">
                          <p className="m8-muted">Item ID <code>{itemSel.id}</code></p>
                          <p className="m8-muted">Level {itemDepth + 1} of {MENU_LIMITS.maxDepth}. Children: {itemSel.children.length}.</p>
                          {(checks.byMenu[menu?.id ?? ""] ?? []).filter((i) => i.itemId === itemSel.id).map((i) => (
                            <p key={i.id} className={i.severity === "error" ? "m8-err-text" : "m8-warn-text"}><Icon name="alert" size={12} /> {i.detail}</p>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="m8-cfg-empty">
                      <EmptyState icon="pencil" title="Select an item" desc="Choose a row to change its label, link, behaviour and visibility." />
                    </div>
                  )}
                </section>
              </div>

              {/* ---- PREVIEW (below) ---- */}
              <section id="m8-preview" className="m8-preview" aria-label="Menu preview">
                <div className="m8-preview-bar">
                  <span className="m8-preview-title"><Icon name={device === "desktop" ? "monitor" : device === "tablet" ? "tablet" : "phone"} size={14} /> Navigation Preview ({deviceLabel})</span>
                  <span className="m8-spacer" />
                  <div className="m8-seg" role="radiogroup" aria-label="Preview device">
                    {([["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]] as [Device, string][]).map(([dv, lbl]) => (
                      <button key={dv} role="radio" aria-checked={device === dv} onClick={() => setDevice(dv)}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <NavPreview items={d.items} megaOf={(id) => (id ? megaDocOf(id) : undefined)} pages={pages as never} tokens={themeFor(siteId).live.tokens}
                  device={device} brand={siteName} menuStyle={styleOf(d)} mobileBehaviour={device === "mobile" || device === "tablet" ? "accordion" : "drawer"} openFirstLevel={d.mobile.openFirstLevel}
                  openId={openPanel} onOpen={setOpenPanel} label={`${d.name} preview`} />
              </section>
            </>
          )}
        </>
      )}

      {/* ============ MANAGE MENUS (with placements) ============ */}
      {tab === "manage" && (() => {
        const rows = menus.filter((x) => {
          if (!x.draft.name.toLowerCase().includes(manageQ.toLowerCase())) return false;
          const pl = placed(x.id).length > 0;
          if (manageFilter === "published") return statusOf(x) === "published";
          if (manageFilter === "draft") return statusOf(x) === "draft";
          if (manageFilter === "assigned") return pl;
          if (manageFilter === "unassigned") return !pl;
          return true;
        });
        return (
          <div className="m8-two m8-manage">
            <div className="m8-panel">
              <div className="m8-panel-head">
                <h3 className="m8-h3">Menus ({menus.length})</h3>
                <span className="m8-spacer" />
                <Btn variant="primary" icon="plus" disabled={readOnly || menus.length >= 12} title={menus.length >= 12 ? "A website can have 12 menus at most." : undefined} onClick={() => setModal({ kind: "create-menu" })}>Create Menu</Btn>
              </div>
              <div className="m8-toolbar">
                <input aria-label="Search menus" className="m8-search" placeholder="Search menus..." value={manageQ} onChange={(e) => setManageQ(e.target.value)} />
                <select aria-label="Filter menus" value={manageFilter} onChange={(e) => setManageFilter(e.target.value as typeof manageFilter)}>
                  <option value="all">All menus</option><option value="published">Published</option><option value="draft">Draft</option>
                  <option value="assigned">Assigned to a slot</option><option value="unassigned">Not assigned</option>
                </select>
              </div>
              <div className="m8-table-wrap"><table className="m8-table">
                <thead><tr><th>Menu Name</th><th>Type</th><th>Items</th><th>Used In</th><th>Status</th><th>Updated</th><th><span className="m8-sr">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map((x) => {
                    const pl = placed(x.id);
                    const st = statusOf(x);
                    return (
                      <tr key={x.id}>
                        <td><button className="m8-link-btn" onClick={() => selectMenu(x.id)}>{x.draft.name}</button><small className="m8-muted">{x.draft.description}</small></td>
                        <td>{MENU_TYPE_LABEL[x.draft.type ?? "main"]}</td>
                        <td>{countItems(x.draft.items)}</td>
                        <td>{pl.length ? pl.map((p) => <Pill key={`${p.layoutId}-${p.slot}`} tone="violet">{placeLabel(layouts, p)}</Pill>) : <span className="m8-muted">Not assigned</span>}</td>
                        <td><Pill tone={st === "published" ? "green" : "amber"} dot>{st === "published" ? "Published" : "Draft"}</Pill></td>
                        <td>{ago(x.updatedAt)} · {x.updatedBy}</td>
                        <td className="m8-row-end">
                          <Btn variant="sm" onClick={() => selectMenu(x.id)}>Edit</Btn>
                          <Btn variant="sm" icon="copy" disabled={readOnly || menus.length >= 12} onClick={async () => { try { const c = await MenusAPI.duplicateMenu(x.id); setTick((t) => t + 1); selectMenu(c.id, true); app.toast({ type: "success", title: `${c.draft.name} created` }); } catch (e) { toastErr(e, "Could not duplicate"); } }}>Duplicate</Btn>
                          <Btn variant="sm" disabled={readOnly || pl.length > 0 || x.applied.length > 0} title={pl.length || x.applied.length ? "Move this menu out of its slots first." : undefined}
                            onClick={() => { setMenuId(x.id); setModal({ kind: "delete-menu" }); }}>Delete</Btn>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={7} className="m8-muted">No menus match this filter.</td></tr>}
                </tbody>
              </table></div>
              <p className="m8-muted">{menus.length} of 12 menus used. A menu can be placed in more than one layout.</p>
            </div>

            <div className="m8-panel">
              <div className="m8-panel-head">
                <h3 className="m8-h3">Menu Placements</h3>
                <span className="m8-spacer" />
                {layouts.length > 1 && (
                  <select aria-label="Layout for placements" value={placeLayout?.id ?? ""} onChange={(e) => setPlaceLay(e.target.value)}>
                    {layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
              <p className="m8-muted">Assign which menu appears in each website location.</p>
              {placeLayout && <div className="m8-slots">{slotRows(placeLayout)}{placementFooter}{mobileRow}</div>}
              <div className="m8-banner is-info" role="note"><Icon name="info" size={13} /><span>Mobile navigation is automatically generated from the header menu. Footer menus are not used on mobile.</span></div>
              <div className="m8-acts">
                <Btn variant="primary" icon="check" disabled={!placeDirty || busy || readOnly} loading={busy} onClick={() => void savePlacementDraft()}>Save Placement Draft</Btn>
                <Btn disabled={!placeDirty} onClick={() => setPDraft(null)}>Discard placement changes</Btn>
                <Btn icon="link" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============ MENU PLACEMENTS (all layouts) ============ */}
      {tab === "placements" && (
        <div className="m8-panel">
          <div className="m8-panel-head">
            <div>
              <h3 className="m8-h3">Menu Placements</h3>
              <p className="m8-muted">Placements belong to layouts. Each layout has a header and footer slot, and each slot holds one menu. Edits save as a placement draft and go live when you publish.</p>
            </div>
          </div>
          {layouts.map((l) => (
            <div key={l.id} className="m8-slotcard">
              <div className="m8-slotcard-h">
                <b>{l.name}</b>
                <span className="m8-muted">{l.isDefault ? "Default layout" : l.scope === "builtin" ? "Built-in layout" : "Workspace layout"}</span>
                <span className="m8-spacer" />
                <Btn variant="sm" icon="link" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
              </div>
              <div className="m8-slots">{slotRows(l)}</div>
            </div>
          ))}
          <div className="m8-slotcard m8-slotcard-fixed">{placementFooter}{mobileRow}</div>
          <div className="m8-acts">
            <Btn variant="primary" icon="check" disabled={!placeDirty || busy || readOnly} loading={busy} onClick={() => void savePlacementDraft()}>Save Placement Draft</Btn>
            <Btn disabled={!placeDirty} onClick={() => setPDraft(null)}>Discard placement changes</Btn>
          </div>
        </div>
      )}

      {/* ============ MEGA MENUS ============ */}
      {tab === "mega" && (() => {
        const g = megas.find((x) => x.id === megaId) ?? megas[0];
        if (!g) return <EmptyState icon="columns" title="No mega panels yet" desc="Create a panel, then attach it to a top-level menu item." action={<Btn variant="primary" disabled={readOnly} onClick={() => setModal({ kind: "create-mega" })}>Create Mega Menu</Btn>} />;
        const gd = megaDocOf(g.id)!;
        const gIssues = checks.byMenu[`mega:${g.id}`] ?? [];
        const usage = megaUsage(siteId, g.id);
        const dirtyMega = gDraft[g.id] && !sameDoc(gDraft[g.id].doc, g.draft);
        return (
          <>
            <div className="m8-two m8-mega-grid">
              <div className="m8-panel">
                <h3 className="m8-h3">Mega Menus</h3>
                <p className="m8-muted">Create and manage mega menu layouts.</p>
                <div className="m8-mega-list">
                  {megas.map((x) => {
                    const used = megaUsage(siteId, x.id);
                    return (
                      <button key={x.id} type="button" className={`m8-mega-item${x.id === g.id ? " is-on" : ""}`} aria-pressed={x.id === g.id} onClick={() => setMegaId(x.id)}>
                        <Icon name="columns" size={14} />
                        <span className="m8-mega-item-txt"><b>{megaDocOf(x.id)?.name}</b><small className="m8-muted">{used.length ? `Used in: ${used.map((u) => u.menuName).join(", ")}` : "Not in use"}</small></span>
                      </button>
                    );
                  })}
                </div>
                <Btn icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-mega" })}>Create Mega Menu</Btn>
                <div className="m8-hint-line">Attach a panel to a top-level item in Menu Builder.</div>
              </div>

              <div className="m8-panel">
                <div className="m8-panel-head">
                  <h3 className="m8-h3">{gd.name}</h3>
                  <Pill tone={megaHasChanges(g) ? "amber" : "green"} dot>{megaHasChanges(g) ? "Draft" : "Published"}</Pill>
                  <span className="m8-spacer" />
                  <Btn variant="sm" icon="trash" disabled={readOnly || usage.length > 0} title={usage.length ? "Detach it from its menu item first." : undefined} onClick={() => setModal({ kind: "delete-mega", megaId: g.id })}>Delete</Btn>
                </div>
                <div className="m8-muted">{usage.length ? `Used in: ${usage.map((u) => u.menuName).join(", ")}` : "Used in: nothing yet. Attach it to a top-level item in Menu Builder."}</div>
                <Field label="Panel name"><input aria-label="Mega panel name" value={gd.name} disabled={readOnly} onChange={(e) => setMegaDoc(g.id, { ...gd, name: e.target.value })} /></Field>
                <MegaEditor doc={gd} pages={pages as never} idp={`mega-${g.id}`} disabled={readOnly} onChange={(next) => setMegaDoc(g.id, next)} />
                {gIssues.map((i) => <p key={i.id} className={i.severity === "error" ? "m8-err-text" : "m8-warn-text"}><Icon name="alert" size={12} /> {i.detail}</p>)}
                <div className="m8-acts">
                  <Btn variant="primary" icon="check" disabled={!dirtyMega || busy || readOnly} loading={busy} onClick={() => void saveAll()}>Save Draft</Btn>
                </div>
              </div>
            </div>
            <div className="m8-panel">
              <div className="m8-panel-head">
                <h3 className="m8-h3">Mega Panel Preview</h3>
                <span className="m8-spacer" />
                <select aria-label="Mega panel" value={g.id} onChange={(e) => setMegaId(e.target.value)}>
                  {megas.map((x) => <option key={x.id} value={x.id}>{megaDocOf(x.id)?.name}</option>)}
                </select>
              </div>
              <MegaPanelView mega={gd} pages={pages as never} tokens={themeFor(siteId).live.tokens} />
            </div>
          </>
        );
      })()}

      {/* ============ PREVIEW, PUBLISHING & VERSION HISTORY ============ */}
      {tab === "history" && (
        <div className="m8-hist">
          <aside className="m8-hist-side">
            <div className="m8-panel">
              <h4 className="m8-h4">Preview Navigation</h4>
              <div className="m8-seg" role="radiogroup" aria-label="History preview device">
                {([["desktop", "Desktop"], ["mobile", "Mobile"], ["tablet", "Tablet"]] as [Device, string][]).map(([dv, lbl]) => (
                  <button key={dv} role="radio" aria-checked={device === dv} onClick={() => setDevice(dv)}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="m8-panel m8-status">
              <h4 className="m8-h4">Publishing Status</h4>
              <div className={`m8-status-row${liveRec ? " is-live" : ""}`}>
                <Icon name={liveRec ? "check" : "clock"} size={14} />
                <div>
                  <b>{liveRec ? "Published (Live)" : "Not published yet"}</b>
                  <small className="m8-muted">{liveRec ? `Live since ${when(liveRec.at)}` : "Publish to make these menus live."}</small>
                </div>
              </div>
              <div className="m8-status-row">
                <Icon name="pencil" size={14} />
                <div>
                  <b>Draft changes</b>
                  <small className="m8-muted">{changes.length ? `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}` : "No unsaved changes"}</small>
                  {changes.length > 0 && <button type="button" className="m8-link-btn" onClick={() => setModal({ kind: "changes" })}>View changes</button>}
                </div>
              </div>
              <Btn variant="primary" icon="rocket" disabled={readOnly || busy || checks.errors > 0 || draftCount === 0} onClick={() => setModal({ kind: "changes" })}>Publish Changes</Btn>
              <Btn icon="link" onClick={() => setModal({ kind: "validate" })}>Validate Links ({checks.all.length} issue{checks.all.length === 1 ? "" : "s"})</Btn>
              <Btn icon="clock" onClick={() => document.getElementById("m8-versions")?.scrollIntoView({ behavior: "smooth", block: "start" })}>View Release History</Btn>
              <Btn icon="undo" disabled={readOnly || busy || !prevVersion} title={prevVersion ? undefined : "There is no earlier version yet."}
                onClick={() => prevVersion && setModal({ kind: "rollback", version: prevVersion })}>Rollback to Previous Version</Btn>
            </div>
          </aside>

          <div className="m8-hist-main">
            <div className="m8-panel">
              <h4 className="m8-h4">Website Navigation Preview ({deviceLabel})</h4>
              <NavPreview items={d ? d.items : []} megaOf={(id) => (id ? megaDocOf(id) : undefined)} pages={pages as never} tokens={themeFor(siteId).live.tokens}
                device={device} brand={siteName} menuStyle={d ? styleOf(d) : undefined} mobileBehaviour={device === "desktop" ? "drawer" : "accordion"} openFirstLevel={d ? d.mobile.openFirstLevel : false}
                openId={openPanel} onOpen={setOpenPanel} label={`${d ? d.name : "Menu"} preview`} />
            </div>
            <div className="m8-panel" id="m8-versions">
              <div className="m8-panel-head"><h3 className="m8-h3">Version History ({data.versions.length})</h3></div>
              <div className="m8-banner is-info" role="note"><Icon name="info" size={13} /><span>Each publish creates a numbered version of every live menu, mega panel and layout placement. Rollback restores them together and publishes that as a new version. History is never rewritten.</span></div>
              <div className="m8-table-wrap"><table className="m8-table">
                <thead><tr><th>Version</th><th>Change summary</th><th>Published by</th><th>Date &amp; time</th><th>Type</th><th><span className="m8-sr">Actions</span></th></tr></thead>
                <tbody>
                  {versionsDesc.map((v) => (
                    <tr key={v.id}>
                      <td><b>v{v.v}</b>{v.v === liveVersion && <Pill tone="green">Live</Pill>}</td>
                      <td>{v.summary}</td>
                      <td>{v.by}</td>
                      <td>{when(v.at)}</td>
                      <td>{v.kind === "rollback" ? "Rollback" : "Publish"}</td>
                      <td className="m8-row-end">{v.v !== liveVersion && <Btn variant="sm" icon="undo" disabled={readOnly || busy} onClick={() => setModal({ kind: "rollback", version: v })}>Roll back</Btn>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODALS ============ */}
      {newMenuModal}
      {modal?.kind === "create-mega" && <CreateMegaModal onClose={() => setModal(null)} onCreate={async (name) => {
        try { const g = await MenusAPI.createMega(siteId, name); setModal(null); setMegaId(g.id); setTab("mega"); setTick((t) => t + 1); app.toast({ type: "success", title: `${name} created` }); }
        catch (e) { toastErr(e, "Could not create panel"); }
      }} />}
      {modal?.kind === "delete-mega" && <Modal title="Delete mega panel?" icon="trash" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" onClick={async () => { try { await MenusAPI.deleteMega(modal.megaId); setModal(null); setMegaId(null); setTick((t) => t + 1); app.toast({ type: "success", title: "Mega panel deleted" }); } catch (e) { toastErr(e, "Could not delete"); } }}>Delete panel</Btn></>}>
        <p>This removes the panel from the library. This cannot be undone once published.</p>
      </Modal>}
      {modal?.kind === "delete-menu" && menu && <Modal title={`Delete ${menu.draft.name}?`} icon="trash" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" disabled={busy} onClick={async () => { setBusy(true); try { await MenusAPI.deleteMenu(menu.id); setModal(null); setMenuId(null); setTick((t) => t + 1); app.toast({ type: "success", title: "Menu deleted" }); } catch (e) { toastErr(e, "Could not delete"); } finally { setBusy(false); } }}>Delete menu</Btn></>}>
        <p>Its draft is removed. Published versions keep their copy, and the menu can't be deleted while it's placed in a layout slot.</p>
      </Modal>}
      {modal?.kind === "remove-item" && doc && <Modal title="Remove this item?" icon="trash" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" onClick={() => removeSel(modal.itemId)}>Remove item and children</Btn></>}>
        <p>This item has {countItems([findItem(doc.items, modal.itemId)!])} item(s) beneath it, including any mega panel. They are removed from the menu draft.</p>
      </Modal>}
      {modal?.kind === "dup-link" && <Modal title="Already in this menu" icon="copy" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" onClick={() => addPicked(true)}>Add anyway</Btn></>}>
        <p>One of these pages is already a link in this menu. Add it again?</p>
      </Modal>}
      {modal?.kind === "unsaved" && <Modal title="Save this menu first?" icon="alert" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Keep editing</Btn><Btn onClick={() => { const next = modal.next; resetDrafts(); setModal(null); selectMenu(next, true); }}>Discard changes</Btn><Btn variant="primary" onClick={async () => { const ok = await saveAll(true); if (ok) { const next = modal.next; setModal(null); selectMenu(next, true); } }}>Save Draft</Btn></>}>
        <p>You have unsaved changes to this menu.</p>
      </Modal>}
      {modal?.kind === "replace" && <Modal title="Replace the menu in this slot?" icon="alert" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" onClick={() => doReplace(modal.layoutId, modal.slot, modal.to)}>Replace in Draft</Btn></>}>
        <p>{LOC_LABEL[modal.slot]} in {layouts.find((l) => l.id === modal.layoutId)?.name} currently shows <b>{liveNames(slotsOf(placeDoc, modal.layoutId)[modal.slot] ?? "")}</b>. It will show <b>{liveNames(modal.to)}</b> after you publish. Nothing changes until you publish.</p>
      </Modal>}
      {modal?.kind === "rollback" && <Modal title={`Roll back to v${modal.version.v}?`} icon="undo" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" disabled={busy} loading={busy} onClick={() => void rollback(modal.version)}>Roll back and publish</Btn></>}>
        <p>Menus, mega panels and their placements return to v{modal.version.v} and publish as a new version. Current drafts are replaced.</p>
      </Modal>}
      {modal?.kind === "changes" && (
        <Modal title="Publish changes" sub={`${changes.length} change${changes.length === 1 ? "" : "s"} will go live. Versions are numbered and can be rolled back.`} icon="rocket" onClose={() => setModal(null)}
          footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="rocket" disabled={busy || checks.errors > 0 || changes.length === 0} loading={busy} onClick={() => void publish()}>Publish {changes.length} change{changes.length === 1 ? "" : "s"}</Btn></>}>
          {checks.errors > 0 && <p className="m8-err-text"><Icon name="alert" size={12} /> {checks.errors} error{checks.errors === 1 ? "" : "s"} block publishing. Fix them first.</p>}
          {checks.warns > 0 && <p className="m8-warn-text"><Icon name="alert" size={12} /> {checks.warns} warning{checks.warns === 1 ? "" : "s"}. Publishing is allowed.</p>}
          <ul className="m8-changes">{changes.map((c, i) => <li key={i}><Pill tone="grey">{c.kind}</Pill> <b>{c.name}</b> <span className="m8-muted">{c.detail}</span></li>)}</ul>
        </Modal>
      )}
      {modal?.kind === "validate" && (
        <Modal title="Validate links" sub="Every menu and mega panel is checked against your pages and link rules." icon="link" onClose={() => setModal(null)}
          footer={<Btn onClick={() => setModal(null)}>Close</Btn>}>
          {checks.all.length === 0 ? <p className="m8-ok-text"><Icon name="check" size={12} /> No link problems found.</p> : (
            <ul className="m8-changes m8-issues">{checks.all.map((i) => <li key={i.id} className={i.severity === "error" ? "err" : "warn"}><Pill tone={i.severity === "error" ? "red" : "amber"}>{i.severity === "error" ? "Error" : "Warning"}</Pill> <b>{i.label}</b> <span className="m8-muted">{i.detail}</span></li>)}</ul>
          )}
        </Modal>
      )}

      {/* Preview modal for the chosen menu, reachable from the header */}
      {previewing && m && d && (
        <Modal title={`Preview · ${d.name}`} icon="eye" onClose={() => setPreviewing(false)} footer={<Btn onClick={() => setPreviewing(false)}>Close</Btn>}>
          <div className="m8-seg" role="radiogroup" aria-label="Preview device">
            {(["desktop", "tablet", "mobile"] as Device[]).map((dv) => <button key={dv} role="radio" aria-checked={device === dv} onClick={() => setDevice(dv)}>{dv[0].toUpperCase() + dv.slice(1)}</button>)}
          </div>
          <NavPreview items={d.items} megaOf={(id) => (id ? megaDocOf(id) : undefined)} pages={pages as never} tokens={themeFor(siteId).live.tokens}
            device={device} brand={siteName} menuStyle={styleOf(d)} mobileBehaviour="accordion" openFirstLevel={d.mobile.openFirstLevel}
            openId={openPanel} onOpen={setOpenPanel} label={`${d.name} preview`} />
        </Modal>
      )}
    </div>
  );
}
