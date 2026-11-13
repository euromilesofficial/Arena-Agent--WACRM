/* ============================================================
   Charts — hand-rolled SVG rendered declaratively (no chart library)
   ============================================================ */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Point } from "@/lib/data";
import { THUMB_IMG } from "@/lib/thumbs";
import { DB_UTIL } from "@/lib/data";
import { prefersReducedMotion } from "@/lib/format";

const NS = "http://www.w3.org/2000/svg";
void NS;

/** Catmull-Rom-ish smoothing used by every line and sparkline. */
export function smoothPath(pts: [number, number][], tension = 0.34): string {
  if (!pts.length) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) * tension) / 2;
    const c1y = p1[1] + ((p2[1] - p0[1]) * tension) / 2;
    const c2x = p2[0] - ((p3[0] - p1[0]) * tension) / 2;
    const c2y = p2[1] - ((p3[1] - p1[1]) * tension) / 2;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function niceMax(v: number): number {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7.5, 8, 10];
  return (steps.find((s) => n <= s) || 10) * mag;
}

/* ---------------- sparkline ---------------- */
export function Sparkline({ values, w = 56, h = 22, color = "#16B364" }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (w - 2) + 1,
    h - 2 - ((v - min) / span) * (h - 4)
  ] as [number, number]);
  const d = smoothPath(pts, 0.28);
  const id = `sp-${color.replace("#", "")}-${values.length}-${Math.round(max)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`} fill={`url(#${id})`} />
      <path d={d} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="spark-line" />
    </svg>
  );
}

/* ---------------- traffic line chart ----------------
   The reference plots cumulative visitors (rising to 5,420 by May 30) with
   daily-lead bars riding the baseline, release annotations, and a hover card. */
export function LineChart({ series, visible, events, height = "fill", onPoint }: {
  series: Point[];
  visible: { visitors: boolean; leads: boolean };
  events?: boolean;
  height?: number | "fill";
  onPoint?: (p: Point) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 620, h: 190 });
  const [hover, setHover] = useState(-1);
  const reduce = prefersReducedMotion();
  const showEvents = events !== false;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setBox({ w: Math.max(280, el.clientWidth || 620), h: Math.max(118, el.clientHeight || 190) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!series.length) {
    return (
      <div className="chart-wrap">
        <div className="chart-empty">
          <div>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 8px", color: "var(--muted)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg>
            </div>
            <div className="w650 f12">No traffic recorded for this period</div>
            <div className="f11 muted mt4">Try a wider date range or a different website.</div>
          </div>
        </div>
      </div>
    );
  }

  const W = box.w;
  const H = height === "fill" ? box.h : height;
  const pad = { l: 40, r: 16, t: 14, b: 22 };
  const n = series.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);

  // cumulative running totals: the headline number at the last point equals the KPI
  let runV = 0, runL = 0;
  const cumV = series.map((p) => (runV += p.visitors));
  const cumL = series.map((p) => (runL += p.leads));

  const maxV = niceMax(Math.max(...cumV) * 1.06);
  const yV = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const ticks = 6;
  const labelStep = n > 24 ? 3 : n > 14 ? 2 : 1;
  const evIdx = series.map((p, i) => (p.event ? i : -1)).filter((i) => i >= 0);
  const pts = cumV.map((v, i) => [x(i), yV(v)] as [number, number]);
  const d = smoothPath(pts);
  const maxLeads = Math.max(1, ...series.map((p) => p.leads));
  const barW = Math.max(2.5, Math.min(6, ((W - pad.l - pad.r) / n) * 0.4));
  const zone = (H - pad.t - pad.b) * 0.12;
  const hp = hover >= 0 ? series[hover] : null;

  const move = (ev: React.PointerEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    const px = (ev.clientX - rect.left) * scale;
    let idx = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  };

  const tipWidth = 172;
  const tipLeft = hp ? Math.max(4, Math.min(x(hover) - tipWidth / 2, (wrap.current?.clientWidth ?? W) - tipWidth - 4)) : 0;
  const tipTop = hp ? Math.max(4, Math.min(yV(cumV[hover]) - 62, H - 96)) : 0;
  const fmtDay = (p: Point) => p.date
    ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : p.label;

  return (
    <div className="chart-wrap" ref={wrap}>
      <div className="chart-svg-host" ref={host}>
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label="Traffic and conversions over time" onPointerMove={move} onPointerLeave={() => setHover(-1)}
          onClick={() => hp && onPoint?.(hp)}>
          <defs>
            <linearGradient id="areaV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16B364" stopOpacity=".26" />
              <stop offset="70%" stopColor="#16B364" stopOpacity=".05" />
              <stop offset="100%" stopColor="#16B364" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid + y labels */}
          <g className="chart-grid">
            {Array.from({ length: ticks + 1 }).map((_, i) => {
              const val = (maxV / ticks) * i;
              const y = yV(val);
              return (
                <g key={i}>
                  <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#EAEDF2" strokeDasharray={i === 0 ? "0" : "2 4"} />
                  <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fill="#8D95A3" fontSize="9.5" className="num">
                    {Math.round(val).toLocaleString("en-US")}
                  </text>
                </g>
              );
            })}
          </g>

          {/* x labels */}
          {series.map((p, i) => (i % labelStep === 0 && (n - 1 - i) >= Math.ceil(labelStep / 2) ? (
            <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fill="#8D95A3" fontSize="9.5">{p.label}</text>
          ) : null))}

          {/* release / campaign annotations */}
          {showEvents && evIdx.map((i) => {
            const label = series[i].event ?? "";
            const w = label.length * 5.9 + 30;
            const bx = Math.min(Math.max(x(i) - w / 2, pad.l), W - pad.r - w);
            return (
              <g key={`ev${i}`} className="chart-ann">
                <line x1={x(i)} x2={x(i)} y1={pad.t + 20} y2={H - pad.b} stroke="#C9BFFF" strokeWidth="1" strokeDasharray="3 4" />
                <rect x={bx} y={pad.t} width={w} height={20} rx={10} fill="#F6F2FF" stroke="#DCD2FF" />
                <path d={`M${bx + 11} ${pad.t + 6.4} l4.4 4.4 l-1.2 3.6 l-4.4 -4.4 z`} fill="#6D4AFF" opacity=".9" />
                <text x={bx + w / 2 + 6} y={pad.t + 13.6} textAnchor="middle" fill="#5A36EF" fontSize="9.5" fontWeight="650">{label}</text>
              </g>
            );
          })}

          {visible.visitors && (
            <>
              <path d={`${d} L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`} fill="url(#areaV)" className="series-area" opacity={1} />
              <path d={d} fill="none" stroke="#16B364" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" className={reduce ? "series-path" : "series-path draw"} />
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.6} fill="#16B364" stroke="#fff" strokeWidth={2} />
            </>
          )}

          {/* daily lead bars ride the baseline */}
          {visible.leads && (
            <g opacity="0.9">
              {series.map((p, i) => {
                if (!p.leads) return null;
                const h = Math.max(2, (p.leads / maxLeads) * zone);
                return <rect key={i} x={x(i) - barW / 2} y={H - pad.b - h} width={barW} height={h} rx={Math.min(2.5, barW / 2)} fill="#8B6BF7" />;
              })}
              <path d={cumL.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${H - pad.b - (v / maxV) * (H - pad.t - pad.b)}`).join(" ")}
                fill="none" stroke="#6D4AFF" strokeWidth={1.6} opacity=".55" />
            </g>
          )}

          {hp && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#B7BEC9" strokeWidth="1" strokeDasharray="3 3" />
              {visible.visitors && <circle cx={x(hover)} cy={yV(cumV[hover])} r={4.4} fill="#fff" stroke="#16B364" strokeWidth="2.5" />}
              {visible.leads && <circle cx={x(hover)} cy={H - pad.b - (cumL[hover] / maxV) * (H - pad.t - pad.b)} r={3.4} fill="#fff" stroke="#6D4AFF" strokeWidth="2.2" />}
            </>
          )}
        </svg>
      </div>

      {hp && (
        <div className="chart-tooltip show" style={{ left: tipLeft, top: tipTop, width: tipWidth }}>
          <div className="tt-date">{fmtDay(hp)}</div>
          {visible.visitors && <div className="tt-row"><i className="tt-dot" style={{ background: "#16B364" }} />Visitors <b>{cumV[hover].toLocaleString("en-US")}</b></div>}
          {visible.leads && <div className="tt-row"><i className="tt-dot" style={{ background: "#6D4AFF" }} />Leads <b>{cumL[hover]}</b></div>}
          {showEvents && hp.event && <div className="tt-row tt-ev">{hp.event}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------------- donut ---------------- */
export function Donut({ items, centerValue, centerLabel, size = 112 }: {
  items: { id: string; name: string; value: number; color: string }[];
  centerValue: string; centerLabel: string; size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const C0 = size / 2;
  const R = Math.round(size * 0.409);
  const C = 2 * Math.PI * R;
  const SW = Math.max(10, Math.round(size * 0.114));
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  let acc = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Traffic acquisition mix">
        <circle cx={C0} cy={C0} r={R} fill="none" stroke="#F1F3F6" strokeWidth={SW} />
        {items.map((it) => {
          const frac = it.value / total;
          const dash = frac * C;
          const rot = (acc / total) * 360 - 90;
          acc += it.value;
          const dim = active !== null && active !== it.id;
          return (
            <circle key={it.id} className="donut-arc" cx={C0} cy={C0} r={R} fill="none" stroke={it.color}
              strokeWidth={active === it.id ? SW + 2 : SW} strokeLinecap="butt"
              strokeDasharray={mounted ? `${dash} ${C - dash}` : `0 ${C}`}
              transform={`rotate(${rot} ${C0} ${C0})`}
              style={{ transition: "stroke-dasharray 700ms cubic-bezier(.16,1,.3,1), stroke-width 180ms ease, opacity 180ms ease", opacity: dim ? 0.28 : 1 }}
              onMouseEnter={() => setActive(it.id)} onMouseLeave={() => setActive(null)} />
          );
        })}
      </svg>
      <div className="donut-center">
        <div className="dc-val num">{centerValue}</div>
        <div className="dc-lab">{centerLabel}</div>
      </div>
    </div>
  );
}

/* ---------------- thumbnails ---------------- */
export function SiteThumb({ theme }: { theme: string }) {
  const img = THUMB_IMG[theme];
  if (img) return <img src={img} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  return (
    <svg viewBox="0 0 320 148" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="320" height="148" fill="#EDF0F5" />
      <rect x="24" y="104" width="272" height="10" rx="5" fill="#D7DCE5" />
      <rect x="24" y="122" width="180" height="8" rx="4" fill="#E2E6EC" />
      <circle cx="256" cy="52" r="22" fill="#DDE2EA" />
    </svg>
  );
}

export function PageThumb({ seed, img }: { seed: string; img?: string }) {
  const src = img ? THUMB_IMG[img] : undefined;
  if (src) return <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  const hues: [string, string][] = [["#FBEBD3", "#B5651D"], ["#E8F0FB", "#2F4C7A"], ["#FBEADC", "#7A4436"], ["#EAF7F0", "#0B7A46"], ["#F2EEFF", "#5A36EF"]];
  const [bg, fg] = hues[Math.abs(DB_UTIL.hash(seed || "x")) % hues.length];
  return (
    <svg viewBox="0 0 30 22">
      <rect width="30" height="22" fill={bg} />
      <circle cx="22" cy="6" r="3" fill={fg} opacity=".45" />
      <rect x="4" y="12" width="14" height="2.6" rx="1.3" fill={fg} opacity=".75" />
      <rect x="4" y="17" width="9" height="2" rx="1" fill={fg} opacity=".45" />
    </svg>
  );
}

/* ---------------- funnel trapezoids ---------------- */
export function FunnelStack({ stages, onStage }: {
  stages: { id: string; name: string; value: number; pct: number | null }[];
  onStage: (id: string) => void;
}) {
  const max = stages[0]?.value ?? 0;
  const widths = max > 0
    ? stages.map((s, i) => (i === 0 ? 100 : Math.max(28, Math.round(Math.pow(Math.max(s.value, 1) / max, 0.16) * 100))))
    : stages.map(() => 100);
  return (
    <div className="funnel-stack">
      {stages.map((s, i) => (
        <button key={s.id} className="fstage" data-stage={s.id} onClick={() => onStage(s.id)}
          style={{ width: `${widths[i]}%`, animationDelay: `${i * 50}ms` }} aria-label={`${s.name}: ${s.value}`}>
          <span className="fstage-val num">{s.value.toLocaleString("en-US")}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- small ring (form completion) ---------------- */
export function Ring({ pct, size = 46, stroke = 5, color = "#16B364" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setOn(true), 80); return () => window.clearTimeout(t); }, []);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDF0F4" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={on ? `${(pct / 100) * c} ${c - (pct / 100) * c}` : `0 ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(.16,1,.3,1)" }} />
    </svg>
  );
}
