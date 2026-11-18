/* ============================================================
   Revision diff — what changed between two stored structures.

   A revision stores a full StructureSnapshot. The history drawer used to
   show only a block-count delta. This compares two snapshots leaf by leaf:
     · objects by key, arrays of objects by their `id` (so a reordered or
       inserted block is reported as that block, not as every index after it)
     · a block added, removed, or with a changed prop is named by its type
   It is pure: no store access, no React. Long values are shortened so a
   row stays one line.
   ============================================================ */

export interface DiffLine {
  kind: "added" | "removed" | "changed";
  path: string;
  before?: string;
  after?: string;
}

const MAX = 70;
const short = (v: unknown): string => {
  const s = v === undefined ? "∅" : typeof v === "string" ? v : JSON.stringify(v);
  return s.length > MAX ? s.slice(0, MAX - 1) + "…" : s;
};

/** Human label for an array item: its block type when it is a block, else its id, else its index. */
function itemLabel(item: any, i: number): string {
  if (item && typeof item === "object") {
    if (typeof item.type === "string") return `${item.type}${item.id ? ` (${item.id})` : ""}`;
    if (item.id !== undefined) return String(item.id);
  }
  return `#${i + 1}`;
}

function walk(a: any, b: any, path: string, out: DiffLine[]) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  const aIsObj = a !== null && typeof a === "object";
  const bIsObj = b !== null && typeof b === "object";
  if (Array.isArray(a) || Array.isArray(b)) {
    const A: any[] = Array.isArray(a) ? a : [];
    const B: any[] = Array.isArray(b) ? b : [];
    const keyOf = (x: any, i: number) => (x && typeof x === "object" && x.id !== undefined ? `id:${x.id}` : `ix:${i}`);
    const aKeys = new Map(A.map((x, i) => [keyOf(x, i), x]));
    const bKeys = new Map(B.map((x, i) => [keyOf(x, i), x]));
    B.forEach((x, i) => {
      const k = keyOf(x, i);
      const label = `${path}[${itemLabel(x, i)}]`;
      if (!aKeys.has(k)) out.push({ kind: "added", path: label, after: short(x && x.props ? { type: x.type, props: x.props } : x) });
    });
    A.forEach((x, i) => {
      const k = keyOf(x, i);
      const label = `${path}[${itemLabel(x, i)}]`;
      if (!bKeys.has(k)) out.push({ kind: "removed", path: label, before: short(x && x.props ? { type: x.type, props: x.props } : x) });
      else walk(x, bKeys.get(k), label, out);
    });
    return;
  }
  if (aIsObj && bIsObj) {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
    for (const k of keys) walk(a[k], b[k], path ? `${path}.${k}` : k, out);
    return;
  }
  out.push({ kind: "changed", path: path || "value", before: short(a), after: short(b) });
}

/** Changes from `before` to `after`. Empty when the two structures are identical. */
export function diffStructures(before: unknown, after: unknown): DiffLine[] {
  const out: DiffLine[] = [];
  walk(before ?? {}, after ?? {}, "", out);
  return out;
}

/** A one-line count for the history row, e.g. "2 changed · 1 added". */
export function diffSummary(lines: DiffLine[]): string {
  if (lines.length === 0) return "no structural change";
  const c = (k: DiffLine["kind"]) => lines.filter((l) => l.kind === k).length;
  const parts = [c("changed") && `${c("changed")} changed`, c("added") && `${c("added")} added`, c("removed") && `${c("removed")} removed`].filter(Boolean);
  return parts.join(" · ");
}
