/* ============================================================
   Dashboard · KPI row — six cards, each a drilldown trigger
   Layout follows the reference: icon chip, value over label,
   sparkline to the right, delta line under the label.
   ============================================================ */
import { Icon } from "../Icon";
import { CountUp } from "../ui";
import { Sparkline } from "../charts";
import { useApp, useDash } from "@/lib/store";

export const KPIS = [
  { id: "websites", label: "Websites", short: "Websites", icon: "layers", def: "Websites provisioned in this organization, excluding archived sites." },
  { id: "visitors", label: "Visitors", short: "Visitors", icon: "users", def: "Unique visitors across published sites in the selected date range. Distinct by anonymous visitor id with a 30-minute session window." },
  { id: "leads", label: "Leads", short: "Leads", icon: "target", def: "Form submissions that created a CRM lead record. Duplicate submissions within 24h collapse into one lead." },
  { id: "leadRate", label: "Visitor-to-lead rate", short: "Lead rate", icon: "filter", def: "Leads ÷ visitors × 100. Comparisons are shown in percentage points, never as a percent change." },
  { id: "bookings", label: "Bookings", short: "Bookings", icon: "calendar", def: "Counselling bookings attributed to a CMS-created lead in the selected range." },
  { id: "lcp", label: "LCP", suffixLabel: "(Core Web Vital)", short: "LCP", icon: "activity", def: "Largest Contentful Paint (75th percentile, field data). Lower is better — 2.5s or less is “Good”." }
];

export function Kpis() {
  const app = useApp();
  const d = useDash();
  const t = d?.totals;

  if (!d || !t) {
    return (
      <div className="kpi-grid">
        {KPIS.map((k) => (
          <div key={k.id} className="kpi" style={{ pointerEvents: "none" }}>
            <div className="kpi-ico sk" style={{ width: 30, height: 30, borderRadius: 9 }} />
            <div className="sk" style={{ height: 18, width: 58, borderRadius: 6 }} />
            <div className="sk sk-line" style={{ width: 44, marginTop: 9 }} />
            <div className="sk sk-line" style={{ width: 36, marginTop: 7 }} />
          </div>
        ))}
      </div>
    );
  }

  const noData = !t.visitors;
  const up = (label: string) => <span className="trend up"><Icon name="trendUp" size={11} /> {label}</span>;
  const down = (label: string) => <span className="trend down"><Icon name="trendDown" size={11} /> {label}</span>;

  const vals: Record<string, { v: number; dec: number; suffix?: string; foot: React.ReactNode }> = {
    websites: { v: t.sites, dec: 0, foot: <span className="trend flat">No change</span> },
    visitors: { v: t.visitors, dec: 0, foot: up(`+${d.growth.visitors}%`) },
    leads: { v: t.leads, dec: 0, foot: up(`+${d.growth.leads}%`) },
    leadRate: { v: t.leadRate, dec: 2, suffix: "%", foot: up("+0.03 pp") },
    bookings: { v: t.bookings, dec: 0, foot: up(`+${d.growth.bookings}%`) },
    lcp: { v: t.lcp, dec: 1, suffix: "s", foot: <>{down("−0.4s")} <span className="pill pill-green kpi-good">Good</span></> }
  };
  if (noData) {
    ["visitors", "leads", "leadRate", "bookings"].forEach((k) => {
      vals[k].foot = <span className="trend flat"><Icon name="help" size={10} /> No comparison period</span>;
    });
    vals.lcp.foot = <span className="trend flat">No telemetry in range</span>;
  }

  const spark = d.series.length > 2
    ? (k: string) => <Sparkline values={d.series.map((p) => (k === "leads" ? p.leads : p.visitors))} w={34} h={16} color="#16B364" />
    : () => null;

  return (
    <div className="kpi-grid">
      {KPIS.map((k, i) => {
        const cfg = vals[k.id];
        return (
          <button key={k.id} className="kpi" style={{ animationDelay: `${i * 45}ms` }} onClick={() => app.openDrawer({ kind: "kpi", id: k.id })}
            title={k.def}>
            <span className="kpi-ico green"><Icon name={k.icon} size={15} /></span>
            <span className="kpi-value">
              {noData && k.id === "lcp"
                ? <span className="num">—</span>
                : <><CountUp value={cfg.v} decimals={cfg.dec} />{cfg.suffix && <span className="unit">{cfg.suffix}</span>}</>}
            </span>
            <span className="kpi-spark">{spark(k.id)}</span>
            <span className="kpi-label">
              {k.short === "LCP" ? <>LCP <span className="kpi-hint">Core Vital</span></> : k.short}
            </span>
            <span className="kpi-foot">{cfg.foot}</span>
          </button>
        );
      })}
    </div>
  );
}
