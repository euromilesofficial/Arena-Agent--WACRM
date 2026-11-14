#!/usr/bin/env node
/**
 * package.mjs — refresh /home/user/wacrm-app.zip from the current tree.
 *
 * Why it is part of `npm run build`: the standing instruction is that every
 * build or modification ships a new zip, and a step a human has to remember is
 * a step that eventually gets skipped. `npm run build` therefore ends here.
 *
 * Excluded: node_modules, dist (both rebuildable) and .git (the history travels
 * in repo/ and, when it has to leave the machine, in wacrm-app.bundle).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = path.dirname(ROOT);
const NAME = path.basename(ROOT);
const ZIP = path.join(PARENT, `${NAME}.zip`);

const EXCLUDES = ["node_modules/*", "dist/*", ".git/*", "*.zip", "*.bundle"];

fs.rmSync(ZIP, { force: true });
execFileSync("zip", ["-rq", ZIP, NAME, ...EXCLUDES.flatMap((e) => ["-x", `${NAME}/${e}`])], { cwd: PARENT });

const buf = fs.readFileSync(ZIP);
const md5 = createHash("md5").update(buf).digest("hex");
const files = Number(
  execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" }).trim().split("\n").filter((l) => !l.endsWith("/")).length
);
const mb = (buf.length / 1048576).toFixed(2);

console.log(`zip  ${path.relative(process.cwd(), ZIP)}`);
console.log(`     ${buf.length.toLocaleString()} B (${mb} MB) · ${files} files · md5 ${md5}`);

/* A stale zip is worse than no zip: warn loudly if the artefact inside it does
   not match the one just built. */
const built = path.join(ROOT, "WACRM-CMS.html");
const inZip = execFileSync("unzip", ["-p", ZIP, `${NAME}/WACRM-CMS.html`], { maxBuffer: 64 * 1024 * 1024 });
if (built && fs.existsSync(built)) {
  const a = createHash("md5").update(fs.readFileSync(built)).digest("hex");
  const b = createHash("md5").update(inZip).digest("hex");
  if (a !== b) {
    console.error(`     ! zip contains a different WACRM-CMS.html (${b.slice(0, 8)} vs ${a.slice(0, 8)})`);
    process.exit(1);
  }
  console.log(`     verified: WACRM-CMS.html md5 ${a} matches the build`);
}
