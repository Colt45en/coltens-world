/* scripts/seed/seed-world-engine.ts
   Deterministic seeding for World Engine governance + memory + lexicon.

   Run:
     pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337
*/

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

type SeedOpts = {
  seed: number;
  force: boolean;
};

const ROOT = process.cwd();

const PATHS = {
  taxonomyDir: path.join(ROOT, "docs", "taxonomy"),
  taxonomyRegistry: path.join(ROOT, "docs", "taxonomy", "taxonomy.registry.json"),

  lexiconDir: path.join(ROOT, "docs", "lexicon"),
  lexiconEntriesDir: path.join(ROOT, "docs", "lexicon", "entries"),
  lexiconIndex: path.join(ROOT, "docs", "lexicon", "lexicon.index.json"),

  brainDir: path.join(ROOT, ".brain"),
  brainMemoryDir: path.join(ROOT, ".brain", "memory"),
  brainReviewDir: path.join(ROOT, ".brain", "review"),
  knowledgeNdjson: path.join(ROOT, ".brain", "memory", "knowledge.ndjson"),
  reviewQueueNdjson: path.join(ROOT, ".brain", "review", "review.queue.ndjson"),
};

function parseArgs(argv: string[]): SeedOpts {
  const seedIdx = argv.indexOf("--seed");
  const force = argv.includes("--force");

  let seed = 1337;
  if (seedIdx >= 0) {
    const v = argv[seedIdx + 1];
    if (!v) throw new Error("Missing value for --seed");
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid seed: ${v}`);
    seed = Math.floor(n);
  }

  return { seed, force };
}

// --- deterministic RNG (mulberry32) ---
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function nowIso() {
  return new Date().toISOString();
}

function sha256(data: string | Buffer) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeJsonIfMissing(file: string, obj: any, force: boolean) {
  if (!force && fs.existsSync(file)) return false;
  await ensureDir(path.dirname(file));
  const content = JSON.stringify(obj, null, 2) + "\n";
  await fsp.writeFile(file, content, "utf8");
  return true;
}

async function writeTextIfMissing(file: string, text: string, force: boolean) {
  if (!force && fs.existsSync(file)) return false;
  await ensureDir(path.dirname(file));
  await fsp.writeFile(file, text, "utf8");
  return true;
}

async function appendNdjsonIfEmpty(file: string, lines: any[], force: boolean) {
  await ensureDir(path.dirname(file));
  const exists = fs.existsSync(file);
  if (exists && !force) {
    const stat = await fsp.stat(file);
    if (stat.size > 0) return false;
  }
  const out = lines.map((x) => JSON.stringify(x)).join("\n") + "\n";
  await fsp.writeFile(file, out, "utf8");
  return true;
}

function stableId(prefix: string, seed: number, name: string) {
  // deterministic ID = sha256(seed + prefix + name) shortened
  const h = sha256(`${seed}:${prefix}:${name}`);
  return `${prefix}_${h.slice(0, 12)}`;
}

function pick<T>(rand: () => number, arr: T[]) {
  return arr[Math.floor(rand() * arr.length)];
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type TaxonomyRegistry = {
  schemaVersion: "1.0.0";
  generatedAt: string;
  operators: { id: string; label: string; intent: string }[];
  modules: { id: string; label: string }[];
  tags: { id: string; label: string; moduleId: string }[];
  allowUnknownTags: boolean;
};

function buildTaxonomyRegistry(seed: number): TaxonomyRegistry {
  const generatedAt = nowIso();

  const modules = [
    { id: "core.protocol", label: "Protocol & Contracts" },
    { id: "core.engine", label: "ECS Runtime" },
    { id: "core.bus", label: "Bus & Routing" },
    { id: "agent.brain", label: "Brain & Thought" },
    { id: "agent.lexicon", label: "Lexicon & Operators" },
    { id: "app.ide", label: "IDE Web" },
    { id: "app.nucleus", label: "Nucleus Orchestrator" },
    { id: "app.sidecar", label: "Python Sidecar" },
  ];

  const tags = [
    { id: "contract.first", label: "Contract-First", moduleId: "core.protocol" },
    { id: "determinism", label: "Determinism", moduleId: "core.engine" },
    { id: "traceability", label: "Traceability", moduleId: "core.protocol" },
    { id: "memory.ndjson", label: "Memory NDJSON", moduleId: "agent.brain" },
    { id: "review.queue", label: "Review Queue", moduleId: "agent.brain" },
    { id: "lexicon.index", label: "Lexicon Index", moduleId: "agent.lexicon" },
    { id: "cli.bridge", label: "IDE↔Nucleus CLI Bridge", moduleId: "app.nucleus" },
  ];

  const operators = [
    { id: "prompt.operator.optimize", label: "Optimize", intent: "Refine toward objective under constraints" },
    { id: "prompt.operator.validate", label: "Validate", intent: "Verify claims/contracts against tests and rules" },
    { id: "prompt.operator.diff", label: "Diff", intent: "Compare artifacts and produce deltas" },
    { id: "prompt.operator.summarize", label: "Summarize", intent: "Compress without losing key constraints" },
    { id: "prompt.operator.seed", label: "Seed", intent: "Create canonical scaffolding deterministically" },
  ];

  return {
    schemaVersion: "1.0.0",
    generatedAt,
    operators,
    modules,
    tags,
    allowUnknownTags: false,
  };
}

type LexiconEntry = {
  schemaVersion: "1.0.0";
  id: string;
  canonicalTerm: string;
  code_process_tag: string;
  type: "operator" | "concept" | "system";
  meaning: string;
  use: string[];
  methodology: string[];
  examples: string[];
  anti_patterns: string[];
  tests_validation: string[];
  createdAt: string;
  updatedAt: string;
};

function buildLexiconEntries(seed: number): LexiconEntry[] {
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const entries: LexiconEntry[] = [
    {
      schemaVersion: "1.0.0",
      id: stableId("lex", seed, "Optimize"),
      canonicalTerm: "Optimize",
      code_process_tag: "prompt.operator.optimize",
      type: "operator",
      meaning:
        "Improve a thing by adjusting variables to maximize a goal while respecting constraints; the result must be measurably or demonstrably better under the stated objective.",
      use: [
        "Use when you can name objectives (latency, clarity, stability) and constraints (compat, determinism).",
        "Use with acceptance tests so improvement is provable, not subjective.",
      ],
      methodology: [
        "State objective(s) explicitly.",
        "List constraints that must not break.",
        "Name allowable tradeoffs.",
        "Run validation tests before/after.",
        "Record a decision note explaining why the change is better.",
      ],
      examples: [
        "Optimize memory:query for large NDJSON by adding an index build step and verifying identical results on fixtures.",
        "Optimize a rendering loop by reducing allocations while keeping deterministic ordering.",
      ],
      anti_patterns: [
        "Saying 'optimize' with no objective or tests.",
        "Changing behavior without a replay or golden fixture.",
        "Hidden tradeoffs (faster but now nondeterministic).",
      ],
      tests_validation: [
        "Before/after snapshot test must pass.",
        "Replay harness reproduces identical output given same inputs + lexicon hash.",
        "No new unknown tags/operators introduced.",
      ],
      createdAt,
      updatedAt,
    },
    {
      schemaVersion: "1.0.0",
      id: stableId("lex", seed, "Determinism"),
      canonicalTerm: "Determinism",
      code_process_tag: "concept.determinism",
      type: "concept",
      meaning:
        "Given the same inputs, seeds, versions, and environment constraints, the system produces the same outputs in the same order.",
      use: [
        "Seeded RNG everywhere randomness exists.",
        "Stable ordering of maps/sets when serialized.",
        "Hash provenance of inputs/config for replay.",
      ],
      methodology: [
        "Use seeded RNG primitives.",
        "Normalize ordering on write.",
        "Add replay tests to confirm stable results.",
      ],
      examples: [
        "Memory artifacts store lexiconIndexHash + pipelineVersion so replay is possible.",
      ],
      anti_patterns: ["Using Math.random()", "Depending on object iteration order for serialization."],
      tests_validation: ["Replay run must match canonical NDJSON fixtures byte-for-byte (or diff-only expected fields)."],
      createdAt,
      updatedAt,
    },
    {
      schemaVersion: "1.0.0",
      id: stableId("lex", seed, "ReviewQueue"),
      canonicalTerm: "Review Queue",
      code_process_tag: "system.review.queue",
      type: "system",
      meaning:
        "A quarantined holding area for artifacts and entries that are not yet approved as canonical truth; nothing enters the stable corpus without an explicit review decision.",
      use: [
        "Route unknown tags/operators into review instead of failing silently.",
        "Support approve/reject + rationale + reviewer.",
      ],
      methodology: [
        "Write candidate artifacts as NDJSON records with status=pending.",
        "Promote to memory/lexicon only via an approval command with decision logging.",
      ],
      examples: ["New lexicon entry suggestion goes to review.queue.ndjson first."],
      anti_patterns: ["Auto-accepting unknown tags.", "Overwriting canonical memory without a decision record."],
      tests_validation: ["CI fails on unknown tags when --fail-on-unknown-tag is set."],
      createdAt,
      updatedAt,
    },
  ];

  return entries;
}

type LexiconIndex = {
  schemaVersion: "1.0.0";
  generatedAt: string;
  entries: {
    id: string;
    canonicalTerm: string;
    code_process_tag: string;
    type: string;
    file: string;
  }[];
  contentHash: string;
};

async function buildLexiconIndex(entries: LexiconEntry[]): Promise<LexiconIndex> {
  const generatedAt = nowIso();
  const idxEntries = entries.map((e) => ({
    id: e.id,
    canonicalTerm: e.canonicalTerm,
    code_process_tag: e.code_process_tag,
    type: e.type,
    file: `docs/lexicon/entries/${e.id}.lexicon.json`,
  }));

  const contentHash = sha256(JSON.stringify(idxEntries));

  return {
    schemaVersion: "1.0.0",
    generatedAt,
    entries: idxEntries,
    contentHash,
  };
}

type KnowledgeArtifact = {
  schemaVersion: "1.0.0";
  artifactId: string;
  createdAt: string;
  operator: string;
  concept: string;
  summary: string;
  payload: any;
  provenance: {
    pipelineVersion: string;
    lexiconIndexHash: string;
    seed: number;
    configHash: string;
    source: { kind: "seed" | "chat" | "cli"; ref: string };
  };
  tags: string[];
  status: "canonical" | "pending";
};

function buildSeedArtifacts(seed: number, lexiconIndexHash: string): KnowledgeArtifact[] {
  const rand = mulberry32(seed);
  const createdAt = nowIso();

  const pipelineVersion = "thoughtPipeline@0.1.0";
  const config = {
    mode: "seed",
    governance: { allowUnknownTags: false },
    memory: { file: ".brain/memory/knowledge.ndjson" },
  };
  const configHash = sha256(JSON.stringify(config));

  const concepts = ["determinism", "review_queue", "lexicon_index", "traceability", "governance"];
  const operators = [
    "prompt.operator.seed",
    "prompt.operator.summarize",
    "prompt.operator.validate",
    "prompt.operator.optimize",
    "prompt.operator.diff",
  ];

  const artifacts: KnowledgeArtifact[] = [];

  for (let i = 0; i < 12; i++) {
    const concept = pick(rand, concepts)!;
    const operator = pick(rand, operators)!;
    const artifactId = stableId("art", seed, `${operator}:${concept}:${i}`);

    let note: string;
    switch (operator) {
      case "prompt.operator.seed":
        note = "Seeded canonical scaffolding for governance + memory + lexicon.";
        break;
      case "prompt.operator.validate":
        note = "Validated taxonomy + lexicon index hash presence for replay.";
        break;
      case "prompt.operator.optimize":
        note = "Identified the next bottleneck: IDE↔Nucleus bridge to execute CLIs deterministically.";
        break;
      case "prompt.operator.diff":
        note = "Diff plan: seed vs existing files; no overwrite unless --force.";
        break;
      default:
        note = "Summarized system invariants and what must stay stable.";
        break;
    }

    const payload = {
      note,
      metrics: {
        confidence: clamp(0.7 + rand() * 0.25, 0, 1),
        novelty: clamp(0.4 + rand() * 0.5, 0, 1),
      },
    };

    artifacts.push({
      schemaVersion: "1.0.0",
      artifactId,
      createdAt,
      operator,
      concept,
      summary: `${operator} applied to ${concept}`,
      payload,
      provenance: {
        pipelineVersion,
        lexiconIndexHash,
        seed,
        configHash,
        source: { kind: "seed", ref: "scripts/seed/seed-world-engine.ts" },
      },
      tags: ["contract.first", "determinism", "traceability", "memory.ndjson"],
      status: "canonical",
    });
  }

  return artifacts;
}

type ReviewQueueItem = {
  schemaVersion: "1.0.0";
  id: string;
  createdAt: string;
  kind: "lexicon.entry.suggestion" | "artifact.suggestion";
  status: "pending" | "approved" | "rejected";
  reason: string;
  payload: any;
};

function buildReviewQueue(seed: number): ReviewQueueItem[] {
  const createdAt = nowIso();

  return [
    {
      schemaVersion: "1.0.0",
      id: stableId("rq", seed, "unknown-tag-demo"),
      createdAt,
      kind: "artifact.suggestion",
      status: "pending",
      reason:
        "Demonstration record: this is what quarantined items look like. In real use, unknown tags/operators route here.",
      payload: {
        observed: { tag: "unknown.experimental.tag", operator: "prompt.operator.unknown" },
        suggestedAction: "Add tag/operator to taxonomy registry OR reject.",
      },
    },
  ];
}

async function seed(opts: SeedOpts) {
  // dirs
  await ensureDir(PATHS.taxonomyDir);
  await ensureDir(PATHS.lexiconEntriesDir);
  await ensureDir(PATHS.brainMemoryDir);
  await ensureDir(PATHS.brainReviewDir);

  // taxonomy registry
  const taxonomy = buildTaxonomyRegistry(opts.seed);
  const wroteTaxonomy = await writeJsonIfMissing(PATHS.taxonomyRegistry, taxonomy, opts.force);

  // lexicon entries
  const lexEntries = buildLexiconEntries(opts.seed);
  let wroteAnyLex = false;

  for (const e of lexEntries) {
    const file = path.join(PATHS.lexiconEntriesDir, `${e.id}.lexicon.json`);
    const wrote = await writeJsonIfMissing(file, e, opts.force);
    wroteAnyLex = wroteAnyLex || wrote;
  }

  // lexicon index
  const lexIndex = await buildLexiconIndex(lexEntries);
  const wroteIndex = await writeJsonIfMissing(PATHS.lexiconIndex, lexIndex, opts.force);

  // memory artifacts (canonical)
  const artifacts = buildSeedArtifacts(opts.seed, lexIndex.contentHash);
  const wroteMemory = await appendNdjsonIfEmpty(PATHS.knowledgeNdjson, artifacts, opts.force);

  // review queue (pending)
  const rq = buildReviewQueue(opts.seed);
  const wroteReviewQueue = await appendNdjsonIfEmpty(PATHS.reviewQueueNdjson, rq, opts.force);

  // tiny README hints (optional but helpful)
  const readmeBrain = `# .brain/\n\nGenerated by seed script.\n\n- memory/knowledge.ndjson — canonical artifacts\n- review/review.queue.ndjson — quarantined pending items\n`;
  const wroteBrainReadme = await writeTextIfMissing(path.join(PATHS.brainDir, "README.md"), readmeBrain, false);

  const summary = {
    seed: opts.seed,
    force: opts.force,
    wrote: {
      taxonomyRegistry: wroteTaxonomy,
      lexiconEntries: wroteAnyLex,
      lexiconIndex: wroteIndex,
      memoryNdjson: wroteMemory,
      reviewQueueNdjson: wroteReviewQueue,
      brainReadme: wroteBrainReadme,
    },
    hashes: {
      taxonomyRegistryHash: sha256(JSON.stringify(taxonomy)),
      lexiconIndexHash: lexIndex.contentHash,
    },
    files: PATHS,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

seed(parseArgs(process.argv.slice(2))).catch((err) => {
  console.error(err);
  process.exit(1);
});
