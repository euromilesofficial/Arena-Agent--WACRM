/* ============================================================
   Module 4 — the library panel
   Blocks | Sections | Pages, with per-tab search, chips and scroll
   that survives tab switches (the panel is mounted once).
   ============================================================ */
import { useMemo, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Skel } from "@/components/ui";
import {
  ARCHETYPES, CHIPS, chipCount, GROUP_ORDER, labelOf, PAGE_TEMPLATES, REGISTRY,
  SECTION_CATEGORIES, SECTION_PRESETS, sectionCount, type BlockDef, type BlockNode,
  type BlockType, type LibChip, type PageTemplate, type SectionPreset
} from "@/lib/builder";
import { SAMPLE_IMAGES } from "@/lib/builder-images";

export type LibTab = "blocks" | "sections" | "pages";

export interface LibraryProps {
  tab: LibTab;
  setTab: (t: LibTab) => void;
  chip: LibChip;
  setChip: (c: LibChip) => void;
  sectionCat: string;
  setSectionCat: (c: string) => void;
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  doc: BlockNode[];
  selId: string | null;
  onSelect: (id: string) => void;
  onInsertBlock: (def: BlockDef, variant?: string) => void;
  onInsertSection: (p: SectionPreset) => void;
  onUseTemplate: (t: PageTemplate) => void;
  onPreview: (kind: "section" | "template", id: string) => void;
  onSaveTemplate: () => void;
  onDragStart: (e: React.PointerEvent, payload: { label: string; def?: BlockDef; preset?: SectionPreset; id?: string }) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  emptyLibrary: boolean;
  templates?: PageTemplate[];
  /** M7 slot policy — when a layout narrows the allowed block types, the
      library shows only those. Undefined or empty allow-list = all. */
  policy?: { allow: BlockType[]; deny: BlockType[]; maxBlocks: number } | null;
  layoutName?: string;
}

const Thumb = ({ preset }: { preset: SectionPreset }) => {
  const blocks = useMemo(() => preset.build(), [preset]);
  const media = useMemo(() => {
    for (const b of blocks) {
      if (b.props?.media) return b.props.media as string;
      for (const k of ["items", "tiers"]) {
        const arr = b.props?.[k];
        if (Array.isArray(arr)) for (const it of arr) if (it?.media) return it.media as string;
      }
    }
    return "";
  }, [blocks]);
  const cls = `wb-thumb wb-thumb-${preset.category.toLowerCase()}`;
  return (
    <div className={cls} aria-hidden>
      {media && <div className="wb-thumb-img" style={{ backgroundImage: `url(${imgUrl(media)})` }} />}
      <div className="wb-thumb-body">
        {preset.category === "Features" ? (
          <div className="wb-thumb-cols">
            {[0, 1, 2, 3].map((i) => <div className="wb-thumb-col" key={i}><i /><b /><b /></div>)}
          </div>
        ) : preset.category === "Hero" ? (
          <>
            <i className="wb-thumb-eyebrow" />
            <b className="wb-thumb-h" />
            <b className="wb-thumb-h short" />
            <div className="wb-thumb-btns"><i /><i /></div>
          </>
        ) : preset.category === "CTA" ? (
          <>
            <b className="wb-thumb-h mid" />
            <i className="wb-thumb-btn" />
          </>
        ) : (
          <>
            <i className="wb-thumb-eyebrow" />
            <b className="wb-thumb-h mid" />
            <b className="wb-thumb-line" /><b className="wb-thumb-line short" />
          </>
        )}
      </div>
    </div>
  );
};

const imgUrl = (key: string): string => SAMPLE_IMAGES[key] ?? "";

export function Library(p: LibraryProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const q = p.query.trim().toLowerCase();

  /* A layout's slot policy is a real gate, not a label: the tiles here are the
     only block types this page may receive (§F2 of the M7 review). */
  const allowSet = p.policy && p.policy.allow.length ? new Set<string>(p.policy.allow) : null;
  const denySet = p.policy ? new Set<string>(p.policy.deny) : new Set<string>();
  const allowedTypes = ARCHETYPES.filter((d) => (allowSet ? allowSet.has(d.type) : true) && !denySet.has(d.type));
  const policyNarrowed = !!p.policy && (allowedTypes.length < ARCHETYPES.length);

  const blocks = ARCHETYPES.filter((d) => {
    const chip = CHIPS.find((c) => c.id === p.chip)!;
    if (!chip.groups.includes(d.group)) return false;
    if (allowSet && !allowSet.has(d.type)) return false;
    if (denySet.has(d.type)) return false;
    if (!q) return true;
    return `${d.label} ${d.paletteLabel ?? ""} ${d.hint}`.toLowerCase().includes(q);
  });
  const chipN = (id: LibChip) => ARCHETYPES.filter((d) => CHIPS.find((c) => c.id === id)!.groups.includes(d.group) && (allowSet ? allowSet.has(d.type) : true) && !denySet.has(d.type)).length;

  const sections = SECTION_PRESETS.filter((s) => {
    if (p.sectionCat !== "All" && s.category !== p.sectionCat) return false;
    if (!q) return true;
    return `${s.name} ${s.desc} ${s.category}`.toLowerCase().includes(q);
  });

  const allTemplates = p.templates ?? PAGE_TEMPLATES;
  const templates = allTemplates.filter((t) => !q || `${t.name} ${t.desc} ${t.intent}`.toLowerCase().includes(q));

  return (
    <aside className="wb-lib" aria-label="Library">
      <div className="wb-lib-tabs" role="tablist" aria-label="Library">
        {([["blocks", "Blocks"], ["sections", "Sections"], ["pages", "Pages"]] as [LibTab, string][]).map(([id, label]) => (
          <button key={id} role="tab" id={`wb-tab-${id}`} aria-selected={p.tab === id} aria-controls="wb-lib-panel"
            tabIndex={p.tab === id ? 0 : -1} className={`wb-lib-tab ${p.tab === id ? "is-on" : ""}`}
            onClick={() => { p.setTab(id); p.setQuery(""); searchRef.current?.focus(); }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const order: LibTab[] = ["blocks", "sections", "pages"];
              const i = order.indexOf(p.tab) + (e.key === "ArrowRight" ? 1 : -1);
              p.setTab(order[(i + 3) % 3]);
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="wb-lib-search">
        <Icon name="search" size={13} />
        <input ref={searchRef} className="wb-search-input" value={p.query} onChange={(e) => p.setQuery(e.target.value)}
          aria-label={p.tab === "blocks" ? "Search blocks" : p.tab === "sections" ? "Search section templates" : "Search page templates"}
          placeholder={p.tab === "blocks" ? "Search blocks…" : p.tab === "sections" ? "Search section templates…" : "Search page templates…"} />
        {p.query && <button className="icon-btn" aria-label="Clear search" onClick={() => p.setQuery("")}><Icon name="x" size={11} /></button>}
      </div>

      <div className="wb-lib-chips" role="group" aria-label="Filter">
        {p.tab === "blocks"
          ? CHIPS.map((c) => (
            <button key={c.id} className={`wb-chip ${p.chip === c.id ? "is-on" : ""}`} aria-pressed={p.chip === c.id}
              onClick={() => p.setChip(c.id)}disabled={chipN(c.id) === 0}>{c.label}<span className="wb-chip-n">{policyNarrowed ? chipN(c.id) : chipCount(c.id)}</span></button>
          ))
          : p.tab === "sections"
            ? SECTION_CATEGORIES.map((c) => (
              <button key={c} className={`wb-chip ${p.sectionCat === c ? "is-on" : ""}`} aria-pressed={p.sectionCat === c}
                onClick={() => p.setSectionCat(c)}>{c}<span className="wb-chip-n">{sectionCount(c)}</span></button>
            ))
            : null}
      </div>

      {p.tab === "blocks" && policyNarrowed && (
        <div className="wb-lib-policy" data-policy="1" title={`${p.layoutName ?? "This layout"} allows ${allowedTypes.length} of ${ARCHETYPES.length} block types`}>
          <Icon name="lock" size={11} />
          <span><b>{p.layoutName ?? "Layout"}</b> allows {allowedTypes.length}/{ARCHETYPES.length} blocks</span>
        </div>
      )}

      <div className="wb-lib-body" id="wb-lib-panel" role="tabpanel" aria-labelledby={`wb-tab-${p.tab}`}>
        {p.loading && p.tab !== "pages" && (
          <div className="wb-lib-skel">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} style={{ height: p.tab === "sections" ? 96 : 62, borderRadius: 10, marginBottom: 8 }} />)}
          </div>
        )}

        {!p.loading && p.tab === "blocks" && (
          <>
            {p.emptyLibrary && <div className="wb-lib-empty"><Icon name="blocks" size={16} /><b>No blocks available</b><span>The block catalogue is empty for this workspace.</span></div>}
            {!p.emptyLibrary && !blocks.length && (
              <div className="wb-lib-empty"><Icon name="search" size={16} /><b>No blocks match “{p.query}”</b><span>Try a different word, or clear the filter.</span></div>
            )}
            {!p.emptyLibrary && GROUP_ORDER.map((g) => {
              const items = blocks.filter((d) => d.group === g);
              if (!items.length) return null;
              return (
                <section className="wb-group" key={g} aria-label={g}>
                  <div className="wb-group-head"><Icon name={GROUP_ICON[g]} size={12} /><span>{g}</span><span className="wb-group-n">{items.length}</span></div>
                  <div className="wb-tiles">
                    {items.map((d) => (
                      <button key={d.type} className="wb-tile" data-block={d.type}
                        title={`${d.hint}${d.offered ? "" : " (not insertable)"}`}
                        onClick={() => p.onInsertBlock(d)}
                        onPointerDown={(e) => p.onDragStart(e, { label: d.paletteLabel ?? d.label, def: d })}>
                        <span className="wb-tile-ico"><Icon name={d.icon} size={16} /></span>
                        <span className="wb-tile-label">{d.paletteLabel ?? d.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            <div className="wb-lib-note"><Icon name="info" size={11} /> Footer is part of the master layout — edit it in Layouts &amp; Templates.</div>
          </>
        )}

        {!p.loading && p.tab === "sections" && (
          <>
            {!sections.length && (
              <div className="wb-lib-empty"><Icon name="search" size={16} /><b>No sections match “{p.query}”</b><span>Try another category.</span></div>
            )}
            {sections.map((s) => (
              <article className="wb-sec-card" key={s.id} data-section={s.id}>
                <Thumb preset={s} />
                <div className="wb-sec-meta">
                  <div className="wb-sec-name">{s.name}</div>
                  <div className="wb-sec-desc">{s.desc}</div>
                  <div className="wb-sec-actions">
                    <button className="wb-ghost-btn" onClick={() => p.onPreview("section", s.id)}><Icon name="eye" size={11} /> Preview</button>
                    <button className="wb-insert-btn" onClick={() => p.onInsertSection(s)}
                      onPointerDown={(e) => p.onDragStart(e, { label: s.name, preset: s })}>
                      <Icon name="plus" size={11} /> Insert
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </>
        )}

        {p.tab === "pages" && (
          <>
            <div className="wb-group-head"><Icon name="layers" size={12} /><span>Templates</span><span className="wb-group-n">{templates.length}</span></div>
            {!templates.length && (
              <div className="wb-lib-empty"><Icon name="search" size={16} /><b>No templates match “{p.query}”</b><span>Try another word.</span></div>
            )}
            {templates.map((t) => (
              <article className="wb-tpl-card" key={t.id} data-template={t.id}>
                <div className="wb-tpl-top">
                  <div className="wb-tpl-ico"><Icon name="file" size={14} /></div>
                  <div className="wb-tpl-name">{t.name}</div>
                </div>
                <div className="wb-tpl-meta"><span className="wb-mini-pill">{t.intent}</span><span>{t.sections} sections</span></div>
                <div className="wb-sec-desc">{t.desc}</div>
                <div className="wb-sec-actions">
                  <button className="wb-ghost-btn" onClick={() => p.onPreview("template", t.id)}><Icon name="eye" size={11} /> Preview</button>
                  <button className="wb-insert-btn" onClick={() => p.onUseTemplate(t)}><Icon name="plus" size={11} /> Use</button>
                </div>
              </article>
            ))}

            <button className="wb-save-tpl" onClick={p.onSaveTemplate}><Icon name="plus" size={12} /> Save current page as template</button>

            <div className="wb-group-head wb-structure-head">
              <Icon name="sitemap" size={12} /><span>Current page structure</span><span className="wb-group-n">{p.doc.length}</span>
            </div>
            <div className="wb-structure" role="tree" aria-label="Current page structure">
              {!p.doc.length && <div className="wb-structure-empty">This page is empty. Add a section or use a template.</div>}
              {p.doc.map((n, i) => (
                <div key={n.id} className={`wb-struct-row ${p.selId === n.id ? "is-sel" : ""}`} role="treeitem" aria-selected={p.selId === n.id} tabIndex={0}
                  data-struct={n.id}
                  onClick={() => p.onSelect(n.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onSelect(n.id); } }}>
                  <span className="wb-struct-no">{i + 1}</span>
                  <Icon name={REGISTRY[n.type].icon} size={11} />
                  <span className="wb-struct-name">{labelOf(n)}</span>
                  <span className="wb-struct-move">
                    <button aria-label="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); p.onMove(n.id, -1); }}><Icon name="chevDown" size={10} /></button>
                    <button aria-label="Move down" disabled={i === p.doc.length - 1} onClick={(e) => { e.stopPropagation(); p.onMove(n.id, 1); }}><Icon name="chevDown" size={10} /></button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

const GROUP_ICON: Record<string, string> = {
  Content: "type", Media: "image", Layout: "columns", Form: "form"
};
