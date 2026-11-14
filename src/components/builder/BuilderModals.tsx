/* ============================================================
   Module 4 — builder overlays
   Every dialog here answers one question and closes. Publish
   hands off to the release pipeline; it does not invent its own.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Modal, Pill } from "@/components/ui";
import { Node as BlockView, type RenderCtx } from "./Blocks";
import { agoLabel, imageFor, type Asset, type BuilderForm, type Revision } from "@/lib/builder-db";
import type { BlockNode } from "@/lib/builder";
import type { CmsPage } from "@/lib/cms-pages";
import type { DocIssue } from "@/lib/builder";

const staticCtx: RenderCtx = { selId: null, selEl: null, onSelect: () => {}, onSelectEl: () => {} };

/* ---------------- link picker ---------------- */
export function LinkPicker({ nodeField, value, pages, siteId, onPick, onClose }: {
  nodeField: string; value: any; pages: CmsPage[]; siteId: string;
  onPick: (v: any) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"page" | "external" | "asset">(value?.kind ?? "page");
  const [q, setQ] = useState("");
  const [url, setUrl] = useState(value?.kind === "external" ? value?.url ?? "" : "");
  const list = pages.filter((p) => p.siteId === siteId && !p.trash && p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title="Link" sub="Internal pages, an external URL, or a downloadable asset" icon="link" width="narrow" onClose={onClose}
      footer={<>
        <span className="f10 muted grow">{nodeField === "primaryHref" ? "Used by the primary button" : "Link target"}</span>
        {tab === "external" && (
          <Btn variant="primary" disabled={!/^(https?:\/\/|\/)/.test(url)} onClick={() => onPick({ kind: "external", url })}>Use this URL</Btn>
        )}
        <Btn onClick={onClose}>Cancel</Btn>
      </>}>
      <div className="wb-lp-tabs" role="tablist">
        {([["page", "Pages", "file"], ["external", "External URL", "external"], ["asset", "Asset", "download"]] as const).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`wb-lp-tab ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id as any)}>
            <Icon name={icon} size={12} /> {label}
          </button>
        ))}
      </div>

      {tab === "page" && (
        <>
          <div className="wb-lib-search" style={{ marginTop: 8 }}>
            <Icon name="search" size={12} />
            <input className="wb-search-input" autoFocus placeholder="Search pages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pages" />
          </div>
          <div className="wb-lp-list">
            {!list.length && <div className="wb-lp-empty"><Icon name="search" size={14} /> No pages match “{q}”.</div>}
            {list.slice(0, 12).map((p) => (
              <button key={p.id} className={`wb-lp-row ${value?.id === p.id ? "is-sel" : ""}`} data-page={p.id}
                onClick={() => onPick({ kind: "page", id: p.id, path: p.path })}>
                <Icon name="file" size={12} />
                <span className="grow truncate">{p.title}</span>
                <span className="mono f10 muted">{p.path}</span>
                {value?.id === p.id && <Icon name="check" size={12} />}
              </button>
            ))}
            {list.length > 12 && <div className="wb-lp-more">+{list.length - 12} more — refine the search.</div>}
          </div>
        </>
      )}

      {tab === "external" && (
        <div className="mt10">
          <label className="wb-f"><span className="wb-f-lab">Destination URL</span>
            <input className="wb-input" autoFocus value={url} placeholder="https://example.com or /contact"
              onChange={(e) => setUrl(e.target.value)} aria-label="Destination URL" />
            <span className="wb-f-hint">Only http(s) and site-relative paths are accepted.</span>
          </label>
          {url && !/^(https?:\/\/|\/)/.test(url) && <span className="wb-f-err"><Icon name="alert" size={10} /> That is not a valid URL.</span>}
        </div>
      )}

      {tab === "asset" && (
        <div className="wb-lp-list">
          {[{ id: "as_brochure", name: "study-abroad-2026.pdf", size: "1.8 MB" }].map((a) => (
            <button key={a.id} className="wb-lp-row" onClick={() => onPick({ kind: "asset", id: a.id, path: a.name })}>
              <Icon name="download" size={12} /><span className="grow truncate">{a.name}</span><span className="f10 muted">{a.size}</span>
            </button>
          ))}
          <div className="wb-lp-more">Downloads are tracked separately from page views.</div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- media picker ---------------- */
export function MediaPicker({ assets, value, onPick, onDelete, onClose }: {
  assets: Asset[]; value: string; onPick: (id: string) => void; onDelete: (id: string) => { ok: boolean; reason?: string }; onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const images = assets.filter((a) => a.kind === "image");
  return (
    <Modal title="Choose an image" sub={`${images.length} sample assets in this workspace`} icon="image" width="wide" onClose={onClose}
      footer={<><span className="f10 muted grow">Deleting an asset that a page uses is blocked — the reference has to go first.</span><Btn onClick={onClose}>Close</Btn></>}>
      {err && <div className="wb-alert wb-alert-warn" style={{ marginBottom: 10 }}><span className="wb-alert-ico"><Icon name="alert" size={14} /></span><div><div className="wb-alert-title">That asset is in use</div><p className="wb-alert-text">{err}</p></div></div>}
      {!images.length && <div className="wb-lib-empty"><Icon name="image" size={16} /><b>No images yet</b><span>Upload assets in the Media Library.</span></div>}
      <div className="wb-media-grid">
        {images.map((a) => (
          <div className={`wb-media-card ${value === a.id ? "is-sel" : ""}`} key={a.id} data-asset={a.id}>
            <button className="wb-media-pick" onClick={() => onPick(a.id)} aria-label={`Use ${a.name}`}>
              <span className="wb-media-img" style={{ backgroundImage: `url(${imageFor(a.id)})` }} />
            </button>
            <div className="wb-media-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="wb-media-name truncate">{a.name}</div>
                <div className="wb-media-dims">{a.w} × {a.h} · {a.size}</div>
              </div>
              <button className="icon-btn" aria-label={`Delete ${a.name}`} onClick={() => {
                const r = onDelete(a.id);
                if (!r.ok) setErr(r.reason ?? "Asset is in use.");
                else setErr(null);
              }}><Icon name="trash" size={11} /></button>
            </div>
            <span className="wb-sample-tag">sample asset</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- static preview of a block set ---------------- */
export function BlocksPreview({ title, sub, blocks, onClose, device = "desktop" }: {
  title: string; sub: string; blocks: BlockNode[]; onClose: () => void; device?: "desktop" | "tablet" | "mobile";
}) {
  const width = device === "mobile" ? 375 : device === "tablet" ? 768 : 1440;
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (Math.min(window.innerWidth - 120, 980)) / width));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width]);
  return (
    <Modal title={title} sub={sub} icon="eye" width="wide" onClose={onClose}
      footer={<><span className="f10 muted grow">Static render of the draft — links and forms are inert here.</span><Btn onClick={onClose}>Close</Btn></>}>
      <div className="wb-preview-frame">
        <div className="wb-preview-bar">
          <span className="wb-thumb-dot" /><span className="wb-thumb-dot" /><span className="wb-thumb-dot" />
          <span className="mono f10 muted grow">preview.wacrm.site</span>
          <Pill tone="violet" dot>Draft</Pill>
        </div>
        <div className="wb-preview-scroll">
          <div className="wb-doc" style={{ width, zoom }}>
            {blocks.map((b) => <BlockView key={b.id} node={b} ctx={staticCtx} />)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- revision history ---------------- */
export function RevisionsModal({ revisions, current, onRestore, onClose, busy }: {
  revisions: Revision[]; current: number; onRestore: (rev: number) => void; onClose: () => void; busy: boolean;
}) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <Modal title="Revision history" sub="Autosaves every 2 s, snapshots every 5 min or on idle · 50 kept" icon="clock" width="wide" onClose={onClose}
      footer={<>
        <span className="f10 muted grow">Restoring creates a new revision — history is never rewritten.</span>
        <Btn onClick={onClose}>Close</Btn>
        <Btn variant="primary" disabled={pick === null || busy} loading={busy}
          onClick={() => pick !== null && onRestore(pick)}>Restore {pick !== null ? `r${pick}` : "revision"}</Btn>
      </>}>
      <div className="wb-rev-list">
        {revisions.map((r) => (
          <button key={r.rev} className={`wb-rev-row ${pick === r.rev ? "is-sel" : ""}`} onClick={() => setPick(r.rev)} data-rev={r.rev}>
            <span className={`wb-rev-dot ${r.kind}`} />
            <span className="wb-rev-rev">r{r.rev}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{r.summary}</b>
              <i>{r.by} · {agoLabel(r.at)}{r.rev === current ? " · current" : ""}</i>
            </span>
            <span className="wb-rev-count">{r.blocks.length} blocks</span>
            {pick === r.rev && <Icon name="check" size={13} />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- save conflict ---------------- */
export function ConflictModal({ latest, mine, busy, onReload, onKeep, onClose }: {
  latest: number; mine: number; busy: boolean; onReload: () => void; onKeep: () => void; onClose: () => void;
}) {
  return (
    <Modal title="This page was saved elsewhere" sub={`Revision r${latest} is newer than the r${mine} you opened`} icon="alert" width="narrow" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn onClick={onReload} disabled={busy}>Reload theirs</Btn>
        <Btn variant="primary" onClick={onKeep} loading={busy}>Keep mine</Btn>
      </>}>
      <p className="dr-p">Someone saved this page while you were editing. Your copy is intact in this tab — nothing has been overwritten yet.</p>
      <div className="wb-cmp">
        <div className="wb-cmp-col">
          <div className="wb-cmp-h"><Icon name="clock" size={12} /> Their copy · r{latest}</div>
          <ul><li>The version on the server right now.</li><li>Reload theirs discards your unsaved edits.</li></ul>
        </div>
        <div className="wb-cmp-col is-mine">
          <div className="wb-cmp-h"><Icon name="pencil" size={12} /> Your copy · r{mine}</div>
          <ul><li>Everything you changed in this tab.</li><li>Keep mine writes over r{latest} as a new revision.</li></ul>
        </div>
      </div>
      <div className="wb-warn-note"><Icon name="alert" size={11} /> Neither option can lose both copies: the loser stays in revision history.</div>
    </Modal>
  );
}

/* ---------------- save failed, leaving ---------------- */
export function LeaveWithUnsaved({ count, onRetry, onLeave, onStay }: {
  count: number; onRetry: () => void; onLeave: () => void; onStay: () => void;
}) {
  return (
    <Modal title="Your last changes are not saved" sub={`${count} edit${count === 1 ? "" : "s"} since the last successful save`} icon="alert" width="narrow" onClose={onStay}
      footer={<><Btn variant="ghost" onClick={onStay}>Stay here</Btn><span className="grow" /><Btn onClick={onLeave}>Leave anyway</Btn><Btn variant="primary" icon="refresh" onClick={onRetry}>Retry save</Btn></>}>
      <p className="dr-p">The save failed, so “wait for the save” would not be true. Retrying is the only option that keeps your work.</p>
      <div className="wb-warn-note"><Icon name="alert" size={11} /> Leaving now discards those edits. Earlier saved revisions are unaffected.</div>
    </Modal>
  );
}

/* ---------------- publish ---------------- */
export function PublishModal({ pages, siteName, pageTitle, issues, dirty, saving, busy, onSave, onPublish, onClose, canPublish }: {
  pages: CmsPage[]; siteName: string; pageTitle: string; issues: DocIssue[]; dirty: boolean; saving: boolean;
  busy: boolean; onSave: () => void; onPublish: () => void; onClose: () => void; canPublish: boolean;
}) {
  const blocking = issues.filter((i) => i.severity === "blocking");
  const others = pages.filter((p) => p.title !== pageTitle);
  const ready = !dirty && !saving && !blocking.length && canPublish;
  return (
    <Modal title="Review & publish" sub={`${siteName} · one release ships every unpublished page`} icon="upload" width="narrow" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        {dirty ? (
          <Btn variant="primary" icon="check" loading={saving} onClick={onSave} disabled={busy}>Save first</Btn>
        ) : (
          <Btn variant="primary" loading={busy} disabled={!ready} onClick={onPublish} data-act="publish">
            Publish release
          </Btn>
        )}
      </>}>
      {dirty && (
        <div className="wb-alert wb-alert-warn" style={{ marginBottom: 10 }}>
          <span className="wb-alert-ico"><Icon name="alert" size={14} /></span>
          <div><div className="wb-alert-title">Save your changes before publishing</div>
            <p className="wb-alert-text">A release can only ship what the server has. Publishing is held until the save lands.</p></div>
        </div>
      )}
      {!canPublish && (
        <div className="wb-alert wb-alert-warn" style={{ marginBottom: 10 }}>
          <span className="wb-alert-ico"><Icon name="lock" size={14} /></span>
          <div><div className="wb-alert-title">Your role cannot publish</div>
            <p className="wb-alert-text">Ask an Owner or Admin to publish this release.</p></div>
        </div>
      )}

      <div className="wb-pub-sec">In this release</div>
      <div className="wb-pub-list">
        <div className="wb-pub-row is-here">
          <Icon name="pencil" size={12} />
          <span className="grow truncate">{pageTitle}</span>
          <Pill tone="violet" dot>editing now</Pill>
        </div>
        {others.slice(0, 3).map((p) => (
          <div className="wb-pub-row" key={p.id}>
            <Icon name="file" size={12} />
            <span className="grow truncate">{p.title}</span>
            <span className="f10 muted">also unpublished</span>
          </div>
        ))}
        {others.length > 3 && <div className="wb-pub-more">+{others.length - 3} more page{others.length - 3 === 1 ? "" : "s"} with unpublished changes</div>}
      </div>

      <div className="wb-pub-sec">Preflight</div>
      <div className="wb-pub-checks">
        <Check ok label="Every section saved on the server" />
        <Check ok={!blocking.length} label={blocking.length ? `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} in this page` : "No blocking issues in this page"} />
        <Check ok label="No broken internal links" />
        <Check ok label="Assets referenced by this page exist" />
      </div>
      {!!blocking.length && (
        <div className="wb-pub-issues">
          {blocking.slice(0, 4).map((i, k) => (
            <div className="wb-pub-issue" key={k}><Icon name="alert" size={11} /><span><b>{i.label}</b> {i.message}</span></div>
          ))}
        </div>
      )}
      <div className="wb-warn-note"><Icon name="info" size={11} /> Publishing uses compare-and-swap: a newer release in flight sends you to the conflict dialog rather than overwriting it.</div>
    </Modal>
  );
}

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="wb-pub-check">
    <span className={`wb-pub-check-ico ${ok ? "ok" : "bad"}`}><Icon name={ok ? "check" : "x"} size={9} /></span>
    <span className="grow f12">{label}</span>
  </div>
);

/* ---------------- template with a missing dependency ---------------- */
export function TemplateUseModal({ name, forms, onUse, onClose }: {
  name: string; forms: BuilderForm[]; onUse: (mode: "form" | "remove", formId?: string) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"form" | "remove">("form");
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  return (
    <Modal title="This template needs a form" sub={`${name} · one dependency cannot be mapped automatically`} icon="layers" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" onClick={() => onUse(mode, formId)}>Use template</Btn></>}>
      <p className="dr-p">The template embeds an enquiry form. Pick the form this page should use, or drop the block.</p>
      <div className="wb-dep">
        <label className={`wb-dep-row ${mode === "form" ? "is-on" : ""}`}>
          <input type="radio" checked={mode === "form"} onChange={() => setMode("form")} name="dep" />
          <span className="grow">
            <b>Map to an existing form</b>
            <select className="wb-input" value={formId} disabled={mode !== "form"} onChange={(e) => setFormId(e.target.value)} aria-label="Choose a form">
              {!forms.length && <option value="">No forms in this site</option>}
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.fields} fields</option>)}
            </select>
            {!forms.length && <i className="wb-f-err" style={{ display: "block", marginTop: 4 }}>Create one in Forms &amp; Leads first.</i>}
          </span>
        </label>
        <label className={`wb-dep-row ${mode === "remove" ? "is-on" : ""}`}>
          <input type="radio" checked={mode === "remove"} onChange={() => setMode("remove")} name="dep" />
          <span className="grow"><b>Remove the form block</b><i>The rest of the template still lands.</i></span>
        </label>
      </div>
    </Modal>
  );
}

/* ---------------- save as template ---------------- */
export function SaveTemplateModal({ count, onSave, onClose }: { count: number; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const valid = name.trim().length >= 3;
  return (
    <Modal title="Save as template" sub={`${count} sections · reusable inside this website`} icon="layers" width="narrow" onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><span className="grow" />
        <Btn variant="primary" disabled={!valid} onClick={() => onSave(name.trim())}>Save template</Btn></>}>
      <label className="wb-f"><span className="wb-f-lab">Template name</span>
        <input className="winput wb-input" autoFocus value={name} placeholder="e.g. Intake landing – March"
          onChange={(e) => setName(e.target.value)} aria-label="Template name" />
        {!valid && <span className="wb-f-hint">At least three characters.</span>}
      </label>
      <div className="wb-warn-note" style={{ marginTop: 10 }}><Icon name="info" size={11} /> Templates store block structure and copy, never assets. Images are re-mapped on insert.</div>
    </Modal>
  );
}

export const useAgo = (t: number) => useMemo(() => agoLabel(t), [t]);
