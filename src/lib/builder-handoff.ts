/* One-shot handoff from Pages → Visual Builder.
   The store owns `#/<screen>` and drops unknown query params, so the page id
   travels in memory and the builder writes the canonical
   `#/builder?site=&page=&sel=&lib=&insp=` hash itself once it mounts. */
let pending: string | null = null;

export const setHandoff = (pageId: string): void => { pending = pageId; };

export const takeHandoff = (): string | null => {
  const p = pending;
  pending = null;
  return p;
};
