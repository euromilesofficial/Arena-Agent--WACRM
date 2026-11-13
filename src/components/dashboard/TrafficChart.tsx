/* ============================================================
   Dashboard · Traffic & conversions
   ============================================================ */
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { MenuItem, MenuLabel, Popover } from "../ui";
import { LineChart } from "../charts";
import { useApp, useDash } from "@/lib/store";
import type { Gran } from "@/lib/data";

const GRAN: { id: Gran; label: string; hint: string; need: number }[] = [
  { id: "daily", label: "Daily", hint: "One point per day", need: 0 },
  { id: "weekly", label: "Weekly", hint: "Monday-start weeks", need: 14 },
  { id: "monthly", label: "Monthly", hint: "Calendar months", need: 30 }
];

export function TrafficChart() {
  const app = useApp();
  const d = useDash();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(true);
  const btn = useRef<HTMLButtonElement>(null);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Icon name="chart" size={14} /> Traffic &amp; Conversions</div>
          <div className="card-sub">Cumulative visitors · daily leads · release markers.</div>
        </div>
        <div className="right nowrap">
          <div className="legend">
            {(["visitors", "leads"] as const).map((k) => (
              <button key={k} className={`legend-item ${app.visible[k] ? "" : "off"}`} onClick={() => app.toggleSeries(k)}>
                <i className="legend-dot" style={{ background: k === "visitors" ? "#16B364" : "#6D4AFF" }} />
                {k === "visitors" ? "Visitors" : "Leads"}
              </button>
            ))}
          </div>
          <button className={`chip-btn ${events ? "on" : ""}`} onClick={() => setEvents((e) => !e)} aria-pressed={events}>
            <Icon name="calendar" size={12} /> Events
          </button>
          <button className="select-btn sm" ref={btn} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
            {app.gran.charAt(0).toUpperCase() + app.gran.slice(1)} <Icon name="chevDown" size={11} className="chev" />
          </button>
        </div>
      </div>
      <div className="card-body chart-body">
        {d && <LineChart series={d.series} visible={app.visible} events={events} onPoint={(p) => app.openDrawer({ kind: "point", point: p })} />}
      </div>

      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)}>
        <MenuLabel>Group by · {app.days}-day range</MenuLabel>
        {GRAN.map((g) => {
          const locked = app.days < g.need;
          return (
            <MenuItem key={g.id} icon={locked ? "lock" : "chart"} selected={app.gran === g.id} disabled={locked}
              meta={locked ? `Needs ${g.need}d+` : undefined}
              onClick={() => {
                setOpen(false);
                app.setGran(g.id);
                app.toast({ type: "info", title: `Chart grouped by ${g.label.toLowerCase()}`, sub: "Series recalculated over the selected range." });
              }}>
              {g.label}
            </MenuItem>
          );
        })}
      </Popover>
    </section>
  );
}
