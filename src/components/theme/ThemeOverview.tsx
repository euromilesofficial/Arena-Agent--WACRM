/* ============================================================
   Module 6 · Theme Studio — right rail (Theme Overview)
   ------------------------------------------------------------
   Five read-only panels, in a fixed order, matching the review's X2:
   Token Summary → Typography Summary → Accessibility → Usage → Theme
   status. Every value is either computed by the contrast engine, projected
   from real CMS content, or taken from a revision record — nothing in this
   rail is a decorative number.
   ============================================================ */
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Pill, Tip } from "@/components/ui";
import {
  COLOR_ROLES, FALLBACK_STACKS, formatRatio, onPrimary, spacingScale,
  type ColorRole, type ContrastRow, type ContrastSummary, type ThemeRevision, type ThemeTokens,
  type Usage
} from "@/lib/theme-db";
import { PairList } from "./ThemeModals";

function Panel({ title, action, children, className = "" }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`m6-panel ${className}`}>
      <header className="m6-panel-head">
        <h3 className="m6-panel-title">{title}</h3>
        {action}
      </header>
      <div className="m6-panel-body">{children}</div>
    </section>
  );
}

const stackLabel = (id: string): string => FALLBACK_STACKS.find((s) => s.id === id)?.label.split(" — ")[1] ?? id;

export function ThemeOverview({
  tokens, live, draft, summary, usage, dirty, saving, publishing,
  onEditTypography, onFixRole, onFocusRole, onViewUsage, onPublish, onHistory, fontsVerified
}: {
  tokens: ThemeTokens;
  live: ThemeRevision;
  draft: ThemeRevision;
  summary: ContrastSummary;
  usage: Usage;
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  onEditTypography: () => void;
  onFixRole: (role: ColorRole | undefined) => void;
  onFocusRole: (role: ColorRole) => void;
  onViewUsage: () => void;
  onPublish: () => void;
  onHistory: () => void;
  fontsVerified: string;
}) {
  const [allPairs, setAllPairs] = useState(false);
  /* warnings first: a failing pair should never sit below the fold of a list
     that says the theme is nearly clean. Ordering is presentation only — the
     counts above are computed over every row. */
  const ordered = [...summary.rows].sort((a, b) => (a.verdict === "warn" ? 0 : 1) - (b.verdict === "warn" ? 0 : 1));
  const rows = allPairs ? ordered : ordered.slice(0, 4);
  const hidden = ordered.length - rows.length;

  const published = draft.seq === live.seq;

  return (
    <aside className="m6-ov" aria-label="Theme overview">
      {/* 1 — tokens */}
      <Panel title="Token Summary" action={<span className="m6-panel-meta">{COLOR_ROLES.length} roles</span>}>
        <div className="m6-swatches">
          {COLOR_ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className="m6-swatch"
              onClick={() => onFocusRole(r.key)}
              title={`${r.label} · ${tokens.colors[r.key]} · ${r.use}`}
            >
              <span className="m6-swatch-chip" style={{ background: tokens.colors[r.key] }} aria-hidden />
              <span className="m6-swatch-text">
                <b>{r.label}</b>
                <em>{tokens.colors[r.key]}</em>
              </span>
            </button>
          ))}
        </div>
        <div className="m6-derived">
          <span className="m6-swatch-chip sm" style={{ background: onPrimary(tokens.colors.primary) }} aria-hidden />
          <span className="m6-swatch-text">
            <b>On primary <i className="m6-tag">derived</i></b>
            <em>{onPrimary(tokens.colors.primary)} · auto-chosen for 4.5:1 on the primary button</em>
          </span>
        </div>
        <div className="m6-geo">
          <span><i>Radius</i>{tokens.geometry.radiusPx}px</span>
          <span><i>Container</i>{tokens.geometry.containerWidthPx}px</span>
          <span><i>Spacing</i>{spacingScale(tokens).join("·")}</span>
          <span><i>Density</i>{tokens.geometry.spacing.density}</span>
        </div>
      </Panel>

      {/* 2 — typography */}
      <Panel
        title="Typography Summary"
        action={<button className="m6-link" onClick={onEditTypography}>Edit<Icon name="arrowRight" size={10} /></button>}
      >
        <div className="m6-type-samples">
          {(["heading", "body"] as const).map((role) => {
            const t = tokens.typography[role];
            return (
              <div key={role} className="m6-type-row">
                <span
                  className={`m6-type-aa ${role === "heading" ? "is-h" : ""}`}
                  style={{ fontFamily: `'${t.family}', ${FALLBACK_STACKS.find((f) => f.id === t.fallback)?.value ?? "system-ui"}` }}
                >
                  Aa
                </span>
                <span className="m6-type-meta">
                  <b>{t.family}</b>
                  <em>{role === "heading" ? "Headings" : "Body"} · {t.weight} · fallback {stackLabel(t.fallback).split(",")[0]}</em>
                </span>
              </div>
            );
          })}
        </div>
        <div className="m6-also">
          <Icon name="check" size={11} />{fontsVerified}
        </div>
      </Panel>

      {/* 3 — accessibility */}
      <Panel
        title="Accessibility Checks"
        action={
          <Tip text={`Worst measured pair ${formatRatio(summary.worst)} · warnings never block a draft from saving`}>
            <Pill tone={summary.warned ? "amber" : "green"} dot>
              {summary.passed} passed{summary.warned ? ` · ${summary.warned} warning${summary.warned === 1 ? "" : "s"}` : ""}
            </Pill>
          </Tip>
        }
      >
        <PairList rows={rows} onFix={(r: ContrastRow) => onFixRole(r.role)} />
        {hidden > 0 && (
          <button className="m6-more" onClick={() => setAllPairs(true)}>
            Show {hidden} more pair{hidden === 1 ? "" : "s"}<Icon name="chevDown" size={11} />
          </button>
        )}
        {allPairs && (
          <button className="m6-more" onClick={() => setAllPairs(false)}>
            Show fewer<Icon name="chevDown" size={11} className="is-up" />
          </button>
        )}
        <p className="m6-fine">Token contrast only — this is not a claim that the site is WCAG compliant.</p>
      </Panel>

      {/* 4 — usage */}
      <Panel title="Usage" action={<button className="m6-link" onClick={onViewUsage}>Details<Icon name="arrowRight" size={10} /></button>}>
        <div className="m6-usage">
          <Tip text="Site pages whose draft contains at least one token-consuming block">
            <div><b>{usage.pages}</b><i>pages</i></div>
          </Tip>
          <Tip text="Distinct block types across those drafts">
            <div><b>{usage.blocks}</b><i>block types</i></div>
          </Tip>
          <Tip text="Section templates in the library that resolve these tokens">
            <div><b>{usage.templates}</b><i>templates</i></div>
          </Tip>
          <Tip text="The theme is site-scoped — exactly one website resolves it">
            <div><b>{usage.websites}</b><i>website</i></div>
          </Tip>
        </div>
        <p className="m6-fine">Projected from this workspace’s CMS content, not a stored counter.</p>
      </Panel>

      {/* 5 — status */}
      <Panel title="Theme Status" className="is-status">
        <div className={`m6-rail ${dirty ? "is-dirty" : ""} ${saving ? "is-saving" : ""}`}>
          <div className={`m6-step ${dirty ? "is-on" : ""}`}>
            <span className="m6-step-dot" /><span className="m6-step-t">Editing</span>
            <em>{dirty ? "local changes" : "clean"}</em>
          </div>
          <div className={`m6-step ${!dirty ? "is-on" : ""}`}>
            <span className="m6-step-dot" /><span className="m6-step-t">Saved Draft</span>
            <em>#{draft.seq} · {draft.createdBy}</em>
          </div>
          <div className={`m6-step ${published ? "is-on is-live" : ""}`}>
            <span className="m6-step-dot" /><span className="m6-step-t">Published</span>
            <em>{published ? `#${live.seq} live` : `#${live.seq} · draft is ahead`}</em>
          </div>
        </div>
        <div className="m6-status-lines">
          <span><i>Draft</i>{draft.id} · saved by {draft.createdBy}</span>
          <span><i>Live</i>{live.id} · release references it</span>
        </div>
        <div className="m6-status-actions">
          <button
            className="btn btn-primary btn-sm m6-publish"
            disabled={dirty || saving || publishing}
            title={dirty ? "Save your theme draft first" : "Opens the release review"}
            onClick={onPublish}
          >
            {publishing ? <span className="spinner" /> : <Icon name="upload" size={12} />}
            Review for Publish
          </button>
          <button className="m6-link" onClick={onHistory}>
            Release history<Icon name="external" size={10} />
          </button>
        </div>
        <p className="m6-fine">
          {dirty
            ? "Unsaved edits are previewed above but are not a revision yet."
            : `Saved drafts need a release to reach the live site. Warnings: ${summary.warned}.`}
        </p>
      </Panel>
    </aside>
  );
}
