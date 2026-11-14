/* ============================================================
   Module 5 · Desktop Block Library
   ------------------------------------------------------------
   Catalogue + management only. Four mutually exclusive views,
   computed counts, a filter rail, a card grid, a per-type
   inspector, and exactly one mutation path: Insert into Page.

   Nothing here edits content, style or markup — that is the
   Visual Builder's job (Module 4).
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Btn, ErrorState, MenuItem, Pill, Popover, Skel, Tip } from "../components/ui";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { REGISTRY, type BlockNode } from "@/lib/builder";
import { BuilderAPI } from "@/lib/builder-db";
import {
  LibraryAPI, agoOf, compositionOf, countOf, dateLong, kpis, placementsFor, requirementsFor, structureOf,
  type LibEntry, type LibResult, type LibScope, type LibSort, type LibView, type Placement, type UpdatedFilter
} from "@/lib/library-db";
import { CreateTemplateModal, DeleteModal, InsertModal, PreviewModal } from "@/components/library/LibraryModals";

type Status = "loading" | "ready" | "error";

const VIEWS: { id: LibView; label: string; icon: string; hint: string }[] = [
  { id: "all", label: "All", icon: "dashboard", hint: "Everything the workspace can put on a page" },
  { id: "native", label: "Native Blocks", icon: "layers", hint: "The 20 schema-validated block types" },
  { id: "sections", label: "Section Templates", icon: "blocks", hint: "Prebuilt, proofed page sections" },
  { id: "saved", label: "Saved Templates", icon: "file", hint: "Sections saved from your own pages" }
];

const SEARCH_HINT: Record<LibView, string> = {
  all: "Search blocks and templates…",
  native: "Search native blocks…",
  sections: "Search section templates…",
  saved: "Search saved templates…"
};

const SORTS: { id: LibSort; label: string }[] = [
  { id: "recent", label: "Recently updated" },
  { id: "name", label: "Name (A → Z)" },
  { id: "usage", label: "Most used" }
];

/* ---------------- thumbnails: drawn from the real composition ----------------
   A section is not represented by a stock photo; it is drawn from the block
   types it actually contains, so two templates never share a thumbnail. */
function LibThumb({ blocks, tall = false }: { blocks: BlockNode[]; tall?: boolean }) {
  const types = blocks.map((b) => b.type);
  const has = (t: string) => types.includes(t as never);
  const img = (n = 1) => (
    <div className="m5-th-img" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden>
      {Array.from({ length: n }).map((_, i) => <i key={i} style={{ opacity: 0.85 - i * 0.12 }} />)}
    </div>
  );
  const lines = (n: number, short = false) => (
    <div className="m5-th-lines" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ width: short ? `${46 + ((i * 17) % 30)}%` : `${74 + ((i * 11) % 26)}%` }} />
      ))}
    </div>
  );
  return (
    <div className={`m5-th ${tall ? "is-tall" : ""}`} aria-hidden>
      {has("hero") && (
        <div className="m5-th-hero">
          <div className="m5-th-hero-copy">
            <span className="m5-th-eyebrow" />
            <span className="m5-th-h1" />
            <span className="m5-th-h1 short" />
            <span className="m5-th-btn" />
          </div>
          {img(1)}
        </div>
      )}
      {!has("hero") && has("heading") && <div className="m5-th-heading"><span /><span className="short" /></div>}
      {has("featureGrid") && (
        <div className="m5-th-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[0, 1, 2].map((i) => <i key={i}><b /><span /><span className="short" /></i>)}
        </div>
      )}
      {has("testimonials") && (
        <div className="m5-th-quotes">
          <i className="m5-th-avatar" />
          <div><span /><span /><em /></div>
        </div>
      )}
      {has("table") && (
        <div className="m5-th-table">
          {[0, 1, 2, 3].map((r) => (
            <div key={r}>{[0, 1, 2].map((c) => <span key={c} className={c === 0 ? "th" : ""} />)}</div>
          ))}
        </div>
      )}
      {has("form") && (
        <div className="m5-th-form">
          {[0, 1, 2].map((i) => <span key={i} />)}
          <b />
        </div>
      )}
      {has("ctaSection") && !has("hero") && (
        <div className="m5-th-cta"><span /><b /></div>
      )}
      {has("faq") && (
        <div className="m5-th-faq">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}
      {has("pricing") && (
        <div className="m5-th-cards" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {[0, 1].map((i) => <i key={i}><b /><span /><span className="short" /></i>)}
        </div>
      )}
      {has("image") && !has("hero") && img(3)}
      {has("text") && lines(3)}
      {has("list") && <div className="m5-th-list">{[0, 1, 2].map((i) => <span key={i} />)}</div>}
      {has("alert") && <div className="m5-th-alert"><span /></div>}
      {has("quote") && <div className="m5-th-quote"><span /><em /></div>}
      {has("video") && !has("hero") && <div className="m5-th-video"><b /></div>}
      {has("columns") && (
        <div className="m5-th-cols">{[0, 1].map((i) => <div key={i}>{lines(2, true)}</div>)}</div>
      )}
      {has("button") && !has("hero") && !has("ctaSection") && <div className="m5-th-btnrow"><span /></div>}
      {has("container") && <div className="m5-th-band">{lines(2, true)}</div>}
      {has("divider") && <div className="m5-th-div" />}
      {has("footer") && <div className="m5-th-foot"><span /><span /><span /></div>}
      {!blocks.length && lines(2)}
    </div>
  );
}


/* ---------------- composition diagram ----------------
   The Overview tab's picture: root pill → connector rail → up to five
   part tiles (the mock fits five in a 330 px rail), all generated from
   the document (see compositionOf). */
function Composition({ entry, onMore }: { entry: LibEntry; onMore: () => void }) {
  const c = compositionOf(entry, 5);
  if (!c.parts.length) {
    return (
      <div className="m5-comp" role="img" aria-label={`${entry.name} is a single block with no internal parts`}>
        <div className="m5-comp-root"><Icon name={c.root.icon} size={15} />{c.root.label}</div>
        <p className="m5-comp-none">Single block — its fields are edited in the Visual Builder.</p>
      </div>
    );
  }
  const tiles = c.shown;
  const cols = tiles.length + (c.hidden ? 1 : 0);
  return (
    <div className="m5-comp" role="img" aria-label={c.sentence}>
      <div className="m5-comp-root">
        <Icon name={c.root.icon} size={15} />
        {c.root.label}
        {c.root.variant && <em>{c.root.variant}</em>}
      </div>
      <div className="m5-comp-stem" aria-hidden />
      <div className={`m5-comp-row cols-${cols}`}>
        <div
          className="m5-comp-rail"
          aria-hidden
          style={{ left: `${50 / cols}%`, right: `${50 / cols}%` }}
        />
        {tiles.map((p) => (
          <div className="m5-comp-tile" key={p.key}>
            <span className="m5-comp-ico">{p.icon === "type" ? <b>H</b> : <Icon name={p.icon} size={14} />}</span>
            <span className="m5-comp-label">{p.label}{p.count && p.count > 1 ? ` (×${p.count})` : ""}</span>
          </div>
        ))}
        {c.hidden > 0 && (
          <button className="m5-comp-tile is-more" onClick={onMore} title={`${c.parts.length} parts in total — open Structure`}>
            <span className="m5-comp-ico more"><Icon name="more" size={14} /></span>
            <span className="m5-comp-label">+{c.hidden}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- cards ---------------- */

function ScopeBadge({ entry }: { entry: LibEntry }) {
  if (entry.scope === "Built-in") return <Pill tone="violet" className="m5-badge">Built-in</Pill>;
  if (entry.scope === "Workspace") return <Pill tone="green" className="m5-badge">Workspace</Pill>;
  return <Pill tone="blue" className="m5-badge">This Site</Pill>;
}

interface CardProps {
  entry: LibEntry;
  selected: boolean;
  onSelect: () => void;
  onInsert: () => void;
  onMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  menuOpen: boolean;
  readOnly: boolean;
}

function Card({ entry, selected, onSelect, onInsert, onMenu, menuOpen, readOnly }: CardProps) {
  const uses = placementsFor(entry.id).length;
  /* native blocks get the mock's icon card — no thumbnail, so five fit a row
     and all four category groups stay on one screen */
  const compact = entry.kind === "block";
  const icon = entry.type ? REGISTRY[entry.type].icon : "blocks";
  const cta = entry.kind === "saved" ? "Use Template" : "Insert";
  return (
    <article
      className={`m5-card ${compact ? "is-compact" : ""} ${selected ? "is-sel" : ""}`}
      data-id={entry.id}
      data-kind={entry.kind}
      aria-selected={selected}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest("button")) onSelect(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
    >
      {compact ? (
        <div className="m5-card-top">
          <span className={`m5-ico-tile t-${entry.category.toLowerCase()}`}><Icon name={icon} size={16} /></span>
          <span className="m5-drag" title="Drag onto a page in the Visual Builder" aria-hidden>
            <Icon name="grip" size={13} />
          </span>
          <button className={`m5-kebab ${menuOpen ? "is-on" : ""}`} onClick={onMenu} aria-label={`Actions for ${entry.name}`} aria-haspopup="menu">
            <Icon name="more" size={14} />
          </button>
        </div>
      ) : (
        <div className="m5-card-thumb">
          <LibThumb blocks={entry.blocks} />
          {selected && <span className="m5-card-check"><Icon name="check" size={11} /></span>}
          <button className={`m5-kebab ${menuOpen ? "is-on" : ""}`} onClick={onMenu} aria-label={`Actions for ${entry.name}`} aria-haspopup="menu">
            <Icon name="more" size={14} />
          </button>
        </div>
      )}
      <div className="m5-card-body">
        <h3 className="m5-card-name">{entry.name}</h3>
        {!compact && (
          <div className="m5-card-badges">
            <ScopeBadge entry={entry} />
            {entry.kind !== "saved" && <Pill tone="grey" className="m5-badge">{entry.category}</Pill>}
            {uses > 0 && <span className="m5-uses"><Icon name="link" size={11} />{uses}</span>}
          </div>
        )}
        <p className="m5-card-desc">{entry.desc}</p>
        {entry.kind === "saved" && (
          <div className="m5-card-meta">
            <span className="m5-avatar" aria-hidden>{initials(entry.creator)}</span>
            <span>by {entry.creator}</span>
            <span className="m5-dot" aria-hidden />
            <span>Updated {dateShort(entry.updatedAt)}</span>
          </div>
        )}
      </div>
      <div className="m5-card-foot">
        <Btn variant="sm" icon="eye" onClick={onSelect}>Preview</Btn>
        <Btn variant="primary" className="m5-insert" icon="plus" disabled={readOnly} onClick={onInsert}>{cta}</Btn>
      </div>
    </article>
  );
}

function CardRow({ entry, selected, onSelect, onInsert, onMenu, readOnly }: Omit<CardProps, "menuOpen">) {
  return (
    <tr className={selected ? "is-sel" : ""} data-id={entry.id} aria-selected={selected} onMouseDown={onSelect}>
      <td className="m5-row-thumb"><LibThumb blocks={entry.blocks} /></td>
      <td>
        <div className="m5-row-name">{entry.name}</div>
        <div className="m5-row-desc">{entry.desc}</div>
      </td>
      <td>{entry.kind === "block" ? "Block" : entry.kind === "section" ? "Section" : "Saved"}</td>
      <td>{entry.category}</td>
      <td><ScopeBadge entry={entry} /></td>
      <td className="num">{countOf(entry)}</td>
      <td className="num">{placementsFor(entry.id).length}</td>
      <td className="m5-row-upd">{agoOf(entry.updatedAt)}</td>
      <td className="m5-row-act">
       
        <Btn variant="sm" icon="eye" onClick={onSelect}>Preview</Btn>
        <Btn variant="sm" icon="plus" disabled={readOnly} onClick={onInsert}>Insert</Btn>
        <button className="m5-kebab" onClick={onMenu} aria-label={`Actions for ${entry.name}`}><Icon name="more" size={14} /></button>
      </td>
    </tr>
  );
}

const FIELD_NOTE: Record<string, string> = {
  text: "short text", textarea: "multi-line copy", select: "pick one", toggle: "on or off",
  link: "URL, page or anchor", media: "image or video", items: "repeating items",
  spacing: "spacing scale", segmented: "segmented choice", color: "theme colour", number: "number"
};
const fieldNote = (kind: string): string => FIELD_NOTE[kind] ?? kind;

const usageWhen = (iso: string): string => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return dateShort(t);
};

const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "WA";

const dateShort = (t: number): string => {
  const full = dateLong(t);
  return full.split(",").slice(0, 2).join(",");
};

/* ---------------- KPI strip ---------------- */

function KpiCard({ icon, tone, value, label, sub }: { icon: string; tone: string; value: number; label: string; sub: string }) {
  return (
    <div className="m5-kpi">
      <div className={`m5-kpi-ico ${tone}`}><Icon name={icon} size={20} /></div>
      <div>
        <div className="m5-kpi-n">{value}</div>
        <div className="m5-kpi-l">{label}</div>
        <div className="m5-kpi-s">{sub}</div>
      </div>
    </div>
  );
}

/* ---------------- inspector ---------------- */

function Inspector({
  entry, tab, setTab, onClose, onInsert, onPreview, role, onPlacement
}: {
  entry: LibEntry | null; tab: string; setTab: (t: string) => void;
  onClose: () => void; onInsert: () => void; onPreview: () => void; role: string;
  onPlacement: (p: Placement) => void;
}) {
  const [openAll, setOpenAll] = useState(true);
  if (!entry) {
    return (
      <aside className="m5-insp is-empty" aria-label="Inspector">
        <div className="m5-insp-empty">
          <div className="m5-insp-empty-ico"><Icon name="cursor" size={20} /></div>
          <div className="m5-insp-empty-t">Nothing selected</div>
          <p>Select a block or template to see what it is made of, where it is used, and what it needs before it can be placed.</p>
        </div>
      </aside>
    );
  }

  const tabs = entry.kind === "block"
    ? ["Overview", "Properties", "Compatibility"]
    : ["Overview", "Structure", "Usage"];

  const usage = LibraryAPI.usageOf(entry.id);
  const reqs = requirementsFor(entry, entry.siteId ?? "site_main");
  const tree = structureOf(entry);

  return (
    <aside className="m5-insp" aria-label="Inspector">
      <div className="m5-insp-head">
        <h2 className="m5-insp-title">{entry.name}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close inspector"><Icon name="x" size={15} /></button>
      </div>
      <div className="m5-insp-preview"><LibThumb blocks={entry.blocks} tall /></div>
      <div className="m5-insp-pills">
        <Pill tone="violet">{entry.scope}</Pill>
        <Pill tone="green" dot>Schema valid</Pill>
        <Pill tone="grey">{entry.kind === "block" ? `${entry.category} block` : entry.kind === "section" ? `Section (${entry.category})` : "Saved"}</Pill>
      </div>
      <div className="m5-tabs" role="tablist" aria-label="Inspector sections">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`m5-tab ${tab === t ? "is-on" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="m5-tabpane" role="tabpanel">
        {tab === "Overview" && (entry.kind === "block" ? (
          <>
            <h4 className="m5-h4 first">About this block</h4>
            <p className="m5-summary">{entry.desc}</p>

            <h4 className="m5-h4">Key supported properties</h4>
            <ul className="m5-props">
              {(entry.type ? REGISTRY[entry.type].content : []).slice(0, 6).map((f) => (
                <li key={f.key}>
                  <Icon name="check" size={11} />
                  <span><b>{f.label}</b><em>{fieldNote(f.kind)}</em></span>
                </li>
              ))}
            </ul>

            <h4 className="m5-h4">Compatibility</h4>
            <ul className="m5-cango">
              <li className="ok"><Icon name="check" size={11} />Schema-validated against the block registry</li>
              <li className="ok"><Icon name="check" size={11} />Responsive — desktop, tablet and mobile</li>
              <li className={entry.reusable === false ? "bad" : "ok"}>
                <Icon name={entry.reusable === false ? "alert" : "check"} size={11} />
                {entry.reusable === false
                  ? "Master layout — one per page, footer slot only"
                  : "Reusable — insert it on as many pages as you need"}
              </li>
            </ul>

            <h4 className="m5-h4">Where you can use it</h4>
            <ul className="m5-cango">
              <li className="ok"><Icon name="check" size={11} />Any page in this workspace</li>
              <li className="ok"><Icon name="check" size={11} />Inside Container and Columns blocks</li>
              <li className="bad"><Icon name="x" size={11} />{entry.type === "footer" ? "Page body — footer slot only" : "Inside a Form block"}</li>
            </ul>
          </>
        ) : (
          <>
            <h4 className="m5-h4 first">Component Structure</h4>
            <p className="m5-summary">{entry.desc}</p>
            <Composition entry={entry} onMore={() => setTab("Structure")} />

            <div className="m5-bp" aria-label="Supported breakpoints">
              {([["monitor", "Desktop", "≥ 1200 px"], ["tablet", "Tablet", "768 – 1199 px"], ["phone", "Mobile", "≤ 767 px"]] as [string, string, string][]).map(([icon, name, range]) => (
                <div key={name} className="m5-bp-card">
                  <Icon name={icon} size={15} />
                  <b>{name}</b>
                  <em>{range}</em>
                  <Icon name="check" size={10} />
                </div>
              ))}
            </div>

            <button
              className="m5-used"
              onClick={() => setTab("Usage")}
            >
              <Icon name="layers" size={13} />
              <span>{usage.totalPlacements ? `Used on ${usage.totalPages} page${usage.totalPages === 1 ? "" : "s"}` : "Not used yet"}</span>
              <Icon name="chevRight" size={12} />
            </button>

            {entry.kind === "saved" ? (
              <ul className="m5-kvlist">
                <li><Icon name="layers" size={13} /><span>Owner</span><b><Pill tone={entry.scope === "Workspace" ? "green" : "blue"}>{entry.scope}</Pill></b></li>
                <li><Icon name="user" size={13} /><span>Created by</span><b>{entry.creator}</b></li>
                <li><Icon name="calendar" size={13} /><span>Last updated</span><b>{dateLong(entry.updatedAt)}</b></li>
                <li>
                  <Icon name="link" size={13} /><span>Total usage</span>
                  <b>{usage.totalPages} page{usage.totalPages === 1 ? "" : "s"} <Icon name="chevRight" size={11} /></b>
                </li>
                <li>
                  <Icon name="globe" size={13} /><span>Used in</span>
                  <b className="m5-sites">
                    {usage.totalPlacements === 0
                      ? "Not placed yet"
                      : [...new Set(usage.pages.map((p) => p.siteId))].map((sid) => (
                        <span key={sid}>
                          {DBX().sites.find((x) => x.id === sid)?.name ?? sid}
                          <em>({usage.pages.filter((p) => p.siteId === sid && p.pageId).length})</em>
                        </span>
                      ))}
                  </b>
                </li>
              </ul>
            ) : (
              <div className="m5-kv">
                <div><span>Type</span><b>{entry.category}</b></div>
                <div><span>Blocks</span><b>{countOf(entry)}</b></div>
                <div><span>Updated</span><b>{dateLong(entry.updatedAt)}</b></div>
                <div><span>Owner</span><b>{entry.owner}</b></div>
              </div>
            )}
          </>
        ))}

        {tab === "Properties" && (
          <>
            <h4 className="m5-h4">Variant</h4>
            <div className="m5-variants">
              {(entry.variants ?? [{ value: "default", label: "Default" }]).map((v) => (
                <span key={v.value} className={`m5-variant ${entry.variant === v.value ? "is-on" : ""}`}>{v.label}</span>
              ))}
            </div>
            <h4 className="m5-h4">Declared fields</h4>
            <ul className="m5-fields">
              {(entry.type ? REGISTRY[entry.type].content : []).slice(0, 8).map((f) => (
                <li key={f.key}><Icon name="type" size={11} />{f.label}<em>{f.kind}</em></li>
              ))}
            </ul>
            <p className="m5-note">Editing these values happens in the Visual Builder, not here.</p>
          </>
        )}

        {tab === "Compatibility" && (
          <>
            <h4 className="m5-h4">Requirements</h4>
            <ul className="m5-reqs">
              {reqs.map((r) => (
                <li key={r.kind} className={r.ok ? "ok" : "bad"}>
                  <Icon name={r.ok ? "check" : "alert"} size={12} />
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
            <h4 className="m5-h4">Where it can go</h4>
            <ul className="m5-cango">
              <li><Icon name="check" size={11} />Any page in this workspace</li>
              <li><Icon name="check" size={11} />Inside Container and Columns blocks</li>
              <li><Icon name="x" size={11} />{entry.type === "footer" ? "Page body — footer slot only" : "Inside a Form block"}</li>
            </ul>
            <h4 className="m5-h4">Emits</h4>
            <div className="m5-emits">{entry.emits.length ? entry.emits.map((e) => <code key={e}>{e}</code>) : <span className="m5-muted">Nothing — presentational only</span>}</div>
          </>
        )}

        {tab === "Structure" && (
          <>
            <div className="m5-tree-head">
              <h4 className="m5-h4">Component composition</h4>
              <div className="m5-tree-tools">
                <button onClick={() => setOpenAll(true)} className={openAll ? "is-on" : ""} aria-pressed={openAll}>Expand</button>
                <button onClick={() => setOpenAll(false)} className={!openAll ? "is-on" : ""} aria-pressed={!openAll}>Collapse</button>
              </div>
            </div>
            <ul className="m5-tree">
              {tree.filter((row) => openAll || row.depth === 0).map((row, i) => (
                <li key={`${row.node.id}-${i}`} style={{ paddingLeft: 8 + row.depth * 16 }}>
                  <span className={`m5-tree-dot d${row.depth}`} />
                  <span className="m5-tree-label">{row.label}</span>
                  <span className="m5-tree-type">{row.type}</span>
                </li>
              ))}
            </ul>
            <div className="m5-minis">
              <div><Icon name="check" size={12} />Responsive</div>
              <div><Icon name="shield" size={12} />Schema valid</div>
              <div><Icon name="blocks" size={12} />{countOf(entry)} block{countOf(entry) === 1 ? "" : "s"}</div>
            </div>
          </>
        )}

        {tab === "Usage" && (
          <>
            {usage.totalPlacements === 0 ? (
              <div className="m5-usage-empty">
                <Icon name="link" size={16} />
                <b>Not used on any page yet</b>
                <span>Insert it into a page and it will appear here with its status.</span>
              </div>
            ) : (
              <>
                <div className="m5-usage-kpis">
                  <div><b>{usage.totalPages}</b><span>Pages</span></div>
                  <div><b>{usage.published}</b><span>Published</span></div>
                  <div><b>{usage.draft}</b><span>Draft</span></div>
                  <div><b>{usage.totalPlacements}</b><span>Placements</span></div>
                </div>
                <table className="m5-usage-table">
                  <thead><tr><th>Page</th><th>Website</th><th>Status</th><th>Last Updated</th><th /></tr></thead>
                  <tbody>
                    {usage.pages.map((p) => (
                      <tr key={`${p.pageId}-${p.index}`}>
                        <td><b>{p.pageTitle}</b><em>#{p.index + 1}</em></td>
                        <td>{DBX().sites.find((s) => s.id === p.siteId)?.name ?? p.siteId}</td>
                        <td><Pill tone={p.status === "published" ? "green" : "amber"}>{p.status}</Pill></td>
                        <td className="m5-usage-when">{usageWhen(p.updatedAt)}</td>
                        <td className="m5-usage-act">
                          <button className="m5-link" onClick={() => { location.hash = `#/pages?sel=${p.pageId}`; }}>
                            Open <Icon name="external" size={10} />
                          </button>
                          <button className="m5-link" onClick={() => onPlacement(p)}>
                            View placement <Icon name="arrowUpRight" size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>

      <div className="m5-insp-foot">
        <Btn icon="eye" onClick={onPreview}>Preview</Btn>
        <Btn variant="primary" icon="plus" disabled={role === "Viewer"} onClick={onInsert}>
          {entry.kind === "block" ? "Insert Block" : entry.kind === "saved" ? "Use Template" : "Insert into Page"}
        </Btn>
      </div>
    </aside>
  );
}

/* ---------------- the screen ---------------- */

export function Library() {
  const app = useApp();
  const [view, setView] = useState<LibView>("all");
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("All");
  const [scopes, setScopes] = useState<LibScope[]>([]);
  const [updated, setUpdated] = useState<UpdatedFilter>("any");
  const [compat, setCompat] = useState<string[]>(["Schema-validated", "Built-in", "Reusable"]);
  const [sort, setSort] = useState<LibSort>("recent");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LibResult | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState("Overview");
  const [inspOpen, setInspOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [insertFor, setInsertFor] = useState<LibEntry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<LibEntry | null>(null);
  const [previewFor, setPreviewFor] = useState<LibEntry | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const siteId = app.siteId === "all" ? "site_main" : app.siteId;
  const site = DBX().sites.find((s) => s.id === siteId);
  const readOnly = app.role === "Viewer";
  const canDelete = app.role === "Owner";

  // debounce the search so the grid settles instead of flickering
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let dead = false;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    LibraryAPI.list({ view, q: qDebounced, chip, scopes, updated, sort, siteId })
      .then((r) => { if (!dead) { setResult(r); setStatus("ready"); setError(""); } })
      .catch((e: Error) => { if (!dead) { setError(e.message); setStatus("error"); } });
    return () => { dead = true; };
  }, [view, qDebounced, chip, scopes, updated, sort, siteId, refreshTick]);

  // view switch resets everything that cannot survive it
  const switchView = useCallback((v: LibView) => {
    setView(v); setChip("All"); setPage(1); setMenuFor(null);
    setStatus("loading");
  }, []);

  useEffect(() => { setPage(1); }, [chip, scopes, updated, qDebounced, sort]);

  const pageSize = view === "saved" ? 6 : mode === "list" ? 12 : 96;
  /* the Compatibility facet is a real filter, not a decoration: untick
     “Reusable” and the master-layout Footer leaves the grid */
  const rows = (result?.rows ?? []).filter((e) =>
    view !== "native" || (
      compat.includes("Schema-validated")
      && (compat.includes("Built-in") || e.scope !== "Built-in")
      && (compat.includes("Reusable") || e.reusable !== false)
    ));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  const selected = useMemo(() => rows.find((r) => r.id === sel) ?? null, [rows, sel]);

  // keep a valid selection when the filter set changes
  useEffect(() => {
    if (sel && !rows.some((r) => r.id === sel) && status === "ready") { setSel(null); }
  }, [rows, sel, status]);

  // ⌘K focuses the rail search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const grouped = useMemo(() => {
    if (view !== "native") return null;
    const order = ["Content", "Layout", "Interactive", "Engagement"];
    const map = new Map<string, LibEntry[]>();
    for (const r of pageRows) { map.set(r.category, [...(map.get(r.category) ?? []), r]); }
    return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [pageRows, view]);

  const k = kpis();
  const groupHint: Record<string, string> = {
    Content: "Core content elements for building your page content.",
    Layout: "Structural blocks to organize and arrange content.",
    Interactive: "Actionable elements that drive user interaction and conversion.",
    Engagement: "Trust and information blocks to build credibility and highlight key value."
  };

  /* “View placement” lands on the exact block inside the Visual Builder —
     it resolves the block id first, so the builder opens with it selected. */
  const openPlacement = async (p: Placement) => {
    try {
      const draft = await BuilderAPI.getDraft(p.pageId);
      const block = draft.blocks[p.index];
      location.hash = `#/builder?site=${p.siteId}&page=${p.pageId}${block ? `&sel=${block.id}` : ""}`;
    } catch (err) {
      app.toast({ type: "error", title: "Could not open the page", sub: (err as Error).message });
    }
  };

  const toggleScope = (s: LibScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, entry: LibEntry) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget); setMenuFor(entry.id);
  };

  const title = view === "all" ? "Templates" : view === "native" ? "Native Blocks" : view === "sections" ? "Section Templates" : "Saved Templates";
  const subtitle = view === "native"
    ? "Schema-validated, production-ready blocks you can drag, drop, and insert into any page."
    : view === "sections"
      ? "Section templates are prebuilt, reusable page sections (e.g., Hero, Features, Testimonials, CTA)."
      : view === "saved"
        ? "Only templates saved in this workspace or the current site are shown."
        : "Blocks, sections and saved templates — everything the workspace can place.";

  const afterInsert = (pageTitle: string) => {
    setInsertFor(null);
    setRefreshTick((n) => n + 1);
    app.toast({
      type: "success",
      title: `Inserted into ${pageTitle}`,
      sub: "One draft revision was created. Undo from the builder if it is not what you wanted.",
      action: { label: "Open page in builder", onClick: () => { app.go("builder"); } }
    });
  };

  return (
    <div className="m5">
      {/* header */}
      <header className="m5-head">
        <div>
          <h1 className="m5-title">Block Library</h1>
          <p className="m5-sub">Manage curated blocks and reusable section templates across your websites.</p>
        </div>
        <div className="m5-head-right">
          <label className="m5-site">
            <span>Website:</span>
            <select value={siteId} onChange={(e) => app.setSite(e.target.value)} aria-label="Website">
              {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <Btn icon="upload" disabled title="Import is disabled until the native interchange format is validated">Import Template</Btn>
          <Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => setCreateOpen(true)}>Create Template</Btn>
        </div>
      </header>

      {/* KPI strip — every number is computed */}
      <div className="m5-kpis">
        <KpiCard icon="layers" tone="violet" value={k.native} label="Native Blocks" sub="Core, schema-validated blocks" />
        <KpiCard icon="blocks" tone="blue" value={k.sections} label="Section Templates" sub="Prebuilt, ready-to-use sections" />
        <KpiCard icon="file" tone="violet" value={k.saved} label="Saved Templates" sub="Your reusable templates" />
        <KpiCard icon="layers" tone="green" value={k.inUse} label="In Use" sub="Templates placed on a page" />
      </div>

      <div className="m5-body">
        {/* rail */}
        <aside className="m5-rail" aria-label="Filters">
          <nav className="m5-views">
            {VIEWS.map((v) => (
              <button key={v.id} className={`m5-view ${view === v.id ? "is-on" : ""}`} onClick={() => switchView(v.id)} aria-pressed={view === v.id}>
                <Icon name={v.icon} size={14} />
                <span>{v.label}</span>
                {v.id === "saved" && <em>{k.saved}</em>}
              </button>
            ))}
          </nav>

          <div className="m5-sec">
            <label className="m5-label" htmlFor="m5-search">Search</label>
            <div className="m5-search">
              <Icon name="search" size={13} />
              <input
                id="m5-search" ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={SEARCH_HINT[view]} autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
              />
              {q && <button className="m5-clear" onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size={11} /></button>}
            </div>
          </div>

          <div className="m5-sec">
            <div className="m5-label">Category</div>
            <div className="m5-chips">
              {(result?.chips ?? [{ id: "All", label: "All", count: 0 }]).map((c) => (
                <button
                  key={c.id}
                  className={`m5-chip ${chip === c.id ? "is-on" : ""}`}
                  onClick={() => c.count > 0 && setChip(c.id)}
                  disabled={c.count === 0}
                  aria-pressed={chip === c.id}
                >
                  {c.label}<em>{c.count}</em>
                </button>
              ))}
            </div>
          </div>

          {view !== "native" && (
            <div className="m5-sec">
              <div className="m5-label">Scope</div>
              {(["Built-in", "Workspace", "This Site"] as LibScope[]).map((s) => (
                <label key={s} className="m5-check">
                  <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                  <span>{s}</span>
                  <em>{result?.facets.scope[s] ?? 0}</em>
                </label>
              ))}
            </div>
          )}

          {view === "native" && (
            <div className="m5-sec">
              <div className="m5-label">Compatibility</div>
              {([
                ["Schema-validated", k.native],
                ["Built-in", k.native],
                ["Reusable", k.reusable]
              ] as [string, number][]).map(([label, n]) => (
                <label key={label} className="m5-check">
                  <input
                    type="checkbox"
                    checked={compat.includes(label)}
                    onChange={() => setCompat((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]))}
                  />
                  <span>{label}</span>
                  <em>{n}</em>
                </label>
              ))}
            </div>
          )}

          {view === "saved" && (
            <div className="m5-sec">
              <div className="m5-label">Updated</div>
              {([["any", "Any time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["custom", "Custom range"]] as [UpdatedFilter, string][]).map(([id, label]) => (
                <label key={id} className="m5-radio">
                  <input type="radio" name="m5-updated" checked={updated === id} onChange={() => setUpdated(id)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}

          <div className="m5-rail-foot">
            <button className="m5-reset" onClick={() => { setQ(""); setChip("All"); setScopes([]); setUpdated("any"); setCompat(["Schema-validated", "Built-in", "Reusable"]); }}>Reset filters</button>
            <span>{site?.name}</span>
          </div>
        </aside>

        {/* main grid */}
        <main className="m5-main">
          <div className="m5-main-head">
            <div className="m5-main-heading">
              <h2 className="m5-main-title">
                {chip !== "All" && view !== "native"
                  ? <>Templates <span className="m5-count">({rows.length})</span> — {chip}</>
                  : <>{title} <span className="m5-count">({rows.length})</span></>}
                {view === "sections" && chip === "All" && (
                  <span className="m5-title-pill"><Icon name="blocks" size={12} />Section Templates</span>
                )}
              </h2>
              <p className="m5-main-sub">{subtitle}</p>
            </div>
            <div className="m5-main-tools">
              <button className="m5-sort" ref={sortBtn} onClick={() => setSortOpen((v) => !v)} aria-haspopup="menu" aria-expanded={sortOpen}>
                <span>Sort by:</span> {SORTS.find((s) => s.id === sort)?.label} <Icon name="chevDown" size={12} />
              </button>
              <div className="m5-toggle" role="group" aria-label="Layout">
                <button className={mode === "grid" ? "is-on" : ""} onClick={() => setMode("grid")} aria-pressed={mode === "grid"} aria-label="Grid view"><Icon name="dashboard" size={13} /></button>
                <button className={mode === "list" ? "is-on" : ""} onClick={() => setMode("list")} aria-pressed={mode === "list"} aria-label="List view"><Icon name="menu" size={13} /></button>
              </div>
            </div>
          </div>

          {status === "error" ? (
            <ErrorState title="The library service is unavailable" desc={error} onRetry={() => setRefreshTick((n) => n + 1)} />
          ) : status === "loading" && !result ? (
            <div className={`m5-grid ${mode === "list" ? "is-list" : ""}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="m5-card m5-skel">
                  <Skel style={{ height: 108, borderRadius: 10 }} />
                  <Skel style={{ height: 12, width: "62%", marginTop: 12 }} />
                  <Skel style={{ height: 10, width: "40%", marginTop: 8 }} />
                  <Skel style={{ height: 28, marginTop: 14, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="m5-empty">
              <div className="m5-empty-ico"><Icon name="search" size={20} /></div>
              <b>{q ? `No matches for “${q}”` : "Nothing here yet"}</b>
              <p>{q ? "Try a shorter word, or clear the category and scope filters." : "This view is empty in the current workspace."}</p>
              <Btn variant="sm" onClick={() => { setQ(""); setChip("All"); setScopes([]); }}>Clear filters</Btn>
            </div>
          ) : mode === "list" ? (
            <div className="m5-tablewrap">
              <table className="m5-table">
                <thead>
                  <tr><th /><th>Name</th><th>Kind</th><th>Category</th><th>Scope</th><th className="num">Blocks</th><th className="num">Used</th><th>Updated</th><th /></tr>
                </thead>
                <tbody>
                  {pageRows.map((entry) => (
                    <CardRow
                      key={entry.id}
                      entry={entry}
                      selected={sel === entry.id}
                      onSelect={() => { setSel(entry.id); setInspOpen(true); }}
                      onInsert={() => setInsertFor(entry)}
                      onMenu={(e) => openMenu(e, entry)}
                      readOnly={readOnly}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : grouped ? (
            <div className="m5-groups">
              {grouped.map((g) => (
                <section key={g.group} className="m5-group" aria-label={`${g.group} blocks`}>
                  <div className="m5-group-head">
                    <Icon name="layers" size={13} />
                    <span>{g.group} Blocks</span>
                    <em className="m5-group-n">({g.items.length})</em>
                    <small>{groupHint[g.group]}</small>
                  </div>
                  <div className={`m5-grid ${view === "native" ? "is-native" : ""}`}>
                    {g.items.map((entry) => (
                      <Card
                        key={entry.id}
                        entry={entry}
                        selected={sel === entry.id}
                        onSelect={() => { setSel(entry.id); setInspOpen(true); setTab("Overview"); }}
                        onInsert={() => setInsertFor(entry)}
                        onMenu={(e) => openMenu(e, entry)}
                        menuOpen={menuFor === entry.id}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={`m5-grid ${view === "native" ? "is-native" : ""}`}>
              {pageRows.map((entry) => (
                <Card
                  key={entry.id}
                  entry={entry}
                  selected={sel === entry.id}
                  onSelect={() => { setSel(entry.id); setInspOpen(true); setTab("Overview"); }}
                  onInsert={() => setInsertFor(entry)}
                  onMenu={(e) => openMenu(e, entry)}
                  menuOpen={menuFor === entry.id}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}

          <footer className="m5-foot">
            <span>
              {rows.length === 0 ? "No results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} of ${rows.length}`}
              {" "}· Templates are validated native React blocks · changes are saved as drafts
            </span>
            {pageCount > 1 && (
              <div className="m5-pager">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><Icon name="chevLeft" size={12} /></button>
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button key={i} className={page === i + 1 ? "is-on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>
                ))}
                <button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><Icon name="chevRight" size={12} /></button>
              </div>
            )}
          </footer>
        </main>

        {/* inspector */}
        {inspOpen ? (
          <Inspector
            entry={selected}
            tab={tab}
            setTab={setTab}
            onClose={() => setInspOpen(false)}
            onInsert={() => selected && setInsertFor(selected)}
            onPreview={() => selected && setPreviewFor(selected)}
            onPlacement={openPlacement}
            role={app.role}
          />
        ) : (
          <aside className="m5-insp is-closed" aria-label="Inspector closed">
            <button className="m5-reopen" onClick={() => setInspOpen(true)}>
              <Icon name="chevLeft" size={13} />
              <span>Inspector</span>
            </button>
          </aside>
        )}
      </div>

      {/* sort menu */}
      <Popover anchor={sortBtn.current} open={sortOpen} onClose={() => setSortOpen(false)}>
        {SORTS.map((s) => (
          <MenuItem key={s.id} icon={sort === s.id ? "check" : undefined} selected={sort === s.id} onClick={() => { setSort(s.id); setSortOpen(false); }}>
            {s.label}
          </MenuItem>
        ))}
      </Popover>

      {/* card menu */}
      <Popover anchor={menuAnchor} open={!!menuFor} onClose={() => setMenuFor(null)}>
        <MenuItem icon="eye" onClick={() => { const e = rows.find((r) => r.id === menuFor); setMenuFor(null); if (e) setPreviewFor(e); }}>Preview</MenuItem>
        <MenuItem icon="plus" disabled={readOnly} onClick={() => { const e = rows.find((r) => r.id === menuFor); setMenuFor(null); if (e) setInsertFor(e); }}>Insert into Page</MenuItem>
        <MenuItem
          icon="copy"
          disabled={readOnly}
          onClick={async () => {
            const id = menuFor!; setMenuFor(null);
            try {
              const copy = await LibraryAPI.duplicate(id);
              setRefreshTick((n) => n + 1); setSel(copy.id);
              app.toast({ type: "success", title: "Duplicated", sub: `“${copy.name}” is in Saved Templates with no placements.` });
            } catch (err) { app.toast({ type: "error", title: "Could not duplicate", sub: (err as Error).message }); }
          }}
        >
          Duplicate to My Templates
        </MenuItem>
        <MenuItem
          icon="trash" danger
          disabled={readOnly || !canDelete || !menuFor?.startsWith("svd-")}
          meta={!menuFor?.startsWith("svd-") ? "built-in" : undefined}
          onClick={() => { const e = rows.find((r) => r.id === menuFor) ?? null; setMenuFor(null); if (e) setDeleteFor(e); }}
        >
          Delete Template
        </MenuItem>
      </Popover>

      {insertFor && (
        <InsertModal
          entry={insertFor}
          siteId={siteId}
          onClose={() => setInsertFor(null)}
          onDone={afterInsert}
        />
      )}
      {createOpen && (
        <CreateTemplateModal
          siteId={siteId}
          onClose={() => setCreateOpen(false)}
          onDone={(entry) => {
            setCreateOpen(false); setRefreshTick((n) => n + 1); setView("saved"); setSel(entry.id);
            app.toast({ type: "success", title: "Template saved", sub: `“${entry.name}” now appears in Saved Templates.` });
          }}
        />
      )}
      {deleteFor && (
        <DeleteModal
          entry={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDone={(id) => {
            setDeleteFor(null); setRefreshTick((n) => n + 1); setSel(null);
            app.toast({ type: "success", title: "Template deleted", sub: "Copies already placed on pages were left untouched.", action: { label: "Undo", onClick: () => app.toast({ type: "info", title: "Undo is not wired to the prototype store", sub: "In the real build this restores the library entry." }) } });
            void id;
          }}
        />
      )}
      {previewFor && <PreviewModal entry={previewFor} onClose={() => setPreviewFor(null)} onInsert={() => { setInsertFor(previewFor); setPreviewFor(null); }} />}

      {LibraryAPI.mode.fail && (
        <div className="m5-devmode"><Tip text="Prototype failure injection">503 mode on</Tip></div>
      )}
    </div>
  );
}
