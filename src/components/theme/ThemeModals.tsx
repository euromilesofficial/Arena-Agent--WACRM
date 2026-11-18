/* ============================================================
   Module 6 · Theme Studio — dialogs
   ------------------------------------------------------------
   Every guard the module promises, in one file so the copy can be
   audited: reset, preset apply/review, JSON import review, preset
   create/rename/duplicate/delete, save conflict, unsaved-navigation
   guard, usage detail and the publish review hand-off.

   None of these dialogs writes anything themselves — the screen passes
   the confirmed action down, so a dialog can never half-apply a change.
   ============================================================ */
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Field, Modal, Pill } from "@/components/ui";
import {
  COLOR_ROLES, DEFAULT_TOKENS, ThemeAPI, dateLong, formatRatio, revisionDiff,
  type ContrastRow, type ContrastSummary, type ImportResult, type Preset, type ThemeRevision,
  type ThemeTokens, type Usage
} from "@/lib/theme-db";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="m6-d-row"><span className="m6-d-key">{label}</span><span className="m6-d-val">{children}</span></div>
);

const hsvSwatch = (hex: string) => <span className="m6-d-sw" style={{ background: hex }} aria-hidden />;

/* ---------------- reset ---------------- */

export function ResetModal({ tokens, onClose, onConfirm }: {
  tokens: ThemeTokens; onClose: () => void; onConfirm: () => void;
}) {
  const changed = ThemeAPI.diff(DEFAULT_TOKENS, tokens);
  return (
    <Modal
      title="Reset Brand Tokens?" icon="refresh" width="narrow" onClose={onClose}
      sub="Working settings only — the published website does not change."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn variant="primary" onClick={onConfirm}>Reset Draft Tokens</Btn>
      </>}
    >
      <p className="m6-d-p">
        This will replace your working theme settings with the default values. Your published website will not change
        until a new release is published.
      </p>
      <div className="m6-d-block">
        <div className="m6-d-h">Affected token groups</div>
        <div className="m6-d-chips">
          {["Colours (9 roles)", "Typography (2 roles)", "Radius", "Spacing", "Container width", "Block styling"].map((c) => (
            <span key={c} className="m6-d-chip">{c}</span>
          ))}
        </div>
      </div>
      <div className="m6-d-block">
        <Row label="Undo">
          <span>Available for this session — ⌘/Ctrl+Z restores the previous working state.</span>
        </Row>
        <Row label="Persisted">
          <span>Nothing. Reset is a working edit; it needs <b>Save Brand Tokens</b> to become a draft revision.</span>
        </Row>
        <Row label="Live release">
          <span>{changed.length === 0 ? "Unaffected." : "Unaffected — publishing a new release is the only path to the public site."}</span>
        </Row>
      </div>
    </Modal>
  );
}

/* ---------------- preset apply ---------------- */

export function ApplyPresetModal({ preset, current, onClose, onApply }: {
  preset: Preset; current: ThemeTokens; onClose: () => void; onApply: (scope: "theme" | "layout") => void;
}) {
  const diff = ThemeAPI.diff(current, preset.tokens);
  return (
    <Modal
      title="Review Preset Changes" icon="layers" width="wide" onClose={onClose}
      sub={`${preset.name} · ${preset.scope} · updated ${dateLong(preset.updatedAt)}`}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn variant="primary" onClick={() => onApply("theme")}>Apply to Draft</Btn>
      </>}
    >
      <p className="m6-d-p">Compare the selected preset with your current theme before applying it to your draft.</p>

      <div className="m6-d-block">
        <div className="m6-d-h">Semantic diff · {diff.length} change{diff.length === 1 ? "" : "s"}</div>
        {diff.length === 0 ? (
          <p className="m6-d-p muted">This preset is identical to your working theme — applying it would not change anything.</p>
        ) : (
          <div className="m6-d-table">
            {diff.map((d) => (
              <div key={d.label} className="m6-d-trow">
                <span className="m6-d-tkey">{d.label}</span>
                <span className="m6-d-from">{/^#[0-9A-F]{6}$/i.test(d.from) ? hsvSwatch(d.from) : null}{d.from}</span>
                <Icon name="arrowRight" size={11} />
                <span className="m6-d-to">{/^#[0-9A-F]{6}$/i.test(d.to) ? hsvSwatch(d.to) : null}{d.to}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="m6-d-block">
        <div className="m6-d-h">What gets replaced</div>
        <label className="m6-d-radio is-on">
          <input type="radio" name="apply-scope" checked readOnly />
          <span>
            <b>Theme settings only — keep existing layouts and navigation</b>
            <em>Colours, typography, geometry and the two compatible block-style tokens.</em>
          </span>
        </label>
        <label className="m6-d-radio is-off" title="Applies only to imported files that carry starter layouts">
          <input type="radio" name="apply-scope" disabled />
          <span>
            <b>Replace starter layouts &amp; navigation after review</b>
            <em>Not available — this preset carries no layouts, and Layouts &amp; Templates is not enabled in this workspace.</em>
          </span>
        </label>
      </div>
    </Modal>
  );
}

/* ---------------- import review ---------------- */

export function ImportReviewModal({ result, file, onClose, onImport }: {
  result: ImportResult; file: string; onClose: () => void; onImport: () => void;
}) {
  const [mode, setMode] = useState<"keep" | "replace">("keep");
  const s = result.summary;
  const ok = result.ok && result.preset;

  return (
    <Modal
      title="Import Theme Preset — Review Changes" icon="upload" width="wide" onClose={onClose}
      sub={<span className="m6-mono">{file}</span>}
      footer={ok ? (
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={onImport} icon="check">Import Preset</Btn>
        </>
      ) : (
        <>
          <span className="m6-d-warnline"><Icon name="alert" size={13} />Nothing was imported and your draft is untouched.</span>
          <span className="grow" />
          <Btn onClick={onClose}>Close</Btn>
        </>
      )}
    >
      {ok ? (
        <>
          <p className="m6-d-p">
            The imported file contains theme settings. It lands in the Preset Library as <b>{result.preset!.name}</b> —
            applying it to your draft is a separate, explicit step.
          </p>
          <div className="m6-d-block">
            <div className="m6-d-h">Summary</div>
            <div className="m6-d-grid">
              <span className="m6-d-k">Colours</span>
              <span className="m6-d-v">{s?.colors ?? 0} / 9 roles · {result.preset!.tokens.colors.primary}</span>
              <span className="m6-d-k">Typography</span>
              <span className="m6-d-v">{result.preset!.tokens.typography.heading.family} + {result.preset!.tokens.typography.body.family}</span>
              <span className="m6-d-k">Block styling</span>
              <span className="m6-d-v">{result.preset!.tokens.blockStyling.cardDensity} cards · {result.preset!.tokens.blockStyling.elevation} elevation</span>
              <span className="m6-d-k">Radius / container</span>
              <span className="m6-d-v">{result.preset!.tokens.geometry.radiusPx}px · {result.preset!.tokens.geometry.containerWidthPx}px</span>
              <span className="m6-d-k">Starter layout</span>
              <span className="m6-d-v">{s?.starterLayouts ? "Present in file — not applied" : "Not in file"}</span>
              <span className="m6-d-k">Navigation</span>
              <span className="m6-d-v">{s?.navigation ? "Present in file — not applied" : "Not in file"}</span>
            </div>
          </div>
          <div className="m6-d-block">
            <div className="m6-d-h">Import scope</div>
            <label className={`m6-d-radio ${mode === "keep" ? "is-on" : ""}`}>
              <input type="radio" name="imp" checked={mode === "keep"} onChange={() => setMode("keep")} />
              <span><b>Keep existing layout</b><em>Approved theme settings only. Pages, layouts and menus are untouched.</em></span>
            </label>
            <label className={`m6-d-radio is-off ${mode === "replace" ? "is-on" : ""}`}>
              <input type="radio" name="imp" disabled checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span><b>Replace layout after review</b><em>Disabled — a master layout depends on shared header and footer regions that an imported file cannot supply. Templates import through Layouts &amp; Templates.</em></span>
            </label>
          </div>
          {result.warnings.length > 0 && (
            <div className="m6-d-block">
              <div className="m6-d-h">Advisories</div>
              {result.warnings.map((w) => (
                <div key={w} className="m6-d-line"><Icon name="info" size={11} />{w}</div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="m6-d-block">
          <div className="m6-d-h">
            {result.errors.length} validation error{result.errors.length === 1 ? "" : "s"}
          </div>
          <div className="m6-d-errors">
            {result.errors.map((e) => (
              <div key={e.path + e.message} className="m6-d-err">
                <code>{e.path}</code>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- preset create / rename / duplicate ---------------- */

export function PresetNameModal({ title, sub, icon = "copy", initialName, initialDesc, scope, onSubmit, onClose, error }: {
  title: string; sub?: string; icon?: string; initialName: string[]; initialDesc?: string;
  scope: { name: string; value: Preset["scope"] }[]; onSubmit: (v: { name: string; desc: string; scope: Preset["scope"] }) => void;
  onClose: () => void; error?: string;
}) {
  const [name, setName] = useState(initialName[0] ?? "");
  const [desc, setDesc] = useState(initialDesc ?? "");
  const [sc, setSc] = useState<Preset["scope"]>(scope[0].value);
  const bad = !name.trim();
  return (
    <Modal
      title={title} sub={sub} icon={icon} width="narrow" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn variant="primary" disabled={bad} onClick={() => onSubmit({ name, desc, scope: sc })}>Save</Btn>
      </>}
    >
      <Field label="Preset name *">
        <input className={`input ${bad ? "is-bad" : ""}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      {bad && <p className="m6-d-fielderr">Give the preset a name.</p>}
      {initialDesc !== undefined && (
        <Field label="Description">
          <textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
      )}
      <Field label="Scope">
        {scope.map((s) => (
          <label key={s.value} className="m6-d-radio">
            <input type="radio" name="scope" checked={sc === s.value} onChange={() => setSc(s.value)} />
            <span><b>{s.name}</b></span>
          </label>
        ))}
      </Field>
      {error && <p className="m6-d-fielderr">{error}</p>}
    </Modal>
  );
}

export function DeletePresetModal({ preset, onClose, onDelete, onArchive }: {
  preset: Preset; onClose: () => void; onDelete: () => void; onArchive: () => void;
}) {
  const blocked = preset.referencedBy.length > 0;
  return (
    <Modal
      title="Delete preset?" icon="trash" width="narrow" onClose={onClose}
      sub={preset.name}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        {blocked
          ? <Btn onClick={onArchive}>Archive instead</Btn>
          : <Btn variant="danger" onClick={onDelete}>Delete preset</Btn>}
      </>}
    >
      <p className="m6-d-p">
        This will delete “{preset.name}” from the reusable preset library. Existing published website releases will not be altered.
      </p>
      {blocked ? (
        <div className="m6-d-block">
          <div className="m6-d-h"><Icon name="lock" size={11} /> In use — deletion is blocked</div>
          <p className="m6-d-p sm">
            {preset.referencedBy.join(", ")} {preset.referencedBy.length === 1 ? "is" : "are"} built from this preset.
            Point {(preset.referencedBy.length === 1 ? "it" : "them")} at another preset first, or archive it so it can no
            longer be applied while the references keep resolving.
          </p>
        </div>
      ) : (
        <div className="m6-d-block">
          <Row label="Scope"><span>{preset.scope}</span></Row>
          <Row label="Referenced by"><span>Nothing in this workspace</span></Row>
          <Row label="Live site"><span>Unchanged — deletion does not touch a release manifest</span></Row>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- save conflict ---------------- */

export function ConflictModal({ latest, current, onClose, onReviewLatest, onKeepCopy }: {
  latest: ThemeRevision; current: ThemeTokens; onClose: () => void;
  onReviewLatest: () => void; onKeepCopy: () => void;
}) {
  const diff = ThemeAPI.diff(latest.tokens, current);
  return (
    <Modal
      title="Theme Updated Elsewhere" icon="alert" width="wide" onClose={onClose}
      sub={`Revision #${latest.seq} was saved by ${latest.createdBy} while you were editing`}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn onClick={onKeepCopy} icon="copy">Keep my draft as a copy</Btn>
        <Btn variant="primary" onClick={onReviewLatest}>Review latest</Btn>
      </>}
    >
      <p className="m6-d-p">
        Someone else saved a newer theme revision while you were editing. Review the differences before continuing —
        nothing has been overwritten.
      </p>
      <div className="m6-d-block">
        <div className="m6-d-h">What the newer revision changed · {diff.length} difference{diff.length === 1 ? "" : "s"}</div>
        {diff.length === 0 ? (
          <p className="m6-d-p sm">The newer revision is identical to your working state. Saving again will simply be a no-op rebase.</p>
        ) : (
          <div className="m6-d-table">
            {diff.map((d) => (
              <div key={d.label} className="m6-d-trow">
                <span className="m6-d-tkey">{d.label}</span>
                <span className="m6-d-from">theirs {d.from}</span>
                <Icon name="arrowRight" size={11} />
                <span className="m6-d-to">yours {d.to}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- unsaved navigation guard ---------------- */

export function LeaveModal({ saving, onStay, onDiscard, onSaveContinue }: {
  saving: boolean; onStay: () => void; onDiscard: () => void; onSaveContinue: () => void;
}) {
  return (
    <Modal
      title="You have unsaved theme changes" icon="alert" width="narrow" onClose={onStay}
      footer={<>
        <Btn variant="ghost" onClick={onStay}>Stay</Btn>
        <Btn variant="danger" onClick={onDiscard}>Discard Changes</Btn>
        <span className="grow" />
        <Btn variant="primary" loading={saving} onClick={onSaveContinue}>Save Draft &amp; Continue</Btn>
      </>}
    >
      <p className="m6-d-p">Save a draft before leaving, or discard your local changes. No release is created either way.</p>
      <div className="m6-d-block">
        <Row label="Drafting"><span>A saved draft never reaches the public site.</span></Row>
        <Row label="Discarding"><span>Reverts to the last saved revision. Undo is lost when you leave.</span></Row>
      </div>
    </Modal>
  );
}

/* ---------------- usage detail ---------------- */

export function UsageModal({ usage, pages, onClose, onOpenPage }: {
  usage: Usage; pages: { id: string; title: string; path: string }[];
  onClose: () => void; onOpenPage: (id: string) => void;
}) {
  return (
    <Modal
      title="Theme usage" icon="link" width="wide" onClose={onClose}
      sub={`${usage.pages} pages · ${usage.blocks} block types · ${usage.templates} section templates`}
      footer={<><span className="grow" /><Btn onClick={onClose}>Close</Btn></>}
    >
      <p className="m6-d-p">
        Every number is projected from this workspace’s own CMS content — pages whose draft contains at least one
        token-consuming block, the distinct block types in those drafts, and the section templates in the library.
      </p>
      <div className="m6-d-block">
        <div className="m6-d-h">Pages that resolve these tokens</div>
        <div className="m6-d-table">
          {pages.map((p) => (
            <button key={p.id} className="m6-d-trow is-link" onClick={() => onOpenPage(p.id)}>
              <span className="m6-d-tkey"><Icon name="file" size={11} />{p.title}</span>
              <span className="m6-d-from m6-mono">{p.path}</span>
              <span className="m6-d-to">Open in builder<Icon name="arrowRight" size={11} /></span>
            </button>
          ))}
          {!pages.length && <p className="m6-d-p sm">No pages in this site consume tokens yet.</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- publish review hand-off ---------------- */

export function PublishReviewModal({ draft, live, summary, fontsVerified, onClose, onOpen }: {
  draft: ThemeRevision; live: ThemeRevision; summary: ContrastSummary;
  fontsVerified: string; onClose: () => void; onOpen: () => void;
}) {
  const diff = ThemeAPI.diff(live.tokens, draft.tokens);
  return (
    <Modal
      title="Review for publish" icon="upload" width="wide" onClose={onClose}
      sub={`Draft revision #${draft.seq} · live release references #${live.seq}`}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <span className="grow" />
        <Btn variant="primary" onClick={onOpen} icon="arrowRight">Open release review</Btn>
      </>}
    >
      <p className="m6-d-p">
        Theme Studio does not publish. The saved draft becomes part of the next release manifest, and the release flow
        owns preflight, compare-and-swap and history.
      </p>
      <div className="m6-d-block">
        <div className="m6-d-h">Readiness</div>
        <div className="m6-d-checks">
          <div className="is-ok"><Icon name="check" size={12} />Token schema valid</div>
          <div className={summary.warned ? "is-warn" : "is-ok"}>
            <Icon name={summary.warned ? "alert" : "check"} size={12} />
            Contrast: {summary.passed} passed · {summary.warned} warning{summary.warned === 1 ? "" : "s"}
          </div>
          <div className="is-ok"><Icon name="check" size={12} />Fonts: {fontsVerified}</div>
          <div className="is-ok"><Icon name="check" size={12} />Working tree clean — no unsaved edits</div>
        </div>
        <p className="m6-d-p sm">
          Contrast warnings are advisories: they are listed in the release review and do not block a draft from saving.
        </p>
      </div>
      <div className="m6-d-block">
        <div className="m6-d-h">Token changes since the live revision · {diff.length}</div>
        {diff.length === 0
          ? <p className="m6-d-p sm">The saved draft matches the live revision exactly — the release would ship no token change.</p>
          : (
            <div className="m6-d-table">
              {diff.map((d) => (
                <div key={d.label} className="m6-d-trow">
                  <span className="m6-d-tkey">{d.label}</span>
                  <span className="m6-d-from">{d.from}</span>
                  <Icon name="arrowRight" size={11} />
                  <span className="m6-d-to">{d.to}</span>
                </div>
              ))}
            </div>
          )}
      </div>
      <div className="m6-d-block">
        <Row label="Contrast floor"><span>{formatRatio(summary.worst)} — worst measured pair in this draft</span></Row>
        <Row label="Colour roles"><span>{COLOR_ROLES.length} persisted + 1 derived (on-primary)</span></Row>
        <Row label="Rollback"><span>Restore the previous <b>release</b>, not the theme: releases carry tokens, layouts and menus together.</span></Row>
      </div>
    </Modal>
  );
}

/* ---------------- contrast pair table (shared) ------------- */

export function PairList({ rows, onFix, compact = false }: {
  rows: ContrastRow[]; onFix?: (r: ContrastRow) => void; compact?: boolean;
}) {
  return (
    <ul className={`m6-pairs ${compact ? "is-compact" : ""}`}>
      {rows.map((r) => (
        <li key={r.id} className={`m6-pair is-${r.verdict}`}>
          <span className="m6-pair-sw" style={{ background: r.bg }} aria-hidden>
            <i style={{ color: r.fg }}>Aa</i>
          </span>
          <span className="m6-pair-body">
            <span className="m6-pair-label">{r.label}</span>
            <span className="m6-pair-meta" title={r.kind === "text" ? "Measured as text — 4.5:1 required" : "Measured as a non-text mark — 3:1 required"}>
              {formatRatio(r.ratio)} · needs {r.need}:1
            </span>
          </span>
          {r.verdict === "pass"
            ? <Pill tone="green" className="m6-pair-pill">Pass</Pill>
            : <button className="m6-pair-fix" onClick={() => onFix?.(r)} title={r.hint}>Fix</button>}
        </li>
      ))}
    </ul>
  );
}

/* ============================================================
   G4 · Revisions — the history that used to be data only
   ------------------------------------------------------------
   `ThemePayload.history` was loaded, appended to on every save, and rendered
   nowhere. This modal makes it a real surface: what changed in each revision,
   who saved it, and a restore that re-enters the working copy rather than
   writing behind the user's back.
   ============================================================ */

export function RevisionsModal({ history, live, draft, onClose, onRestore }: {
  history: ThemeRevision[];
  live: ThemeRevision;
  draft: ThemeRevision;
  onClose: () => void;
  onRestore: (rev: ThemeRevision) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const list = [...history].reverse();
  const selected = list.find((r) => r.id === pick) ?? null;
  const diff = selected ? revisionDiff(history, selected) : [];

  return (
    <Modal
      title="Revision History"
      sub={`${history.length} revision${history.length === 1 ? "" : "s"} for this site — drafts and releases, newest first.`}
      icon="calendar"
      onClose={onClose}
      width="wide"
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          <span className="grow" />
          <Btn
            variant="primary"
            icon="refresh"
            disabled={!selected || selected.id === draft.id}
            title={!selected ? "Pick a revision first" : selected.id === draft.id ? "That revision is already the saved draft" : undefined}
            onClick={() => selected && onRestore(selected)}
          >
            Restore into working copy
          </Btn>
        </>
      }
    >
      <div className="m6-revh">
        <div className="m6-revh-list" role="listbox" aria-label="Revisions">
          {list.map((r) => {
            const d = revisionDiff(history, r);
            const isDraft = r.id === draft.id;
            const isLive = r.id === live.id;
            return (
              <button
                key={r.id} type="button" role="option"
                aria-selected={pick === r.id}
                className={`m6-revh-row ${pick === r.id ? "is-on" : ""}`}
                onClick={() => setPick(r.id)}
                data-m6-rev={r.seq}
              >
                <span className="m6-revh-seq">#{r.seq}</span>
                <span className="m6-revh-body">
                  <b>
                    {isLive ? "Published" : isDraft ? "Saved draft" : "Earlier draft"}
                    <em> · {r.createdBy}</em>
                  </b>
                  <em>{d.length ? `${d.length} token${d.length === 1 ? "" : "s"} changed` : "initial revision"} · {dateLong(r.createdAt)}</em>
                </span>
                {isLive && <span className="pill pill-green">live</span>}
                {isDraft && !isLive && <span className="pill pill-violet">draft</span>}
              </button>
            );
          })}
        </div>

        <div className="m6-revh-diff">
          {!selected ? (
            <div className="m6-revh-hint">
              <Icon name="calendar" size={20} />
              <b>Pick a revision</b>
              <em>Its token-by-token diff against the revision before it appears here before you restore anything.</em>
            </div>
          ) : (
            <>
              <div className="m6-revh-diff-head">
                <b>Revision #{selected.seq}</b>
                <em>{selected.createdBy} · {dateLong(selected.createdAt)}</em>
              </div>
              {diff.length === 0 ? (
                <p className="m6-fine">This revision changed nothing in the token document — it is the first revision, or a re-save of identical values.</p>
              ) : (
                <table className="m6-revh-table">
                  <thead><tr><th>Group</th><th>Token</th><th>From</th><th>To</th></tr></thead>
                  <tbody>
                    {diff.map((d) => (
                      <tr key={`${d.group}-${d.label}`}>
                        <td>{d.group}</td>
                        <td>{d.label}</td>
                        <td><code>{d.from}</code></td>
                        <td><code>{d.to}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="m6-fine">
                Restoring loads these values into the working copy. Nothing is written until you press Save Brand Tokens,
                and nothing reaches the live site until a release is published.
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
