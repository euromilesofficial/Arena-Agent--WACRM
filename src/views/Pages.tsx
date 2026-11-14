/* ============================================================
   Module 3 · Pages & Routes
   Left hierarchy → central registry → right selected-page inspector.
   Every control has a destination; every async path has a state.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Btn, MenuItem, Pill, Popover } from "../components/ui";
import { useApp } from "@/lib/store";
import { API, type CmsPage, type PageCounts, type PageSummary, type PageType, type TreeNode } from "@/lib/data";
import type { PageIssue } from "@/lib/cms-pages";
import { PageTree } from "../components/pages/PageTree";
import { PageInspector, PageThumb } from "../components/pages/PageInspector";
import { CreatePageModal, DuplicateModal, EditDetailsModal, HomepageModal, MoveModal, PreviewModal, RestoreModal, TrashModal } from "../components/pages/PageModals";

type Tab = "all" | "published" | "drafts" | "trash";
type SortKey = "title" | "path" | "type" | "status" | "updated";

interface ListResult {
  rows: CmsPage[]; total: number; page: number; pageSize: number;
  counts: PageCounts; summary: PageSummary; authors: string[];
}

const BUILDER_BLOCKS: { name: string; kind: "hero" | "text" | "cards" | "quote" | "cta" }[] = [
  { name: "Hero", kind: "hero" },
  { name: "Rich text", kind: "text" },
  { name: "Course cards", kind: "cards" },
  { name: "Testimonial", kind: "quote" },
  { name: "CTA band", kind: "cta" }
];

/** #/pages?site=&tab=&q=&page=&sel= — parsed before the first render so a
    deep link never flashes the default view first */
function readPageHash() {
  const raw = typeof location === "undefined" ? "" : location.hash.replace(/^#\/?/, "");
  const [, qs] = raw.split("?");
  const p = new URLSearchParams(qs ?? "");
  const tab = p.get("tab");
  const site = p.get("site") ?? p.get("psite");
  const page = Number(p.get("page") ?? "");
  return {
    site: site && site !== "all" ? site : null,
    tab: tab === "published" || tab === "drafts" || tab === "trash" ? (tab as Tab) : "all" as Tab,
    q: p.get("q") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sel: p.get("sel") || null
  };
}

const TAB_LABEL: Record<Tab, string> = { all: "All Pages", published: "Published", drafts: "Drafts", trash: "Trash" };
const EMPTY_COUNTS: PageCounts = { all: 0, published: 0, drafts: 0, trash: 0, changes: 0, issues: 0 };
const EMPTY_SUMMARY: PageSummary = { total: 0, published: 0, drafts: 0, issues: 0, changes: 0, gauge: null, countsAsOf: "—" };

export function Pages() {
  const app = useApp();
  const denied = !app.can("create");
  const canDelete = app.can("delete");

  const boot = useMemo(readPageHash, []);
  const [siteId, setSiteId] = useState(boot.site ?? "site_main");
  const [tab, setTab] = useState<Tab>(boot.tab);
  const [q, setQ] = useState(boot.q);
  const [search, setSearch] = useState(boot.q);
  const [type, setType] = useState<PageType | "all">("all");
  const [status, setStatus] = useState<"all" | "published" | "draft" | "changes">("all");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [pageNo, setPageNo] = useState(boot.page);
  const [pageSize, setPageSize] = useState(8);

  const [list, setList] = useState<ListResult | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(boot.sel);
  const [detail, setDetail] = useState<{ page: CmsPage; parent: CmsPage | null; issues: PageIssue[]; children: CmsPage[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staleDetail, setStaleDetail] = useState(false);

  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [siteMenu, setSiteMenu] = useState(false);
  const [siteQuery, setSiteQuery] = useState("");
  const [filterMenu, setFilterMenu] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [onlyLanding, setOnlyLanding] = useState(false);
  const [treeMenu, setTreeMenu] = useState(false);
  const [builderPage, setBuilderPage] = useState<CmsPage | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [trashTaken, setTrashTaken] = useState(false);
  const [expandTick, setExpandTick] = useState(0);
  const [collapseTick, setCollapseTick] = useState(0);

  type Modal =
    | { kind: "create"; parentId: string | null }
    | { kind: "edit" | "duplicate" | "move" | "home" | "trash" | "restore" | "preview"; page: CmsPage }
    | { kind: "bulk-trash" };
  const [modal, setModal] = useState<Modal | null>(null);

  const siteRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const treeRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const selRef = useRef<string | null>(null);

  const site = app.data?.sites?.find((s) => s.id === siteId) ?? app.data?.sites?.[0] ?? null;
  const siteName = site?.name ?? "Website";
  const sitePages = useMemo(() => (list?.rows ?? []), [list]);

  /* ---------- loading ---------- */
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [res, nodes] = await Promise.all([
        API.getPages({ siteId, tab, q: search, type, status, author, onlyIssues, onlyLanding, sort, dir, page: pageNo, pageSize }),
        API.getPageTree(siteId)
      ]);
      if (app.demo === "empty") {
        setList({ ...res, rows: [], total: 0, counts: EMPTY_COUNTS, summary: EMPTY_SUMMARY });
        setTree([]);
        setSelectedId(null);
        return;
      }
      setList(res);
      setTree(nodes);
      /* a selection only ever applies to what is on screen — pruning here is what
         stops a bulk action from silently touching a page you filtered away */
      setBulk((prev) => {
        if (!prev.size) return prev;
        const keep = new Set(res.rows.map((r) => r.id));
        const next = new Set([...prev].filter((id) => keep.has(id)));
        return next.size === prev.size ? prev : next;
      });
      setSelectedId((cur) => (cur && res.rows.some((r) => r.id === cur)) || cur ? cur : res.rows[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pages could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, tab, search, type, status, author, onlyIssues, onlyLanding, sort, dir, pageNo, pageSize, app.demo]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPageNo(1); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  /* only the newest detail request may write state — a stale response must never
     overwrite the page the user just selected */
  const detailReq = useRef(0);
  selRef.current = selectedId;
  const loadDetail = useCallback(async (id: string | null) => {
    const mine = ++detailReq.current;
    if (!id) { setDetail(null); setDetailLoading(false); return; }
    setDetailLoading(true);
    setStaleDetail(false);
    try {
      const res = await API.getPage(id);
      if (mine !== detailReq.current) return;
      setDetail({ page: res.page, parent: res.parent, issues: res.issues, children: res.children });
    } catch {
      if (mine !== detailReq.current) return;
      setDetail(null);
      setStaleDetail(true);
    } finally {
      if (mine === detailReq.current) setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void loadDetail(selectedId); }, [selectedId, loadDetail]);

  const selectSite = (id: string) => {
    setSiteId(id); setSelectedId(null); setDetail(null); setBulk(new Set()); setPageNo(1); setSiteMenu(false); setSiteQuery("");
  };

  const after = (msg: { title: string; sub?: string; type?: "success" | "info" | "warn"; action?: { label: string; onClick: () => void } }) => {
    app.toast({ type: msg.type ?? "success", title: msg.title, sub: msg.sub, action: msg.action });
    void load({ silent: true });
    void loadDetail(selRef.current);
  };

  const counts = list?.counts ?? EMPTY_COUNTS;
  const summary = list?.summary ?? EMPTY_SUMMARY;
  const rows = list?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((list?.total ?? 0) / pageSize));
  const from = list && list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const to = list ? Math.min(list.page * list.pageSize, list.total) : 0;
  const anyFilter = type !== "all" || status !== "all" || author !== "all" || onlyIssues || onlyLanding;

  const sortBy = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir("asc"); }
  };

  const toggleBulk = (id: string) => setBulk((b) => { const n = new Set(b); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => bulk.has(r.id));

  const openPreview = async (page: CmsPage) => {
    setPreviewBusy(true);
    try {
      await API.previewPage(page.id);
      setModal({ kind: "preview", page });
    } catch {
      app.toast({ type: "warn", title: "Preview unavailable", sub: "The signed preview could not be created. Try again." });
    } finally {
      setPreviewBusy(false);
    }
  };

  const openLive = (page: CmsPage) => {
    app.toast({ type: "info", title: "Opening live page", sub: `euromiles.in${page.path} · served from release v1.24` });
  };

  const selectRow = (id: string) => { setSelectedId(id); };

  /* ---------- hash edits + back/forward ---------- */
  useEffect(() => {
    const apply = () => {
      if (!location.hash.startsWith("#/pages")) return;
      /* the shell rewrites this hash for its own params; only react when the
         link actually carries page-registry params */
      const qs = location.hash.split("?")[1] ?? "";
      if (!/[?&](tab|q|page|sel)=/.test("?" + qs)) return;
      const h = readPageHash();
      if (h.site) setSiteId(h.site);
      setTab(h.tab); setQ(h.q); setSearch(h.q); setPageNo(h.page);
      if (h.sel) setSelectedId(h.sel);
    };
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", apply);
    return () => { window.removeEventListener("hashchange", apply); window.removeEventListener("popstate", apply); };
  }, []);

  /* ---------- shareable URL ---------- */
  useEffect(() => {
    if (typeof location === "undefined" || !location.hash.startsWith("#/pages")) return;
    const params = new URLSearchParams();
    params.set("site", siteId);
    if (tab !== "all") params.set("tab", tab);
    if (search) params.set("q", search);
    if (pageNo > 1) params.set("page", String(pageNo));
    if (selectedId) params.set("sel", selectedId);
    const next = `#/pages?${params.toString()}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }, [siteId, tab, search, pageNo, selectedId]);

  /* ---------- keyboard: focus search with / ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && bulk.size) setBulk(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bulk.size]);

  const selectedPage = detail?.page ?? null;
  const currentHome = useMemo(() => {
    const home = tree.find((n) => n.isHome);
    return home ? ({ id: home.id, title: home.title } as { id: string; title: string }) : null;
  }, [tree]);

  /* ---------------- builder handoff ---------------- */
  if (builderPage) {
    return (
      <div className="d3-builder">
        <div className="page-head">
          <div>
            <div className="crumb-inline"><button className="link" onClick={() => setBuilderPage(null)}>Pages</button><Icon name="chevRight" size={10} /><span>Visual Builder</span></div>
            <h1 className="page-title">{builderPage.title}</h1>
            <p className="page-sub">{siteName} · {builderPage.path} · draft {builderPage.hasChanges ? "with unsaved-to-release edits" : "in sync"}</p>
          </div>
          <div className="toolbar">
            <Pill tone="violet" dot>Module 4 · next</Pill>
            <Btn icon="arrowLeft" onClick={() => setBuilderPage(null)}>Back to Pages</Btn>
          </div>
        </div>
        <div className="d3-builder-grid">
          <aside className="card d3-builder-rail">
            <div className="d3-card-head"><div className="d3-card-title"><Icon name="blocks" size={13} /> Page blocks</div><span className="f10 muted num">{builderPage.blocks}</span></div>
            <div className="d3-builder-blocklist">
              {BUILDER_BLOCKS.map((b, i) => (
                <div key={b.name} className="d3-builder-block"><span className="d3-builder-grip" /><Icon name="blocks" size={11} /> {b.name}<span className="f10 muted num" style={{ marginLeft: "auto" }}>{i + 1}</span></div>
              ))}
            </div>
            <div className="d3-builder-locked"><Icon name="lock" size={11} /> Editing unlocks in Module 4</div>
          </aside>

          <section className="card d3-builder-canvas">
            <div className="d3-builder-chrome">
              <span className="f10 muted mono truncate">euromiles.in{builderPage.path}</span>
              <span className="grow" />
              <Pill tone={builderPage.status === "published" ? "green" : "amber"} dot>{builderPage.status === "published" ? "Live release" : "Draft"}</Pill>
            </div>
            <div className="d3-builder-stage">
              <div className="d3-doc">
                {BUILDER_BLOCKS.map((b, i) => (
                  <div key={b.name} className={`d3-doc-block is-${b.kind}`}>
                    <div className="d3-doc-tag"><Icon name="blocks" size={9} /> {i + 1} · {b.name}</div>
                    {b.kind === "hero" ? (
                      <div className="d3-doc-hero">
                        <span className="d3-doc-h" /><span className="d3-doc-h short" />
                        <span className="d3-doc-cta" />
                      </div>
                    ) : b.kind === "cards" ? (
                      <div className="d3-doc-cards">{[0, 1, 2].map((k) => <span key={k} className="d3-doc-card" />)}</div>
                    ) : b.kind === "quote" ? (
                      <div className="d3-doc-quote"><span className="d3-doc-av" /><span className="d3-doc-line" /><span className="d3-doc-line short" /></div>
                    ) : (
                      <div className="d3-doc-lines">
                        <span className="d3-doc-line" /><span className="d3-doc-line" /><span className="d3-doc-line short" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="d3-builder-note">
              <Icon name="sparkles" size={14} />
              <div>
                <div className="f12 w650">The Visual Builder is Module 4</div>
                <div className="f11 muted">This handoff screen carries the page, site and draft context so the builder opens straight into “{builderPage.title}”. Autosave, CAS and preview land with that module.</div>
              </div>
            </div>
          </section>

          <aside className="card d3-builder-side">
            <div className="d3-card-head"><div className="d3-card-title"><Icon name="info" size={13} /> Context handed over</div></div>
            <div className="d3-meta">
              <div className="d3-meta-row"><span className="d3-meta-k">Page</span><span className="d3-meta-v">{builderPage.title}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Route</span><span className="d3-meta-v mono">{builderPage.path}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Website</span><span className="d3-meta-v">{siteName}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Template</span><span className="d3-meta-v">{builderPage.template}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Layout</span><span className="d3-meta-v">{builderPage.layout}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Blocks</span><span className="d3-meta-v num">{builderPage.blocks}</span></div>
              <div className="d3-meta-row"><span className="d3-meta-k">Revision</span><span className="d3-meta-v num">r{builderPage.revision}</span></div>
            </div>
            <div className="d3-builder-actions">
              <Btn icon="eye" onClick={() => void openPreview(builderPage)}>Preview draft</Btn>
              <Btn icon="arrowLeft" onClick={() => setBuilderPage(null)}>Back to Pages</Btn>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------- render ---------------- */
  return (
    <>
      <div className="page-head d3-head">
        <div>
          <h1 className="page-title">Pages</h1>
          <p className="page-sub">Create, organize, and manage all pages for your website.</p>
        </div>
        <div className="toolbar">
          <button className="select-btn d3-site" ref={siteRef} onClick={() => setSiteMenu((o) => !o)} aria-haspopup="menu" aria-expanded={siteMenu}>
            <span className="d3-site-thumb" aria-hidden="true" />
            <span className="d3-site-txt">
              <span className="f10 muted">Website</span>
              <span className="val truncate">{siteName}</span>
            </span>
            <Icon name="chevDown" size={12} className="chev" />
          </button>
          <Btn icon="external" disabled={!site?.release}
            title={site?.release ? `Open ${site.host}` : "This website has no published release yet"}
            onClick={() => app.toast({ type: "info", title: "Opening live site", sub: `${site?.host} · release ${site?.release}` })}>
            View Live Site
          </Btn>
          <Btn icon="eye" disabled={!selectedPage} title={selectedPage ? "Preview the selected page" : "Select a page to preview"}
            onClick={() => selectedPage && void openPreview(selectedPage)}>Preview</Btn>
          <Btn variant="primary" icon="plus" disabled={denied} title={denied ? "Your role can browse but not create pages" : undefined}
            onClick={() => setModal({ kind: "create", parentId: selectedPage && !selectedPage.isHome && !selectedPage.trash ? selectedPage.id : null })}>New Page</Btn>
        </div>
      </div>

      {app.demo === "error" && (
        <div className="d2-alert is-error" role="status">
          <Icon name="alert" size={13} />
          <span className="grow">Pages service unavailable (503) — the hierarchy and registry below hold their last known state.</span>
          <Btn className="btn-sm" onClick={() => { void load(); }}>Retry</Btn>
        </div>
      )}

      {error && app.demo !== "error" && (
        <div className="d2-alert is-error" role="status">
          <Icon name="alert" size={13} />
          <span className="grow">{error}</span>
          <Btn className="btn-sm" onClick={() => { void load(); }}>Retry</Btn>
        </div>
      )}

      {app.role === "Viewer" && (
        <div className="d1-readonly" role="status">
          <Icon name="lock" size={13} />
          <span className="f12 grow">You are viewing <b>Pages</b> as a Viewer. Creating, editing, moving and deleting are disabled; search, preview and drill-downs still work.</span>
        </div>
      )}

      {/* KPI strip */}
      <div className="d3-kpis">
        <Kpi icon="file" label="Total Pages" value={loading ? null : counts.all} foot={`${summary.changes} with unpublished changes`}
          onClick={() => { setTab("all"); setPageNo(1); }} />
        <Kpi icon="check" label="Published" value={loading ? null : counts.published} foot="In the live release"
          onClick={() => { setTab("published"); setPageNo(1); }} />
        <Kpi icon="pencil" label="Drafts" value={loading ? null : counts.drafts} foot="Never published"
          onClick={() => { setTab("drafts"); setPageNo(1); }} />
        <Kpi icon="alert" label="Issues" value={loading ? null : counts.issues} tone={counts.issues ? "red" : "green"}
          foot={counts.issues ? "Across this website" : "No issues found"}
          onClick={() => { setStatus("changes"); setTab("all"); setPageNo(1); setFilterMenu(false); }} />
        <div className="d2-kpi is-static">
          <div className="d3-gauge" style={{ ["--pct" as string]: `${summary.gauge ?? 0}` }} role="img"
            aria-label={`${summary.gauge ?? 0}% of pages published`}>
            <span className="d3-gauge-val">{summary.gauge === null ? "—" : `${summary.gauge}%`}</span>
          </div>
          <div className="d3-gauge-meta">
            <span className="d3-kpi-lab">Published</span>
            <span className="d3-gauge-foot num">{counts.published} / {counts.all} pages</span>
          </div>
        </div>
      </div>

      <div className="d3-grid">
        <PageTree
          nodes={tree} selectedId={selectedId} loading={loading && !tree.length} readOnly={denied}
          onSelect={selectRow}
          onCreateAt={(parentId) => setModal({ kind: "create", parentId: parentId === (tree.find((n) => n.isHome)?.id ?? "") ? null : parentId })}
          onOptions={() => setTreeMenu(true)} expandSignal={expandTick} collapseSignal={collapseTick} />

        {/* ---------- registry ---------- */}
        <section className="card d3-reg" aria-label="Page registry">
          <div className="d3-tabs" role="tablist" aria-label="Page status">
            {(["all", "published", "drafts", "trash"] as Tab[]).map((t) => {
              const n = t === "all" ? counts.all : t === "published" ? counts.published : t === "drafts" ? counts.drafts : counts.trash;
              return (
                <button key={t} role="tab" aria-selected={tab === t} className={`d3-tab ${tab === t ? "is-on" : ""}`}
                  onClick={() => { setTab(t); setPageNo(1); setBulk(new Set()); setSelectedId(null); }}>
                  <Icon name={t === "all" ? "layers" : t === "published" ? "check" : t === "drafts" ? "pencil" : "trash"} size={12} />
                  {TAB_LABEL[t]} <span className="d3-tab-n num">{loading ? "·" : n}</span>
                </button>
              );
            })}
          </div>

          <div className="d3-reg-tools">
            <div className="d3-search">
              <Icon name="search" size={12} />
              <input ref={searchRef} className="input bare" placeholder="Search title or slug"
                aria-label="Search pages" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="icon-btn icon-sm" aria-label="Clear search" onClick={() => setQ("")}><Icon name="x" size={11} /></button>}
            </div>
            <select className="input d3-select" aria-label="Filter by type" value={type}
              onChange={(e) => { setType(e.target.value as PageType | "all"); setPageNo(1); }}>
              <option value="all">All Types</option>
              <option value="standard">Standard page</option>
              <option value="landing">Landing page</option>
            </select>
            <select className="input d3-select" aria-label="Filter by status" value={status}
              onChange={(e) => { setStatus(e.target.value as "all" | "published" | "draft" | "changes"); setPageNo(1); }}>
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="changes">Unpublished changes</option>
            </select>
            <select className="input d3-select hide-narrow" aria-label="Filter by author" value={author}
              onChange={(e) => { setAuthor(e.target.value); setPageNo(1); }}>
              <option value="all">All Authors</option>
              {(list?.authors ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button className={`icon-btn ${anyFilter ? "is-on" : ""}`} ref={filterRef} aria-label="More filters" aria-haspopup="menu"
              onClick={() => setFilterMenu((o) => !o)}>
              <Icon name="filter" size={14} />
            </button>
          </div>

          {bulk.size > 0 && (
            <div className="d3-bulk" role="status">
              <span className="f11 w600">{bulk.size} selected</span>
              <span className="f10 muted">· {rows.length} on this page</span>
              <span className="grow" />
              <button className="link f11" onClick={() => setBulk(new Set(rows.map((r) => r.id)))}>Select all on page</button>
              <button className="link f11" onClick={() => setBulk(new Set())}>Clear</button>
              <Btn className="btn-sm" icon="trash" disabled={!canDelete} onClick={() => setModal({ kind: "bulk-trash" })}>Move to Trash</Btn>
            </div>
          )}

          <div className="d3-tblwrap">
            <table className="d3-tbl">
              <thead>
                <tr>
                  <th className="d3-c-check">
                    <input type="checkbox" aria-label="Select all pages on this page" checked={allOnPage}
                      onChange={(e) => setBulk(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
                  </th>
                  <th className="d3-c-title" aria-sort={sort === "title" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button className="d3-th" onClick={() => sortBy("title")}>Page Title <SortArrow on={sort === "title"} dir={dir} /></button>
                  </th>
                  <th className="d3-c-slug" aria-sort={sort === "path" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button className="d3-th" onClick={() => sortBy("path")}>Slug (URL) <SortArrow on={sort === "path"} dir={dir} /></button>
                  </th>
                  <th className="d3-c-type" aria-sort={sort === "type" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button className="d3-th" onClick={() => sortBy("type")}>Type <SortArrow on={sort === "type"} dir={dir} /></button>
                  </th>
                  <th className="d3-c-status" aria-sort={sort === "status" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button className="d3-th" onClick={() => sortBy("status")}>Status <SortArrow on={sort === "status"} dir={dir} /></button>
                  </th>
                  <th className="d3-c-upd" aria-sort={sort === "updated" ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button className="d3-th" onClick={() => sortBy("updated")}>Last Updated <SortArrow on={sort === "updated"} dir={dir} /></button>
                  </th>
                  <th className="d3-c-act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !rows.length && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="d3-c-check"><span className="sk sk-line" style={{ width: 12 }} /></td>
                    <td className="d3-c-title"><span className="sk sk-line" style={{ width: 140 }} /></td>
                    <td className="d3-c-slug"><span className="sk sk-line" style={{ width: 90 }} /></td>
                    <td className="d3-c-type"><span className="sk sk-line" style={{ width: 46 }} /></td>
                    <td className="d3-c-status"><span className="sk sk-line" style={{ width: 58 }} /></td>
                    <td className="d3-c-upd"><span className="sk sk-line" style={{ width: 62 }} /></td>
                    <td className="d3-c-act" />
                  </tr>
                ))}

                {!loading && !rows.length && (
                  <tr>
                    <td colSpan={7}>
                      <div className="d3-empty">
                        <Icon name="file" size={20} />
                        <div className="f12 w650">
                          {tab === "trash" ? "The trash is empty" : search || anyFilter ? "No pages match your search" : "No pages yet"}
                        </div>
                        <div className="f11 muted">
                          {tab === "trash" ? "Deleted pages stay recoverable here for 30 days."
                            : search || anyFilter ? "Try a different keyword, or clear the filters to see all pages."
                              : "Create your first page — the homepage is a good place to start."}
                        </div>
                        {tab !== "trash" && (search || anyFilter)
                          ? <Btn className="btn-sm" onClick={() => { setQ(""); setSearch(""); setType("all"); setStatus("all"); setAuthor("all"); }}>Clear filters</Btn>
                          : tab !== "trash" ? <Btn className="btn-sm" variant="primary" icon="plus" disabled={denied} onClick={() => setModal({ kind: "create", parentId: null })}>Create First Page</Btn>
                            : null}
                      </div>
                    </td>
                  </tr>
                )}

                {rows.map((p) => {
                  const isSel = selectedId === p.id;
                  return (
                    <tr key={p.id} className={`d3-row ${isSel ? "is-sel" : ""} ${bulk.has(p.id) ? "is-bulk" : ""}`}
                      onClick={() => selectRow(p.id)} aria-selected={isSel}>
                      <td className="d3-c-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={bulk.has(p.id)} aria-label={`Select ${p.title}`} onChange={() => toggleBulk(p.id)} />
                      </td>
                      <td className="d3-c-title">
                        <div className="d3-titlecell">
                          <span className="d3-rowthumb"><PageThumb page={p} /></span>
                          <span className="d3-titletxt">
                            <span className="d3-rowtitle truncate" title={p.title}>{p.title}</span>
                            <span className="d3-rowsub truncate">
                              {p.isHome && <Icon name="home" size={9} />} {p.blocks} blocks
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="d3-c-slug">
                        <button className="d3-slug mono truncate" title={`${p.path} · click to copy`}
                          onClick={(e) => { e.stopPropagation(); app.toast({ type: "info", title: "Path copied", sub: p.path }); }}>
                          {p.path}
                        </button>
                      </td>
                      <td className="d3-c-type"><span className="d3-typechip">{p.type === "landing" ? "Landing" : "Page"}</span></td>
                      <td className="d3-c-status">
                        <div className="d3-status">
                          {p.trash ? <Pill tone="grey" dot>Trashed</Pill>
                            : p.status === "published" ? <Pill tone="green" dot>Published</Pill>
                              : <Pill tone="amber" dot>Draft</Pill>}
                          {p.hasChanges && !p.trash && <span className="d3-changedot" title="Has unpublished changes" />}
                        </div>
                      </td>
                      <td className="d3-c-upd">
                        <div className="d3-upd">
                          <span className="d3-upd-when">{p.updated}</span>
                          <span className="d3-upd-by truncate">by {p.author}</span>
                        </div>
                      </td>
                      <td className="d3-c-act" onClick={(e) => e.stopPropagation()}>
                        <div className="d3-act">
                          {p.trash ? (
                            <>
                              <button className="icon-btn icon-sm" aria-label={`Restore ${p.title}`} disabled={denied}
                                title={denied ? "Read-only role" : "Restore this page as a draft"}
                                onClick={() => { setTrashTaken(false); setSelectedId(p.id); setModal({ kind: "restore", page: p }); }}>
                                <Icon name="refresh" size={13} /></button>
                              <button className="icon-btn icon-sm is-danger" aria-label={`Delete ${p.title} permanently`} disabled={!canDelete}
                                title={canDelete ? "Delete permanently" : "Your role cannot delete pages"}
                                onClick={() => { setSelectedId(p.id); setModal({ kind: "trash", page: p }); }}>
                                <Icon name="trash" size={13} /></button>
                            </>
                          ) : (
                            <>
                              <button className="icon-btn icon-sm" aria-label={`Edit ${p.title}`} disabled={denied}
                                title={denied ? "Read-only role" : "Open in the Visual Builder"}
                                onClick={() => setBuilderPage(p)}><Icon name="pencil" size={13} /></button>
                              <button className="icon-btn icon-sm" aria-label={`Open ${p.title}`}
                                title={p.status === "published" ? "Open live page" : "Preview draft"}
                                onClick={() => (p.status === "published" ? openLive(p) : void openPreview(p))}>
                                <Icon name={p.status === "published" ? "external" : "eye"} size={13} />
                              </button>
                            </>
                          )}
                          <button className="icon-btn icon-sm" aria-label={`Actions for ${p.title}`} aria-haspopup="menu"
                            aria-expanded={rowMenu === p.id}
                            ref={(el) => { rowRefs.current[p.id] = el; }}
                            onClick={() => setRowMenu((r) => (r === p.id ? null : p.id))}>
                            <Icon name="more" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d3-reg-foot">
            <span className="f11 muted">
              {loading ? "Loading pages…" : list?.total ? `Showing ${from}–${to} of ${list.total} pages` : "No pages to show"}
            </span>
            <div className="d3-pager">
              <select className="input d3-size" aria-label="Rows per page" value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageNo(1); }}>
                {[8, 16, 25].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <button className="d3-pg" disabled={pageNo <= 1} onClick={() => setPageNo((p) => Math.max(1, p - 1))} aria-label="Previous page"><Icon name="chevLeft" size={12} /></button>
              {pageNumbers(pageNo, totalPages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="d3-pg is-gap">…</span>
                : <button key={n} className={`d3-pg ${n === pageNo ? "is-on" : ""}`} onClick={() => setPageNo(n)} aria-current={n === pageNo ? "page" : undefined}>{n}</button>)}
              <button className="d3-pg" disabled={pageNo >= totalPages} onClick={() => setPageNo((p) => Math.min(totalPages, p + 1))} aria-label="Next page"><Icon name="chevRight" size={12} /></button>
            </div>
            <span className="f10 muted d3-sync">{refreshing ? "syncing…" : summary.countsAsOf}</span>
          </div>
        </section>

        <PageInspector
          page={staleDetail ? null : selectedPage}
          parent={detail?.parent ?? null}
          children={detail?.children ?? []}
          issues={detail?.issues ?? []}
          loading={detailLoading || (loading && !detail)}
          stale={staleDetail}
          readOnly={denied}
          canEdit={!denied}
          canDelete={canDelete}
          previewBusy={previewBusy}
          onPreview={() => selectedPage && void openPreview(selectedPage)}
          onEdit={() => selectedPage && setBuilderPage(selectedPage)}
          onEditDetails={() => selectedPage && setModal({ kind: "edit", page: selectedPage })}
          onMore={() => selectedPage && setRowMenu(selectedPage.id)}
          onOpenLive={() => selectedPage && openLive(selectedPage)}
          onRestore={() => { if (!selectedPage) return; setTrashTaken(false); setModal({ kind: "restore", page: selectedPage }); }}
          onDeleteForever={() => { if (!selectedPage) return; setModal({ kind: "trash", page: selectedPage }); }}
          onRefresh={() => { void load(); setSelectedId(rows[0]?.id ?? null); }}
          onPublishQueue={() => app.go("publishing")} />
      </div>

      <div className="d3-statusbar">
        <span className="d3-sb-item f11 muted"><Icon name="sitemap" size={11} /> {siteName} · {counts.all} pages · {counts.changes} unpublished changes</span>
        <span className="grow" />
        <span className="d3-sb-item"><Icon name="clock" size={10} /> {refreshing ? "syncing…" : summary.countsAsOf}</span>
        <span className="d3-sb-item">Press <kbd>/</kbd> to search · <kbd>Esc</kbd> clears selection</span>
      </div>

      {/* ---------- popovers ---------- */}
      <Popover anchor={siteRef.current} open={siteMenu} onClose={() => setSiteMenu(false)} className="w-320">
        <div className="d3-menu-search">
          <Icon name="search" size={12} />
          <input className="input bare" placeholder="Search websites…" value={siteQuery} aria-label="Search websites"
            onChange={(e) => setSiteQuery(e.target.value)} />
        </div>
        {(app.data?.sites ?? []).filter((s) => !s.archived && s.name.toLowerCase().includes(siteQuery.toLowerCase())).map((s) => (
          <MenuItem key={s.id} icon="globe" selected={s.id === siteId} onClick={() => selectSite(s.id)} meta={s.host}>
            {s.name}
          </MenuItem>
        ))}
        <div className="menu-sep" />
        <MenuItem icon="settings" onClick={() => { setSiteMenu(false); app.go("sites"); }}>Manage Websites</MenuItem>
      </Popover>

      <Popover anchor={filterRef.current} open={filterMenu} onClose={() => setFilterMenu(false)} className="w-300">
        <div className="d3-filter">
          <div className="f11 w650">Narrow by</div>
          <button className={`d3-filter-row is-toggle ${onlyIssues ? "is-on" : ""}`} role="switch" aria-checked={onlyIssues}
            onClick={() => { setOnlyIssues((v) => !v); setPageNo(1); }}>
            <span><Icon name="alert" size={12} /> Pages with issues</span>
            <span className="d3-switch" aria-hidden="true"><i /></span>
          </button>
          <button className={`d3-filter-row is-toggle ${onlyLanding ? "is-on" : ""}`} role="switch" aria-checked={onlyLanding}
            onClick={() => { setOnlyLanding((v) => !v); setPageNo(1); }}>
            <span><Icon name="zap" size={12} /> Landing pages only</span>
            <span className="d3-switch" aria-hidden="true"><i /></span>
          </button>
          <button className={`d3-filter-row is-toggle ${status === "changes" ? "is-on" : ""}`} role="switch" aria-checked={status === "changes"}
            onClick={() => { setStatus(status === "changes" ? "all" : "changes"); setPageNo(1); }}>
            <span><Icon name="refresh" size={12} /> Unpublished changes</span>
            <span className="d3-switch" aria-hidden="true"><i /></span>
          </button>
          <label className="d3-filter-row is-field"><span>Author</span>
            <select className="input d3-select" aria-label="Filter by author (panel)" value={author} onChange={(e) => { setAuthor(e.target.value); setPageNo(1); }}>
              <option value="all">All authors</option>
              {(list?.authors ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <div className="d3-filter-foot">
            <button className="link f11" onClick={() => { setOnlyIssues(false); setOnlyLanding(false); setStatus("all"); setType("all"); setAuthor("all"); }}>Reset filters</button>
            <Btn className="btn-sm" variant="primary" onClick={() => setFilterMenu(false)}>Done</Btn>
          </div>
        </div>
      </Popover>

      <Popover anchor={treeRef.current} open={treeMenu} onClose={() => setTreeMenu(false)} className="w-220">
        <MenuItem icon="layers" onClick={() => { setTreeMenu(false); setExpandTick((t) => t + 1); app.toast({ type: "info", title: "Structure expanded", sub: "Every branch is open" }); }}>Expand All</MenuItem>
        <MenuItem icon="columns" onClick={() => { setTreeMenu(false); setCollapseTick((t) => t + 1); app.toast({ type: "info", title: "Structure collapsed", sub: "Top-level pages only" }); }}>Collapse All</MenuItem>
        <MenuItem icon="refresh" onClick={() => { setTreeMenu(false); app.toast({ type: "info", title: "Structure refreshed" }); void load(); }}>Refresh Structure</MenuItem>
        <div className="menu-sep" />
        <MenuItem icon="link" onClick={() => { setTreeMenu(false); app.toast({ type: "info", title: "Full paths shown in the tree tooltip" }); }}>Show Full Paths</MenuItem>
      </Popover>

      {rowMenu && (() => {
        const p = rows.find((r) => r.id === rowMenu) ?? (selectedPage?.id === rowMenu ? selectedPage : null);
        if (!p) return null;
        return (
          <Popover anchor={rowRefs.current[p.id] ?? null} open onClose={() => setRowMenu(null)} className="w-240">
            {p.trash ? (
              <>
                <MenuItem icon="file" onClick={() => { setRowMenu(null); selectRow(p.id); }}>View Details</MenuItem>
                <MenuItem icon="refresh" onClick={() => { setRowMenu(null); setTrashTaken(false); setModal({ kind: "restore", page: p }); }}>Restore Page</MenuItem>
                <div className="menu-sep" />
                <MenuItem icon="trash" danger disabled meta="policy" onClick={() => app.toast({ type: "warn", title: "Permanent delete is disabled", sub: "Pages are purged automatically 30 days after deletion." })}>Permanently Delete</MenuItem>
              </>
            ) : (
              <>
                <MenuItem icon="blocks" disabled={denied} onClick={() => { setRowMenu(null); selectRow(p.id); setBuilderPage(p); }}>Edit Page</MenuItem>
                <MenuItem icon="eye" onClick={() => { setRowMenu(null); selectRow(p.id); void openPreview(p); }}>Preview Draft</MenuItem>
                <MenuItem icon="external" disabled={p.status !== "published"} meta={p.status !== "published" ? "not live" : undefined}
                  onClick={() => { setRowMenu(null); openLive(p); }}>Open Live Page</MenuItem>
                <MenuItem icon="chart" onClick={() => { setRowMenu(null); selectRow(p.id); app.toast({ type: "info", title: "Page analytics", sub: `Views, leads and conversion for ${p.title}.` }); }}>View Analytics</MenuItem>
                <MenuItem icon="pencil" disabled={denied} onClick={() => { setRowMenu(null); selectRow(p.id); setModal({ kind: "edit", page: p }); }}>Edit Page Details</MenuItem>
                <MenuItem icon="copy" disabled={denied} onClick={() => { setRowMenu(null); selectRow(p.id); setModal({ kind: "duplicate", page: p }); }}>Duplicate Page</MenuItem>
                <MenuItem icon="link" onClick={() => { setRowMenu(null); app.toast({ type: "info", title: p.status === "published" ? "Live URL copied" : "Draft path copied", sub: p.path }); }}>
                  {p.status === "published" ? "Copy Page URL" : "Copy Draft Path"}
                </MenuItem>
                <MenuItem icon="home" disabled={denied || p.isHome} onClick={() => { setRowMenu(null); selectRow(p.id); setModal({ kind: "home", page: p }); }}>
                  {p.isHome ? "Already the Homepage" : "Set as Homepage"}
                </MenuItem>
                <MenuItem icon="sitemap" disabled={denied || p.isHome} onClick={() => { setRowMenu(null); selectRow(p.id); setModal({ kind: "move", page: p }); }}>Move Page…</MenuItem>
                <MenuItem icon="clock" onClick={() => { setRowMenu(null); app.toast({ type: "info", title: "Revision history", sub: "Opens with Module 6 — Publishing & Releases." }); }}>View Revision History</MenuItem>
                <div className="menu-sep" />
                <MenuItem icon="trash" danger disabled={!canDelete || p.isHome} meta={p.isHome ? "homepage" : undefined}
                  onClick={() => { setRowMenu(null); selectRow(p.id); setModal({ kind: "trash", page: p }); }}>Move to Trash</MenuItem>
              </>
            )}
          </Popover>
        );
      })()}

      {/* ---------- modals ---------- */}
      {modal?.kind === "create" && site && (
        <CreatePageModal siteId={siteId} siteName={siteName} pages={sitePages} defaultParent={modal.parentId}
          onClose={() => setModal(null)}
          onCreated={(p) => {
            /* land on the new page: clear every narrowing filter so it is visible */
            setModal(null); setSelectedId(p.id); setTab("all"); setPageNo(1);
            setQ(""); setSearch(""); setType("all"); setStatus("all"); setAuthor("all");
            setOnlyIssues(false); setOnlyLanding(false);
            after({ title: "Page created as a draft", sub: `${p.title} · ${p.path}`, action: { label: "Open builder", onClick: () => setBuilderPage(p) } });
          }} />
      )}
      {modal?.kind === "edit" && (
        <EditDetailsModal page={modal.page} pages={sitePages} onClose={() => setModal(null)}
          onSaved={(p, movedFrom) => {
            setModal(null);
            after({ title: "Draft details saved", sub: movedFrom !== p.path ? `${movedFrom} → ${p.path} · not published yet` : "Not published yet — publish to ship it" });
          }} />
      )}
      {modal?.kind === "duplicate" && (
        <DuplicateModal page={modal.page} pages={sitePages} onClose={() => setModal(null)}
          onDone={(copy) => { setModal(null); setSelectedId(copy.id); after({ title: "Page duplicated as a draft", sub: `${copy.title} · ${copy.path}` }); }} />
      )}
      {modal?.kind === "move" && (
        <MoveModal page={modal.page} tree={tree} onClose={() => setModal(null)}
          onDone={(to, affected) => { const movedTitle = modal.page.title; setModal(null); after({ title: "Page moved", sub: `${movedTitle} → ${to}${affected ? ` · ${affected} child page(s) follow` : ""}` }); }} />
      )}
      {modal?.kind === "home" && (
        <HomepageModal page={modal.page} current={currentHome ? ({ ...modal.page, title: currentHome.title } as CmsPage) : null}
          onClose={() => setModal(null)}
          onDone={(prev) => { setModal(null); after({ title: "Homepage designation queued", sub: prev ? `Replaces ${prev} at / in the next release` : "Serves / in the next release" }); }} />
      )}
      {modal?.kind === "trash" && (
        <TrashModal pages={[modal.page]} onClose={() => setModal(null)}
          onDone={(ids, failed, permanent) => {
            setModal(null);
            const gone = ids[0];
            const goneTitle = modal.page.title;
            setSelectedId(rows.find((r) => r.id !== gone)?.id ?? null);
            if (permanent) {
              after({ type: failed.length ? "warn" : "info", title: failed.length ? "Page not deleted" : `“${goneTitle}” deleted permanently`, sub: failed.length ? failed[0].reason : "It cannot be restored" });
              return;
            }
            after({
              type: "warn", title: `Moved “${goneTitle}” to Trash`, sub: failed.length ? failed[0].reason : "Recoverable for 30 days",
              action: { label: "Undo", onClick: () => { void API.restorePage(gone).then(() => after({ title: "Restored", sub: `${goneTitle} is back as a draft` })); } }
            });
          }} />
      )}
      {modal?.kind === "bulk-trash" && (
        <TrashModal pages={rows.filter((r) => bulk.has(r.id))} onClose={() => setModal(null)}
          onDone={(ids, failed) => {
            setModal(null); setBulk(new Set());
            after({ type: "warn", title: `${ids.length} page${ids.length === 1 ? "" : "s"} moved to Trash`, sub: failed.length ? `${failed.length} could not be moved` : "Recoverable for 30 days" });
          }} />
      )}
      {modal?.kind === "restore" && (
        <RestoreModal page={modal.page} taken={trashTaken} onClose={() => setModal(null)}
          onDone={(p) => { setModal(null); after({ title: "Page restored as a draft", sub: `${p.title} · ${p.path}` }); }} />
      )}
      {modal?.kind === "preview" && (
        <PreviewModal page={modal.page} onClose={() => setModal(null)} />
      )}
    </>
  );
}

/* ---------- small pieces ---------- */
function Kpi({ icon, label, value, foot, tone = "violet", onClick }: {
  icon: string; label: string; value: number | null; foot: string; tone?: string; onClick: () => void;
}) {
  return (
    <button className="d2-kpi d3-kpi" onClick={onClick} title={`${label} — click to filter the registry`}>
      <span className={`kpi-ico ${tone}`}><Icon name={icon} size={14} /></span>
      <span className="d3-kpi-main">
        <span className="d3-kpi-val num">{value === null ? <span className="sk sk-line" style={{ width: 26, display: "inline-block" }} /> : value}</span>
        <span className="d3-kpi-lab">{label}</span>
      </span>
      <span className="d3-kpi-foot">{foot}</span>
    </button>
  );
}

function SortArrow({ on, dir }: { on: boolean; dir: "asc" | "desc" }) {
  if (!on) return <Icon name="chevDown" size={9} className="d3-sort-idle" />;
  return <Icon name={dir === "asc" ? "arrowUpRight" : "chevDown"} size={9} className="d3-sort-on" />;
}

function pageNumbers(cur: number, total: number): (number | "…")[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, cur - 1), end = Math.min(total - 1, cur + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
