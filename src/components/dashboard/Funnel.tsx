/* ============================================================
   Dashboard · Conversion journey
   ============================================================ */
import { Icon } from "../Icon";
import { useApp, useDash } from "@/lib/store";
import { fmtInt } from "@/lib/format";

const COLORS = ["#7A45E8", "#8B5CF6", "#A78BFA", "#C4B5FD"];

/** Stage-to-stage conversion: 2 decimals below 10%, 1 decimal above. */
const fmtStagePct = (p: number): string => `${p >= 10 ? p.toFixed(1) : p.toFixed(2)}%`;

export function Funnel() {
  const app = useApp();
  const d = useDash();
  const f = d?.funnel ?? [];
  const max = f[0]?.value ?? 0;
  const widths = max > 0
    ? f.map((s, i) => (i === 0 ? 100 : Math.max(28, Math.round(Math.pow(Math.max(s.value, 1) / max, 0.16) * 100))))
    : f.map(() => 100);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Icon name="filter" size={13} /> Conversion Journey</div>
          <div className="card-sub">From website visit to counselling booking.</div>
        </div>
        <div className="right">
          <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Funnel information"
            onClick={() => app.toast({ type: "info", title: "Conversion journey", sub: "Each stage counts the same visitor set without double counting. Percentages are conversion from the preceding stage." })}>
            <Icon name="help" size={13} />
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="funnel-grid">
          <div className="funnel-shapes">
            {f.map((s, i) => (
              <button key={s.id} className={`fstage fstage-${i + 1} wa`} style={{ width: `${widths[i]}%`, animationDelay: `${i * 50}ms` }}
                title={`${s.name} · ${fmtInt(s.value)} visitors`} onClick={() => app.openDrawer({ kind: "stage", id: s.id })}>
                <span className="fval">{fmtInt(s.value)}</span>
              </button>
            ))}
          </div>
          <div className="funnel-legend">
            {f.map((s, i) => (
              <button key={s.id} className="fleg-row" onClick={() => app.openDrawer({ kind: "stage", id: s.id })}>
                <i className="fdot" style={{ background: COLORS[i] }} />
                <span className="fname">{s.name}</span>
                <span className="fval">{fmtInt(s.value)}</span>
                <span className={`fpct ${i === 0 || !s.value ? "fpct-empty" : ""}`}>
                  {i === 0 || !s.value ? "" : fmtStagePct(s.pct ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
