import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const cwd = process.cwd();
const runtimeDir = path.join(cwd, "runtime");
const logPath = path.join(runtimeDir, "events.v1.ndjson");
const dbPath = path.join(runtimeDir, "nexus.db");
const outDir = path.join(cwd, ".audit", "import-export");

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const obj = value;
  const keys = Object.keys(obj).sort();
  const pieces = keys.map((key) => {
    const left = JSON.stringify(key);
    const right = stableStringify(obj[key]);
    return `${left}:${right}`;
  });
  return `{${pieces.join(",")}}`;
}

function writeJson(fileName, value) {
  const target = path.join(outDir, fileName);
  fs.writeFileSync(target, `${stableStringify(value)}\n`, "utf8");
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function readEvents() {
  if (!fs.existsSync(logPath)) {
    throw new Error(`Missing event log: ${logPath}`);
  }
  const raw = fs.readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
  return raw.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

function buildGraph(events) {
  const edgeCounts = new Map();
  const byTrace = new Map();
  for (const event of events) {
    const traceId = String(event.trace_id ?? "unknown");
    const list = byTrace.get(traceId) ?? [];
    list.push(String(event.event_type ?? "unknown"));
    byTrace.set(traceId, list);
  }

  for (const [, types] of byTrace) {
    for (let i = 1; i < types.length; i += 1) {
      const edge = `${types[i - 1]}->${types[i]}`;
      edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
    }
  }

  const dotLines = ["digraph NexusEvents {", "  rankdir=LR;"];
  const adjacency = new Map();
  for (const [key, count] of Array.from(edgeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const [from, to] = key.split("->");
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
    dotLines.push(`  "${from}" -> "${to}" [label="${count}"];`);
  }
  dotLines.push("}");

  return { dot: `${dotLines.join("\n")}\n`, adjacency };
}

function detectCycles(adjacency) {
  const nodes = new Set();
  for (const [from, targets] of adjacency.entries()) {
    nodes.add(from);
    for (const to of targets.values()) nodes.add(to);
  }

  const cycles = [];
  const temp = new Set();
  const perm = new Set();
  const stack = [];

  function visit(node) {
    if (perm.has(node)) return;
    if (temp.has(node)) {
      const at = stack.indexOf(node);
      const cycle = stack.slice(at).concat(node);
      cycles.push(cycle);
      return;
    }

    temp.add(node);
    stack.push(node);
    const targets = adjacency.get(node) ?? new Set();
    for (const target of targets.values()) {
      visit(target);
    }
    stack.pop();
    temp.delete(node);
    perm.add(node);
  }

  for (const node of Array.from(nodes.values()).sort()) {
    visit(node);
  }

  const dedup = new Map();
  for (const cycle of cycles) {
    const key = cycle.join(" -> ");
    dedup.set(key, cycle);
  }

  return Array.from(dedup.values()).map((cycle, index) => ({
    id: `cycle_${String(index + 1).padStart(3, "0")}`,
    path: cycle,
    length: cycle.length,
  }));
}

function collectOffenders(events) {
  const offenders = [];
  let prevSeq = 0;
  let prevChain = "0".repeat(64);
  const seqSet = new Set();

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const seq = Number(event.seq);
    const eventType = String(event.event_type ?? "unknown");

    if (!Number.isFinite(seq) || seq <= 0) {
      offenders.push({ type: "invalid-seq", line: i + 1, seq: event.seq, event_type: eventType });
    }
    if (seqSet.has(seq)) {
      offenders.push({ type: "duplicate-seq", line: i + 1, seq, event_type: eventType });
    }
    seqSet.add(seq);
    if (seq <= prevSeq) {
      offenders.push({ type: "non-monotonic-seq", line: i + 1, seq, prev_seq: prevSeq, event_type: eventType });
    }
    prevSeq = seq;

    const chainPrev = String(event.chain_prev ?? "");
    const chainCurr = String(event.chain_curr ?? "");
    if (chainPrev !== prevChain) {
      offenders.push({ type: "chain-break", line: i + 1, expected_prev: prevChain, actual_prev: chainPrev, event_type: eventType });
    }
    prevChain = chainCurr;

    if (typeof event.event_id !== "string" || event.event_id.length < 8) {
      offenders.push({ type: "invalid-event-id", line: i + 1, value: event.event_id, event_type: eventType });
    }
    if (event.payload === undefined || event.payload === null || typeof event.payload !== "object") {
      offenders.push({ type: "invalid-payload", line: i + 1, event_type: eventType });
    }
  }

  return offenders;
}

function summarize(events, offenders, cycles) {
  const byType = new Map();
  const byTrace = new Map();

  for (const event of events) {
    const type = String(event.event_type ?? "unknown");
    const trace = String(event.trace_id ?? "unknown");
    byType.set(type, (byType.get(type) ?? 0) + 1);
    byTrace.set(trace, (byTrace.get(trace) ?? 0) + 1);
  }

  const overloadSignals = events.filter((event) => {
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    const error = payload && typeof payload.error === "string" ? payload.error : "";
    return error.toLowerCase().includes("overloaded");
  }).length;

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    sources: {
      eventLog: path.relative(cwd, logPath).replaceAll("\\\\", "/"),
      runtimeDb: path.relative(cwd, dbPath).replaceAll("\\\\", "/"),
    },
    totals: {
      events: events.length,
      offenders: offenders.length,
      cycles: cycles.length,
      traces: byTrace.size,
      overloadSignals,
    },
    byEventType: Object.fromEntries(Array.from(byType.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function buildBarrels() {
  const packagesDir = path.join(cwd, "packages");
  if (!fs.existsSync(packagesDir)) {
    return { packages: [] };
  }

  const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const packages = [];
  for (const dirName of packageDirs) {
    const pkgPath = path.join(packagesDir, dirName, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      packages.push({
        name: pkg.name ?? dirName,
        path: `packages/${dirName}`,
        hasExports: pkg.exports !== undefined,
        exportKeys: pkg.exports && typeof pkg.exports === "object" ? Object.keys(pkg.exports).sort() : [],
      });
    } catch {
      packages.push({ name: dirName, path: `packages/${dirName}`, hasExports: false, exportKeys: [], error: "invalid-package-json" });
    }
  }

  return { packages };
}

function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function main() {
  ensureOutDir();
  const events = readEvents();
  const offenders = collectOffenders(events);
  const { dot, adjacency } = buildGraph(events);
  const cycles = detectCycles(adjacency);
  const index = summarize(events, offenders, cycles);
  const barrels = buildBarrels();

  writeJson("index.json", index);
  writeJson("offenders.json", { offenders });
  writeJson("cycles.json", { cycles });
  writeJson("barrels.json", barrels);
  fs.writeFileSync(path.join(outDir, "graph.dot"), dot, "utf8");

  const cache = {
    generatedAt: new Date().toISOString(),
    inputs: {
      eventLogPath: path.relative(cwd, logPath).replaceAll("\\\\", "/"),
      eventLogSha256: sha256File(logPath),
      runtimeDbExists: fs.existsSync(dbPath),
    },
    outputs: {
      outDir: path.relative(cwd, outDir).replaceAll("\\\\", "/"),
      eventCount: events.length,
      offenderCount: offenders.length,
    },
  };
  writeJson("cache.json", cache);

  process.stdout.write(`${stableStringify({ ok: true, outDir: path.relative(cwd, outDir).replaceAll("\\\\", "/"), events: events.length, offenders: offenders.length })}\n`);
  if (offenders.length > 0) {
    process.exitCode = 2;
  }
}

main();
