/* ============================================================
   AI copy bubble — shared by the visual builder canvas and the
   Module 7 Layouts/Templates canvas, so both behave identically.
   The parent owns the state (stream, accept, close); this only
   renders it. Position is the selected text element's box,
   clamped to the stage width. "right" (default, the builder) sits
   beside the element; "below" sits under it, for narrow canvases
   where a side bubble would cover the very text being edited.
   ============================================================ */
import { Icon } from "@/components/Icon";

export type AiState = { stage: "idle" | "streaming" | "ready" | "error"; text: string; message?: string } | null;

export interface AiBox { top: number; left: number; width: number; height: number }

export function AiBubble({ ai, aiAction, box, stageW, placement = "right", onAskAi, onAiClose, onAcceptAi }: {
  ai: NonNullable<AiState>;
  aiAction: string | null;
  box: AiBox;
  stageW: number;
  placement?: "right" | "below";
  onAskAi: (action: string) => void;
  onAiClose: () => void;
  onAcceptAi: () => void;
}) {
  return (
    <div className="wb-ai" style={placement === "below"
      ? { top: box.top + box.height + 8, left: Math.max(8, Math.min(box.left, stageW - 214)) }
      : { top: box.top + 6, left: Math.max(8, Math.min(box.left + box.width + 12, stageW - 214)) }} role="dialog" aria-label="AI copy">
      {ai.stage === "idle" ? (
        <>
          <div className="wb-ai-head"><span className="wb-ai-spark"><Icon name="sparkles" size={12} /></span> AI Copy<span className="grow" />
            <button className="icon-btn" aria-label="Close AI panel" onClick={onAiClose}><Icon name="x" size={12} /></button>
          </div>
          <div className="wb-ai-actions">
            {[["improve", "Improve"], ["punchier", "Make Punchier"], ["shorten", "Shorten"]].map(([id, label]) => (
              <button key={id} className="wb-ai-act" onClick={() => onAskAi(id)}>
                <Icon name="sparkles" size={11} /> {label}
              </button>
            ))}
          </div>
          <div className="wb-ai-foot">Rewrites your words only — no new claims.</div>
        </>
      ) : (
        <>
          <div className="wb-ai-head">
            <span className="wb-ai-spark"><Icon name="sparkles" size={12} /></span>
            {ai.stage === "streaming" ? "Writing…" : ai.stage === "error" ? "Could not rewrite" : "Suggested copy"}
            <span className="grow" />
            <button className="icon-btn" aria-label="Close AI panel" onClick={onAiClose}><Icon name="x" size={12} /></button>
          </div>
          <div className={`wb-ai-text ${ai.stage === "streaming" ? "is-streaming" : ""}`} data-ai-stream={ai.stage}>
            {ai.message ? <span className="wb-ai-err">{ai.message}</span> : ai.text}
            {ai.stage === "streaming" && <i className="wb-caret" />}
          </div>
          <div className="wb-ai-foot">Nothing changes until you accept.</div>
          <div className="wb-ai-btns">
            <button className="wb-ai-b" disabled={ai.stage !== "ready"} onClick={onAcceptAi}>Accept</button>
            <button className="wb-ai-b ghost" disabled={ai.stage === "streaming"} onClick={() => onAskAi(aiAction ?? "improve")}>Regenerate</button>
            <button className="wb-ai-b ghost" onClick={onAiClose}>Discard</button>
          </div>
        </>
      )}
    </div>
  );
}
