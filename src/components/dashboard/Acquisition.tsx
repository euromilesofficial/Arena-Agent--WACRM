/* ============================================================
   Dashboard · Traffic acquisition
   ============================================================ */
import { useState } from "react";
import { Icon } from "../Icon";
import { Donut } from "../charts";
import { useApp, useDash } from "@/lib/store";
import { fmtInt } from "@/lib/format";

export function Acquisition() {
  const app = useApp();
  const d = useDash();
  const [active, setActive] = useState<string | null>(null);
  const empty = !d?.totals.visitors;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Icon name="chart" size={13} /> Traffic Acquisition</div>
          <div className="card-sub">Where your visitors come from.</div>
        </div>
      </div>
      <div className="card-body">
        <div className="acq-wrap">
          <Donut
            size={100}
            centerValue={fmtInt(d?.totals.visitors ?? 0)}
            centerLabel="Visitors"
            items={(d?.acquisition ?? []).map((a) => ({ id: a.id, name: a.name, value: a.visitors, color: a.color }))}
          />
          <div className="acq-list">
            {(d?.acquisition ?? []).map((a) => (
              <button key={a.id} className={`acq-row ${active === a.id ? "active" : ""}`}
                title={`${a.name} · ${a.detail} — ${fmtInt(a.visitors)} visitors`}
                onMouseEnter={() => setActive(a.id)} onMouseLeave={() => setActive(null)}
                onClick={() => app.openDrawer({ kind: "channel", id: a.id })}>
                <i className="adot" style={{ background: a.color }} />
                <span className="aname">{a.name}<em>{a.detail}</em></span>
                <span className="apct">{empty ? "—" : `${a.pct}%`}</span>
                <span className="acount">{empty ? "" : fmtInt(a.visitors)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
