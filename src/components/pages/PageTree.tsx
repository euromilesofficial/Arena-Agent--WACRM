/* ============================================================
   Module 3 · Page Structure tree
   Keyboard: ↑↓ move, ←→ collapse/expand, Enter select, Home/End.
   Filtering keeps ancestors visible so context is never lost.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import type { TreeNode } from "@/lib/cms-pages";

interface Props {
  nodes: TreeNode[];
  selectedId: string | null;
  loading: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onCreateAt: (parentId: string | null) => void;
  onOptions: (which: "expand" | "collapse" | "refresh" | "paths") => void;
  /** bump to force every branch open / closed (tree menu, not a toast) */
  expandSignal?: number;
  collapseSignal?: number;
}

export function PageTree({ nodes, selectedId, loading, readOnly, onSelect, onCreateAt, onOptions, expandSignal = 0, collapseSignal = 0 }: Props) {
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { visible, matches } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { visible: nodes.filter((n) => !isHidden(n, nodes, collapsed)), matches: new Set<string>() };
    const hit = new Set<string>();
    nodes.forEach((n) => { if (n.title.toLowerCase().includes(needle) || n.path.toLowerCase().includes(needle)) hit.add(n.id); });
    const keep = new Set<string>();
    hit.forEach((id) => {
      let cur = nodes.find((n) => n.id === id);
      while (cur) { keep.add(cur.id); cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined; }
    });
    // descendants of a matching parent stay visible too
    nodes.forEach((n) => { if (n.parentId && keep.has(n.parentId)) keep.add(n.id); });
    return { visible: nodes.filter((n) => keep.has(n.id)), matches: hit };
  }, [nodes, collapsed, q]);

  useEffect(() => { if (focusIdx > visible.length - 1) setFocusIdx(Math.max(0, visible.length - 1)); }, [visible.length, focusIdx]);

  useEffect(() => { if (expandSignal) setCollapsed(new Set()); }, [expandSignal]);
  useEffect(() => { if (collapseSignal) setCollapsed(new Set(nodes.filter((n) => n.hasChildren).map((n) => n.id))); }, [collapseSignal]);

  const move = (dir: number) => setFocusIdx((i) => Math.min(visible.length - 1, Math.max(0, i + dir)));
  const current = visible[focusIdx];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!visible.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setFocusIdx(0); }
    else if (e.key === "End") { e.preventDefault(); setFocusIdx(visible.length - 1); }
    else if (e.key === "ArrowRight" && current) {
      e.preventDefault();
      if (current.hasChildren && collapsed.has(current.id)) toggle(current.id);
    } else if (e.key === "ArrowLeft" && current) {
      e.preventDefault();
      if (current.hasChildren && !collapsed.has(current.id)) toggle(current.id);
      else if (current.parentId) onSelect(current.parentId);
    } else if (e.key === "Enter" && current) { e.preventDefault(); onSelect(current.id); }
  };

  const toggle = (id: string) => setCollapsed((c) => {
    const next = new Set(c);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section className="card d3-tree" aria-label="Page structure">
      <div className="d3-card-head">
        <div className="d3-card-title"><Icon name="sitemap" size={13} /> Page Structure</div>
        <div className="d3-head-actions">
          <button className="icon-btn icon-sm" aria-label="New child page" title="New page under the selected page"
            disabled={readOnly} onClick={() => onCreateAt(selectedId && visible.find((v) => v.id === selectedId)?.hasChildren !== undefined ? selectedId : null)}>
            <Icon name="plus" size={14} />
          </button>
          <button className="icon-btn icon-sm" aria-label="Tree options" aria-haspopup="menu" onClick={() => onOptions("expand")}>
            <Icon name="more" size={14} />
          </button>
        </div>
      </div>

      <div className="d3-tree-search">
        <Icon name="search" size={12} />
        <input className="input bare" placeholder="Search pages…" value={q} aria-label="Search page structure"
          onChange={(e) => setQ(e.target.value)} />
        {q && <button className="icon-btn icon-sm" aria-label="Clear structure search" onClick={() => setQ("")}><Icon name="x" size={11} /></button>}
      </div>

      <div className="d3-tree-body" ref={listRef} role="tree" aria-label="Page hierarchy" tabIndex={0} onKeyDown={onKeyDown}>
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="sk sk-line" style={{ width: `${58 + ((i * 13) % 34)}%`, marginLeft: 8 + (i % 3) * 14, marginTop: 9 }} />
        ))}

        {!loading && !visible.length && (
          <div className="d3-tree-empty">
            <Icon name="sitemap" size={16} />
            <div className="f11 muted">{q ? "No page matches that search." : "No pages yet."}</div>
            {q && <button className="link f11" onClick={() => setQ("")}>Clear search</button>}
          </div>
        )}

        {!loading && visible.map((n, i) => {
          const isSel = selectedId === n.id;
          const isMatch = matches.has(n.id);
          return (
            <div key={n.id} role="treeitem" aria-level={n.depth + 1} aria-selected={isSel}
              aria-expanded={n.hasChildren ? !collapsed.has(n.id) : undefined}
              className={`d3-node ${isSel ? "is-sel" : ""} ${isMatch ? "is-match" : ""} ${focusIdx === i ? "is-focus" : ""}`}
              style={{ paddingLeft: 6 + n.depth * 14 }}
              onClick={() => { setFocusIdx(i); onSelect(n.id); }}
              onFocus={() => setFocusIdx(i)}
              tabIndex={focusIdx === i ? 0 : -1}>
              {n.hasChildren ? (
                <button className="d3-twist" aria-label={collapsed.has(n.id) ? `Expand ${n.title}` : `Collapse ${n.title}`}
                  onClick={(e) => { e.stopPropagation(); toggle(n.id); }}>
                  <Icon name={collapsed.has(n.id) ? "chevRight" : "chevDown"} size={11} />
                </button>
              ) : <span className="d3-twist-spacer" />}
              <Icon name={n.isHome ? "home" : n.hasChildren ? "folder" : "file"} size={12} className="d3-node-ico" />
              <span className="d3-node-title truncate">{n.title}</span>
              {n.hasChanges && <span className="d3-dot" title="Has unpublished changes" />}
              {n.status === "draft" && <span className="d3-node-draft" title="Draft — not in the live release">D</span>}
            </div>
          );
        })}
      </div>

      <div className="d3-tree-foot">
        <span className="f11 muted">{nodes.length} page{nodes.length === 1 ? "" : "s"}</span>
        <button className="link f11" disabled={readOnly} onClick={() => onCreateAt(null)}>
          <Icon name="plus" size={10} /> New page
        </button>
      </div>
    </section>
  );
}

function isHidden(n: TreeNode, nodes: TreeNode[], collapsed: Set<string>): boolean {
  let parent = n.parentId;
  while (parent) {
    if (collapsed.has(parent)) return true;
    parent = nodes.find((x) => x.id === parent)?.parentId ?? null;
  }
  return false;
}
