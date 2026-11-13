import { useMemo, useState } from "react";
import { useApp } from "../../lib/store";
import { Icon } from "../Icon";
import { Btn, Pill } from "../ui";
import { THUMB_IMG } from "../../lib/thumbs";
import type { Domain } from "../../lib/data";

/* ---------------------------------------------------------------- labels */

export const DNS_LABEL: Record<string, string> = { verified: "Verified", pending: "Pending", failed: "Failed" };
export const SSL_LABEL: Record<string, string> = { active: "Active", provisioning: "Pending", failed: "Failed", expiring: "Renewing" };
export const DNS_TONE: Record<string, "green" | "amber" | "red"> = { verified: "green", pending: "amber", failed: "red" };
export const SSL_TONE: Record<string, "green" | "amber" | "red"> = { active: "green", provisioning: "amber", failed: "red", expiring: "amber" };

export function siteAliases(domains: Domain[], siteId: string) {
  return domains.filter((d) => d.siteId === siteId && !d.primary);
}
export function sitePrimary(domains: Domain[], siteId: string) {
  return domains.find((d) => d.siteId === siteId && d.primary) ?? domains.find((d) => d.siteId === siteId);
}

/* ------------------------------------------------------------ stepper data */

type StepStatus = "done" | "active" | "pending" | "failed";
interface Step { title: string; sub: string; status: StepStatus; when: string }

function verificationSteps(d?: Domain): Step[] {
  if (!d) return [];
  const dnsOk = d.dns === "verified";
  const dnsBad = d.dns === "failed";
  const tlsOk = d.ssl === "active";
  const tlsBusy = d.ssl === "provisioning";
  const tlsBad = d.ssl === "failed";
  return [
    {
      title: "TXT/CNAME record added",
      sub: dnsOk ? "DNS verification record found in your domain."
        : dnsBad ? d.error ?? "The resolver could not find the expected record."
          : "Add the records below at your DNS provider.",
      status: dnsOk ? "done" : dnsBad ? "failed" : "pending",
      when: dnsOk ? d.verifiedAt ?? d.lastChecked : dnsBad ? d.lastChecked : "—"
    },
    {
      title: "Propagation check",
      sub: dnsOk ? "DNS changes detected and propagating globally." : "Waiting for nameservers to publish the new records.",
      status: dnsOk ? "done" : dnsBad ? "failed" : "pending",
      when: dnsOk ? d.lastChecked : dnsBad ? "—" : "—"
    },
    {
      title: "Certificate provisioning",
      sub: !dnsOk
        ? (dnsBad ? "Certificate is held until DNS verification passes." : "Starts automatically once DNS verification passes.")
        : tlsOk ? `Issued by ${d.sslIssuer ?? "the platform CA"}.`
          : tlsBad ? "The certificate authority rejected the request."
            : "Requesting SSL certificate from certificate authority.",
      status: tlsOk && dnsOk ? "done" : tlsBad ? "failed" : tlsBusy && dnsOk ? "active" : "pending",
      when: tlsOk ? d.sslExpires ?? "now" : tlsBad || (tlsBusy && dnsOk) ? "now" : "—"
    },
    {
      title: "HTTPS validation",
      sub: tlsOk && dnsOk ? "HTTPS is enforced on this hostname." : "Final validation to activate HTTPS on your domain.",
      status: tlsOk && dnsOk ? "done" : "pending",
      when: tlsOk && dnsOk ? d.lastChecked : "—"
    }
  ];
}

interface Event { icon: string; title: string; when: string }

function verificationEvents(domains: Domain[]): Event[] {
  const out: Event[] = [];
  domains.forEach((d) => {
    if (d.dns === "verified") {
      out.push({ icon: "check", title: `DNS check passed · ${d.hostname}`, when: d.verifiedAt ?? d.lastChecked });
      out.push({ icon: "file", title: "TXT record detected", when: d.lastChecked });
    } else {
      out.push({ icon: "clock", title: `DNS check started · ${d.hostname}`, when: d.lastChecked });
    }
    if (d.ssl === "active") out.push({ icon: "lock", title: "Certificate active", when: d.lastChecked });
    else if (d.ssl === "provisioning") out.push({ icon: "sparkles", title: "SSL provisioning in progress", when: "now" });
    else if (d.ssl === "failed") out.push({ icon: "alert", title: "Certificate request failed", when: d.lastChecked });
  });
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ panel */

export type DetailsTab = "overview" | "dns" | "ssl";

export function DomainDetails({ siteId, tab: controlled, onTabChange }: {
  siteId: string; tab?: DetailsTab; onTabChange?: (t: DetailsTab) => void;
}) {
  const app = useApp();
  const [localTab, setLocalTab] = useState<DetailsTab>("overview");
  const tab = controlled ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [busy, setBusy] = useState<string | null>(null);

  const data = app.data;
  const site = data?.sites.find((s) => s.id === siteId);
  const domains = useMemo(() => (data?.domains ?? []).filter((d) => d.siteId === siteId), [data, siteId]);
  const primary = sitePrimary(domains, siteId);
  const aliases = siteAliases(domains, siteId);
  const steps = verificationSteps(primary);
  const events = verificationEvents(domains);
  const readOnly = !app.can("domain");

  const copy = (text: string, label: string) => {
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(() => {});
    app.toast({ type: "success", title: `${label} copied`, sub: text });
  };

  const verify = async (d: Domain) => {
    setBusy(d.id);
    await app.verifyRecord(d.siteId, d.id);
    setBusy(null);
  };

  if (!site) return <div className="d2-panel-empty">Select a website to see its domains.</div>;

  return (
    <div className="d2-insp">
      <div className="d2-insp-head">
        <span className="d2-insp-ico"><Icon name="server" size={13} /></span>
        <span className="grow">Domain Details</span>
        <button className="st-copy" aria-label="Copy site host" title="Copy primary hostname"
          onClick={() => copy(primary?.hostname ?? site.host, "Hostname")}><Icon name="copy" size={11} /></button>
      </div>

      <div className="d2-insp-site">
        <div className="d2-insp-thumb">
          <img src={THUMB_IMG[site.thumb] ?? THUMB_IMG.main} alt="" />
        </div>
        <div style={{ minWidth: 0 }} className="grow">
          <div className="d2-insp-name">{site.name}</div>
          {primary ? (
            <a className="d2-insp-host" href={`https://${primary.hostname}`} target="_blank" rel="noreferrer"
              onClick={(e) => { e.preventDefault(); app.toast({ type: "info", title: "Opening site", sub: primary.hostname }); }}>
              {primary.hostname} <Icon name="external" size={10} />
            </a>
          ) : (
            <span className="d2-insp-host">No hostname connected</span>
          )}
        </div>
        <div className="d2-insp-pills">
          {primary ? (
            <>
              <Pill tone={DNS_TONE[primary.dns]} dot>DNS {DNS_LABEL[primary.dns]}</Pill>
              <Pill tone={SSL_TONE[primary.ssl]} dot>SSL {SSL_LABEL[primary.ssl]}</Pill>
            </>
          ) : <Pill tone="grey" dot>Not connected</Pill>}
        </div>
      </div>

      <div className="d2-meta">
        <div className="d2-meta-cell">
          <span className="d2-meta-k"><Icon name="target" size={10} /> Primary Domain</span>
          <span className="d2-meta-v mono truncate">{primary?.hostname ?? "Not connected"}</span>
        </div>
        <div className="d2-meta-cell">
          <span className="d2-meta-k"><Icon name="layers" size={10} /> Aliases</span>
          <span className="d2-meta-v truncate">
            {aliases.length ? `+${aliases.length} (${aliases[0].hostname})` : "No alias"}
          </span>
        </div>
        <div className="d2-meta-cell">
          <span className="d2-meta-k"><Icon name="rocket" size={10} /> Latest Release</span>
          <span className="d2-meta-v truncate">{site.release ?? "Draft"}</span>
        </div>
      </div>

      <div className="d2-tabs" role="tablist" aria-label="Domain details tabs">
        {([["overview", "Overview"], ["dns", "DNS Records"], ["ssl", "SSL Certificate"]] as [typeof tab, string][])
          .map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`d2-tab ${tab === id ? "is-active" : ""}`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
      </div>

      {tab === "overview" && (
        <div className="d2-tabbody">
          <ol className="d2-steps">
            {steps.map((s, i) => (
              <li key={i} className={`d2-step ${s.status}`}>
                <span className="d2-step-mark">
                  {s.status === "done" ? <Icon name="check" size={10} />
                    : s.status === "active" ? <span className="d2-step-pulse" />
                      : s.status === "failed" ? <Icon name="x" size={10} />
                        : null}
                </span>
                <span className="d2-step-body">
                  <span className="d2-step-title">{s.title}</span>
                  <span className="d2-step-sub">{s.sub}</span>
                </span>
                <span className="d2-step-right">
                  <span className={`d2-step-pill ${s.status}`}>
                    {s.status === "done" ? "Completed" : s.status === "active" ? "In Progress" : s.status === "failed" ? "Failed" : "Pending"}
                  </span>
                  <span className="d2-step-when">{s.when}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="d2-insp-actions">
            <Btn icon="refresh" disabled={readOnly || !primary || busy === primary.id}
              onClick={() => primary && void verify(primary)}>
              {busy && primary && busy === primary.id ? "Checking…" : "Verify Again"}
            </Btn>
            <Btn icon="external" onClick={() => app.openModal({ kind: "domain-settings", siteId })}>Open Domain Settings</Btn>
          </div>

          <section className="d2-subcard">
            <div className="d2-subhead">
              <span className="d2-subtitle"><Icon name="server" size={11} /> DNS Records</span>
              <button className="link f11" onClick={() => setTab("dns")}>View All <Icon name="arrowRight" size={9} /></button>
            </div>
            <table className="d2-mini-tbl">
              <thead><tr><th>Host</th><th>Type</th><th>Expected Value</th><th>Status</th></tr></thead>
              <tbody>
                {(primary?.records ?? []).slice(0, 3).map((r) => (
                  <tr key={r.type + r.name}>
                    <td className="mono truncate" title={r.name}>{r.name.split(".")[0]}</td>
                    <td className="mono">{r.type}</td>
                    <td className="mono truncate" title={r.value}>{r.value}</td>
                    <td>
                      {r.status === "ok"
                        ? <Pill tone="green"><Icon name="check" size={8} /> Verified</Pill>
                        : <Pill tone="amber"><Icon name="clock" size={8} /> Pending</Pill>}
                    </td>
                  </tr>
                ))}
                {!primary?.records.length && <tr><td colSpan={4} className="d2-td-empty">No records yet — add a domain first.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="d2-subcard">
            <div className="d2-subhead">
              <span className="d2-subtitle"><Icon name="activity" size={11} /> Recent Verification Activity</span>
              <button className="link f11" onClick={() => app.openDrawer({ kind: "activity" })}>All</button>
            </div>
            <div className="d2-events">
              {events.map((e, i) => (
                <div key={i} className="d2-event">
                  <span className={`d2-event-dot ${e.icon === "alert" ? "bad" : e.icon === "clock" || e.icon === "sparkles" ? "wait" : "ok"}`} />
                  <span className="d2-event-title truncate">{e.title}</span>
                  <span className="d2-event-when">{e.when}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "dns" && (
        <div className="d2-tabbody">
          {!domains.length && (
            <div className="d2-tab-empty">
              <Icon name="link" size={15} />
              <div>
                <div className="w650 f12">No hostname connected</div>
                <div className="f11 muted">Connect a domain to get the DNS records for this website.</div>
              </div>
              <Btn className="btn-sm" icon="plus" disabled={readOnly} onClick={() => app.openModal({ kind: "connect-domain", siteId })}>Connect Domain</Btn>
            </div>
          )}
          {domains.map((d) => (
            <section key={d.id} className="d2-subcard">
              <div className="d2-subhead">
                <span className="d2-subtitle mono truncate">{d.hostname}</span>
                <Pill tone={DNS_TONE[d.dns]} dot>{DNS_LABEL[d.dns]}</Pill>
              </div>
              <table className="d2-mini-tbl">
                <thead><tr><th>Type</th><th>Host</th><th>Expected Value</th><th>TTL</th><th /></tr></thead>
                <tbody>
                  {d.records.map((r) => (
                    <tr key={r.type + r.name + r.value}>
                      <td className="mono">{r.type}</td>
                      <td className="mono truncate" title={r.name}>{r.name}</td>
                      <td className="mono truncate" title={r.value}>{r.value}</td>
                      <td className="mono">{r.ttl}</td>
                      <td>
                        <button className="st-copy" title="Copy value" aria-label={`Copy ${r.type} value`}
                          onClick={() => copy(r.value, `${r.type} value`)}><Icon name="copy" size={10} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.error && <div className="st-domain-error"><Icon name="alert" size={11} /> {d.error}</div>}
              <div className="d2-insp-actions">
                <Btn icon="refresh" disabled={readOnly || d.dns === "verified" || busy === d.id}
                  onClick={() => void verify(d)}>{busy === d.id ? "Checking…" : "Verify DNS"}</Btn>
                <Btn icon="copy" onClick={() => copy(d.records.map((r) => `${r.name}\t${r.ttl}\tIN\t${r.type}\t${r.value}`).join("\n"), `${d.hostname} records`)}>Copy all</Btn>
              </div>
            </section>
          ))}
          <p className="d2-note">Records are published at your DNS provider. Verification is re-checked automatically; a spinner never counts as success.</p>
        </div>
      )}

      {tab === "ssl" && (
        <div className="d2-tabbody">
          {domains.map((d) => (
            <section key={d.id} className="d2-subcard">
              <div className="d2-subhead">
                <span className="d2-subtitle mono truncate">{d.hostname}</span>
                <Pill tone={SSL_TONE[d.ssl]} dot>{SSL_LABEL[d.ssl]}</Pill>
              </div>
              <div className="d2-kv"><span>Issuer</span><b>{d.sslIssuer ?? "not issued yet"}</b></div>
              <div className="d2-kv"><span>Expires</span><b>{d.sslExpires ?? "—"}</b></div>
              <div className="d2-kv"><span>Force HTTPS</span><b>{d.forceHttps ? "on" : "off"}</b></div>
              <div className="d2-kv"><span>HSTS</span><b>{d.hsts ? "1 year · includeSubDomains" : "off"}</b></div>
              <div className="d2-insp-actions">
                <Btn icon="lock" disabled={readOnly || d.dns !== "verified" || busy === d.id}
                  onClick={async () => { setBusy(d.id); await app.provisionRecord(d.siteId, d.id); setBusy(null); }}>
                  {d.ssl === "active" ? "Re-issue" : "Issue certificate"}
                </Btn>
                <Btn icon="shield" onClick={() => app.openModal({ kind: "domain-settings", siteId })}>Behaviour</Btn>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
