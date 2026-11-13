/* ============================================================
   New website wizard — 4 steps, validated, async create
   ============================================================ */
import { useMemo, useState } from "react";
import { Icon } from "../Icon";
import { Btn, Field, Modal } from "../ui";
import { useApp } from "@/lib/store";

const TEMPLATES = [
  { id: "leadgen", name: "Education Lead-Gen", desc: "Landing pages, enquiry forms, counselling CTAs.", pages: 12, icon: "target" },
  { id: "loyalty", name: "Loyalty Hub", desc: "Member tiers, rewards catalogue, referral tracking.", pages: 8, icon: "users" },
  { id: "extranet", name: "Partner Extranet", desc: "Gated partner portal with commission docs.", pages: 6, icon: "lock" },
  { id: "blank", name: "Blank site", desc: "Start from an empty page tree.", pages: 1, icon: "file" }
];
const STEPS = ["Website", "Domain", "Locale", "Template"];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function Wizard() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [hostTouched, setHostTouched] = useState(false);
  const [locale, setLocale] = useState("en-IN");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [template, setTemplate] = useState("leadgen");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ name?: string; host?: string }>({});

  const hostValue = hostTouched ? host : name ? `${slugify(name)}.euromiles.in` : "";
  const tpl = useMemo(() => TEMPLATES.find((t) => t.id === template)!, [template]);

  const validate = () => {
    const next: { name?: string; host?: string } = {};
    if (!name.trim()) next.name = "A website name is required.";
    if (!hostValue.trim() || !hostValue.includes(".")) next.host = "Enter a hostname like site.euromiles.in";
    setErr(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (step === 0 && !name.trim()) { setErr({ name: "A website name is required." }); return; }
    if (step === 1 && (!hostValue.trim() || !hostValue.includes("."))) { setErr({ host: "Enter a hostname like site.euromiles.in" }); return; }
    setErr({});
    setStep((s) => Math.min(3, s + 1));
  };

  const create = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await app.createSite({ name: name.trim(), host: hostValue.trim(), locale, tz, template: tpl.name });
      app.closeModal();
      window.setTimeout(() => app.openDrawer({ kind: "workspace", siteId: app.data?.sites.slice(-1)[0]?.id ?? "" }), 260);
    } catch (e) {
      const error = e as { field?: string; message: string };
      setErr(error.field ? { [error.field]: error.message } : { host: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New website"
      sub={`Step ${step + 1} of 4 · ${STEPS[step]}`}
      icon="plus"
      width="wide"
      onClose={app.closeModal}
      footer={
        <>
          <Btn variant="ghost" onClick={() => (step === 0 ? app.closeModal() : setStep((s) => s - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </Btn>
          <span className="grow" />
          {step < 3
            ? <Btn variant="primary" onClick={next}>Continue <Icon name="arrowRight" size={13} /></Btn>
            : <Btn variant="primary" loading={busy} onClick={create}>Create website</Btn>}
        </>
      }
    >
      <div className="wiz-steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`wiz-step ${i === step ? "on" : i < step ? "done" : ""}`} onClick={() => setStep(i)}>
            <span className="wiz-dot">{i < step ? <Icon name="check" size={10} /> : i + 1}</span>
            <span className="f11 w600">{s}</span>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="wiz-body">
          <Field label="Website name" error={err.name} hint="Shown in the site switcher and reports.">
            <input className="input" autoFocus value={name} placeholder="EuroMiles Scholarships"
              onChange={(e) => { setName(e.target.value); setErr({}); }} />
          </Field>
          <div className="wiz-note"><Icon name="info" size={13} /> You can rename or clone this website at any time.</div>
        </div>
      )}

      {step === 1 && (
        <div className="wiz-body">
          <Field label="Primary hostname" error={err.host} hint="DNS verification starts automatically after creation.">
            <input className="input" value={hostValue} placeholder="site.euromiles.in"
              onChange={(e) => { setHostTouched(true); setHost(e.target.value); setErr({}); }} />
          </Field>
          <div className="wiz-records">
            <div className="wiz-rec"><span className="pill pill-grey mono">A</span><code>{hostValue || "site.euromiles.in"}</code><span className="f11 muted">→ 76.76.21.21</span></div>
            <div className="wiz-rec"><span className="pill pill-grey mono">TXT</span><code>_wacrm-verify.{hostValue || "site.euromiles.in"}</code></div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wiz-body wiz-two">
          <Field label="Locale">
            <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {["en-IN", "en-US", "en-GB", "hi-IN", "ar-AE"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
              {["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="wiz-body">
          <div className="wiz-templates">
            {TEMPLATES.map((t) => (
              <button key={t.id} className={`wiz-tpl ${template === t.id ? "on" : ""}`} onClick={() => setTemplate(t.id)}>
                <span className="wiz-tpl-ico"><Icon name={t.icon} size={15} /></span>
                <span style={{ minWidth: 0, textAlign: "left" }}>
                  <span className="f12 w650" style={{ display: "block" }}>{t.name}</span>
                  <span className="f11 muted">{t.desc}</span>
                </span>
                <span className="pill pill-grey">{t.pages}p</span>
              </button>
            ))}
          </div>
          <div className="wiz-review">
            <div><span className="f11 muted">Name</span><b className="f12">{name || "—"}</b></div>
            <div><span className="f11 muted">Host</span><b className="f12 mono">{hostValue || "—"}</b></div>
            <div><span className="f11 muted">Locale</span><b className="f12">{locale} · {tz}</b></div>
            <div><span className="f11 muted">Template</span><b className="f12">{tpl.name}</b></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
