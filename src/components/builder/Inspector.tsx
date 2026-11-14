/* ============================================================
   Module 4 — the inspector
   Content | Style | Advanced, generated from the block schema.
   Style controls are token-bounded: they write steps from the
   theme scale, never arbitrary CSS.
   ============================================================ */
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/ui";
import { imageFor, type Asset, type BuilderForm } from "@/lib/builder-db";
import { REGISTRY, labelOf, type BlockNode, type FieldDef } from "@/lib/builder";

export type InspTab = "content" | "style" | "advanced";

export interface InspectorProps {
  node: BlockNode | null;
  tab: InspTab;
  setTab: (t: InspTab) => void;
  index: number;
  total: number;
  assets: Asset[];
  forms: BuilderForm[];
  siteId: string;
  readOnly: boolean;
  onPatch: (id: string, props: Record<string, any>) => void;
  onPatchStyle: (id: string, style: Record<string, any>) => void;
  onResetStyle: (id: string, key: string) => void;
  onOpenLink: (id: string, key: string, value: any) => void;
  onOpenMedia: (id: string, key: string, value: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onSelect: (id: string | null) => void;
  pageTitle: string;
  pagePath: string;
  pageTemplate: string;
  onOpenStructure: () => void;
}

const linkSummary = (v: any): string => {
  if (!v) return "Not linked";
  if (v.kind === "page") return v.path || "Choose a page";
  if (v.kind === "asset") return v.path || "Choose an asset";
  return v.url || "Set a link";
};
const linkKind = (v: any): string => (v?.kind === "page" ? "Page" : v?.kind === "asset" ? "Asset" : "External");

export function Inspector(p: InspectorProps) {
  const node = p.node;

  return (
    <aside className="wb-insp" aria-label="Inspector">
      <div className="wb-insp-tabs" role="tablist" aria-label="Inspector">
        {([["content", "Content"], ["style", "Style"], ["advanced", "Advanced"]] as [InspTab, string][]).map(([id, label]) => (
          <button key={id} role="tab" id={`wb-insp-${id}`} aria-selected={p.tab === id} aria-controls="wb-insp-panel"
            className={`wb-insp-tab ${p.tab === id ? "is-on" : ""}`} tabIndex={p.tab === id ? 0 : -1}
            onClick={() => p.setTab(id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const order: InspTab[] = ["content", "style", "advanced"];
              const i = order.indexOf(p.tab) + (e.key === "ArrowRight" ? 1 : -1);
              p.setTab(order[(i + 3) % 3]);
            }}>{label}</button>
        ))}
      </div>

      {!node && <PageFallback {...p} />}

      {node && (
        <>
          <header className="wb-insp-head">
            <span className="wb-insp-ico"><Icon name={REGISTRY[node.type].icon} size={14} /></span>
            <div className="wb-insp-title">
              <div className="wb-insp-name">{labelOf(node)}</div>
              <div className="wb-insp-sub">{p.total ? `Section ${p.index + 1} of ${p.total}` : "Nested block"}</div>
            </div>
            <div className="wb-insp-tools">
              <button className="icon-btn" aria-label="Move block up" title="Move up" onClick={() => p.onMove(node.id, -1)}><Icon name="chevDown" size={12} className="rot180" /></button>
              <button className="icon-btn" aria-label="Move block down" title="Move down" onClick={() => p.onMove(node.id, 1)}><Icon name="chevDown" size={12} /></button>
              <button className="icon-btn" aria-label="Duplicate block" title="Duplicate" onClick={() => p.onDuplicate(node.id)}><Icon name="copy" size={12} /></button>
              <button className="icon-btn" aria-label="Delete block" title="Delete" onClick={() => p.onDelete(node.id)}><Icon name="trash" size={12} /></button>
            </div>
          </header>

          <div className="wb-insp-body" id="wb-insp-panel" role="tabpanel" aria-labelledby={`wb-insp-${p.tab}`}>
            {p.tab === "content" && <ContentTab p={p} node={node} />}
            {p.tab === "style" && <StyleTab p={p} node={node} />}
            {p.tab === "advanced" && <AdvancedTab p={p} node={node} />}
          </div>
        </>
      )}
    </aside>
  );
}

/* ---------------- Content ---------------- */
function ContentTab({ p, node }: { p: InspectorProps; node: BlockNode }) {
  const def = REGISTRY[node.type];
  const fields = def.content.map((f) => (f.key === "formId" ? { ...f, options: p.forms.map((fm) => ({ value: fm.id, label: `${fm.name} · ${fm.fields} fields` })) } : f));
  return (
    <>
      {!fields.length && <div className="wb-insp-empty"><Icon name="sliders" size={16} /><b>No content settings</b><span>This block renders from the master layout.</span></div>}
      {fields.map((f) => <Field key={f.key} f={f} node={node} p={p} />)}
      {node.type === "container" || node.type === "columns" ? (
        <div className="wb-insp-hint"><Icon name="info" size={11} /> Nested blocks are selected directly on the canvas or in Page structure.</div>
      ) : null}
    </>
  );
}

function Field({ f, node, p }: { f: FieldDef; node: BlockNode; p: InspectorProps }) {
  const v = node.props[f.key];
  const set = (val: any) => p.onPatch(node.id, { [f.key]: val });
  const dis = p.readOnly;

  if (f.kind === "text")
    return (
      <label className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <input className="wb-input" value={v ?? ""} placeholder={f.placeholder} disabled={dis} onChange={(e) => set(e.target.value)} data-field={f.key} />
        {f.hint && <span className="wb-f-hint">{f.hint}</span>}
      </label>
    );

  if (f.kind === "textarea")
    return (
      <label className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <textarea className="wb-input" rows={f.rows ?? 3} value={v ?? ""} disabled={dis} onChange={(e) => set(e.target.value)} data-field={f.key} />
      </label>
    );

  if (f.kind === "select")
    return (
      <label className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <select className="wb-input" value={v ?? ""} disabled={dis} onChange={(e) => set(e.target.value)} data-field={f.key}>
          <option value="">{f.options?.length ? "Not set" : "No options"}</option>
          {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {f.key === "formId" && !p.forms.length && (
          <span className="wb-f-empty"><Icon name="form" size={11} /> No forms yet — create one in Forms &amp; Leads.</span>
        )}
      </label>
    );

  if (f.kind === "toggle")
    return (
      <div className="wb-f wb-f-row">
        <span className="wb-f-lab">{f.label}</span>
        <Switch checked={!!v} onChange={set} label={f.label} />
        {f.hint && <span className="wb-f-hint">{f.hint}</span>}
      </div>
    );

  if (f.kind === "segmented")
    return (
      <div className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <div className="wb-seg">
          {(f.options ?? []).map((o) => (
            <button key={o.value} className={`wb-seg-b ${String(v ?? f.options?.[0].value) === o.value ? "is-on" : ""}`}
              disabled={dis} onClick={() => set(o.value)} data-field={f.key} data-val={o.value}>{o.label}</button>
          ))}
        </div>
      </div>
    );

  if (f.kind === "link")
    return (
      <div className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <button className="wb-linkfield" onClick={() => p.onOpenLink(node.id, f.key, v)} disabled={dis} data-field={f.key}>
          <span className="wb-linkfield-kind">{linkKind(v)}</span>
          <span className="wb-linkfield-txt">{linkSummary(v)}</span>
          <Icon name="external" size={12} />
        </button>
        {v?.broken && <span className="wb-f-err"><Icon name="alert" size={10} /> This page was deleted.</span>}
      </div>
    );

  if (f.kind === "media") {
    const asset = p.assets.find((a) => a.id === v);
    return (
      <div className="wb-f">
        <span className="wb-f-lab">{f.label}</span>
        <div className="wb-mediafield">
          {v ? (
            <>
              <span className="wb-media-thumb" style={asset ? { backgroundImage: `url(${imageFor(asset.id)})` } : undefined}>
                {!asset && <Icon name="image" size={13} />}
              </span>
              <span className="wb-media-meta">
                <b>{asset?.name ?? (v ? "Missing asset" : "")}</b>
                <i>{asset ? `${asset.w} × ${asset.h} · ${asset.size}` : "No longer in Media"}</i>
              </span>
              <button className="icon-btn" aria-label="Replace image" onClick={() => p.onOpenMedia(node.id, f.key, v)}><Icon name="pencil" size={12} /></button>
              <button className="icon-btn" aria-label="Remove image" onClick={() => set("")}><Icon name="trash" size={12} /></button>
            </>
          ) : (
            <button className="wb-media-empty" onClick={() => p.onOpenMedia(node.id, f.key, "")}><Icon name="image" size={13} /> Choose an image</button>
          )}
        </div>
      </div>
    );
  }

  if (f.kind === "items") {
    const items: any[] = Array.isArray(v) ? v : [];
    return (
      <div className="wb-f">
        <span className="wb-f-lab">{f.label}<span className="wb-f-count">{items.length}</span></span>
        <div className="wb-repeater">
          {items.map((it, i) => (
            <div className="wb-rep-row" key={i} data-item={i}>
              <span className="wb-rep-no">{i + 1}</span>
              <div className="wb-rep-fields">
                {(f.itemFields ?? []).map((sf) => (
                  <label className="wb-rep-f" key={sf.key}>
                    <span>{sf.label}</span>
                    {sf.kind === "textarea" ? (
                      <textarea className="wb-input" rows={2} value={it[sf.key] ?? ""} disabled={dis}
                        onChange={(e) => set(items.map((x, k) => (k === i ? { ...x, [sf.key]: e.target.value } : x)))} />
                    ) : sf.kind === "select" ? (
                      <select className="wb-input" value={it[sf.key] ?? ""} disabled={dis}
                        onChange={(e) => set(items.map((x, k) => (k === i ? { ...x, [sf.key]: e.target.value } : x)))}>
                        {(sf.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input className="wb-input" value={it[sf.key] ?? ""} disabled={dis}
                        onChange={(e) => set(items.map((x, k) => (k === i ? { ...x, [sf.key]: e.target.value } : x)))} />
                    )}
                  </label>
                ))}
              </div>
              <button className="icon-btn wb-rep-x" aria-label={`Remove item ${i + 1}`} disabled={dis}
                onClick={() => set(items.filter((_, k) => k !== i))}><Icon name="x" size={11} /></button>
            </div>
          ))}
          <button className="wb-rep-add" disabled={dis}
            onClick={() => set([...items, Object.fromEntries((f.itemFields ?? []).map((sf) => [sf.key, ""]))])}>
            <Icon name="plus" size={11} /> Add {f.itemLabel ?? "item"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* ---------------- Style ---------------- */
function StyleTab({ p, node }: { p: InspectorProps; node: BlockNode }) {
  const def = REGISTRY[node.type];
  const [open, setOpen] = useState<Record<string, boolean>>({ Layout: true });
  return (
    <>
      <div className="wb-insp-hint"><Icon name="palette" size={11} /> Values come from the theme scale. Overrides are per block.</div>
      {def.style.map((f) => {
        const overridden = node.style?.[f.key] !== undefined;
        const value = overridden ? node.style[f.key] : f.inherit;
        return (
          <div className="wb-f" key={f.key}>
            <span className="wb-f-lab">
              {f.label}
              {overridden ? (
                <button className="wb-reset" title="Reset to theme" aria-label={`Reset ${f.label} to the theme value`} onClick={() => p.onResetStyle(node.id, f.key)}>
                  <i className="wb-ovr-dot" /> Override
                </button>
              ) : <span className="wb-inherit">Inherited</span>}
            </span>
            <div className="wb-seg">
              {(f.options ?? []).map((o) => (
                <button key={o.value} disabled={p.readOnly}
                  className={`wb-seg-b ${String(value) === o.value ? "is-on" : ""}`}
                  onClick={() => p.onPatchStyle(node.id, { [f.key]: o.value })}>{o.label}</button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => setOpen((o) => ({ ...o, Layout: !o.Layout }))} aria-expanded={open.Layout !== false}>
          <Icon name="chevDown" size={12} className={open.Layout === false ? "rot270" : ""} /> Layout
        </button>
        {open.Layout !== false && (
          <div className="wb-acc-body">
            <div className="wb-kv"><span>Container</span><b>1120 px</b></div>
            <div className="wb-kv"><span>Stack below</span><b>768 px</b></div>
            <div className="wb-kv"><span>Radius</span><b>from theme</b></div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- Advanced ---------------- */
const LOCKED: { label: string; reason: string; icon: string }[] = [
  { label: "Visibility rules", reason: "Needs the audience-rule engine (Phase 2).", icon: "eye" },
  { label: "Custom attributes", reason: "Arbitrary attributes are not typed props.", icon: "code" },
  { label: "Analytics & tracking", reason: "Needs a consent and telemetry contract.", icon: "activity" },
  { label: "Schema & SEO metadata", reason: "Site-level SEO lives in SEO & Redirects.", icon: "search" }
];

function AdvancedTab({ p, node }: { p: InspectorProps; node: BlockNode }) {
  const adv = node.props.__adv ?? {};
  const [open, setOpen] = useState<Record<string, boolean>>({ anchor: true, aria: true, responsive: true, animation: false, layout: false });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const setAdv = (patch: Record<string, any>) => p.onPatch(node.id, { __adv: { ...adv, ...patch } });
  const hide: string[] = adv.hide ?? [];

  return (
    <>
      <div className="wb-insp-hint"><Icon name="lock" size={11} /> Five groups are live. Four are locked with a reason — not hidden.</div>

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => toggle("anchor")} aria-expanded={!!open.anchor}><Icon name="chevDown" size={12} className={open.anchor ? "" : "rot270"} /> Anchor &amp; label</button>
        {open.anchor && (
          <div className="wb-acc-body">
            <label className="wb-f"><span className="wb-f-lab">Anchor ID</span>
              <input className="wb-input" value={adv.anchor ?? ""} placeholder="e.g. destinations" data-field="anchor"
                onChange={(e) => setAdv({ anchor: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })} />
              <span className="wb-f-hint">Used by in-page navigation. Does not add a menu item.</span>
            </label>
          </div>
        )}
      </div>

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => toggle("aria")} aria-expanded={!!open.aria}><Icon name="chevDown" size={12} className={open.aria ? "" : "rot270"} /> Accessibility label</button>
        {open.aria && (
          <div className="wb-acc-body">
            <label className="wb-f"><span className="wb-f-lab">ARIA label</span>
              <input className="wb-input" value={adv.aria ?? ""} placeholder="Describes the section to screen readers" data-field="aria"
                onChange={(e) => setAdv({ aria: e.target.value })} />
              <span className="wb-f-hint">Read instead of the block name when a screen reader reaches this section.</span>
            </label>
          </div>
        )}
      </div>

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => toggle("responsive")} aria-expanded={!!open.responsive}><Icon name="chevDown" size={12} className={open.responsive ? "" : "rot270"} /> Responsive visibility</button>
        {open.responsive && (
          <div className="wb-acc-body">
            {["desktop", "tablet", "mobile"].map((d) => (
              <div className="wb-f wb-f-row" key={d}>
                <span className="wb-f-lab" style={{ margin: 0 }}>{d[0].toUpperCase() + d.slice(1)}</span>
                <Switch checked={!hide.includes(d)} label={`Show on ${d}`}
                  onChange={(on) => setAdv({ hide: on ? hide.filter((x) => x !== d) : [...hide, d] })} />
              </div>
            ))}
            <div className="wb-f-hint">Hidden blocks stay in the document; they are skipped at render time.</div>
          </div>
        )}
      </div>

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => toggle("animation")} aria-expanded={!!open.animation}><Icon name="chevDown" size={12} className={open.animation ? "" : "rot270"} /> Animation</button>
        {open.animation && (
          <div className="wb-acc-body">
            <label className="wb-f"><span className="wb-f-lab">Entrance</span>
              <select className="wb-input" value={adv.anim ?? "none"} data-field="anim" onChange={(e) => setAdv({ anim: e.target.value })}>
                <option value="none">None</option>
                <option value="fade">Fade In</option>
                <option value="up">Fade In Up</option>
                <option value="zoom">Zoom In</option>
              </select>
              <span className="wb-f-hint">Disabled automatically for visitors who prefer reduced motion.</span>
            </label>
          </div>
        )}
      </div>

      <div className="wb-acc">
        <button className="wb-acc-head" onClick={() => toggle("layout")} aria-expanded={!!open.layout}><Icon name="chevDown" size={12} className={open.layout ? "" : "rot270"} /> Layout behaviour</button>
        {open.layout && (
          <div className="wb-acc-body">
            <label className="wb-f"><span className="wb-f-lab">Overflow</span>
              <select className="wb-input" value={adv.overflow ?? "clip"} onChange={(e) => setAdv({ overflow: e.target.value })}>
                <option value="clip">Clip to container</option>
                <option value="bleed">Full-bleed background</option>
              </select>
            </label>
            <div className="wb-kv"><span>Position</span><b>In flow</b></div>
            <div className="wb-kv"><span>Depth</span><b>{p.total ? "Root" : "Nested"}</b></div>
          </div>
        )}
      </div>

      {LOCKED.map((l) => (
        <div className="wb-locked" key={l.label} title={l.reason}>
          <span className="wb-locked-ico"><Icon name={l.icon} size={13} /></span>
          <div className="grow">
            <div className="wb-locked-t">{l.label}</div>
            <div className="wb-locked-r">{l.reason}</div>
          </div>
          <Icon name="lock" size={12} />
        </div>
      ))}
    </>
  );
}

/* ---------------- no selection ---------------- */
function PageFallback(p: InspectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="wb-insp-body is-page" ref={ref}>
      <div className="wb-insp-empty">
        <Icon name="cursor" size={18} />
        <b>Nothing selected</b>
        <span>Click a block on the canvas, or pick one from Page structure.</span>
        <button className="wb-ghost-btn" onClick={p.onOpenStructure}><Icon name="sitemap" size={11} /> Open page structure</button>
      </div>
      <div className="wb-page-card">
        <div className="wb-page-card-h">Page</div>
        <div className="wb-kv"><span>Title</span><b className="truncate">{p.pageTitle}</b></div>
        <div className="wb-kv"><span>Route</span><b className="mono truncate">{p.pagePath}</b></div>
        <div className="wb-kv"><span>Template</span><b>{p.pageTemplate}</b></div>
        <div className="wb-kv"><span>Site</span><b>{p.siteId.replace("site_", "").replace(/^\w/, (c) => c.toUpperCase())}</b></div>
      </div>
      <div className="wb-insp-hint"><Icon name="info" size={11} /> Page settings — title, slug and layout — live in Pages.</div>
    </div>
  );
}
