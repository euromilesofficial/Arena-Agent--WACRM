#!/usr/bin/env node
/**
 * prune-history.mjs — keep git history bounded without losing the tree.
 *
 * The problem it solves: `WACRM-CMS.html` is ~5 MB and changes on every build, and
 * `theme-font-data.ts` is ~3.3 MB. Committing both on every checkpoint means the
 * history grows by megabytes per commit while the *useful* content of that history
 * (the source) is a few hundred KB. After eight milestones the repo was 46 MB of
 * which ~30 MB was superseded copies of two regenerable files.
 *
 * What this does:
 *   1. finds every blob above a size threshold that is **not** in HEAD,
 *   2. rewrites history without those blobs (git-filter-repo), so old revisions
 *      keep their full source but no longer carry old builds,
 *   3. repacks, then optionally force-pushes main + tags and verifies the remote.
 *
 * The current tree is untouched: HEAD keeps its artifact and its font data. Any
 * old revision can still be built from its own source.
 *
 *   node scripts/prune-history.mjs                 # dry run: report only
 *   node scripts/prune-history.mjs --apply         # rewrite local history
 *   node scripts/prune-history.mjs --apply --push  # rewrite, then force-push + verify
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PUSH = args.includes("--push");
const MIN = 400 * 1024;
const TOKEN_FILE = "/home/user/.gh-token";
const OWNER_REPO = "euromilesofficial/Arena-Agent--WACRM";

const git = (cmd, opts = {}) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", ...opts });

/* 1 · every blob in history, and which of them HEAD still needs */
const headBlobs = new Set(
  git("ls-tree -r HEAD").split("\n").map((l) => l.split(/\s+/)[2]).filter(Boolean)
);

const objects = git("rev-list --objects --all")
  .split("\n")
  .map((l) => l.split(/\s+/, 2))
  .filter((p) => p.length === 2);

const ids = objects.map((p) => p[0]);
const names = new Map(objects);
const sizes = new Map();
for (let i = 0; i < ids.length; i += 2000) {
  const batch = ids.slice(i, i + 2000).join("\n");
  const out = execFileSync("git", ["cat-file", "--batch-check"], { cwd: ROOT, input: batch, encoding: "utf8" });
  for (const line of out.split("\n")) {
    const [sha, type, size] = line.split(" ");
    if (type === "blob") sizes.set(sha, Number(size));
  }
}

const stale = [...sizes.entries()].filter(([sha, size]) => size >= MIN && !headBlobs.has(sha));
const staleBytes = stale.reduce((n, [, s]) => n + s, 0);
const packNow = Number(/size-pack:\s*(\d+)/.exec(git("count-objects -v"))?.[1] ?? 0) * 1024;
const packAfter = Math.max(0, packNow - staleBytes * 0.55);

console.log("");
console.log(`prune-history · ${stale.length} superseded blob${stale.length === 1 ? "" : "s"} ≥ ${(MIN / 1024).toFixed(0)} KB (${(staleBytes / 1048576).toFixed(1)} MB raw)`);
for (const [sha, size] of stale.sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${(size / 1048576).toFixed(1).padStart(5)} MB  ${names.get(sha) ?? sha.slice(0, 8)}`);
}
console.log(`  pack now ${(packNow / 1048576).toFixed(1)} MB → about ${(packAfter / 1048576).toFixed(1)} MB after a repack`);
console.log("  HEAD keeps every file it has today; only old copies of regenerable files go.");

if (!APPLY) {
  console.log("\n  dry run — re-run with --apply to rewrite local history\n");
  process.exit(0);
}
if (!stale.length) {
  console.log("\n  nothing to prune\n");
  process.exit(0);
}

/* 2 · rewrite — but first, keep the old head reachable on the remote as an archive branch,
   so the pre-prune history is recoverable from GitHub and never only from this machine. */
const oldHead = git("rev-parse HEAD").trim();
if (PUSH) {
  const t = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  execSync(`git push -q https://x-access-token:${t}@github.com/${OWNER_REPO} ${oldHead}:refs/heads/archive/pre-${oldHead.slice(0, 7)}`, { cwd: ROOT, stdio: "inherit" });
  console.log(`  archived ${oldHead.slice(0, 7)} → archive/pre-${oldHead.slice(0, 7)} on the remote`);
}

const listFile = path.join("/tmp", `prune-${Date.now()}.txt`);
fs.writeFileSync(listFile, stale.map(([sha]) => sha).join("\n") + "\n");
try {
  execSync(`git filter-repo --force --strip-blobs-with-ids ${listFile}`, { cwd: ROOT, stdio: "inherit" });
} catch (e) {
  console.error("\n! git-filter-repo failed. Install it with: pip install git-filter-repo");
  process.exit(1);
}
execSync("git gc --prune=now --quiet", { cwd: ROOT, stdio: "inherit" });
const packFinal = Number(/size-pack:\s*(\d+)/.exec(git("count-objects -v"))?.[1] ?? 0) * 1024;
console.log(`\n  pack now ${(packFinal / 1048576).toFixed(1)} MB · HEAD ${git("rev-parse --short HEAD").trim()}`);

/* 3 · publish. History was rewritten, so this is a force-push — but with a lease on the
   exact remote head we just archived, so it cannot overwrite anything unseen. Tags are NOT
   moved: the old rollback tags still point at the archived commits and keep their trees. */
if (!PUSH) {
  console.log("  local only — the remote still has the old history until you run with --push\n");
  process.exit(0);
}
const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
const url = `https://x-access-token:${token}@github.com/${OWNER_REPO}`;
const remoteBefore = execSync(`git ls-remote ${url} refs/heads/main`, { encoding: "utf8" }).split(/\s+/)[0];
execSync(`git push --force-with-lease=refs/heads/main:${remoteBefore} ${url} main`, { cwd: ROOT, stdio: "inherit" });
const local = git("rev-parse HEAD").trim();
const remote = execSync(`git ls-remote ${url} refs/heads/main`, { encoding: "utf8" }).split(/\s+/)[0];
console.log(remote === local ? `  ✓ remote matches ${local.slice(0, 7)}` : `  ! remote ${remote} ≠ local ${local}`);
process.exit(remote === local ? 0 : 1);
