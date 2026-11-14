/* ============================================================
   Module 3 · Page modals
   Create (4 steps) · Edit details · Duplicate · Move · Set homepage ·
   Trash · Restore · Bulk trash · Preview
   Each one talks to the API, surfaces 409/422 in place and never
   reports success before the promise resolves.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Btn, Field, Modal, Pill } from "../ui";
import { useApp } from "@/lib/store";
import { API } from "@/lib/data";
import { slugify, validateSlug, type CmsPage, type PageType, type TreeNode } from "@/lib/cms-pages";

const TYPE_LABEL: Record<PageType, string> = { standard: "Standard page", landing: "Landing page" };

function parentOptions(pages: CmsPage[], exclude?: string) {
  return [{ id: "", title: "None (top level)", path: "/" }].concat(
    pages.filter((p) => !p.trash && !p.isHome && p.id !== exclude).map((p) => ({ id: p.id, title: p.title, path: p.path }))
  );
}

/* ---------- 1 · Create ---------- */
export function CreatePageModal({ siteId, siteName, pages, defaultParent, onClose, onCreated }: {
  siteId: string; siteName: string; pages: CmsPage[]; defaultParent: string | null;
  onClose: () => void; onCreated: (p: CmsPage) => void;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState<string | null>(defaultParent);
  const [type, setType] = useState<PageType>("standard");
  const [template, setTemplate] = useState("Page – Standard");
  const [layout, setLayout] = useState("Site default");
  const [checking, setChecking] = useState(false);
  const [slugMsg, setSlugMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => { if (!slugTouched) setSlug(slugify(title)); }, [title, slugTouched]);

  const parent = pages.find((p) => p.id === parentId) ?? null;
  const fullPath = parentId ? `${parent?.path === "/" ? "" : parent?.path ?? ""}/${slug || "…"}` : `/${slug || "…"}`;

  useEffect(() => {
    if (!slug) { setSlugMsg(null); return; }
    const invalid = validateSlug(slug, false);
    if (invalid) { setSlugMsg(invalid); return; }
    setChecking(true);
    const t = setTimeout(() => {
      let cancelled = false;
      void API.checkPageSlug(siteId, slug, parentId, false).then((r) => {
        if (!cancelled) { setSlugMsg(r.ok ? null : r.error ?? null); setChecking(false); }
      });
      return () => { cancelled = true; };
    }, 260);
    return () => { clearTimeout(t); setChecking(false); };
  }, [slug, parentId, siteId]);

  const titleError = touched && !title.trim() ? "Page title is required." : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!title.trim() || slugMsg || validateSlug(slug, false)) { setStep(0); return; }
    setBusy(true);
    const res = await API.createPage({ siteId, title, slug, parentId, type, template, layout });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onCreated(res.page);
  };

  const steps = ["Details", "Start from", "Layout", "Review"];
  const foot = (
    <>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <span className="grow" />
      {step > 0 && <Btn icon="chevLeft" onClick={() => setStep((s) => s - 1)}>Back</Btn>}
      {step < 3
        ? <Btn variant="primary" disabled={step === 0 && (!title.trim() || !!slugMsg || checking)} onClick={() => { setTouched(true); if (!title.trim() || slugMsg) return; setStep((s) => s + 1); }}>
          Continue <Icon name="arrowRight" size={12} />
        </Btn>
        : <Btn variant="primary" loading={busy} onClick={submit}>Create Page</Btn>}
    </>
  );

  return (
    <Modal title="Create New Page" sub={`Step ${step + 1} of 4 · add a page to ${siteName}`} icon="plus" width="narrow" onClose={onClose} footer={foot}>
      <div className="d3-steps" role="tablist" aria-label="Create page steps">
        {steps.map((s, i) => (
          <div key={s} className={`d3-step ${i === step ? "is-on" : ""} ${i < step ? "is-done" : ""}`} role="tab" aria-selected={i === step}>
            <span className="d3-step-n">{i < step ? <Icon name="check" size={9} /> : i + 1}</span> {s}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="d3-form">
          <Field label="Page title" error={titleError ?? undefined}>
            <input className="input" autoFocus value={title} placeholder="e.g. Study in Italy"
              onChange={(e) => setTitle(e.target.value)} aria-invalid={!!titleError} />
          </Field>
          <Field label="URL slug" hint={checking ? "Checking availability…" : "Lowercase letters, numbers and hyphens."}
            error={slugMsg ?? undefined}>
            <input className={`input mono ${slugMsg ? "is-bad" : ""}`} value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} placeholder="study-in-italy" />
          </Field>
          <Field label="Parent page" hint="Nested routes follow the parent path.">
            <select className="input" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
              {parentOptions(pages).map((o) => <option key={o.id} value={o.id}>{o.title}{o.id ? ` — ${o.path}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Page type">
            <div className="d3-seg">
              {(["standard", "landing"] as PageType[]).map((t) => (
                <button key={t} className={`d3-seg-btn ${type === t ? "is-on" : ""}`} onClick={() => {
                  setType(t); setTemplate(t === "landing" ? "Landing – Full bleed" : "Page – Standard");
                  setLayout(t === "landing" ? "Blank landing" : "Site default");
                }}>{TYPE_LABEL[t]}</button>
              ))}
            </div>
          </Field>
          <div className="d3-pathpreview"><Icon name="link" size={11} /> Resulting URL <span className="mono">{fullPath}</span></div>
        </div>
      )}

      {step === 1 && (
        <div className="d3-choice">
          {[
            ["Blank Page", "Start with an empty block canvas.", "file"],
            ["Approved Page Template", "Use a template your team already approved.", "layers"],
            ["Duplicate Existing Page", "Copy structure from a page in this website.", "copy"]
          ].map(([t, d, ic], i) => (
            <button key={t} className={`d3-choice-row ${i === 0 ? "is-on" : ""}`} onClick={() => setTemplate(i === 1 ? "Template – Standard" : "Page – Standard")}>
              <span className="d3-choice-ico"><Icon name={ic} size={13} /></span>
              <span><span className="f12 w600">{t}</span><span className="f11 muted">{d}</span></span>
              {i === 0 && <Icon name="check" size={12} className="d3-choice-check" />}
            </button>
          ))}
          <div className="d3-note"><Icon name="info" size={11} /> Creating a page never publishes it. Drafts become public only through a release.</div>
        </div>
      )}

      {step === 2 && (
        <div className="d3-choice">
          {[
            ["Use Default Site Layout", "Global header and footer apply automatically.", "Default"],
            ["Choose Existing Master Layout", "Pick a layout from Layouts & Templates.", "Wide"],
            ["Blank Landing Layout", "No global chrome — full-bleed sections.", "Blank landing"]
          ].map(([t, d, v]) => (
            <button key={t} className={`d3-choice-row ${layout === v ? "is-on" : ""}`} onClick={() => setLayout(v)}>
              <span className="d3-choice-ico"><Icon name="layers" size={13} /></span>
              <span><span className="f12 w600">{t}</span><span className="f11 muted">{d}</span></span>
              {layout === v && <Icon name="check" size={12} className="d3-choice-check" />}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="d3-review">
          {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
          <div className="d3-meta">
            <Row k="Title" v={title || "—"} />
            <Row k="URL path" v={<span className="mono">{fullPath}</span>} />
            <Row k="Parent" v={parent?.title ?? "None (top level)"} />
            <Row k="Type" v={TYPE_LABEL[type]} />
            <Row k="Template" v={template} />
            <Row k="Layout" v={layout} />
            <Row k="Status after create" v={<Pill tone="amber" dot>Draft</Pill>} />
          </div>
        </div>
      )}
      {error && step < 3 && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
    </Modal>
  );
}

/* ---------- 2 · Edit details ---------- */
export function EditDetailsModal({ page, pages, onClose, onSaved }: {
  page: CmsPage; pages: CmsPage[]; onClose: () => void; onSaved: (p: CmsPage, movedFrom: string) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [parentId, setParentId] = useState<string | null>(page.parentId);
  const [layout, setLayout] = useState(page.layout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const parent = pages.find((p) => p.id === parentId) ?? null;
  const nextPath = page.isHome ? "/" : `${parent && parent.path !== "/" ? parent.path : ""}/${slug || "…"}`;
  const routeChanged = nextPath !== page.path;

  const save = async (keepMine: boolean) => {
    setBusy(true); setError(null); setConflict(null);
    const res = await API.updatePageDetails(page.id, {
      title, slug, parentId, layout, expectRevision: page.revision
    });
    setBusy(false);
    if (res.ok) { onSaved(res.page, res.movedFrom); return; }
    if ("conflict" in res && res.conflict) { setConflict(res.error); return; }
    if (!keepMine) setError(res.error);
  };

  return (
    <Modal title="Edit Page Details" sub={`${page.title} · ${page.path}`} icon="pencil" width="narrow" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn variant="primary" loading={busy} onClick={() => save(false)}>Save Draft Details</Btn>
      </>}>
      <div className="d3-form">
        {conflict && (
          <div className="d3-alert is-warn">
            <Icon name="alert" size={12} />
            <div className="grow">{conflict}</div>
            <Btn className="btn-sm" onClick={() => { setConflict(null); onClose(); }}>Reload theirs</Btn>
            <Btn className="btn-sm" variant="primary" onClick={() => save(true)}>Keep mine</Btn>
          </div>
        )}
        {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
        <Field label="Page title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
        <Field label="URL slug" hint="Lowercase letters, numbers and hyphens.">
          <input className="input mono" value={slug} disabled={page.isHome} onChange={(e) => setSlug(slugify(e.target.value))} />
        </Field>
        <Field label="Parent page">
          <select className="input" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            {parentOptions(pages, page.id).map((o) => <option key={o.id} value={o.id}>{o.title}{o.id ? ` — ${o.path}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Master layout">
          <select className="input" value={layout} onChange={(e) => setLayout(e.target.value)}>
            {["Site default", "Wide", "Blank landing"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        {routeChanged && (
          <div className="d3-alert is-warn">
            <Icon name="link" size={12} />
            <div>
              <div className="f11 w600">Route change: {page.path} → {nextPath}</div>
              <div className="f10 muted">
                {page.inbound > 0
                  ? `${page.inbound} internal link${page.inbound === 1 ? "" : "s"} point here. A 301 redirect will be proposed at publish; the live route stays as it is until then.`
                  : "No internal links point here yet, so nothing breaks."}
              </div>
            </div>
          </div>
        )}
        <div className="d3-note"><Icon name="info" size={11} /> Saving changes the draft only. The live release keeps serving {page.path}.</div>
      </div>
    </Modal>
  );
}

/* ---------- 3 · Duplicate ---------- */
export function DuplicateModal({ page, pages, onClose, onDone }: {
  page: CmsPage; pages: CmsPage[]; onClose: () => void; onDone: (copy: CmsPage) => void;
}) {
  const [title, setTitle] = useState(`${page.title} copy`);
  const [slug, setSlug] = useState(slugify(`${page.slug || page.title}-copy`));
  const [parentId, setParentId] = useState<string | null>(page.parentId);
  const [includeSeo, setIncludeSeo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await API.duplicatePage(page.id, { title, slug, parentId, includeSeo });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.page);
  };

  return (
    <Modal title="Duplicate Page" sub="Create a draft copy in this website" icon="copy" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" loading={busy} onClick={submit}>Duplicate Page</Btn></>}>
      <div className="d3-form">
        {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
        <Field label="New page title"><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="New URL slug"><input className="input mono" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></Field>
        <Field label="Parent page">
          <select className="input" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            {parentOptions(pages, page.id).map((o) => <option key={o.id} value={o.id}>{o.title}{o.id ? ` — ${o.path}` : ""}</option>)}
          </select>
        </Field>
        <label className="d3-check"><input type="checkbox" checked={includeSeo} onChange={(e) => setIncludeSeo(e.target.checked)} /> Include SEO metadata</label>
        <div className="d3-note">
          <Icon name="info" size={11} /> The copy starts as a draft. Its live URL, leads and form submissions are not duplicated; referenced media stays linked.
        </div>
      </div>
    </Modal>
  );
}

/* ---------- 4 · Move ---------- */
export function MoveModal({ page, tree, onClose, onDone }: {
  page: CmsPage; tree: TreeNode[]; onClose: () => void; onDone: (to: string, affected: number) => void;
}) {
  const blocked = useMemo(() => {
    const out = new Set<string>([page.id]);
    let grew = true;
    while (grew) {
      grew = false;
      tree.forEach((n) => { if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; } });
    }
    return out;
  }, [page.id, tree]);
  const [parentId, setParentId] = useState<string | null>(page.parentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newParent = tree.find((n) => n.id === parentId);
  const newPath = `${newParent && newParent.path !== "/" ? newParent.path : ""}/${page.slug || "…"}`;

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await API.movePage(page.id, parentId);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.to, res.affected);
  };

  return (
    <Modal title="Move Page" sub={`${page.title} · currently ${page.path}`} icon="sitemap" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" loading={busy} onClick={submit} disabled={parentId === page.parentId}>Move Page</Btn></>}>
      <div className="d3-form">
        {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
        <Field label="New parent">
          <select className="input" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            <option value="">None (top level)</option>
            {tree.filter((n) => !blocked.has(n.id) && n.id !== page.id).map((n) => (
              <option key={n.id} value={n.id}>{"— ".repeat(n.depth)}{n.title} — {n.path}</option>
            ))}
          </select>
        </Field>
        <div className="d3-pathpreview"><Icon name="link" size={11} /> New path <span className="mono">{page.path} → {newPath}</span></div>
        <div className="d3-note"><Icon name="info" size={11} /> Only display position and the draft route change. Menus &amp; Navigation are edited separately, and the live release is untouched until you publish.</div>
      </div>
    </Modal>
  );
}

/* ---------- 5 · Set homepage ---------- */
export function HomepageModal({ page, current, onClose, onDone }: {
  page: CmsPage; current: CmsPage | null; onClose: () => void; onDone: (previous: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    const res = await API.setHomepage(page.id);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.previous);
  };
  return (
    <Modal title="Set as Homepage?" sub="One page per website answers the root route" icon="home" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" loading={busy} onClick={submit}>Set as Homepage</Btn></>}>
      <div className="d3-form">
        {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
        <div className="d3-meta">
          <Row k="New homepage" v={`${page.title} — ${page.path}`} />
          <Row k="Current homepage" v={current ? `${current.title} — /` : "None (site has no root route)"} />
          <Row k="Effect" v="The new page serves / in the next release; the old page keeps its own path." />
        </div>
        <div className="d3-note"><Icon name="info" size={11} /> Route changes take effect when the release is published, not immediately.</div>
      </div>
    </Modal>
  );
}

/* ---------- 6 · Trash ---------- */
export function TrashModal({ pages, onClose, onDone }: {
  pages: CmsPage[];
  onClose: () => void;
  /* permanent is decided before the request — the API mutates these page objects
     in place, so the caller must not re-read `trash` afterwards */
  onDone: (ids: string[], failed: { title: string; reason: string }[], permanent: boolean) => void;
}) {
  const app = useApp();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; failed: { title: string; reason: string }[] } | null>(null);
  const single = pages.length === 1;
  const permanent = pages.length > 0 && pages.every((p) => !!p.trash);
  const blockedChild = pages.find((p) => p.isHome) ? "A website needs a homepage — set another page first." : null;

  const submit = async () => {
    setBusy(true);
    if (permanent) {
      const failed: { title: string; reason: string }[] = [];
      for (const p of pages) {
        const res = await API.purgePage(p.id);
        if (!res.ok) failed.push({ title: p.title, reason: res.error });
      }
      setBusy(false);
      if (failed.length) { setResult({ ok: false, failed }); return; }
      onDone(pages.map((p) => p.id), [], true);
      return;
    }
    if (single) {
      const res = await API.trashPage(pages[0].id, reason);
      setBusy(false);
      if (!res.ok) { setResult({ ok: false, failed: [{ title: pages[0].title, reason: res.error }] }); return; }
      onDone([pages[0].id], [], false);
      return;
    }
    const res = await API.bulkTrash(pages.map((p) => p.id));
    setBusy(false);
    if (res.failed.length) { setResult({ ok: false, failed: res.failed }); return; }
    onDone(pages.map((p) => p.id), [], false);
  };

  return (
    <Modal title={permanent ? (single ? "Delete Page Permanently?" : `Delete ${pages.length} pages permanently?`) : single ? "Move Page to Trash?" : `Move ${pages.length} pages to Trash?`}
      sub={permanent ? "This cannot be undone — no restore, no undo" : `Recoverable for 30 days${single ? "" : " · partial failures are reported per page"}`}
      icon="trash" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" loading={busy} onClick={submit} disabled={!!blockedChild}>{permanent ? "Delete Permanently" : "Move to Trash"}</Btn></>}>
      <div className="d3-form">
        {blockedChild && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {blockedChild}</div>}
        <div className="d3-trashlist">
          {pages.map((p) => (
            <div key={p.id} className="d3-trashrow">
              <Icon name={p.isHome ? "home" : "file"} size={12} />
              <span className="grow"><span className="f12 w600">{p.title}</span><span className="f10 muted mono">{p.path}</span></span>
              {p.isHome && <Pill tone="violet">Homepage</Pill>}
              {p.status === "published" && <Pill tone="green">Live</Pill>}
            </div>
          ))}
        </div>
        {single && (
          <Field label="Reason (optional)" hint="Recorded in the audit trail.">
            <input className="input" value={reason} placeholder="e.g. replaced by the new Scholarships hub" onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        {result && !result.ok && (
          <div className="d3-alert is-error">
            <Icon name="alert" size={12} />
            <div>
              <div className="f11 w600">Some pages could not be moved</div>
              {result.failed.map((f) => <div key={f.title} className="f10">· {f.title} — {f.reason}</div>)}
            </div>
          </div>
        )}
        <div className={`d3-note ${permanent ? "is-danger" : ""}`}><Icon name={permanent ? "alert" : "info"} size={11} /> {permanent
          ? "A permanently deleted page cannot be restored, and every internal link pointing at it will 404."
          : "Pages in the live release stop being served after the next publish; the current release is immutable."}</div>
        {!single && <button className="link f11" onClick={() => app.toast({ type: "info", title: "Selection cleared" })}>Clear selection</button>}
      </div>
    </Modal>
  );
}

/* ---------- 7 · Restore ---------- */
export function RestoreModal({ page, taken, onClose, onDone }: {
  page: CmsPage; taken: boolean; onClose: () => void; onDone: (p: CmsPage) => void;
}) {
  const [slug, setSlug] = useState(page.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    const res = await API.restorePage(page.id, taken ? slug : undefined);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.page);
  };
  return (
    <Modal title="Restore Page?" sub={`${page.title} · recoverable until ${page.trash?.until}`} icon="refresh" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" loading={busy} onClick={submit}>Restore Page</Btn></>}>
      <div className="d3-form">
        {error && <div className="d3-alert is-error"><Icon name="alert" size={12} /> {error}</div>}
        {taken && (
          <>
            <div className="d3-alert is-warn"><Icon name="link" size={12} /> <span className="grow"><b>{page.path}</b> is now used by another page.</span></div>
            <Field label="New URL slug" hint="The page needs a free route before it can come back.">
              <input className="input mono" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} autoFocus />
            </Field>
          </>
        )}
        <div className="d3-note"><Icon name="info" size={11} /> A restored page returns as a draft. It becomes public again only through a release.</div>
      </div>
    </Modal>
  );
}

/* ---------- 8 · Preview ---------- */
export function PreviewModal({ page, onClose }: { page: CmsPage; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "expired">("loading");
  const [token, setToken] = useState("");
  const attempt = useRef(0);

  const run = () => {
    setState("loading");
    attempt.current += 1;
    void API.previewPage(page.id)
      .then((r) => { setToken(r.token); setState("ready"); })
      .catch(() => setState("expired"));
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, [page.id]);

  return (
    <Modal title="Preview" sub={`${page.title} · isolated, signed, never public`} icon="eye" width="wide" onClose={onClose}
      footer={<><span className="f10 muted grow">Preview tokens expire after 15 minutes and are scoped to your session.</span>
        {state === "expired" && <Btn variant="primary" icon="refresh" onClick={run}>Regenerate preview</Btn>}
        <Btn onClick={onClose}>Close</Btn></>}>
      {state === "loading" && <div className="d3-preview-frame"><div className="sk" style={{ height: 260, borderRadius: 10 }} /></div>}
      {state === "expired" && (
        <div className="d3-insp-empty">
          <Icon name="alert" size={18} />
          <div className="f12 w650">The preview token expired</div>
          <div className="f11 muted">Tokens last 15 minutes and cannot be reused. Regenerate to keep inspecting the draft.</div>
        </div>
      )}
      {state === "ready" && (
        <div className="d3-preview-frame">
          <div className="d3-preview-bar">
            <span className="d3-thumb-dot" /><span className="d3-thumb-dot" /><span className="d3-thumb-dot" />
            <span className="d3-preview-url mono">https://preview.wacrm.site/{token}{page.path}</span>
            <Pill tone="violet" dot>Draft</Pill>
          </div>
          <div className="d3-preview-body">
            <div className="f10 muted mono">signed preview · no index · noindex, nofollow</div>
            <div className="f18 w700 mt8">{page.title}</div>
            <div className="f11 muted mono">{page.path}</div>
            <div className="d3-preview-blocks">
              {Array.from({ length: Math.min(4, Math.max(2, Math.round(page.blocks / 2))) }).map((_, i) => (
                <div key={i} className="d3-preview-block">
                  <span className="sk-line sk" style={{ width: `${70 - i * 8}%` }} />
                  <span className="f10 muted">block · {i === 0 ? "hero" : i === 1 ? "rich text" : i === 2 ? "cards" : "cta"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="d3-note"><Icon name="lock" size={11} /> Path <span className="mono">/preview/…</span> is never routable from the public website.</div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="d3-meta-row"><span className="d3-meta-k">{k}</span><span className="d3-meta-v">{v}</span></div>;
}
