#!/usr/bin/env node
/**
 * ensure-font-data.mjs — fail early, and helpfully, when the generated font assets
 * are not resolvable.
 *
 * `src/lib/theme-font-data.ts` is a generated file (~3.4 MB of base64 woff2 for the
 * 50 embedded families) and nothing in the app compiles without it. It is in Git,
 * but a fresh checkout that skipped the generator, or a half-restored workspace,
 * would otherwise surface as a confusing TypeScript "cannot find module" — or
 * worse, a build that quietly ships without fonts.
 * So: check here, explain, and exit 1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DATA = path.join(ROOT, "src/lib/theme-font-data.ts");
const MIN_BYTES = 800_000;


if (!fs.existsSync(FONT_DATA)) {
  console.error(`\n! src/lib/theme-font-data.ts is missing.
  It is a generated asset (the 50 embedded families) and it is in Git. Either:
    · restore it:   bash scripts/git-fetch.sh src/lib/theme-font-data.ts   (reads it from GitHub)
    · regenerate:  npm run fonts
  Nothing is built until this resolves — a build without fonts would look fine and be wrong.\n`);
  process.exit(1);
}

const size = fs.statSync(FONT_DATA).size;
if (size < MIN_BYTES) {
  console.error(`\n! src/lib/theme-font-data.ts is only ${size.toLocaleString()} B — that is the old\n  nine-family stub, not the 50-family set. Run: npm run fonts\n`);
  process.exit(1);
}

console.log(`fonts ok · theme-font-data.ts ${(size / 1048576).toFixed(2)} MB`);
