#!/usr/bin/env node
/**
 * handover.mjs — regenerate HANDOVER.md from live facts + handover.config.json.
 *
 * Design (production/enterprise):
 *  - Single deterministic generator, no dependencies beyond Node core.
 *  - Facts are *measured*, never typed: git state, artifact bytes/md5/gzip,
 *    source inventory, QA tallies from qa/last-run.json, tool versions.
 *  - Intent is *declared*: everything a human or an agent must not guess lives
 *    in handover.config.json (modules, decisions, next steps, traps, contracts).
 *  - Output is idempotent apart from the timestamp, so a diff is always
 *    meaningful and a stale handover is obvious in review.
 *
 * Usage:
 *   node scripts/handover.mjs            # write HANDOVER.md
 *   node scripts/handover.mjs --check    # exit 1 if HANDOVER.md is out of date
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "HANDOVER.md");
const CHECK = process.argv.includes("--check");

/** One-line purpose per source area, used by the inventory table. */
const AREA_PURPOSE = {
  "src/lib": "data seams, registries, formatting, no JSX",
  "src/components": "reusable UI: shell, ui kit, charts, and per-module parts",
  "src/views": "one file per screen; routes are hash-based",
  "src/styles": "one tokenised stylesheet (design system)",
  "qa": "WebP captures of audited states (evidence, not fixtures)",
};

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);

/* ------------------------------------------------------------------ facts */

function gitFacts() {
  const candidates = [ROOT, path.resolve(ROOT, "..", "repo")];
  const dir = candidates.find((d) => exists(path.join(d, ".git")));
  if (!dir) return { available: false, reason: "no .git in this tree or ../repo" };
  const run = (args) => {
    try {
      return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };
  const log = run(["log", "--pretty=%h%x09%ad%x09%s", "--date=short", "-n", "12"]);
  return {
    available: true,
    dir: rel(dir) || ".",
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]) || "—",
    head: run(["rev-parse", "HEAD"]) || "—",
    headShort: run(["rev-parse", "--short", "HEAD"]) || "—",
    subject: run(["log", "-1", "--pretty=%s"]) || "—",
    tags: run(["tag", "-l", "--sort=-creatordate"]).split("\n").filter(Boolean),
    dirty: run(["status", "--porcelain"]).split("\n").filter(Boolean).length,
    remote: run(["remote", "-v"]).split("\n")[0] || "",
    log: log ? log.split("\n").map((l) => l.split("\t")) : [],
  };
}

function artifactFacts(cfg) {
  const p = path.join(ROOT, cfg.project.artifact);
  if (!exists(p)) return null;
  const buf = fs.readFileSync(p);
  const md5 = createHash("md5").update(buf).digest("hex");
  const sha256 = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  return {
    name: cfg.project.artifact,
    bytes: buf.length,
    kb: (buf.length / 1024).toFixed(0),
    gzipKb: (gzipSync(buf).length / 1024).toFixed(0),
    md5,
    sha256,
    mtime: fs.statSync(p).mtime.toISOString().replace("T", " ").slice(0, 19),
  };
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "qa", "__pycache__"]);
function inventory(dir = ROOT, depth = 0) {
  const rows = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || depth > 3) continue;
      const kids = inventory(full, depth + 1);
      if (kids.length) rows.push({ dir: true, name: entry.name + "/", depth, loc: kids.reduce((n, k) => n + (k.loc || 0), 0), kids });
    } else if (/\.(tsx?|css|py|md|json|html)$/.test(entry.name) && !entry.name.endsWith("lock.json")) {
      const loc = read(full).split("\n").length;
      rows.push({ dir: false, name: entry.name, rel: rel(full), depth, loc });
    } else if (/\.webp$/.test(entry.name)) {
      rows.push({ dir: false, name: entry.name, rel: rel(full), depth, loc: 0, shot: true });
    }
  }
  return rows;
}

function flatten(rows, out = []) {
  for (const r of rows) {
    if (r.dir) flatten(r.kids, out);
    else out.push(r);
  }
  return out;
}

function qaFacts(cfg) {
  const p = path.join(ROOT, "qa", "last-run.json");
  if (!exists(p)) return { available: false };
  try {
    return { available: true, ...JSON.parse(read(p)) };
  } catch {
    return { available: false, reason: "qa/last-run.json is unreadable" };
  }
}

/* ---------------------------------------------------------------- render */

const cfg = JSON.parse(read(path.join(ROOT, "handover.config.json")));
const git = gitFacts();
const art = artifactFacts(cfg);
const files = flatten(inventory());
const srcFiles = files.filter((f) => f.name.match(/\.tsx?$/) || f.name.endsWith(".css"));
const totalLoc = files.reduce((n, f) => n + f.loc, 0);
const qa = qaFacts(cfg);
const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
const sha = git.available ? git.head.slice(0, 7) : "no-git";

const L = [];
const w = (s = "") => L.push(s);

w(`# HANDOVER — ${cfg.project.name}`);
w();
w("> **This file is generated. Do not edit it by hand.**");
w(`> Source of truth: \`handover.config.json\` (intent, decisions, next steps) + live repo facts.`);
w(`> Regenerate with \`npm run handover\`; \`npm run build\` and \`npm run qa\` do it for you.`);
w();
w(`**Generated** ${now} · **generated against commit** \`${sha}\`${git.available && git.dirty ? ` · **working tree** ${git.dirty} uncommitted file(s)` : ""}`);
w();
w(cfg.project.tagline);
w();

/* 1 — start here */
w("## 1. Start here (10 minutes)");
w();
w("| # | Do this | Why |");
w("| --- | --- | --- |");
cfg.continuation.firstTenMinutes.forEach((step, i) => w(`| ${i + 1} | ${step} | ${i === 0 ? "context" : i === 2 ? "proves the tree is healthy" : "orientation"} |`));
w();
w("**The deliverable** is one file: `" + cfg.project.artifact + "` — open it by double-click. No build, no server, no network, no `node_modules`.");
w();
w(`**The stack** ${cfg.project.stack}`);
w();

/* 2 — status */
w("## 2. Where the project stands");
w();
w("| Module | Screen | Route | Status | Evidence |");
w("| --- | --- | --- | --- | --- |");
for (const m of cfg.modules) {
  const badge = m.status === "done" ? "**done**" : `**${m.status}**`;
  w(`| ${m.id} | ${m.name} | \`${m.route}\` | ${badge} | ${m.evidence} |`);
}
w();
for (const m of cfg.modules.filter((x) => x.notes)) w(`- **${m.id} ${m.name}** — ${m.notes}`);
w();

/* 3 — artifact */
w("## 3. Build artifact (measured now)");
w();
if (art) {
  w("| Property | Value |");
  w("| --- | --- |");
  w(`| File | \`${art.name}\` |`);
  w(`| Size | ${art.bytes.toLocaleString()} B (${art.kb} kB) · gzip ${art.gzipKb} kB |`);
  w(`| md5 | \`${art.md5}\` |`);
  w(`| sha256 (first 16) | \`${art.sha256}\` |`);
  w(`| Built | ${art.mtime} |`);
} else {
  w(`> \`${cfg.project.artifact}\` is missing — run \`npm run build\`.`);
}
w();
const side = (cfg.project.sideArtifacts || [])
  .map((name) => ({ name, full: path.resolve(ROOT, name) }))
  .filter((x) => exists(x.full))
  .map((x) => {
    const buf = fs.readFileSync(x.full);
    return { name: path.basename(x.name), bytes: buf.length, md5: createHash("md5").update(buf).digest("hex") };
  });
if (side.length) {
  w("Packaged deliverables (ready to hand over):");
  w();
  w("| File | Size | md5 |");
  w("| --- | --- | --- |");
  for (const x of side) w(`| \`${x.name}\` | ${x.bytes.toLocaleString()} B | \`${x.md5}\` |`);
  w();
}
w("```bash");
w("npm ci");
w("npm run build      # tsc --noEmit && vite build, then copies the single file and regenerates this document");
w("npm run qa         # every Playwright suite, then rewrites qa/last-run.json and this document");
w("npm run dev        # http://localhost:5173 while developing");
w("```");
w();

/* 4 — QA */
w("## 4. Verification (last recorded run)");
w();
if (qa.available) {
  w(`Recorded ${qa.generatedAt}${qa.node ? ` · node ${qa.node}` : ""}. Re-run with \`npm run qa\`.`);
  w();
  w("| Suite | Passed | Failed | Time | Covers |");
  w("| --- | --- | --- | --- | --- |");
  for (const s of qa.suites) {
    const meta = cfg.qa.suites.find((x) => x.file === s.file) || {};
    w(`| \`${s.file}\` | ${s.passed ?? "—"} | ${s.failed ?? "—"} | ${s.seconds ? s.seconds.toFixed(1) + " s" : "—"} | ${meta.covers || ""} |`);
  }
  const bad = qa.suites.filter((s) => (s.failed ?? 0) > 0 || s.error);
  w();
  w(bad.length ? `> **${bad.length} suite(s) not green:** ${bad.map((b) => b.file).join(", ")}. Fix before continuing.` : "> All recorded suites are green.");
} else {
  w("No run recorded yet. `npm run qa` executes every suite, parses the tallies and writes `qa/last-run.json`.");
}
w();
w("Host prerequisite on a bare Linux container (Chromium will not start without it):");
w();
w("```bash");
for (const cmd of cfg.environment.bootstrap) w(cmd);
w("```");
w();

/* 5 — architecture */
w("## 5. Where the code lives");
w();
w(`Source inventory: **${srcFiles.length} source files, ${srcFiles.reduce((n, f) => n + f.loc, 0).toLocaleString()} lines** of TS/TSX/CSS (${totalLoc.toLocaleString()} lines across all tracked text files).`);
w();
w("| Area | Files | Lines | Purpose |");
w("| --- | --- | --- | --- |");
for (const dir of ["src/lib", "src/components", "src/views", "src/styles", "qa"]) {
  const full = path.join(ROOT, dir);
  if (!exists(full)) continue;
  const list = flatten(inventory(full));
  const shots = list.filter((f) => f.shot).length;
  const loc = list.reduce((n, f) => n + f.loc, 0);
  const purpose = dir === "qa" ? `${shots} WebP captures of audited states (evidence, not fixtures)` : AREA_PURPOSE[dir] || "";
  w(`| \`${dir}/\` | ${list.length} | ${loc ? loc.toLocaleString() : "—"} | ${purpose} |`);
}
w();
w("Top files by size:");
w();
w("| File | Lines |");
w("| --- | --- |");
for (const f of [...files].filter((f) => !f.shot).sort((a, b) => b.loc - a.loc).slice(0, 12)) w(`| \`${f.rel}\` | ${f.loc.toLocaleString()} |`);
w();

/* 6 — data + contracts */
w("## 6. Data seam and contracts");
w();
w("Everything the UI reads goes through one seam per area, so swapping in a real backend is a mechanical change:");
w();
w("| Seam | File | Replaced by |");
w("| --- | --- | --- |");
w("| Shell + M1–M2 data | `src/lib/data.ts` via `src/lib/store.tsx` | `GET /v1/dashboard`, `/v1/sites`, `/v1/releases` |");
w("| M3 pages | `src/lib/cms-pages.ts` | `/v1/pages*`, `/v1/pages/tree` |");
w("| M4 document | `src/lib/builder-db.ts` (`BuilderAPI`) | `/v1/pages/{id}/draft` (CAS), `/revisions`, `/v1/library/*`, `/v1/ai/copy:stream` |");
w();
w("| Document | Section | Covers |");
w("| --- | --- | --- |");
for (const c of cfg.contracts) w(`| \`${c.doc}\` | ${c.section} | ${c.covers} |`);
w();

/* 7 — rules + decisions */
w("## 7. Rules and locked decisions");
w();
w("Product rules (non-negotiable, they came from the user):");
w();
for (const r of cfg.rules) w(`- ${r}`);
w();
w("Decisions already made — do not reopen without the user:");
w();
w("| ID | Decision | Status |");
w("| --- | --- | --- |");
for (const d of cfg.decisions) w(`| ${d.id} | ${d.decision} | ${d.status} |`);
w();

/* 8 — next */
w("## 8. What is next");
w();
w(`**${cfg.next.headline}**`);
w();
w("Blocked on:");
w();
for (const b of cfg.next.blockedOn) w(`- ${b}`);
w();
w("First tasks:");
w();
cfg.next.tasks.forEach((t, i) => w(`${i + 1}. ${t}`));
w();

/* 9 — traps */
w("## 9. Traps that cost time last time");
w();
for (const t of cfg.traps) w(`- ${t}`);
w();

/* 10 — git */
w("## 10. Repository state and rollback");
w();
if (git.available) {
  w(`- Repo: that git directory is \`${git.dir}\`; branch \`${git.branch}\`; HEAD \`${git.headShort}\` — ${git.subject}.`);
  w(`- Working tree: ${git.dirty === 0 ? "clean" : `${git.dirty} uncommitted file(s)`}.`);
  w(`- Remote: ${git.remote ? `\`${git.remote}\`` : "**none configured** — add one before pushing (`git remote add origin <url>`)."}`);
  w(`- Tags: ${git.tags.length ? git.tags.map((t) => `\`${t}\``).join(" · ") : "none"}.`);
  w();
  if (git.log.length) {
    w("| Commit | Date | Subject |");
    w("| --- | --- | --- |");
    for (const [h, d, s] of git.log) w(`| \`${h}\` | ${d} | ${s.replace(/\|/g, "\\|")} |`);
    w();
  }
  w("Rollback recipes live in `ROLLBACK.md`; the short version: `git revert <sha>`, `git revert <tag>..HEAD`, or `git show <tag>:" + cfg.project.artifact + " > old.html`.");
} else {
  w(`No git metadata here (${git.reason}). The workspace is the source of truth; commit it before handing over.`);
}
w();

/* 11 — definition of done */
w("## 11. Definition of done (apply to every change)");
w();
cfg.continuation.definitionOfDone.forEach((d, i) => w(`${i + 1}. ${d}`));
w();
w("---");
w();
w("_How this document is produced:_ `handover.config.json` holds intent; `scripts/handover.mjs` measures the repository (git, artifact hashes, inventory, QA tallies) and writes this file; `scripts/qa-all.mjs` runs every suite and records `qa/last-run.json`; `npm run build` and `npm run qa` both regenerate it, and `.githooks/pre-commit` refreshes and stages it so a commit can never carry a stale handover.");
w();

const text = L.join("\n");
if (CHECK) {
  const current = exists(OUT) ? read(OUT) : "";
  /* Volatile by design: the timestamp line, commit ids and the build clock move
     on every commit/rebuild. --check verifies the *facts and structure*, so it
     masks those rather than forcing a rewrite after every amend. */
  const strip = (s) =>
    s
      .replace(/\*\*Generated\*\*.*$/m, "")
      .replace(/\b[0-9a-f]{7,40}\b/g, "<sha>")
      .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, "<time>")
      /* the git section is one commit behind by construction (the hook runs
         before the commit exists), so it is excluded from the staleness test */
      .replace(/## 10\.[\s\S]*?(?=## 11\.)/, "<git-section>")
      .trim();
  if (strip(current) !== strip(text)) {
    console.error("HANDOVER.md is out of date — run `npm run handover`.");
    process.exit(1);
  }
  console.log("HANDOVER.md is up to date.");
  process.exit(0);
}
fs.writeFileSync(OUT, text);
console.log(`HANDOVER.md written (${(text.length / 1024).toFixed(1)} kB) · commit ${sha} · ${files.length} files inventoried`);
