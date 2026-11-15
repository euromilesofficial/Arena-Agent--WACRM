/* ============================================================
   Module 6 · Theme Studio — the read-only website preview
   ------------------------------------------------------------
   The centre column is a token test bench, not an editor: the page is
   rendered by Module 4's block renderer at the real device width, so a
   1440 px page lays out exactly as it would ship. Nothing here can be
   clicked into an edit — every handler is a no-op and the element hover
   ring that the builder uses for selection is switched off in CSS.

   Theme variables are written to this root only (style attribute), so a
   colour change never touches the admin shell around it.
   ============================================================ */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Node as BlockView, type RenderCtx } from "@/components/builder/Blocks";
import { DEVICE_W, type Device } from "@/components/builder/Canvas";
import type { BlockNode } from "@/lib/builder";
import { previewVars, type ThemeTokens } from "@/lib/theme-db";
import { ThemeSpecimen } from "./ThemeSpecimen";
import { DEVICES } from "./ThemeControls";

const INERT: RenderCtx = {
  selId: null,
  selEl: null,
  onSelect: () => undefined,
  onSelectEl: () => undefined
};

export function ThemePreview({ tokens, device, onDevice, chip, pages, page, onPage, blocks, empty, zoomLabel, mode, onMode }: {
  tokens: ThemeTokens;
  device: Device;
  onDevice: (d: Device) => void;
  chip: ReactNode;
  pages: { id: string; title: string }[];
  page: string | null;
  onPage: (id: string) => void;
  blocks: BlockNode[];
  empty: ReactNode;
  zoomLabel: string;
  /** G3 — page, or the specimen sheet drawn from the same tokens */
  mode: "page" | "specimen";
  onMode: (m: "page" | "specimen") => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);
  const [docH, setDocH] = useState(0);
  /* The specimen is a document, not a page: it is reviewed at the studio's own
     width, so it renders 1:1 instead of being scaled to 42% and turned into
     unreadable 6px labels. Tablet and phone still constrain it. */
  const width = mode === "specimen" && device === "desktop" ? Math.max(420, Math.round((stageW || 900) - 26)) : DEVICE_W[device];

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDocH(el.offsetHeight));
    ro.observe(el);
    setDocH(el.offsetHeight);
    return () => ro.disconnect();
  }, [blocks, device, mode]);

  const scale = mode === "specimen" ? 1 : stageW ? Math.min(1, (stageW - 26) / width) : 1;

  return (
    <main className="m6-main" aria-label="Website preview">
      <div className="m6-main-head">
        <div className="m6-main-heading">
          <h2 className="m6-main-title">Website Preview</h2>
          {chip}
        </div>
        <div className="m6-main-tools">
          <div className="m6-pvmode" role="group" aria-label="Preview surface">
            <button
              type="button" className={`m6-pvmode-btn ${mode === "page" ? "is-on" : ""}`}
              aria-pressed={mode === "page"} onClick={() => onMode("page")}
              title="The site's own page, rendered by Module 4's renderer"
            >
              <Icon name="file" size={12} />Page
            </button>
            <button
              type="button" className={`m6-pvmode-btn ${mode === "specimen" ? "is-on" : ""}`}
              aria-pressed={mode === "specimen"} onClick={() => onMode("specimen")}
              title="Every primitive in the current tokens — buttons, inputs, alerts, table, focus ring"
            >
              <Icon name="layers" size={12} />Specimen
            </button>
          </div>
          {mode === "page" && pages.length > 1 && (
            <label className="m6-pages">
              <Icon name="file" size={12} />
              <select value={page ?? ""} onChange={(e) => onPage(e.target.value)} aria-label="Preview page">
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          )}
          <div className="m6-devices" role="group" aria-label="Preview viewport">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`m6-device ${device === d.id ? "is-on" : ""}`}
                aria-pressed={device === d.id}
                title={`${d.label} · ${d.width} px`}
                onClick={() => onDevice(d.id)}
              >
                <Icon name={d.icon} size={13} />
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="m6-stage" ref={stageRef}>
        <div className="m6-stage-note">
          <span className="m6-stage-dim">{width} px</span>
          <span className="m6-stage-sep" />
          <span>{zoomLabel}</span>
          <span className="m6-stage-sep" />
          <span className="m6-stage-lock"><Icon name="eye" size={11} />Read-only</span>
        </div>
        {(mode === "page" && blocks.length === 0) ? (
          <div className="m6-pv-empty">{empty}</div>
        ) : (
          <div className="m6-scale" style={{ width: width * scale, height: docH ? docH * scale : undefined }}>
            <div
              ref={docRef}
              className={`m6-pv wb-doc wb-dev-${device}`}
              style={{ width, transform: `scale(${scale})`, ...previewVars(tokens) } as React.CSSProperties}
              data-device={device}
            >
              {mode === "specimen"
                ? <ThemeSpecimen tokens={tokens} />
                : blocks.map((n) => <BlockView key={n.id} node={n} ctx={INERT} />)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
