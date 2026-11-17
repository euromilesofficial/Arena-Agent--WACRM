/* ============================================================
   Module 7 · Block fields for a layout slot or a template's starter block
   ------------------------------------------------------------
   Select a block on the canvas, edit its content in the side inspector,
   and keep structure (order, removal) in the list. Fields come from the
   block registry, so the inspector and the renderer agree about what a
   block contains.

   Every content field kind is editable here: text, long text, select,
   segmented, toggle, number, link (page or URL), media (from the Media
   library) and repeating items. Only style tokens (spacing, colour,
   type) stay with the Visual Builder and Theme Studio, which own them.
   ============================================================ */
import { REGISTRY, type BlockNode, type FieldDef } from "@/lib/builder";
import { BuilderAPI } from "@/lib/builder-db";
import { Icon } from "@/components/Icon";

type Patch = (key: string, value: unknown) => void;

/* A link is stored as the builder stores it: {kind:"page",path} or {kind:"url",url}. */
const linkText = (v: any): string => (v?.kind === "page" ? v.path ?? "" : v?.url ?? "");
const toLink = (text: string): unknown => {
  const t = text.trim();
  if (!t) return "";
  return t.startsWith("/") ? { kind: "page", path: t } : { kind: "url", url: t };
};

function Row({ label, children, htmlFor, wide }: { label: string; children: React.ReactNode; htmlFor?: string; wide?: boolean }) {
  return (
    <label className={`m7-bf-row ${wide ? "m7-bf-area" : ""}`} htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Field({ f, value, onChange, readOnly, id, siteId }: {
  f: FieldDef; value: any; onChange: (v: unknown) => void; readOnly?: boolean; id: string; siteId: string;
}) {
  switch (f.kind) {
    case "toggle":
      return (
        <label className="m7-bf-row m7-bf-toggle" htmlFor={id}>
          <span>{f.label}</span>
          <input id={id} type="checkbox" checked={!!value} disabled={readOnly} onChange={(e) => onChange(e.target.checked)} />
        </label>
      );
    case "select":
    case "segmented":
      return (
        <Row label={f.label} htmlFor={id}>
          <select id={id} value={String(value ?? f.options?.[0]?.value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)}>
            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
      );
    case "number":
      return (
        <Row label={f.label} htmlFor={id}>
          <input id={id} type="number" value={value ?? ""} disabled={readOnly} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        </Row>
      );
    case "textarea":
      return (
        <Row label={f.label} htmlFor={id} wide>
          <textarea id={id} rows={f.rows ?? 3} value={String(value ?? "")} placeholder={f.placeholder} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
        </Row>
      );
    case "link":
      return (
        <Row label={f.label} htmlFor={id}>
          <input id={id} type="text" value={linkText(value)} placeholder="/page-path or https://…" disabled={readOnly}
            onChange={(e) => onChange(toLink(e.target.value))} />
        </Row>
      );
    case "media": {
      const assets = BuilderAPI.assets(siteId);
      return (
        <Row label={f.label} htmlFor={id}>
          <select id={id} value={String(value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)}>
            <option value="">No image</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            {value && !assets.some((a) => a.id === value) && <option value={value}>Missing asset</option>}
          </select>
        </Row>
      );
    }
    default:
      return (
        <Row label={f.label} htmlFor={id}>
          <input id={id} type="text" value={String(value ?? "")} placeholder={f.placeholder} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
        </Row>
      );
  }
}

function Items({ f, rows, onChange, readOnly, id, siteId }: {
  f: FieldDef; rows: any[]; onChange: (v: unknown) => void; readOnly?: boolean; id: string; siteId: string;
}) {
  const list = Array.isArray(rows) ? rows : [];
  const itemFields = f.itemFields ?? [];
  const set = (i: number, key: string, v: unknown) => onChange(list.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const move = (i: number, d: number) => {
    const next = [...list];
    const k = i + d;
    if (k < 0 || k >= next.length) return;
    [next[i], next[k]] = [next[k], next[i]];
    onChange(next);
  };
  const blank = () => Object.fromEntries(itemFields.map((x) => [x.key, x.kind === "number" ? 0 : x.kind === "toggle" ? false : ""]));
  return (
    <div className="m7-bf-items">
      <div className="m7-bf-items-h"><span>{f.label}</span><em>{list.length}</em></div>
      {list.map((r, i) => (
        <div key={i} className="m7-bf-item">
          <div className="m7-bf-item-bar">
            <b>{f.itemLabel ?? "Item"} {i + 1}</b>
            <button className="m7-icon-btn" aria-label={`Move ${f.itemLabel ?? "item"} ${i + 1} up`} disabled={readOnly || i === 0} onClick={() => move(i, -1)}><Icon name="chevDown" size={10} className="m7-up" /></button>
            <button className="m7-icon-btn" aria-label={`Move ${f.itemLabel ?? "item"} ${i + 1} down`} disabled={readOnly || i === list.length - 1} onClick={() => move(i, 1)}><Icon name="chevDown" size={10} /></button>
            <button className="m7-icon-btn" aria-label={`Remove ${f.itemLabel ?? "item"} ${i + 1}`} disabled={readOnly} onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="x" size={10} /></button>
          </div>
          {itemFields.map((sub) => (
            <Field key={sub.key} f={sub} value={r?.[sub.key]} readOnly={readOnly} siteId={siteId}
              id={`${id}-${i}-${sub.key}`} onChange={(v) => set(i, sub.key, v)} />
          ))}
        </div>
      ))}
      <button className="m7-bf-add" disabled={readOnly} onClick={() => onChange([...list, blank()])}>
        <Icon name="plus" size={10} /> Add {f.itemLabel?.toLowerCase() ?? "item"}
      </button>
    </div>
  );
}

export function BlockFields({ node, onChange, readOnly, siteId }: {
  node: BlockNode;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
  siteId: string;
}) {
  const def = REGISTRY[node.type];
  if (!def) return <p className="m7-muted">This block type is not in the registry.</p>;
  const patch: Patch = onChange;
  return (
    <div className="m7-bf">
      {def.content.length === 0 && <p className="m7-muted">This block has no content fields.</p>}
      {def.content.map((f) => {
        const id = `bf-${node.id}-${f.key}`;
        const value = (node.props as Record<string, any>)[f.key];
        if (f.kind === "items") {
          return <Items key={f.key} f={f} rows={value} readOnly={readOnly} siteId={siteId} id={id} onChange={(v) => patch(f.key, v)} />;
        }
        return <Field key={f.key} f={f} value={value} readOnly={readOnly} siteId={siteId} id={id} onChange={(v) => patch(f.key, v)} />;
      })}
    </div>
  );
}
