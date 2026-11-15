/* ============================================================
   Module 6 · Theme Studio — editor controls
   ------------------------------------------------------------
   Two anchored popovers that the whole studio shares:

     · ColorField   — HSV picker (saturation/value field + hue rail),
                      normalised hex entry, recent colours, per-token reset.
     · FontCombobox — searchable catalogue with live samples; families
                      whose woff2 is not embedded are listed but cannot be
                      chosen, with the reason printed on the row.

   Neither one owns theme state: they call back with a value and the screen
   decides what a commit means (working edit, undo entry, dirty flag).
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Popover } from "@/components/ui";
import { FONT_CATALOG, normalizeHex, type FontFamily } from "@/lib/theme-db";

/* ---------------- colour maths for the picker ---------------- */

export interface HSV { h: number; s: number; v: number }

const clamp = (n: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, n));

export function hexToHsv(hex: string): HSV {
  const h = normalizeHex(hex) ?? "#000000";
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
      : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`.toUpperCase();
}

/* ---------------- colour field ---------------- */

export function ColorField({ anchor, open, onClose, roleLabel, value, recent, onCommit, onReset }: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  roleLabel: string;
  value: string;
  recent: string[];
  onCommit: (hex: string) => void;
  onReset: () => void;
}) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [draft, setDraft] = useState(value.toUpperCase());
  const [invalid, setInvalid] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  /* the popover re-seeds when it opens or the token changes underneath it */
  useEffect(() => {
    if (!open) return;
    setHsv(hexToHsv(value));
    setDraft(value.toUpperCase());
    setInvalid(null);
  }, [open, value]);

  const commitHsv = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setDraft(hex);
    setInvalid(null);
    onCommit(hex);
  };

  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const move = (cx: number, cy: number) =>
      commitHsv({ ...hsv, s: clamp((cx - box.left) / box.width), v: 1 - clamp((cy - box.top) / box.height) });
    move(e.clientX, e.clientY);
    const el = e.currentTarget;
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.setPointerCapture?.(e.pointerId);
  };

  const submitHex = () => {
    const n = normalizeHex(draft);
    if (!n) { setInvalid("Enter a valid 6-digit hex colour — #RRGGBB."); return; }
    setDraft(n);
    setInvalid(null);
    setHsv(hexToHsv(n));
    onCommit(n);
  };

  const hue = `hsl(${Math.round(hsv.h)} 100% 50%)`;

  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align="left" role="dialog" className="m6-cp">
      <div className="m6-cp-head">
        <span className="m6-cp-title">{roleLabel}</span>
        <span className="m6-cp-hex">{draft}</span>
      </div>

      <div
        className="m6-cp-field"
        ref={fieldRef}
        role="slider"
        aria-label={`Saturation and brightness for ${roleLabel}`}
        aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
        aria-valuenow={Math.round(hsv.v * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={drag}
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})` }}
      >
        <span className="m6-cp-dot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: draft }} />
      </div>

      <div className="m6-cp-hue">
        <input
          type="range" min={0} max={360} value={Math.round(hsv.h)} aria-label="Hue"
          onChange={(e) => commitHsv({ ...hsv, h: Number(e.target.value) })}
        />
      </div>

      <div className="m6-cp-row">
        <span className="m6-cp-preview" style={{ background: draft }} aria-hidden />
        <input
          className={`m6-cp-input ${invalid ? "is-bad" : ""}`}
          value={draft}
          aria-label={`${roleLabel} hex value`}
          spellCheck={false}
          onChange={(e) => { setDraft(e.target.value.toUpperCase()); setInvalid(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submitHex(); }
            if (e.key === "Escape") { setDraft(value.toUpperCase()); setInvalid(null); onClose(); }
          }}
          onBlur={submitHex}
        />
        <button
          className="m6-cp-copy" type="button" aria-label={`Copy ${value}`}
          onClick={() => { navigator.clipboard?.writeText(value).catch(() => undefined); onClose(); }}
        >
          <Icon name="copy" size={13} />
        </button>
      </div>
      {invalid && <p className="m6-cp-error">{invalid}</p>}

      {recent.length > 0 && (
        <>
          <div className="m6-cp-label">Recent</div>
          <div className="m6-cp-recent">
            {recent.map((hex) => (
              <button
                key={hex} type="button" className="m6-cp-chip" style={{ background: hex }}
                title={hex} aria-label={`Use recent colour ${hex}`}
                onClick={() => { setDraft(hex); setHsv(hexToHsv(hex)); setInvalid(null); onCommit(hex); }}
              />
            ))}
          </div>
        </>
      )}

      <div className="m6-cp-foot">
        <button className="m6-link" type="button" onClick={() => { onReset(); onClose(); }}>
          <Icon name="refresh" size={11} />Reset this token
        </button>
      </div>
    </Popover>
  );
}

/* ---------------- font combobox ---------------- */

export function FontCombobox({ anchor, open, onClose, roleLabel, value, onPick }: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  roleLabel: string;
  value: string;
  onPick: (family: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); window.setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const rows = FONT_CATALOG.filter((f: FontFamily) => !q.trim() || f.family.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align="left" role="listbox" className="m6-fc">
      <div className="m6-fc-search">
        <Icon name="search" size={13} />
        <input
          ref={inputRef} value={q} placeholder={`Search fonts for ${roleLabel.toLowerCase()}…`}
          aria-label={`Search fonts for ${roleLabel}`} onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="m6-fc-list" role="presentation">
        {rows.map((f) => {
          const on = f.family === value;
          return (
            <button
              key={f.family}
              type="button"
              role="option"
              aria-selected={on}
              aria-disabled={!f.embedded}
              disabled={!f.embedded}
              className={`m6-fc-row ${on ? "is-on" : ""}`}
              title={!f.embedded ? f.reason : `${f.family} · ${f.weights.join("/")} · ${f.license}`}
              onClick={() => { onPick(f.family); onClose(); }}
            >
              <span className="m6-fc-aa" style={{ fontFamily: `'${f.family}', system-ui` }}>Aa</span>
              <span className="m6-fc-body">
                <span className="m6-fc-name">{f.family}</span>
                <span className="m6-fc-meta">
                  {f.category} · {f.weights.join(" / ")} · {f.license}
                  {!f.embedded && <em className="m6-fc-warn"> · Requires ingestion</em>}
                </span>
              </span>
              {on && <Icon name="check" size={13} />}
              {!f.embedded && <Icon name="lock" size={11} />}
            </button>
          );
        })}
        {!rows.length && <div className="m6-fc-none">No family in the catalogue matches “{q}”.</div>}
      </div>
      <div className="m6-fc-foot">
        <Icon name="info" size={11} />
        <span>Six families ship inside this build as self-hosted woff2. Anything else needs the ingestion job.</span>
      </div>
    </Popover>
  );
}

/* ---------------- device switch ----------------
   Distinct hardware glyphs (monitor / tablet / phone) — never one morphing
   icon, so the three targets are told apart at a glance. */

export const DEVICES: { id: "desktop" | "tablet" | "mobile"; icon: string; label: string; width: number }[] = [
  { id: "desktop", icon: "monitor", label: "Desktop", width: 1440 },
  { id: "tablet", icon: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", icon: "phone", label: "Mobile", width: 375 }
];
