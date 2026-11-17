/* ============================================================
   Module 7 · Layouts & Templates (desktop)
   ------------------------------------------------------------
   Library · canvas · inspector, in the same grammar as the other
   modules. Everything the screen shows is derived from
   `layout-db.ts`, and every mutation goes through `LayoutsAPI`
   with a compare-and-swap revision — including bulk reassignment,
   which writes real `CmsPage.layout` values so Module 3 sees it.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, EmptyState, ErrorState, MenuItem, MenuLabel, Pill, Popover, Skel, Tip } from "@/components/ui";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { REGISTRY, type BlockType } from "@/lib/builder";
import { LayoutCanvas, type LayoutDevice } from "@/components/layouts/LayoutCanvas";
import {
  ArchiveModal, ConflictModal, CreateLayoutModal, CreatePageModal, CreateTemplateModal, LeaveModal,
  PolicyModal, PreflightModal, PreviewModal, ReassignModal, RegionDrawer, SeoModal, usageLabel
} from "@/components/layouts/LayoutModals";
import { ImportModal, PrebuiltModal, exportTemplate } from "@/components/layouts/ImportModals";
import { HistoryModal } from "@/components/layouts/HistoryModal";
import { BlockFields } from "@/components/layouts/BlockFields";
import { KIT_COUNT, PREBUILT_SOURCE } from "@/lib/prebuilt-db";
import {
  LayoutsAPI, frameOf, mode as LayoutsMode, usageRows,
  type LayoutDraft, type LayoutPayload, type PageTemplateDoc, type SharedRegion
} from "@/lib/layout-db";

type Status = "loading" | "ready" | "error";
type Tab = "layouts" | "templates";
type ITab = "overview" | "structure" | "usage";
type Sort = "recent" | "name" | "pages";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recently updated" },
  { id: "name", label: "Name (A → Z)" },
  { id: "pages", label: "Most pages" }
];

const KPIS: { id: string; label: string; icon: string; tone: string; tip: string }[] = [
  { id: "layouts", label: "Master Layouts", icon: "layers", tone: "violet", tip: "Live layouts owned by this site, excluding archived ones. Site-scoped layouts count only for the site that owns them." },
  { id: "templates", label: "Page Templates", icon: "file", tone: "blue", tip: "Starter compositions in the workspace. Copy-on-create — a template never edits a page that already exists." },
  { id: "pagesAssigned", label: "Pages Assigned", icon: "file", tone: "green", tip: "Pages whose layout string resolves to a live layout. Pages pointing at a deleted layout are counted as unassigned and shown in preflight." },
  { id: "draftChanges", label: "Draft Changes", icon: "refresh", tone: "amber", tip: "Layouts with unpublished edits plus templates created in this workspace that are not built in." }
];

function Kpi({ icon, tone, value, label, tip }: { icon: string; tone: string; value: number; label: string; tip: string }) {
  return (
    <Tip text={tip}>
      <div className="m7-kpi" tabIndex={0}>
        <div className={`m7-kpi-ico ${tone}`}><Icon name={icon} size={18} /></div>
        <div>
          <div className="m7-kpi-n">{value}</div>
          <div className="m7-kpi-l">{label}</div>
        </div>
      </div>
    </Tip>
  );
}

const ago = (iso: string) => {
  const d = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((Date.now() - d) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Parsed once, synchronously, before React mounts — the store rewrites the
    hash on boot, so reading it later is a race. */
function bootLink(): { tab?: Tab; itab?: ITab; sel?: string } {
  if (typeof location === "undefined") return {};
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  if (path !== "layouts") return {};
  const p = new URLSearchParams(qs ?? "");
  const t = p.get("tab");
  const i = p.get("itab");
  const s2 = p.get("sel");
  return {
    tab: t === "layouts" || t === "templates" ? t : undefined,
    itab: i === "overview" || i === "structure" || i === "usage" ? i : undefined,
    sel: s2 ?? undefined
  };
}

export function Layouts() {
  const app = useApp();
  const siteId = app.siteId === "all" ? "site_main" : app.siteId;

  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<LayoutPayload | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const boot = useRef(bootLink()).current;
  const [tab, setTab] = useState<Tab>(boot.tab ?? "layouts");
  const [sel, setSel] = useState<string | null>(boot.sel ?? null);
  const [itab, setItab] = useState<ITab>(boot.itab ?? "overview");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [device, setDevice] = useState<LayoutDevice>("desktop");
  const [zoom, setZoom] = useState(100); // 0 = Fit to the stage; otherwise true size %

  const [draft, setDraft] = useState<LayoutDraft | null>(null);
  const [tplDraft, setTplDraft] = useState<PageTemplateDoc | null>(null);
  /* the starter block being edited in the Structure inspector (template editing) */
  const [selBlock, setSelBlock] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [filterMenu, setFilterMenu] = useState<HTMLElement | null>(null);
  const [seedMenu, setSeedMenu] = useState<HTMLElement | null>(null);

  const [createKind, setCreateKind] = useState<Tab | null>(null);
  const [archiveFor, setArchiveFor] = useState<{ kind: "layout" | "template"; id: string; name: string; builtIn: boolean; isDefault: boolean; pages: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [regionFor, setRegionFor] = useState<SharedRegion | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [reassignSel, setReassignSel] = useState<string[] | null>(null);
  const [createPageFor, setCreatePageFor] = useState<PageTemplateDoc | null>(null);
  const [historyFor, setHistoryFor] = useState<{ kind: "layout" | "template"; id: string; name: string } | null>(null);

  /* In-app deep links (Module 3 → this screen) arrive as a hash change, not a
     document load, so the module-scope boot parse cannot see them. Listen for
     the parameters and apply only what is present — the store rewrites the
     hash itself, and every rewrite lands here too, which is why this is
     idempotent by design. */
  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash;
      if (!raw.startsWith("#/layouts")) return;
      const q = new URLSearchParams(raw.split("?")[1] ?? "");
      const t = q.get("tab");
      const it = q.get("itab");
      const id = q.get("sel");
      if (t === "layouts" || t === "templates") setTab(t);
      if (it === "overview" || it === "structure" || it === "usage") setItab(it);
      if (id) setSel(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [prebuiltOpen, setPrebuiltOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [usageQ, setUsageQ] = useState("");
  const [usagePage, setUsagePage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);
  const readOnly = app.role === "Viewer";
  const canDelete = app.can("delete");

  /* ---------------- load ---------------- */

  useEffect(() => {
    let dead = false;
    /* the shared prototype-states menu drives this screen's transport too */
    LayoutsMode.fail = app.demo === "error";
    LayoutsMode.empty = app.demo === "empty";
    LayoutsMode.slow = app.demo === "loading";
    LayoutsMode.conflict = app.demo === "conflict";
    setStatus("loading");
    if (LayoutsMode.slow) setPayload(null);
    LayoutsAPI.load(siteId)
      .then((p) => {
        if (dead) return;
        setPayload(p);
        setStatus("ready");
        setError("");
      })
      .catch((e: Error) => { if (!dead) { setError(e.message); setStatus("error"); } });
    return () => { dead = true; };
  }, [siteId, tick, app.demo]);

  const layouts = payload?.layouts ?? [];
  const templates = payload?.templates ?? [];

  const current: LayoutDraft | null = useMemo(
    () => (sel ? layouts.find((l) => l.id === sel) ?? null : null),
    [layouts, sel]
  );
  const currentTpl: PageTemplateDoc | null = useMemo(
    () => (sel ? templates.find((t) => t.id === sel) ?? null : null),
    [templates, sel]
  );

  /* the working copy is the single source of truth for the canvas while editing */
  useEffect(() => {
    setDraft(current && tab === "layouts" ? JSON.parse(JSON.stringify(current)) : null);
    setTplDraft(currentTpl && tab === "templates" ? JSON.parse(JSON.stringify(currentTpl)) : null);
    setPicked([]);
    setUsageQ("");
    setUsagePage(1);
  }, [current?.id, current?.rev, currentTpl?.id, currentTpl?.rev, tab]);

  const dirty = tab === "layouts" ? !!draft && !!current && !same(draft, current) : false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); }
      if (e.key === "Escape") { setMenuFor(null); setMenuAnchor(null); setFilterMenu(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const guard = (action: () => void) => {
    if (dirty) { setPending(() => action); return; }
    action();
  };

  const choose = (id: string, nextTab: Tab) => {
    guard(() => {
      setTab(nextTab);
      setSel(id);
      if (nextTab === "layouts") setItab("overview");
      location.hash = `#/layouts?site=${siteId}&tab=${nextTab}&itab=overview&sel=${id}`;
    });
  };

  /* ---------------- selection bootstrap ---------------- */

  useEffect(() => {
    if (status !== "ready" || sel) return;
    const first = tab === "layouts" ? layouts.find((l) => l.isDefault) ?? layouts[0] : templates[0];
    if (first) setSel(first.id);
  }, [status, sel, tab, layouts, templates]);

  /* ---------------- rows ---------------- */

  const layoutRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = layouts
      .filter((l) => (archivedOpen ? true : !l.archived))
      .filter((l) => !needle || l.name.toLowerCase().includes(needle) || l.desc.toLowerCase().includes(needle));
    const pagesOf = (id: string) => usageRows(siteId, id).length;
    if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "pages") rows.sort((a, b) => pagesOf(b.id) - pagesOf(a.id));
    else rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt));
    return rows;
  }, [layouts, q, sort, siteId, archivedOpen]);

  const templateRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return templates
      .filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.intent.toLowerCase().includes(needle) || t.desc.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "pages" ? b.blocks.length - a.blocks.length : b.updatedAt.localeCompare(a.updatedAt)));
  }, [templates, q, sort]);

  const k = payload?.kpis;
  const groupsRows = payload?.groups ?? [];
  const pf = payload?.preflight ?? [];
  const pfErrors = pf.filter((i) => i.severity === "error").length;

  const usage = useMemo(() => (current ? usageRows(siteId, current.id) : []), [current, siteId, payload, draft]);
  const usageFiltered = useMemo(() => {
    const needle = usageQ.trim().toLowerCase();
    return usage.filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.path.toLowerCase().includes(needle));
  }, [usage, usageQ]);
  const usagePageRows = usageFiltered.slice((usagePage - 1) * 8, usagePage * 8);
  const usagePages = Math.max(1, Math.ceil(usageFiltered.length / 8));

  /* the canvas reads the working copy, so a variant swap is visible before saving */
  const frame = useMemo(() => (draft ? frameOf(draft) : null), [draft]);
  const templateFrame = useMemo(() => {
    if (!tplDraft) return null;
    const bound = layouts.find((l) => l.id === tplDraft.layoutId);
    return bound ? frameOf(bound) : null;
  }, [tplDraft, layouts]);

  /* preview works for both libraries: a template previews inside the shell
     it would create pages on */
  const previewLayout: LayoutDraft | null = draft ?? (tplDraft ? layouts.find((l) => l.id === tplDraft.layoutId) ?? null : null);
  const previewFrame = tab === "templates" ? templateFrame : frame;

  /* ---------------- mutations ---------------- */

  const save = useCallback(async () => {
    if (!draft || !dirty || readOnly || saving) return;
    setSaving(true);
    try {
      const saved = await LayoutsAPI.saveLayout(draft, current?.rev ?? draft.rev);
      setPayload((p) => (p ? { ...p, layouts: p.layouts.map((l) => (l.id === saved.id ? saved : l)) } : p));
      setDraft(JSON.parse(JSON.stringify(saved)));
      app.toast({ type: "success", title: `${saved.name} saved`, sub: `Revision ${saved.rev}. Pages bound to it see the change on their next publish.` });
      setTick((n) => n + 1);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "E_CONFLICT") setConflict(err.message);
      else app.toast({ type: "error", title: "Could not save", sub: err.message });
    } finally { setSaving(false); }
  }, [draft, dirty, readOnly, saving, current, app]);

  const patch = (fn: (d: LayoutDraft) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const next = JSON.parse(JSON.stringify(d)) as LayoutDraft;
      fn(next);
      return next;
    });
  };

  const patchTpl = (fn: (t: PageTemplateDoc) => void) => {
    setTplDraft((t) => {
      if (!t) return t;
      const next = JSON.parse(JSON.stringify(t)) as PageTemplateDoc;
      fn(next);
      return next;
    });
  };

  const setDefault = async () => {
    if (!current) return;
    try {
      await LayoutsAPI.setDefault(current.id);
      app.toast({ type: "success", title: `${current.name} is now the website default`, sub: "Every page using “Site default” follows it immediately." });
      setTick((n) => n + 1);
    } catch (e) { app.toast({ type: "error", title: "Could not set the default", sub: (e as Error).message }); }
  };

  const duplicate = async (l: LayoutDraft) => {
    try {
      const made = await LayoutsAPI.createLayout(siteId, `${l.name} copy`, l.id);
      app.toast({ type: "success", title: `${made.name} created`, sub: "Regions and slot policy were copied once." });
      setTick((n) => n + 1);
      setSel(made.id);
    } catch (e) { app.toast({ type: "error", title: "Could not duplicate", sub: (e as Error).message }); }
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget as HTMLElement);
    setMenuFor(id);
  };

  /* ---------------- header ---------------- */

  const activeRegion = (kind: "announcement" | "header" | "footer"): SharedRegion | null =>
    payload?.regions.find((r) => r.kind === kind) ?? null;

  const regionRow = (kind: "announcement" | "header" | "footer", name: string, ref_: { visible: boolean; variantId: string; hideReason?: string }, set: (v: string) => void, toggleVisible: () => void) => {
    const region = activeRegion(kind);
    if (!region || !draft) return null;
    const variant = region.variants.find((v) => v.id === ref_.variantId);
    return (
      <div className="m7-region" key={kind}>
        <div className="m7-region-h">
          <Icon name={kind === "header" ? "columns" : kind === "footer" ? "layers" : "megaphone"} size={13} />
          <b>{name}</b>
          <Pill tone="grey" className="m7-locked"><Icon name="lock" size={9} /> Global (locked)</Pill>
        </div>
        <div className="m7-region-row">
          <select value={ref_.variantId} disabled={readOnly} onChange={(e) => set(e.target.value)} aria-label={`${name} variant`}>
            {region.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <span className="m7-sw">
            <Tip text={ref_.visible ? "Hide this region for this layout" : "Show this region"}>
              <button className={`m7-mini-sw ${ref_.visible ? "is-on" : ""}`} onClick={toggleVisible} disabled={readOnly} aria-pressed={ref_.visible} aria-label={`${name} visibility`}><i /></button>
            </Tip>
          </span>
          <button className="m7-icon-btn" onClick={() => setRegionFor(region)} aria-label={`Edit ${name}`}><Icon name="pencil" size={12} /></button>
        </div>
        <div className="m7-region-meta">
          <span>rev {variant?.rev ?? 0} · {variant?.blocks.length ?? 0} block{(variant?.blocks.length ?? 0) === 1 ? "" : "s"}</span>
          {!ref_.visible && <span className="m7-hide-reason">{ref_.hideReason ? "hidden" : "reason required"}</span>}
        </div>
        {!ref_.visible && (
          <input
            className="m7-reason" value={ref_.hideReason ?? ""} disabled={readOnly}
            placeholder="Why is this region hidden? (required)" maxLength={90}
            onChange={(e) => {
              const v = e.target.value;
              if (kind === "announcement") patch((d) => { d.announcement.hideReason = v; });
              else if (kind === "header") patch((d) => { d.header.hideReason = v; });
              else patch((d) => { d.footer.hideReason = v; });
            }}
          />
        )}
      </div>
    );
  };

  const toggleRef = (kind: "announcement" | "header" | "footer") => {
    patch((d) => {
      const ref_ = d[kind];
      ref_.visible = !ref_.visible;
      if (!ref_.visible && !ref_.hideReason) ref_.hideReason = "";
      if (ref_.visible) delete ref_.hideReason;
    });
  };

  const setVariant = (kind: "announcement" | "header" | "footer", variantId: string) => {
    patch((d) => { d[kind].variantId = variantId; });
  };

  /* ---------------- render ---------------- */

  return (
    <div className="m7">
      <header className="m7-head">
        <div>
          <h1 className="m7-title">Layouts &amp; Templates</h1>
          <p className="m7-sub">Master layouts wrap every page. Templates start one. Bind here, compose in the builder.</p>
        </div>
        <div className="m7-head-right">
          <label className="m7-site">
            <span>Website:</span>
            <select value={siteId} onChange={(e) => app.setSite(e.target.value)} aria-label="Website">
              {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <Btn icon="book" onClick={() => setPrebuiltOpen(true)}>
            Prebuilt<span className="m7-count">{KIT_COUNT}</span>
          </Btn>
          <Btn icon="upload" onClick={() => setImportOpen(true)}>Import</Btn>
          <Btn icon="link" onClick={() => setPfOpen(true)}>
            Preflight{pf.length > 0 && <span className={`m7-badge ${pfErrors ? "is-bad" : "is-warn"}`}>{pf.length}</span>}
          </Btn>
          <Btn icon="eye" disabled={!previewLayout || !previewFrame} onClick={() => setPreviewOpen(true)}>Preview Layout</Btn>
          <Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setCreateKind(tab)}>
            {tab === "layouts" ? "Create Layout" : "Create Template"}
          </Btn>
        </div>
      </header>

      <div className="m7-kpis">
        {KPIS.map((k2) => <Kpi key={k2.id} icon={k2.icon} tone={k2.tone} value={k ? (k as any)[k2.id] : 0} label={k2.label} tip={k2.tip} />)}
      </div>

      <div className="m7-body">
        {/* ---------------- library ---------------- */}
        <aside className="m7-lib" aria-label="Layouts and templates">
          <div className="m7-lib-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "layouts"} className={tab === "layouts" ? "is-on" : ""} onClick={() => { setTab("layouts"); setItab("overview"); setSel(layouts.find((l) => l.isDefault)?.id ?? layouts[0]?.id ?? null); }}>
              Master Layouts <em>{layouts.filter((l) => !l.archived).length}</em>
            </button>
            <button role="tab" aria-selected={tab === "templates"} className={tab === "templates" ? "is-on" : ""} onClick={() => { setTab("templates"); setItab("overview"); setSel(templates[0]?.id ?? null); }}>
              Page Templates <em>{templates.length}</em>
            </button>
          </div>

          <div className="m7-lib-search">
            <Icon name="search" size={13} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "layouts" ? "Search layouts…" : "Search templates…"} autoComplete="off" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size={11} /></button>}
            <button
              className={`m7-filter ${sort !== "recent" || archivedOpen ? "is-on" : ""}`}
              onClick={(e) => setFilterMenu(e.currentTarget)}
              aria-label="Sort"
            ><Icon name="filter" size={12} /></button>
          </div>

          <div className="m7-lib-list">
            {status === "loading" && !payload && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="m7-row m7-skel">
                <Skel style={{ height: 30, width: 30, borderRadius: 8 }} />
                <div style={{ flex: 1 }}><Skel style={{ height: 11, width: "62%" }} /><Skel style={{ height: 9, width: "40%", marginTop: 6 }} /></div>
              </div>
            ))}

            {status === "ready" && tab === "layouts" && layoutRows.map((l) => {
              const pages = usageRows(siteId, l.id).length;
              return (
                <button key={l.id} className={`m7-row ${sel === l.id ? "is-on" : ""} ${l.archived ? "is-arch" : ""}`} onClick={() => choose(l.id, "layouts")}>
                  <span className="m7-row-ico"><Icon name="layers" size={14} /></span>
                  <span className="m7-row-body">
                    <span className="m7-row-name">
                      {l.name}
                      {l.isDefault && <Pill tone="violet">Default</Pill>}
                      {l.dirty && <span className="m7-dot" title="Unpublished changes" />}
                    </span>
                    <span className="m7-row-meta">
                      {l.archived ? "Archived" : `${pages} page${pages === 1 ? "" : "s"}`} · rev {l.rev} · {ago(l.updatedAt)}
                    </span>
                  </span>
                  <span className="m7-row-menu" onClick={(e) => { e.stopPropagation(); openMenu(e, l.id); }} role="button" tabIndex={0} aria-label={`${l.name} actions`}>
                    <Icon name="more" size={14} />
                  </span>
                </button>
              );
            })}

            {status === "ready" && tab === "templates" && templateRows.map((t) => (
              <button key={t.id} className={`m7-row ${sel === t.id ? "is-on" : ""}`} onClick={() => choose(t.id, "templates")}>
                <span className="m7-row-ico"><Icon name="file" size={14} /></span>
                <span className="m7-row-body">
                  <span className="m7-row-name">{t.name}{t.builtIn && <Pill tone="grey">Built-in</Pill>}</span>
                  <span className="m7-row-meta">{t.intent} · {t.blocks.length} blocks · rev {t.rev}</span>
                </span>
                <span className="m7-row-menu" onClick={(e) => { e.stopPropagation(); openMenu(e, t.id); }} role="button" tabIndex={0} aria-label={`${t.name} actions`}>
                  <Icon name="more" size={14} />
                </span>
              </button>
            ))}

            {status === "ready" && tab === "layouts" && layoutRows.length === 0 && (
              <EmptyState icon="layers" title={q ? "No layout matches that search" : "No layouts yet"} desc={q ? "Try a different term, or clear the search." : "Create the first master layout for this site."} />
            )}
            {status === "ready" && tab === "templates" && templateRows.length === 0 && (
              <EmptyState icon="file" title={q ? "No template matches that search" : "No templates"} desc={q ? "Try “landing”, “program” or an intent such as “Conversion”." : "Create a starter composition from any layout."} />
            )}

            {status === "error" && (
              <div className="m7-lib-error">
                <Icon name="alert" size={14} />
                <b>Could not load</b>
                <span>{error}</span>
                <Btn onClick={() => setTick((n) => n + 1)}>Retry</Btn>
              </div>
            )}
          </div>

          {tab === "layouts" && (
            <button className="m7-lib-foot" onClick={() => setArchivedOpen((v) => !v)} aria-pressed={archivedOpen}>
              <Icon name="archive" size={12} />
              {archivedOpen ? "Hide archived layouts" : `Show archived (${layouts.filter((l) => l.archived).length})`}
            </button>
          )}
          {tab === "templates" && (
            <div className="m7-lib-foot m7-lib-foot-import">
              <button onClick={() => setPrebuiltOpen(true)}><Icon name="book" size={12} />{KIT_COUNT} prebuilt templates</button>
              <button onClick={() => setImportOpen(true)}><Icon name="upload" size={12} />Import HTML or JSON</button>
              <span className="m7-lib-foot-note"><Icon name="shield" size={11} />Built-in templates cannot be deleted · {PREBUILT_SOURCE.license} library ships offline</span>
            </div>
          )}
        </aside>

        {/* ---------------- stage ---------------- */}
        <main className="m7-stage-col">
          <div className="m7-toolbar">
            <div className="m7-crumbs">
              <span>{tab === "layouts" ? "Layout" : "Template"}</span>
              <Icon name="chevRight" size={11} />
              <b>{tab === "layouts" ? draft?.name ?? "—" : tplDraft?.name ?? "—"}</b>
              {tab === "layouts" && draft?.isDefault && <Pill tone="violet" dot>Website default</Pill>}
              {tab === "layouts" && draft?.archived && <Pill tone="grey">Archived</Pill>}
              {dirty && <Pill tone="amber" dot>Unsaved changes</Pill>}
            </div>
            <div className="m7-tools">
              <Pill tone="amber" dot>Draft preview — not live</Pill>
              <div className="m7-devices" role="group" aria-label="Preview width">
                {([["desktop", "monitor"], ["tablet", "tablet"], ["mobile", "phone"]] as const).map(([d, icon]) => (
                  <button key={d} className={device === d ? "is-on" : ""} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} width`}><Icon name={icon} size={13} /></button>
                ))}
              </div>
              <select className="m7-zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom">
                {[0, 60, 75, 100].map((z) => <option key={z} value={z}>{z === 0 ? "Fit" : `${z}%`}</option>)}
              </select>
            </div>
          </div>

          <div className="m7-stage">
            {status === "error" ? (
              <ErrorState title="Layouts could not load" desc={error} onRetry={() => setTick((n) => n + 1)} />
            ) : status === "loading" && !payload ? (
              <div className="m7-stage-skel"><Skel style={{ height: 420, borderRadius: 12 }} /></div>
            ) : tab === "layouts" && draft && frame ? (
              <LayoutCanvas
                frame={frame}
                seed={draft.slot.seed}
                device={device}
                zoom={zoom}
                slotLabel="Main Content Slot"
                policy={draft.slot.policy}
                selectedId={selBlock}
                onSelectBlock={(id) => { setSelBlock(id); setItab("structure"); }}
              />
            ) : tab === "templates" && tplDraft && templateFrame ? (
              <LayoutCanvas
                frame={templateFrame}
                seed={tplDraft.blocks}
                device={device}
                zoom={zoom}
                slotLabel={`${tplDraft.name} — starter blocks`}
                slotNote="copy-on-create"
                policy={templateFrame ? templateFrame.slotPolicy : { allow: [], deny: [], maxBlocks: 200 }}
                selectedId={selBlock}
                onSelectBlock={(id) => { setSelBlock(id); setItab("structure"); }}
              />
            ) : (
              <EmptyState icon="layers" title="Nothing selected" desc="Pick a layout on the left to see its shell." />
            )}
          </div>

          {/* slot + policy strip */}
          {tab === "layouts" && draft && (
            <div className="m7-slotbar">
              <div className="m7-slotbar-l">
                <Icon name="lock" size={11} />
                <b>Main Content Slot</b>
                <span>required · non-removable</span>
              </div>
              <div className="m7-slotbar-m">
                <Tip text="The block types editors may place in this slot. The builder's library is filtered to this list.">
                  <button className="m7-chipbtn" onClick={() => setPolicyOpen(true)} disabled={readOnly}>
                    <Icon name="shield" size={11} />{draft.slot.policy.allow.length || 20} allowed
                  </button>
                </Tip>
                <Tip text="Blocks cloned into every new page created on this layout.">
                  <span className="m7-chipbtn is-static"><Icon name="blocks" size={11} />{draft.slot.seed.length} seed blocks</span>
                </Tip>
                <Tip text="Hard ceiling before preflight blocks a publish.">
                  <span className="m7-chipbtn is-static"><Icon name="gauge" size={11} />max {draft.slot.policy.maxBlocks}</span>
                </Tip>
              </div>
              <div className="m7-slotbar-r">
                <button className="m7-linkbtn" onClick={() => guard(() => { location.hash = `#/builder?site=${siteId}&template=${draft.id}`; })}>Compose in builder<Icon name="arrowRight" size={11} /></button>
              </div>
            </div>
          )}

          {/* page groups */}
          {status === "ready" && (
            <section className="m7-groups" aria-label="Pages by group">
              <div className="m7-groups-h">
                <h3>Pages by group<span>{groupsRows.reduce((s2, g) => s2 + g.pages, 0)} pages</span></h3>
                <button className="m7-linkbtn" onClick={() => { setItab("usage"); }}>Open usage</button>
              </div>
              <div className="m7-group-row">
                {groupsRows.map((g) => (
                  <Tip key={g.id} text={`${g.hint} — ${g.routes || "no routes yet"}`}>
                    <button className="m7-group" onClick={() => { setItab("usage"); setUsageQ(g.name === "Other" ? "" : g.routes.split(" · ")[0] ?? ""); }}>
                      <span className="m7-group-n">{g.pages}</span>
                      <span className="m7-group-l">{g.name}</span>
                    </button>
                  </Tip>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* ---------------- inspector ---------------- */}
        <aside className="m7-insp" aria-label="Inspector">
          <div className="m7-insp-tabs" role="tablist">
            {(["overview", "structure", "usage"] as ITab[]).map((t) => (
              <button key={t} role="tab" aria-selected={itab === t} className={itab === t ? "is-on" : ""} onClick={() => setItab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          {!draft && !tplDraft ? (
            <div className="m7-insp-empty"><Icon name="layers" size={18} /><span>Select a layout or template.</span></div>
          ) : itab === "overview" && tab === "layouts" && draft ? (
            <div className="m7-pane">
              <div className="m7-pane-h">
                <input
                  className="m7-name" value={draft.name} disabled={readOnly || draft.archived}
                  onChange={(e) => patch((d) => { d.name = e.target.value; })} aria-label="Layout name"
                />
                <span className="m7-pane-meta">
                  <span className="m7-scope">{draft.scope === "builtin" ? "Built in · workspace" : draft.scope === "site" ? "This site only" : "Workspace"}</span>
                  <button className={`m7-seo-pill ${draft.seoChecklist.every((c) => c.ok) ? "is-ok" : "is-warn"}`} onClick={() => setSeoOpen(true)}>
                    <Icon name={draft.seoChecklist.every((c) => c.ok) ? "shield" : "alert"} size={11} />
                    {draft.seoChecklist.every((c) => c.ok) ? "SEO-ready" : "Not SEO-ready"}
                    <em>{draft.seoChecklist.filter((c) => c.ok).length}/{draft.seoChecklist.length}</em>
                  </button>
                </span>
              </div>
              <textarea
                className="m7-desc" value={draft.desc} rows={3} disabled={readOnly} aria-label="Description"
                onChange={(e) => patch((d) => { d.desc = e.target.value; })}
              />

              <div className="m7-default">
                <div>
                  <b>Website default</b>
                  <span>New pages and “Site default” pages follow this layout.</span>
                </div>
                <button
                  className={`m7-mini-sw ${draft.isDefault ? "is-on" : ""}`} disabled={readOnly || draft.isDefault || draft.archived}
                  onClick={() => void setDefault()} aria-pressed={draft.isDefault} aria-label="Website default"
                ><i /></button>
              </div>

              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Regions</h4><span>Order fixed: announcement → header → slot → footer</span></div>
                {regionRow("announcement", "Announcement", draft.announcement, (v) => setVariant("announcement", v), () => toggleRef("announcement"))}
                {regionRow("header", "Global Header", draft.header, (v) => setVariant("header", v), () => toggleRef("header"))}
                <div className="m7-region is-slot">
                  <div className="m7-region-h"><Icon name="lock" size={12} /><b>Main Content Slot</b><Pill tone="violet">Required</Pill></div>
                  <p>{draft.slot.seed.length} seed blocks · {draft.slot.policy.allow.length || 20} allowed types · max {draft.slot.policy.maxBlocks}</p>
                </div>
                {regionRow("footer", "Global Footer", draft.footer, (v) => setVariant("footer", v), () => toggleRef("footer"))}
              </div>

              <div className="m7-insp-foot">
                <Btn icon="refresh" onClick={() => setDraft(current ? JSON.parse(JSON.stringify(current)) : null)} disabled={!dirty || readOnly}>Undo</Btn>
                <Btn icon="clock" onClick={() => setHistoryFor({ kind: "layout", id: draft.id, name: draft.name })}>
                  History
                </Btn>
                <Btn variant="primary" icon="check" loading={saving} onClick={() => void save()} disabled={!dirty || readOnly}>Save</Btn>
              </div>
            </div>
          ) : itab === "structure" && tab === "layouts" && draft ? (
            <div className="m7-pane">
              {(() => {
                const sel = draft.slot.seed.find((b) => b.id === selBlock);
                if (!sel) return null;
                return (
                  <div className="m7-sec m7-bf-sec">
                    <div className="m7-sec-h"><h4>Edit {sel.type}</h4><button className="m7-icon-btn" aria-label="Close block editor" onClick={() => setSelBlock(null)}><Icon name="x" size={11} /></button></div>
                    <BlockFields
                      node={sel}
                      siteId={siteId}
                      readOnly={readOnly}
                      onChange={(key, value) => patch((d) => {
                        const b = d.slot.seed.find((x) => x.id === sel.id);
                        if (b) b.props = { ...b.props, [key]: value };
                      })}
                    />
                    <p className="m7-muted">Changes stay in this draft until you press Save.</p>
                  </div>
                );
              })()}
              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Region order</h4><span>Fixed by the block contract</span></div>
                <div className="m7-order">
                  {["Announcement", "Header", "Slot", "Footer"].map((n) => (
                    <span key={n} className="m7-order-item"><Icon name="grip" size={10} />{n}</span>
                  ))}
                </div>
              </div>

              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Slot policy</h4><button className="m7-linkbtn" onClick={() => setPolicyOpen(true)} disabled={readOnly}>Edit</button></div>
                <div className="m7-policy-chips">
                  {(draft.slot.policy.allow.length ? draft.slot.policy.allow : (Object.keys(REGISTRY) as BlockType[])).map((t) => (
                    <span key={t} className="m7-typechip">{t}</span>
                  ))}
                </div>
                <div className="m7-kv"><span>Block ceiling</span><b>{draft.slot.policy.maxBlocks}</b></div>
              </div>

              <div className="m7-sec">
                <div className="m7-sec-h">
                  <h4>Seed blocks</h4>
                  <button
                    className="m7-linkbtn" disabled={readOnly || draft.slot.seed.length >= draft.slot.policy.maxBlocks}
                    onClick={(e) => setSeedMenu(e.currentTarget)}
                  ><Icon name="plus" size={10} />Add</button>
                </div>
                <div className="m7-seedlist">
                  {draft.slot.seed.length === 0 && <p className="m7-muted">No seed. Pages created on this layout start with an empty slot.</p>}
                  {draft.slot.seed.map((b, i) => (
                    <div key={b.id} className={`m7-seed ${selBlock === b.id ? "is-selected" : ""}`} onClick={() => setSelBlock(b.id)}>
                      <Icon name="grip" size={10} />
                      <span className="m7-seed-type">{b.type}</span>
                      <span className="m7-seed-meta">{(b.props as any)?.title ?? (b.props as any)?.text ?? "—"}</span>
                      <button
                        className="m7-icon-btn" aria-label={`Move ${b.type} up`} disabled={i === 0 || readOnly}
                        onClick={() => patch((d) => { const a = d.slot.seed; [a[i - 1], a[i]] = [a[i], a[i - 1]]; })}
                      ><Icon name="chevDown" size={11} className="m7-up" /></button>
                      <button
                        className="m7-icon-btn" aria-label={`Remove ${b.type}`} disabled={readOnly}
                        onClick={() => patch((d) => { d.slot.seed = d.slot.seed.filter((x) => x.id !== b.id); })}
                      ><Icon name="x" size={11} /></button>
                    </div>
                  ))}
                </div>
                {draft.slot.seed.length > draft.slot.policy.maxBlocks && (
                  <div className="m7-err"><Icon name="alert" size={12} />The seed exceeds this layout's ceiling — saving will be refused.</div>
                )}
              </div>

              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Binding</h4></div>
                <div className="m7-kv"><span>Default for new pages</span><b>{draft.isDefault ? "Yes" : "No"}</b></div>
                <div className="m7-kv"><span>Archived</span><b>{draft.archived ? "Yes" : "No"}</b></div>
                <div className="m7-kv"><span>Pages bound</span><b>{usage.length}</b></div>
              </div>

              <div className="m7-insp-foot">
                <Btn icon="refresh" onClick={() => setDraft(current ? JSON.parse(JSON.stringify(current)) : null)} disabled={!dirty || readOnly}>Undo</Btn>
                <Btn variant="primary" icon="check" loading={saving} onClick={() => void save()} disabled={!dirty || readOnly}>Save</Btn>
              </div>
            </div>
          ) : itab === "usage" && tab === "layouts" && draft ? (
            <div className="m7-pane">
              <div className="m7-kv m7-usage-sub"><span>r{draft.rev} · {dirty ? "unsaved changes" : `saved ${ago(draft.updatedAt)}`} · by {draft.updatedBy}</span><b>{draft.seoChecklist.every((c) => c.ok) ? "SEO-ready" : "SEO incomplete"}</b></div>
              <div className="m7-usage-head">
                <div><b>{usage.length}</b><span>pages bound</span></div>
                <div><b>{usage.filter((u) => u.status === "published").length}</b><span>published</span></div>
                <div><b>{usage.filter((u) => u.hasChanges).length}</b><span>draft changes</span></div>
              </div>

              <div className="m7-search is-small">
                <Icon name="search" size={12} />
                <input value={usageQ} onChange={(e) => { setUsageQ(e.target.value); setUsagePage(1); }} placeholder="Filter pages…" />
                {usageQ && <button onClick={() => setUsageQ("")} aria-label="Clear"><Icon name="x" size={10} /></button>}
              </div>

              <div className="m7-usage-list">
                {usagePageRows.map((r) => (
                  <div key={r.id} className="m7-usage-row">
                    <input
                      type="checkbox" checked={picked.includes(r.id)} aria-label={`Select ${r.title}`}
                      onChange={() => setPicked((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur, r.id]))}
                    />
                    <span className="m7-usage-body">
                      <span className="m7-usage-title">{r.title}</span>
                      <span className="m7-usage-path">{r.path}</span>
                      <span className="m7-usage-meta">
                        <Pill tone={r.status === "published" ? "green" : "grey"} dot>{r.status === "published" ? "Published" : "Draft"}</Pill>
                        {r.hasChanges && <Pill tone="amber">changes</Pill>}
                        <em>{usageLabel(r)}</em>
                      </span>
                    </span>
                    <button className="m7-icon-btn" aria-label={`Open ${r.title} in the builder`} onClick={() => { location.hash = `#/builder?site=${siteId}&page=${r.id}`; }}>
                      <Icon name="arrowRight" size={11} />
                    </button>
                  </div>
                ))}
                {usageFiltered.length === 0 && (
                  <p className="m7-muted m7-usage-none">{usageQ ? "No page matches that filter." : "No page is bound to this layout. New pages following “Site default” appear here when it is the default."}</p>
                )}
              </div>

              {usagePages > 1 && (
                <div className="m7-pager">
                  <button onClick={() => setUsagePage((p) => Math.max(1, p - 1))} disabled={usagePage === 1}><Icon name="chevLeft" size={11} /></button>
                  <span>{usagePage} / {usagePages}</span>
                  <button onClick={() => setUsagePage((p) => Math.min(usagePages, p + 1))} disabled={usagePage === usagePages}><Icon name="chevRight" size={11} /></button>
                </div>
              )}

              {picked.length > 0 ? (
                <div className="m7-bulk">
                  <span>{picked.length} selected</span>
                  <Btn
                    variant="primary" icon="refresh" disabled={readOnly || picked.length > 40}
                    onClick={() => setReassignSel(picked)}
                  >Reassign</Btn>
                  <button className="m7-linkbtn" onClick={() => setPicked([])}>Clear</button>
                </div>
              ) : (
                <div className="m7-bulk is-idle">
                  <span>Select pages to move them to another layout in one audit event.</span>
                  <button className="m7-linkbtn" onClick={() => setPicked(usage.slice(0, 40).map((u) => u.id))} disabled={readOnly || usage.length === 0}>Select all{picked.length > 40 ? "" : ""}</button>
                </div>
              )}
              <div className="m7-insp-foot">
                <Btn icon="file" onClick={() => { location.hash = `#/pages?site=${siteId}`; }}>Open Pages</Btn>
                <Btn variant="primary" icon="check" loading={saving} onClick={() => void save()} disabled={!dirty || readOnly}>Save</Btn>
              </div>
            </div>
          ) : itab === "overview" && tab === "templates" && tplDraft ? (
            <div className="m7-pane">
              <div className="m7-pane-h">
                <input className="m7-name" value={tplDraft.name} disabled={readOnly} onChange={(e) => patchTpl((t) => { t.name = e.target.value; })} aria-label="Template name" />
                <span className="m7-scope">{tplDraft.builtIn ? "Built-in · workspace" : "Workspace"}</span>
                {tplDraft.origin && tplDraft.origin.kind !== "builtin" && (
                  <Pill tone={tplDraft.origin.kind === "prebuilt" ? "violet" : "blue"}>
                    {tplDraft.origin.kind === "prebuilt"
                      ? `Prebuilt · ${tplDraft.origin.license ?? "MIT"}`
                      : tplDraft.origin.kind === "builder" ? "Saved from a page" : `Imported · ${tplDraft.origin.kind.toUpperCase()}`}
                  </Pill>
                )}
              </div>
              <textarea className="m7-desc" rows={3} value={tplDraft.desc} disabled={readOnly} aria-label="Template description" onChange={(e) => patchTpl((t) => { t.desc = e.target.value; })} />
              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Binding</h4></div>
                <label className="m7-field">
                  <span>Default layout for pages created from this template</span>
                  <select value={tplDraft.layoutId} disabled={readOnly} onChange={(e) => patchTpl((t) => { t.layoutId = e.target.value; })}>
                    {layouts.filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
                <div className="m7-kv"><span>Intent</span><b>{tplDraft.intent}</b></div>
                <div className="m7-kv"><span>Blocks</span><b>{tplDraft.blocks.length}</b></div>
                <div className="m7-kv"><span>SEO</span><b>{tplDraft.seoReady ? "ready" : "incomplete"}</b></div>
                <div className="m7-kv"><span>Revision</span><b>r{tplDraft.rev}</b></div>
                {tplDraft.origin && tplDraft.origin.kind !== "builtin" && (
                  <>
                    <div className="m7-kv"><span>Origin</span><b>{tplDraft.origin.name ?? "Uploaded file"}</b></div>
                    {tplDraft.origin.source && <div className="m7-kv"><span>Source</span><b className="m7-kv-src">{tplDraft.origin.source.replace("https://github.com/", "")}</b></div>}
                    {tplDraft.origin.commit && <div className="m7-kv"><span>Commit</span><b className="m7-kv-src">{tplDraft.origin.commit}</b></div>}
                    {tplDraft.origin.importedAt && <div className="m7-kv"><span>Imported</span><b>{new Date(tplDraft.origin.importedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b></div>}
                  </>
                )}
              </div>
              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Used by</h4></div>
                <div className="m7-kv"><span>Pages created from it</span><b>{DBX().cmsPages.filter((p) => p.siteId === siteId && p.template === currentTpl?.name).length}</b></div>
                <p className="m7-muted">Copy-on-create: pages created from a template are never updated by later template edits.</p>
              </div>
              <div className="m7-insp-foot">
                <Btn icon="clock" onClick={() => setHistoryFor({ kind: "template", id: tplDraft.id, name: tplDraft.name })}>History</Btn>
                <Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setCreatePageFor(tplDraft)}>Create page</Btn>
                <Btn icon="check" disabled={readOnly || same(tplDraft, currentTpl)} onClick={async () => {
                  try {
                    const saved = await LayoutsAPI.saveTemplate(tplDraft, currentTpl?.rev ?? tplDraft.rev);
                    app.toast({ type: "success", title: `${saved.name} saved`, sub: `Revision ${saved.rev}.` });
                    setTick((n) => n + 1);
                  } catch (e) { app.toast({ type: "error", title: "Could not save the template", sub: (e as Error).message }); }
                }}>Save</Btn>
              </div>
            </div>
          ) : itab === "structure" && tab === "templates" && tplDraft ? (
            <div className="m7-pane">
              {(() => {
                const sel = tplDraft.blocks.find((b) => b.id === selBlock);
                if (!sel) return null;
                return (
                  <div className="m7-sec m7-bf-sec">
                    <div className="m7-sec-h"><h4>Edit {sel.type}</h4><button className="m7-icon-btn" aria-label="Close block editor" onClick={() => setSelBlock(null)}><Icon name="x" size={11} /></button></div>
                    <BlockFields
                      node={sel}
                      siteId={siteId}
                      readOnly={readOnly}
                      onChange={(key, value) => patchTpl((t) => {
                        const b = t.blocks.find((x) => x.id === sel.id);
                        if (b) b.props = { ...b.props, [key]: value };
                      })}
                    />
                    <p className="m7-muted">Changes stay in this draft until you press Save.</p>
                  </div>
                );
              })()}
              <div className="m7-sec">
                <div className="m7-sec-h"><h4>Starting blocks</h4><span>{tplDraft.blocks.length}</span></div>
                <div className="m7-seedlist">
                  {tplDraft.blocks.map((b, i) => (
                    <div key={b.id} className={`m7-seed ${selBlock === b.id ? "is-selected" : ""}`} onClick={() => setSelBlock(b.id)}>
                      <span className="m7-seed-i">{i + 1}</span>
                      <span className="m7-seed-type">{b.type}</span>
                      <span className="m7-seed-meta">{(b.props as any)?.title ?? (b.props as any)?.text ?? "—"}</span>
                      <button className="m7-icon-btn" aria-label={`Move ${b.type} up`} disabled={i === 0 || readOnly} onClick={() => patchTpl((t) => { [t.blocks[i - 1], t.blocks[i]] = [t.blocks[i], t.blocks[i - 1]]; })}><Icon name="chevDown" size={11} className="m7-up" /></button>
                      <button className="m7-icon-btn" aria-label={`Remove ${b.type}`} disabled={readOnly} onClick={() => patchTpl((t) => { t.blocks = t.blocks.filter((x) => x.id !== b.id); })}><Icon name="x" size={11} /></button>
                    </div>
                  ))}
                </div>
                <Btn icon="blocks" onClick={() => { location.hash = `#/library?site=${siteId}`; }}>Add blocks in the library</Btn>
              </div>
              <div className="m7-insp-foot">
                <Btn variant="primary" icon="check" disabled={readOnly || same(tplDraft, currentTpl)} onClick={async () => {
                  try {
                    const saved = await LayoutsAPI.saveTemplate(tplDraft, currentTpl?.rev ?? tplDraft.rev);
                    app.toast({ type: "success", title: `${saved.name} saved`, sub: `Revision ${saved.rev}.` });
                    setTick((n) => n + 1);
                  } catch (e) { app.toast({ type: "error", title: "Could not save the template", sub: (e as Error).message }); }
                }}>Save</Btn>
              </div>
            </div>
          ) : (
            <div className="m7-pane">
              <div className="m7-sec">
                <div className="m7-sec-h"><h4>{tab === "templates" ? "Pages created from this template" : "Usage"}</h4></div>
                <p className="m7-muted">
                  {tab === "templates"
                    ? `${DBX().cmsPages.filter((p) => p.siteId === siteId && p.template === currentTpl?.name).length} page(s) started from ${currentTpl?.name}. Editing the template will not change them.`
                    : "Select a layout to see its bound pages."}
                </p>
                {tab === "templates" && (
                  <div className="m7-usage-list">
                    {DBX().cmsPages.filter((p) => p.siteId === siteId && p.template === currentTpl?.name).slice(0, 8).map((p) => (
                      <div key={p.id} className="m7-usage-row">
                        <span className="m7-usage-body">
                          <span className="m7-usage-title">{p.title}</span>
                          <span className="m7-usage-path">{p.path}</span>
                        </span>
                        <button className="m7-icon-btn" aria-label={`Open ${p.title}`} onClick={() => { location.hash = `#/builder?site=${siteId}&page=${p.id}`; }}><Icon name="arrowRight" size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ---------------- overlays ---------------- */}

      <Popover anchor={menuAnchor} open={!!menuFor} onClose={() => { setMenuFor(null); setMenuAnchor(null); }}>
        {(() => {
          const l = layouts.find((x) => x.id === menuFor);
          const t = templates.find((x) => x.id === menuFor);
          if (t) {
            return (
              <>
                <MenuLabel>Template</MenuLabel>
                <MenuItem icon="eye" onClick={() => { choose(t.id, "templates"); setPreviewOpen(false); }}>Preview starter</MenuItem>
                <MenuItem icon="plus" disabled={readOnly} onClick={() => { setMenuFor(null); setCreatePageFor(t); }}>Create page from this</MenuItem>
                <MenuItem icon="copy" disabled={readOnly} onClick={() => { setMenuFor(null); setCreateKind("templates"); }}>Duplicate…</MenuItem>
                <MenuItem icon="download" onClick={() => { setMenuFor(null); exportTemplate(t, layouts.find((l) => l.id === t.layoutId)?.name ?? "Website default"); app.toast({ type: "success", title: `${t.name} exported as JSON`, sub: "Round-trips: import that file anywhere, including here." }); }}>Export as JSON</MenuItem>
                <MenuItem icon="upload" disabled={readOnly} onClick={() => { setMenuFor(null); setImportOpen(true); }}>Import a file…</MenuItem>
                <MenuItem icon="trash" danger disabled={!canDelete || t.builtIn} onClick={() => { setMenuFor(null); setArchiveFor({ kind: "template", id: t.id, name: t.name, builtIn: t.builtIn, isDefault: false, pages: 0 }); }}>Delete template</MenuItem>
              </>
            );
          }
          if (!l) return null;
          const pages = usageRows(siteId, l.id).length;
          return (
            <>
              <MenuLabel>Layout</MenuLabel>
              <MenuItem icon="eye" onClick={() => { setSel(l.id); setTab("layouts"); setMenuFor(null); setPreviewOpen(true); }}>Preview layout</MenuItem>
              <MenuItem icon="link" disabled={readOnly || l.archived} onClick={() => { setSel(l.id); setTab("layouts"); setItab("usage"); setMenuFor(null); }}>Reassign pages ({pages})</MenuItem>
              <MenuItem icon="check" disabled={readOnly || l.isDefault || l.archived} onClick={() => { setSel(l.id); void setDefault(); setMenuFor(null); }}>Set as website default</MenuItem>
              <MenuItem icon="copy" disabled={readOnly} onClick={() => { setMenuFor(null); void duplicate(l); }}>Duplicate layout</MenuItem>
              <MenuLabel>Danger</MenuLabel>
              {l.archived ? (
                <MenuItem icon="refresh" disabled={!canDelete} onClick={async () => { setMenuFor(null); try { await LayoutsAPI.restore("layout", l.id); setTick((n) => n + 1); app.toast({ type: "success", title: `${l.name} restored` }); } catch (e) { app.toast({ type: "error", title: "Could not restore", sub: (e as Error).message }); } }}>Restore layout</MenuItem>
              ) : (
                <MenuItem icon="trash" danger disabled={!canDelete} onClick={() => { setMenuFor(null); setArchiveFor({ kind: "layout", id: l.id, name: l.name, builtIn: true, isDefault: l.isDefault, pages }); }}>Archive layout</MenuItem>
              )}
            </>
          );
        })()}
      </Popover>

      <Popover anchor={seedMenu} open={!!seedMenu} onClose={() => setSeedMenu(null)}>
        <MenuLabel>Add a seed block</MenuLabel>
        {(draft ? (draft.slot.policy.allow.length ? draft.slot.policy.allow : (Object.keys(REGISTRY) as BlockType[])) : []).map((t) => (
          <MenuItem
            key={t}
            onClick={() => {
              const block = REGISTRY[t].defaults();
              patch((d) => { d.slot.seed = [...d.slot.seed, block]; });
              setSeedMenu(null);
            }}
          >{t}<span className="m7-menu-meta">{REGISTRY[t].group}</span></MenuItem>
        ))}
      </Popover>

      <Popover anchor={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)}>
        <MenuLabel>Sort by</MenuLabel>
        {SORTS.map((s) => (
          <MenuItem key={s.id} icon={sort === s.id ? "check" : undefined} onClick={() => { setSort(s.id); setFilterMenu(null); }}>{s.label}</MenuItem>
        ))}
        {tab === "layouts" && (
          <>
            <MenuLabel>Visibility</MenuLabel>
            <MenuItem icon={archivedOpen ? "check" : undefined} onClick={() => { setArchivedOpen((v) => !v); setFilterMenu(null); }}>Include archived layouts</MenuItem>
          </>
        )}
      </Popover>

      {historyFor && (
        <HistoryModal
          kind={historyFor.kind}
          id={historyFor.id}
          name={historyFor.name}
          onClose={() => setHistoryFor(null)}
          onRestored={() => { setTick((n) => n + 1); }}
        />
      )}

      {prebuiltOpen && (
        <PrebuiltModal
          siteId={siteId}
          onClose={() => setPrebuiltOpen(false)}
          onDone={(made) => { setPrebuiltOpen(false); setTick((n) => n + 1); setTab("templates"); setItab("overview"); setSel(made[0]?.id ?? null); }}
        />
      )}

      {importOpen && (
        <ImportModal
          siteId={siteId}
          layouts={layouts}
          onClose={() => setImportOpen(false)}
          onDone={(made) => { setImportOpen(false); setTick((n) => n + 1); setTab("templates"); setItab("overview"); setSel(made[0]?.id ?? null); }}
        />
      )}

      {createKind === "layouts" && (
        <CreateLayoutModal
          siteId={siteId} layouts={layouts}
          onClose={() => setCreateKind(null)}
          onDone={(made) => { setCreateKind(null); setTick((n) => n + 1); setTab("layouts"); setSel(made.id); }}
        />
      )}
      {createKind === "templates" && (
        <CreateTemplateModal
          siteId={siteId} templates={templates} layouts={layouts}
          onClose={() => setCreateKind(null)}
          onDone={(made) => { setCreateKind(null); setTick((n) => n + 1); setTab("templates"); setSel(made.id); }}
        />
      )}
      {archiveFor && (
        <ArchiveModal
          target={archiveFor}
          onClose={() => setArchiveFor(null)}
          onDone={() => { setArchiveFor(null); setTick((n) => n + 1); }}
        />
      )}
      {previewOpen && previewLayout && previewFrame && (
        <PreviewModal siteId={siteId} layout={previewLayout} frame={previewFrame} onClose={() => setPreviewOpen(false)} />
      )}
      {regionFor && (
        <RegionDrawer region={regionFor} onClose={() => setRegionFor(null)} onDone={() => { setRegionFor(null); setTick((n) => n + 1); }} />
      )}
      {seoOpen && draft && <SeoModal layout={draft} onClose={() => setSeoOpen(false)} />}
      {pfOpen && <PreflightModal issues={pf} onClose={() => setPfOpen(false)} onFix={() => { setPfOpen(false); location.hash = `#/pages?site=${siteId}`; }} />}
      {policyOpen && draft && (
        <PolicyModal
          allow={draft.slot.policy.allow} deny={draft.slot.policy.deny} maxBlocks={draft.slot.policy.maxBlocks}
          onClose={() => setPolicyOpen(false)}
          onSave={(p) => { setPolicyOpen(false); patch((d) => { d.slot.policy = p; }); app.toast({ type: "info", title: "Slot policy updated", sub: "Save the layout to make it live for editors." }); }}
        />
      )}
      {reassignSel && (
        <ReassignModal
          siteId={siteId} layoutId={draft?.id ?? ""} layouts={layouts} preselected={reassignSel}
          onClose={() => setReassignSel(null)}
          onDone={() => { setReassignSel(null); setPicked([]); setTick((n) => n + 1); }}
        />
      )}
      {createPageFor && (
        <CreatePageModal
          siteId={siteId} template={createPageFor} layouts={layouts}
          onClose={() => setCreatePageFor(null)}
          onDone={(id) => { setCreatePageFor(null); setTick((n) => n + 1); location.hash = `#/builder?site=${siteId}&page=${id}`; }}
        />
      )}
      {conflict && (
        <ConflictModal
          message={conflict}
          onClose={() => setConflict(null)}
          onReload={() => { setConflict(null); setTick((n) => n + 1); }}
          onOverwrite={() => {
            setConflict(null);
            const base = layouts.find((l) => l.id === draft?.id);
            if (draft && base) { setDraft({ ...draft, rev: base.rev }); }
            app.toast({ type: "info", title: "Rebased on their revision", sub: "Press Save again to write your version as a new revision." });
          }}
        />
      )}
      {pending && (
        <LeaveModal
          onStay={() => setPending(null)}
          onLeave={() => { const run = pending; setPending(null); setDraft(null); run(); }}
        />
      )}
    </div>
  );
}
