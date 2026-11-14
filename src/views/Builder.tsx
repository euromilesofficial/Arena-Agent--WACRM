/* ============================================================
   Module 4 — Visual Builder
   ------------------------------------------------------------
   One screen: library · canvas · inspector. Every edit is a typed
   transform of the document; persistence is a 2 s debounced save
   with revision CAS. Publish hands off to the release pipeline.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Tip } from "@/components/ui";
import { Canvas, DEVICE_W, type Device, type DropTarget } from "@/components/builder/Canvas";
import { Library, type LibTab } from "@/components/builder/Library";
import { Inspector, type InspTab } from "@/components/builder/Inspector";
import {
  BlocksPreview, ConflictModal, LeaveWithUnsaved, LinkPicker, MediaPicker, PublishModal,
  RevisionsModal, SaveTemplateModal, TemplateUseModal
} from "@/components/builder/BuilderModals";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { takeHandoff } from "@/lib/builder-handoff";
import type { CmsPage } from "@/lib/cms-pages";
import { BuilderAPI, PAGE_TOO_LARGE, streamCopy } from "@/lib/builder-db";
import {
  canNest, docIssues, duplicateNode, findNode, insertNode, labelOf, moveNode,
  PAGE_TEMPLATES, removeNode, replaceNode, SECTION_PRESETS,
  type BlockDef, type BlockNode, type PageTemplate, type SectionPreset
} from "@/lib/builder";

type Hash = { site: string | null; page: string | null; sel: string | null; lib: LibTab; insp: InspTab };

function readHash(): Hash {
  const raw = typeof location === "undefined" ? "" : location.hash.replace(/^#\/?/, "");
  const [, qs] = raw.split("?");
  const q = new URLSearchParams(qs ?? "");
  const lib = q.get("lib");
  const insp = q.get("insp");
  return {
    site: q.get("site"),
    page: q.get("page"),
    sel: q.get("sel"),
    lib: lib === "sections" || lib === "pages" ? lib : "blocks",
    insp: insp === "style" || insp === "advanced" ? insp : "content"
  };
}

export function Builder() {
  const app = useApp();
  const initial = useRef(readHash()).current;
  const handoff = useRef(takeHandoff()).current;

  /* ---------- page + site context ---------- */
  const sites = app.data?.sites ?? [];
  const [siteId, setSiteId] = useState<string>(initial.site ?? (app.siteId !== "all" ? app.siteId : "site_main"));
  const [pageId, setPageId] = useState<string | null>(initial.page ?? handoff);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [missing, setMissing] = useState<string | null>(null);

  const loadPages = useCallback(async (site: string) => {
    setPagesLoading(true);
    await new Promise((r) => setTimeout(r, 180));
    const list = DBX().cmsPages.filter((p) => p.siteId === site && !p.trash);
    setPages(list);
    setPagesLoading(false);
    return list;
  }, []);

  useEffect(() => {
    void loadPages(siteId).then((list) => {
      setPageId((cur) => {
        if (cur && list.some((p) => p.id === cur)) { setMissing(null); return cur; }
        /* an explicitly requested page that is not in the list is reported, not
           silently swapped for another page */
        if (cur && list.length) { setMissing(cur); return cur; }
        return list[0]?.id ?? null;
      });
    });
    /* eslint-disable-next-line */
  }, [siteId]);

  const page = pages.find((p) => p.id === pageId) ?? null;

  /* ---------- document ---------- */
  const [doc, setDoc] = useState<BlockNode[]>([]);
  const [rev, setRev] = useState(0);
  const docRef = useRef<BlockNode[]>([]);
  docRef.current = doc;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ latest: number; mine: number } | null>(null);
  const [past, setPast] = useState<BlockNode[][]>([]);
  const [future, setFuture] = useState<BlockNode[][]>([]);
  const co = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const editCount = useRef(0);

  const loadDraft = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await BuilderAPI.getDraft(id);
      setDoc(d.blocks);
      setSelId((cur) => (cur && d.blocks.some((b) => b.id === cur) ? cur : d.blocks[0]?.id ?? null));
      setRev(d.revision);
      setSavedAt(d.savedAt);
      setDirty(false);
      setSaveError(null);
      setPast([]);
      setFuture([]);
      editCount.current = 0;
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pageId) { setDoc([]); setLoading(false); return; }
    /* an empty demo state has to look like an empty page, not a broken one */
    if (app.demo === "empty") { setDoc([]); setRev(1); setSavedAt(Date.now()); setLoading(false); setDirty(false); return; }
    void loadDraft(pageId);
    /* eslint-disable-next-line */
  }, [pageId, app.demo]);

  useEffect(() => {
    BuilderAPI.mode.fail = app.demo === "error";
    BuilderAPI.mode.conflict = app.demo === "conflict";
    BuilderAPI.mode.aiError = app.demo === "error";
  }, [app.demo]);

  /* ---------- selection + ui ---------- */
  const [selId, setSelId] = useState<string | null>(initial.sel);
  const [selEl, setSelEl] = useState<string | null>(null);
  const [libTab, setLibTab] = useState<LibTab>(initial.lib);
  const [inspTab, setInspTab] = useState<InspTab>(initial.insp);
  const [chip, setChip] = useState<"All" | "Content" | "Media" | "Layout" | "Form">("All");
  const [sectionCat, setSectionCat] = useState("All");
  const [query, setQuery] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [focus, setFocus] = useState(false);
  const [libOpen, setLibOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);

  const stageWrap = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(700);
  useEffect(() => {
    const el = stageWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, [focus, libOpen, inspOpen, loading]);
  /* the stage sits inside a padded, scrolling wrap: subtract both insets */
  const fitScale = Math.max(0.2, Math.min(1, (stageW - 34) / DEVICE_W[device]));

  /* ---------- overlays ---------- */
  type Overlay =
    | { k: "none" }
    | { k: "link"; nodeId: string; field: string; value: any }
    | { k: "media"; nodeId: string; field: string }
    | { k: "preview"; title: string; sub: string; blocks: BlockNode[] }
    | { k: "revisions" }
    | { k: "publish" }
    | { k: "template"; tpl: PageTemplate }
    | { k: "saveTemplate" }
    | { k: "leave"; count: number };
  const [overlay, setOverlay] = useState<Overlay>({ k: "none" });
  const [busy, setBusy] = useState(false);

  /* ---------- history ---------- */
  const commit = useCallback((next: BlockNode[], key?: string) => {
    const now = Date.now();
    const merge = !!key && key === co.current.key && now - co.current.at < 900;
    if (!merge) {
      const prev = docRef.current;
      setPast((p) => [...p.slice(-49), prev]);
      setFuture([]);
    }
    co.current = { key: key ?? "", at: now };
    editCount.current += 1;
    setDoc(next);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [docRef.current, ...f].slice(0, 50));
      setDoc(prev);
      setDirty(true);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setPast((p) => [...p.slice(-49), docRef.current]);
      setDoc(next);
      setDirty(true);
      return f.slice(1);
    });
  }, []);

  /* ---------- save ---------- */
  const saveNow = useCallback(async () => {
    if (!pageId) return;
    const snapshot = docRef.current;
    if (!snapshot.length && app.demo === "empty") return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await BuilderAPI.saveDraft(pageId, snapshot, rev);
      setRev(r.revision);
      setSavedAt(r.savedAt);
      if (docRef.current === snapshot) setDirty(false);
      editCount.current = 0;
      void loadPages(siteId);
      if (snapshot.length > PAGE_LIMIT) BuilderAPI.snapshot(pageId, snapshot);
    } catch (e) {
      const err = e as { code?: string; message: string; latest?: number };
      if (err.code === "CONFLICT") setConflict({ latest: err.latest ?? rev + 1, mine: rev });
      else setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [pageId, rev, siteId, loadPages, app.demo]);

  useEffect(() => {
    if (!dirty || loading || conflict) return;
    const t = window.setTimeout(() => { void saveNow(); }, 2000);
    return () => window.clearTimeout(t);
  }, [doc, dirty, loading, conflict, saveNow]);

  /* snapshot on idle — the spec's cadence, now defined */
  useEffect(() => {
    if (!pageId || !dirty || saving) return;
    const t = window.setTimeout(() => { if (docRef.current.length) BuilderAPI.snapshot(pageId, docRef.current); }, 60000);
    return () => window.clearTimeout(t);
  }, [doc, dirty, saving, pageId]);

  useEffect(() => {
    if (saveError && editCount.current > 0) setOverlay({ k: "leave", count: editCount.current });
    /* eslint-disable-next-line */
  }, [saveError]);

  /* ---------- routing ---------- */
  const writeHash = useCallback(() => {
    if (typeof location === "undefined") return;
    const q = new URLSearchParams();
    if (siteId !== "site_main") q.set("site", siteId);
    if (pageId) q.set("page", pageId);
    if (selId) q.set("sel", selId);
    if (libTab !== "blocks") q.set("lib", libTab);
    if (inspTab !== "content") q.set("insp", inspTab);
    const qs = q.toString();
    const next = `#/builder${qs ? `?${qs}` : ""}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }, [siteId, pageId, selId, libTab, inspTab]);

  useEffect(() => { writeHash(); }, [writeHash]);
  /* the store rewrites `#/<screen>` from its own filters after the child effects
     have run; re-assert the builder's parameters once so `page=` survives */
  useEffect(() => {
    const t = window.setTimeout(writeHash, 220);
    return () => window.clearTimeout(t);
  }, [writeHash]);

  /* ---------- AI ---------- */
  const [ai, setAi] = useState<{ stage: "idle" | "streaming" | "ready" | "error"; text: string; message?: string } | null>(null);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const aiHandle = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); void saveNow(); }
      else if (e.key === "Escape") {
        /* never swallow Escape while a dialog or popover owns it — state churn here
           re-registers the dialog's own listener mid-dispatch and it never fires */
        if (document.querySelector(".overlay, .modal, .drawer, .wb-pub-menu")) return;
        if (ai) { aiHandle.current?.cancel(); setAi(null); setSelEl(null); }
        else if (selEl) setSelEl("");
        else if (selId) setSelId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    /* eslint-disable-next-line */
  }, [undo, redo, saveNow, ai, selEl, selId]);

  const askAi = useCallback((action: string) => {
    if (!selId || !selEl) return;
    const node = findNode(docRef.current, selId);
    const src = String(node?.props?.[selEl] ?? "");
    if (!src.trim()) { setAi({ stage: "error", text: "", message: "There is no text to rewrite here." }); return; }
    aiHandle.current?.cancel();
    setAiAction(action);
    setAi({ stage: "streaming", text: "" });
    const h = streamCopy(src, action as any,
      (t) => setAi({ stage: "streaming", text: t }),
      (final) => setAi({ stage: "ready", text: final }),
      (msg) => setAi({ stage: "error", text: "", message: msg }));
    aiHandle.current = h;
  }, [selId, selEl]);

  const acceptAi = useCallback(() => {
    if (!selId || !selEl || !ai || ai.stage !== "ready") return;
    commit(replaceNode(docRef.current, selId, (n) => ({ ...n, props: { ...n.props, [selEl]: ai.text } })));
    setAi(null);
    setSelEl(null);
    app.toast({ type: "success", title: "Copy accepted", sub: `${labelOf(findNode(docRef.current, selId)!)} · ⌘Z to undo` });
  }, [selId, selEl, ai, commit, app]);

  /* ---------- tree operations ---------- */
  const addBlock = useCallback((def: BlockDef, variant?: string, at?: { parentId: string | null; index: number }) => {
    if (docRef.current.length >= PAGE_LIMIT) { app.toast({ type: "warn", title: "Page is at the block limit", sub: PAGE_TOO_LARGE }); return; }
    const node = def.defaults();
    if (variant) node.variant = variant;
    /* click-insert lands after the selected section; drag-insert lands where it was dropped */
    const i = selId ? docRef.current.findIndex((n) => n.id === selId) : -1;
    const target = at ?? { parentId: null, index: i > -1 ? i + 1 : docRef.current.length };
    commit(insertNode(docRef.current, node, target));
    setSelId(node.id);
    setInspTab("content");
    app.toast({ type: "success", title: `${def.label} added`, sub: "Content and style are in the inspector." });
  }, [commit, selId, app]);

  const addSection = useCallback((preset: SectionPreset, at?: { parentId: string | null; index: number }) => {
    const blocks = preset.build();
    if (docRef.current.length + blocks.length > 40) { app.toast({ type: "warn", title: "Page is at the block limit", sub: PAGE_TOO_LARGE }); return; }
    const start = at ?? { parentId: null, index: selId ? docRef.current.findIndex((n) => n.id === selId) + 1 : docRef.current.length };
    let next = docRef.current;
    blocks.forEach((b, k) => { next = insertNode(next, b, { parentId: start.parentId, index: start.index + k }); });
    commit(next);
    setSelId(blocks[0]?.id ?? null);
    app.toast({ type: "success", title: `${preset.name} inserted`, sub: `${blocks.length} block${blocks.length === 1 ? "" : "s"} · autosaving` });
  }, [commit, selId, app]);

  const useTemplate = useCallback((tpl: PageTemplate, formId?: string, removeForm?: boolean) => {
    let blocks = tpl.build();
    if (removeForm) blocks = blocks.filter((b) => b.type !== "form");
    else if (formId) blocks = blocks.map((b) => (b.type === "form" ? { ...b, props: { ...b.props, formId } } : b));
    commit(blocks);
    setSelId(null);
    setOverlay({ k: "none" });
    app.toast({ type: "success", title: `${tpl.name} applied`, sub: `${blocks.length} sections · previous version is in revision history` });
  }, [commit, app]);

  const patch = useCallback((id: string, props: Record<string, any>) => {
    commit(replaceNode(docRef.current, id, (n) => ({ ...n, props: { ...n.props, ...props } })), `${id}:${Object.keys(props).join(",")}`);
  }, [commit]);

  const patchStyle = useCallback((id: string, style: Record<string, any>) => {
    commit(replaceNode(docRef.current, id, (n) => ({ ...n, style: { ...n.style, ...style } })), `${id}:s:${Object.keys(style).join(",")}`);
  }, [commit]);

  const resetStyle = useCallback((id: string, key: string) => {
    commit(replaceNode(docRef.current, id, (n) => {
      const s = { ...n.style };
      delete s[key];
      return { ...n, style: s };
    }));
  }, [commit]);

  const del = useCallback((id: string) => {
    const node = findNode(docRef.current, id);
    commit(removeNode(docRef.current, id));
    if (selId === id) { setSelId(null); setSelEl(null); }
    app.toast({ type: "success", title: `${node ? labelOf(node) : "Block"} deleted`, sub: "⌘Z or Undo in the toolbar restores it", action: { label: "Undo", onClick: undo } });
  }, [commit, selId, app, undo]);

  const dup = useCallback((id: string) => {
    commit(duplicateNode(docRef.current, id));
    app.toast({ type: "success", title: "Block duplicated" });
  }, [commit, app]);

  const move = useCallback((id: string, dir: -1 | 1) => {
    const i = docRef.current.findIndex((n) => n.id === id);
    if (i < 0) {
      const parent = findByParent(docRef.current, id);
      if (!parent) return;
      const kids = parent.children ?? [];
      const k = kids.findIndex((c) => c.id === id);
      const to = k + dir;
      if (to < 0 || to >= kids.length) return;
      commit(moveNode(docRef.current, id, { parentId: parent.id, index: dir > 0 ? to + 1 : to }));
      return;
    }
    const to = i + dir;
    if (to < 0 || to >= docRef.current.length) return;
    /* moveNode works in insertion coordinates over the array *without* the node */
    commit(moveNode(docRef.current, id, { parentId: null, index: dir > 0 ? to + 1 : to }));
  }, [commit]);

  /* ---------- drag ---------- */
  const [drag, setDrag] = useState<{ label: string; def?: BlockDef; preset?: SectionPreset; id?: string } | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const dragRef = useRef<{ x: number; y: number; payload: typeof drag; active: boolean }>({ x: 0, y: 0, payload: null, active: false });
  const ghost = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.PointerEvent, payload: { label: string; def?: BlockDef; preset?: SectionPreset; id?: string }) => {
    if (app.role === "Viewer") return;
    dragRef.current = { x: e.clientX, y: e.clientY, payload, active: false };
    const lastX = { current: e.clientX };
    const lastY = { current: e.clientY };
    const track = (ev: PointerEvent) => { lastX.current = ev.clientX; lastY.current = ev.clientY; };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d.payload) return;
      if (!d.active && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 5) {
        d.active = true;
        setDrag(d.payload);
      }
      if (!d.active) return;
      if (ghost.current) ghost.current.style.transform = `translate3d(${ev.clientX + 12}px, ${ev.clientY + 10}px, 0)`;
      setDrop(computeDrop(ev.clientX, ev.clientY, d.payload, docRef.current));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      if (d.active && d.payload) {
        const target = computeDrop(lastX.current, lastY.current, d.payload, docRef.current);
        if (target?.valid) {
          if (d.payload.def) addBlock(d.payload.def, undefined, target);
          else if (d.payload.preset) addSection(d.payload.preset, target);
          else if (d.payload.id) commit(moveNode(docRef.current, d.payload.id, target));
        } else if (target && !target.valid) {
          app.toast({ type: "warn", title: "That drop is not allowed", sub: target.reason ?? "Layout blocks nest one level deep." });
        }
      }
      setDrag(null);
      setDrop(null);
      dragRef.current = { x: 0, y: 0, payload: null, active: false };
    };
    window.addEventListener("pointermove", track);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }, [addBlock, addSection, commit, app]);

  /* ---------- publish ---------- */
  const issues = useMemo(() => docIssues(doc, pages, BuilderAPI.assets(siteId)), [doc, pages, siteId]);
  const canPublish = app.can("publish");
  const [publishBusy, setPublishBusy] = useState(false);

  const doPublish = async () => {
    setPublishBusy(true);
    const res = await app.publishRelease();
    setPublishBusy(false);
    if (res.ok) {
      BuilderAPI.afterPublish(siteId, pageId ?? "");
      setOverlay({ k: "none" });
      void loadPages(siteId);
      app.openModal({ kind: "published", version: res.version ?? "v1.25", site: siteName });
    } else {
      setOverlay({ k: "none" });
    }
  };

  /* ---------- derived ---------- */
  const siteName = sites.find((s) => s.id === siteId)?.name ?? "EuroMiles Main";
  const selNode = selId ? findNode(doc, selId) : null;
  const selIndex = selId ? doc.findIndex((n) => n.id === selId) : -1;
  const templatesExtra = useRef<PageTemplate[]>([]);
  const [, forceTpl] = useState(0);

  /* prototype hook: the QA harness and the console can force service modes */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wacrmBuilder = BuilderAPI;
  }, []);

  const status = saveError ? "failed" : conflict ? "conflict" : saving ? "saving" : dirty ? "dirty" : "saved";
  const readOnly = app.role === "Viewer";

  if (pagesLoading && !pages.length) return <div className="wb-root"><BuilderSkeleton /></div>;

  if (missing || !pageId || (!page && !pagesLoading)) {
    return (
      <div className="wb-root">
        <div className="wb-blocked">
          <div className="wb-blocked-ico"><Icon name="file" size={20} /></div>
          <h2>This page is not here</h2>
          <p>The page this link points to was deleted, moved, or belongs to another website. Nothing was lost — drafts are kept with the page record.</p>
          <div className="flex gap8">
            <Btn onClick={() => app.go("pages")} icon="arrowLeft">Back to Pages</Btn>
            <Btn variant="primary" onClick={() => { const first = pages[0]; if (first) { setMissing(null); setPageId(first.id); } }} disabled={!pages.length}>Open {pages[0]?.title ?? "another page"}</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wb-root ${focus ? "is-focus" : ""}`} data-screen="builder">
      {/* ---------------- header ---------------- */}
      <header className="wb-head">
        <div className="wb-head-l">
          <h1 className="wb-title">Visual Builder</h1>
          <p className="wb-subtitle">Build and edit your website using the native block-based editor.</p>
        </div>
        <div className="wb-head-r">
          <label className="wb-pick">
            <span>Website:</span>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Website">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="wb-pick">
            <span>Page:</span>
            <select value={pageId ?? ""} onChange={(e) => { setMissing(null); setPageId(e.target.value); }} aria-label="Page">
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <Btn icon="eye" onClick={() => setOverlay({ k: "preview", title: `${page?.title ?? "Page"} · draft preview`, sub: "Signed, expiring, never routable", blocks: doc })}>Preview</Btn>
          <div className="wb-publish">
            <button className="wb-pub-btn" disabled={readOnly} onClick={() => setOverlay({ k: "publish" })} data-act="open-publish">
              <Icon name="upload" size={14} /> Publish
            </button>
            <PublishMenu
              disabled={readOnly}
              onReview={() => setOverlay({ k: "publish" })}
              onCompare={() => setOverlay({ k: "preview", title: "Compare with live", sub: `${siteName} · live release vs this draft`, blocks: doc })}
              onHistory={() => setOverlay({ k: "revisions" })} />
          </div>
        </div>
      </header>

      <div className="wb-main">
        {/* ---------------- library ---------------- */}
        {libOpen && !focus && (
          <Library
            tab={libTab} setTab={setLibTab}
            chip={chip} setChip={setChip}
            sectionCat={sectionCat} setSectionCat={setSectionCat}
            query={query} setQuery={setQuery}
            loading={loading}
            doc={doc} selId={selId}
            onSelect={(id) => { setSelId(id); setSelEl(null); scrollToBlock(id); }}
            onInsertBlock={(d) => addBlock(d)}
            onInsertSection={(s) => addSection(s)}
            onUseTemplate={(t) => setOverlay({ k: "template", tpl: t })}
            onPreview={(kind, id) => {
              if (kind === "section") {
                const s = SECTION_PRESETS_FIND(id);
                if (s) setOverlay({ k: "preview", title: s.name, sub: `${s.category} section · ${s.build().length} blocks`, blocks: s.build() });
              } else {
                const t = [...PAGE_TEMPLATES, ...templatesExtra.current].find((x) => x.id === id);
                if (t) setOverlay({ k: "preview", title: t.name, sub: `${t.intent} · ${t.sections} sections`, blocks: t.build() });
              }
            }}
            onSaveTemplate={() => setOverlay({ k: "saveTemplate" })}
            onDragStart={startDrag}
            onMove={move}
            emptyLibrary={BuilderAPI.mode.emptyLibrary}
            templates={[...PAGE_TEMPLATES, ...templatesExtra.current]}
          />
        )}

        {/* ---------------- canvas column ---------------- */}
        <div className="wb-center">
          <div className="wb-cbar">
            <div className="wb-cbar-l">
              <button className="wb-focus-btn" onClick={() => { setLibOpen((v) => !v); }} aria-label={libOpen ? "Hide library" : "Show library"} title="Toggle library"><Icon name={libOpen ? "chevLeft" : "chevRight"} size={13} /></button>
              <StatusPill status={status} savedAt={savedAt} onRetry={() => void saveNow()} />
              <Tip text="Anita N. is also editing this page — last seen 2 min ago">
                <span className="wb-presence"><i className="wb-presence-dot" /> Anita N.</span>
              </Tip>
            </div>
            <div className="wb-devices" role="group" aria-label="Viewport">
              {([["desktop", "Desktop 1440", "monitor"], ["tablet", "Tablet 768", "tablet"], ["mobile", "Mobile 375", "phone"]] as [Device, string, string][]).map(([d, label, icon]) => (
                <button key={d} className={`wb-dev ${device === d ? "is-on" : ""}`} aria-pressed={device === d} title={label}
                  aria-label={label} onClick={() => setDevice(d)}><Icon name={icon} size={14} /></button>
              ))}
            </div>
            <div className="wb-cbar-r">
              <button className="wb-toolbar-btn" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (⌘Z)"><Icon name="refresh" size={13} className="flip" /></button>
              <button className="wb-toolbar-btn" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (⌘⇧Z)"><Icon name="refresh" size={13} /></button>
              <label className="wb-zoom">
                <select value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))} aria-label="Zoom">
                  <option value="fit">Fit</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                  <option value="125">125%</option>
                </select>
              </label>
              <button className="wb-toolbar-btn" aria-label={focus ? "Exit focus mode" : "Focus mode"} title="Focus mode"
                onClick={() => setFocus((f) => !f)}><Icon name="external" size={13} /></button>
              <button className="wb-focus-btn" onClick={() => setInspOpen((v) => !v)} aria-label={inspOpen ? "Hide inspector" : "Show inspector"} title="Toggle inspector"><Icon name={inspOpen ? "chevRight" : "chevLeft"} size={13} /></button>
            </div>
          </div>

          <div className="wb-canvas-wrap" ref={stageWrap}>
            {loading && <CanvasSkeleton />}
            {!loading && loadError && (
              <div className="wb-canvas-state">
                <div className="wb-cs-ico"><Icon name="alert" size={18} /></div>
                <b>The draft could not be loaded</b>
                <span>{loadError}</span>
                <Btn icon="refresh" onClick={() => pageId && void loadDraft(pageId)}>Retry</Btn>
              </div>
            )}
            {!loading && !loadError && doc.length === 0 && (
              <div className="wb-empty-canvas" data-empty-canvas="1" data-slot-end="1">
                <div className="wb-cs-ico"><Icon name="blocks" size={18} /></div>
                <b>This page has no blocks yet</b>
                <span>Add your first block, or start from a section.</span>
                <div className="flex gap8">
                  <Btn variant="primary" icon="plus" onClick={() => { setLibTab("blocks"); setLibOpen(true); }}>Add your first block</Btn>
                  <Btn icon="layers" onClick={() => { setLibTab("sections"); setLibOpen(true); }}>Browse sections</Btn>
                  <Btn icon="file" onClick={() => { setLibTab("pages"); setLibOpen(true); }}>Use a template</Btn>
                </div>
              </div>
            )}
            {!loading && !loadError && doc.length > 0 && (
              <Canvas doc={doc} ctl={{
                selId, selEl, device, zoom, scale: fitScale,
                drop,
                ai,
                aiAction,
                onSelect: (id) => { setSelId(id); if (!id) setSelEl(null); setAi(null); },
                onSelectEl: (id, el) => { setSelId(id); setSelEl(el); setAi({ stage: "idle", text: "" }); },
                onAskAi: askAi,
                onAiClose: () => { aiHandle.current?.cancel(); setAi(null); setSelEl(null); },
                onAcceptAi: acceptAi,
                onToolbar: (action, id, e) => {
                  if (action === "drag") {
                    const n = findNode(doc, id);
                    if (e && n) startDrag(e as React.PointerEvent, { label: labelOf(n), id });
                  }
                  else if (action === "settings") { setSelId(id); setInspTab("advanced"); setInspOpen(true); }
                  else if (action === "duplicate") dup(id);
                  else if (action === "delete") del(id);
                },
                onEditMaster: () => app.toast({ type: "info", title: "Master layout", sub: "Headers and footers are edited in Layouts & Templates." })
              }} />
            )}
            {drag && <div className="wb-ghost" ref={ghost}><Icon name="blocks" size={12} /> {drag.label}</div>}
          </div>
        </div>

        {/* ---------------- inspector ---------------- */}
        {inspOpen && !focus && (
          <Inspector
            node={selNode} tab={inspTab} setTab={setInspTab}
            index={selIndex} total={doc.length}
            assets={BuilderAPI.assets(siteId)}
            forms={BuilderAPI.forms(siteId)}
            siteId={siteId}
            readOnly={readOnly}
            onPatch={patch}
            onPatchStyle={patchStyle}
            onResetStyle={resetStyle}
            onOpenLink={(id, field, value) => setOverlay({ k: "link", nodeId: id, field, value })}
            onOpenMedia={(id, field) => setOverlay({ k: "media", nodeId: id, field })}
            onDelete={del} onDuplicate={dup} onMove={move}
            onSelect={setSelId}
            pageTitle={page?.title ?? ""} pagePath={page?.path ?? ""} pageTemplate={page?.template ?? ""}
            onOpenStructure={() => { setLibTab("pages"); setLibOpen(true); }}
          />
        )}
      </div>

      {readOnly && (
        <div className="wb-readonly"><Icon name="lock" size={12} /> View-only — your role cannot edit or publish this website.</div>
      )}

      {/* ---------------- overlays ---------------- */}
      {overlay.k === "link" && (
        <LinkPicker nodeField={overlay.field} value={overlay.value} pages={pages} siteId={siteId}
          onClose={() => setOverlay({ k: "none" })}
          onPick={(v) => { patch(overlay.nodeId, { [overlay.field]: v }); setOverlay({ k: "none" }); }} />
      )}
      {overlay.k === "media" && (
        <MediaPicker assets={BuilderAPI.assets(siteId)} value={findNode(doc, overlay.nodeId)?.props?.[overlay.field] ?? ""}
          onClose={() => setOverlay({ k: "none" })}
          onPick={(id) => { patch(overlay.nodeId, { [overlay.field]: id }); setOverlay({ k: "none" }); }}
          onDelete={(id) => BuilderAPI.deleteAsset(id)} />
      )}
      {overlay.k === "preview" && (
        <BlocksPreview title={overlay.title} sub={overlay.sub} blocks={overlay.blocks} onClose={() => setOverlay({ k: "none" })} />
      )}
      {overlay.k === "revisions" && (
        <RevisionsModal revisions={BuilderAPI.listRevisions(pageId!)} current={rev} busy={busy}
          onClose={() => setOverlay({ k: "none" })}
          onRestore={async (r) => {
            setBusy(true);
            try {
              const res = await BuilderAPI.restoreRevision(pageId!, r);
              setDoc(res.blocks); setRev(res.revision); setDirty(false); setOverlay({ k: "none" });
              void loadPages(siteId);
              app.toast({ type: "success", title: `Restored r${r}`, sub: `Saved as r${res.revision} — nothing was overwritten` });
            } finally { setBusy(false); }
          }} />
      )}
      {overlay.k === "publish" && (
        <PublishModal pages={pages} siteName={siteName} pageTitle={page?.title ?? ""} issues={issues}
          dirty={dirty} saving={saving} busy={publishBusy} canPublish={canPublish}
          onSave={() => void saveNow()}
          onPublish={() => void doPublish()}
          onClose={() => setOverlay({ k: "none" })} />
      )}
      {overlay.k === "template" && (
        <TemplateUseModal name={overlay.tpl.name} forms={BuilderAPI.forms(siteId)}
          onClose={() => setOverlay({ k: "none" })}
          onUse={(mode, formId) => useTemplate(overlay.tpl, formId, mode === "remove")} />
      )}
      {overlay.k === "saveTemplate" && (
        <SaveTemplateModal count={doc.length} onClose={() => setOverlay({ k: "none" })}
          onSave={(name) => {
            const tpl: PageTemplate = {
              id: `tpl_user_${Date.now()}`, name, intent: "Saved page", desc: `${doc.length} sections · saved by you`, sections: doc.length,
              build: () => JSON.parse(JSON.stringify(doc))
            };
            templatesExtra.current = [tpl, ...templatesExtra.current];
            forceTpl((n) => n + 1);
            setOverlay({ k: "none" });
            setLibTab("pages");
            app.toast({ type: "success", title: "Template saved", sub: `${name} · visible in Pages` });
          }} />
      )}
      {overlay.k === "leave" && (
        <LeaveWithUnsaved count={overlay.count} onStay={() => setOverlay({ k: "none" })}
          onRetry={() => { setOverlay({ k: "none" }); void saveNow(); }}
          onLeave={() => { setOverlay({ k: "none" }); setDirty(false); setSaveError(null); app.go("pages"); }} />
      )}
      {conflict && (
        <ConflictModal latest={conflict.latest} mine={conflict.mine} busy={busy}
          onClose={() => setConflict(null)}
          onReload={async () => {
            setBusy(true);
            const d = await BuilderAPI.reloadDraft(pageId!);
            setDoc(d.blocks); setRev(d.revision); setDirty(false); setConflict(null); setBusy(false);
            app.toast({ type: "info", title: "Reloaded their copy", sub: `r${d.revision} · your unsaved edits were discarded` });
          }}
          onKeep={async () => {
            setBusy(true);
            const r = await BuilderAPI.forceSave(pageId!, docRef.current);
            setRev(r.revision); setDirty(false); setConflict(null); setBusy(false);
            void loadPages(siteId);
            app.toast({ type: "success", title: "Kept your copy", sub: `Saved as r${r.revision} on top of theirs` });
          }} />
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */
const PAGE_LIMIT = 40;

function findByParent(nodes: BlockNode[], id: string): BlockNode | null {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n;
    if (n.children) { const hit = findByParent(n.children, id); if (hit) return hit; }
  }
  return null;
}

function scrollToBlock(id: string) {
  window.setTimeout(() => {
    document.querySelector(`[data-slot="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 30);
}

function computeDrop(x: number, y: number, payload: { def?: BlockDef; preset?: SectionPreset; id?: string }, doc: BlockNode[]): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const probe = payload.def ? payload.def.defaults() : payload.preset ? payload.preset.build()[0] : payload.id ? findNode(doc, payload.id) : null;
  if (!probe) return null;

  const empty = el.closest("[data-empty-slot]") as HTMLElement | null;
  if (empty) {
    const parentId = (empty.getAttribute("data-empty-slot") ?? "").split(":")[0];
    const parent = findNode(doc, parentId);
    const reason = canNest(parent?.type ?? null, probe, doc, parentId);
    return { parentId, index: parent?.children?.length ?? 0, valid: !reason, reason: reason ?? undefined };
  }
  const end = el.closest("[data-slot-end]") as HTMLElement | null;
  if (end) return { parentId: null, index: doc.length, valid: true };

  const slot = el.closest("[data-slot]") as HTMLElement | null;
  if (!slot) return null;
  const id = slot.getAttribute("data-slot") ?? "";
  const i = doc.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const r = slot.getBoundingClientRect();
  const index = y < r.top + r.height / 2 ? i : i + 1;
  const reason = canNest(null, probe, doc, null);
  return { parentId: null, index, valid: !reason, reason: reason ?? undefined };
}

function StatusPill({ status, savedAt, onRetry }: { status: string; savedAt: number | null; onRetry: () => void }) {
  if (status === "failed")
    return <button className="wb-status is-failed" onClick={onRetry} data-status="failed"><Icon name="alert" size={11} /> Save failed · Retry</button>;
  if (status === "conflict")
    return <span className="wb-status is-conflict" data-status="conflict"><Icon name="alert" size={11} /> Conflict — resolve to continue</span>;
  if (status === "saving")
    return <span className="wb-status is-saving" data-status="saving"><i className="wb-spin" /> Saving…</span>;
  if (status === "dirty")
    return <span className="wb-status is-dirty" data-status="dirty"><i className="wb-dot-amber" /> Unsaved changes</span>;
  const when = savedAt ? new Date(savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  return <span className="wb-status is-saved" data-status="saved"><Icon name="check" size={11} /> Draft saved{when ? ` · ${when}` : ""}</span>;
}

function PublishMenu({ disabled, onReview, onCompare, onHistory }: { disabled: boolean; onReview: () => void; onCompare: () => void; onHistory: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="wb-pub-split">
      <button ref={ref} className="wb-pub-caret" aria-label="Publish options" aria-expanded={open} disabled={disabled}
        onClick={() => setOpen((v) => !v)}><Icon name="chevDown" size={12} /></button>
      {open && (
        <div className="wb-pub-menu" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onReview(); }}><Icon name="upload" size={12} /> Review &amp; publish…</button>
          <button role="menuitem" onClick={() => { setOpen(false); onCompare(); }}><Icon name="eye" size={12} /> Compare with live</button>
          <button role="menuitem" onClick={() => { setOpen(false); onHistory(); }}><Icon name="clock" size={12} /> Release &amp; revision history</button>
        </div>
      )}
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div className="wb-root">
      <header className="wb-head">
        <div className="wb-head-l">
          <div className="sk" style={{ width: 180, height: 26, borderRadius: 7 }} />
          <div className="sk mt8" style={{ width: 320, height: 12, borderRadius: 6 }} />
        </div>
        <div className="wb-head-r">
          <div className="sk" style={{ width: 190, height: 32, borderRadius: 8 }} />
          <div className="sk" style={{ width: 160, height: 32, borderRadius: 8 }} />
          <div className="sk" style={{ width: 210, height: 32, borderRadius: 8 }} />
        </div>
      </header>
      <div className="wb-main">
        <div className="wb-lib"><div className="wb-lib-skel" style={{ padding: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <div className="sk" key={i} style={{ height: 60, borderRadius: 10, marginBottom: 8 }} />)}
        </div></div>
        <div className="wb-center"><CanvasSkeleton /></div>
        <div className="wb-insp"><div style={{ padding: 12 }}>
          {[0, 1, 2, 3].map((i) => <div className="sk" key={i} style={{ height: 46, borderRadius: 9, marginBottom: 10 }} />)}
        </div></div>
      </div>
    </div>
  );
}

function CanvasSkeleton() {
  return (
    <div className="wb-canvas-state is-skel" aria-busy="true">
      <div className="sk" style={{ width: "72%", height: 78, borderRadius: 10 }} />
      <div className="sk" style={{ width: "54%", height: 16, borderRadius: 6 }} />
      <div className="sk" style={{ width: "62%", height: 16, borderRadius: 6 }} />
      <div className="sk" style={{ width: "100%", height: 120, borderRadius: 12 }} />
      <div className="sk" style={{ width: "40%", height: 16, borderRadius: 6 }} />
    </div>
  );
}

const SECTION_CACHE: Record<string, SectionPreset> = Object.fromEntries(SECTION_PRESETS.map((s) => [s.id, s]));
const SECTION_PRESETS_FIND = (id: string): SectionPreset | undefined => SECTION_CACHE[id];
