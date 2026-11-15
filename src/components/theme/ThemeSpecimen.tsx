/* ============================================================
   Module 6.1 · Theme Studio — the specimen sheet (G3)
   ------------------------------------------------------------
   The centre pane used to answer one question: does my home page look right?
   It could not answer the other one: does a button, an input, an alert, a table
   row, a badge and a focus ring look right? WordPress answers that with the Style
   Book; this is the same idea for the token layer we actually store.

   Everything here renders from the same compiled variables as the page preview
   (--t-*), so a specimen can never disagree with the site. Read-only by design:
   the specimen is an artefact of the tokens, not a second editor.
   ============================================================ */
import { COLOR_ROLES, typeSizes, typeSizeCss, formatRatio, summarise, onPrimary, spacingScale, type ThemeTokens } from "@/lib/theme-db";

const ROLE_ORDER = COLOR_ROLES.map((r) => r.key);

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="m6-spec-sec">
      <header className="m6-spec-sec-head">
        <h4>{title}</h4>
        {note && <em>{note}</em>}
      </header>
      {children}
    </section>
  );
}

export function ThemeSpecimen({ tokens }: { tokens: ThemeTokens }) {
  const sizes = typeSizes(tokens);
  const audit = summarise(tokens);
  const onBrand = onPrimary(tokens.colors.primary);
  const space = spacingScale(tokens);

  return (
    <div className="m6-spec" data-m6-specimen>
      <header className="m6-spec-head">
        <div>
          <h3>Theme specimen</h3>
          <p>Every primitive the block library renders, drawn with the current tokens — not the homepage.</p>
        </div>
        <div className="m6-spec-score">
          <b>{audit.passed}</b>
          <span>of {audit.rows.length} pairs pass · {audit.warned} to check</span>
        </div>
      </header>

      <Section title="Type scale" note={`${tokens.typography.scale.basePx} px base · ratio ${tokens.typography.scale.ratio.toFixed(3)}`}>
        <div className="m6-spec-type">
          {(["h1", "h2", "h3", "body", "small", "caption"] as const).map((step) => {
            const isHead = step === "h1" || step === "h2" || step === "h3";
            const sample: Record<typeof step, string> = {
              h1: "Study abroad with confidence",
              h2: "Popular destinations",
              h3: "Talk to an expert",
              body: "Applications are open for the September intake across four countries, with scholarships available in each.",
              small: "Applications close 30 June",
              caption: "Updated 12 minutes ago"
            };
            return (
              <div className="m6-spec-type-row" key={step} data-m6-spec-step={step}>
                <span className="m6-spec-type-key">{step} · {sizes[step]} px</span>
                <span
                  style={{
                    fontFamily: isHead ? `'${tokens.typography.heading.family}', system-ui` : `'${tokens.typography.body.family}', system-ui`,
                    fontWeight: isHead ? tokens.typography.heading.weight : step === "small" || step === "caption" ? 500 : tokens.typography.body.weight,
                    fontSize: typeSizeCss(tokens, step),
                    lineHeight: isHead ? tokens.typography.scale.leadingHeading : tokens.typography.scale.leadingBody,
                    letterSpacing: `${isHead ? tokens.typography.scale.trackingHeading : tokens.typography.scale.trackingBody}em`,
                    color: step === "small" || step === "caption" ? tokens.colors.muted : tokens.colors.text,
                    display: "block"
                  }}
                >
                  {sample[step]}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Colour roles" note={`${ROLE_ORDER.length} roles · measured, not asserted`}>
        <div className="m6-spec-palette">
          {COLOR_ROLES.map((role) => {
            const row = audit.rows.find((r) => r.role === role.key);
            return (
              <div className="m6-spec-swatch" key={role.key} data-m6-spec-role={role.key}>
                <span className="m6-spec-chip" style={{ background: tokens.colors[role.key] }} />
                <div className="m6-spec-swatch-body">
                  <b>{role.label}</b>
                  <em>{tokens.colors[role.key]}</em>
                </div>
                {row
                  ? <span className={`m6-spec-badge is-${row.verdict}`}>{formatRatio(row.ratio)}</span>
                  : <span className="m6-spec-badge is-base">{role.kind === "text" ? "text" : "mark"}</span>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Buttons" note="default · hover · focus · disabled">
        <div className="m6-spec-btnrow">
          <button type="button" className="m6-spec-btn is-primary" tabIndex={-1} style={{ background: tokens.colors.primary, color: onBrand }}>Apply now</button>
          <button type="button" className="m6-spec-btn is-primary is-hover" tabIndex={-1}>Apply now</button>
          <button type="button" className="m6-spec-btn is-primary is-focus" tabIndex={-1} style={{ boxShadow: `0 0 0 3px ${tokens.colors.ring}` }}>Apply now</button>
          <button type="button" className="m6-spec-btn is-primary" disabled>Apply now</button>
        </div>
        <div className="m6-spec-btnrow">
          <button type="button" className="m6-spec-btn is-secondary" tabIndex={-1}>Learn more</button>
          <button type="button" className="m6-spec-btn is-ghost" tabIndex={-1} style={{ color: tokens.colors.link }}>Talk to an expert</button>
          <button type="button" className="m6-spec-btn is-danger" tabIndex={-1} style={{ background: tokens.colors.error, color: onPrimary(tokens.colors.error) }}>Delete draft</button>
        </div>
      </Section>

      <Section title="Inputs & controls" note="default · focus · error · consent">
        <div className="m6-spec-fields">
          <label className="m6-spec-field">
            <span>Full name</span>
            <input readOnly value="Aranya Kapoor" tabIndex={-1} />
          </label>
          <label className="m6-spec-field is-focus">
            <span>Email</span>
            <input readOnly value="aranya@euromiles.test" tabIndex={-1} style={{ boxShadow: `0 0 0 3px ${tokens.colors.ring}` }} />
          </label>
          <label className="m6-spec-field is-error">
            <span>Phone</span>
            <input readOnly value="+91 98" tabIndex={-1} style={{ borderColor: tokens.colors.error }} />
            <em style={{ color: tokens.colors.error }}>Enter a full 10-digit number.</em>
          </label>
          <label className="m6-spec-field">
            <span>Destination</span>
            <select defaultValue="uk" tabIndex={-1}>
              <option value="uk">United Kingdom</option>
              <option value="ca">Canada</option>
            </select>
          </label>
        </div>

        <div className="m6-spec-consent" data-m6-spec-consent>
          <span className="m6-spec-check" aria-hidden />
          <div>
            <b>WhatsApp updates</b>
            <em>Unticked by default, explicit and channel-specific — Meta opt-in policy, enforced by the form block.</em>
          </div>
        </div>
      </Section>

      <Section title="Feedback" note="alerts, badges, inline link">
        <div className="m6-spec-alerts">
          {[
            { k: "success", c: tokens.colors.success, t: "Application received", d: "We reply within two working days." },
            { k: "warning", c: tokens.colors.warning, t: "Documents pending", d: "Two files are still missing." },
            { k: "error", c: tokens.colors.error, t: "Upload failed", d: "The file was larger than 10 MB." }
          ].map((a) => (
            <div className={`m6-spec-alert is-${a.k}`} key={a.k} style={{ borderLeftColor: a.c }}>
              <b>{a.t}</b>
              <em>{a.d}</em>
            </div>
          ))}
        </div>
        <div className="m6-spec-pills">
          <span className="m6-spec-pill" style={{ background: tokens.colors.primary, color: onBrand }}>Published</span>
          <span className="m6-spec-pill" style={{ background: tokens.colors.success, color: onPrimary(tokens.colors.success) }}>Approved</span>
          <span className="m6-spec-pill" style={{ background: tokens.colors.warning, color: onPrimary(tokens.colors.warning) }}>Pending</span>
          <span className="m6-spec-pill" style={{ background: tokens.colors.error, color: onPrimary(tokens.colors.error) }}>Failed</span>
          <span className="m6-spec-pill" style={{ background: tokens.colors.surface, color: tokens.colors.muted, borderColor: tokens.colors.border }}>Draft</span>
        </div>
        <p className="m6-spec-prose" style={{ color: tokens.colors.text }}>
          Read the <a href="#specimen" onClick={(e) => e.preventDefault()} style={{ color: tokens.colors.link }}>visa checklist</a> before you book,
          or <span style={{ color: tokens.colors.muted }}>ask an advisor for a call back</span>.
        </p>
      </Section>

      <Section title="Surfaces" note="card, table row, divider">
        <div className="m6-spec-card" style={{ borderColor: tokens.colors.border }}>
          <b>University of Leeds</b>
          <em>3 courses · IELTS 6.5 · £24,500 / year</em>
          <div className="m6-spec-card-foot">
            <span style={{ color: tokens.colors.link }}>View course</span>
            <span className="m6-spec-pill" style={{ background: tokens.colors.surface, color: tokens.colors.text, borderColor: tokens.colors.border }}>Russell Group</span>
          </div>
        </div>
        <table className="m6-spec-table" style={{ borderColor: tokens.colors.border }}>
          <tbody>
            {[["Intake", "Deadline"], ["September 2026", "30 June 2026"], ["January 2027", "15 November 2026"]].map(([a, b], i) => (
              <tr key={a} style={{ borderTopColor: tokens.colors.border, background: i === 0 ? tokens.colors.surface : "transparent" }}>
                <td style={{ color: i === 0 ? tokens.colors.muted : tokens.colors.text }}>{a}</td>
                <td style={{ color: tokens.colors.text }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Radius & spacing" note={`${tokens.geometry.radiusPx} px radius · ${tokens.geometry.spacing.base} px base`}>
        <div className="m6-spec-radii">
          {[0, 4, 8, 12, 16, 24].map((r) => (
            <div className="m6-spec-radius" key={r}>
              <span style={{ borderRadius: r, borderColor: tokens.colors.border }} />
              <em>{r}</em>
            </div>
          ))}
        </div>
        <div className="m6-spec-spacing">
          {space.map((s) => (
            <div className="m6-spec-space" key={s}>
              <span style={{ width: s, background: tokens.colors.primary }} />
              <em>{s} px</em>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
