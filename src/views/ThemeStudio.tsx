/* ============================================================
   Module 6 · Desktop Theme Studio
   ------------------------------------------------------------
   Three tabs (Brand Tokens | Typography | Presets) on the left, a
   read-only website preview in the middle, the Theme Overview on the right.

   The screen edits ONE thing: the site's theme token document. Saving writes
   a draft revision. Publishing is not here — the draft is referenced by the
   next release through Module 4's release flow (Module 11 owns the screen).
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Btn, ErrorState, MenuItem, MenuLabel, Pill, Popover, Skel, Spinner, Tip } from "../components/ui";
import { useApp } from "@/lib/store";
import { DBX } from "@/lib/data";
import { seedStudyAbroad, type BlockNode } from "@/lib/builder";
import {
  BASE_SIZES, COLOR_ROLES, CONTAINER_OPTIONS, DEFAULT_TOKENS, DENSITY_OPTIONS, FALLBACK_STACKS,
  FONT_CATALOG, FONT_STATS, PAIRINGS, RADIUS_OPTIONS, SCALE_RATIOS, TYPE_STEPS, ThemeAPI, blocksOf,
  ensureFontFaces, exportDocument, formatRatio, isDocumentValid, onPrimary, spacingScale, summarise,
  typeSizeCss, typeSizes, typeStamp, validateImport,
  type ColorRole, type ContrastRow, type ImportResult, type Preset, type ThemePayload,
  type ThemeRevision, type ThemeTokens, type TypeStep, type Usage
} from "@/lib/theme-db";
import type { Device } from "@/components/builder/Canvas";
import { ColorField, FontCombobox } from "@/components/theme/ThemeControls";
import { ThemePreview } from "@/components/theme/ThemePreview";
import { ThemeOverview } from "@/components/theme/ThemeOverview";
import {
  ApplyPresetModal, ConflictModal, DeletePresetModal, ImportReviewModal, LeaveModal,
  PresetNameModal, PublishReviewModal, ResetModal, RevisionsModal, UsageModal
} from "@/components/theme/ThemeModals";

type Tab = "brand" | "type" | "presets";
type Status = "loading" | "ready" | "error";

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "brand", label: "Brand Tokens", icon: "palette", hint: "Colours and geometry" },
  { id: "type", label: "Typography", icon: "type", hint: "Heading and body fonts" },
  { id: "presets", label: "Presets", icon: "code", hint: "Reusable JSON themes" }
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ---------------- helpers ---------------- */

function download(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const presetDocument = (p: Preset): string => JSON.stringify({
  schemaVersion: 1,
  name: p.name,
  description: p.desc,
  colors: p.tokens.colors,
  typography: p.tokens.typography,
  geometry: p.tokens.geometry,
  blockStyling: p.tokens.blockStyling,
  "x-wacrm": { preset: p.id, scope: p.scope, updatedAt: new Date(p.updatedAt).toISOString(), exportedBy: "Aranya K." }
}, null, 2);

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Segmented<T extends string | number>({ value, options, onChange, disabled, ariaLabel }: {
  value: T; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void;
  disabled?: boolean; ariaLabel: string;
}) {
  return (
    <div className="m6-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)} type="button" disabled={disabled}
          className={`m6-seg-btn ${value === o.value ? "is-on" : ""}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <b>{o.label}</b>{o.sub && <em>{o.sub}</em>}
        </button>
      ))}
    </div>
  );
}

function ScaleSlider({ label, value, min, max, step, format, disabled, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; disabled?: boolean; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="m6-slider" data-m6-slider={label.toLowerCase().replace(/[^a-z]+/g, "-")}>
      <div className="m6-slider-top">
        <label className="m6-label">{label}</label>
        <b>{format(value)}</b>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        aria-label={label} onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="m6-hint">{hint}</p>}
    </div>
  );
}

/* ---------------- the screen ---------------- */

export function ThemeStudio() {
  const app = useApp();
  const siteId = app.siteId === "all" ? "site_main" : app.siteId;
  const site = DBX().sites.find((s) => s.id === siteId);
  const readOnly = app.role === "Viewer";

  /* ---- remote ---- */
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ThemePayload | null>(null);
  const [tick, setTick] = useState(0);

  /* ---- working copy ---- */
  const [tab, setTab] = useState<Tab>("brand");
  const [pvMode, setPvMode] = useState<"page" | "specimen">("page");
  const [revOpen, setRevOpen] = useState(false);
  const [working, setWorking] = useState<ThemeTokens | null>(null);
  const [undoStack, setUndoStack] = useState<ThemeTokens[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  /* ---- preview ---- */
  const [device, setDevice] = useState<Device>("desktop");
  const [pageId, setPageId] = useState<string | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  /* ---- library ---- */
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetQ, setPresetQ] = useState("");
  const [presetScope, setPresetScope] = useState<"All" | Preset["scope"]>("All");
  const [previewPreset, setPreviewPreset] = useState<Preset | null>(null);

  /* ---- popovers ---- */
  const [colorFor, setColorFor] = useState<{ role: ColorRole; el: HTMLButtonElement } | null>(null);
  const [fontFor, setFontFor] = useState<{ role: "heading" | "body"; el: HTMLButtonElement } | null>(null);
  const [presetMenu, setPresetMenu] = useState<{ preset: Preset; el: HTMLButtonElement } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportBtn = useRef<HTMLSpanElement>(null);

  /* ---- dialogs ---- */
  const [resetOpen, setResetOpen] = useState(false);
  const [applyFor, setApplyFor] = useState<Preset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFor, setRenameFor] = useState<Preset | null>(null);
  const [dupFor, setDupFor] = useState<Preset | null>(null);
  const [deleteFor, setDeleteFor] = useState<Preset | null>(null);
  const [modalErr, setModalErr] = useState("");
  const [importFor, setImportFor] = useState<{ result: ImportResult; file: string } | null>(null);
  const [conflict, setConflict] = useState<ThemeRevision | null>(null);
  const [leave, setLeave] = useState<{ run: () => void } | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const draft = payload?.draft ?? null;
  const dirty = !!working && !!draft && JSON.stringify(working) !== JSON.stringify(draft.tokens);
  const valid = !!working && isDocumentValid(working);
  const shown: ThemeTokens = previewPreset ? previewPreset.tokens : (working ?? DEFAULT_TOKENS);
  const summary = useMemo(() => summarise(shown), [shown]);
  const fontCheck = useMemo(() => ThemeAPI.verifyFonts(working ?? DEFAULT_TOKENS), [working]);

  /* ---- load ---- */
  useEffect(() => {
    let dead = false;
    setStatus("loading");
    setUndoStack([]);
    setPreviewPreset(null);
    ThemeAPI.load(siteId)
      .then((p) => {
        if (dead) return;
        setPayload(p);
        setWorking(p.draft.tokens);
        setSavedAt(p.draft.createdAt);
        setPageId(p.previewPage?.id ?? null);
        setPresets(ThemeAPI.selectable());
        setStatus("ready");
        setError("");
      })
      .catch((e: Error) => { if (!dead) { setError(e.message); setStatus("error"); } });
    return () => { dead = true; };
  }, [siteId, tick]);

  /* ---- the shared Prototype-states menu drives this module too ----
     `conflict` makes a real teammate save land behind the studio's back, so the
     next Save Brand Tokens fails its compare-and-swap instead of overwriting. */
  useEffect(() => {
    ThemeAPI.mode.fail = app.demo === "error";
    ThemeAPI.mode.slow = app.demo === "loading";
    ThemeAPI.mode.empty = app.demo === "empty";
    ThemeAPI.mode.conflict = app.demo === "conflict";
    if (app.demo === "conflict") {
      const teammate: ThemeTokens = clone(DEFAULT_TOKENS);
      teammate.colors.primary = "#0F766E";
      teammate.colors.accent = "#F97316";
      teammate.geometry.radiusPx = 16;
      window.setTimeout(() => { ThemeAPI.saveElsewhere(siteId, teammate); }, 900);
    }
    setTick((n) => n + 1);
  }, [app.demo, siteId]);

  /* ---- embedded fonts ----
     Faces are registered lazily, one family at a time: 247 embedded families is
     ~14 MB of base64, so only the families actually on screen are materialised. */
  useEffect(() => {
    if (!working) return;
    ensureFontFaces([working.typography.heading.family, working.typography.body.family]);
    let alive = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) { setFontsReady(true); return; }
    fonts.ready.then(() => { if (alive) setFontsReady(true); }).catch(() => undefined);
    return () => { alive = false; };
  }, [working?.typography.heading.family, working?.typography.body.family]);

  /* ---- font verification state (local job, real result) ---- */
  const [fontJob, setFontJob] = useState<"idle" | "preparing" | "ready" | "failed">("idle");
  const famKey = working ? `${working.typography.heading.family}|${working.typography.body.family}` : "";
  useEffect(() => {
    if (!working) return;
    setFontJob("preparing");
    const t = window.setTimeout(() => setFontJob(fontCheck.ok ? "ready" : "failed"), 460);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famKey]);

  /* ---- pages + preview blocks ---- */
  const pages = useMemo(
    () => DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash).map((p) => ({ id: p.id, title: p.title, path: p.path })),
    [siteId, payload]
  );
  const blocks: BlockNode[] = useMemo(() => {
    if (useSample) return seedStudyAbroad();
    return pageId ? blocksOf(pageId) : [];
  }, [pageId, useSample, payload, tick]);

  const usage: Usage = payload?.usage ?? { pages: 0, blocks: 0, templates: 0, websites: 1, sample: [] };

  /* ---- unsaved-navigation guard ---- */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const guard = useCallback((run: () => void) => {
    if (!dirty) { run(); return; }
    setLeave({ run });
  }, [dirty]);

  /* ---- undo ---- */
  const commit = useCallback((mutator: (t: ThemeTokens) => ThemeTokens) => {
    if (readOnly) return;
    setWorking((cur) => {
      if (!cur) return cur;
      setUndoStack((u) => [...u.slice(-19), clone(cur)]);
      return mutator(clone(cur));
    });
    setPreviewPreset(null);
  }, [readOnly]);

  const undo = useCallback(() => {
    setUndoStack((u) => {
      if (!u.length) return u;
      const last = u[u.length - 1];
      setWorking(clone(last));
      return u.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo]);

  /* ---- mutations ---- */
  const setColor = (role: ColorRole, hex: string) => {
    setRecent((r) => [hex, ...r.filter((x) => x !== hex)].slice(0, 6));
    commit((t) => ({ ...t, colors: { ...t.colors, [role]: hex } }));
  };

  const resetToken = (role: ColorRole) => setColor(role, DEFAULT_TOKENS.colors[role]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!working || !draft) return false;
    setSaving(true);
    try {
      const rev = await ThemeAPI.saveDraft(siteId, working, draft.id);
      setPayload((p) => (p ? { ...p, draft: rev, history: [...p.history, rev] } : p));
      setSavedAt(rev.createdAt);
      setUndoStack([]);
      app.toast({
        type: "success",
        title: "Brand tokens saved as a draft.",
        sub: `Revision #${rev.seq} · changes are not live until you publish a release.`,
        action: { label: "Review for publish", onClick: () => setPublishOpen(true) }
      });
      return true;
    } catch (e) {
      const err = e as Error & { code?: string; latest?: ThemeRevision };
      if (err.code === "CONFLICT") { setConflict(err.latest ?? draft); return false; }
      app.toast({ type: "error", title: "We couldn’t save your theme", sub: err.message });
      return false;
    } finally {
      setSaving(false);
    }
  }, [working, draft, siteId, app]);

  const doExport = (mode: "draft" | "live") => {
    const doc = exportDocument(siteId, mode);
    setExportOpen(false);
    if (!doc) { app.toast({ type: "error", title: "Nothing to export", sub: `This site has no ${mode} revision.` }); return; }
    ThemeAPI.seen.exports += 1;
    download(doc.filename, doc.json);
    app.toast({ type: "success", title: `Exported ${doc.filename}`, sub: "Sanitised: no tenant ids, tokens or signed URLs." });
  };

  const readFile = async (file: File) => {
    const text = await file.text();
    const name = file.name.replace(/\.json$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const result = validateImport(text, "This Site", name);
    setImportFor({ result, file: file.name });
    if (!result.ok) ThemeAPI.seen.imports += 0;
  };

  const applyPreset = (preset: Preset) => {
    commit(() => ThemeAPI.apply(preset.id));
    setApplyFor(null);
    setPreviewPreset(null);
    app.toast({ type: "info", title: `${preset.name} applied to your draft`, sub: "Nothing is live until you save and publish a release." });
  };

  /* palette for the editor rows, keyed by role */
  const contrastFor = (role: ColorRole): ContrastRow | undefined => summary.rows.find((r) => r.role === role);

  const filteredPresets = presets.filter((p) =>
    (presetScope === "All" || p.scope === presetScope)
    && (!presetQ.trim() || `${p.name} ${p.desc}`.toLowerCase().includes(presetQ.trim().toLowerCase())));

  const afterPresetChange = () => {
    setPresets(ThemeAPI.selectable());
    setModalErr("");
  };

  /* ---- G4: restore a revision into the working copy ----
     Deliberately not a write. A restore that saved behind the user's back would
     be the one action in this module that changes stored state without a press
     of Save, which is exactly the guarantee the module sells. */
  const restoreRevision = useCallback((rev: ThemeRevision) => {
    setWorking((w) => {
      if (w) setUndoStack((u) => [...u, w].slice(-20));
      return clone(rev.tokens);
    });
    setRevOpen(false);
    setTab("brand");
    app.toast({
      type: "info",
      title: `Revision #${rev.seq} restored into the working copy`,
      sub: "Press Save Brand Tokens to make it a new draft — nothing reaches the live site until a release is published."
    });
  }, [app]);

  /* ================= states ================= */

  if (status === "error") {
    return (
      <div className="m6">
        <header className="m6-head">
          <div>
            <h1 className="m6-title">Theme Studio</h1>
            <p className="m6-sub">Define brand colors, typography, and layout tokens for your website.</p>
          </div>
        </header>
        <div className="m6-fill">
          <ErrorState title="The theme service is unavailable" desc={error} onRetry={() => setTick((n) => n + 1)} />
        </div>
      </div>
    );
  }

  if (status === "loading" || !working || !payload) {
    return (
      <div className="m6">
        <header className="m6-head">
          <div>
            <h1 className="m6-title">Theme Studio</h1>
            <p className="m6-sub">Define brand colors, typography, and layout tokens for your website.</p>
          </div>
        </header>
        <div className="m6-body">
          <aside className="m6-editor"><Skel style={{ height: 44 }} /><Skel style={{ height: 260, marginTop: 10 }} /><Skel style={{ height: 150, marginTop: 10 }} /></aside>
          <div className="m6-center"><Skel style={{ height: 42 }} /><Skel className="grow" style={{ marginTop: 10 }} /></div>
          <aside className="m6-ov"><Skel style={{ height: 180 }} /><Skel style={{ height: 130, marginTop: 10 }} /><Skel style={{ height: 160, marginTop: 10 }} /></aside>
        </div>
      </div>
    );
  }

  const stateChip = previewPreset
    ? <Pill tone="violet" dot>Previewing “{previewPreset.name}” — not applied</Pill>
    : dirty
      ? <Pill tone="amber" dot>Using unsaved values (editing)</Pill>
      : <Pill tone="green" dot>Showing saved draft #{payload.draft.seq}</Pill>;

  /* ================= screen ================= */

  return (
    <div className="m6">
      {/* ---------------- header ---------------- */}
      <header className="m6-head">
        <div className="m6-head-l">
          <div className="m6-crumb"><span>Website CMS</span><Icon name="chevRight" size={11} /><span>Theme Studio</span></div>
          <h1 className="m6-title">Theme Studio</h1>
          <p className="m6-sub">Define brand colors, typography, and layout tokens for your website.</p>
        </div>

        <div className="m6-head-r">
          <label className="m6-site">
            <span>Website:</span>
            <select
              value={siteId}
              aria-label="Website"
              onChange={(e) => {
                const next = e.target.value;
                guard(() => app.setSite(next));
              }}
            >
              {DBX().sites.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>

          <div className="m6-save-state">
            <span className={`m6-draft-chip ${saving ? "is-saving" : dirty ? "is-dirty" : "is-saved"}`}>
              {saving ? <><Spinner />Saving…</>
                : dirty ? <><Icon name="pencil" size={11} />Unsaved changes</>
                  : <><Icon name="check" size={11} />Saved draft · {savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</>}
            </span>
            <em className="m6-rev">Draft #{payload.draft.seq} · Live #{payload.live.seq}</em>
          </div>

          <div className="m6-head-actions">
            <Btn icon="upload" disabled={readOnly} onClick={() => fileRef.current?.click()}>Import JSON</Btn>
            <span className="m6-btn-wrap" ref={exportBtn}>
              <Btn icon="download" onClick={() => setExportOpen(true)}>Export</Btn>
            </span>
            <Btn
              variant="primary" loading={saving}
              disabled={readOnly || !dirty || !valid || saving}
              title={readOnly ? "Your role can preview but not save" : !dirty ? "No changes to save" : !valid ? "Fix the invalid values first" : undefined}
              onClick={save}
            >
              Save Brand Tokens
            </Btn>
          </div>
        </div>
      </header>

      <div className="m6-banners">
        {!valid && <div className="m6-banner is-bad"><Icon name="alert" size={13} />Some values are invalid — the preview keeps the last valid pair and saving is blocked until they are fixed.</div>}
        {dirty && valid && <div className="m6-banner is-amber"><Icon name="pencil" size={13} />You are editing an unsaved working copy. Save Brand Tokens writes a draft revision; nothing reaches the live site.</div>}
        {!dirty && <div className="m6-banner is-ok"><Icon name="shield" size={13} />Saved draft #{payload.draft.seq} is what the next release will carry. Publishing lives in the release flow.</div>}
      </div>

      {/* ---------------- body ---------------- */}
      <div className="m6-body">
        {/* ============ LEFT: editor ============ */}
        <aside className="m6-editor" aria-label="Theme editor">
          <div className="m6-tabs" role="tablist" aria-label="Theme Studio sections">
            {TABS.map((t) => (
              <button
                key={t.id} role="tab" aria-selected={tab === t.id}
                className={`m6-tab ${tab === t.id ? "is-on" : ""}`}
                title={t.hint}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={13} />{t.label}
              </button>
            ))}
          </div>

          <div className="m6-pane" role="tabpanel">
            {/* ---------- BRAND TOKENS ---------- */}
            {tab === "brand" && (
              <>
                <div className="m6-sec-head">
                  <h3>Colors</h3>
                  <p>Thirteen semantic roles — brand marks, then the surface, text and line roles they sit with. Contrast is measured on the pairs that actually render, not on every role against white.</p>
                </div>

                {(["Brand", "Surface & text"] as const).map((group) => (
                  <div className="m6-role-group-wrap" key={group} data-m6-group={group}>
                    <div className="m6-role-group">
                      <b>{group === "Brand" ? "Brand marks" : "Surface, text & lines"}</b>
                      <em>{group === "Brand"
                        ? "What the site signals with — measured against the canvas"
                        : "What the site sits on, and the text and lines drawn on it"}</em>
                    </div>
                    <div className="m6-rows">
                      {COLOR_ROLES.filter((r) => r.group === group).map((role) => {
                    const hex = working.colors[role.key];
                    const row = contrastFor(role.key);
                    return (
                      <div className="m6-crow" key={role.key} data-role={role.key}>
                        <button
                          type="button"
                          className={`m6-swatch-btn ${colorFor?.role === role.key ? "is-open" : ""}`}
                          style={{ background: hex }}
                          aria-label={`${role.label} colour, ${hex}. Open picker`}
                          disabled={readOnly}
                          onClick={(e) => setColorFor({ role: role.key, el: e.currentTarget })}
                        >
                          <span className="m6-swatch-btn-hex">{hex}</span>
                        </button>
                        <div className="m6-crow-main">
                          <div className="m6-crow-top">
                            <b>{role.label}</b>
                            <button
                              className="m6-hex-copy" type="button"
                              aria-label={`Copy ${hex}`}
                              onClick={() => { navigator.clipboard?.writeText(hex).catch(() => undefined); setRecent((r) => [hex, ...r.filter((x) => x !== hex)].slice(0, 6)); }}
                            >
                              {hex}<Icon name="copy" size={10} />
                            </button>
                          </div>
                          <div className="m6-crow-sub">{role.use}</div>
                        </div>
                        {row ? (
                          <Tip text={`${row.label} — ${formatRatio(row.ratio)} against ${row.bg === working.colors.background ? "background" : "surface"} · ${row.advisory ? "advisory floor" : "needs"} ${row.need}:1`}>
                            <span className={`m6-crow-ratio is-${row.verdict}`}>{formatRatio(row.ratio)}</span>
                          </Tip>
                        ) : (
                          <Tip text={`${role.label} is a reference surface — it is measured against, not measured itself`}>
                            <span className="m6-crow-ratio is-base">base</span>
                          </Tip>
                        )}
                      </div>
                    );
                      })}
                    </div>
                  </div>
                ))}

                <div className="m6-derived-line">
                  <span className="m6-swatch-chip" style={{ background: onPrimary(working.colors.primary) }} aria-hidden />
                  <div>
                    <b>On primary · derived</b>
                    <em>{onPrimary(working.colors.primary)} — chosen automatically for 4.5:1 on the primary button. Read-only.</em>
                  </div>
                </div>

                <div className="m6-sec-head mt">
                  <h3>Geometry &amp; Layout</h3>
                  <p>Discrete values only. Each one compiles to a CSS variable the renderer reads.</p>
                </div>

                <div className="m6-field">
                  <label className="m6-label">Border Radius</label>
                  <Segmented
                    ariaLabel="Border radius" disabled={readOnly}
                    value={working.geometry.radiusPx}
                    options={RADIUS_OPTIONS.map((r) => ({ value: r.value, label: r.label.split(" · ")[0], sub: `${r.value}px` }))}
                    onChange={(v) => commit((t) => ({ ...t, geometry: { ...t.geometry, radiusPx: v } }))}
                  />
                  <p className="m6-hint">Rounds cards, inputs and buttons that use the global radius token.</p>
                </div>

                <div className="m6-field">
                  <label className="m6-label">Spacing base</label>
                  <Segmented
                    ariaLabel="Spacing base" disabled={readOnly}
                    value={working.geometry.spacing.base}
                    options={[{ value: 4 as const, label: "4 px", sub: "tight" }, { value: 8 as const, label: "8 px", sub: "default" }]}
                    onChange={(v) => commit((t) => ({ ...t, geometry: { ...t.geometry, spacing: { ...t.geometry.spacing, base: v } } }))}
                  />
                  <div className="m6-scale-row">
                    {spacingScale(working).map((n) => (
                      <span key={n} style={{ minWidth: `${Math.min(64, 8 + n * 1.4)}px` }}>{n}</span>
                    ))}
                    <em>scale = base × 1 · 2 · 4 · 6 · 8</em>
                  </div>
                </div>

                <div className="m6-field">
                  <label className="m6-label">Density</label>
                  <Segmented
                    ariaLabel="Density" disabled={readOnly}
                    value={working.geometry.spacing.density}
                    options={DENSITY_OPTIONS.map((d) => ({ value: d.value, label: d.label }))}
                    onChange={(v) => commit((t) => ({ ...t, geometry: { ...t.geometry, spacing: { ...t.geometry.spacing, density: v } } }))}
                  />
                  <p className="m6-hint">Multiplies section padding 0.75× / 1× / 1.25× without touching the step scale.</p>
                </div>

                <div className="m6-field">
                  <label className="m6-label">Container Width</label>
                  <Segmented
                    ariaLabel="Container width" disabled={readOnly}
                    value={working.geometry.containerWidthPx}
                    options={CONTAINER_OPTIONS.map((c) => ({ value: c.value, label: String(c.value), sub: c.label.split(" · ")[1] }))}
                    onChange={(v) => commit((t) => ({ ...t, geometry: { ...t.geometry, containerWidthPx: v } }))}
                  />
                </div>

                <div className="m6-field">
                  <label className="m6-label">Block styling <i className="m6-tag">closed enum</i></label>
                  <div className="m6-pair-fields">
                    <div>
                      <span className="m6-sub-label">Card density</span>
                      <Segmented
                        ariaLabel="Card density" disabled={readOnly}
                        value={working.blockStyling.cardDensity}
                        options={[{ value: "compact" as const, label: "Compact" }, { value: "comfortable" as const, label: "Comfortable" }]}
                        onChange={(v) => commit((t) => ({ ...t, blockStyling: { ...t.blockStyling, cardDensity: v } }))}
                      />
                    </div>
                    <div>
                      <span className="m6-sub-label">Elevation</span>
                      <Segmented
                        ariaLabel="Elevation" disabled={readOnly}
                        value={working.blockStyling.elevation}
                        options={[{ value: "flat" as const, label: "Flat" }, { value: "soft" as const, label: "Soft" }]}
                        onChange={(v) => commit((t) => ({ ...t, blockStyling: { ...t.blockStyling, elevation: v } }))}
                      />
                    </div>
                  </div>
                  <p className="m6-hint">Only these two treatments are token-level. Per-block appearance belongs to the Visual Builder inspector.</p>
                </div>

                <div className="m6-ty-summary">
                  <div className="m6-ty-summary-h">
                    <span className="m6-label">Typography</span>
                    <button className="m6-link" onClick={() => setTab("type")}>Edit in Typography<Icon name="arrowRight" size={10} /></button>
                  </div>
                  <div className="m6-ty-summary-b">
                    <span style={{ fontFamily: `'${working.typography.heading.family}', system-ui` }}>{working.typography.heading.family}</span>
                    <i>+</i>
                    <span style={{ fontFamily: `'${working.typography.body.family}', system-ui` }}>{working.typography.body.family}</span>
                  </div>
                </div>

                <div className="m6-editor-foot">
                  <Btn icon="refresh" disabled={readOnly} onClick={() => setResetOpen(true)}>Reset to Defaults</Btn>
                  <span className="grow" />
                  <button
                    className="m6-undo" type="button" disabled={!undoStack.length || readOnly} onClick={undo}
                    title={undoStack.length ? `Undo the last token change · ${undoStack.length} step${undoStack.length === 1 ? "" : "s"} left · ⌘Z` : "Nothing to undo yet"}
                  >
                    <Icon name="refresh" size={11} />Undo
                  </button>
                </div>
              </>
            )}

            {/* ---------- TYPOGRAPHY ---------- */}
            {tab === "type" && (
              <>
                <div className="m6-banner is-soft">
                  <Icon name="shield" size={13} />
                  {FONT_STATS.embedded} of {FONT_STATS.total.toLocaleString()} Google Fonts families ship inside this build as self-hosted woff2 ({(FONT_STATS.bytes / 1e6).toFixed(1)} MB). The other {(FONT_STATS.total - FONT_STATS.embedded).toLocaleString()} are searchable — “Get” hands you the command to pull any of them in.
                </div>

                {(["heading", "body"] as const).map((role) => {
                  const t = working.typography[role];
                  const family = FONT_CATALOG.find((f) => f.family === t.family);
                  return (
                    <div className="m6-card" key={role}>
                      <div className="m6-card-head">
                        <span className="m6-card-title">{role === "heading" ? "Heading Font" : "Body Font"}</span>
                        <span className="m6-card-meta">{family?.category ?? "—"} · {family?.license ?? "—"}</span>
                      </div>

                      <label className="m6-label">Font family</label>
                      <button
                        type="button" className="m6-combo" disabled={readOnly}
                        aria-haspopup="listbox"
                        onClick={(e) => setFontFor({ role, el: e.currentTarget })}
                      >
                        <span className="m6-combo-sample" style={{ fontFamily: `'${t.family}', system-ui` }}>Aa</span>
                        <span className="m6-combo-body">
                          <b style={{ fontFamily: `'${t.family}', system-ui` }}>{t.family}</b>
                          <em>{family?.weights.join(" / ") ?? "—"}</em>
                        </span>
                        <Icon name="chevDown" size={13} />
                      </button>

                      <label className="m6-label mt">Weight</label>
                      <div className="m6-weights">
                        {(family?.weights ?? [400]).map((w) => (
                          <button
                            key={w} type="button" disabled={readOnly}
                            className={`m6-weight ${t.weight === w ? "is-on" : ""}`}
                            aria-pressed={t.weight === w}
                            onClick={() => commit((x) => ({ ...x, typography: { ...x.typography, [role]: { ...x.typography[role], weight: w } } }))}
                          >
                            {w}
                          </button>
                        ))}
                        {(family?.weights ?? []).length === 1 && <em className="m6-weight-note">Variable face — one file covers 100–900.</em>}
                      </div>

                      <label className="m6-label mt">Fallback stack</label>
                      <select
                        className="m6-select" value={t.fallback} disabled={readOnly}
                        aria-label={`${role} fallback stack`}
                        onChange={(e) => commit((x) => ({ ...x, typography: { ...x.typography, [role]: { ...x.typography[role], fallback: e.target.value } } }))}
                      >
                        {FALLBACK_STACKS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                  );
                })}

                <div className="m6-card" data-m6="type-scale">
                  <div className="m6-card-head">
                    <span className="m6-card-title">Type Scale</span>
                    <span className="m6-card-meta">{typeStamp(working)} px · ratio {working.typography.scale.ratio.toFixed(3)}</span>
                  </div>

                  <div className="m6-scale-two">
                    <div>
                      <label className="m6-label">Base size</label>
                      <Segmented
                        ariaLabel="Base font size" disabled={readOnly}
                        value={working.typography.scale.basePx}
                        options={BASE_SIZES.map((n) => ({ value: n as number, label: String(n) }))}
                        onChange={(v) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, basePx: v } } }))}
                      />
                    </div>
                    <div>
                      <label className="m6-label">Ratio</label>
                      <select
                        className="m6-select" aria-label="Scale ratio" disabled={readOnly}
                        value={working.typography.scale.ratio}
                        onChange={(e) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, ratio: Number(e.target.value) } } }))}
                      >
                        {SCALE_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="m6-hint">
                    {SCALE_RATIOS.find((r) => r.value === working.typography.scale.ratio)?.use}. h1 is {typeSizes(working).h1} px and caption {typeSizes(working).caption} px — six steps derived from one base, not six numbers typed by hand.
                  </p>

                  <div className="m6-slider-group">
                    <span className="m6-label">Line height</span>
                    <div className="m6-sliders">
                      <ScaleSlider
                        label="Heading" value={working.typography.scale.leadingHeading}
                        min={1} max={1.4} step={0.05} format={(v) => v.toFixed(2)} disabled={readOnly}
                        onChange={(v) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, leadingHeading: v } } }))}
                      />
                      <ScaleSlider
                        label="Body" value={working.typography.scale.leadingBody}
                        min={1.4} max={1.8} step={0.05} format={(v) => v.toFixed(2)} disabled={readOnly}
                        onChange={(v) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, leadingBody: v } } }))}
                      />
                    </div>
                  </div>
                  <div className="m6-slider-group">
                    <span className="m6-label">Letter spacing · em</span>
                    <div className="m6-sliders">
                      <ScaleSlider
                        label="Heading" value={working.typography.scale.trackingHeading}
                        min={-0.03} max={0} step={0.005} format={(v) => v.toFixed(3)} disabled={readOnly}
                        onChange={(v) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, trackingHeading: v } } }))}
                      />
                      <ScaleSlider
                        label="Body" value={working.typography.scale.trackingBody}
                        min={0} max={0.01} step={0.001} format={(v) => v.toFixed(3)} disabled={readOnly}
                        onChange={(v) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, trackingBody: v } } }))}
                      />
                    </div>
                    <p className="m6-hint">Display type usually tightens; body copy usually does not.</p>
                  </div>

                  <label className="m6-check">
                    <input
                      type="checkbox" checked={working.typography.scale.fluid} disabled={readOnly}
                      onChange={(e) => commit((x) => ({ ...x, typography: { ...x.typography, scale: { ...x.typography.scale, fluid: e.target.checked } } }))}
                    />
                    <span>
                      <b>Fluid headings</b>
                      <em>Emits clamp() between 420 and 1180 px. h1–h3 breathe; body copy never moves — that is the difference between fluid type and a shrinking page.</em>
                    </span>
                  </label>

                  <div className="m6-ramp" role="table" aria-label="Type scale preview">
                    {TYPE_STEPS.map((step) => {
                      const size = typeSizes(working)[step];
                      const isHead = step === "h1" || step === "h2" || step === "h3";
                      /* short strings: the ramp lives in a 250 px pane, so the
                         sample has to survive at h1 size without ellipsis */
                      const sample: Record<TypeStep, string> = {
                        h1: "Study abroad",
                        h2: "Destinations",
                        h3: "Talk to an expert",
                        body: "Applications are open for the September intake.",
                        small: "Closes 30 June",
                        caption: "Updated 12 minutes ago"
                      };
                      return (
                        <div className="m6-ramp-row" key={step} role="row" data-m6-step={step}>
                          <div className="m6-ramp-key" role="cell">
                            <b>{step}</b>
                            <em>{size} px · {isHead ? working.typography.scale.leadingHeading : working.typography.scale.leadingBody} lh · {isHead ? working.typography.scale.trackingHeading.toFixed(3) : working.typography.scale.trackingBody.toFixed(3)}em</em>
                          </div>
                          <div
                            className={`m6-ramp-sample ${isHead ? "is-head" : "is-body"}`} role="cell"
                            style={{
                              fontFamily: isHead
                                ? `'${working.typography.heading.family}', system-ui`
                                : `'${working.typography.body.family}', system-ui`,
                              fontWeight: isHead ? working.typography.heading.weight : step === "small" || step === "caption" ? 500 : working.typography.body.weight,
                              fontSize: typeSizeCss(working, step),
                              lineHeight: isHead ? working.typography.scale.leadingHeading : working.typography.scale.leadingBody,
                              letterSpacing: `${isHead ? working.typography.scale.trackingHeading : working.typography.scale.trackingBody}em`,
                              color: step === "caption" || step === "small" ? working.colors.muted : working.colors.text
                            }}
                          >
                            {sample[step]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="m6-hint">
                    {working.typography.scale.fluid
                      ? `Fluid on — h1 renders ${typeSizeCss(working, "h1")} in the preview.`
                      : "Fluid off — every step is a fixed px value at all widths."}
                  </p>
                </div>

                <div className="m6-field">
                  <label className="m6-label">Pairing shortcuts</label>
                  <div className="m6-pairing-chips">
                    {PAIRINGS.map((p) => {
                      const on = working.typography.heading.family === p.heading && working.typography.body.family === p.body;
                      return (
                        <button
                          key={p.id} type="button" disabled={readOnly}
                          className={`m6-chip ${on ? "is-on" : ""}`}
                          onClick={() => commit((x) => ({
                            ...x,
                            typography: {
                              ...x.typography,
                              heading: { ...x.typography.heading, family: p.heading },
                              body: { ...x.typography.body, family: p.body }
                            }
                          }))}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="m6-hint">A pairing sets both roles at once — it is a shortcut for the two fields above, not a third source of truth.</p>
                </div>

                <div className="m6-prev-card">
                  <div className="m6-card-head">
                    <span className="m6-card-title">Font Pairing Preview</span>
                    <span className="m6-card-meta">
                      {fontsReady ? <><Icon name="check" size={11} /> fonts ready</> : <><Spinner /> loading preview font…</>}
                    </span>
                  </div>
                  <div className="m6-prev-body" style={{ background: working.colors.background }}>
                    <div
                      className="m6-prev-h"
                      style={{
                        fontFamily: `'${working.typography.heading.family}', system-ui`,
                        fontWeight: working.typography.heading.weight,
                        color: working.colors.text
                      }}
                    >
                      Study abroad with confidence
                    </div>
                    <p
                      className="m6-prev-p"
                      style={{ fontFamily: `'${working.typography.body.family}', system-ui`, fontWeight: working.typography.body.weight, color: working.colors.text }}
                    >
                      {working.typography.heading.family} ({working.typography.heading.weight}) sets the hierarchy at {typeSizes(working).h1} px; {working.typography.body.family} ({working.typography.body.weight}) carries the copy at {working.typography.scale.basePx} px / {working.typography.scale.leadingBody}.
                    </p>
                    <div className="m6-prev-actions">
                      <span
                        className="m6-prev-btn"
                        style={{ background: working.colors.primary, color: onPrimary(working.colors.primary), borderRadius: working.geometry.radiusPx }}
                      >
                        Explore programs
                      </span>
                      <span className="m6-prev-link" style={{ color: working.colors.primary, fontFamily: `'${working.typography.body.family}', system-ui` }}>
                        Talk to an expert
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`m6-fontjob is-${fontJob}`}>
                  <Icon name={fontJob === "failed" ? "alert" : fontJob === "ready" ? "check" : "refresh"} size={13} />
                  <div>
                    <b>
                      {fontJob === "failed" ? "Font processing failed" : fontJob === "ready" ? "Fonts verified" : "Preparing fonts…"}
                    </b>
                    <em>
                      {fontJob === "failed"
                        ? fontCheck.message
                        : fontJob === "ready"
                          ? fontCheck.message
                          : "Checking the embedded woff2 assets declared by this pairing."}
                    </em>
                  </div>
                  {fontJob === "failed" && (
                    <div className="m6-fontjob-actions">
                      <Btn onClick={() => setFontJob("preparing")} icon="refresh">Retry</Btn>
                      <Btn onClick={() => setTab("type")} icon="type">Choose another font</Btn>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ---------- PRESETS ---------- */}
            {tab === "presets" && (
              <>
                <div className="m6-sec-head">
                  <h3>Preset Library <span className="m6-count">{filteredPresets.length}</span></h3>
                  <p>Applying a preset is explicit and reversible — it changes the working draft, never a release.</p>
                </div>

                <div className="m6-preset-tools">
                  <div className="m6-search">
                    <Icon name="search" size={13} />
                    <input value={presetQ} placeholder="Search presets…" aria-label="Search presets" onChange={(e) => setPresetQ(e.target.value)} />
                    {presetQ && <button className="m6-clear" onClick={() => setPresetQ("")} aria-label="Clear search"><Icon name="x" size={12} /></button>}
                  </div>
                  <Btn icon="plus" disabled={readOnly} onClick={() => { setModalErr(""); setCreateOpen(true); }}>Create</Btn>
                </div>

                <div className="m6-chiprow">
                  {(["All", "Built-in", "Workspace", "This Site"] as const).map((s) => (
                    <button
                      key={s} className={`m6-chip ${presetScope === s ? "is-on" : ""}`}
                      onClick={() => setPresetScope(s)}
                    >
                      {s === "All" ? "All presets" : s}
                      <em>{s === "All" ? presets.length : presets.filter((p) => p.scope === s).length}</em>
                    </button>
                  ))}
                </div>

                <div className="m6-preset-list">
                  {filteredPresets.map((p) => {
                    /* “Active source” means the working tokens ARE this preset — not a
                       stale provenance id, which would claim a match after hand edits. */
                    const active = JSON.stringify(p.tokens) === JSON.stringify(working);
                    const isPreview = previewPreset?.id === p.id;
                    return (
                      <article className={`m6-preset ${isPreview ? "is-previewing" : ""}`} key={p.id}>
                        <div className="m6-preset-head">
                          <div>
                            <b className="m6-preset-name">{p.name}</b>
                            <span className="m6-preset-scope">{p.scope}{p.builtIn ? " · read-only" : ""}</span>
                          </div>
                          <button
                            className="m6-kebab" aria-label={`Actions for ${p.name}`} disabled={readOnly}
                            onClick={(e) => setPresetMenu({ preset: p, el: e.currentTarget })}
                          >
                            <Icon name="more" size={14} />
                          </button>
                        </div>
                        <p className="m6-preset-desc">{p.desc}</p>
                        <div className="m6-preset-sw">
                          {[p.tokens.colors.primary, p.tokens.colors.secondary, p.tokens.colors.accent, p.tokens.colors.surface].map((c, i) => (
                            <span key={i} style={{ background: c }} />
                          ))}
                          <em>{p.tokens.typography.heading.family} + {p.tokens.typography.body.family} · {p.tokens.geometry.radiusPx}px · {p.tokens.geometry.containerWidthPx}px</em>
                        </div>
                        <div className="m6-preset-foot">
                          {active && <Pill tone="violet" className="m6-badge">Active source</Pill>}
                          <span className="grow" />
                          <Btn onClick={() => setPreviewPreset(isPreview ? null : p)}>
                            {isPreview ? "Return to Draft" : "Preview"}
                          </Btn>
                          <Btn
                            variant="primary" disabled={readOnly || active}
                            title={active ? "This is the active theme source" : undefined}
                            onClick={() => { setModalErr(""); setApplyFor(p); }}
                          >
                            {active ? "Applied" : "Apply"}
                          </Btn>
                        </div>
                      </article>
                    );
                  })}
                  {!filteredPresets.length && (
                    <div className="m6-empty-inline">
                      <Icon name="code" size={18} />
                      <b>No presets match</b>
                      <span>Clear the search or import a preset file.</span>
                    </div>
                  )}
                </div>

                <div
                  className={`m6-drop ${dragOver ? "is-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) readFile(f);
                  }}
                >
                  <Icon name="upload" size={18} />
                  <b>JSON preset — import or export</b>
                  <span>Drop a <code>.json</code> theme here, or browse. Max 256 KB, schema version 1, validated before anything is written.</span>
                  <div className="m6-drop-actions">
                    <Btn icon="folder" disabled={readOnly} onClick={() => fileRef.current?.click()}>Choose file</Btn>
                    <Btn icon="download" onClick={() => setExportOpen(true)}>Export theme JSON</Btn>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ============ CENTRE: preview ============ */}
        <div className="m6-center">
          {previewPreset && (
            <div className="m6-preview-strip">
              <Icon name="eye" size={13} />
              <span>Previewing <b>{previewPreset.name}</b> — not applied to your draft.</span>
              <span className="grow" />
              <Btn onClick={() => setPreviewPreset(null)}>Return to Draft</Btn>
              <Btn variant="primary" disabled={readOnly} onClick={() => setApplyFor(previewPreset)}>Apply Preset</Btn>
            </div>
          )}
          <ThemePreview
            tokens={shown}
            device={device}
            onDevice={setDevice}
            chip={stateChip}
            pages={pages}
            page={pageId}
            onPage={(id) => { setPageId(id); setUseSample(false); }}
            blocks={blocks}
            zoomLabel={pvMode === "specimen" ? "rendered at studio width" : device === "desktop" ? "scaled to fit the studio" : "actual size"}
            mode={pvMode}
            onMode={setPvMode}
            empty={
              <div className="m6-pv-noPage">
                <Icon name="file" size={20} />
                <b>No blocks to preview</b>
                <span>
                  {pages.length
                    ? "This page’s draft is empty. Use the sample composition to judge the tokens, or pick another page."
                    : "This site has no pages yet. The sample composition renders the same tokens without one."}
                </span>
                <Btn variant="primary" onClick={() => setUseSample(true)}>Use sample composition</Btn>
              </div>
            }
          />
          {useSample && (
            <div className="m6-preview-strip is-quiet">
              <Icon name="info" size={12} />
              <span>Rendering the sample “Study Abroad” composition — decorative copy, not site content.</span>
              <span className="grow" />
              <Btn onClick={() => setUseSample(false)}>Back to page</Btn>
            </div>
          )}
        </div>

        {/* ============ RIGHT: overview ============ */}
        <ThemeOverview
          tokens={shown}
          live={payload.live}
          draft={payload.draft}
          summary={summary}
          usage={usage}
          dirty={dirty}
          saving={saving}
          publishing={publishing}
          fontsVerified={fontCheck.ok ? fontCheck.message.split(" · ")[0] : "font verification failed"}
          onEditTypography={() => setTab("type")}
          onFixRole={(role) => { if (role) { setTab("brand"); setColorFocus(role); } }}
          onFocusRole={(role) => { setTab("brand"); setColorFocus(role); }}
          onViewUsage={() => setUsageOpen(true)}
          onPublish={() => { setPublishing(true); window.setTimeout(() => { setPublishing(false); setPublishOpen(true); }, 180); }}
          onHistory={() => guard(() => {
            app.go("overview");
            app.toast({ type: "info", title: "Release history", sub: "Releases and their token revisions are listed on the dashboard until Publishing & Releases ships." });
          })}
          history={payload.history}
          onRestore={restoreRevision}
          onOpenRevisions={() => setRevOpen(true)}
        />
      </div>

      {/* ---------------- popovers ---------------- */}
      {colorFor && (
        <ColorField
          anchor={colorFor.el}
          open
          roleLabel={COLOR_ROLES.find((r) => r.key === colorFor.role)!.label}
          value={working.colors[colorFor.role]}
          recent={recent}
          onCommit={(hex) => setColor(colorFor.role, hex)}
          onReset={() => resetToken(colorFor.role)}
          onClose={() => setColorFor(null)}
        />
      )}

      {fontFor && (
        <FontCombobox
          anchor={fontFor.el}
          open
          roleLabel={fontFor.role}
          value={working.typography[fontFor.role].family}
          onPick={(family) => {
            const fam = FONT_CATALOG.find((f) => f.family === family);
            const weight = fam && !fam.weights.includes(working.typography[fontFor.role].weight) ? fam.weights[0] : working.typography[fontFor.role].weight;
            commit((t) => ({ ...t, typography: { ...t.typography, [fontFor.role]: { ...t.typography[fontFor.role], family, weight } } }));
          }}
          onClose={() => setFontFor(null)}
        />
      )}

      <Popover anchor={exportBtn.current} open={exportOpen} onClose={() => setExportOpen(false)} align="right">
        <MenuLabel>Export theme JSON</MenuLabel>
        <MenuItem onClick={() => doExport("draft")} icon="file" meta={`#${payload.draft.seq}`}>Export saved draft</MenuItem>
        <MenuItem onClick={() => doExport("live")} icon="shield" meta={`#${payload.live.seq}`}>Export live theme</MenuItem>
        <MenuLabel>Working copy</MenuLabel>
        <MenuItem onClick={() => { setExportOpen(false); setTab("presets"); }} icon="upload">
          Import JSON…
        </MenuItem>
      </Popover>

      <Popover anchor={presetMenu?.el ?? null} open={!!presetMenu} onClose={() => setPresetMenu(null)} align="right">
        {presetMenu && (
          <>
            <MenuLabel>{presetMenu.preset.name}</MenuLabel>
            <MenuItem onClick={() => { setPreviewPreset(presetMenu.preset); setPresetMenu(null); }} icon="eye">Preview</MenuItem>
            <MenuItem onClick={() => { setModalErr(""); setDupFor(presetMenu.preset); setPresetMenu(null); }} icon="copy">Duplicate</MenuItem>
            <MenuItem
              onClick={() => { setModalErr(""); setRenameFor(presetMenu.preset); setPresetMenu(null); }}
              icon="pencil"
              disabled={presetMenu.preset.builtIn}
              meta={presetMenu.preset.builtIn ? "built-in" : undefined}
            >Rename</MenuItem>
            <MenuItem
              onClick={() => {
                const p = presetMenu.preset;
                download(`${slug(p.name)}-theme-preset.json`, presetDocument(p));
                app.toast({ type: "success", title: "Preset exported", sub: `${slug(p.name)}-theme-preset.json` });
                setPresetMenu(null);
              }}
              icon="download"
            >
              Export JSON
            </MenuItem>
            <div className="menu-sep" />
            <MenuItem
              onClick={() => { setDeleteFor(presetMenu.preset); setPresetMenu(null); }}
              icon="trash" danger disabled={presetMenu.preset.builtIn}
            >
              Delete
            </MenuItem>
          </>
        )}
      </Popover>

      <input
        ref={fileRef} type="file" accept="application/json,.json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
      />

      {/* ---------------- dialogs ---------------- */}
      {resetOpen && (
        <ResetModal
          tokens={working}
          onClose={() => setResetOpen(false)}
          onConfirm={() => { commit(() => clone(DEFAULT_TOKENS)); setResetOpen(false); app.toast({ type: "info", title: "Working tokens reset to defaults", sub: "Save Brand Tokens to make it a revision." }); }}
        />
      )}

      {applyFor && (
        <ApplyPresetModal
          preset={applyFor} current={working}
          onClose={() => setApplyFor(null)}
          onApply={() => applyPreset(applyFor)}
        />
      )}

      {importFor && (
        <ImportReviewModal
          result={importFor.result} file={importFor.file}
          onClose={() => setImportFor(null)}
          onImport={async () => {
            const preset = importFor.result.preset!;
            try {
              const saved = await ThemeAPI.addPreset(preset);
              afterPresetChange();
              setImportFor(null);
              setTab("presets");
              setPresetScope("All");
              app.toast({ type: "success", title: `“${saved.name}” imported to the preset library`, sub: "Nothing is applied yet — choose Apply on the card when you want it." });
            } catch (e) {
              setImportFor({ ...importFor, result: { ...importFor.result, ok: false, errors: [{ path: "name", message: (e as Error).message }] } });
            }
          }}
        />
      )}

      {createOpen && (
        <PresetNameModal
          title="Create Theme Preset" sub="Saves the current working tokens as a reusable preset — no release." icon="plus"
          initialName={[`${site?.name ?? "Site"} theme copy`]}
          initialDesc=""
          scope={[{ name: "This Site — only this website", value: "This Site" }, { name: "Workspace — every site in this workspace", value: "Workspace" }]}
          error={modalErr}
          onClose={() => setCreateOpen(false)}
          onSubmit={async ({ name, desc, scope }) => {
            try {
              await ThemeAPI.addPreset({
                id: `preset_${Date.now().toString(36)}`,
                name: name.trim(), desc: desc.trim() || "Saved from the working theme.", scope,
                tokens: clone(working), builtIn: false, updatedAt: Date.now(), createdBy: "You", referencedBy: []
              });
              afterPresetChange(); setCreateOpen(false);
              app.toast({ type: "success", title: "Preset created", sub: `${name.trim()} · ${scope}` });
            } catch (e) { setModalErr((e as Error).message); }
          }}
        />
      )}

      {(renameFor || dupFor) && (
        <PresetNameModal
          title={renameFor ? "Rename Preset" : "Duplicate Preset"}
          sub={renameFor ? renameFor.name : `Copy of ${dupFor!.name}`}
          icon={renameFor ? "pencil" : "copy"}
          initialName={renameFor ? [renameFor.name] : [`${dupFor!.name} (copy)`]}
          scope={renameFor ? [{ name: renameFor.scope, value: renameFor.scope }] : [{ name: "This Site", value: "This Site" }, { name: "Workspace", value: "Workspace" }]}
          error={modalErr}
          onClose={() => { setRenameFor(null); setDupFor(null); }}
          onSubmit={async ({ name }) => {
            try {
              if (renameFor) await ThemeAPI.renamePreset(renameFor.id, name);
              else {
                const copy = await ThemeAPI.duplicatePreset(dupFor!.id);
                if (name.trim() && name.trim() !== copy.name) await ThemeAPI.renamePreset(copy.id, name);
              }
              afterPresetChange(); setRenameFor(null); setDupFor(null);
              app.toast({ type: "success", title: renameFor ? "Preset renamed" : "Preset duplicated", sub: name.trim() });
            } catch (e) { setModalErr((e as Error).message); }
          }}
        />
      )}

      {deleteFor && (
        <DeletePresetModal
          preset={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDelete={async () => {
            try {
              await ThemeAPI.deletePreset(deleteFor.id);
              afterPresetChange(); setDeleteFor(null);
              app.toast({ type: "success", title: "Preset deleted", sub: "Live releases are unchanged." });
            } catch (e) { setModalErr((e as Error).message); }
          }}
          onArchive={async () => {
            try {
              await ThemeAPI.archivePreset(deleteFor.id);
              afterPresetChange(); setDeleteFor(null);
              app.toast({ type: "info", title: "Preset archived", sub: "Its references still resolve; it can no longer be applied." });
            } catch (e) { setModalErr((e as Error).message); }
          }}
        />
      )}

      {revOpen && (
        <RevisionsModal
          history={payload.history}
          live={payload.live}
          draft={payload.draft}
          onClose={() => setRevOpen(false)}
          onRestore={restoreRevision}
        />
      )}

      {conflict && (
        <ConflictModal
          latest={conflict} current={working}
          onClose={() => setConflict(null)}
          onReviewLatest={() => {
            setWorking(clone(conflict.tokens));
            setPayload((p) => (p ? { ...p, draft: conflict } : p));
            setConflict(null);
            app.toast({ type: "info", title: `Loaded revision #${conflict.seq}`, sub: "Your working edits were discarded." });
          }}
          onKeepCopy={() => {
            const copy = clone(working);
            setConflict(null);
            setCreateOpen(true);
            app.toast({ type: "info", title: "Keep your version as a preset", sub: "Save it under a new name, then re-apply it onto the newer draft." });
            void copy;
          }}
        />
      )}

      {leave && (
        <LeaveModal
          saving={saving}
          onStay={() => setLeave(null)}
          onDiscard={() => {
            setWorking(clone(payload.draft.tokens));
            setUndoStack([]);
            const run = leave.run;
            setLeave(null);
            run();
          }}
          onSaveContinue={async () => {
            const ok = await save();
            if (!ok) return;
            const run = leave.run;
            setLeave(null);
            run();
          }}
        />
      )}

      {usageOpen && (
        <UsageModal
          usage={usage} pages={pages}
          onClose={() => setUsageOpen(false)}
          onOpenPage={(id) => {
            setUsageOpen(false);
            guard(() => {
              app.go("builder");
              app.toast({ type: "info", title: "Opening the page", sub: `Page ${id} — the builder opens with its draft.` });
            });
          }}
        />
      )}

      {publishOpen && (
        <PublishReviewModal
          draft={payload.draft} live={payload.live} summary={summary}
          fontsVerified={fontCheck.ok ? fontCheck.message.split(" · ")[0] : "font verification failed"}
          onClose={() => setPublishOpen(false)}
          onOpen={() => {
            setPublishOpen(false);
            if (!app.can("publish")) {
              app.toast({ type: "error", title: "Your role cannot publish", sub: "Ask an owner or admin to run the release." });
              return;
            }
            app.openModal({ kind: "preflight" });
          }}
        />
      )}
    </div>
  );

  /* scrolls the editor to a colour row (used by the Fix CTA on a warning) */
  function setColorFocus(role: ColorRole) {
    window.setTimeout(() => {
      const el = document.querySelector(`.m6-crow[data-role="${role}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("is-flash");
        window.setTimeout(() => el.classList.remove("is-flash"), 1100);
      }
    }, 90);
  }
}
