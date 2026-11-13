/* ============================================================
   Dashboard · right rail — activity, forms, goals, vitals
   ============================================================ */
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { useApp, useDash } from "@/lib/store";

const TONE: Record<string, [string, string, string]> = {
  green: ["#EFE9FF", "#5A36EF", "rocket"],
  violet: ["#EFE9FF", "#5A36EF", "menu"],
  blue: ["#EFE9FF", "#5A36EF", "file"],
  amber: ["#EFE9FF", "#5A36EF", "refresh"]
};

export function RecentActivity() {
  const app = useApp();
  const d = useDash();
  return (
    <section className="card rail-card">
      <div className="rail-head">
        <div className="card-title"><Icon name="clock" size={14} /> Recent Activity</div>
        <button className="link" onClick={() => app.openDrawer({ kind: "activity" })}>
          View All <Icon name="arrowRight" size={10} />
        </button>
      </div>
      <div className="feed">
        {(d?.activity ?? []).slice(0, 4).map((a, i) => {
          const t = TONE[a.tone] ?? TONE.blue;
          return (
            <button key={a.id} className="feed-item" style={{ animation: `fadeIn 260ms ease ${i * 40}ms both` }}
              onClick={() => app.toast({ type: "info", title: a.title, sub: "Release and content events are stored in the audit log with actor, target and timestamp." })}>
              <span className="feed-line"><i className="feed-dot-mark" /></span>
              <span className="feed-ico" style={{ background: t[0], color: t[1] }}><Icon name={t[2]} size={12} /></span>
              <span className="feed-txt">
                <span className="feed-title">{a.title}</span>
                <span className="feed-meta">{a.meta}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FormPerformance() {
  const app = useApp();
  const d = useDash();
  const f = d?.forms;
  const pct = Math.round((f?.completion ?? 0) * 1000) / 10;
  return (
    <section className="card rail-card">
      <div className="rail-head">
        <div className="card-title"><Icon name="chart" size={14} /> Form Performance</div>
        <span className="rail-meta">{app.rangeName}</span>
      </div>
      <div className="stat-tiles">
        <button className="stat-tile" onClick={() => app.openDrawer({ kind: "forms" })}>
          <b className="num">{f?.starts ?? 0}</b><span>Form starts</span>
        </button>
        <button className="stat-tile" onClick={() => app.openDrawer({ kind: "forms" })}>
          <b className="num">{f?.submissions ?? 0}</b><span>Submissions</span>
        </button>
        <button className="stat-tile ok" onClick={() => app.openDrawer({ kind: "forms" })}>
          <b className="num">{pct}%</b><span>Completion</span>
        </button>
      </div>
      <div className="rail-label">Most used form</div>
      <button className="form-row" onClick={() => app.openDrawer({ kind: "forms" })}>
        <span className="fr-ico"><Icon name="form" size={12} /></span>
        <span className="fr-name truncate">{f?.name ?? "—"}</span>
        <span className="fr-leds num">{f?.leads ?? 0} leads</span>
        <Icon name="chevRight" size={12} className="fr-chev" />
      </button>
    </section>
  );
}

export function GoalTracking() {
  const app = useApp();
  const d = useDash();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 120); return () => window.clearTimeout(t); }, []);
  return (
    <section className="card rail-card">
      <div className="rail-head">
        <div className="card-title"><Icon name="target" size={14} /> Goal Tracking</div>
        <span className="rail-meta">{app.rangeName}</span>
      </div>
      <div className="goal-list">
        {(d?.goals ?? []).map((g) => {
          const pct = Math.min(100, (g.value / g.target) * 100);
          return (
            <button key={g.id} className="goal" onClick={() => app.openModal({ kind: "goals" })}>
              <div className="goal-head">
                <span className="truncate">{g.name}</span>
                <span className="gv num">{g.value} / {g.target}</span>
              </div>
              <div className="goal-bar">
                <div className="goal-track">
                  <div className="goal-fill" style={{ width: mounted ? `${pct}%` : 0 }} />
                </div>
                <span className="goal-pct num">{Math.round(pct)}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PerfSnapshot() {
  const app = useApp();
  const d = useDash();
  const v = d?.vitals ?? { lcp: 2.1, inp: 92, cls: 0.03, grade: "good" };
  const none = !!d && !d.totals.visitors;
  const items: [string, string, string][] = none
    ? [["LCP", "—", "lcp"], ["INP", "—", "inp"], ["CLS", "—", "cls"]]
    : [["LCP", `${v.lcp}s`, "lcp"], ["INP", `${v.inp}ms`, "inp"], ["CLS", v.cls.toFixed(2), "cls"]];
  return (
    <section className="card rail-card">
      <div className="rail-head">
        <div className="card-title"><Icon name="activity" size={14} /> Performance Snapshot</div>
      </div>
      <div className="vitals">
        {items.map(([lab, val, key]) => (
          <button key={key} className="vital" onClick={() => app.openDrawer({ kind: "vitals", which: key })}>
            <span className="v-lab">{lab}</span>
            <span className="v-val num">{val}</span>
            <span className={`pill ${none ? "pill-grey" : "pill-green"} v-pill`}>{none ? "No data" : "Good"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
