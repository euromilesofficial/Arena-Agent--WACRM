#!/usr/bin/env node
/**
 * qa-all.mjs — run every Playwright suite, record the tallies, refresh the handover.
 *
 * Why it exists: the handover must never quote a number a human typed. The
 * runner executes each suite against the built artifact, parses the suite's own
 * summary line, writes qa/last-run.json (machine-readable evidence), then
 * regenerates HANDOVER.md from it.
 *
 * Usage:
 *   node scripts/qa-all.mjs             # run everything
 *   node scripts/qa-all.mjs qa_builder.py qa_states_m4.py   # run a subset
 *
 * Exit code is non-zero if any suite fails, so it is safe to use in CI.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "handover.config.json"), "utf8"));
const only = process.argv.slice(2).filter((a) => a.endsWith(".py"));

/**
 * Each suite prints its own summary; these are the exact shapes in this repo.
 * "pf" = "N passed, M failed"; "of" = "N/M checks passed" (M is the total).
 */
const PARSERS = [
  { kind: "pf", re: /(\d+)\s*passed,\s*(\d+)\s*failed/i },
  { kind: "pf", re: /steps:\s*(\d+)\s*ok\s*\/\s*(\d+)\s*failed/i },
  { kind: "of", re: /(\d+)\s*\/\s*(\d+)\s+(?:[A-Za-z0-9 ]*?)?(?:checks|state checks|assertions) passed/i },
];

function parse(out) {
  for (const p of PARSERS) {
    const m = out.match(p.re);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return p.kind === "pf" ? { passed: a, failed: b } : { passed: a, failed: Math.max(0, b - a), total: b };
  }
  if (/errors:\s*(none|\[\])/i.test(out)) return { passed: null, failed: 0 };
  return { passed: null, failed: null };
}

const suites = cfg.qa.suites.filter((s) => (only.length ? only.includes(s.file) : true));
const results = [];
let failed = 0;

for (const suite of suites) {
  const file = path.join(ROOT, suite.file);
  if (!fs.existsSync(file)) {
    results.push({ file: suite.file, passed: 0, failed: 1, error: "missing file", seconds: 0 });
    failed++;
    continue;
  }
  process.stdout.write(`▶ ${suite.file} … `);
  const started = Date.now();
  const run = spawnSync("python3", [file], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const seconds = (Date.now() - started) / 1000;
  const out = `${run.stdout || ""}\n${run.stderr || ""}`;
  const { passed, failed: f } = parse(out);
  const isFail = run.status !== 0 || (f ?? 0) > 0;
  if (isFail) {
    failed++;
    const tail = out.trim().split("\n").slice(-6).join("\n");
    console.log(`FAIL${passed === null ? "" : ` (${passed} passed, ${f} failed)`}`);
    results.push({ file: suite.file, passed, failed: f ?? 1, seconds, error: tail.slice(-600) });
    if (out.includes("ModuleNotFoundError: No module named 'playwright'")) {
      console.log("  → playwright is not installed in this container: pip install playwright && python3 -m playwright install chromium-headless-shell");
    }
  } else {
    console.log(`ok${passed === null ? "" : ` (${passed}/${passed + (f ?? 0)})`}`);
    results.push({ file: suite.file, passed, failed: 0, seconds });
  }
}

const payload = {
  generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
  node: process.version,
  artifact: cfg.project.artifact,
  suites: results,
};
fs.writeFileSync(path.join(ROOT, "qa", "last-run.json"), JSON.stringify(payload, null, 2) + "\n");

console.log(`\n${results.length - failed}/${results.length} suites green · wrote qa/last-run.json`);
spawnSync("node", [path.join(ROOT, "scripts", "handover.mjs")], { cwd: ROOT, stdio: "inherit" });
process.exit(failed === 0 ? 0 : 1);
