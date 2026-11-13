import { useState } from "react";
import { useApp } from "../../lib/store";
import { Icon } from "../Icon";
import { Btn, Field, Modal, Pill } from "../ui";

/**
 * Four-step Connect Domain flow.
 * 1 choose website → 2 enter hostname → 3 publish records → 4 verify.
 * The binding is created by the API at step 2→3; the modal then reads the
 * authoritative record set back from the store instead of inventing values.
 */
export function ConnectDomain({ siteId, onClose }: { siteId?: string; onClose: () => void }) {
  const app = useApp();
  const sites = (app.data?.sites ?? []).filter((s) => !s.archived);
  const [step, setStep] = useState(siteId ? 2 : 1);
  const [chosen, setChosen] = useState<string>(siteId ?? (sites.length === 1 ? sites[0].id : ""));
  const [host, setHost] = useState("");
  const [asPrimary, setAsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verdict, setVerdict] = useState<"none" | "ok" | "fail">("none");

  const domain = (app.data?.domains ?? []).find((d) => d.id === createdId);
  const site = sites.find((s) => s.id === chosen);
  const readOnly = !app.can("domain");

  const copy = (text: string, label: string) => {
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(() => {});
    app.toast({ type: "success", title: `${label} copied`, sub: text });
  };

  const submitDomain = async () => {
    setError(null);
    const clean = host.trim().toLowerCase();
    if (!clean) { setError("Enter a hostname, for example studio.euromiles.in"); return; }
    if (!/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(clean)) {
      setError("That doesn’t look like a hostname — use a domain only, no https:// or path.");
      return;
    }
    setSaving(true);
    const res = await app.addDomain(chosen, clean);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Could not connect that domain."); return; }
    setCreatedId(res.domain?.id ?? null);
    setStep(3);
  };

  const runVerify = async () => {
    if (!domain) return;
    setVerifying(true);
    setVerdict("none");
    const res = await app.verifyRecord(domain.siteId, domain.id);
    setVerifying(false);
    setVerdict(res.ok ? "ok" : "fail");
    if (res.ok) {
      if (asPrimary) await app.makePrimary(domain.siteId, domain.id);
      setStep(4);
    }
  };

  const steps = ["Website", "Domain", "Records", "Verify"];
  const footer = (() => {
    if (step === 1) return (
      <>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!chosen} onClick={() => setStep(2)}>Next: Domain</Btn>
      </>
    );
    if (step === 2) return (
      <>
        <Btn onClick={() => (siteId ? onClose() : setStep(1))}>Back</Btn>
        <Btn variant="primary" loading={saving} disabled={readOnly} onClick={submitDomain}>Connect domain</Btn>
      </>
    );
    if (step === 3) return (
      <>
        <Btn onClick={onClose}>Close</Btn>
        <Btn variant="primary" icon="refresh" loading={verifying} disabled={readOnly || !domain} onClick={runVerify}>Verify DNS Now</Btn>
      </>
    );
    return (
      <>
        <Btn onClick={onClose}>Done</Btn>
        <Btn variant="primary" icon="external" onClick={() => { onClose(); app.go("sites"); }}>Open domain settings</Btn>
      </>
    );
  })();

  return (
    <Modal title="Connect Domain" sub="Connect a custom hostname to one of your websites." icon="link" width="wide" onClose={onClose} footer={footer}>
      <ol className="cd-steps">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < step || (n === 4 && verdict === "ok") ? "done" : n === step ? "current" : "next";
          return (
            <li key={label} className={`cd-step ${state}`}>
              <span className="cd-step-dot">{state === "done" ? <Icon name="check" size={9} /> : n}</span>
              <span className="cd-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="cd-body">
          <Field label="Website" hint="A hostname can only be attached to one website in the workspace.">
            <select className="input" value={chosen} onChange={(e) => setChosen(e.target.value)}>
              <option value="">Select a website…</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.host}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="cd-body">
          {site && <div className="cd-site"><Icon name="globe" size={12} /> {site.name} <span className="muted">· {site.host}</span></div>}
          <Field label="Domain Name" hint="Bare host only. IDNs are converted to punycode; paths and schemes are rejected." error={error ?? undefined}>
            <input className="input" autoFocus placeholder="studio.euromiles.in" value={host}
              onChange={(e) => { setHost(e.target.value); setError(null); }} />
          </Field>
          <label className="cd-check">
            <input type="checkbox" checked={asPrimary} onChange={(e) => setAsPrimary(e.target.checked)} />
            <span>Set as primary domain <span className="muted">— canonical links and sitemaps use this host.</span></span>
          </label>
        </div>
      )}

      {step === 3 && domain && (
        <div className="cd-body">
          <div className="cd-banner"><Icon name="info" size={12} /> Publish these records at your DNS provider, then verify. Nothing is live until verification passes.</div>
          <table className="d2-mini-tbl cd-records">
            <thead><tr><th>Type</th><th>Host</th><th>Expected Value</th><th /></tr></thead>
            <tbody>
              {domain.records.map((r) => (
                <tr key={r.type + r.name}>
                  <td className="mono">{r.type}</td>
                  <td className="mono truncate" title={r.name}>{r.name}</td>
                  <td className="mono truncate" title={r.value}>{r.value}</td>
                  <td>
                    <button className="st-copy" aria-label={`Copy ${r.type} value`} onClick={() => copy(r.value, `${r.type} value`)}>
                      <Icon name="copy" size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {verdict === "fail" && (
            <div className="st-domain-error"><Icon name="alert" size={11} /> Verification failed — the resolver did not see the records yet. Propagation can take up to an hour.</div>
          )}
          <p className="d2-note">Verification runs as a background job. The status you see comes from the job result, not from a timer.</p>
        </div>
      )}

      {step === 4 && domain && (
        <div className="cd-body">
          <div className="cd-success">
            <span className="cd-success-ico"><Icon name="check" size={16} /></span>
            <div>
              <div className="cd-success-title">DNS verified for {domain.hostname}</div>
              <div className="cd-success-sub">Certificate provisioning has started and usually finishes within a minute.</div>
            </div>
          </div>
          <div className="d2-kv"><span>Hostname</span><b className="mono">{domain.hostname}</b></div>
          <div className="d2-kv"><span>DNS</span><Pill tone="green" dot>Verified</Pill></div>
          <div className="d2-kv"><span>SSL</span><Pill tone="amber" dot>Provisioning</Pill></div>
          <div className="d2-kv"><span>Primary</span><b>{asPrimary ? "will be set after verification" : "no"}</b></div>
        </div>
      )}
    </Modal>
  );
}
