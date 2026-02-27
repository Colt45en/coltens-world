#!/usr/bin/env node
/* tools/twins/resolve-from-md.cjs
 *
 * Parse a "TS-as-Source Twin Report" Markdown file and apply the safe actions:
 * - For entries with:
 *      winner: ts
 *      suggested_action: delete-candidate
 *      js importers: 0
 *   => move the .js twin into history/YYYY-MM-DD/twins/<original-path>
 *
 * No hard deletes by default (deterministic + reversible).
 *
 * Usage:
 *   node tools/twins/resolve-from-md.cjs --report twin-report.md --apply
 *   node tools/twins/resolve-from-md.cjs --report twin-report.md --plan
 *   node tools/twins/resolve-from-md.cjs --report twin-report.md --apply --git-rm   (prints git rm commands instead of moving)
 *
 * Notes:
 * - This script assumes you're running from repo root.
 * - It skips node_modules, dist, build, .git, history when scanning is enabled (not needed for safe moves).
 */

const fs = require("node:fs");
const path = require("node:path");

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") args.report = argv[++i];
    else if (a === "--apply") args.apply = true;
    else if (a === "--plan") args.plan = true;
    else if (a === "--git-rm") args.gitRm = true;
    else if (a === "--dry-run") args.plan = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else die(`Unknown arg: ${a}`);
  }
  return args;
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, "utf8");
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function safeRename(src, dst) {
  ensureDir(path.dirname(dst));
  try {
    fs.renameSync(src, dst);
  } catch (e) {
    // cross-device fallback: copy + unlink
    fs.copyFileSync(src, dst);
    fs.unlinkSync(src);
  }
}

function isTs(p) {
  return p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".mts") || p.endsWith(".cts");
}
function isJs(p) {
  return p.endsWith(".js") || p.endsWith(".jsx") || p.endsWith(".mjs") || p.endsWith(".cjs");
}

function normalizeRel(p) {
  // keep repo-relative with forward slashes
  const rel = p.replace(/\\/g, "/").replace(/^\.\/+/, "");
  return rel;
}

function pickTwinPaths(left, right) {
  const a = normalizeRel(left);
  const b = normalizeRel(right);
  const aIsTs = isTs(a);
  const bIsTs = isTs(b);
  const aIsJs = isJs(a);
  const bIsJs = isJs(b);

  // common case: ts <-> js
  if (aIsTs && bIsJs) return { tsPath: a, jsPath: b };
  if (bIsTs && aIsJs) return { tsPath: b, jsPath: a };

  // if extensions are weird, still return as-is
  return { tsPath: aIsTs ? a : (bIsTs ? b : null), jsPath: aIsJs ? a : (bIsJs ? b : null) };
}

function parseTwinReportMarkdown(md) {
  const lines = md.split(/\r?\n/);

  const entries = [];
  let cur = null;

  // start of entry:
  // - **pathA <-> pathB**
  const headerRe = /^\s*-\s*\*\*(.+?)\s*<->\s*(.+?)\*\*\s*$/;

  // key lines (indented):
  //   - winner: ts
  const kvRe = /^\s*-\s*([A-Za-z0-9 _-]+):\s*(.+?)\s*$/;

  for (const line of lines) {
    const hm = line.match(headerRe);
    if (hm) {
      if (cur) entries.push(cur);
      const left = hm[1].trim();
      const right = hm[2].trim();
      const twins = pickTwinPaths(left, right);
      cur = {
        left,
        right,
        tsPath: twins.tsPath,
        jsPath: twins.jsPath,
        winner: null,
        confidence: null,
        suggested_action: null,
        reasons: null,
        js_importers: null,
        ts_importers: null,
        raw: [],
      };
      continue;
    }

    if (!cur) continue;

    cur.raw.push(line);

    const km = line.match(kvRe);
    if (!km) continue;

    const k = km[1].trim().toLowerCase();
    const v = km[2].trim();

    if (k === "winner") cur.winner = v;
    else if (k === "confidence") cur.confidence = Number(v);
    else if (k === "suggested_action") cur.suggested_action = v;
    else if (k === "reasons") cur.reasons = v;
    else if (k === "js importers") cur.js_importers = Number(v);
    else if (k === "ts importers") cur.ts_importers = Number(v);
  }

  if (cur) entries.push(cur);
  return entries;
}

function formatSummary(entries) {
  const counts = {
    total: entries.length,
    safe: 0,
    tsWinner: 0,
    jsWinner: 0,
    mixed: 0,
  };

  for (const e of entries) {
    if (e.winner === "ts") counts.tsWinner++;
    else if (e.winner === "js") counts.jsWinner++;
    else counts.mixed++;

    if (isSafeDeleteCandidate(e)) counts.safe++;
  }

  return counts;
}

function isSafeDeleteCandidate(e) {
  return (
    e &&
    e.winner === "ts" &&
    e.suggested_action === "delete-candidate" &&
    e.js_importers === 0 &&
    e.jsPath &&
    e.tsPath
  );
}

function buildPlan(entries, dateStr) {
  const safeMoves = [];
  const needsDecision = [];

  for (const e of entries) {
    if (isSafeDeleteCandidate(e)) {
      safeMoves.push({
        op: "move-js-twin-to-history",
        winner: "ts",
        confidence: e.confidence,
        tsPath: e.tsPath,
        jsPath: e.jsPath,
        from: e.jsPath,
        to: normalizeRel(path.join("history", dateStr, "twins", e.jsPath)),
        reasons: e.reasons,
      });
    } else {
      needsDecision.push({
        winner: e.winner,
        suggested_action: e.suggested_action,
        confidence: e.confidence,
        tsPath: e.tsPath,
        jsPath: e.jsPath,
        js_importers: e.js_importers,
        ts_importers: e.ts_importers,
        reasons: e.reasons,
      });
    }
  }

  return { safeMoves, needsDecision };
}

function writeHistoryReadme(dateStr, planPath, manifestPath) {
  const p = path.join("history", dateStr, "twins", "README.md");
  if (exists(p)) return;

  const content = `# Twins Archive — ${dateStr}

This folder contains files moved out of \`src/\` as part of a **TS-as-source twin cleanup**.

## Why these files are here
- They were identified as **JS twins** where:
  - TS is the winner
  - JS importers = 0
  - Suggested action = delete-candidate
- They were **moved (not deleted)** to keep the repo deterministic and reversible.

## Artifacts
- Plan: \`${planPath.replace(/\\/g, "/")}\`
- Manifest: \`${manifestPath.replace(/\\/g, "/")}\`

## Restore (if needed)
To restore a file:
1. Move it back to its original path (see manifest)
2. Re-run tests / build

`;
  writeText(p, content);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.report) {
    console.log(`
Resolve TS/JS twins from a Markdown report.

Usage:
  node tools/twins/resolve-from-md.cjs --report twin-report.md --plan
  node tools/twins/resolve-from-md.cjs --report twin-report.md --apply
  node tools/twins/resolve-from-md.cjs --report twin-report.md --apply --git-rm

Behavior:
  - Only moves "safe" JS twins:
      winner=ts AND suggested_action=delete-candidate AND js importers=0
  - Everything else is reported as "needs decision".
`);
    process.exit(0);
  }

  const reportPath = path.resolve(process.cwd(), args.report);
  if (!exists(reportPath)) die(`Report not found: ${reportPath}`);

  const md = readText(reportPath);
  const entries = parseTwinReportMarkdown(md);
  if (!entries.length) die(`No entries parsed. Does the report match the "**a <-> b**" format?`);

  const dateStr = todayYYYYMMDD();
  const plan = buildPlan(entries, dateStr);
  const summary = formatSummary(entries);

  const planOut = path.join("history", dateStr, "twins-plan.json");
  const manifestOut = path.join("history", dateStr, "twins-manifest.json");

  const planPayload = {
    date: dateStr,
    report: normalizeRel(path.relative(process.cwd(), reportPath)),
    summary,
    safeMovesCount: plan.safeMoves.length,
    needsDecisionCount: plan.needsDecision.length,
    safeMoves: plan.safeMoves,
    needsDecision: plan.needsDecision,
  };

  // Always write the plan (even in plan mode)
  writeText(planOut, JSON.stringify(planPayload, null, 2));
  writeText(manifestOut, JSON.stringify({ moved: [], errors: [], date: dateStr }, null, 2));
  writeHistoryReadme(dateStr, planOut, manifestOut);

  console.log("\n🧾 Twin cleanup plan written:");
  console.log(`  - ${planOut}`);
  console.log(`  - ${manifestOut}`);

  console.log("\n📊 Parsed summary:");
  console.log(`  Total pairs:        ${summary.total}`);
  console.log(`  TS winners:         ${summary.tsWinner}`);
  console.log(`  JS winners:         ${summary.jsWinner}`);
  console.log(`  Mixed/other:        ${summary.mixed}`);
  console.log(`  Safe moves (apply): ${plan.safeMoves.length}`);

  if (plan.needsDecision.length) {
    console.log("\n⚠️ Needs decision (NOT auto-applied):");
    // print top 20
    const top = plan.needsDecision.slice(0, 20);
    for (const e of top) {
      console.log(
        `  - winner=${e.winner} action=${e.suggested_action} conf=${e.confidence} jsImp=${e.js_importers} tsImp=${e.ts_importers} :: ${e.tsPath} <-> ${e.jsPath}`
      );
    }
    if (plan.needsDecision.length > top.length) {
      console.log(`  ...and ${plan.needsDecision.length - top.length} more (see ${planOut})`);
    }
  }

  if (!args.apply && !args.gitRm) {
    console.log("\n✅ Plan mode. Nothing changed.\n");
    return;
  }

  if (args.gitRm) {
    console.log("\n🧨 git rm commands for safe moves:\n");
    for (const m of plan.safeMoves) {
      console.log(`git rm "${m.from.replace(/\\/g, "/")}"`);
    }
    console.log("\n✅ Done (printed commands only).\n");
    return;
  }

  // Apply: move safe losers to history
  const manifest = { moved: [], errors: [], date: dateStr };
  for (const m of plan.safeMoves) {
    const src = path.resolve(process.cwd(), m.from);
    const dst = path.resolve(process.cwd(), m.to);
    try {
      if (!exists(src)) {
        manifest.errors.push({ op: m.op, from: m.from, to: m.to, error: "source-missing" });
        continue;
      }
      safeRename(src, dst);
      manifest.moved.push({ ...m, applied_at: new Date().toISOString() });
      console.log(`📦 moved: ${m.from} -> ${m.to}`);
    } catch (e) {
      manifest.errors.push({ op: m.op, from: m.from, to: m.to, error: String(e && e.message ? e.message : e) });
    }
  }

  writeText(manifestOut, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Apply complete. Manifest updated: ${manifestOut}\n`);

  if (manifest.errors.length) {
    console.log("⚠️ Some moves failed:");
    for (const er of manifest.errors) console.log(`  - ${er.from}: ${er.error}`);
    console.log("");
  }
}

main();
