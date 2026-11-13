/* ============================================================
   Dashboard · Your websites — the site cards and their overflow menu
   ============================================================ */
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Btn, MenuItem, Popover } from "../ui";
import { SiteThumb } from "../charts";
import { useApp, useDash } from "@/lib/store";
import type { Site } from "@/lib/data";

const SITE_PILL: Record<string, { cls: string; label: string }> = {
  published: { cls: "pill-green", label: "Published" },
  draft: { cls: "pill-grey", label: "Draft" }
};
const DNS_PILL: Record<string, { cls: string; label: string }> = {
  verified: { cls: "pill-green", label: "DNS Verified" },
  pending: { cls: "pill-amber", label: "DNS Pending" },
  failed: { cls: "pill-red", label: "DNS Failed" }
};
const SSL_PILL: Record<string, { cls: string; label: string }> = {
  active: { cls: "pill-green", label: "SSL Active" },
  provisioning: { cls: "pill-amber", label: "SSL Provisioning" },
  failed: { cls: "pill-red", label: "SSL Failed" }
};

export function Websites() {
  const app = useApp();
  const d = useDash();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const anchors = useRef<Record<string, HTMLElement | null>>({});
  const anchor = menuFor ? anchors.current[menuFor] ?? null : null;
  const sites = d?.sites ?? [];
  const archived = d?.archived ?? [];

  return (
    <section className="card d-sites" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "10px 12px 2px" }}>
        <div className="card-title nowrap"><Icon name="layers" size={14} /> Your Websites <span className="card-title-soft">({sites.length})</span></div>
        <button className="link nowrap f11" onClick={() => app.go("sites")}>View All <Icon name="arrowRight" size={10} /></button>
      </div>
      <div className="card-body" style={{ paddingTop: 4 }}>
        <div className="site-grid">
          {sites.map((s, i) => {
            const st = SITE_PILL[s.status] ?? SITE_PILL.draft;
            const dns = DNS_PILL[s.dns] ?? DNS_PILL.pending;
            const ssl = SSL_PILL[s.ssl] ?? SSL_PILL.provisioning;
            return (
              <article key={s.id} className={`site-card ${app.siteId === s.id ? "is-selected" : ""}`}
                style={{ animation: `cardIn 340ms var(--ease-out) ${i * 60}ms both` }}>
                <div className="site-main">
                  <button className="site-media" onClick={() => app.openModal({ kind: "preview", siteId: s.id })} aria-label={`Preview ${s.name}`}>
                    <SiteThumb theme={s.theme} />
                    <span className="site-media-hover"><Icon name="eye" size={13} /> Preview</span>
                  </button>
                  <div className="site-body">
                    <span className={`pill ${st.cls} site-status`}><i className="dot-s" />{st.label}</span>
                    <button className="site-name" onClick={() => { app.setSite(s.id); app.toast({ type: "info", title: `Scoped to ${s.name}`, sub: "Dashboard now reflects this website." }); }}>{s.name}</button>
                    <button className="site-host" onClick={() => app.toast({ type: "info", title: `Opening ${s.host}`, sub: "Preview runs on an isolated origin." })}>
                      <Icon name="globe" size={11} /> <span className="truncate">{s.host}</span> <Icon name="external" size={9} />
                    </button>
                    <div className="site-pills">
                      <span className={`pill ${dns.cls}`}><Icon name="check" size={9} /> {dns.label}</span>
                      <span className={`pill ${ssl.cls}`}><Icon name={s.ssl === "active" ? "lock" : "alert"} size={9} /> {ssl.label}</span>
                    </div>
                    <div className="site-stats">
                      <span><Icon name="file" size={11} /> {s.pages} Pages</span>
                      <span title={`${s.leads} leads captured by this website since launch (not limited to the selected range)`}><Icon name="users" size={11} /> {s.leads} Leads</span>
                    </div>
                  </div>
                </div>
                <div className="site-foot">
                  <Btn className="btn-sm primary-soft" onClick={() => app.openDrawer({ kind: "workspace", siteId: s.id })}><Icon name="settings" size={12} /> Manage</Btn>
                  <Btn className="btn-sm" onClick={() => { app.setSite(s.id); app.toast({ type: "info", title: `Analytics scoped to ${s.name}`, sub: "Traffic, leads, sources and conversions reloaded." }); }}><Icon name="chart" size={12} /> Analytics</Btn>
                  <button className="btn btn-sm site-more" aria-label="More actions" aria-haspopup="menu"
                    aria-expanded={menuFor === s.id}
                    ref={(el) => { anchors.current[s.id] = el; }}
                    onClick={() => setMenuFor((m) => (m === s.id ? null : s.id))}>
                    <Icon name="more" size={15} />
                  </button>
                </div>
              </article>
            );
          })}
          {!sites.length && (
            <div style={{ gridColumn: "1/-1", padding: 26, textAlign: "center", border: "1px dashed var(--line-strong)", borderRadius: 12 }}>
              <div className="mod-icon" style={{ margin: "0 auto 10px", width: 38, height: 38, borderRadius: 11 }}><Icon name="globe" size={18} /></div>
              <div className="w700 f13">No websites yet</div>
              <div className="f12 muted mt4">Create your first website to connect a domain, publish pages, and start collecting leads.</div>
              <Btn variant="primary" className="mt12" disabled={!app.can("create")} onClick={() => app.openModal({ kind: "wizard" })}><Icon name="plus" size={14} /> New Website</Btn>
            </div>
          )}
        </div>

        {archived.length > 0 && (
          <div className="mt12" style={{ borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
            <div className="flex items-c gap6">
              <span className="f11 w650 muted">Archived websites</span>
              <span className="pill pill-grey">{archived.length}</span>
            </div>
            <div className="flex gap6 mt6" style={{ flexWrap: "wrap" }}>
              {archived.map((s) => (
                <div key={s.id} className="chip">
                  <Icon name="archive" size={11} /> {s.name}
                  <button className="link" style={{ fontSize: 11, padding: "0 2px" }} onClick={() => app.restoreSite(s.id)}>Restore</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Popover anchor={anchor} open={!!menuFor} onClose={() => setMenuFor(null)}>
        <MenuItem icon="external" onClick={() => {
          const site = sites.find((x) => x.id === menuFor);
          setMenuFor(null);
          app.toast({ type: "info", title: `Opening ${site?.host ?? "site"}`, sub: "Live site opens on its verified domain." });
        }}>Open Live Website</MenuItem>
        <MenuItem icon="blocks" onClick={() => {
          const site = sites.find((x) => x.id === menuFor);
          setMenuFor(null);
          app.setSite(site?.id ?? "all");
          app.go("pages");
        }}>Edit Website</MenuItem>
        <MenuItem icon="eye" onClick={() => { setMenuFor(null); app.openModal({ kind: "preview", siteId: menuFor! }); }}>Preview Site</MenuItem>
        <div className="menu-sep" />
        <MenuItem icon="globe" disabled={!app.can("domain")} onClick={() => { const id = menuFor!; setMenuFor(null); app.openDrawer({ kind: "ssl", siteId: id }); }}>Domain Settings</MenuItem>
        <MenuItem icon="settings" onClick={() => { const id = menuFor!; setMenuFor(null); app.openDrawer({ kind: "workspace", siteId: id }); }}>Website Settings</MenuItem>
        <MenuItem icon="copy" disabled={!app.can("create")} onClick={() => { setMenuFor(null); void app.duplicateSite(menuFor!); }}>Duplicate</MenuItem>
        <MenuItem icon="pencil" disabled={!app.can("create")} onClick={() => { setMenuFor(null); app.openModal({ kind: "rename", siteId: menuFor! }); }}>Rename</MenuItem>
        <div className="menu-sep" />
        <MenuItem icon="archive" disabled={!app.can("delete")} onClick={() => { setMenuFor(null); app.openModal({ kind: "archive", siteId: menuFor! }); }}>Archive</MenuItem>
        <MenuItem icon="trash" danger disabled={!app.can("delete")} onClick={() => { setMenuFor(null); app.openModal({ kind: "delete", siteId: menuFor! }); }}>Delete</MenuItem>
      </Popover>
    </section>
  );
}

export function siteById(sites: Site[], id: string): Site | undefined {
  return sites.find((s) => s.id === id);
}
