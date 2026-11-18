/* ============================================================
   Modal host — publishing, site lifecycle, domain, goals, preview
   ============================================================ */
import { useState } from "react";
import { Icon } from "../Icon";
import { Btn, Field, Modal, Pill, Switch } from "../ui";
import { useApp, useDash } from "@/lib/store";
import { releaseMenuIssues } from "@/lib/menu-db";
import { Wizard } from "./Wizard";
import { ConnectDomain } from "../sites/ConnectDomain";
import { DomainSettings } from "../sites/DomainSettings";

export function ModalHost() {
  const app = useApp();
  const d = useDash();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [value, setValue] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [goals, setGoals] = useState({ leads: 40, bookings: 10 });
  const [publishState, setPublishState] = useState<"idle" | "running" | "done">("idle");
  const state = app.modal;
  if (state.kind === "none" || !d) return null;

  const site = "siteId" in state ? d.sites.find((s) => s.id === state.siteId) : undefined;

  if (state.kind === "wizard") return <Wizard />;
  if (state.kind === "connect-domain") return <ConnectDomain siteId={state.siteId} onClose={app.closeModal} />;
  if (state.kind === "domain-settings") return <DomainSettings siteId={state.siteId} onClose={app.closeModal} />;

  if (state.kind === "preflight") {
    /* Three steps, matching the publish contract: choose what ships →
       freeze the manifest (preflight runs) → result. */
    const changed = d.pages.filter((p) => p.status !== "published").slice(0, 4);
    const picked = changed.filter((p) => checked[p.id] !== false);
    const step = publishState === "running" ? 2 : 0;

    const menuIssues = releaseMenuIssues(app.siteId === "all" ? "site_main" : app.siteId);
    const checks: [string, boolean][] = [
      ["DNS verified for all sites", true],
      ["SSL certificates active", true],
      ["No broken menu references", menuIssues.length === 0],
      [`${picked.length} of ${changed.length} changed pages included`, picked.length > 0],
      ["Core Web Vitals within budget", true]
    ];

    if (step === 0) {
      return (
        <Modal title="Publish release" sub="Step 1 of 3 · choose the changes to ship" icon="upload" width="narrow" onClose={app.closeModal}
          footer={<>
            <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
            <span className="grow" />
            <Btn variant="primary" disabled={!picked.length || menuIssues.length > 0} onClick={() => setPublishState("running")}>
              Freeze manifest · {picked.length} page{picked.length === 1 ? "" : "s"} <Icon name="arrowRight" size={12} />
            </Btn>
          </>}>
          <div className="dr-table">
            {changed.map((p) => (
              <label key={p.id} className="dr-row" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={checked[p.id] !== false} aria-label={`Include ${p.title}`}
                  onChange={(e) => setChecked((c) => ({ ...c, [p.id]: e.target.checked }))} />
                <Icon name="file" size={12} />
                <span className="grow truncate">{p.title}</span>
                <Pill tone={p.status === "published" ? "green" : "amber"}>{p.status}</Pill>
              </label>
            ))}
            {!changed.length && <div className="f12 muted" style={{ padding: 12 }}>No changed pages — nothing to publish.</div>}
          </div>
          <p className="dr-p mt10">Unselected pages keep serving their last published revision. Nothing is deleted.</p>
        </Modal>
      );
    }

    return (
      <Modal title="Publish release" sub={`Step 2 of 3 · preflight for ${picked.length} page${picked.length === 1 ? "" : "s"}`} icon="upload" width="narrow" onClose={() => setPublishState("idle")}
        footer={<>
          <Btn variant="ghost" onClick={() => setPublishState("idle")}>Back</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={busy} onClick={async () => {
            setBusy(true);
            const res = await app.publishRelease();
            setBusy(false);
            setPublishState("idle");
            if (res.ok) app.openModal({ kind: "published", version: res.version ?? "v1.25", site: "EuroMiles Main" });
          }}>Publish {d.publishing.live === "v1.24" ? "v1.25" : "release"}</Btn>
        </>}>
        {menuIssues.length > 0 && <div className="m8-banner is-warn" role="alert"><Icon name="alert" size={13} /><span><b>Publishing is blocked.</b> Fix these menu references in Menus &amp; Navigation first.<ul>{menuIssues.map((i) => <li key={i.id}>{i.detail}</li>)}</ul></span></div>}
        <div className="dr-table">
          {checks.map(([label, ok]) => (
            <div key={label} className="dr-row">
              <span className={`pill ${ok ? "pill-green" : "pill-amber"}`}><Icon name={ok ? "check" : "alert"} size={9} /> {ok ? "pass" : "check"}</span>
              <span className="grow f12">{label}</span>
            </div>
          ))}
        </div>
        <Field label="Release notes">
          <textarea className="input" rows={3} defaultValue="Homepage hero refresh, scholarship guide fixes, IMAT copy edits." />
        </Field>
        <p className="dr-p mt10">Publishing uses compare-and-swap: if a newer release lands while this one is in flight, you will be asked to rebase instead of overwriting.</p>
      </Modal>
    );
  }

  if (state.kind === "conflict") {
    return (
      <Modal title="Publish conflict detected" sub="Release v1.25 was created by Anita N. while you were editing" icon="alert" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn onClick={() => { app.closeModal(); app.toast({ type: "info", title: "Latest release loaded", sub: "Your changes were kept as a draft." }); }}>Reload latest</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.closeModal(); app.toast({ type: "success", title: "Rebased over concurrent release", sub: "Your changes published as v1.26." }); }}>Rebase &amp; publish</Btn>
        </>}>
        <div className="dr-table">
          <div className="dr-row"><Icon name="file" size={12} /><span className="grow f12">Homepage hero</span><Pill tone="amber">both edited</Pill></div>
          <div className="dr-row"><Icon name="file" size={12} /><span className="grow f12">Scholarship guide</span><Pill tone="violet">only you</Pill></div>
          <div className="dr-row"><Icon name="file" size={12} /><span className="grow f12">Main navigation</span><Pill tone="blue">only Anita</Pill></div>
        </div>
        <p className="dr-p mt10">Rebasing re-applies your diffs on top of v1.25. Nothing is silently overwritten.</p>
      </Modal>
    );
  }

  if (state.kind === "published") {
    return (
      <Modal title={`Release ${state.version} is live`} sub={`${state.site} · euromiles.in`} icon="rocket" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn onClick={() => { app.closeModal(); app.toast({ type: "info", title: "Opening release history" }); }}>View history</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={app.closeModal}>Done</Btn>
        </>}>
        <div className="publish-done">
          <div className="publish-ring"><Icon name="check" size={22} /></div>
          <div className="f13 w650">48 pages updated</div>
          <div className="f12 muted">Cache purged · CDN propagating · zero downtime</div>
        </div>
        <div className="dr-table mt12">
          {[["Pages published", "48"], ["Redirects created", "3"], ["Assets versioned", "112"]].map(([k, v]) => (
            <div key={k} className="dr-row"><span className="grow f12">{k}</span><b className="f12 num">{v}</b></div>
          ))}
        </div>
      </Modal>
    );
  }

  if (state.kind === "domain" && site) {
    return (
      <Modal title="Domain settings" sub={site.host} icon="globe" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Close</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={busy} onClick={async () => {
            setBusy(true);
            const res = await app.verifyDomain(site.id);
            setBusy(false);
            app.toast(res === "resolved"
              ? { type: "success", title: "Domain verified", sub: `${site.host} — DNS verified, SSL active.` }
              : { type: "warn", title: "DNS verified · SSL provisioning", sub: "Certificate issuance can take a couple of minutes." });
          }}>Verify domain</Btn>
        </>}>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">DNS</span><Pill tone={site.dns === "verified" ? "green" : "amber"}>{site.dns}</Pill></div>
          <div className="dr-stat"><span className="f11 muted">SSL</span><Pill tone={site.ssl === "active" ? "green" : "amber"}>{site.ssl}</Pill></div>
        </div>
        <div className="dr-section">Records</div>
        <div className="dr-table">
          <div className="dr-row"><span className="pill pill-grey mono">A</span><span className="grow mono f11">{site.host}</span><span className="f11 muted">76.76.21.21</span></div>
          <div className="dr-row"><span className="pill pill-grey mono">TXT</span><span className="grow mono f11">_wacrm-verify.{site.host}</span><span className="f11 muted">verify</span></div>
          <div className="dr-row"><span className="pill pill-grey mono">CNAME</span><span className="grow mono f11">www.{site.host}</span><span className="f11 muted">edge.wacrm.site</span></div>
        </div>
        <div className="dr-section">Options</div>
        <div className="dr-row"><span className="grow f12">Force HTTPS</span><Switch checked onChange={() => {}} label="Force HTTPS" /></div>
        <div className="dr-row"><span className="grow f12">HSTS preload</span><Switch checked={false} onChange={() => {}} label="HSTS preload" /></div>
      </Modal>
    );
  }

  if (state.kind === "rename" && site) {
    return (
      <Modal title="Rename website" sub={site.host} icon="pencil" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={busy} onClick={async () => {
            if (!value.trim()) { app.toast({ type: "error", title: "A website name is required." }); return; }
            setBusy(true);
            await app.renameSite(site.id, value);
            setBusy(false);
            app.closeModal();
            app.toast({ type: "success", title: "Website renamed", sub: value });
          }}>Save</Btn>
        </>}>
        <Field label="Website name">
          <input className="input" autoFocus defaultValue={site.name} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <p className="dr-p mt10">The hostname does not change when you rename a website.</p>
      </Modal>
    );
  }

  if (state.kind === "duplicate" && site) {
    return (
      <Modal title="Duplicate website" sub={`${site.name} → ${site.name} (copy)`} icon="copy" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={busy} onClick={async () => { setBusy(true); await app.duplicateSite(site.id); setBusy(false); app.closeModal(); }}>Duplicate</Btn>
        </>}>
        <div className="dr-table">
          {[["Pages cloned", `${site.pages}`], ["Forms copied", "4"], ["Assets referenced", "86 (shared)"]].map(([k, v]) => (
            <div key={k} className="dr-row"><span className="grow f12">{k}</span><b className="f12">{v}</b></div>
          ))}
        </div>
        <p className="dr-p mt10">Internal IDs are remapped; analytics start empty and the copy is created as a draft.</p>
      </Modal>
    );
  }

  if (state.kind === "archive" && site) {
    return (
      <Modal title="Archive website" sub={site.name} icon="archive" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={busy} onClick={async () => { setBusy(true); await app.archiveSite(site.id); setBusy(false); app.closeModal(); app.toast({ type: "info", title: "Website archived", sub: `${site.name} can be restored later.` }); }}>Archive</Btn>
        </>}>
        <p className="dr-p">Archiving unpublishes public routes and pauses form collection. Content, domains and history are kept, and the site can be restored at any time.</p>
      </Modal>
    );
  }

  if (state.kind === "delete" && site) {
    return (
      <Modal title="Delete website" sub={`${site.name} · this cannot be undone`} icon="alert" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="danger" disabled={confirmText !== site.name} loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await app.deleteSite(site.id);
              app.closeModal();
              app.toast({ type: "success", title: "Website deleted", sub: `${site.name} and its pages were removed.` });
            } catch (e) {
              setBusy(false);
              app.toast({ type: "error", title: "Delete blocked", sub: (e as Error).message });
            }
          }}>Delete permanently</Btn>
        </>}>
        <Field label={`Type “${site.name}” to confirm`}>
          <input className="input" autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={site.name} />
        </Field>
        <p className="dr-p mt10">A published website must be archived before deletion. Pages, forms and redirects are removed with it.</p>
      </Modal>
    );
  }

  if (state.kind === "preview" && site) {
    return (
      <Modal title={`Preview · ${site.name}`} sub={site.host} icon="eye" width="wide" onClose={app.closeModal}
        footer={<>
          <Btn icon="external" onClick={() => app.toast({ type: "info", title: "Opening live site", sub: site.host })}>Open live</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={app.closeModal}>Close preview</Btn>
        </>}>
        <div className="preview-frame">
          <div className="preview-bar">
            <span className="pv-dot" /><span className="pv-dot" /><span className="pv-dot" />
            <span className="pv-url mono">{site.host}</span>
            <Pill tone={site.status === "published" ? "green" : "amber"}>{site.status}</Pill>
          </div>
          <div className="preview-canvas">
            <div className="pv-hero">
              <div className="pv-nav"><b>EuroMiles</b><span>Study abroad</span><span>Scholarships</span><span>Contact</span></div>
              <div className="pv-h1">Study in Italy with expert counselling</div>
              <div className="pv-p">End-to-end guidance for admissions, scholarships and visas.</div>
              <div className="pv-cta">Book a free consultation</div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (state.kind === "goals") {
    return (
      <Modal title="Edit targets" sub="Monthly goals" icon="target" width="narrow" onClose={app.closeModal}
        footer={<>
          <Btn variant="ghost" onClick={app.closeModal}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.closeModal(); app.toast({ type: "success", title: "Targets updated", sub: `${goals.leads} leads · ${goals.bookings} bookings` }); }}>Save targets</Btn>
        </>}>
        <div className="wiz-two">
          <Field label="Qualified leads"><input className="input" type="number" defaultValue={40} onChange={(e) => setGoals((g) => ({ ...g, leads: Number(e.target.value) }))} /></Field>
          <Field label="Counselling bookings"><input className="input" type="number" defaultValue={10} onChange={(e) => setGoals((g) => ({ ...g, bookings: Number(e.target.value) }))} /></Field>
        </div>
      </Modal>
    );
  }

  if (state.kind === "publish-queue") {
    const rows = d.pages.slice(0, state.which === "drafts" ? 4 : 2);
    return (
      <Modal title={state.which === "drafts" ? "Drafts in flight" : "Ready to publish"} sub="Publishing & releases" icon="file" onClose={app.closeModal}
        footer={<>
          <Btn onClick={app.closeModal}>Close</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.closeModal(); app.openModal({ kind: "preflight" }); }}>Continue to preflight</Btn>
        </>}>
        <div className="dr-table">
          {rows.map((p) => (
            <div key={p.id} className="dr-row"><Icon name="file" size={12} /><span className="grow truncate">{p.title}</span><Pill tone={state.which === "drafts" ? "amber" : "green"}>{state.which === "drafts" ? "draft" : "ready"}</Pill></div>
          ))}
        </div>
      </Modal>
    );
  }

  void checked; void setChecked; void publishState; void setPublishState;
  return null;
}
