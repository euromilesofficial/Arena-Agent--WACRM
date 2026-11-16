/* ============================================================
   Module 7 · dialogs and the shared-region drawer
   ------------------------------------------------------------
   Every dialog here either mutates through LayoutsAPI or is a pure
   read-out. Nothing silently "just works": the in-use refusal, the
   CAS conflict, the seeded page creation and the region blast-radius
   warning all surface as text the user can act on.
   ============================================================ */
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Field, Modal, Pill, Switch, Tip } from "@/components/ui";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { REGISTRY, type BlockType } from "@/lib/builder";
import {
  LayoutsAPI, labelFor, resolveLayoutId, usageRows,
  type LayoutDraft, type LayoutFrame, type PageTemplateDoc, type SharedRegion, type UsageRow
} from "@/lib/layout-db";

const ALL_TYPES = Object.keys(REGISTRY) as BlockType[];

/* ---------------- create ---------------- */

export function CreateLayoutModal({ siteId, layouts, onClose, onDone }: {
  siteId: string; layouts: LayoutDraft[]; onClose: () => void; onDone: (l: LayoutDraft) => void;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [from, setFrom] = useState(layouts.find((l) => l.isDefault)?.id ?? layouts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const made = await LayoutsAPI.createLayout(siteId, name, from || undefined);
      app.toast({ type: "success", title: `${made.name} created`, sub: "It starts as a draft. Assign pages when you are ready." });
      onDone(made);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Create a master layout"
      sub="A layout is the shell around your content — announcement, header, the required content slot, footer."
      icon="layers" onClose={onClose}
      footer={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="plus" loading={busy} onClick={submit} disabled={!name.trim()}>Create layout</Btn>
      </>}
    >
      <Field label="Layout name" hint="Editors see this name in the Pages layout picker. 60 characters maximum." error={err || undefined}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Partner Portal Layout" maxLength={70} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }} />
      </Field>
      <Field label="Start from" hint="Regions and slot policy are copied once — later edits to the source never cascade.">
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {layouts.filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (website default)" : ""}</option>)}
        </select>
      </Field>
      <div className="m7-note">
        <Icon name="info" size={13} />
        <span>The new layout is a <b>draft</b>. Nothing on the live site changes until a page is bound to it and published.</span>
      </div>
    </Modal>
  );
}

export function CreateTemplateModal({ siteId, templates, layouts, onClose, onDone }: {
  siteId: string; templates: PageTemplateDoc[]; layouts: LayoutDraft[]; onClose: () => void; onDone: (t: PageTemplateDoc) => void;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [layoutId, setLayoutId] = useState(layouts.find((l) => l.isDefault)?.id ?? layouts[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const made = await LayoutsAPI.createTemplate(siteId, name, layoutId, from || undefined);
      app.toast({ type: "success", title: `${made.name} template created`, sub: "Templates copy their blocks into a page once — they never inherit live edits." });
      onDone(made);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Create a page template" sub="A starter composition. Creating a page from it copies the blocks — the page is yours from that moment on." icon="file" onClose={onClose}
      footer={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="plus" loading={busy} onClick={submit} disabled={!name.trim()}>Create template</Btn>
      </>}>
      <Field label="Template name" error={err || undefined}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Intake Landing" autoFocus />
      </Field>
      <Field label="Default layout" hint="Pages created from this template are bound to this layout unless the editor changes it.">
        <select value={layoutId} onChange={(e) => setLayoutId(e.target.value)}>
          {layouts.filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Copy blocks from" hint="Optional. Leave empty for a two-block skeleton.">
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Start empty</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.blocks.length} blocks</option>)}
        </select>
      </Field>
    </Modal>
  );
}

/* ---------------- deletion ---------------- */

export function ArchiveModal({ target, onClose, onDone }: {
  target: { kind: "layout" | "template"; id: string; name: string; builtIn: boolean; isDefault: boolean; pages: number };
  onClose: () => void; onDone: () => void;
}) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const blocked = target.isDefault || target.pages > 0 || (target.kind === "template" && target.builtIn);

  const confirm = async () => {
    setBusy(true); setErr("");
    try {
      await LayoutsAPI.archive(target.kind, target.id);
      app.toast({
        type: "success", title: `${target.name} archived`,
        sub: target.kind === "layout" ? "Archived layouts stay readable in history and can be restored." : "The template is gone; pages created from it are untouched."
      });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal
      title={target.kind === "layout" ? "Delete this layout?" : "Delete this template?"}
      sub={target.kind === "layout" ? "Layouts are archived, never hard-deleted — page history keeps pointing at them." : "The starter disappears from the picker. Pages already created from it keep their blocks."}
      icon="trash" onClose={onClose}
      footer={<>
        <Btn onClick={onClose}>{blocked ? "Close" : "Keep it"}</Btn>
        <Btn variant="danger" icon="trash" loading={busy} disabled={blocked} onClick={confirm}>Archive layout</Btn>
      </>}>
      <div className="m7-del-name"><Icon name="layers" size={14} />{target.name}</div>
      {blocked ? (
        <div className="m7-block-reasons">
          {target.isDefault && <div><Icon name="alert" size={13} /><span><b>It is the website default.</b> Set another layout as default first — otherwise new pages would have no shell.</span></div>}
          {target.pages > 0 && <div><Icon name="alert" size={13} /><span><b>{target.pages} page{target.pages > 1 ? "s" : ""} still use it.</b> Reassign them from the Usage tab, then come back.</span></div>}
          {target.kind === "template" && target.builtIn && <div><Icon name="alert" size={13} /><span><b>Built-in templates are protected.</b> Duplicate it and edit the copy instead.</span></div>}
        </div>
      ) : (
        <div className="m7-note"><Icon name="shield" size={13} /><span>Nothing is live-bound to it, so no page will change.</span></div>
      )}
      {err && <div className="m7-err"><Icon name="alert" size={12} />{err}</div>}
    </Modal>
  );
}

/* ---------------- bulk reassign ---------------- */

export function ReassignModal({ siteId, layoutId, layouts, preselected, onClose, onDone }: {
  siteId: string; layoutId: string; layouts: LayoutDraft[]; preselected: string[];
  onClose: () => void; onDone: (moved: number, label: string) => void;
}) {
  const app = useApp();
  const [target, setTarget] = useState(layoutId);
  const [step, setStep] = useState<"pick" | "impact">("pick");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = layouts.find((l) => l.id === layoutId);
  const next = layouts.find((l) => l.id === target);
  const rows = useMemo(() => usageRows(siteId, layoutId).filter((r) => preselected.includes(r.id)), [siteId, layoutId, preselected]);
  const over = rows.length > 40;

  const run = async () => {
    setBusy(true); setErr("");
    try {
      const res = await LayoutsAPI.reassign(siteId, rows.map((r) => r.id), target);
      app.toast({
        type: "success", title: `${res.moved} page${res.moved > 1 ? "s" : ""} moved to ${res.label}`,
        sub: "One audit event was written. Each page is now a draft change until published."
      });
      onDone(res.moved, res.label);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal title="Reassign pages" sub={`${rows.length} selected page${rows.length === 1 ? "" : "s"} on ${current?.name}. Reassigning changes the shell, never the content.`} icon="refresh" width="wide" onClose={onClose}
      footer={step === "pick"
        ? <><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="arrowRight" disabled={!target || target === layoutId || over} onClick={() => setStep("impact")}>Review impact</Btn></>
        : <><Btn onClick={() => setStep("pick")}>Back</Btn><Btn variant="primary" icon="check" loading={busy} onClick={run} disabled={over}>Move {rows.length} page{rows.length === 1 ? "" : "s"}</Btn></>}>
      {step === "pick" ? (
        <>
          <Field label="Move to layout" hint="Archived layouts are not offered — a page cannot be bound to a retired shell.">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {layouts.filter((l) => !l.archived).map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " · website default" : ""}</option>)}
            </select>
          </Field>
          <div className="m7-re-list">
            {rows.slice(0, 8).map((r) => (
              <div key={r.id} className="m7-re-row">
                <Icon name="file" size={12} />
                <span className="m7-re-title">{r.title}</span>
                <code>{r.path}</code>
                <Pill tone={r.status === "published" ? "green" : "grey"}>{r.status === "published" ? "Published" : "Draft"}</Pill>
              </div>
            ))}
            {rows.length > 8 && <div className="m7-re-more">+ {rows.length - 8} more</div>}
          </div>
          {over && <div className="m7-err"><Icon name="alert" size={12} />Bulk reassign is capped at 40 pages per action. Move the rest in a second pass.</div>}
        </>
      ) : (
        <div className="m7-impact">
          <div className="m7-impact-cols">
            <div><span>From</span><b>{current?.name}</b><em>{rows.length} page{rows.length === 1 ? "" : "s"}</em></div>
            <Icon name="arrowRight" size={16} />
            <div><span>To</span><b>{next?.name}</b><em>{next?.header.variantId ? "Header and footer change immediately" : ""}</em></div>
          </div>
          <ul className="m7-impact-list">
            <li><Icon name="check" size={12} />Page content stays exactly where it is — only the shell changes.</li>
            <li><Icon name="check" size={12} />Every moved page becomes a draft change; publish from Pages when approved.</li>
            <li><Icon name="alert" size={12} />The announcement bar is {next && next.announcement.visible ? "on" : "off"} in {next?.name}.</li>
            <li><Icon name="alert" size={12} />Block types outside the new policy stay on the page but are flagged in preflight.</li>
          </ul>
          {err && <div className="m7-err"><Icon name="alert" size={12} />{err}</div>}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- preview ---------------- */

export function PreviewModal({ siteId, layout, frame, onClose }: {
  siteId: string; layout: LayoutDraft; frame: LayoutFrame; onClose: () => void;
}) {
  const app = useApp();
  const pages = DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const page = pages.find((p) => p.id === pageId);
  const bound = page ? labelFor(resolveLayoutId(page.layout) ?? null) : "";

  return (
    <Modal title={`Preview · ${layout.name}`} sub="A read-only draft preview. Nothing here is live, and nothing can be edited in the frame." icon="eye" width="wide" onClose={onClose}
      footer={<><Btn onClick={onClose}>Close preview</Btn><Btn variant="primary" icon="pencil" onClick={() => { onClose(); app.go("builder"); }}>Open a page in the builder</Btn></>}>
      <div className="m7-pv-bar">
        <label className="m7-field-inline">
          <span>Page</span>
          <select value={pageId} onChange={(e) => setPageId(e.target.value)}>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.path}</option>)}
          </select>
        </label>
        <div className="m7-devices" role="group" aria-label="Preview width">
          {([["desktop", "monitor"], ["tablet", "tablet"], ["mobile", "phone"]] as const).map(([d, icon]) => (
            <button key={d} className={device === d ? "is-on" : ""} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={d}><Icon name={icon} size={13} /></button>
          ))}
        </div>
        <Pill tone="amber" dot>Draft preview — not live</Pill>
      </div>
      <div className={`m7-pv-frame is-${device}`}>
        {frame.announcement && <div className="m7-pv-announce">{frame.announcement.text}</div>}
        {frame.header && <div className="m7-pv-header"><b>{frame.header.brand}</b><nav>{frame.header.nav.map((l) => <span key={l}>{l}</span>)}</nav><em>{frame.header.cta}</em></div>}
        <div className="m7-pv-body">
          <div className="m7-pv-slot">{page ? `${page.title} — page content (${page.blocks} blocks)` : "No page selected"}</div>
          <div className="m7-pv-meta">
            <span>Layout in this preview: <b>{layout.name}</b></span>
            <span>Page currently bound to: <b>{bound || "unassigned"}</b></span>
          </div>
        </div>
        {frame.footer && <div className="m7-pv-footer">{frame.footer.note} · {frame.footer.variant}</div>}
      </div>
    </Modal>
  );
}

/* ---------------- shared region drawer ---------------- */

export function RegionDrawer({ region, onClose, onDone }: { region: SharedRegion; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const [vid, setVid] = useState(region.variants[0]?.id ?? "");
  const variant = region.variants.find((v) => v.id === vid) ?? region.variants[0];
  const props = (variant?.blocks[0]?.props ?? {}) as any;
  const [name, setName] = useState(variant?.name ?? "");
  const [text, setText] = useState(String(props.text ?? ""));
  const [brand, setBrand] = useState(String(props.brand ?? "EuroMiles.in"));
  const [nav, setNav] = useState((props.nav as string[] | undefined)?.join(", ") ?? "Home");
  const [cta, setCta] = useState(String(props.cta ?? "Enquire Now"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const layoutsUsing = useMemo(() => {
    const all = LayoutsAPI.sync("site_main").layouts;
    return all.filter((l) => [l.header, l.footer, l.announcement].some((r) => r.regionId === region.id && r.variantId === vid));
  }, [region.id, vid]);

  const pick = (id: string) => {
    const v = region.variants.find((x) => x.id === id);
    setVid(id);
    setName(v?.name ?? "");
    const p = (v?.blocks[0]?.props ?? {}) as any;
    setText(String(p.text ?? "")); setBrand(String(p.brand ?? "EuroMiles.in"));
    setNav((p.nav as string[] | undefined)?.join(", ") ?? "Home"); setCta(String(p.cta ?? "Enquire Now"));
  };

  const save = async () => {
    if (!variant) return;
    setBusy(true); setErr("");
    try {
      const blocks = variant.blocks.map((b, i) => i !== 0 ? b : {
        ...b,
        props: { ...(b.props as any), ...(region.kind === "announcement" ? { text } : region.kind === "header" ? { brand, nav: nav.split(",").map((s) => s.trim()).filter(Boolean), cta } : {}) }
      });
      await LayoutsAPI.saveRegionVariant(region.id, { ...variant, name, blocks });
      app.toast({
        type: "success", title: `${name} saved`,
        sub: layoutsUsing.length ? `${layoutsUsing.length} layout${layoutsUsing.length > 1 ? "s" : ""} pinned to it became draft changes.` : "No layout pins this variant yet."
      });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal title={`${region.name} — shared region`} sub="Chrome is stored once and referenced. Editing a variant changes every layout pinned to it." icon="columns" width="wide" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="check" loading={busy} onClick={save} disabled={!variant}>Save variant</Btn></>}>
      <div className="m7-region-tabs">
        {region.variants.map((v) => (
          <button key={v.id} className={vid === v.id ? "is-on" : ""} onClick={() => pick(v.id)}>
            <b>{v.name}</b><span>rev {v.rev}</span>
          </button>
        ))}
      </div>
      <Field label="Variant name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {region.kind === "announcement" && (
        <Field label="Bar text" hint="Plain text. Links and dismiss behaviour are configured in the Menus module.">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Fall 2026 intake is open — apply by 15 Jan." />
        </Field>
      )}
      {region.kind === "header" && (
        <>
          <Field label="Brand"><input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
          <Field label="Navigation links" hint="Comma separated. The full navigation tree is owned by Menus & Navigation (Module 8)."><input value={nav} onChange={(e) => setNav(e.target.value)} /></Field>
          <Field label="Call to action"><input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
        </>
      )}
      <div className="m7-blast">
        <div className="m7-blast-h"><Icon name="alert" size={13} /><b>Blast radius</b></div>
        {layoutsUsing.length === 0
          ? <p>No layout currently pins this variant. Saving it changes nothing visible.</p>
          : <p>Saving marks <b>{layoutsUsing.length} layout{layoutsUsing.length > 1 ? "s" : ""}</b> as draft changes: {layoutsUsing.map((l) => l.name).join(" · ")}. Pages keep the released version until you publish.</p>}
      </div>
      {err && <div className="m7-err"><Icon name="alert" size={12} />{err}</div>}
    </Modal>
  );
}

/* ---------------- SEO checklist (computed, not a switch) ---------------- */

export function SeoModal({ layout, onClose }: { layout: LayoutDraft; onClose: () => void }) {
  const ok = layout.seoChecklist.filter((c) => c.ok).length;
  return (
    <Modal title="SEO readiness" sub="Computed from the layout's structure — not a manual toggle. A layout is SEO-ready when every check passes." icon="shield" onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Got it</Btn>}>
      <div className="m7-seo-head">
        <Pill tone={ok === layout.seoChecklist.length ? "green" : "amber"} dot>{ok === layout.seoChecklist.length ? "SEO-ready" : `${ok}/${layout.seoChecklist.length} checks pass`}</Pill>
        <span>{layout.name}</span>
      </div>
      <div className="m7-seo-list">
        {layout.seoChecklist.map((c) => (
          <div key={c.id} className={c.ok ? "is-ok" : "is-bad"}>
            <Icon name={c.ok ? "check" : "alert"} size={13} />
            <span>{c.label}</span>
            <em>{c.ok ? "pass" : "needs attention"}</em>
          </div>
        ))}
      </div>
      <div className="m7-note"><Icon name="info" size={13} /><span>Per-page titles, descriptions and canonicals are owned by Pages; this checks the shell only.</span></div>
    </Modal>
  );
}

/* ---------------- conflict / leave guards ---------------- */

export function ConflictModal({ message, onReload, onOverwrite, onClose }: {
  message: string; onReload: () => void; onOverwrite: () => void; onClose: () => void;
}) {
  return (
    <Modal title="This layout moved while you were editing" sub={message} icon="alert" onClose={onClose}
      footer={<><Btn onClick={onClose}>Keep editing</Btn><Btn onClick={onOverwrite} icon="refresh">Overwrite with mine</Btn><Btn variant="primary" icon="download" onClick={onReload}>Load their version</Btn></>}>
      <div className="m7-conflict">
        <div><b>Your copy</b><span>unsaved changes in this tab</span></div>
        <Icon name="arrowRight" size={14} />
        <div><b>Their copy</b><span>saved a moment ago by someone else</span></div>
      </div>
      <p className="m7-muted">Loading their version discards your unsaved changes. Overwriting keeps yours and writes a new revision they can revert.</p>
    </Modal>
  );
}

export function LeaveModal({ onLeave, onStay }: { onLeave: () => void; onStay: () => void }) {
  return (
    <Modal title="Save your changes first?" sub="This layout has unsaved edits. Leaving now discards them." icon="alert" onClose={onStay}
      footer={<><Btn onClick={onStay}>Stay</Btn><Btn variant="danger" onClick={onLeave}>Discard and leave</Btn></>}>
      <p className="m7-muted">Saves are explicit — there is no autosave on layouts, because a shell change touches every page bound to it.</p>
    </Modal>
  );
}

/* ---------------- create a page from a template ---------------- */

export function CreatePageModal({ siteId, template, layouts, onClose, onDone }: {
  siteId: string; template: PageTemplateDoc; layouts: LayoutDraft[]; onClose: () => void; onDone: (id: string, title: string) => void;
}) {
  const app = useApp();
  const [title, setTitle] = useState(template.name);
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pages = DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
  const bound = layouts.find((l) => l.id === template.layoutId);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const made = await LayoutsAPI.createPageFromTemplate(siteId, template.id, title, parent || null);
      app.toast({
        type: "success", title: `“${made.title}” created`,
        sub: `${template.blocks.length} blocks copied once. Bound to ${bound?.name ?? "the default layout"}.`,
        action: { label: "Open in builder", onClick: () => { location.hash = `#/builder?site=${siteId}&page=${made.id}`; } }
      });
      onDone(made.id, made.title);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal title={`Create a page from ${template.name}`} sub="Copy-on-create: the template's blocks are cloned into a new draft page. Later template edits never touch it." icon="file" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="plus" loading={busy} onClick={submit} disabled={!title.trim()}>Create draft page</Btn></>}>
      <Field label="Page title"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
      <Field label="Parent page" hint="Leave empty for a top-level page.">
        <select value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">No parent (top level)</option>
          {pages.slice(0, 20).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </Field>
      <div className="m7-note"><Icon name="layers" size={13} /><span>Bound to <b>{bound?.name ?? "Website default"}</b> · {template.blocks.length} blocks · created as a draft.</span></div>
      {err && <div className="m7-err"><Icon name="alert" size={12} />{err}</div>}
    </Modal>
  );
}

/* ---------------- preflight panel ---------------- */

export function PreflightModal({ issues, onClose, onFix }: {
  issues: { id: string; severity: "error" | "warn"; label: string; detail: string; fix?: string }[];
  onClose: () => void; onFix: () => void;
}) {
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <Modal title="Preflight" sub="Every binding problem this site currently has, computed live from the page registry." icon="shield" width="wide" onClose={onClose}
      footer={<><Btn onClick={onClose}>Close</Btn><Btn variant="primary" icon="link" onClick={onFix}>Open the affected pages</Btn></>}>
      {issues.length === 0 ? (
        <div className="m7-note is-ok"><Icon name="check" size={13} /><span>No issues. Every page resolves to a live layout.</span></div>
      ) : (
        <>
          <div className="m7-pf-sum">
            <Pill tone={errors ? "red" : "amber"} dot>{errors ? `${errors} blocking` : "No blockers"}</Pill>
            <span>{issues.length} finding{issues.length === 1 ? "" : "s"} across this site</span>
          </div>
          <div className="m7-pf-list">
            {issues.map((i) => (
              <div key={i.id} className={`m7-pf ${i.severity}`}>
                <Icon name={i.severity === "error" ? "alert" : "info"} size={13} />
                <div>
                  <b>{i.label}</b>
                  <p>{i.detail}</p>
                  {i.fix && <em><Tip text="What to do"><span>{i.fix}</span></Tip></em>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------------- slot policy editor ---------------- */

export function PolicyModal({ allow, deny, maxBlocks, onSave, onClose }: {
  allow: BlockType[]; deny: BlockType[]; maxBlocks: number;
  onSave: (p: { allow: BlockType[]; deny: BlockType[]; maxBlocks: number }) => void; onClose: () => void;
}) {
  const [next, setNext] = useState<BlockType[]>(allow);
  const [max, setMax] = useState(maxBlocks);
  const toggle = (t: BlockType) => setNext((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const all = next.length === 0;
  return (
    <Modal title="Slot policy" sub="Which blocks an editor may place in this layout's Main Content Slot. The Visual Builder's library is filtered by this list." icon="shield" width="wide" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="check" onClick={() => onSave({ allow: next, deny, maxBlocks: max })}>{all ? "Allow every block" : `Allow ${next.length} block types`}</Btn></>}>
      <div className="m7-policy-head">
        <label className="m7-field-inline"><span>Block ceiling</span>
          <input type="number" min={1} max={200} value={max} onChange={(e) => setMax(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
        </label>
        <button className="m7-linkbtn" onClick={() => setNext([])}>Reset to all 20</button>
      </div>
      <div className="m7-policy-grid">
        {ALL_TYPES.map((t) => (
          <label key={t} className={`m7-policy ${next.includes(t) ? "is-on" : ""}`}>
            <input type="checkbox" checked={next.includes(t)} onChange={() => toggle(t)} />
            <span>{t}</span>
            <em>{REGISTRY[t].group}</em>
          </label>
        ))}
      </div>
      <div className="m7-note"><Icon name="info" size={13} /><span>{all ? "An empty allow-list means “every registered block”. Tick types to narrow it." : `${next.length} of ${ALL_TYPES.length} block types allowed. Unticked blocks are hidden from the library on this layout, not deleted from existing pages.`}</span></div>
    </Modal>
  );
}

export function usageLabel(r: UsageRow) {
  return r.mode === "inherited" ? "Inherited from default" : r.mode === "explicit" ? "Explicitly assigned" : "Unassigned";
}

export { ALL_TYPES, Switch, usageRows };
