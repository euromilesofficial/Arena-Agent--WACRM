import { useState } from "react";
import { useApp } from "../../lib/store";
import { Icon } from "../Icon";
import { Btn, Modal, Pill } from "../ui";
import { DNS_LABEL, DNS_TONE, SSL_LABEL, SSL_TONE } from "./DomainDetails";

/** Domain settings destination: every hostname on one site, with the guarded
 *  actions (make primary, remove) and the edge behaviour switches. */
export function DomainSettings({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const app = useApp();
  const site = app.data?.sites.find((s) => s.id === siteId);
  const domains = (app.data?.domains ?? []).filter((d) => d.siteId === siteId);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; mode: "primary" | "remove" } | null>(null);
  const readOnly = !app.can("domain");

  const run = async (fn: () => Promise<{ ok: boolean }>) => {
    setBusy("x");
    await fn();
    setBusy(null);
    setConfirm(null);
  };

  if (!site) return null;

  return (
    <Modal title="Domain settings" sub={`${site.name} · ${domains.length} hostname${domains.length === 1 ? "" : "s"}`}
      icon="settings" width="wide" onClose={onClose}
      footer={<><Btn onClick={onClose}>Close</Btn>
        <Btn variant="primary" icon="plus" disabled={readOnly} onClick={() => { onClose(); app.openModal({ kind: "connect-domain", siteId }); }}>Add domain</Btn></>}>

      {!confirm && domains.map((d) => (
        <div key={d.id} className="ds-card">
          <div className="ds-top">
            <span className="mono f12 w650 truncate grow">{d.hostname}</span>
            {d.primary && <Pill tone="violet">Primary</Pill>}
            <Pill tone={DNS_TONE[d.dns]} dot>{DNS_LABEL[d.dns]}</Pill>
            <Pill tone={SSL_TONE[d.ssl]} dot>{SSL_LABEL[d.ssl]}</Pill>
          </div>
          <div className="ds-sub">Added {d.addedAt} · last checked {d.lastChecked}{d.sslExpires ? ` · cert expires ${d.sslExpires}` : ""}</div>
          {d.error && <div className="st-domain-error"><Icon name="alert" size={11} /> {d.error}</div>}

          <div className="ds-actions">
            <Btn className="btn-sm" icon="refresh" disabled={readOnly || d.dns === "verified" || busy === d.id}
              onClick={() => { setBusy(d.id); void app.verifyRecord(siteId, d.id).then(() => setBusy(null)); }}>Verify DNS</Btn>
            <Btn className="btn-sm" icon="target" disabled={readOnly || d.primary || d.dns !== "verified"}
              onClick={() => setConfirm({ id: d.id, mode: "primary" })}>Make primary</Btn>
            <button className="link f11" disabled={readOnly || (d.primary && domains.length === 1)}
              onClick={() => setConfirm({ id: d.id, mode: "remove" })}>Remove</button>
          </div>

          <div className="ds-switches">
            {([["forceHttps", "Force HTTPS"], ["redirectWww", "www → apex"], ["hsts", "HSTS"]] as ["forceHttps" | "redirectWww" | "hsts", string][]).map(([key, label]) => (
              <button key={key} className={`st-switch ${d[key] ? "on" : ""}`} aria-pressed={d[key]}
                disabled={readOnly || d.dns !== "verified"} title={d.dns !== "verified" ? "Verify DNS first" : label}
                onClick={() => void app.setDomainOption(d.id, key, !d[key])}>
                <span className="st-switch-dot" />{label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {confirm && (() => {
        const d = domains.find((x) => x.id === confirm.id)!;
        const primary = confirm.mode === "primary";
        return (
          <div className="ds-confirm">
            <div className="ds-confirm-title">{primary ? "Make this the primary domain?" : "Remove this domain?"}</div>
            <p className="ds-confirm-body">
              {primary
                ? <>The primary address for <b>{site.name}</b> will change to <b className="mono">{d.hostname}</b>. Canonical links, sitemaps and redirect targets are rewritten in the next release.</>
                : <><b className="mono">{d.hostname}</b> stops resolving to {site.name} and its certificate is released. {domains.length === 1 ? "A site needs at least one hostname, so this is blocked." : "Traffic to this hostname will 404."}</>}
            </p>
            <div className="ds-confirm-actions">
              <Btn className="btn-sm" onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn className="btn-sm" variant={primary ? "primary" : "danger"} disabled={busy === "x" || (!primary && domains.length === 1)}
                onClick={() => void run(() => primary ? app.makePrimary(siteId, d.id) : app.removeDomain(siteId, d.id))}>
                {primary ? "Make primary" : "Remove domain"}
              </Btn>
            </div>
          </div>
        );
      })()}

      <p className="d2-note">Removing or re-pointing a hostname is a guarded change — the previous primary is kept until the new one verifies.</p>
    </Modal>
  );
}
