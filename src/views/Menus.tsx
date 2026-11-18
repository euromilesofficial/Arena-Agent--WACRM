/* ============================================================
   Module 8 · Menus & Navigation
   ------------------------------------------------------------
   Menu list · tree editor · checks, apply, mobile output and preview.
   Every edit goes into one draft. Save is compare-and-swap (MenusAPI.save),
   refused while the draft has errors. Apply writes the saved menu into a
   header or footer variant through LayoutsAPI, and only when clean.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, EmptyState, Field, Modal, Pill, Skel, Switch } from "@/components/ui";
import { useApp } from "@/lib/store";
import { DBX, type CmsPage } from "@/lib/data";
import { LayoutsAPI, type SharedRegion } from "@/lib/layout-db";
import {
  MENU_LIMITS, MenuError, MenusAPI, addChild, blankItem, checkMenu, hasErrors, mapItem, mode as MenusMode, moveItem, removeItem,
  walk, type Audience, type LinkKind, type Location, type Menu, type MenuItem, type MenuIssue
} from "@/lib/menu-db";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const AMBER = { bg: "#fef3c7", ink: "#92400e", line: "#fcd34d" };

const LOC_LABEL: Record<Location, string> = { header: "Header", footer: "Footer", custom: "Custom" };
const AUD_LABEL: Record<Audience, string> = { everyone: "Everyone", members: "Signed-in members", hidden: "Hidden" };

export function Menus() {
  const app = useApp();
  const siteId = app.siteId === "all" ? "site_main" : app.siteId;
  /* read-only for a Viewer, and in the permission-denied prototype state */
  const readOnly = app.role === "Viewer" || app.demo === "denied";
  MenusMode.fail = app.demo === "error";
  MenusMode.slow = app.demo === "loading";
  MenusMode.empty = app.demo === "empty";
  MenusMode.conflict = app.demo === "conflict";
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState("");
  const [data, setData] = useState<{ menus: Menu[]; pages: CmsPage[]; regions: SharedRegion[] } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Menu | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [tick, setTick] = useState(0);

  /* A reload after a save is silent: what is on screen stays. A change of site or prototype
     state shows the loading skeleton, because that is a new load. */
  const reload = useCallback(async (silent: boolean) => {
    if (!silent) setStatus("loading");
    try {
      const [m, lay] = await Promise.all([MenusAPI.load(siteId), LayoutsAPI.load(siteId)]);
      setData({ menus: m.menus, pages: m.pages as CmsPage[], regions: lay.regions });
      setSelId((prev) => (prev && m.menus.some((x) => x.id === prev) ? prev : m.menus[0]?.id ?? null));
      setStatus("ready");
    } catch (e) { setErr((e as Error).message); setStatus("error"); }
  }, [siteId]);

  useEffect(() => { void reload(false); }, [reload, app.demo]);
  useEffect(() => { if (tick > 0) void reload(true); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = useMemo(() => data?.menus.find((m) => m.id === selId) ?? null, [data, selId]);
  /* the draft resets when the menu changes, when its revision changes, and on every explicit reload
     (Reload theirs), even when the revision is the same */
  useEffect(() => { setDraft(saved ? clone(saved) : null); setFocusItem(null); setConflict(false); }, [saved?.id, saved?.rev, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!draft && !!saved && !same(draft, saved);
  const issues: MenuIssue[] = useMemo(() => (draft && data ? checkMenu(draft, data.pages) : []), [draft, data]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  const blocked = hasErrors(issues);

  const edit = (fn: (items: MenuItem[]) => MenuItem[]) => setDraft((d) => (d ? { ...d, items: fn(d.items) } : d));

  const save = async () => {
    if (!draft || !saved || readOnly) return;
    setBusy(true);
    try {
      await MenusAPI.save(draft, saved.rev);
      app.toast({ type: "success", title: `${draft.name} saved`, sub: `Revision ${saved.rev + 1}. Chrome is unchanged until you apply it.` });
      setTick((n) => n + 1);
    } catch (e) {
      const m = e as MenuError;
      if (m.code === "E_CONFLICT") setConflict(true);
      app.toast({ type: "error", title: "Could not save the menu", sub: m.message });
    } finally { setBusy(false); }
  };

  const apply = async (regionId: string, variantId: string, label: string) => {
    if (!saved || !data || readOnly) return;
    setBusy(true);
    try {
      const r = await MenusAPI.apply(saved, regionId, variantId, data.regions);
      app.toast({
        type: "success", title: `${saved.name} applied to ${label}`,
        sub: `${r.written} ${saved.location === "footer" ? "column" : "link"}${r.written === 1 ? "" : "s"} written.${r.omitted.length ? " Left out: " + r.omitted.join("; ") + "." : ""}`
      });
      setTick((n) => n + 1);
    } catch (e) { app.toast({ type: "error", title: "Could not apply the menu", sub: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!saved || readOnly) return;
    try {
      await MenusAPI.remove(saved.id);
      app.toast({ type: "success", title: `${saved.name} deleted` });
      setSelId(null); setTick((n) => n + 1);
    } catch (e) { app.toast({ type: "error", title: "Could not delete the menu", sub: (e as Error).message }); }
  };

  if (status === "loading") return <Loading />;
  if (status === "error") return <div className="m8-wrap"><EmptyState icon="alert" title="Menus did not load" desc={err} action={<Btn onClick={() => void reload(false)}>Try again</Btn>} /></div>;
  if (!data || data.menus.length === 0) {
    return (
      <div className="m8-wrap">
        <Header siteId={siteId} onNew={() => setNewOpen(true)} />
        <EmptyState icon="sitemap" title="No menus yet" desc="A menu is an ordered list of links. Start with the primary navigation, then the footer."
          action={<Btn variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New menu</Btn>} />
        {newOpen && <NewMenuModal siteId={siteId} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setSelId(id); setTick((n) => n + 1); }} />}
      </div>
    );
  }

  const targets = saved ? MenusAPI.chromeTargets(data.regions, saved.location) : [];

  return (
    <div className="m8-wrap">
      <Header siteId={siteId} onNew={() => setNewOpen(true)} />

      <div className="m8-grid">
        {/* ---------- menu list ---------- */}
        <aside className="m8-list" aria-label="Menus">
          <div className="m8-sec-h"><h3>Menus</h3><span>{data.menus.length}</span></div>
          {data.menus.map((m) => {
            const mIssues = checkMenu(m, data.pages);
            const e = mIssues.filter((i) => i.severity === "error").length;
            const w = mIssues.length - e;
            return (
              <button key={m.id} className={`m8-menu ${m.id === selId ? "is-on" : ""}`} aria-current={m.id === selId ? "true" : undefined} onClick={() => setSelId(m.id)}>
                <span className="m8-menu-n">{m.name}</span>
                <span className="m8-menu-m">
                  <Pill tone={m.location === "header" ? "violet" : m.location === "footer" ? "blue" : "grey"}>{LOC_LABEL[m.location]}</Pill>
                  <span>{countLinks(m.items)} links</span>
                </span>
                <span className="m8-menu-s">
                  {m.appliedTo ? `On ${m.appliedTo.variantName}` : "Not applied"}
                  {e > 0 && <b className="m8-bad"> · {e} error{e === 1 ? "" : "s"}</b>}
                  {e === 0 && w > 0 && <b className="m8-warn"> · {w} warning{w === 1 ? "" : "s"}</b>}
                </span>
              </button>
            );
          })}
        </aside>

        {/* ---------- editor ---------- */}
        <section className="m8-editor" aria-label="Menu editor">
          {readOnly && <div className="m8-banner is-info" role="status"><Icon name="lock" size={13} /><span>Read-only. Your role can view menus but not change them. Ask an Admin or Editor to make changes.</span></div>}
          {draft && saved && (
            <fieldset className="m8-fs" disabled={readOnly}>
              <div className="m8-toolbar">
                <div className="m8-toolbar-l">
                  <input className="m8-name" aria-label="Rename menu" value={draft.name} maxLength={60}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <span className={`m8-state ${dirty ? "is-dirty" : ""}`}>
                    {dirty ? "Unsaved changes" : `Saved · revision ${saved.rev}`}
                  </span>
                </div>
                <div className="m8-toolbar-r">
                  <Btn icon="plus" onClick={() => { const it = blankItem(); edit((items) => [...items, it]); setFocusItem(it.id); }}>Add top link</Btn>
                  <Btn icon="refresh" disabled={!dirty || busy} onClick={() => setDraft(clone(saved))}>Discard</Btn>
                  <Btn variant="primary" icon="check" loading={busy} disabled={!dirty || blocked || busy} onClick={() => void save()}
                    title={blocked ? "Fix the errors below to save" : undefined}>Save</Btn>
                </div>
              </div>

              {conflict && (
                <div className="m8-banner is-bad" role="alert">
                  <Icon name="alert" size={13} />
                  <span>Someone saved this menu while you were editing. Your draft is still here; reload theirs to continue, or keep yours and save again after reloading.</span>
                  <Btn onClick={() => { setConflict(false); setTick((n) => n + 1); }}>Reload theirs</Btn>
                </div>
              )}
              {blocked && (
                <div className="m8-banner is-bad" role="status">
                  <Icon name="alert" size={13} />
                  <span>{errors.length} problem{errors.length === 1 ? "" : "s"} block saving: {errors.slice(0, 2).map((i) => i.label).join("; ")}{errors.length > 2 ? "…" : ""}</span>
                </div>
              )}

              <div className="m8-tree" role="group" aria-label="Links">
                {draft.items.length === 0 && (
                  <div className="m8-empty-tree">
                    <Icon name="sitemap" size={18} />
                    <b>This menu has no links</b>
                    <span>Add a top link to start. Each link can hold up to {MENU_LIMITS.maxDepth - 1} levels below it.</span>
                  </div>
                )}
                <Rows items={draft.items} depth={0} pages={data.pages} issues={issues} focusItem={focusItem}
                  onChange={(id, fn) => edit((items) => mapItem(items, id, fn))}
                  onMove={(id, dir) => edit((items) => moveItem(items, id, dir))}
                  onDelete={(id) => edit((items) => removeItem(items, id))}
                  onAdd={(parentId) => { const it = blankItem(); edit((items) => addChild(items, parentId, it)); setFocusItem(it.id); }} />
              </div>
            </fieldset>
          )}
        </section>

        {/* ---------- side panel ---------- */}
        <aside className="m8-side" aria-label="Checks and output">
          {draft && saved && (
            <fieldset className="m8-fs" disabled={readOnly}>
              <div className="m8-card">
                <div className="m8-sec-h"><h3>Link checks</h3><span>{errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} warning{warnings.length === 1 ? "" : "s"}</span></div>
                {issues.length === 0 && <p className="m8-ok"><Icon name="check" size={12} /> Every link resolves to a live page or a valid address.</p>}
                <ul className="m8-issues">
                  {issues.map((i, k) => (
                    <li key={`${i.id}-${k}`} className={`is-${i.severity}`}>
                      <Icon name={i.severity === "error" ? "alert" : "info"} size={12} />
                      <div>
                        <b>{i.label}</b>
                        <span>{i.detail}</span>
                      </div>
                      {i.itemId && <button className="m8-link" onClick={() => setFocusItem(i.itemId!)}>Show</button>}
                    </li>
                  ))}
                </ul>
                <p className="m8-note">Errors block Save. Warnings are shown and allowed. The check runs on the draft, against the pages in this website.</p>
              </div>

              {saved.location !== "custom" && (
                <div className="m8-card">
                  <div className="m8-sec-h"><h3>Apply to {saved.location}</h3></div>
                  {saved.appliedTo && <p className="m8-note">Last applied to <b>{saved.appliedTo.variantName}</b> · {new Date(saved.appliedTo.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                  {targets.length === 0 && <p className="m8-note">No {saved.location} variant exists to apply to.</p>}
                  {targets.map((t) => {
                    const blockedApply = dirty || blocked;
                    const sync = MenusAPI.inSync(saved, t, saved.location);
                    const live = saved.location === "header"
                      ? (t.nav.length ? t.nav.join(", ") : "no links")
                      : (t.groups.length ? t.groups.map((g) => g.title).join(", ") : "no columns");
                    return (
                      <div key={t.variantId} className="m8-target">
                        <div>
                          <b>{t.name}</b>
                          <span>Live now: {live}</span>
                          <Pill tone={sync ? "green" : "amber"} dot>{sync ? "In sync with this menu" : "Differs from this menu"}</Pill>
                        </div>
                        <div className="m8-target-acts">
                          <Btn icon="upload" disabled={blockedApply || busy || sync} onClick={() => void apply(t.regionId, t.variantId, t.name)}
                            title={dirty ? "Save the draft first" : blocked ? "Fix the errors first" : sync ? "Already in sync" : undefined}>Apply</Btn>
                          <Btn variant="ghost" icon="arrowRight" onClick={() => app.go("layouts")}>Open in Layouts</Btn>
                        </div>
                      </div>
                    );
                  })}
                  <p className="m8-note">Applying writes the saved menu into the shared chrome. Every layout that uses that variant is marked unpublished.{saved.location === "header" ? " A header shows top-level labels only; dropdowns and mega columns stay in this menu." : ""}</p>
                </div>
              )}

              <div className="m8-card">
                <div className="m8-sec-h"><h3>Mobile output</h3></div>
                <Field label="Behaviour" hint={draft.mobile.behaviour === "drawer" ? "A full-screen drawer. Sub-links open on tap." : "Sub-links expand in place."}>
                  <select value={draft.mobile.behaviour} onChange={(e) => setDraft({ ...draft, mobile: { ...draft.mobile, behaviour: e.target.value as "drawer" | "accordion" } })} aria-label="Mobile behaviour">
                    <option value="drawer">Drawer</option>
                    <option value="accordion">Accordion</option>
                  </select>
                </Field>
                <Switch checked={draft.mobile.openFirstLevel} onChange={(v) => setDraft({ ...draft, mobile: { ...draft.mobile, openFirstLevel: v } })} label="Open the first level by default" />
              </div>

              <div className="m8-card">
                <div className="m8-sec-h"><h3>Preview</h3><span>from the draft</span></div>
                <Preview menu={draft} />
              </div>

              <div className="m8-card m8-danger">
                <div className="m8-sec-h"><h3>Delete menu</h3></div>
                <p className="m8-note">{saved.appliedTo ? `${saved.name} is applied to ${saved.appliedTo.variantName}. Apply another menu there first.` : "Removes the menu and its links. This cannot be undone."}</p>
                <Btn variant="danger" icon="trash" disabled={!!saved.appliedTo || busy} onClick={() => void remove()}>Delete {saved.name}</Btn>
              </div>
            </fieldset>
          )}
        </aside>
      </div>

      {newOpen && <NewMenuModal siteId={siteId} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setSelId(id); setTick((n) => n + 1); }} />}
    </div>
  );
}

function Header({ siteId, onNew }: { siteId: string; onNew: () => void }) {
  const app = useApp();
  return (
    <header className="m7-head">
      <div>
        <h1 className="m7-title">Menus &amp; Navigation</h1>
        <p className="m7-sub">Links for the header and footer. Checked before they can be saved or applied.</p>
      </div>
      <div className="m7-head-right">
        <label className="m7-site">
          <span>Website:</span>
          <select value={siteId} onChange={(e) => app.setSite(e.target.value)} aria-label="Website">
            {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <Btn icon="plus" onClick={onNew}>New menu</Btn>
      </div>
    </header>
  );
}

function Loading() {
  return (
    <div className="m8-wrap" aria-busy="true">
      <Skel style={{ height: 28, width: 260, borderRadius: 8 }} />
      <div className="m8-grid" style={{ marginTop: 16 }}>
        <Skel style={{ height: 380, borderRadius: 12 }} /><Skel style={{ height: 380, borderRadius: 12 }} /><Skel style={{ height: 380, borderRadius: 12 }} />
      </div>
    </div>
  );
}

const countLinks = (items: MenuItem[]) => { let n = 0; walk(items, 0, null, () => { n++; }); return n; };

function Rows({ items, depth, pages, issues, focusItem, onChange, onMove, onDelete, onAdd }: {
  items: MenuItem[]; depth: number; pages: CmsPage[]; issues: MenuIssue[]; focusItem: string | null;
  onChange: (id: string, fn: (it: MenuItem) => MenuItem) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onAdd: (parentId: string) => void;
}) {
  return (
    <ul className={`m8-rows d${depth}`} role="list">
      {items.map((it, i) => {
        const own = issues.filter((x) => x.itemId === it.id);
        const bad = own.some((x) => x.severity === "error");
        const name = it.label.trim() || "link";
        return (
          <li key={it.id} className="m8-row-wrap">
            <div className={`m8-row ${bad ? "is-bad" : own.length ? "is-warn" : ""}`} data-item={it.id} data-focus={focusItem === it.id ? "1" : undefined}
              ref={(el) => { if (el && focusItem === it.id) { el.scrollIntoView({ block: "nearest" }); el.querySelector<HTMLInputElement>("input")?.focus(); } }}>
              <span className="m8-depth" aria-hidden>{depth === 0 ? "◆" : depth === 1 ? "↳" : "·"}</span>
              <input className="m8-label" aria-label={`Label for ${name}`} value={it.label} maxLength={80}
                onChange={(e) => onChange(it.id, (x) => ({ ...x, label: e.target.value }))} />
              <select aria-label={`Link type for ${name}`} value={it.kind} className="m8-kind"
                onChange={(e) => onChange(it.id, (x) => ({ ...x, kind: e.target.value as LinkKind, target: e.target.value === "anchor" ? "#" : e.target.value === "url" ? "https://" : "/" }))}>
                <option value="page">Page</option><option value="url">Web address</option><option value="anchor">Anchor on page</option>
              </select>
              {it.kind === "page" ? (
                <select aria-label={`Page for ${name}`} value={it.target} className="m8-target-in"
                  onChange={(e) => onChange(it.id, (x) => ({ ...x, target: e.target.value }))}>
                  {!pages.some((p) => p.path === it.target) && <option value={it.target}>{it.target} (missing)</option>}
                  {pages.slice().sort((a, b) => a.path.localeCompare(b.path)).map((p) => (
                    <option key={p.id} value={p.path}>{p.path} · {p.title}{p.status === "draft" ? " (draft)" : ""}</option>
                  ))}
                </select>
              ) : (
                <input aria-label={`${it.kind === "url" ? "Address" : "Anchor"} for ${name}`} value={it.target} className="m8-target-in"
                  placeholder={it.kind === "url" ? "https://…" : "#section"} onChange={(e) => onChange(it.id, (x) => ({ ...x, target: e.target.value }))} />
              )}
              <select aria-label={`Visible to for ${name}`} value={it.audience} className="m8-aud"
                onChange={(e) => onChange(it.id, (x) => ({ ...x, audience: e.target.value as Audience }))}>
                {(Object.keys(AUD_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUD_LABEL[a]}</option>)}
              </select>
              {depth === 0 && (
                <label className="m8-mega" title="Open a mega menu with columns on hover, focus or tap">
                  <input type="checkbox" checked={it.mega} onChange={(e) => onChange(it.id, (x) => ({ ...x, mega: e.target.checked }))} />
                  <span>Mega</span>
                </label>
              )}
              {own.length > 0 && <span className="m8-badge" style={bad ? undefined : { background: AMBER.bg, color: AMBER.ink }}>{own.length}</span>}
              <span className="m8-acts">
                <button aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => onMove(it.id, -1)}><Icon name="chevUp" size={12} /></button>
                <button aria-label={`Move ${name} down`} disabled={i === items.length - 1} onClick={() => onMove(it.id, 1)}><Icon name="chevDown" size={12} /></button>
                <button aria-label={`Add a link under ${name}`} disabled={depth + 1 >= MENU_LIMITS.maxDepth} onClick={() => onAdd(it.id)}
                  title={depth + 1 >= MENU_LIMITS.maxDepth ? `Menus allow ${MENU_LIMITS.maxDepth} levels` : "Add a link under this one"}><Icon name="plus" size={12} /></button>
                <button aria-label={`Remove ${name}`} className="is-danger" onClick={() => onDelete(it.id)}><Icon name="x" size={12} /></button>
              </span>
            </div>
            {it.children.length > 0 && (
              <Rows items={it.children} depth={depth + 1} pages={pages} issues={issues} focusItem={focusItem}
                onChange={onChange} onMove={onMove} onDelete={onDelete} onAdd={onAdd} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Preview({ menu }: { menu: Menu }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = menu.items.filter((i) => i.audience !== "hidden");
  if (top.length === 0) return <p className="m8-note">Nothing to show. Add a link.</p>;
  if (menu.location === "footer") {
    return (
      <div className="m8-prev-foot">
        {top.map((c) => (
          <div key={c.id}><b>{c.label || "(no label)"}</b>{c.children.filter((x) => x.audience !== "hidden").map((x) => <span key={x.id}>{x.label || "(no label)"}</span>)}</div>
        ))}
      </div>
    );
  }
  return (
    <div className="m8-prev">
      <div className="m8-prev-bar" aria-label="Desktop navigation preview">
        {top.map((it) => (
          <div key={it.id} className="m8-prev-top" onMouseEnter={() => setOpen(it.mega || it.children.length ? it.id : null)} onMouseLeave={() => setOpen(null)}>
            <button type="button" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)} disabled={it.children.length === 0}>
              {it.label || "(no label)"}{it.children.length > 0 && <Icon name="chevDown" size={10} />}
            </button>
            {open === it.id && it.children.length > 0 && (
              <div className={`m8-prev-panel ${it.mega ? "is-mega" : ""}`}>
                {it.children.map((c) => (
                  <div key={c.id}><b>{c.label || "(no label)"}</b>{c.children.map((x) => <span key={x.id}>{x.label || "(no label)"}</span>)}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="m8-prev-mobile" aria-label={`Mobile ${menu.mobile.behaviour} preview`}>
        <span className="m8-prev-tag">Mobile · {menu.mobile.behaviour}</span>
        {top.map((it) => (
          <details key={it.id} open={menu.mobile.openFirstLevel || undefined} className={menu.mobile.behaviour === "drawer" ? "is-drawer" : ""}>
            <summary>{it.label || "(no label)"}</summary>
            {it.children.map((c) => <div key={c.id} className="m8-prev-sub"><b>{c.label || "(no label)"}</b>{c.children.map((x) => <span key={x.id}>{x.label || "(no label)"}</span>)}</div>)}
          </details>
        ))}
      </div>
    </div>
  );
}

function NewMenuModal({ siteId, onClose, onCreated }: { siteId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const app = useApp();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState<Location>("custom");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const m = await MenusAPI.create(siteId, name, loc);
      app.toast({ type: "success", title: `${m.name} created`, sub: "Add links, then save." });
      onCreated(m.id);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title="New menu" sub="A menu is a named list of links. Choose where it will be applied." icon="menu" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="plus" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>Create menu</Btn></>}>
      <Field label="Name" error={err || undefined}>
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Menu name" placeholder="e.g. Study abroad menu" />
      </Field>
      <Field label="Used for" hint="Header and footer menus can be applied to the shared chrome. A custom menu is kept for reference.">
        <select value={loc} onChange={(e) => setLoc(e.target.value as Location)} aria-label="Used for">
          <option value="custom">Custom (not applied)</option>
          <option value="header">Header</option>
          <option value="footer">Footer</option>
        </select>
      </Field>
    </Modal>
  );
}

