#!/usr/bin/env node
/**
 * ensure-font-data.mjs — fail early, and helpfully, when the generated font assets
 * are not resolvable.
 *
 * `src/lib/theme-font-data.ts` (14.1 MB of base64 woff2) and the built
 * `WACRM-CMS.html` (15.5 MB, 90% of it the same font bytes) are the two biggest
 * files in this project. They live in Git, and in exactly one place on disk:
 * the clone at ../repo. This workspace keeps symlinks to them, so the same bytes
 * are not stored — and snapshotted — twice.
 *
 * A symlink that dangles would otherwise surface as a confusing TypeScript
 * "cannot find module", or worse: a build that quietly ships without fonts.
 * So: check here, explain, and exit 1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DATA = path.join(ROOT, "src/lib/theme-font-data.ts");
const MIN_BYTES = 1_000_000;

const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

if (!fs.existsSync(FONT_DATA)) {
  console.error(`\n! src/lib/theme-font-data.ts is missing${isLink(FONT_DATA) ? " (dangling symlink)" : ""}.
  It is a generated 14 MB asset and it is in Git. Either:
    · restore the workspace link:  ln -sfn ../../../repo/src/lib/theme-font-data.ts src/lib/theme-font-data.ts
    · or regenerate from Google Fonts:  npm run fonts
  Nothing is built until this resolves — a build without fonts would look fine and be wrong.\n`);
  process.exit(1);
}

const size = fs.statSync(FONT_DATA).size;
if (size < MIN_BYTES) {
  console.error(`\n! src/lib/theme-font-data.ts is only ${size.toLocaleString()} B — that is the old\n  nine-family stub, not the 247-family library. Run: npm run fonts\n`);
  process.exit(1);
}

console.log(`fonts ok · theme-font-data.ts ${(size / 1048576).toFixed(2)} MB${isLink(FONT_DATA) ? " (symlinked to the Git clone)" : ""}`);
