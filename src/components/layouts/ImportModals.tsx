/* ============================================================
   Module 7 · prebuilt library + import
   ------------------------------------------------------------
   Two doors, one destination: a template in this workspace.

   · Prebuilt — 14 open-source starters that ship inside the build,
     converted on demand by the HTML extractor.
   · Import — a file the user brings: HTML from anywhere, or a JSON
     bundle (ours, a bare block array, or a page-builder project).

   Both show exactly what will land (block by block) and what will
   not, before anything is written.
   ============================================================ */
import { Node as BlockView, type RenderCtx } from "@/components/builder/Blocks";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Field, Modal, Pill, Tip } from "@/components/ui";
import { useApp } from "@/lib/store";
import { REGISTRY, type BlockNode, type BlockType } from "@/lib/builder";
import { LayoutsAPI, type LayoutDraft, type PageTemplateDoc, type TemplateOrigin } from "@/lib/layout-db";
import {
  exportTemplatesJson, exportTemplatesXml, exportTemplatesCsv, downloadJson, downloadText, importHtml, importJson, IMPORT_LIMITS,
  type ImportReport, type JsonTemplate
} from "@/lib/html-import";
import { KIT_CATEGORIES, KIT_COUNT, PREBUILT_SOURCE, kitContent, listKits } from "@/lib/prebuilt-db";

/* ---------------- shared bits ---------------- */

const typeLabel = (t: string): string => (t in REGISTRY ? REGISTRY[t as BlockType].label : t);

/** Retype a block without losing what it already carries: props whose key exists
    on the target type are kept, everything else falls back to that type's defaults. */
export function remapBlock(node: BlockNode, type: BlockType): BlockNode {
  if (node.type === type) return node;
  const base = REGISTRY[type].defaults();
  const from = (node.props ?? {}) as Record<string, unknown>;
  const props: Record<string, unknown> = { ...(base.props as Record<string, unknown>) };
  for (const [k, v] of Object.entries(from)) {
    if (!(k in props)) continue;
    const a = props[k];
    if (typeof a === typeof v) props[k] = v;
    else if (typeof a === "string" && (typeof v === "number" || typeof v === "boolean")) props[k] = String(v);
  }
  return { ...base, id: node.id, style: node.style, variant: base.variant, props } as BlockNode;
}

function Mapped({ report }: { report: ImportReport }) {
  return (
    <div className="m7-imp-mapped">
      {report.mapped.map((m) => (
        <span key={m.type} className="m7-imp-chip"><b>{m.count}</b>{typeLabel(m.type)}</span>
      ))}
    </div>
  );
}

function Notes({ notes }: { notes: ImportReport["notes"] }) {
  return (
    <ul className="m7-imp-notes">
      {notes.map((n, i) => (
        <li key={i} className={`is-${n.kind}`}>
          <Icon name={n.kind === "drop" ? "alert" : n.kind === "warn" ? "alert" : "info"} size={11} />
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

const BLOCK_TYPES = Object.keys(REGISTRY) as BlockType[];

/* The kit is drawn at its 1440 px desktop design width and scaled to the pane, so the
   pane shows the page as a visitor would see it, not a clipped corner of it. */
function KitPreview({ blocks }: { blocks: BlockNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const k = Math.min(1, Math.max(0.1, (w - 2) / 1440));
  if (blocks.length === 0) {
    return <p className="m7-muted" style={{ padding: 12 }}>This kit produced no blocks, so there is nothing to render.</p>;
  }
  return (
    <div ref={ref} className="m7-pre-render" aria-label="Rendered preview of the kit">
      <div className="m7-pre-scale wb-doc wb-dev-desktop" style={{ width: 1440, zoom: String(k) } as CSSProperties}>
        {blocks.map((b) => <div key={b.id} className="m7-pre-shot"><BlockView node={b} ctx={READ_ONLY_RENDER} /></div>)}
      </div>
    </div>
  );
}

/* the rendered preview is read-only: retyping happens in the list below it */
const READ_ONLY_RENDER: RenderCtx = { selId: null, selEl: null, onSelect: () => {}, onSelectEl: () => {} };

function BlockList({ blocks, onChange, changed }: {
  blocks: BlockNode[];
  /** when given, every row gets a retype select (the mapping editor) */
  onChange?: (i: number, type: BlockType) => void;
  changed?: number[];
}) {
  return (
    <div className="m7-imp-blocks">
      {blocks.map((b, i) => {
        const p = b.props as Record<string, any>;
        const items = Array.isArray(p.items) ? p.items : null;
        const label = p.heading || p.title || p.text || p.body
          || (items ? `${items.length} ${b.type === "faq" ? "questions" : b.type === "pricing" ? "packages" : "items"}` : "");
        const edited = changed?.includes(i);
        return (
          <div key={b.id} className={`m7-imp-block ${edited ? "is-edited" : ""}`}>
            <span className="m7-imp-i">{i + 1}</span>
            {onChange ? (
              <label className="m7-imp-map">
                <span className="sr">{`Block ${i + 1} type`}</span>
                <select
                  value={b.type}
                  aria-label={`Block ${i + 1} type`}
                  onChange={(e) => onChange(i, e.target.value as BlockType)}
                >
                  {BLOCK_TYPES.map((t) => <option key={t} value={t}>{REGISTRY[t].label}</option>)}
                </select>
                <Icon name="chevDown" size={10} />
              </label>
            ) : (
              <span className="m7-imp-type">{typeLabel(b.type)}</span>
            )}
            <span className="m7-imp-copy">{String(label).slice(0, 90) || "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- prebuilt library ---------------- */

export function PrebuiltModal({ siteId, onClose, onDone }: {
  siteId: string;
  onClose: () => void;
  onDone: (made: PageTemplateDoc[]) => void;
}) {
  const app = useApp();
  const kits = useMemo(() => listKits(), []);
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>(kits[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  /* retyped blocks, per kit — the library is curated, but the mapping is the user's call */
  const [mapped, setMapped] = useState<Record<string, BlockNode[]>>({});
  const [edited, setEdited] = useState<Record<string, number[]>>({});

  const rows = kits.filter((k) => (cat === "All" || k.category === cat) && (!q || `${k.name} ${k.category}`.toLowerCase().includes(q.toLowerCase())));
  const kit = kits.find((k) => k.id === sel) ?? rows[0] ?? kits[0];
  const content = kit ? kitContent(kit.id) : null;
  const shown = kit ? mapped[kit.id] ?? content?.blocks ?? [] : [];
  const editedRows = kit ? edited[kit.id] ?? [] : [];
  const remap = (i: number, type: BlockType) => {
    if (!kit) return;
    const cur = mapped[kit.id] ?? content?.blocks ?? [];
    const next = cur.map((b, j) => (j === i ? remapBlock(b, type) : b));
    setMapped((m) => ({ ...m, [kit.id]: next }));
    setEdited((m) => ({ ...m, [kit.id]: Array.from(new Set([...(m[kit.id] ?? []), i])) }));
  };

  const add = async () => {
    if (!kit || !content) return;
    setBusy(true);
    const blocks = mapped[kit.id] ?? content.blocks;
    try {
      const origin: TemplateOrigin = {
        kind: "prebuilt",
        name: kit.name,
        source: kit.source,
        license: kit.license,
        commit: kit.commit
      };
      const made = await LayoutsAPI.importTemplates(siteId, [{ name: kit.name, blocks, intent: kit.category, origin }]);
      setAdded((cur) => [...cur, kit.id]);
      app.toast({
        type: "success",
        title: `${made[0].name} added to this workspace`,
        sub: `${blocks.length} blocks extracted from the ${kit.license} starter${editedRows.length ? ` · ${editedRows.length} retyped by you` : ""} · demo copy, not verified fact.`,
        action: { label: "Open the template", onClick: () => onDone(made) }
      });
      onDone(made);
    } catch (e) {
      app.toast({ type: "error", title: "Could not add that template", sub: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Prebuilt templates"
      sub={`${KIT_COUNT} open-source starters, converted to blocks when you add one. ${PREBUILT_SOURCE.license} · commit ${PREBUILT_SOURCE.commit}.`}
      icon="book" width="wide" onClose={onClose}
      footer={<>
        <span className="m7-imp-source">
          <Icon name="link" size={11} />
          <span>{PREBUILT_SOURCE.name} · {PREBUILT_SOURCE.license} · nothing is fetched at runtime</span>
        </span>
        <Btn onClick={onClose}>Close</Btn>
        <Btn variant="primary" icon="plus" loading={busy} onClick={() => void add()} disabled={!kit}>
          Add “{kit?.name ?? "—"}”
        </Btn>
      </>}
    >
      <div className="m7-pre-bar">
        <div className="m7-pre-search">
          <Icon name="search" size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 14 prebuilt templates…" aria-label="Search prebuilt templates" />
          {q && <button onClick={() => setQ("")} aria-label="Clear"><Icon name="x" size={11} /></button>}
        </div>
        <div className="m7-pre-cats">
          {["All", ...KIT_CATEGORIES].map((c) => (
            <button key={c} className={cat === c ? "is-on" : ""} onClick={() => setCat(c)} aria-pressed={cat === c}>{c}</button>
          ))}
        </div>
      </div>

      <div className="m7-pre-body">
        <div className="m7-pre-list" role="listbox" aria-label="Prebuilt templates">
          {rows.map((k) => (
            <button key={k.id} role="option" aria-selected={sel === k.id} className={`m7-pre-row ${sel === k.id ? "is-on" : ""}`} onClick={() => setSel(k.id)}>
              <span className="m7-pre-thumb" aria-hidden>
                {Array.from({ length: Math.min(5, Math.max(2, k.blocks)) }).map((_, i) => <i key={i} />)}
              </span>
              <span className="m7-pre-meta">
                <span className="m7-pre-name">{k.name}{added.includes(k.id) && <Pill tone="green">added</Pill>}</span>
                <span className="m7-pre-sub">{k.category} · {k.blocks} blocks · {k.license}</span>
              </span>
              <Icon name="chevRight" size={12} />
            </button>
          ))}
          {rows.length === 0 && <p className="m7-muted" style={{ padding: 12 }}>No prebuilt template matches that search.</p>}
        </div>

        <div className="m7-pre-view">
          {kit && content ? (
            <>
              <div className="m7-pre-head">
                <div>
                  <b>{kit.name}</b>
                  <span>{kit.sections} sections read → {content.blocks.length} blocks · {kit.category}</span>
                </div>
                <Pill tone="grey">{kit.license}</Pill>
              </div>
              <div className="m7-imp-mapbar">
                <span><Icon name="columns" size={11} />{kit.sections} sections → {shown.length} blocks · retype any block before adding</span>
                {editedRows.length > 0 && (
                  <button onClick={() => { setMapped((m) => { const c = { ...m }; delete c[kit.id]; return c; }); setEdited((m) => ({ ...m, [kit.id]: [] })); }}>
                    <Icon name="refresh" size={10} />Undo {editedRows.length} retype{editedRows.length === 1 ? "" : "s"}
                  </button>
                )}
              </div>
              <KitPreview blocks={shown} />
              <BlockList blocks={shown} onChange={remap} changed={editedRows} />
              <div className="m7-pre-report">
                <Mapped report={content.report} />
                <Notes notes={content.report.notes.slice(0, 3)} />
                <p className="m7-muted">
                  Source: <code>{kit.source.replace("https://github.com/", "")}</code> at <code>{kit.commit}</code>.
                  Structure and copy only — no CSS, images or scripts are copied, and the demo copy is sample content, not verified fact.
                </p>
              </div>
            </>
          ) : (
            <p className="m7-muted">Select a template to see what would be imported.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- import ---------------- */

type Mode = "html" | "json";

export function ImportModal({ siteId, layouts, onClose, onDone }: {
  siteId: string;
  layouts: LayoutDraft[];
  onClose: () => void;
  onDone: (made: PageTemplateDoc[]) => void;
}) {
  const app = useApp();
  const [mode, setMode] = useState<Mode>("html");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [name, setName] = useState("");
  const [layoutId, setLayoutId] = useState(layouts.find((l) => l.isDefault)?.id ?? layouts[0]?.id ?? "");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [parsed, setParsed] = useState<{ name: string; blocks: BlockNode[] }[]>([]);
  const [edited, setEdited] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (source: string, kind: Mode, sourceName = "") => {
    setError(""); setReport(null); setParsed([]); setEdited([]);
    try {
      if (kind === "html") {
        const res = importHtml(source, { name: sourceName.replace(/\.html?$/i, "") });
        setReport(res.report);
        setParsed([{ name: res.report.templateName || sourceName || "Imported page", blocks: res.blocks }]);
        setName((n) => n || res.report.templateName || "Imported page");
      } else {
        const res = importJson(source);
        setReport(res.report);
        setParsed(res.templates.map((t: JsonTemplate) => ({ name: t.name, blocks: t.blocks })));
        setName((n) => n || res.templates[0]?.name || "Imported template");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const readFile = async (file: File) => {
    if (file.size > IMPORT_LIMITS.maxBytes) {
      setError(`${file.name} is ${Math.round(file.size / 1024)} KB. The limit is ${Math.round(IMPORT_LIMITS.maxBytes / 1024)} KB.`);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!/\.(html?|json)$/.test(lower)) {
      setError(`${file.name} is not an HTML or JSON file. Upload .html, .htm or .json.`);
      return;
    }
    const kind: Mode = lower.endsWith(".json") ? "json" : "html";
    setMode(kind);
    setFileName(file.name);
    const body = await file.text();
    setText(body);
    parse(body, kind, file.name);
  };

  const remap = (i: number, type: BlockType) => {
    setParsed((p) => p.map((doc, di) => di !== 0 ? doc : { ...doc, blocks: doc.blocks.map((b, j) => (j === i ? remapBlock(b, type) : b)) }));
    setEdited((e) => Array.from(new Set([...e, i])));
  };

  const save = async () => {
    if (!parsed.length) return;
    setBusy(true);
    try {
      const origin: TemplateOrigin = mode === "html"
        ? { kind: "html", name: fileName || "pasted HTML" }
        : { kind: "json", name: fileName || "pasted JSON", source: "upload" };
      const made = await LayoutsAPI.importTemplates(
        siteId,
        parsed.map((p, i) => ({ name: i === 0 ? name || p.name : p.name, blocks: p.blocks, intent: "Imported", layoutId, origin }))
      );
      app.toast({
        type: "success",
        title: made.length === 1 ? `${made[0].name} imported` : `${made.length} templates imported`,
        sub: `${made.reduce((s, m) => s + m.blocks.length, 0)} blocks from ${mode.toUpperCase()}. Review the copy before publishing.`
      });
      onDone(made);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Import a template"
      sub="HTML from anywhere, or a JSON bundle. Both are reduced to blocks — nothing in the file is executed."
      icon="upload" width="wide" onClose={onClose}
      footer={<>
        <span className="m7-imp-limits">{Math.round(IMPORT_LIMITS.maxBytes / 1024)} KB · {IMPORT_LIMITS.maxBlocks} blocks max · scripts and styles are always dropped</span>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="plus" loading={busy} disabled={!parsed.length} onClick={() => void save()}>
          {parsed.length > 1 ? `Import ${parsed.length} templates` : "Save as template"}
        </Btn>
      </>}
    >
      <div className="m7-imp-tabs" role="tablist">
        {(["html", "json"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "is-on" : ""}
            onClick={() => { setMode(m); setText(""); setReport(null); setParsed([]); setError(""); setFileName(""); }}>
            <Icon name={m === "html" ? "code" : "file"} size={12} />
            {m === "html" ? "HTML file" : "JSON bundle"}
          </button>
        ))}
      </div>

      <div
        className={`m7-drop ${drag ? "is-drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void readFile(f); }}
      >
        <Icon name="upload" size={18} />
        <b>Drop an {mode === "html" ? ".html" : ".json"} file here</b>
        <span>or</span>
        <Btn icon="file" onClick={() => fileRef.current?.click()}>Choose a file</Btn>
        <input
          ref={fileRef} type="file" accept=".html,.htm,.json,text/html,application/json" className="m7-file"
          aria-label="Choose an HTML or JSON file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }}
        />
        {fileName && <em>{fileName}</em>}
      </div>

      <details className="m7-imp-paste">
        <summary>Or paste the markup</summary>
        <textarea
          value={text} rows={6} spellCheck={false}
          placeholder={mode === "html" ? "<section><h1>…</h1><p>…</p></section>" : '{ "kind": "wacrm.templates", "templates": [ … ] }'}
          onChange={(e) => setText(e.target.value)}
          aria-label="Paste HTML or JSON"
        />
        <Btn icon="check" onClick={() => parse(text, mode)} disabled={!text.trim()}>Parse</Btn>
      </details>

      {error && <div className="m7-imp-error"><Icon name="alert" size={13} /><span>{error}</span></div>}

      {report && (
        <div className="m7-imp-report">
          <div className="m7-imp-stats">
            <div><b>{report.blocks}</b><span>blocks</span></div>
            <div><b>{report.sections}</b><span>{mode === "html" ? "sections read" : "templates"}</span></div>
            <div><b>{report.dropped}</b><span>dropped</span></div>
            <div><b>{Math.round(report.bytes / 1024)}</b><span>KB</span></div>
          </div>
          <Mapped report={report} />
          <div className="m7-imp-grid">
            <div>
              <div className="m7-sec-h">
                <h4>What will land</h4>
                <span>{parsed.reduce((s, p) => s + p.blocks.length, 0)} blocks{edited.length ? ` · ${edited.length} retyped` : ""}</span>
              </div>
              {parsed.slice(0, 2).map((p, di) => (
                <BlockList key={p.name} blocks={p.blocks} onChange={di === 0 ? remap : undefined} changed={di === 0 ? edited : []} />
              ))}
              <p className="m7-imp-hint">
                <Icon name="info" size={10} />Retype any block: fields both types share are kept, the rest fall back to that block's own defaults.
              </p>
            </div>
            <div>
              <div className="m7-sec-h"><h4>What is dropped, and why</h4></div>
              <Notes notes={report.notes} />
              {report.brand.colors.length > 0 && (
                <div className="m7-imp-brand">
                  <span>Brand hints</span>
                  <div>{report.brand.colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}{report.brand.fonts.map((f) => <em key={f}>{f}</em>)}</div>
                  <small>Detected from the file's CSS. Not applied — the Theme Studio owns tokens.</small>
                </div>
              )}
            </div>
          </div>
          <div className="m7-imp-fields">
            <Field label="Template name" hint="Imported templates start in this workspace and can be renamed later.">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Default layout">
              <select value={layoutId} onChange={(e) => setLayoutId(e.target.value)}>
                {layouts.filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- export ---------------- */

export type ExportFormat = "json" | "xml" | "csv";

/** One template, one format. JSON round-trips through Import; XML and CSV are for reading and tooling. */
export function exportTemplate(doc: PageTemplateDoc, layoutName: string, format: ExportFormat = "json") {
  const docs = [{ name: doc.name, intent: doc.intent, layoutName, blocks: doc.blocks }];
  const meta = { site: doc.siteId, template: doc.id, revision: doc.rev };
  const base = doc.name;
  if (format === "xml") return downloadText(`${base}.xml`, exportTemplatesXml(docs, meta), "application/xml");
  if (format === "csv") return downloadText(`${base}.csv`, exportTemplatesCsv(docs), "text/csv");
  downloadJson(`${base}.json`, exportTemplatesJson(docs, meta));
}

export function ExportHint() {
  return <Tip text="JSON round-trips: export a template here, import it anywhere."><span className="m7-muted">.</span></Tip>;
}
