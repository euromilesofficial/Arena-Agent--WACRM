/* ============================================================
   Module 7 · revision history
   ------------------------------------------------------------
   The layout record already stored a revision number on every write but
   showed nothing: "Revert" used to bump the counter and *claim* it had
   restored the previous structure. This drawer is the honest version —
   it lists what was recorded, what each step changed, and restores a
   stored structure as a new revision instead of pretending.
   ============================================================ */
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Modal, Pill, Skel } from "@/components/ui";
import { useApp } from "@/lib/store";
import { LayoutsAPI, type RevisionEntry } from "@/lib/layout-db";

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export function HistoryModal({ kind, id, name, onClose, onRestored }: {
  kind: "layout" | "template";
  id: string;
  name: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const app = useApp();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<RevisionEntry[]>([]);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    LayoutsAPI.history(kind, id)
      .then((r) => { if (!live) return; setRows(r); setStatus("ready"); })
      .catch((e: Error) => { if (!live) return; setError(e.message); setStatus("error"); });
    return () => { live = false; };
  }, [kind, id]);

  const restore = async (rev: number) => {
    setBusy(rev);
    try {
      await LayoutsAPI.revert(kind, id, rev);
      app.toast({
        type: "success",
        title: `Restored the structure from r${rev}`,
        sub: "Written as a new revision — the current draft was not overwritten in place."
      });
      setConfirm(null);
      onRestored();
      onClose();
    } catch (e) {
      app.toast({ type: "error", title: "Could not restore that revision", sub: (e as Error).message });
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Revision history"
      sub={`${name} · ${rows.length || "…"} recorded revision${rows.length === 1 ? "" : "s"}`}
      icon="clock" onClose={onClose}
      footer={<>
        <span className="m7-hist-note"><Icon name="info" size={11} />Restoring writes a new revision; nothing is rewritten in place.</span>
        <Btn onClick={onClose}>Close</Btn>
      </>}
    >
      {status === "loading" && (
        <div className="m7-hist">
          {[0, 1, 2].map((i) => (
            <div key={i} className="m7-hist-row is-skel"><Skel style={{ height: 34, borderRadius: 8 }} /></div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="m7-hist-error"><Icon name="alert" size={13} /><span>{error}</span></div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="m7-hist-empty">
          <Icon name="clock" size={18} />
          <b>No revisions recorded yet</b>
          <span>Every save of this {kind} writes one. The first save will appear here.</span>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="m7-hist" role="list" aria-label="Revisions">
          {rows.map((r) => (
            <div key={r.id} className={`m7-hist-row ${r.isCurrent ? "is-current" : ""}`} role="listitem">
              <span className="m7-hist-rev">r{r.rev}</span>
              <span className="m7-hist-body">
                <span className="m7-hist-sum">{r.summary}</span>
                <span className="m7-hist-meta">
                  {r.by} · {when(r.at)} · {r.delta}
                  {r.isCurrent && <Pill tone="violet" dot>current draft</Pill>}
                </span>
              </span>
              {confirm === r.rev ? (
                <span className="m7-hist-confirm">
                  <span>Restore r{r.rev}?</span>
                  <Btn onClick={() => setConfirm(null)}>Cancel</Btn>
                  <Btn variant="primary" icon="refresh" loading={busy === r.rev} onClick={() => void restore(r.rev)}>Restore</Btn>
                </span>
              ) : r.isCurrent ? (
                <span className="m7-hist-cur">live draft</span>
              ) : (
                <Btn icon="refresh" disabled={!r.restorable || busy !== null} onClick={() => setConfirm(r.rev)}
                  title={r.restorable ? undefined : "No stored structure for this revision"}>
                  {r.restorable ? "Restore" : "Not stored"}
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
