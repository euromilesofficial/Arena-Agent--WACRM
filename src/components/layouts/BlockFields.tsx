/* ============================================================
   Module 7 · Block fields for a template's starter block
   ------------------------------------------------------------
   The editing model follows the established CMS pattern: select a
   block on the canvas, edit its content in a side inspector, and
   keep structure (order, removal) in a separate list. Fields come
   from the block registry, so the inspector and the renderer can
   never disagree about what a block has.

   Simple content fields are edited here. Repeating items, links,
   media and style tokens stay in the builder, where their full
   editors live, and the inspector says so instead of hiding them.
   ============================================================ */
import { REGISTRY, type BlockNode, type FieldDef } from "@/lib/builder";

const EDITABLE: FieldDef["kind"][] = ["text", "textarea", "select", "toggle", "number", "segmented"];

export function BlockFields({ node, onChange, readOnly }: {
  node: BlockNode;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
}) {
  const def = REGISTRY[node.type];
  if (!def) return <p className="m7-muted">This block type is not in the registry.</p>;
  const fields = def.content;
  const editable = fields.filter((f) => EDITABLE.includes(f.kind));
  const deferred = fields.filter((f) => !EDITABLE.includes(f.kind));

  return (
    <div className="m7-bf">
      {editable.length === 0 && deferred.length === 0 && (
        <p className="m7-muted">This block has no content fields.</p>
      )}
      {editable.map((f) => {
        const v = (node.props as Record<string, any>)[f.key];
        const id = `bf-${node.id}-${f.key}`;
        if (f.kind === "toggle") {
          return (
            <label key={f.key} className="m7-bf-row m7-bf-toggle" htmlFor={id}>
              <span>{f.label}</span>
              <input id={id} type="checkbox" checked={!!v} disabled={readOnly} onChange={(e) => onChange(f.key, e.target.checked)} />
            </label>
          );
        }
        if (f.kind === "select" || f.kind === "segmented") {
          return (
            <label key={f.key} className="m7-bf-row" htmlFor={id}>
              <span>{f.label}</span>
              <select id={id} value={String(v ?? f.options?.[0]?.value ?? "")} disabled={readOnly} onChange={(e) => onChange(f.key, e.target.value)}>
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        }
        if (f.kind === "number") {
          return (
            <label key={f.key} className="m7-bf-row" htmlFor={id}>
              <span>{f.label}</span>
              <input id={id} type="number" value={v ?? ""} disabled={readOnly} onChange={(e) => onChange(f.key, e.target.value === "" ? "" : Number(e.target.value))} />
            </label>
          );
        }
        if (f.kind === "textarea") {
          return (
            <label key={f.key} className="m7-bf-row m7-bf-area" htmlFor={id}>
              <span>{f.label}</span>
              <textarea id={id} rows={f.rows ?? 3} value={String(v ?? "")} placeholder={f.placeholder} disabled={readOnly} onChange={(e) => onChange(f.key, e.target.value)} />
            </label>
          );
        }
        return (
          <label key={f.key} className="m7-bf-row" htmlFor={id}>
            <span>{f.label}</span>
            <input id={id} type="text" value={String(v ?? "")} placeholder={f.placeholder} disabled={readOnly} onChange={(e) => onChange(f.key, e.target.value)} />
          </label>
        );
      })}
      {deferred.length > 0 && (
        <p className="m7-bf-deferred">
          {deferred.map((f) => f.label).join(", ")} {deferred.length === 1 ? "is" : "are"} edited in the Visual Builder, where the full item and media editors live.
        </p>
      )}
    </div>
  );
}
