import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.argv[2] ?? "pipeline_results";

const FILES = [
  "decision_record.json",
  "evidence_packet.json",
  "lexicon_entries.json",
  "merge_result.json",
  "pipeline.log",
  "rune_rows.json",
  "validated_plan.json",
  "weekly_ops_report.json",
  "world.db",
];

function sha256File(p) {
  const data = fs.readFileSync(p);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function exists(p) {
  return fs.existsSync(p);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️ ${msg}`);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function validateMissingFiles() {
  const missing = FILES.filter((f) => !exists(path.join(ROOT, f)));
  if (missing.length) {
    warn(`Missing files in ${ROOT}: ${missing.join(", ")}`);
  }
}

function parseJsonFiles() {
  const jsonFiles = FILES.filter((f) => f.endsWith(".json"));
  const parsed = {};
  for (const f of jsonFiles) {
    const p = path.join(ROOT, f);
    if (!exists(p)) continue;
    try {
      parsed[f] = readJson(p);
      ok(`Parsed ${f}`);
    } catch (e) {
      fail(`Failed to parse ${f}: ${e.message}`);
    }
  }
  return parsed;
}

function computeHashes() {
  const hashes = {};
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    if (!exists(p)) continue;
    hashes[f] = sha256File(p);
  }
  ok("Computed SHA256 hashes for present artifacts.");
  return hashes;
}

function checkIntegrity(parsed, hashes) {
  const dr = parsed["decision_record.json"];
  const ev = parsed["evidence_packet.json"];
  const plan = parsed["validated_plan.json"];
  const merge = parsed["merge_result.json"];

  if (dr && ev) {
    const drStr = JSON.stringify(dr);
    const evHash = hashes["evidence_packet.json"];
    if (evHash && !drStr.includes(evHash)) {
      warn("decision_record.json does not appear to reference evidence_packet hash (string match). Consider adding explicit refs.");
    } else {
      ok("Decision ↔ Evidence reference appears present (string match).");
    }
  }

  if (plan && merge) {
    const mergeStr = JSON.stringify(merge);
    const planHash = hashes["validated_plan.json"];
    if (planHash && !mergeStr.includes(planHash)) {
      warn("merge_result.json does not appear to reference validated_plan hash (string match). Consider adding explicit refs.");
    } else {
      ok("Merge ↔ Plan reference appears present (string match).");
    }
  }
}

function checkDeterminism(parsed) {
  const uuidV4 = /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  for (const [name, obj] of Object.entries(parsed)) {
    const s = JSON.stringify(obj);
    const found = s.match(uuidV4);
    if (found && found.length) {
      warn(`${name} contains UUIDv4-like ids (${found.length}). If you require determinism, replace with content-hash IDs.`);
    }
  }
}

function writeManifest(hashes) {
  const manifest = {
    root: ROOT,
    createdAt: new Date().toISOString(),
    hashes,
    presentFiles: Object.keys(hashes),
  };

  const out = path.join(ROOT, "artifact_manifest.json");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2), "utf8");
  ok(`Wrote ${out}`);

  console.log("\n📦 Manifest summary:");
  for (const [f, h] of Object.entries(hashes)) {
    console.log(`  ${f}: ${h.slice(0, 16)}…`);
  }
}

function main() {
  validateMissingFiles();
  const parsed = parseJsonFiles();
  const hashes = computeHashes();
  checkIntegrity(parsed, hashes);
  checkDeterminism(parsed);
  writeManifest(hashes);
  ok("Validation pass complete.");
}

main();
