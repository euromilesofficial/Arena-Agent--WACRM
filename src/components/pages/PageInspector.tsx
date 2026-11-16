/* ============================================================
   Module 3 · Selected page inspector
   Thumbnail is a generated wireframe of the page's block outline —
   deliberately not a fake screenshot, and it always matches the
   template the page actually uses.
   ============================================================ */
import { Icon } from "../Icon";
import { Btn, Pill } from "../ui";
import type { CmsPage, PageIssue } from "@/lib/cms-pages";
import { headerNavFor } from "@/lib/layout-db";
import { useEffect, useMemo, useState } from "react";

export function PageThumb({ page, big = false }: { page: CmsPage; big?: boolean }) {
  const seed = page.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const rows = Math.max(2, Math.min(5, Math.round(page.blocks / 2)));
  return (
    <div className={`d3-thumb ${big ? "is-big" : ""} ${page.type === "landing" ? "is-landing" : ""}`} aria-hidden="true">
      <div className="d3-thumb-bar">
        <span className="d3-thumb-dot" /><span className="d3-thumb-dot" /><span className="d3-thumb-dot" />
        <span className="d3-thumb-url">{page.isHome ? "euromiles.in" : `euromiles.in${page.path}`}</span>
      </div>
      {page.type === "standard" && <div className="d3-thumb-nav"><i /><i /><i /><i /></div>}
      <div className="d3-thumb-hero" style={{ background: `linear-gradient(135deg, hsl(${seed % 360} 62% 92%), hsl(${(seed + 40) % 360} 58% 86%))` }}>
        <span className="d3-thumb-h" />
        <span className="d3-thumb-h short" />
      </div>
      <div className="d3-thumb-rows">
        {Array.from({ length: rows }).map((_, i) => (
          <span key={i} className="d3-thumb-row" style={{ width: `${64 + ((seed + i * 17) % 30)}%` }} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  page: CmsPage | null;
  parent: CmsPage | null;
  children: CmsPage[];
  issues: PageIssue[];
  loading: boolean;
  stale: boolean;
  readOnly: boolean;
  canEdit: boolean;
  canDelete: boolean;
  previewBusy: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onEditDetails: () => void;
  onMore: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenLive: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onRefresh: () => void;
  onPublishQueue: () => void;
}

const STATUS_COPY: Record<string, string> = {
  published: "In the current live release",
  draft: "Draft — never published",
};

export function PageInspector(p: Props) {
  const { page } = p;
  const [flash, setFlash] = useState(false);
  useEffect(() => { setFlash(true); const t = setTimeout(() => setFlash(false), 220); return () => clearTimeout(t); }, [page?.id]);

  if (p.loading && !page) {
    return (
      <section className="card d3-insp" aria-label="Selected page details">
        <div className="d3-card-head"><div className="d3-card-title"><Icon name="file" size={13} /> Page Details</div></div>
        <div className="d3-insp-body">
          <div className="sk" style={{ height: 104, borderRadius: 10 }} />
          <div className="sk sk-line" style={{ width: "62%", marginTop: 12 }} />
          <div className="sk sk-line" style={{ width: "44%", marginTop: 8 }} />
          <div className="sk" style={{ height: 96, borderRadius: 10, marginTop: 14 }} />
        </div>
      </section>
    );
  }

  if (p.stale) {
    return (
      <section className="card d3-insp" aria-label="Selected page details">
        <div className="d3-card-head"><div className="d3-card-title"><Icon name="file" size={13} /> Page Details</div></div>
        <div className="d3-insp-empty">
          <Icon name="alert" size={18} />
          <div className="f12 w650">This page is no longer available</div>
          <div className="f11 muted">It was deleted or moved by someone else while you were looking at it.</div>
          <Btn className="btn-sm" icon="refresh" onClick={p.onRefresh}>Refresh list</Btn>
        </div>
      </section>
    );
  }

  if (!page) {
    return (
      <section className="card d3-insp" aria-label="Selected page details">
        <div className="d3-card-head"><div className="d3-card-title"><Icon name="file" size={13} /> Page Details</div></div>
        <div className="d3-insp-empty">
          <Icon name="file" size={18} />
          <div className="f12 w650">No page selected</div>
          <div className="f11 muted">Choose a page from the structure or the table to see its route, template and performance.</div>
        </div>
      </section>
    );
  }

  const conv = page.views ? (page.leads / page.views) * 100 : 0;
  const hasAnalytics = page.views > 0;

  return (
    <section className={`card d3-insp ${flash ? "is-flash" : ""}`} aria-label="Selected page details">
      <div className="d3-card-head">
        <div className="d3-card-title"><Icon name={page.isHome ? "home" : "file"} size={13} /> {page.isHome ? "Home" : "Page Details"}</div>
        <button className="icon-btn icon-sm" aria-label="Page actions" aria-haspopup="menu" onClick={p.onMore}>
          <Icon name="more" size={14} />
        </button>
      </div>

      <div className="d3-insp-body">
        <button className="d3-insp-thumbwrap" onClick={p.onPreview} disabled={p.previewBusy}
          title="Open the isolated preview for this page" aria-label={`Preview ${page.title}`}>
          <PageThumb page={page} big />
          <span className="d3-insp-thumbolt"><Icon name="eye" size={11} /> {p.previewBusy ? "Opening…" : "Preview"}</span>
        </button>

        <div className="d3-insp-title">
          <div className="d3-insp-name truncate">{page.title}</div>
          <div className="d3-insp-path mono truncate" title={page.path}>{page.path}</div>
        </div>

        <div className="d3-insp-badges">
          {page.trash ? <Pill tone="red" dot>Trashed</Pill>
            : page.status === "published" ? <Pill tone="green" dot>Published</Pill>
              : <Pill tone="amber" dot>Draft</Pill>}
          {page.hasChanges && page.status === "published" && (
            <button className="d3-changes" onClick={p.onPublishQueue} title="Review the unpublished draft in Publishing & Releases">
              <Icon name="refresh" size={10} /> Unpublished changes
            </button>
          )}
          {page.isHome && <Pill tone="violet" dot>Homepage</Pill>}
        </div>

        <div className="d3-meta">
          <Meta label="Page type" value={page.type === "landing" ? "Landing page" : "Standard page"} />
          <Meta label="Template" value={page.template} />
          <Meta label="Layout" value={<LayoutReadout page={page} />} />
          <Meta label="Parent" value={p.parent?.title ?? "—"} />
          <Meta label="Language" value="English · default" />
          <Meta label="Created" value={`${page.createdAt} by ${page.createdBy}`} />
          <Meta label="Last updated" value={`${page.updated} by ${page.author}`} />
          <Meta label="Live URL" value={
            page.status === "published" && !page.trash ? (
              <button className="d3-linkval" onClick={p.onOpenLive} title="Open the live page">
                <span className="mono truncate">euromiles.in{page.path}</span> <Icon name="external" size={10} />
              </button>
            ) : <span className="muted">Not published</span>
          } />
          <Meta label="Last live release" value={page.status === "published" ? "v1.24 · May 29, 2025" : "—"} />
          {p.children.length > 0 && <Meta label="Child pages" value={`${p.children.length} page${p.children.length === 1 ? "" : "s"}`} />}
        </div>

        {page.trash && (
          <div className="d3-trash-note">
            <Icon name="trash" size={11} />
            <span>Deleted {page.trash.at} by {page.trash.by}. Restorable until {page.trash.until} ({page.trash.daysLeft} days left), then removed for good.</span>
          </div>
        )}
        {!page.trash && p.issues.length > 0 && (
          <div className="d3-issues">
            <div className="d3-issues-head"><Icon name="alert" size={12} /> {p.issues.length} issue{p.issues.length === 1 ? "" : "s"} on this page</div>
            {p.issues.map((i) => (
              <div key={i.id} className="d3-issue">
                <span className={`d3-issue-dot ${i.severity}`} />
                <div>
                  <div className="f11 w600">{i.label}</div>
                  <div className="f10 muted">{i.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!page.trash && <div className="d3-perf">
          <div className="d3-perf-head">
            <span className="f11 w650">Page performance</span>
            <span className="f10 muted" title="Prototype figures derived from this page's own record. Not a live analytics feed.">Last 30 days</span>
          </div>
          {hasAnalytics ? (
            <div className="d3-perf-grid">
              <Perf label="Views" value={page.views.toLocaleString()} tone="violet" icon="chart" />
              <Perf label="Leads" value={String(page.leads)} tone="green" icon="users" />
              <Perf label="Conversion" value={`${conv.toFixed(2)}%`} tone="amber" icon="target" />
            </div>
          ) : (
            <div className="d3-perf-empty"><Icon name="info" size={12} /> Analytics not available for this page yet.</div>
          )}
        </div>}
      </div>

      <div className="d3-insp-foot">
        {page.trash ? (
          <>
            <Btn variant="primary" icon="refresh" className="grow" disabled={!p.canEdit} onClick={p.onRestore}
              title={!p.canEdit ? "Your role cannot restore pages" : "Restore this page as a draft"}>Restore Page</Btn>
            <Btn icon="trash" className="is-danger" disabled={!p.canDelete} onClick={p.onDeleteForever}
              title={p.canDelete ? "Delete permanently" : "Your role cannot delete pages"}>Delete</Btn>
          </>
        ) : (
          <>
            <Btn variant="primary" icon="blocks" className="grow" disabled={!p.canEdit} onClick={p.onEdit}
              title={!p.canEdit ? "Your role can preview but not edit" : "Open in the Visual Builder"}>
              Edit Page
            </Btn>
            <Btn icon="more" disabled={!p.canEdit && !p.canDelete} onClick={p.onMore as unknown as () => void}>More</Btn>
          </>
        )}
      </div>
      {!p.canEdit && <div className="d3-insp-note"><Icon name="lock" size={11} /> Read-only role — editing, moving and deleting are disabled.</div>}
      {!page.trash && page.hasChanges && page.status === "published" && <div className="d3-insp-note"><Icon name="info" size={11} /> {STATUS_COPY.published} · draft edits are not public until the next release.</div>}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d3-meta-row">
      <span className="d3-meta-k">{label}</span>
      <span className="d3-meta-v">{value}</span>
    </div>
  );
}

function Perf({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: string }) {
  return (
    <div className="d3-perf-cell">
      <span className={`d3-perf-ico ${tone}`}><Icon name={icon} size={11} /></span>
      <span className="d3-perf-v num">{value}</span>
      <span className="d3-perf-l">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------
   Module 7 read-out. A page stores a layout *label*; the shell it
   actually gets is resolved here, so a page that follows the website
   default says so instead of echoing the word "Site default".
   ------------------------------------------------------------ */
function LayoutReadout({ page }: { page: CmsPage }) {
  const nav = useMemo(() => headerNavFor(page.layout), [page.layout]);
  const inherited = page.layout === "Site default" || page.layout === "Blank landing";
  const missing = !nav.layoutId;
  return (
    <span className="d3-layoutro">
      <span className="d3-layoutro-name">
        {missing ? nav.layoutName : nav.layoutName}
        {!missing && <em>{inherited ? "follows the website default" : "pinned to this page"}</em>}
      </span>
      {!missing && (
        <span className="d3-layoutro-shell">
          <span className={`d3-layoutro-chip ${nav.visible ? "" : "is-off"}`}>
            <Icon name="menu" size={9} />
            {nav.visible ? `${nav.items.length} nav links` : "header hidden"}
          </span>
          <button
            className="d3-linkval"
            title={`Open ${nav.layoutName} in Layouts & Templates`}
            onClick={() => { window.location.hash = `#/layouts?site=${page.siteId}&tab=layouts&itab=overview&sel=${nav.layoutId}`; }}
          >
            <span className="truncate">{nav.variantName}</span> <Icon name="external" size={10} />
          </button>
        </span>
      )}
      {missing && <Pill tone="amber" dot>layout not resolvable</Pill>}
    </span>
  );
}
