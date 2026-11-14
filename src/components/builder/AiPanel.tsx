/* ============================================================
   AI mode — the composer that docks over the canvas
   ------------------------------------------------------------
   Two jobs, one surface:
     · build   — describe a page (or one section) and get real
                 blocks from the registry, planned before they land
     · rewrite — restyle the wording of the selected element
   The panel never writes to the document. It hands the Builder a
   finished list and the Builder commits it, so undo, autosave,
   revisions and the block limit all still apply.
   ============================================================ */
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Btn } from "@/components/ui";
import { AI_BUDGET, AI_PROMPT_MAX, AI_PROMPT_MIN, AI_PROVIDER, type GenSection } from "@/lib/builder-db";

export type AiMode = "page" | "section" | "copy";
export type AiStage = "idle" | "running" | "ready" | "error";

export interface AiPanelState {
  mode: AiMode;
  prompt: string;
  stage: AiStage;
  plan: GenSection[];
  planDone: boolean;
  text: string;
  message?: string;
  source?: string;
  label?: string;
}

const SUGGESTIONS: Record<AiMode, string[]> = {
  page: ["A landing page to book a free counselling call", "Scholarships page for Indian students", "Study in Germany programme page", "Event registration page for a university fair"],
  section: ["Three reasons to choose us", "Fees and what is included", "Questions parents always ask", "Student testimonials"],
  copy: ["Make it punchier", "Shorten to one sentence", "Make it more formal", "Lead with the offer"]
};

const HINTS: Record<AiMode, string> = {
  page: "Builds from the block library with draft copy — no invented stats, claims or names.",
  section: "One section, chosen from the block library and inserted at the selection.",
  copy: "Rewrites the selected element's own words. No new claims. Nothing changes until you insert."
};

const PLACEHOLDER: Record<AiMode, string> = {
  page: "Describe the page you want to build…",
  section: "What should this section say or do?",
  copy: "How should this line change?",
};

const STEP_LABEL: Record<AiMode, string> = { page: "Plan the page", section: "Plan the section", copy: "Rewrite the line" };

export function AiPanel(props: {
  state: AiPanelState;
  maxBlocks: number;
  room: number;
  hasSelection: boolean;
  onMode: (m: AiMode) => void;
  onPrompt: (v: string) => void;
  onRun: () => void;
  onStop: () => void;
  onInsert: () => void;
  onClose: () => void;
}) {
  const { state, onMode, onPrompt, onRun, onStop, onInsert, onClose, room, hasSelection, maxBlocks } = props;
  const area = useRef<HTMLTextAreaElement>(null);
  const running = state.stage === "running";
  const ready = state.stage === "ready";

  useEffect(() => {
    if (state.mode === "copy" && !state.prompt) area.current?.focus();
  }, [state.mode, state.prompt]);

  const chars = state.prompt.trim().length;
  const canRun = !running && chars >= AI_PROMPT_MIN && (state.mode !== "copy" || hasSelection);
  const overBudget = AI_BUDGET.used >= AI_BUDGET.cap;
  const primaryLabel = ready
    ? state.mode === "page"
      ? `Insert ${state.plan.length} section${state.plan.length === 1 ? "" : "s"}`
      : state.mode === "section" ? "Insert section" : "Replace copy"
    : running ? "Stop" : "Generate";

  return (
    <div className={`wb-aip${state.stage === "error" ? " is-error" : ""}`} data-ai-panel={state.mode} data-ai-stage={state.stage} role="dialog" aria-label="AI Copy">
      <div className="wb-aip-head">
        <span className="wb-aip-badge"><Icon name="sparkles" size={13} /></span>
        <b className="wb-aip-title">AI Copy</b>
        <span className="wb-aip-prov" title={`${AI_PROVIDER.source} · ${AI_PROVIDER.model}`}>{AI_PROVIDER.label}</span>
        <span className="wb-aip-budget" data-ai-budget={AI_BUDGET.used}>
          <span className="wb-aip-bar"><i style={{ width: `${Math.min(100, (AI_BUDGET.used / AI_BUDGET.cap) * 100)}%` }} /></span>
          {AI_BUDGET.used} / {AI_BUDGET.cap} today
        </span>
        <button className="wb-aip-x" onClick={onClose} aria-label="Close AI Copy" title="Close"><Icon name="x" size={13} /></button>
      </div>

      <div className="wb-aip-modes" role="tablist" aria-label="AI task">
        {([["page", "Build a page", "file"], ["section", "Add a section", "layers"], ["copy", "Rewrite copy", "pencil"]] as [AiMode, string, string][]).map(([m, label, icon]) => (
          <button key={m} role="tab" aria-selected={state.mode === m} className={`wb-aip-mode${state.mode === m ? " is-on" : ""}`}
            onClick={() => onMode(m)} disabled={running}>
            <Icon name={icon} size={12} /> {label}
          </button>
        ))}
      </div>

      {state.stage === "idle" || state.stage === "error" ? (
        <>
          <div className="wb-aip-input">
            <textarea ref={area} value={state.prompt} maxLength={AI_PROMPT_MAX} rows={2} spellCheck={false}
              placeholder={state.mode === "copy" && hasSelection ? `Rewrite “${state.prompt ? "" : state.label ?? ""}” — say how.` : PLACEHOLDER[state.mode]}
              onChange={(e) => onPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canRun) onRun(); } }} />
            <span className="wb-aip-count">{chars}/{AI_PROMPT_MAX}</span>
          </div>
          <div className="wb-aip-chips">
            {SUGGESTIONS[state.mode].map((s) => (
              <button key={s} className="wb-aip-chip" onClick={() => onPrompt(state.mode === "copy" ? s : s)}>{s}</button>
            ))}
          </div>
          {state.mode === "copy" && !hasSelection && (
            <div className="wb-aip-warn" data-ai-warn="no-selection"><Icon name="alert" size={12} /> Select a text element in the canvas, then rewrite it here.</div>
          )}
          {state.stage === "error" && (
            <div className="wb-aip-warn is-bad" data-ai-error="1"><Icon name="alert" size={12} /> {state.message}</div>
          )}
          <div className="wb-aip-foot">
            <span className="wb-aip-hint"><Icon name="shield" size={11} /> {HINTS[state.mode]}</span>
            <div className="flex gap8">
              <Btn onClick={onClose}>Cancel</Btn>
              {overBudget
                ? <Btn variant="primary" disabled title="Daily budget reached">Budget reached</Btn>
                : <Btn variant="primary" icon="sparkles" disabled={!canRun} onClick={onRun}>{state.stage === "error" ? "Try again" : "Generate"}</Btn>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="wb-aip-run">
            <div className="wb-aip-steps">
              <div className="wb-aip-step is-done">
                <span className="wb-aip-dot">{running ? <span className="wb-aip-spin" /> : <Icon name="check" size={10} />}</span>
                <span className="wb-aip-stepl">{STEP_LABEL[state.mode]}</span>
                {running && <span className="wb-aip-stept">{state.mode === "copy" ? "rewriting" : "choosing sections"}</span>}
              </div>
              {state.mode !== "copy" && state.plan.map((g, i) => (
                <div key={`${g.type}-${i}`} className="wb-aip-step is-done" data-plan-row={g.type}>
                  <span className="wb-aip-dot"><Icon name="check" size={10} /></span>
                  <span className="wb-aip-stepl">{g.label}</span>
                  <span className="wb-aip-stept">{g.why}</span>
                </div>
              ))}
              {running && state.mode !== "copy" && (
                <div className="wb-aip-step is-live">
                  <span className="wb-aip-dot"><span className="wb-aip-spin" /></span>
                  <span className="wb-aip-stepl">{state.planDone ? "Writing copy" : "Choosing the next section"}</span>
                </div>
              )}
            </div>

            {state.mode === "copy" && ready && state.source && state.text.trim() === state.source.trim() && (
              <div className="wb-aip-warn" data-ai-noop="1"><Icon name="check" size={12} /> This line is already that short — nothing to cut.</div>
            )}
            {state.mode === "copy" && (
              <div className="wb-aip-quote" data-ai-text={state.text ? 1 : 0}>
                {state.source && <s>{state.source}</s>}
                <p>{state.text || "…"}{running && <span className="wb-caret" />}</p>
              </div>
            )}

            {state.mode !== "copy" && ready && (
              <div className="wb-aip-summary">
                <Icon name="check" size={12} />
                {state.plan.length} section{state.plan.length === 1 ? "" : "s"} planned ·{" "}
                {Math.min(room, state.plan.length) === state.plan.length
                  ? "fits this page"
                  : `only ${room} of ${state.plan.length} will fit before the ${maxBlocks}-block limit`}
                {" "}· draft copy you can edit
              </div>
            )}
          </div>

          <div className="wb-aip-foot">
            <span className="wb-aip-hint">
              <Icon name="shield" size={11} />
              {running ? "You can stop this — nothing has been written to the page yet." : HINTS[state.mode]}
            </span>
            <div className="flex gap8">
              {running ? <Btn icon="x" onClick={onStop}>Stop</Btn>
                : <>
                    <Btn onClick={onClose}>Discard</Btn>
                    <Btn variant="primary" icon="check" onClick={onInsert} disabled={!ready || (state.mode !== "copy" && room === 0)}>{primaryLabel}</Btn>
                  </>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
