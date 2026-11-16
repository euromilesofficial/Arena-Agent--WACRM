/* ============================================================
   Module 7 · Layout canvas
   ------------------------------------------------------------
   A schematic of the resolved layout, drawn from the real data:
   the announcement variant's text, the header variant's nav/CTA,
   the slot's seed blocks and the footer's column count. Empty and
   missing states are drawn, never faked.
   ============================================================ */
import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { BlockNode } from "@/lib/builder";
import type { LayoutFrame, SlotPolicy } from "@/lib/layout-db";

export const LAYOUT_DEVICE_W = { desktop: 1440, tablet: 768, mobile: 375 } as const;
export type LayoutDevice = keyof typeof LAYOUT_DEVICE_W;

const lines = (n: number, w = [92, 78, 84, 62]) => (
  <div className="m7l-lines" aria-hidden>
    {Array.from({ length: n }).map((_, i) => <span key={i} style={{ width: `${w[i % w.length]}%` }} />)}
  </div>
);

function Sketch({ type, device }: { type: string; device: LayoutDevice }) {
  const narrow = device === "mobile";
  switch (type) {
    case "hero":
      return (
        <div className={`m7l-hero ${narrow ? "is-narrow" : ""}`}>
          <div className="m7l-hero-copy">
            <span className="m7l-eyebrow" />
            <span className="m7l-h1" />
            <span className="m7l-h1 is-short" />
            <span className="m7l-h1 is-shortest" />
            <span className="m7l-cta" />
          </div>
          <div className="m7l-img is-hero" />
        </div>
      );
    case "heading":
      return <div className="m7l-heading"><span /><span className="is-short" /></div>;
    case "text":
      return <div className="m7l-text">{lines(4)}</div>;
    case "image":
      return <div className="m7l-img is-wide" />;
    case "video":
      return <div className="m7l-img is-wide is-video"><Icon name="play" size={16} /></div>;
    case "form":
      return (
        <div className="m7l-form">
          <span className="m7l-form-t" />
          {[0, 1, 2].map((i) => <span key={i} className="m7l-input" />)}
          <span className="m7l-form-btn" />
        </div>
      );
    case "featureGrid":
      return <div className={`m7l-cards ${narrow ? "is-narrow" : ""}`}>{[0, 1, 2].map((i) => <div key={i} className="m7l-card"><i /><span /><span className="is-short" /></div>)}</div>;
    case "table":
      return <div className="m7l-table">{[0, 1, 2, 3].map((i) => <span key={i} />)}</div>;
    case "testimonials":
      return <div className={`m7l-quotes ${narrow ? "is-narrow" : ""}`}>{[0, 1, 2].slice(0, narrow ? 1 : 3).map((i) => <div key={i}><span /><em /></div>)}</div>;
    case "faq":
      return <div className="m7l-faq">{[0, 1, 2].map((i) => <span key={i} />)}</div>;
    case "list":
      return <div className="m7l-list">{[0, 1, 2].map((i) => <span key={i} />)}</div>;
    case "alert":
      return <div className="m7l-alert" />;
    case "ctaSection":
      return <div className="m7l-band"><span /><i /></div>;
    case "columns":
      return <div className={`m7l-cols ${narrow ? "is-narrow" : ""}`}>{[0, 1, 2].map((i) => <div key={i}>{lines(3)}</div>)}</div>;
    case "quote":
      return <div className="m7l-pullquote">{lines(2)}</div>;
    case "divider":
      return <div className="m7l-divider" />;
    case "button":
      return <div className="m7l-btn-row"><span className="m7l-cta" /></div>;
    case "pricing":
      return <div className={`m7l-cards ${narrow ? "is-narrow" : ""}`}>{[0, 1, 2].map((i) => <div key={i} className="m7l-card is-price"><i /><span /><b /></div>)}</div>;
    default:
      return <div className="m7l-generic">{lines(2)}</div>;
  }
}

export function LayoutCanvas({ frame, seed, device, zoom, slotLabel, slotNote = "required", policy }: {
  frame: LayoutFrame;
  seed: BlockNode[];
  device: LayoutDevice;
  zoom: number;
  slotLabel: string;
  slotNote?: string;
  policy: SlotPolicy;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(900);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const base = LAYOUT_DEVICE_W[device];
  /* the fit scale never exceeds 1:1 — a 375 px phone must not be blown up */
  const fit = Math.min(1, (stageW - 4) / base);
  const k = (zoom / 100) * fit;
  const height = device === "desktop" ? 1080 : device === "tablet" ? 1180 : 1060;
  const narrow = device === "mobile";
  const blocked = seed.filter((b) => policy.deny.includes(b.type));

  return (
    <div className="m7l-stage" ref={stageRef}>
      <div className="m7l-scale" style={{ height: Math.round(height * k) }}>
        <div className="m7l-frame" style={{ width: base, height, transform: `translateX(-50%) scale(${k})` }} data-device={device}>
          <div className="m7l-browser">
            <span /><span /><span />
            <em>euromiles.in</em>
          </div>
          <div className="m7l-page">
            {frame.announcement ? (
              <div className="m7l-announce"><Icon name="megaphone" size={11} /><span>{frame.announcement.text || "Announcement bar — empty variant"}</span></div>
            ) : null}

            {frame.header ? (
              <div className="m7l-header">
                <span className="m7l-brand">{frame.header.brand.replace(/\.in$/, "")}<em>.in</em></span>
                {!narrow && (
                  <nav className="m7l-nav">
                    {frame.header.nav.slice(0, narrow ? 2 : 6).map((l) => <span key={l}>{l}</span>)}
                  </nav>
                )}
                <span className="m7l-header-cta">{narrow ? "Enquire" : frame.header.cta}</span>
              </div>
            ) : (
              <div className="m7l-header is-off"><Icon name="eye" size={11} /> Header hidden for this layout</div>
            )}

            <div className="m7l-slot">
              <div className="m7l-slot-tag">
                <Icon name="lock" size={10} /> {slotLabel}
                {slotNote && <em>{slotNote}</em>}
              </div>
              {seed.length === 0 ? (
                <div className="m7l-slot-empty">
                  <Icon name="blocks" size={18} />
                  <b>Empty content slot</b>
                  <span>Pages using this layout start blank and compose here in the Visual Builder.</span>
                </div>
              ) : (
                <div className="m7l-blocks">
                  {seed.map((b) => (
                    <div key={b.id} className={`m7l-block is-${b.type} ${blocked.includes(b) ? "is-denied" : ""}`}>
                      <span className="m7l-block-tag">{b.type}</span>
                      <Sketch type={b.type} device={device} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {frame.footer ? (
              <div className="m7l-footer">
                <div className={`m7l-footer-cols ${narrow ? "is-narrow" : ""}`}>
                  {frame.footer.columns.map((c) => <div key={c}>{lines(3)}</div>)}
                </div>
                <div className="m7l-footer-note">{frame.footer.note || "Global Footer"} · {frame.footer.variant}</div>
              </div>
            ) : (
              <div className="m7l-footer is-off"><Icon name="eye" size={11} /> Footer hidden for this layout</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
