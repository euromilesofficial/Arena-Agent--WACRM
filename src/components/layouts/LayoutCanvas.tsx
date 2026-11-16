/* ============================================================
   Module 7 · Layout canvas
   ------------------------------------------------------------
   The resolved layout, drawn from the real data: the announcement
   variant's text, the header variant's nav and CTA, the slot's seed
   blocks rendered by the builder's own block renderer (real copy,
   real buttons and cards), and the footer's columns. Empty and
   missing states are drawn, never faked.
   ============================================================ */
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import type { BlockNode } from "@/lib/builder";
import { Node as BlockView, type RenderCtx } from "@/components/builder/Blocks";
import type { LayoutFrame, SlotPolicy } from "@/lib/layout-db";

export const LAYOUT_DEVICE_W = { desktop: 1440, tablet: 768, mobile: 375 } as const;
export type LayoutDevice = keyof typeof LAYOUT_DEVICE_W;

const lines = (n: number, w = [92, 78, 84, 62]) => (
  <div className="m7l-lines" aria-hidden>
    {Array.from({ length: n }).map((_, i) => <span key={i} style={{ width: `${w[i % w.length]}%` }} />)}
  </div>
);

/* Read-only: the canvas shows the page, it does not select or edit blocks. */
const READ_ONLY: RenderCtx = { selId: null, selEl: null, onSelect: () => {}, onSelectEl: () => {} };

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
  /* zoom 0 = Fit to the stage (never above 1:1); any other value is a true percentage of
     the device's real width, and the stage scrolls. Fit made 1440 px text unreadable in a
     546 px column, which is why 100 % is now actual size. */
  const fit = Math.min(1, (stageW - 4) / base);
  const k = zoom === 0 ? fit : zoom / 100;
  const minHeight = device === "desktop" ? 1080 : device === "tablet" ? 1180 : 1060;
  const narrow = device === "mobile";
  const blocked = seed.filter((b) => policy.deny.includes(b.type));

  return (
    <div className="m7l-stage" ref={stageRef}>
      <div className="m7l-scale">
        <div className="m7l-frame" style={{ width: base, minHeight, zoom: String(k) } as CSSProperties} data-device={device}>
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
                <div className={`m7l-blocks wb-doc wb-dev-${device}`}>
                  {seed.map((b) => (
                    <div key={b.id} className={`m7l-block is-${b.type} ${blocked.includes(b) ? "is-denied" : ""}`} data-block={b.type}>
                      {blocked.includes(b) && <span className="m7l-block-tag">{b.type} · not allowed in this slot</span>}
                      <BlockView node={b} ctx={READ_ONLY} />
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
