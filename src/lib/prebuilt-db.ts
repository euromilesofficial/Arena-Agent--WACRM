/* ============================================================
   Module 7 · prebuilt template library
   ------------------------------------------------------------
   14 open-source templates ship inside the build (see
   templates/PROVENANCE.md). They are stored as cleaned HTML and
   converted by the *same* extractor a user upload runs through, so
   the library can never drift from the importer: if the importer
   improves, the library improves.
   ============================================================ */
import { PREBUILT_KITS, PREBUILT_SOURCE, type PrebuiltKit } from "./prebuilt-kits";
import { importHtml, type ImportReport } from "./html-import";
import type { BlockNode } from "./builder";

export { PREBUILT_SOURCE };
export type { PrebuiltKit };

export interface KitSummary {
  id: string;
  name: string;
  category: string;
  blocks: number;
  sections: number;
  source: string;
  license: string;
  commit: string;
  mapped: { type: string; count: number }[];
}

const cache = new Map<string, { blocks: BlockNode[]; report: ImportReport }>();

export function kitContent(id: string): { blocks: BlockNode[]; report: ImportReport } | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const kit = PREBUILT_KITS.find((k) => k.id === id);
  if (!kit) return null;
  const parsed = importHtml(kit.html, { name: kit.name });
  cache.set(id, parsed);
  return parsed;
}

/* Built on first use, not at import: parsing 14 documents on the critical path of
   the first paint is a cost no other module should pay. */
let summaries: KitSummary[] | null = null;

export function listKits(): KitSummary[] {
  if (summaries) return summaries;
  summaries = PREBUILT_KITS.map((kit) => {
    const parsed = kitContent(kit.id)!;
    return {
      id: kit.id,
      name: kit.name,
      category: kit.category,
      blocks: parsed.blocks.length,
      sections: parsed.report.sections,
      source: kit.source,
      license: kit.license,
      commit: kit.commit,
      mapped: parsed.report.mapped
    };
  });
  return summaries;
}
export const KIT_CATEGORIES = Array.from(new Set(PREBUILT_KITS.map((k) => k.category)));
export const KIT_COUNT = PREBUILT_KITS.length;
