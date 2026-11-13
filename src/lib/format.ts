/* ============================================================
   Formatting + small utilities shared by every screen
   ============================================================ */

export const fmtInt = (n: number): string => Math.round(n).toLocaleString("en-US");

export const fmtDec = (n: number, d = 1): string => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

export const fmtPct = (n: number, d = 2): string => `${fmtDec(n, d)}%`;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Real CSV download from an array of rows — used by the status-bar export. */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Human range label used by the toolbar + footer. */
export function rangeLabel(days: number): string {
  if (days === 7) return "Last 7 days";
  if (days === 14) return "Last 14 days";
  if (days === 30) return "Last 30 days";
  if (days === 90) return "Last 90 days";
  return `Last ${days} days`;
}
