/* ============================================================
   Module 8 · Menus & Navigation
   ------------------------------------------------------------
   Tabs: Menu Builder · Manage Menus · Menu Placements · Mega Menus · Version History · Settings.
   Every edit goes into a per-record draft. Save Draft writes the drafts (compare-and-swap on rev,
   refused while there are errors). Publish runs the checks and copies the drafts live as a numbered
   version. Apply writes the LIVE menu into a header or footer variant and stores a reference to it.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Btn, EmptyState, Field, Modal, Pill, Skel, Switch } from "@/components/ui";
import { useApp } from "@/lib/store";
import { LayoutsAPI, type FooterChromeProps, type HeaderChromeProps, type SharedRegion } from "@/lib/layout-db";
import { themeFor } from "@/lib/theme-db";
import { DBX, type CmsPage } from "@/lib/data";
import {
  LOCATIONS, LOC_LABEL, MENU_LIMITS, MenuError, MenusAPI, addChild, blankLink, checkMega, checkMenu, findItem, mapItem,
  mode as MenusMode, moveBefore, moveItem, removeItem, sameDoc, countItems, linkLabel, megaUsage, statusOf, megaHasChanges,
  type Loc, type Loaded, type MegaDoc, type MenuDoc, type MenuItem, type MenuIssue, type Placements, type VersionRec,
  type Behaviour, type Audience,
} from "@/lib/menu-db";
import { type Device, LinkEditor, MegaEditor, MegaPanelView, NavPreview } from "@/components/menus/MenuParts";
import { AUD_LABEL, ago, Accordion, ApplyList, ChromeLine, CreateMegaModal, CreateMenuModal, Head, Kpi, depthOfId, menuChrome, renderTabs, when, type ModalState, type Tab } from "./MenusParts";

type Draft<T> = { doc: T; base: number };
type Data = Loaded & { regions: SharedRegion[] };

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
  const [data, setData] = useState<Data | null>(null);
  const [mDraft, setMDraft] = useState<Record<string, Draft<MenuDoc>>>({});
  const [gDraft, setGDraft] = useState<Record<string, Draft<MegaDoc>>>({});
  const [pDraft, setPDraft] = useState<Draft<Placements> | null>(null);
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuQ, setMenuQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageQ, setManageQ] = useState("");
  const [manageFilter, setManageFilter] = useState<"all" | "published" | "draft" | "assigned" | "unassigned">("all");
  const [mgQ, setMgQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  /* ---------- load ---------- */
  const reload = useCallback(async () => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    try {
      const [m, lay] = await Promise.all([MenusAPI.load(siteId), LayoutsAPI.load(siteId)]);
      setData({ ...m, regions: lay.regions, pages: m.pages as CmsPage[] } as Data);
      setLoadErr("");
      setStatus("ready");
      // a draft survives a reload only if it still starts from the saved revision
      setMDraft((d) => Object.fromEntries(Object.entries(d).filter(([id, v]) => m.menus.find((x) => x.id === id)?.rev === v.base)));
      setGDraft((d) => Object.fromEntries(Object.entries(d).filter(([id, v]) => m.megas.find((x) => x.id === id)?.rev === v.base)));
      setPDraft((d) => (d && !sameDoc(d.doc, m.placements.draft) ? d : null));
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
  useEffect(() => { setMenuId(null); setItemId(null); setMegaId(null); setMDraft({}); setGDraft({}); setPDraft(null); }, [siteId]);

  /* ---------- derived ---------- */
  const menus = data?.menus ?? [];
  const megas = data?.megas ?? [];
  const pages = (data?.pages ?? []) as CmsPage[];
  const menu = menus.find((m) => m.id === menuId) ?? null;
  const doc: MenuDoc | null = menu ? mDraft[menu.id]?.doc ?? menu.draft : null;
  const placeDoc: Placements | null = data ? pDraft?.doc ?? data.placements.draft : null;
  const placeDirty = !!data && !!pDraft && !sameDoc(pDraft.doc, data.placements.draft);
  const megaDocOf = (id: string): MegaDoc | undefined => {
    const g = megas.find((x) => x.id === id);
    return g ? gDraft[id]?.doc ?? g.draft : undefined;
  };
  const dirtyMenuIds = Object.keys(mDraft).filter((id) => { const m = menus.find((x) => x.id === id); return !!m && !sameDoc(mDraft[id].doc, m.draft); });
  const dirtyMegaIds = Object.keys(gDraft).filter((id) => { const g = megas.find((x) => x.id === id); return !!g && !sameDoc(gDraft[id].doc, g.draft); });
  const anyDirty = dirtyMenuIds.length > 0 || dirtyMegaIds.length > 0 || placeDirty;

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

  /* what Publish would ship: every menu, mega panel and placement that differs from live */
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
    const pd = pDraft?.doc ?? data.placements.draft;
    if (!data.placements.live || !sameDoc(data.placements.live, pd)) out.push({ kind: "Placement", name: "Placements", detail: "assignment changed" });
    return out;
  }, [data, mDraft, gDraft, pDraft]);

  const assignedCount = placeDoc ? LOCATIONS.filter((l) => placeDoc[l]).length : 0;
  const liveVersion = data ? Math.max(0, ...data.versions.map((v) => v.v)) : 0;
  const usedIn = (id: string): Loc | null => (placeDoc && LOCATIONS.find((l) => placeDoc[l] === id)) || null;
  const itemSel = doc && itemId ? findItem(doc.items, itemId) : null;
  const itemDepth = itemSel && doc ? depthOfId(doc.items, itemSel.id) : 0;
  const draftCount = changes.length;

  /* ---------- writers ---------- */
  const setDoc = (next: MenuDoc) => {
    if (!menu || readOnly) return;
    setMDraft((d) => ({ ...d, [menu.id]: { doc: next, base: d[menu.id]?.base ?? menu.rev } }));
  };
  const patchDoc = (fn: (d: MenuDoc) => MenuDoc) => { if (doc) setDoc(fn(doc)); };
  const setMegaDoc = (id: string, next: MegaDoc) => {
    const g = megas.find((x) => x.id === id);
    if (!g || readOnly) return;
    setGDraft((d) => ({ ...d, [id]: { doc: next, base: d[id]?.base ?? g.rev } }));
  };
  const setPlace = (next: Placements) => {
    if (!data || readOnly) return;
    setPDraft({ doc: next, base: 0 });
  };
  const setItemField = (fn: (it: MenuItem) => MenuItem) => { if (doc && itemId) setDoc({ ...doc, items: mapItem(doc.items, itemId, fn) }); };
  const toastErr = (e: unknown, title: string) => app.toast({ type: "error", title, sub: e instanceof Error ? e.message : undefined });
  const resetDrafts = () => { setMDraft({}); setGDraft({}); setPDraft(null); };

  /** save every dirty draft; returns false and shows the conflict banner on a stale save */
  const saveAll = async (quiet = false): Promise<boolean> => {
    if (!data || readOnly) return false;
    setBusy(true);
    try {
      for (const id of dirtyMenuIds) await MenusAPI.saveMenu(id, mDraft[id].doc, menus.find((x) => x.id === id)!.rev);
      for (const id of dirtyMegaIds) await MenusAPI.saveMega(id, gDraft[id].doc, megas.find((x) => x.id === id)!.rev);
      if (placeDirty && pDraft) await MenusAPI.savePlacements(siteId, pDraft.doc, null);
      setConflict(null);
      if (!quiet) app.toast({ type: "success", title: "Drafts saved", sub: "Nothing is live until you publish." });
      setTick((t) => t + 1);
      return true;
    } catch (e) {
      if (e instanceof MenuError && e.code === "E_CONFLICT") { setConflict(e.message); return false; }
      toastErr(e, "Could not save");
      return false;
    } finally { setBusy(false); }
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
      setModal(null);
      setTick((t) => t + 1);
      app.toast({ type: "success", title: `Rolled back to v${v.v}`, sub: "Published as a new version. History is kept." });
    } catch (e) { toastErr(e, "Could not roll back"); }
    finally { setBusy(false); }
  };

  const applyTo = async (loc: "header" | "footer", variantId: string, regionId: string) => {
    if (!menu || !data) return;
    setBusy(true);
    try {
      const r = await MenusAPI.apply(menu.id, regionId, variantId, data.regions);
      setModal(null);
      setTick((t) => t + 1);
      app.toast({ type: "success", title: `${doc?.name ?? "Menu"} applied to the ${loc}`, sub: r.omitted.length ? `Left out: ${r.omitted.join("; ")}` : `${r.written} links written.` });
    } catch (e) { toastErr(e, "Apply failed"); }
    finally { setBusy(false); }
  };

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
  if (menus.length === 0 && megas.length === 0) {
    return (
      <div className="m8-wrap"><Head siteName={siteName} />
        <div className="m8-state"><EmptyState icon="menu" title="No menus yet" desc="Create a menu for the header, the footer or a campaign. Each one is a tree of links you publish." action={<Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-menu" })}>New menu</Btn>} /></div>
        {modal?.kind === "create-menu" && <CreateMenuModal name={newName} desc={newDesc} setName={setNewName} setDesc={setNewDesc} onClose={() => setModal(null)} onCreate={async () => {
          try { const m = await MenusAPI.createMenu(siteId, newName.trim() || "Untitled menu", newDesc.trim()); setNewName(""); setNewDesc(""); setModal(null); setMenuId(m.id); setTick((t) => t + 1); app.toast({ type: "success", title: `${m.draft.name} created`, sub: "Add links, then publish." }); } catch (e) { toastErr(e, "Could not create menu"); }
        }} />}
      </div>
    );
  }

  const selectMenu = (id: string) => { setMenuId(id); setItemId(null); setMenuOpen(false); setMenuQ(""); setTab("builder"); };

  /* ---------- tree actions ---------- */
  const addPicked = () => {
    if (!doc) return;
    const adds = picked.map((pid) => blankLink(pages.find((x) => x.id === pid)?.title ?? "Page", { kind: "page", pageId: pid }));
    if (doc.items.length + adds.length > MENU_LIMITS.maxTop) {
      app.toast({ type: "error", title: "Too many top-level links", sub: `A menu takes ${MENU_LIMITS.maxTop} top-level links. Move some under a dropdown first.` });
      return;
    }
    setDoc({ ...doc, items: [...doc.items, ...adds] });
    setPicked([]);
    if (adds[0]) setItemId(adds[0].id);
  };
  const addCustom = () => {
    if (!doc) return;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(customUrl.trim())) {
      app.toast({ type: "error", title: "Address not allowed", sub: "Use https://, mailto: or tel:." });
      return;
    }
    const it = blankLink(customLabel.trim() || "Custom link", { kind: "url", url: customUrl.trim() });
    setDoc({ ...doc, items: [...doc.items, it] });
    setItemId(it.id);
    setCustomLabel(""); setCustomUrl("https://");
  };
  const addUnder = (parentId: string) => {
    if (!doc) return;
    const it = blankLink("New link", null);
    setDoc({ ...doc, items: addChild(doc.items, parentId, it) });
    setItemId(it.id);
    setCollapsed((s) => { const n = new Set(s); n.delete(parentId); return n; });
  };
  const removeSel = () => {
    if (!doc || !itemId) return;
    setDoc({ ...doc, items: removeItem(doc.items, itemId) });
    setItemId(null);
  };

  const q = pageQ.trim().toLowerCase();
  const visiblePages = pages.filter((p) => !p.trash && (p.title + p.path).toLowerCase().includes(q));
  const standardPages = visiblePages.filter((p) => p.type !== "landing");
  const landingPages = visiblePages.filter((p) => p.type === "landing");
  const allStandard = pages.filter((p) => !p.trash && p.type !== "landing").length;
  const allLanding = pages.filter((p) => !p.trash && p.type === "landing").length;
  const filteredMenus = menus.filter((m) => (mDraft[m.id]?.doc ?? m.draft).name.toLowerCase().includes(menuQ.trim().toLowerCase()));

  /* ---------- tree rows (closure over this screen's state) ---------- */
  const renderRows = (items: MenuItem[], depth: number): ReactNode =>
    items.map((it) => {
      const kids = it.children.length > 0;
      const isCollapsed = collapsed.has(it.id);
      const sel = itemId === it.id;
      const badge = it.behaviour === "mega" ? "Mega Menu" : it.behaviour === "dropdown" ? "Dropdown" : it.link?.kind === "url" ? "Link" : it.link?.kind === "anchor" ? "Anchor" : "Page";
      const mine = (checks.byMenu[menu?.id ?? ""] ?? []).filter((i) => i.itemId === it.id);
      const hasErr = mine.some((b) => b.severity === "error");
      const hasWarn = mine.some((b) => b.severity === "warn");
      return (
        <li key={it.id} role="none" className={`m8-node depth-${depth}`}>
          <div
            role="treeitem" aria-level={depth + 1} aria-selected={sel} aria-expanded={kids ? !isCollapsed : undefined}
            tabIndex={0} className={`m8-row${sel ? " is-sel" : ""}${it.behaviour === "mega" ? " is-mega" : ""}${dragId === it.id ? " is-drag" : ""}`}
            onClick={() => { setItemId(it.id); setItemTab("settings"); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setItemId(it.id); setItemTab("settings"); }
              if (readOnly || !e.altKey) return;
              if (e.key === "ArrowUp") { e.preventDefault(); patchDoc((d) => ({ ...d, items: moveItem(d.items, it.id, -1) })); }
              if (e.key === "ArrowDown") { e.preventDefault(); patchDoc((d) => ({ ...d, items: moveItem(d.items, it.id, 1) })); }
            }}
            onDragOver={(e) => { if (!readOnly && dragId) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragId ?? e.dataTransfer.getData("text/plain");
              setDragId(null);
              if (from && from !== it.id) patchDoc((d) => ({ ...d, items: moveBefore(d.items, from, it.id) }));
            }}
          >
            <span className="m8-grip" draggable={!readOnly} aria-hidden="true" title="Drag to reorder, or Alt + arrow keys"
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; setDragId(it.id); }} onDragEnd={() => setDragId(null)}>
              <Icon name="grip" size={14} />
            </span>
            {kids ? (
              <button type="button" className="m8-chev" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${it.label}`}
                onClick={(e) => { e.stopPropagation(); setCollapsed((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; }); }}>
                <Icon name={isCollapsed ? "chevRight" : "chevDown"} size={12} />
              </button>
            ) : <span className="m8-chev-gap" />}
            <Icon name={it.behaviour === "mega" ? "columns" : it.behaviour === "dropdown" ? "layers" : "file"} size={14} />
            <span className="m8-row-label">{it.label || <em>Untitled</em>}</span>
            {hasErr && <span className="m8-flag is-err" title="Has errors"><Icon name="alert" size={11} /></span>}
            {!hasErr && hasWarn && <span className="m8-flag is-warn" title="Has warnings"><Icon name="alert" size={11} /></span>}
            {it.audience !== "everyone" && <span className="m8-aud">{AUD_LABEL[it.audience]}</span>}
            <span className={`m8-type${it.behaviour === "mega" ? " is-mega" : ""}`}>{badge}</span>
            <span className="m8-row-acts" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="m8-icon" aria-label={`Move ${it.label} up`} disabled={readOnly} onClick={() => patchDoc((d) => ({ ...d, items: moveItem(d.items, it.id, -1) }))}><Icon name="chevUp" size={12} /></button>
              <button type="button" className="m8-icon" aria-label={`Move ${it.label} down`} disabled={readOnly} onClick={() => patchDoc((d) => ({ ...d, items: moveItem(d.items, it.id, 1) }))}><Icon name="chevDown" size={12} /></button>
            </span>
          </div>
          {kids && !isCollapsed && <ul role="group" className="m8-tree m8-sub">{renderRows(it.children, depth + 1)}</ul>}
        </li>
      );
    });

  const m = menu;
  const d = doc;
  /* what the applied header or footer holds right now (the flat nav or the footer groups) */
  const appliedVariant = m?.appliedTo ? data.regions.find((r) => r.id === m.appliedTo!.regionId)?.variants.find((v) => v.id === m.appliedTo!.variantId) : undefined;
  const chromeProps = (appliedVariant?.blocks[0]?.props ?? {}) as Partial<HeaderChromeProps & FooterChromeProps>;
  const liveNow: string[] = chromeProps.nav ?? chromeProps.groups?.map((g) => g.title) ?? [];
  const menuStatus = m ? statusOf(m) : "draft";

  return (
    <div className={`m8-wrap${readOnly ? " is-readonly" : ""}`}>
      <Head siteName={siteName} />

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
        <Kpi icon="check" n={assignedCount} label="Assigned" tone="green" />
        <Kpi icon="pencil" n={draftCount} label="Draft (unpublished)" tone="amber" />
        <Kpi icon="link" n={checks.errors} label="Link issues" tone={checks.errors ? "red" : "grey"} onClick={() => setModal({ kind: "validate" })} />
        <Kpi icon="clock" n={data.versions.length} label="Version history" tone="blue" onClick={() => setTab("history")} />
      </div>

      <div className="m8-tabs" role="tablist" aria-label="Menus sections">
        {renderTabs(tab, setTab)}
        <span className="m8-tabs-meta">
          {anyDirty ? <Pill tone="amber" dot>Unsaved changes</Pill> : <Pill tone="green" dot>Saved</Pill>}
          <Btn icon="check" disabled={!anyDirty || busy || readOnly} loading={busy} onClick={() => void saveAll()}>Save Draft</Btn>
          <Btn variant="primary" icon="rocket" disabled={readOnly || busy || checks.errors > 0 || draftCount === 0}
            title={checks.errors ? "Fix the errors first" : draftCount === 0 ? "Nothing to publish" : undefined}
            onClick={() => setModal({ kind: "changes" })}>
            Publish Changes{draftCount ? ` (${draftCount})` : ""}
          </Btn>
        </span>
      </div>

      {/* ============ MENU BUILDER ============ */}
      {tab === "builder" && m && d && (
        <>
          <div className="m8-menubar">
            <div className="m8-menu-pick">
              <span className="m8-lbl" id="m8-menu-lbl">Menu</span>
              <button type="button" className="m8-select" aria-haspopup="listbox" aria-expanded={menuOpen} aria-labelledby="m8-menu-lbl" onClick={() => setMenuOpen((o) => !o)}>
                <Icon name="menu" size={14} /> <b>{d.name}</b>
                {usedIn(m.id) && <Pill tone="violet">{LOC_LABEL[usedIn(m.id)!]}</Pill>}
                <Icon name="chevDown" size={13} />
              </button>
              {menuOpen && (
                <div className="m8-pop" role="listbox" aria-label="Choose a menu" onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false); }}>
                  <input aria-label="Search menus" placeholder="Search menus…" value={menuQ} onChange={(e) => setMenuQ(e.target.value)} autoFocus />
                  {filteredMenus.map((x) => (
                    <button key={x.id} role="option" aria-selected={x.id === m.id} onClick={() => selectMenu(x.id)}>
                      <Icon name={x.id === m.id ? "check" : "menu"} size={13} /> {(mDraft[x.id]?.doc ?? x.draft).name}
                      {usedIn(x.id) && <Pill tone="violet">{LOC_LABEL[usedIn(x.id)!].split(" ")[0]}</Pill>}
                      <Pill tone={statusOf(x) === "published" ? "green" : "grey"} dot>{statusOf(x) === "published" ? "Published" : "Draft"}</Pill>
                    </button>
                  ))}
                  {filteredMenus.length === 0 && <p className="m8-pop-empty">No menu matches.</p>}
                </div>
              )}
              {menuStatus === "published" ? <Pill tone="green" dot>Published (live)</Pill> : <Pill tone="grey" dot>Draft</Pill>}
            </div>
            <div className="m8-menubar-acts">
              <Btn icon="eye" onClick={() => document.getElementById("m8-preview")?.scrollIntoView({ behavior: "smooth" })}>Preview Menu</Btn>
              <Btn icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-menu" })}>New Menu</Btn>
            </div>
          </div>

          <div className="m8-builder">
            <section className="m8-card m8-col" aria-label="Add menu items">
              <h3 className="m8-h3">Add Items</h3>
              <Accordion title={`Pages (${allStandard})`} defaultOpen>
                <input className="m8-search" aria-label="Search pages" placeholder="Search pages…" value={pageQ} onChange={(e) => setPageQ(e.target.value)} />
                <ul className="m8-check">
                  {standardPages.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={picked.includes(p.id)} disabled={readOnly}
                          onChange={(e) => setPicked((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
                        <span>{p.title}{p.status === "draft" && <em className="m8-draft-tag">draft</em>}</span>
                        <small>{p.path}</small>
                      </label>
                    </li>
                  ))}
                  {standardPages.length === 0 && <li className="m8-muted">No pages match.</li>}
                </ul>
              </Accordion>
              <Accordion title={`Landing pages (${allLanding})`}>
                <ul className="m8-check">
                  {landingPages.map((p) => (
                    <li key={p.id}><label>
                      <input type="checkbox" checked={picked.includes(p.id)} disabled={readOnly} onChange={(e) => setPicked((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
                      <span>{p.title}</span><small>{p.path}</small>
                    </label></li>
                  ))}
                  {landingPages.length === 0 && <li className="m8-muted">No landing pages match.</li>}
                </ul>
              </Accordion>
              <Btn variant="primary" className="m8-wide" disabled={readOnly || picked.length === 0} onClick={addPicked}>Add to Menu ({picked.length})</Btn>
              <Accordion title="Custom link">
                <Field label="Label"><input aria-label="Custom link label" value={customLabel} disabled={readOnly} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Apply now" /></Field>
                <Field label="Web address" hint="https://, mailto: or tel:"><input aria-label="Custom link address" value={customUrl} disabled={readOnly} onChange={(e) => setCustomUrl(e.target.value)} /></Field>
                <Btn className="m8-wide" disabled={readOnly} onClick={addCustom}>Add custom link</Btn>
              </Accordion>
            </section>

            <section className="m8-card m8-col m8-col-mid" aria-label="Menu structure">
              <div className="m8-row-h">
                <div><h3 className="m8-h3">Menu Structure</h3><p className="m8-sub">Drag to reorder. Choose Dropdown or Mega Menu in Settings.</p></div>
                <Btn variant="sm" onClick={() => setCollapsed(new Set())}>Expand All</Btn>
              </div>
              <div className="m8-depth-note"><Icon name="alert" size={12} /> Maximum depth: {MENU_LIMITS.maxDepth} levels (e.g. Main › Submenu › Sub-item)</div>
              {d.items.length === 0 && <EmptyState icon="menu" title="No links yet" desc="Pick pages on the left, or add a custom link." />}
              <ul className="m8-tree" role="tree" aria-label="Menu items">{renderRows(d.items, 0)}</ul>
              {d.items.length > 0 && <p className="m8-count">{countItems(d.items)} links · {d.items.length} top level</p>}
            </section>

            <section className="m8-card m8-col" aria-label="Menu item settings">
              <div className="m8-row-h">
                <h3 className="m8-h3">Menu Item Settings</h3>
                {itemSel?.behaviour === "mega" && <Pill tone="violet">Mega Menu</Pill>}
              </div>
              {!itemSel && <p className="m8-muted">Select a link in the structure to edit it.</p>}
              {itemSel && (
                <>
                  <div className="m8-stabs" role="tablist" aria-label="Item settings sections">
                    <button role="tab" aria-selected={itemTab === "settings"} onClick={() => setItemTab("settings")}>Settings</button>
                    {itemSel.behaviour === "mega" && <button role="tab" aria-selected={itemTab === "mega"} onClick={() => setItemTab("mega")}>Mega Panel</button>}
                    <button role="tab" aria-selected={itemTab === "advanced"} onClick={() => setItemTab("advanced")}>Advanced</button>
                  </div>
                  {itemTab === "settings" && (
                    <div className="m8-form">
                      <Field label="Label" hint={`${itemSel.label.length}/${MENU_LIMITS.maxLabel} characters`}>
                        <input aria-label="Label" value={itemSel.label} disabled={readOnly} onChange={(e) => setItemField((it) => ({ ...it, label: e.target.value }))} />
                      </Field>
                      <div className="m8-field"><span className="m8-lbl">Link to</span>
                        <LinkEditor idp="item" link={itemSel.link} pages={pages} disabled={readOnly} onChange={(l) => setItemField((it) => ({ ...it, link: l }))} />
                        <span className="m8-hint">{linkLabel(itemSel.link, pages)}</span>
                      </div>
                      <Field label="Behaviour">
                        <select aria-label="Behaviour" value={itemSel.behaviour} disabled={readOnly}
                          onChange={(e) => setItemField((it) => ({ ...it, behaviour: e.target.value as Behaviour, megaId: e.target.value === "mega" ? it.megaId : null }))}>
                          <option value="link">Link only</option>
                          <option value="dropdown">Dropdown with sub-menu</option>
                          <option value="mega" disabled={itemDepth > 0}>Mega menu{itemDepth > 0 ? " (top level only)" : ""}</option>
                        </select>
                      </Field>
                      <Field label="Visibility">
                        <select aria-label="Visibility" value={itemSel.audience} disabled={readOnly} onChange={(e) => setItemField((it) => ({ ...it, audience: e.target.value as Audience }))}>
                          {(Object.keys(AUD_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUD_LABEL[a]}</option>)}
                        </select>
                      </Field>
                      <Switch checked={itemSel.newTab} label="Open in a new tab" onChange={(v) => setItemField((it) => ({ ...it, newTab: v }))} />
                      <div className="m8-form-acts">
                        <Btn variant="sm" icon="plus" disabled={readOnly || itemDepth >= MENU_LIMITS.maxDepth - 1 || itemSel.behaviour === "mega"} onClick={() => addUnder(itemSel.id)}>Add link under</Btn>
                        <Btn variant="danger" icon="trash" disabled={readOnly} onClick={removeSel}>Remove Item</Btn>
                      </div>
                    </div>
                  )}
                  {itemTab === "mega" && itemSel.behaviour === "mega" && (
                    <div className="m8-form">
                      <Field label="Attached panel">
                        <select aria-label="Attached mega panel" value={itemSel.megaId ?? ""} disabled={readOnly}
                          onChange={(e) => setItemField((it) => ({ ...it, megaId: e.target.value || null }))}>
                          <option value="">None</option>
                          {megas.map((g) => <option key={g.id} value={g.id}>{(gDraft[g.id]?.doc ?? g.draft).name}</option>)}
                        </select>
                      </Field>
                      {itemSel.megaId && megaDocOf(itemSel.megaId) ? (
                        <>
                          <p className="m8-muted">{megaDocOf(itemSel.megaId)!.columns.length} columns · gap {megaDocOf(itemSel.megaId)!.gap}{megaDocOf(itemSel.megaId)!.featured.enabled ? " · featured card on" : ""}</p>
                          <Btn variant="sm" icon="pencil" onClick={() => { setMegaId(itemSel.megaId); setTab("mega"); }}>Edit panel in Mega Menus</Btn>
                        </>
                      ) : <p className="m8-err-text"><Icon name="alert" size={12} /> No panel attached. This item will not open a menu until you attach one.</p>}
                      <Btn variant="sm" icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-mega" })}>Create a new panel</Btn>
                    </div>
                  )}
                  {itemTab === "advanced" && (
                    <div className="m8-form">
                      <Field label="Extra CSS class" hint="Optional, for the theme's styling hooks">
                        <input aria-label="CSS class" value={itemSel.cssClass} disabled={readOnly} onChange={(e) => setItemField((it) => ({ ...it, cssClass: e.target.value.replace(/[^a-z0-9_ -]/gi, "") }))} />
                      </Field>
                      <Field label="Link relationship" hint="Set for paid or user-generated links">
                        <select aria-label="Link relationship" value={itemSel.rel} disabled={readOnly} onChange={(e) => setItemField((it) => ({ ...it, rel: e.target.value as MenuItem["rel"] }))}>
                          <option value="">None</option><option value="nofollow">nofollow</option><option value="sponsored">sponsored</option>
                        </select>
                      </Field>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <div className="m8-bottom" id="m8-preview">
            <section className="m8-card m8-col-wide" aria-label="Navigation preview">
              <div className="m8-row-h">
                <div><h3 className="m8-h3">Navigation Preview</h3><p className="m8-sub">{d.name}, as a visitor sees it. Dropdown and mega items open on click, Enter or Space.</p></div>
                <div className="m8-seg" role="radiogroup" aria-label="Device">
                  {(["desktop", "tablet", "mobile"] as Device[]).map((dv) => (
                    <button key={dv} type="button" role="radio" aria-checked={device === dv} className={device === dv ? "is-on" : ""} onClick={() => setDevice(dv)}>
                      <Icon name={dv === "desktop" ? "monitor" : dv === "tablet" ? "tablet" : "phone"} size={13} /> {dv[0].toUpperCase() + dv.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="m8-canvas">
                <NavPreview label={`${d.name} preview`} items={d.items} megaOf={(id) => (id ? megaDocOf(id) : undefined)} pages={pages} tokens={themeFor(siteId).live.tokens}
                  device={device} brand={siteName} mobileBehaviour={d.mobile.behaviour} openFirstLevel={d.mobile.openFirstLevel}
                  openId={openPanel} onOpen={setOpenPanel} />
              </div>
            </section>
            <aside className="m8-card m8-col" aria-label="Menu status">
              <h3 className="m8-h3">Menu Status</h3>
              <div className="m8-status">
                {menuStatus === "published" ? <Pill tone="green" dot>Published (live)</Pill> : <Pill tone="amber" dot>Not live yet</Pill>}
                <p>Last published <b>{m.liveAt ? when(m.liveAt) : "never"}</b></p>
                <p>Draft changes: <b>{draftCount}</b>{draftCount > 0 && <button type="button" className="m8-link-btn" onClick={() => setModal({ kind: "changes" })}>View changes</button>}</p>
                <p>Links: <b>{checks.errors} error{checks.errors === 1 ? "" : "s"}, {checks.warns} warning{checks.warns === 1 ? "" : "s"}</b></p>
              </div>
              <div className="m8-stack">
                <Btn variant="primary" icon="rocket" disabled={readOnly || busy || checks.errors > 0 || draftCount === 0} onClick={() => setModal({ kind: "changes" })}>Publish Changes</Btn>
                <Btn icon="check" disabled={readOnly || !anyDirty || busy} onClick={() => void saveAll()}>Save Draft</Btn>
                <Btn icon="shield" onClick={() => setModal({ kind: "validate" })}>Validate Links ({checks.errors + checks.warns})</Btn>
                <Btn icon="clock" onClick={() => setTab("history")}>View Release History</Btn>
              </div>
              <div className="m8-apply m8-target">
                <h4>Header and footer</h4>
                <ChromeLine menu={m} regions={data.regions} usedIn={usedIn(m.id)} />
                <p className="m8-hint">Target: {m.appliedTo ? m.appliedTo.variantName : `the ${usedIn(m.id) === "footer" ? "footer" : "header"} variant in Layouts (not chosen yet)`}</p>
                <p className="m8-hint">Live now: {liveNow.length ? liveNow.join(" · ") : "nothing"}</p>
                <Btn variant="sm" icon="layers"
                  disabled={readOnly || !usedIn(m.id) || usedIn(m.id) === "utility" || menuStatus !== "published"}
                  title={!usedIn(m.id) ? "Place this menu in Header or Footer first" : menuStatus !== "published" ? "Publish this menu first" : undefined}
                  onClick={() => setModal({ kind: "apply", loc: usedIn(m.id) === "footer" ? "footer" : "header" })}>
                  Apply to {usedIn(m.id) === "footer" ? "footer" : "header"}
                </Btn>
                {menuStatus !== "published" && usedIn(m.id) && <p className="m8-hint">Apply uses the live version, so publish first.</p>}
                <Btn variant="ghost" icon="arrowRight" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* ============ MANAGE MENUS ============ */}
      {tab === "manage" && (
        <section className="m8-card" aria-label="Menus list">
          <div className="m8-row-h">
            <div><h3 className="m8-h3">Menus ({menus.length})</h3><p className="m8-sub">Create several menus and place each one on a site location.</p></div>
            <Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-menu" })}>Create Menu</Btn>
          </div>
          <div className="m8-toolbar">
            <input className="m8-search" aria-label="Search menus" placeholder="Search menus…" value={manageQ} onChange={(e) => setManageQ(e.target.value)} />
            <select aria-label="Filter menus" value={manageFilter} onChange={(e) => setManageFilter(e.target.value as typeof manageFilter)}>
              <option value="all">All menus</option><option value="published">Published</option><option value="draft">Draft</option>
              <option value="assigned">Assigned to a location</option><option value="unassigned">Not assigned</option>
            </select>
          </div>
          <table className="m8-table">
            <thead><tr><th>Menu</th><th>Status</th><th>Used in</th><th>Updated</th><th><span className="m8-sr">Actions</span></th></tr></thead>
            <tbody>
              {menus.filter((x) => {
                const dd = mDraft[x.id]?.doc ?? x.draft;
                if (manageQ && !(dd.name + dd.description).toLowerCase().includes(manageQ.toLowerCase())) return false;
                if (manageFilter === "published") return statusOf(x) === "published";
                if (manageFilter === "draft") return statusOf(x) === "draft";
                if (manageFilter === "assigned") return !!usedIn(x.id);
                if (manageFilter === "unassigned") return !usedIn(x.id);
                return true;
              }).map((x) => {
                const dd = mDraft[x.id]?.doc ?? x.draft;
                return (
                  <tr key={x.id}>
                    <td><button type="button" className="m8-link-btn strong" onClick={() => selectMenu(x.id)}>{dd.name}</button><small>{dd.description || "No description"}</small></td>
                    <td><Pill tone={statusOf(x) === "published" ? "green" : "grey"} dot>{statusOf(x) === "published" ? "Published" : "Draft"}</Pill></td>
                    <td>{usedIn(x.id) ? LOC_LABEL[usedIn(x.id)!] : <span className="m8-muted">Not assigned</span>}</td>
                    <td>{ago(x.updatedAt)}</td>
                    <td className="m8-acts">
                      <Btn variant="sm" icon="pencil" onClick={() => selectMenu(x.id)}>Open</Btn>
                      <Btn variant="sm" icon="copy" disabled={readOnly} onClick={async () => {
                        try { const c = await MenusAPI.duplicateMenu(x.id); setMenuId(c.id); setTick((t) => t + 1); setTab("builder"); app.toast({ type: "success", title: "Menu duplicated", sub: "The copy is a draft." }); } catch (e) { toastErr(e, "Could not duplicate"); }
                      }}>Duplicate</Btn>
                      <Btn variant="sm" icon="trash" disabled={readOnly || !!usedIn(x.id) || !!x.appliedTo} title={usedIn(x.id) || x.appliedTo ? "Placed or applied. Move it first." : undefined} onClick={() => { setMenuId(x.id); setModal({ kind: "delete-menu" }); }}>Delete</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ============ PLACEMENTS ============ */}
      {tab === "placements" && placeDoc && (
        <div className="m8-placements">
          <section className="m8-card" aria-label="Menu placements">
            <div className="m8-row-h">
              <div><h3 className="m8-h3">Menu Placements</h3><p className="m8-sub">Choose which menu appears in each website location. Publish to make a change live.</p></div>
              {placeDirty && <Pill tone="amber" dot>Unsaved</Pill>}
            </div>
            <table className="m8-table">
              <thead><tr><th>Location</th><th>Assigned menu</th><th>Status</th></tr></thead>
              <tbody>
                {LOCATIONS.map((loc) => {
                  const assigned = placeDoc[loc];
                  return (
                    <tr key={loc}>
                      <td><b>{LOC_LABEL[loc]}</b></td>
                      <td>
                        <select aria-label={`Menu for ${LOC_LABEL[loc]}`} value={assigned ?? ""} disabled={readOnly}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            const next: Placements = { ...placeDoc, [loc]: v };
                            if (v) for (const other of LOCATIONS) if (other !== loc && next[other] === v) next[other] = null;
                            setPlace(next);
                          }}>
                          <option value="">None</option>
                          {menus.map((x) => <option key={x.id} value={x.id}>{(mDraft[x.id]?.doc ?? x.draft).name}</option>)}
                        </select>
                      </td>
                      <td>{assigned && menus.some((x) => x.id === assigned) ? <Pill tone="green" dot>Active</Pill> : <Pill tone="grey">Not assigned</Pill>}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td><b>Mobile (auto)</b></td>
                  <td><span className="m8-muted">{placeDoc.header ? `${(mDraft[placeDoc.header]?.doc ?? menus.find((x) => x.id === placeDoc.header)?.draft)?.name ?? "—"} (generated)` : "Follows the Header menu"}</span></td>
                  <td><Pill tone="violet">Auto · responsive</Pill></td>
                </tr>
              </tbody>
            </table>
            <div className="m8-note"><Icon name="info" size={13} /> Mobile navigation is generated from the Header menu, using the mobile output set in Settings. You do not place it separately.</div>
          </section>
          <section className="m8-card" aria-label="Where menus are used">
            <h3 className="m8-h3">Used by</h3>
            <p className="m8-sub">A header or footer variant in Layouts &amp; Templates holds a reference to its menu.</p>
            <ul className="m8-usage">
              {menus.map((x) => <li key={x.id}><b>{(mDraft[x.id]?.doc ?? x.draft).name}</b><span>{menuChrome(x, data.regions)}</span></li>)}
            </ul>
          </section>
        </div>
      )}

      {/* ============ MEGA MENUS ============ */}
      {tab === "mega" && (
        <div className="m8-mega-tab">
          <section className="m8-card m8-col" aria-label="Mega menu panels">
            <h3 className="m8-h3">Mega Menus</h3>
            <p className="m8-sub">Reusable multi-column panels. Attach one to a top-level link.</p>
            <input className="m8-search" aria-label="Search mega menus" placeholder="Search mega menus…" value={mgQ} onChange={(e) => setMgQ(e.target.value)} />
            <ul className="m8-mega-list">
              {megas.filter((g) => (gDraft[g.id]?.doc ?? g.draft).name.toLowerCase().includes(mgQ.toLowerCase())).map((g) => {
                const used = megaUsage(siteId, g.id);
                return (
                  <li key={g.id}>
                    <button type="button" className={g.id === megaId ? "is-on" : ""} aria-current={g.id === megaId} onClick={() => setMegaId(g.id)}>
                      <b>{(gDraft[g.id]?.doc ?? g.draft).name}</b>
                      <span>{used.length ? `Used in: ${used.map((u) => u.menuName).join(", ")}` : "Not in use"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Btn className="m8-wide" icon="plus" disabled={readOnly} onClick={() => setModal({ kind: "create-mega" })}>Create Mega Menu</Btn>
          </section>
          <section className="m8-card m8-col-wide" aria-label="Mega panel editor">
            {(() => {
              const g = megas.find((x) => x.id === megaId);
              if (!g) return <EmptyState icon="columns" title="No mega menus yet" desc="Create one, then attach it to a top-level link in the Menu Builder." />;
              const gd = gDraft[g.id]?.doc ?? g.draft;
              const issues = checks.byMenu[`mega:${g.id}`] ?? [];
              const used = megaUsage(siteId, g.id);
              const published = !!g.live && !megaHasChanges(g);
              return (
                <>
                  <div className="m8-row-h">
                    <div>
                      <h3 className="m8-h3">{gd.name} <Pill tone={published ? "green" : "grey"} dot>{published ? "Published" : "Draft"}</Pill></h3>
                      <p className="m8-sub">{used.length ? `Attached to ${used.map((u) => u.menuName).join(", ")}` : "Not attached to any menu yet."}</p>
                    </div>
                    <Btn variant="danger" icon="trash" disabled={readOnly} onClick={() => setModal({ kind: "delete-mega", megaId: g.id })}>Delete</Btn>
                  </div>
                  <Field label="Name"><input aria-label="Mega panel name" value={gd.name} disabled={readOnly} onChange={(e) => setMegaDoc(g.id, { ...gd, name: e.target.value })} /></Field>
                  <MegaEditor idp="mega" doc={gd} pages={pages} disabled={readOnly} onChange={(nd) => setMegaDoc(g.id, nd)} />
                  {issues.length > 0 && <ul className="m8-issues">{issues.map((i) => <li key={i.id} className={i.severity}><Icon name="alert" size={12} /> {i.label}: {i.detail}</li>)}</ul>}
                  <h4 className="m8-h4">Preview</h4>
                  <div className="m8-canvas"><MegaPanelView mega={gd} pages={pages} tokens={themeFor(siteId).live.tokens} /></div>
                </>
              );
            })()}
          </section>
        </div>
      )}

      {/* ============ VERSION HISTORY ============ */}
      {tab === "history" && (
        <section className="m8-card" aria-label="Version history">
          <div className="m8-row-h">
            <div><h3 className="m8-h3">Version History ({data.versions.length})</h3><p className="m8-sub">Every publish is numbered. A rollback publishes an older version as a new one, so history is never rewritten.</p></div>
          </div>
          <table className="m8-table">
            <thead><tr><th>Version</th><th>Change summary</th><th>Published by</th><th>Date</th><th><span className="m8-sr">Actions</span></th></tr></thead>
            <tbody>
              {[...data.versions].sort((a, b) => b.v - a.v).map((v) => (
                <tr key={v.id}>
                  <td><b>v{v.v}</b> {v.v === liveVersion && <Pill tone="green" dot>Live</Pill>}</td>
                  <td>{v.summary}</td>
                  <td>{v.by}</td>
                  <td>{when(v.at)}</td>
                  <td className="m8-acts"><Btn variant="sm" icon="refresh" disabled={readOnly || v.v === liveVersion} onClick={() => setModal({ kind: "rollback", version: v })}>Roll back</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ============ SETTINGS ============ */}
      {tab === "settings" && m && d && (
        <div className="m8-settings">
          <section className="m8-card" aria-label="Menu details">
            <h3 className="m8-h3">Menu details</h3>
            <div className="m8-form">
              <Field label="Name"><input aria-label="Menu name" value={d.name} disabled={readOnly} onChange={(e) => patchDoc((x) => ({ ...x, name: e.target.value }))} /></Field>
              <Field label="Description"><input aria-label="Menu description" value={d.description} disabled={readOnly} onChange={(e) => patchDoc((x) => ({ ...x, description: e.target.value }))} /></Field>
            </div>
          </section>
          <section className="m8-card" aria-label="Mobile output">
            <h3 className="m8-h3">Mobile output</h3>
            <p className="m8-sub">When this menu is placed in the header, the mobile menu is generated from it.</p>
            <div className="m8-form">
              <Field label="Mobile style">
                <select aria-label="Mobile style" value={d.mobile.behaviour} disabled={readOnly} onChange={(e) => patchDoc((x) => ({ ...x, mobile: { ...x.mobile, behaviour: e.target.value as "drawer" | "accordion" } }))}>
                  <option value="drawer">Drawer (slides in)</option><option value="accordion">Accordion (in place)</option>
                </select>
              </Field>
              <Switch checked={d.mobile.openFirstLevel} label="Open the first level by default" onChange={(v) => patchDoc((x) => ({ ...x, mobile: { ...x.mobile, openFirstLevel: v } }))} />
            </div>
          </section>
          <section className="m8-card" aria-label="Limits">
            <h3 className="m8-h3">Limits</h3>
            <ul className="m8-limits">
              <li>{MENU_LIMITS.maxDepth} levels deep at most</li>
              <li>{MENU_LIMITS.maxTop} top-level links at most</li>
              <li>{MENU_LIMITS.maxColumns} columns per mega panel, {MENU_LIMITS.maxLinksPerColumn} links per column</li>
              <li>Labels up to {MENU_LIMITS.maxLabel} characters</li>
            </ul>
          </section>
          <section className="m8-card m8-danger-card" aria-label="Delete menu">
            <h3 className="m8-h3">Delete menu</h3>
            <p className="m8-sub">Removes the menu and its links. A menu placed on the site, or applied to a header or footer, cannot be deleted.</p>
            <Btn variant="danger" icon="trash" disabled={readOnly || !!usedIn(m.id) || !!m.appliedTo} onClick={() => setModal({ kind: "delete-menu" })}>Delete {d.name}</Btn>
          </section>
        </div>
      )}

      {/* ============ MODALS ============ */}
      {modal?.kind === "create-menu" && <CreateMenuModal name={newName} desc={newDesc} setName={setNewName} setDesc={setNewDesc} onClose={() => setModal(null)} onCreate={async () => {
        try { const x = await MenusAPI.createMenu(siteId, newName.trim() || "Untitled menu", newDesc.trim()); setNewName(""); setNewDesc(""); setModal(null); setMenuId(x.id); setItemId(null); setTab("builder"); setTick((t) => t + 1); app.toast({ type: "success", title: `${x.draft.name} created`, sub: "Add links, then publish." }); } catch (e) { toastErr(e, "Could not create menu"); }
      }} />}
      {modal?.kind === "create-mega" && <CreateMegaModal onClose={() => setModal(null)} onCreate={async (name) => {
        try { const g = await MenusAPI.createMega(siteId, name); setModal(null); setMegaId(g.id); setTab("mega"); setTick((t) => t + 1); app.toast({ type: "success", title: `${name} created`, sub: "Add columns and links, then attach it to a menu item." }); } catch (e) { toastErr(e, "Could not create panel"); }
      }} />}
      {modal?.kind === "delete-mega" && (() => {
        const g = megas.find((x) => x.id === modal.megaId);
        const used = megaUsage(siteId, modal.megaId);
        return (
          <Modal title={`Delete ${g ? (gDraft[g.id]?.doc ?? g.draft).name : "panel"}?`} icon="trash" onClose={() => setModal(null)}
            footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" disabled={used.length > 0 || busy} onClick={async () => { try { await MenusAPI.deleteMega(modal.megaId); setModal(null); setTick((t) => t + 1); app.toast({ type: "success", title: "Mega panel deleted" }); } catch (e) { toastErr(e, "Could not delete"); } }}>Delete panel</Btn></>}>
            {used.length > 0 ? <p>This panel is attached to <b>{used.map((u) => u.menuName).join(", ")}</b>. Detach it from those items first.</p> : <p>This panel is not attached to any menu. Deleting it cannot be undone.</p>}
          </Modal>
        );
      })()}
      {modal?.kind === "delete-menu" && m && (
        <Modal title={`Delete ${d?.name ?? "menu"}?`} icon="trash" onClose={() => setModal(null)}
          footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="danger" disabled={busy || !!usedIn(m.id) || !!m.appliedTo} onClick={async () => { try { await MenusAPI.deleteMenu(m.id); setModal(null); setMenuId(null); setTick((t) => t + 1); app.toast({ type: "success", title: "Menu deleted" }); } catch (e) { toastErr(e, "Could not delete"); } }}>Delete menu</Btn></>}>
          <p>Removes the menu and its links. This cannot be undone.</p>
          {(usedIn(m.id) || m.appliedTo) && <p className="m8-err-text"><Icon name="alert" size={12} /> {usedIn(m.id) ? `It is placed on ${LOC_LABEL[usedIn(m.id)!]}. ` : ""}{m.appliedTo ? `It is applied to ${m.appliedTo.variantName}. ` : ""}Move or remove those first.</p>}
        </Modal>
      )}
      {modal?.kind === "changes" && (
        <Modal title="Publish changes" sub={`${draftCount} change${draftCount === 1 ? "" : "s"} go live on ${siteName}. Visitors see them once published.`} icon="rocket" width="narrow" onClose={() => setModal(null)}
          footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="rocket" disabled={busy || checks.errors > 0 || draftCount === 0} loading={busy} onClick={() => void publish()}>Publish {draftCount} change{draftCount === 1 ? "" : "s"}</Btn></>}>
          {checks.errors > 0 && <p className="m8-err-text"><Icon name="alert" size={12} /> {checks.errors} error{checks.errors === 1 ? "" : "s"} block publishing. Fix them first.</p>}
          {checks.warns > 0 && <p className="m8-hint">{checks.warns} warning{checks.warns === 1 ? "" : "s"} will publish as they are.</p>}
          <ul className="m8-changes">
            {changes.map((c, i) => <li key={i}><Pill tone="grey">{c.kind}</Pill><b>{c.name}</b><span>{c.detail}</span></li>)}
            {changes.length === 0 && <li className="m8-muted">Nothing to publish. Live matches the drafts.</li>}
          </ul>
        </Modal>
      )}
      {modal?.kind === "validate" && (
        <Modal title="Validate links" sub={`${checks.errors} error${checks.errors === 1 ? "" : "s"}, ${checks.warns} warning${checks.warns === 1 ? "" : "s"} across ${menus.length} menus and ${megas.length} mega panels.`} icon="link" width="wide" onClose={() => setModal(null)}
          footer={<Btn onClick={() => setModal(null)}>Close</Btn>}>
          {checks.all.length === 0 && <p className="m8-ok"><Icon name="check" size={13} /> Every link resolves to a live page or a valid address.</p>}
          <ul className="m8-issues">
            {checks.all.map((i) => (
              <li key={`${i.id}-${i.menuId ?? ""}`} className={i.severity}>
                <Icon name="alert" size={12} /> <b>{i.label}</b> — {i.detail}
                {i.menuId && i.itemId && <button type="button" className="m8-link-btn" onClick={() => { setMenuId(i.menuId!); setItemId(i.itemId!); setTab("builder"); setModal(null); }}>Show</button>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {modal?.kind === "rollback" && (
        <Modal title={`Roll back to v${modal.version.v}?`} sub="The drafts take that version's content and publish it as a new version." icon="refresh" onClose={() => setModal(null)}
          footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={() => void rollback(modal.version)}>Roll back and publish</Btn></>}>
          <p>{modal.version.summary}</p>
          <p className="m8-hint">Unsaved drafts are replaced. History is kept, and the rollback is recorded as its own version.</p>
        </Modal>
      )}
      {modal?.kind === "apply" && m && (
        <Modal title={`Apply ${d?.name ?? "menu"} to the ${modal.loc}`} sub="Writes the live menu into the variant you choose. Layouts that use it change when you publish them." icon="layers" width="wide" onClose={() => setModal(null)}
          footer={<Btn onClick={() => setModal(null)}>Close</Btn>}>
          <ApplyList menu={m} loc={modal.loc} regions={data.regions} busy={busy} onApply={(vid, rid) => void applyTo(modal.loc, vid, rid)} />
        </Modal>
      )}
    </div>
  );
}
