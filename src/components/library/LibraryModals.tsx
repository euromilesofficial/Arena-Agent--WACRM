/* ============================================================
   Module 5 · Library modals
   ------------------------------------------------------------
   Insert into Page is the ONLY way this module mutates a page.
   Everything else (create, duplicate, delete, preview) is local
   to the library store.

   Six insert outcomes are reachable from the UI:
     200 → draft revision +1 · 403 denied · 409 conflict
     413 page limit · 422 dependency · 503 service down
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../Icon";
import { Btn, Field, Modal, Pill, Skel } from "../ui";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { LibraryAPI, countOf, dateLong, requirementsFor, structureOf, type LibEntry } from "@/lib/library-db";
import type { BlockType } from "@/lib/builder";

/* ---------------- insert ---------------- */

type Position = { mode: "top" | "end" } | { mode: "after"; afterId: string };

export function InsertModal({
  entry, siteId, onClose, onDone
}: {
  entry: LibEntry; siteId: string; onClose: () => void; onDone: (pageTitle: string) => void;
}) {
  const app = useApp();
  const [site, setSite] = useState(siteId);
  const [pageId, setPageId] = useState<string>("");
  const [q, setQ] = useState("");
  const [position, setPosition] = useState<Position>({ mode: "end" });
  const [sections, setSections] = useState<{ id: string; index: number; label: string; type: BlockType }[] | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);

  const pages = useMemo(() => LibraryAPI.pagesFor(site), [site]);
  const page = pages.find((p) => p.id === pageId) ?? null;

  // page list default: the page most recently touched
  useEffect(() => {
    if (!pages.length) return;
    if (!pages.some((p) => p.id === pageId)) {
      const first = pages.find((p) => p.status === "draft") ?? pages[0];
      setPageId(first.id);
    }
  }, [pages, pageId]);

  // sections + revision for the chosen page
  useEffect(() => {
    let dead = false;
    setSections(null); setRevision(null);
    if (!pageId) return;
    LibraryAPI.sectionsOf(pageId).then((rows) => { if (!dead) setSections(rows); }).catch(() => { if (!dead) setSections([]); });
    import("@/lib/builder-db").then((m) => m.BuilderAPI.getDraft(pageId)).then((d) => { if (!dead) setRevision(d.revision); }).catch(() => {});
    return () => { dead = true; };
  }, [pageId]);

  const reqs = requirementsFor(entry, site, page?.blocks ?? 0);
  const blocked = reqs.filter((r) => !r.ok);

  const visible = pages.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));

  const submit = async () => {
    if (!page || revision === null) return;
    setBusy(true); setProblem(null);
    try {
      const res = await LibraryAPI.insertIntoPage({
        entry, siteId: site, pageId, position, variant: entry.variant, expectRevision: revision
      });
      onDone(res.pageTitle);
    } catch (e) {
      const err = e as Error & { code?: string };
      setProblem({ code: err.code ?? "ERROR", message: err.message });
      if (err.code === "CONFLICT") setRevision(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Insert into Page"
      sub={`${entry.name} · ${countOf(entry)} block${countOf(entry) === 1 ? "" : "s"}`}
      icon="plus"
      width="wide"
      onClose={onClose}
      footer={
        <>
          <div className="m5-modal-note">
            {blocked.length
              ? <span className="m5-bad"><Icon name="alert" size={12} /> {blocked[0].label}</span>
              : <span className="m5-ok"><Icon name="check" size={12} /> Ready — creates one draft revision</span>}
          </div>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="plus" loading={busy} disabled={!page || revision === null || blocked.length > 0} onClick={submit}>
            Insert into {page ? page.title : "page"}
          </Btn>
        </>
      }
    >
      {problem && (
        <div className={`m5-problem ${problem.code === "CONFLICT" ? "is-warn" : ""}`} role="alert">
          <Icon name={problem.code === "CONFLICT" ? "refresh" : "alert"} size={14} />
          <div>
            <b>
              {problem.code === "CONFLICT" ? "This page moved under you"
                : problem.code === "LIMIT" ? "Page is full"
                : problem.code === "SERVICE_DOWN" ? "Service unavailable"
                : problem.code === "DEPENDENCY" ? "A dependency is missing"
                : "Insert failed"}
            </b>
            <span>{problem.message}</span>
          </div>
          {problem.code === "CONFLICT" && (
            <Btn variant="sm" onClick={() => { setProblem(null); if (pageId) { LibraryAPI.sectionsOf(pageId).then(setSections); import("@/lib/builder-db").then((m) => m.BuilderAPI.getDraft(pageId)).then((d) => setRevision(d.revision)); } }}>
              Reload page
            </Btn>
          )}
        </div>
      )}

      <div className="m5-insert-grid">
        <div className="m5-insert-col">
          <Field label="1 · Website">
            <select className="input" value={site} onChange={(e) => { setSite(e.target.value); setPageId(""); }}>
              {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="2 · Page" hint={`${pages.length} page${pages.length === 1 ? "" : "s"} on this website`}>
            <div className="m5-page-search">
              <Icon name="search" size={12} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages…" />
            </div>
          </Field>
          <div className="m5-page-list" role="listbox" aria-label="Pages">
            {visible.length === 0 && <div className="m5-page-none">No pages match.</div>}
            {visible.map((p) => (
              <button
                key={p.id} role="option" aria-selected={p.id === pageId}
                className={`m5-page ${p.id === pageId ? "is-on" : ""}`}
                onClick={() => { setPageId(p.id); setPosition({ mode: "end" }); }}
              >
                <Icon name="file" size={13} />
                <span className="m5-page-t">{p.title}</span>
                <Pill tone={p.status === "published" ? "green" : "amber"}>{p.status}</Pill>
                <em>{p.blocks} blocks</em>
              </button>
            ))}
          </div>
        </div>

        <div className="m5-insert-col">
          <Field label="3 · Position">
            <div className="m5-positions">
              <button className={`m5-pos ${position.mode === "top" ? "is-on" : ""}`} onClick={() => setPosition({ mode: "top" })}>
                <Icon name="arrowUpRight" size={12} />Top of page
              </button>
              <button className={`m5-pos ${position.mode === "end" ? "is-on" : ""}`} onClick={() => setPosition({ mode: "end" })}>
                <Icon name="arrowRight" size={12} />End of page
              </button>
            </div>
          </Field>

          <Field label="After an existing section">
            {sections === null ? (
              <div className="m5-sec-list"><Skel style={{ height: 30 }} /><Skel style={{ height: 30 }} /><Skel style={{ height: 30 }} /></div>
            ) : sections.length === 0 ? (
              <div className="m5-page-none">This page has no sections yet — insert at the top.</div>
            ) : (
              <div className="m5-sec-list" role="listbox" aria-label="Insert after">
                {sections.map((s) => (
                  <button
                    key={s.id} role="option" aria-selected={position.mode === "after" && position.afterId === s.id}
                    className={`m5-sec-row ${position.mode === "after" && position.afterId === s.id ? "is-on" : ""}`}
                    onClick={() => setPosition({ mode: "after", afterId: s.id })}
                  >
                    <em>{s.index + 1}</em>
                    <span>{s.label}</span>
                    <Icon name="check" size={11} />
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="4 · Dependencies">
            <ul className="m5-reqs">
              {reqs.map((r) => (
                <li key={r.kind} className={r.ok ? "ok" : "bad"}>
                  <Icon name={r.ok ? "check" : "alert"} size={12} />
                  <span>{r.label}</span>
                  {!r.ok && r.fix && (
                    <button className="m5-link" onClick={() => { onClose(); app.go(r.fix!.screen ?? "overview"); }}>{r.fix.label}</button>
                  )}
                </li>
              ))}
            </ul>
          </Field>

          <div className="m5-insert-summary">
            <Icon name="info" size={12} />
            <span>
              Inserting creates <b>one</b> draft revision on <b>{page?.title ?? "—"}</b>
              {revision !== null && <> at revision <code>{revision}</code></>}. Nothing publishes.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- create from a page section ---------------- */

export function CreateTemplateModal({
  siteId, onClose, onDone
}: { siteId: string; onClose: () => void; onDone: (entry: LibEntry) => void }) {
  const [step, setStep] = useState(1);
  const [site, setSite] = useState(siteId);
  const [pageId, setPageId] = useState("");
  const [index, setIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Content");
  const [scope, setScope] = useState<"Workspace" | "This Site">("Workspace");
  const [sections, setSections] = useState<{ id: string; index: number; label: string; type: BlockType }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pages = useMemo(() => LibraryAPI.pagesFor(site), [site]);

  useEffect(() => {
    if (!pages.length) return;
    if (!pages.some((p) => p.id === pageId)) setPageId(pages[0].id);
  }, [pages, pageId]);

  useEffect(() => {
    let dead = false;
    setSections(null); setIndex(null);
    if (!pageId) return;
    LibraryAPI.sectionsOf(pageId).then((rows) => { if (!dead) setSections(rows); });
    return () => { dead = true; };
  }, [pageId]);

  const pick = sections?.find((s) => s.index === index) ?? null;
  const canSave = !!pageId && index !== null && name.trim().length > 0 && !busy;

  const save = async () => {
    if (index === null) return;
    setBusy(true); setErr("");
    try {
      const entry = await LibraryAPI.createFromSection({
        pageId, index, name, desc, category, scope, siteId: site, creator: "You"
      });
      onDone(entry);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title="Create Template"
      sub="Save a section from an existing page — never raw markup"
      icon="plus"
      width="wide"
      onClose={onClose}
      footer={
        <>
          <div className="m5-modal-note">{err ? <span className="m5-bad"><Icon name="alert" size={12} />{err}</span> : <span className="m5-muted">Step {step} of 2</span>}</div>
          <Btn onClick={() => (step === 1 ? onClose() : setStep(1))}>{step === 1 ? "Cancel" : "Back"}</Btn>
          {step === 1
            ? <Btn variant="primary" disabled={index === null} onClick={() => setStep(2)}>Continue</Btn>
            : <Btn variant="primary" icon="check" loading={busy} disabled={!canSave} onClick={save}>Save template</Btn>}
        </>
      }
    >
      {step === 1 ? (
        <div className="m5-insert-grid">
          <div className="m5-insert-col">
            <Field label="Website">
              <select className="input" value={site} onChange={(e) => { setSite(e.target.value); setPageId(""); }}>
                {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Page">
              <select className="input" value={pageId} onChange={(e) => setPageId(e.target.value)}>
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </div>
          <div className="m5-insert-col">
            <Field label="Section" hint="Pick the section you want to reuse">
              {sections === null ? <div className="m5-sec-list">{[0, 1, 2].map((i) => <Skel key={i} style={{ height: 30 }} />)}</div>
                : sections.length === 0 ? <div className="m5-page-none">This page has no sections.</div>
                  : (
                    <div className="m5-sec-list" role="listbox" aria-label="Sections">
                      {sections.map((s) => (
                        <button key={s.id} role="option" aria-selected={index === s.index}
                          className={`m5-sec-row ${index === s.index ? "is-on" : ""}`} onClick={() => setIndex(s.index)}>
                          <em>{s.index + 1}</em><span>{s.label}</span><Icon name="check" size={11} />
                        </button>
                      ))}
                    </div>
                  )}
            </Field>
          </div>
        </div>
      ) : (
        <div className="m5-insert-grid">
          <div className="m5-insert-col">
            <Field label="Name" hint="Unique per scope">
              <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Study Abroad Hero — Custom" />
            </Field>
            <Field label="Description">
              <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What makes this section reusable" />
            </Field>
          </div>
          <div className="m5-insert-col">
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {["Hero", "Content", "Features", "CTA", "Forms"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Scope">
              <div className="m5-positions">
                <button className={`m5-pos ${scope === "Workspace" ? "is-on" : ""}`} onClick={() => setScope("Workspace")}>Workspace</button>
                <button className={`m5-pos ${scope === "This Site" ? "is-on" : ""}`} onClick={() => setScope("This Site")}>
                  This Site · {DBX().sites.find((s) => s.id === site)?.name}
                </button>
              </div>
            </Field>
            <div className="m5-insert-summary">
              <Icon name="info" size={12} />
              <span>From <b>{pick?.label ?? "the section"}</b> on <b>{pages.find((p) => p.id === pageId)?.title}</b>. The copy starts with no placements.</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- delete ---------------- */

export function DeleteModal({
  entry, onClose, onDone
}: { entry: LibEntry; onClose: () => void; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const usage = LibraryAPI.usageOf(entry.id);
  const blocked = usage.totalPlacements > 0;

  const run = async () => {
    setBusy(true); setErr("");
    try { await LibraryAPI.remove(entry.id); onDone(entry.id); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title="Delete template"
      sub={entry.name}
      icon="trash"
      onClose={onClose}
      footer={
        <>
          <div className="m5-modal-note">{err ? <span className="m5-bad"><Icon name="alert" size={12} />{err}</span> : null}</div>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" icon="trash" loading={busy} disabled={blocked} onClick={run}>Delete</Btn>
        </>
      }
    >
      <p className="m5-modal-p">
        Deleting removes the library entry. <b>Copies already placed on pages stay exactly where they are.</b>
      </p>
      {blocked && (
        <div className="m5-problem is-warn">
          <Icon name="alert" size={14} />
          <div>
            <b>Used on {usage.totalPages} page{usage.totalPages === 1 ? "" : "s"}</b>
            <span>Remove it from those pages first, or keep it in the library.</span>
          </div>
        </div>
      )}
      {blocked && (
        <ul className="m5-usedlist">
          {usage.pages.map((p) => (
            <li key={`${p.pageId}-${p.index}`}><Icon name="file" size={12} />{p.pageTitle}<Pill tone={p.status === "published" ? "green" : "amber"}>{p.status}</Pill></li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------------- preview ---------------- */

export function PreviewModal({
  entry, onClose, onInsert
}: { entry: LibEntry; onClose: () => void; onInsert: () => void }) {
  const tree = structureOf(entry);
  return (
    <Modal
      title={entry.name}
      sub={`${entry.scope} · ${countOf(entry)} block${countOf(entry) === 1 ? "" : "s"} · updated ${dateLong(entry.updatedAt)}`}
      icon="eye"
      width="wide"
      onClose={onClose}
      footer={<><div className="m5-modal-note"><span className="m5-muted">Preview only — nothing is editable here</span></div><Btn onClick={onClose}>Close</Btn><Btn variant="primary" icon="plus" onClick={onInsert}>Insert into Page</Btn></>}
    >
      <div className="m5-preview-wrap">
        <div className="m5-preview-frame">
          <div className="m5-preview-bar"><i /><i /><i /><span>euromiles.in/preview</span></div>
          <div className="m5-preview-body">
            <div className="m5-preview-canvas">
              {entry.blocks.map((b) => (
                <div key={b.id} className="m5-preview-block">
                  <span className="m5-preview-tag">{b.type}</span>
                  <div className={`m5-preview-inner t-${b.type}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="m5-preview-side">
          <h4 className="m5-h4">Composition</h4>
          <ul className="m5-tree">
            {tree.map((row, i) => (
              <li key={`${row.node.id}-${i}`} style={{ paddingLeft: 8 + row.depth * 14 }}>
                <span className={`m5-tree-dot d${row.depth}`} />
                <span className="m5-tree-label">{row.label}</span>
                <span className="m5-tree-type">{row.type}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
