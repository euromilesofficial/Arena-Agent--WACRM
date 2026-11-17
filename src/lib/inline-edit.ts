/* ============================================================
   Inline edit paths — one grammar for every text edit on a canvas.

   A path names one piece of text inside a block's props:
     "heading"          a top-level prop
     "items.2.title"    a field of the third item in an array prop
     "head.0"           the first entry of a string array
     "body#3"           line 3 of a multi-line prop (text blocks)
     "tiers.0.features@2"  item 2 of a comma-separated string (a feature list)

   The renderer reads a path with readPath() and the editor writes it with
   applyEdit(). Both use the same rules, so what is shown is exactly what is
   stored, and an edit can never land on the wrong field.
   ============================================================ */

type Props = Record<string, any>;

const rich = (props: Props, ln: string) => !!props.rich && ln.trim().startsWith("- ");

/** The text a path shows, or undefined when the path does not exist. */
export function readPath(props: Props, path: string): string | undefined {
  const at = path.indexOf("@");
  if (at >= 0) {
    const list = readPath(props, path.slice(0, at));
    const k = Number(path.slice(at + 1));
    const part = list === undefined ? undefined : list.split(",")[k];
    return part === undefined ? undefined : part.trim();
  }
  const hash = path.indexOf("#");
  if (hash >= 0) {
    const key = path.slice(0, hash);
    const i = Number(path.slice(hash + 1));
    const ln = String(props[key] ?? "").split("\n")[i];
    if (ln === undefined) return undefined;
    return rich(props, ln) ? ln.slice(2) : ln;
  }
  const parts = path.split(".");
  let cur: any = props;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[/^\d+$/.test(p) ? Number(p) : p];
  }
  return cur === undefined || cur === null ? undefined : String(cur);
}

/** A link field is an object, or its key ends in "href". Inline text edits it as a link. */
export function linkFromText(text: string): unknown {
  const t = text.trim();
  return t.startsWith("/") ? { kind: "page", path: t } : { kind: "url", url: t };
}

/** Returns new props with one piece of text replaced. Never mutates the input. */
export function applyEdit(props: Props, path: string, text: string): Props {
  const at = path.indexOf("@");
  if (at >= 0) {
    const base = path.slice(0, at);
    const k = Number(path.slice(at + 1));
    const parts = String(readPath(props, base) ?? "").split(",");
    parts[k] = (k > 0 ? " " : "") + text;
    return applyEdit(props, base, parts.join(","));
  }
  const hash = path.indexOf("#");
  if (hash >= 0) {
    const key = path.slice(0, hash);
    const i = Number(path.slice(hash + 1));
    const lines = String(props[key] ?? "").split("\n");
    const ln = lines[i] ?? "";
    lines[i] = (rich(props, ln) ? ln.slice(0, 2) : "") + text;
    return { ...props, [key]: lines.join("\n") };
  }
  const parts = path.split(".");
  const top = parts[0];
  const value = (cur: unknown) => {
    const isLink = (cur !== null && typeof cur === "object") || /href$/i.test(parts[parts.length - 1]);
    return parts.length === 1 && isLink && text.trim() ? linkFromText(text) : text;
  };
  if (parts.length === 1) return { ...props, [top]: value(props[top]) };
  const write = (node: any, idx: number): any => {
    const key = /^\d+$/.test(parts[idx]) ? Number(parts[idx]) : parts[idx];
    const copy: any = Array.isArray(node) ? node.slice() : { ...(node ?? {}) };
    copy[key] = idx === parts.length - 1 ? text : write(copy[key], idx + 1);
    return copy;
  };
  return { ...props, [top]: write(props[top], 1) };
}

/** The top-level prop a path belongs to. The inspector selects by this name. */
export const topKey = (path: string) => path.split(/[.#]/)[0];
