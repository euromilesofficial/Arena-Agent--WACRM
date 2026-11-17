/* ============================================================
   Module 4 — the stage
   ------------------------------------------------------------
   The document renders inside a scoped root (`.wb-doc`) at real
   viewport width and is zoomed with CSS `zoom`, so a 1440 px page
   lays out exactly as it would ship. Nothing outside the registry
   can be rendered here: every child comes from a typed prop.
   ============================================================ */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Node as BlockNodeView, type RenderCtx } from "./Blocks";
import { AiBubble } from "./AiBubble";
import { labelOf, type BlockNode } from "@/lib/builder";
import type { LayoutFrame } from "@/lib/layout-db";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_W: Record<Device, number> = { desktop: 1440, tablet: 768, mobile: 375 };

export interface DropTarget { parentId: string | null; index: number; valid: boolean; reason?: string }

export interface CanvasCtl {
  selId: string | null;
  selEl: string | null;
  device: Device;
  zoom: number | "fit";
  scale: number;
  drop: DropTarget | null;
  ai: { stage: "idle" | "streaming" | "ready" | "error"; text: string; message?: string } | null;
  aiAction: string | null;
  onSelect: (id: string | null) => void;
  onSelectEl: (id: string, el: string) => void;
  /** inline text edit: the block, the path to the text (lib/inline-edit), the new text */
  onEditText: (id: string, path: string, value: string) => void;
  onAskAi: (action: string) => void;
  onAiClose: () => void;
  onAcceptAi: () => void;
  onToolbar: (action: "drag" | "settings" | "duplicate" | "delete", id: string, e?: React.PointerEvent | React.MouseEvent) => void;
  onEditMaster: () => void;
  /** the page's resolved master layout — M7 owns this, the canvas renders it */
  frame?: LayoutFrame | null;
  /** the site's theme tokens, applied to the document root (M6 → M4 interlink) */
  theme?: { vars: Record<string, string>; label: string } | null;
}

interface Rect { top: number; left: number; width: number; height: number }

/* The header drawn here is the *resolved* layout from Module 7 — the same
   variant, brand, links and CTA that ship on the site. If a page's layout
   hides its header, the canvas says so instead of inventing one. */
const Master = ({ onEdit, frame }: { onEdit: () => void; frame?: LayoutFrame | null }) => {
  const brand = frame?.header?.brand ?? "EuroMiles.in";
  const nav = frame?.header?.nav ?? ["Home", "Study Abroad", "Scholarships", "About Us", "Contact"];
  const cta = frame?.header?.cta ?? "Enquire Now";
  return (
    <div className="wb-master" data-master="1" aria-label="Master layout">
      {frame?.announcement?.visible && frame.announcement.text && (
        <div className="wb-master-announce" data-announce="1">{frame.announcement.text}</div>
      )}
      <div className="wb-master-in">
        <div className="wb-master-brand">{brand.replace(/\.in$/, "")}<span>.in</span></div>
        <nav className="wb-master-nav">
          {nav.slice(0, 5).map((l) => <span key={l}>{l}</span>)}
        </nav>
        <span className="wb-master-cta">{cta}</span>
      </div>
      <button className="wb-master-chip" onClick={onEdit} type="button">
        <Icon name="lock" size={10} /> {frame?.layoutName ?? "Master layout"} · edit in Layouts &amp; Templates
      </button>
    </div>
  );
};

export function Canvas({ doc, ctl }: { doc: BlockNode[]; ctl: CanvasCtl }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [blockBox, setBlockBox] = useState<Rect | null>(null);
  const [elBox, setElBox] = useState<Rect | null>(null);
  const [stageW, setStageW] = useState(720);
  const docRef = useRef<HTMLDivElement>(null);
  const [docH, setDocH] = useState(0);

  const scale = ctl.zoom === "fit" ? ctl.scale : (ctl.zoom as number) / 100;

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const base = stage.getBoundingClientRect();
    const pick = (sel: string): Rect | null => {
      const el = stage.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top - base.top + stage.scrollTop, left: r.left - base.left + stage.scrollLeft, width: r.width, height: r.height };
    };
    setBlockBox(ctl.selId ? pick(`[data-block-id="${ctl.selId}"]`) : null);
    setElBox(ctl.selId && ctl.selEl ? pick(`[data-block-id="${ctl.selId}"] [data-el="${ctl.selEl}"]`) : null);
    setStageW(stage.clientWidth);
  }, [ctl.selId, ctl.selEl]);

  useLayoutEffect(() => { measure(); }, [measure, doc, ctl.device, ctl.zoom, ctl.scale, ctl.ai]);

  /* the document is laid out at real width and scaled with a transform, so the
     layout box (and therefore the scroll height) is compensated explicitly */
  useLayoutEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDocH(el.offsetHeight));
    ro.observe(el);
    setDocH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    const stage = stageRef.current;
    stage?.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("resize", on); stage?.removeEventListener("scroll", on); };
  }, [measure]);

  const ctx: RenderCtx = {
    selId: ctl.selId, selEl: ctl.selEl,
    onSelect: (id) => ctl.onSelect(id),
    onSelectEl: (id, el) => ctl.onSelectEl(id, el),
    onEditText: (id, path, value) => ctl.onEditText(id, path, value)
  };

  const selNode = ctl.selId ? findIn(doc, ctl.selId) : null;
  const wide = Number(DEVICE_W[ctl.device]) * scale > stageW - 8;
  const drop = ctl.drop;

  return (
    <div className="wb-stage" ref={stageRef} onClick={(e) => { if (e.target === e.currentTarget) ctl.onSelect(null); }}>
      <div className="wb-scale" style={{ width: DEVICE_W[ctl.device] * scale, height: docH ? docH * scale : undefined }}>
      <div
        ref={docRef}
        className={`wb-doc wb-dev-${ctl.device} ${wide ? "is-wide" : ""} ${ctl.theme ? "wb-themed" : ""}`}
        style={{ width: DEVICE_W[ctl.device], transform: `scale(${scale})`, ...(ctl.theme?.vars ?? {}) }}
        data-device={ctl.device}
        onClick={(e) => {
          const hit = (e.target as HTMLElement).closest("[data-block-id]");
          if (hit) { const id = hit.getAttribute("data-block-id"); if (id) ctl.onSelect(id); return; }
          if (e.target === e.currentTarget) ctl.onSelect(null);
        }}
      >
        <Master onEdit={ctl.onEditMaster} frame={ctl.frame} />

        {doc.map((n, i) => (
          <div
            className={[
              "wb-slot",
              ctl.selId === n.id ? "is-sel" : "",
              drop && drop.parentId === null && drop.index === i ? "is-drop-before" : "",
              drop && !drop.valid && drop.parentId === null && drop.index === i ? "is-drop-bad" : "",
              drop && drop.parentId === null && drop.index === doc.length && i === doc.length - 1 ? "is-drop-after" : ""
            ].join(" ").trim()}
            data-slot={n.id} data-index={i} key={n.id}
          >
            <span className="wb-slot-tag" aria-hidden>{labelOf(n)}</span>
            <BlockNodeView node={n} ctx={ctx} />
          </div>
        ))}

        <div className="wb-slot-end" data-slot-end="1" aria-hidden />

        <div className="wb-doc-foot">
          <span>Rendered from the draft · {doc.length} sections{ctl.theme ? ` · ${ctl.theme.label}` : ""}</span>
          <span className="wb-doc-foot-sp" />
          <span>{DEVICE_W[ctl.device]} px viewport</span>
        </div>
      </div>
      </div>

      {blockBox && selNode && (
        <>
          <div className="wb-outline" style={{ top: blockBox.top, left: blockBox.left, width: blockBox.width, height: blockBox.height }} aria-hidden>
            <i className="wb-h wb-h-tl" /><i className="wb-h wb-h-tr" /><i className="wb-h wb-h-bl" /><i className="wb-h wb-h-br" />
            <span className="wb-outline-tag"><Icon name="blocks" size={10} /> {labelOf(selNode)}</span>
          </div>
          <div className="wb-ctx-tools" role="toolbar" aria-label={`${labelOf(selNode)} actions`}
            style={{ top: Math.max(4, blockBox.top - 38), left: Math.max(6, Math.min(blockBox.left + blockBox.width / 2 - 76, stageW - 160)) }}>
            <button className="wb-tool wb-tool-drag" title="Drag to move" aria-label="Drag to move"
              onPointerDown={(e) => ctl.onToolbar("drag", selNode.id, e)}><Icon name="grip" size={13} /></button>
            <button className="wb-tool" title="Block settings" aria-label="Block settings"
              onClick={() => ctl.onToolbar("settings", selNode.id)}><Icon name="sliders" size={13} /></button>
            <button className="wb-tool" title="Duplicate block" aria-label="Duplicate block"
              onClick={() => ctl.onToolbar("duplicate", selNode.id)}><Icon name="copy" size={13} /></button>
            <button className="wb-tool wb-tool-danger" title="Delete block" aria-label="Delete block"
              onClick={() => ctl.onToolbar("delete", selNode.id)}><Icon name="trash" size={13} /></button>
          </div>
        </>
      )}

      {ctl.ai && elBox && (
        <AiBubble ai={ctl.ai} aiAction={ctl.aiAction} box={elBox} stageW={stageW}
          onAskAi={ctl.onAskAi} onAiClose={ctl.onAiClose} onAcceptAi={ctl.onAcceptAi} />
      )}
    </div>
  );
}

function findIn(nodes: BlockNode[], id: string): BlockNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children ? findIn(n.children, id) : null;
    if (hit) return hit;
  }
  return null;
}
