#!/usr/bin/env node
/**
 * space.mjs — the snapshot budget, measured instead of assumed.
 *
 * Why it exists: the workspace has a hard 128 MB snapshot ceiling and five more
 * modules to build. Twice now it has crept up through things nobody chose: a
 * mirrored clone, a 15 MB artifact in every commit, 11 MB of QA captures that
 * were never part of the deliverable. This script prints where the bytes are,
 * what the ceiling allows, and what to do about it — and it is wired into
 * `checkpoint.sh` so a checkpoint can never hide a regression.
 *
 *   node scripts/space.mjs            # report
 *   node scripts/space.mjs --json     # machine-readable
 *   node scripts/space.mjs --fail-at 96   # exit 1 above a threshold (percent)
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = path.resolve(ROOT, "..");
const CEILING = 128 * 1024 * 1024;

/* Excluded by the snapshotter — they cost nothing, so never count them. */
const EXCLUDED = new Set([
  "node_modules", ".git", ".cache", ".local", "dist", "build", "out", "target",
  "coverage", "__pycache__", ".next", ".nuxt", ".svelte-kit", ".turbo", ".parcel-cache",
  ".pytest_cache", ".ruff_cache", ".mypy_cache", ".vite", ".playwright-cli", ".arena",
  ".npm", ".nox", ".output", ".tox", ".nuxt", ".parcel-cache"
]);
/* Mirrors the snapshotter's list (see the system note). Keep these two in step. */

const size = (p) => {
  try {
    const st = fs.lstatSync(p);
    if (st.isFile()) return st.size;
    let total = 0;
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (EXCLUDED.has(e.name)) continue;
      total += size(path.join(p, e.name));
    }
    return total;
  } catch { return 0; }
};

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const walk = (dir, depth = 0, maxDepth = 2) => {
  const rows = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const s = size(p);
    if (s < 128 * 1024) continue;
    const isDir = e.isDirectory();
    rows.push({ name: path.relative(WORKSPACE, p), bytes: s, dir: isDir });
    /* one level into a directory so the report names the file, not the folder */
    if (isDir && depth < maxDepth) rows.push(...walk(p, depth + 1, maxDepth));
  }
  return rows;
};

const gitDir = path.join(ROOT, ".git");
let git = { dir: 0, pack: 0, commits: 0, loose: 0 };
try {
  git.dir = size(gitDir);
  const counts = execSync("git count-objects -v", { cwd: ROOT, encoding: "utf8" });
  git.pack = Number(/size-pack:\s*(\d+)/.exec(counts)?.[1] ?? 0) * 1024;
  git.loose = Number(/^count:\s*(\d+)/m.exec(counts)?.[1] ?? 0);
  git.commits = Number(execSync("git rev-list --count HEAD", { cwd: ROOT, encoding: "utf8" }).trim());
} catch { /* not a repo, or git absent — the report still works */ }

const zipPath = path.join(WORKSPACE, "wacrm-app.zip");
const artifact = path.join(ROOT, "WACRM-CMS.html");
const zip = size(zipPath);
const art = size(artifact);
/* size() already skips .git and every other excluded directory, so the tree and the
   git directory are counted separately and added — never divided. */
const tree = size(WORKSPACE);

/* The snapshot keeps the working tree and .git; the zip lives beside the repo. */
const total = tree + git.dir;
const pct = (total / CEILING) * 100;
const remaining = CEILING - total;

/* What a checkpoint costs: one artifact version in git, compressed. */
const perCheckpoint = Math.round(art * 0.55);

const report = {
  ceiling: CEILING,
  total,
  percent: Number(pct.toFixed(1)),
  remaining,
  tree,
  git: git.dir,
  gitPack: git.pack,
  gitLoose: git.loose,
  commits: git.commits,
  artifact: art,
  zip,
  perCheckpoint,
  headroomInCheckpoints: Math.floor(remaining / Math.max(1, perCheckpoint)),
  biggest: walk(WORKSPACE).sort((a, b) => b.bytes - a.bytes).slice(0, 10)
};

const args = process.argv.slice(2);
if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const bar = (n) => {
    const filled = Math.min(28, Math.round((n / 100) * 28));
    return `${"█".repeat(filled)}${"·".repeat(28 - filled)}`;
  };
  console.log("");
  console.log(`snapshot budget   ${mb(total)} of ${mb(CEILING)}   ${bar(pct)} ${pct.toFixed(1)}%`);
  console.log(`  working tree    ${mb(tree)}   (repo ${mb(tree - zip)} + zip ${mb(zip)})`);
  console.log(`  git history     ${mb(git.dir)}   pack ${mb(git.pack)} · ${git.loose} loose objects · ${git.commits} commits`);
  console.log(`  artifact        ${mb(art)}   one copy per checkpoint ≈ ${mb(perCheckpoint)} in history`);
  console.log(`  headroom        ${mb(remaining)} — about ${report.headroomInCheckpoints} checkpoints at this size`);
  console.log("  biggest items:");
  for (const row of report.biggest) console.log(`    ${mb(row.bytes).padStart(9)}  ${row.name}${row.dir ? "/" : ""}`);
  console.log("");
  if (pct > 75) {
    console.log("  ! over 75% — run: node scripts/prune-history.mjs --push");
    console.log("    it drops superseded copies of regenerable files (the artifact, the font data)");
    console.log("    from history and force-pushes; the current tree is untouched.");
    console.log("");
  }
}

const failAt = args.indexOf("--fail-at");
if (failAt >= 0) {
  const limit = Number(args[failAt + 1] ?? 90);
  if (pct > limit) {
    console.error(`! snapshot ${pct.toFixed(1)}% is above the ${limit}% limit`);
    process.exit(1);
  }
}
