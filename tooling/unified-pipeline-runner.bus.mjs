#!/usr/bin/env node
import crypto from "node:crypto";

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowMs() {
  return Date.now();
}

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** ---- Bus (local) ----
 * Replace this with WS publish later.
 */
class EnvelopeBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, cb) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
    return () => set.delete(cb);
  }

  publish(envelope) {
    const set = this.listeners.get(envelope.type);
    if (!set) return;
    for (const cb of set) cb(envelope);
  }
}

/** ---- Envelope Factory ---- */

function createEnvelopeFactory({ source, traceId }) {
  return function env(type, data, span = {}) {
    const spanId = span.spanId ?? newId("span");
    return {
      v: 1,
      id: newId("msg"),
      ts: new Date().toISOString(),
      type,
      source,
      traceId,
      spanId,
      parentSpanId: span.parentSpanId,
      severity: span.severity ?? "info",
      data,
    };
  };
}

/** ---- Input Kind Detection ---- */

function detectInputKind(text) {
  const t = text.trim();

  if (/```/.test(t)) return "code";
  if (/<[a-z][\s\S]*>/i.test(t) && /<\/[a-z]+>/i.test(t)) return "code";
  if (/import\s+.+from\s+['"]/.test(t) || /\bexport\s+(default|const|function|class)\b/.test(t))
    return "code";
  if (/\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bclass\b/.test(t) && /[;{}]/.test(t)) return "code";
  if (/=>/.test(t) && /[;{}]/.test(t)) return "code";

  const codePunct = (t.match(/[{}();]/g) || []).length;
  const words = (t.match(/[A-Za-z]+/g) || []).length;
  if (words > 0 && codePunct / words > 0.12) return "code";

  return "prose";
}

/** ---- Prose Pipeline ---- */

const OrthographicRules = {
  yToI: (stem, affix) => {
    if (stem.endsWith("y") && !/[aeiou]y$/i.test(stem) && affix && affix.length > 0) {
      return stem.slice(0, -1) + "i";
    }
    return stem;
  },
  dropSilentE: (stem, affix) => {
    if (stem.endsWith("e") && /^[aeiou]/i.test(affix)) return stem.slice(0, -1);
    return stem;
  },
  doubleConsonant: (stem, affix) => {
    const CVC = /[^aeiou][aeiou][^aeiouhwxy]$/i;
    if (CVC.test(stem) && /^[aeiou]/i.test(affix)) return stem + stem.slice(-1);
    return stem;
  },
};

function toyMorphAnalyze(token) {
  const lower = token.toLowerCase().replace(/[^a-z']/g, "");
  const suffixes = [];
  let stem = lower;

  const commonSufs = [
    "ness",
    "ing",
    "ed",
    "ly",
    "tion",
    "sion",
    "er",
    "est",
    "able",
    "less",
    "ment",
  ];
  for (const suf of commonSufs.sort((a, b) => b.length - a.length)) {
    if (stem.endsWith(suf) && stem.length > suf.length + 2) {
      suffixes.unshift(suf);
      stem = stem.slice(0, -suf.length);
      break;
    }
  }

  const prefixes = [];
  const commonPrefs = ["re", "un", "in", "im", "dis", "pre", "post", "non", "sub", "super"];
  for (const pre of commonPrefs.sort((a, b) => b.length - a.length)) {
    if (stem.startsWith(pre) && stem.length > pre.length + 2) {
      prefixes.push(pre);
      stem = stem.slice(pre.length);
      break;
    }
  }

  let pos = "UNK";
  if (suffixes.includes("ly")) {
    pos = "ADV";
  } else if (suffixes.includes("ness")) {
    pos = "NOUN";
  } else if (suffixes.includes("ing")) {
    pos = "VERB";
  }

  return { root: stem, prefixes, suffixes, pos };
}

function proseDecompose(input) {
  const tokens = input.split(/\s+/).filter(Boolean);
  return tokens.map((t, i) => ({ token: t, index: i, morph: toyMorphAnalyze(t) }));
}

function proseSuperpose(atoms) {
  return atoms.map((a) => {
    const hyps = [{ val: a.morph, prior: 1 }];
    if (String(a.token).toLowerCase().endsWith("ed")) {
      hyps.push({ val: { ...a.morph, pos: "ADJ" }, prior: 0.85 });
    }
    return { token: a.token, index: a.index, hyps };
  });
}

function proseCollapse(superposed) {
  const rootCounts = new Map();
  for (const s of superposed) {
    for (const h of s.hyps) {
      rootCounts.set(h.val.root, (rootCounts.get(h.val.root) || 0) + 1);
    }
  }
  for (const s of superposed) {
    for (const h of s.hyps) {
      if ((rootCounts.get(h.val.root) || 0) > 1) h.prior *= 1.15;
    }
  }
  for (const s of superposed) {
    for (const h of s.hyps) {
      if ((h.val.root || "").length < 2) h.prior *= 0.4;
    }
  }
  return superposed.map((s) => s.hyps.slice().sort((a, b) => b.prior - a.prior)[0].val);
}

function checkWellFormedness(val) {
  const v = (val.match(/[aeiou]/gi) || []).length;
  const d = val.length ? v / val.length : 0;
  return d > 0.12 && d < 0.65 ? 1.0 : 0.5;
}

function applyAffixGrammar(atom) {
  let surface = atom.root;
  const logs = [];

  if (atom.prefixes?.length) surface = atom.prefixes.join("") + surface;

  if (atom.suffixes?.length) {
    for (const suf of atom.suffixes) {
      const before = surface;
      surface = OrthographicRules.yToI(surface, suf);
      surface = OrthographicRules.dropSilentE(surface, suf);
      surface = OrthographicRules.doubleConsonant(surface, suf);
      if (surface !== before) logs.push(`stem:${before} -> ${surface} before +${suf}`);
      surface += suf;
    }
  }

  return { surface, logs };
}

function proseSynthesize(collapsedAtoms) {
  return collapsedAtoms
    .map((a, idx) => {
      const { surface, logs } = applyAffixGrammar(a);

      const wellFormed = checkWellFormedness(surface);
      const fit = 0.75;
      const novelty = 0.15;
      const complexity = ((a.prefixes?.length || 0) + (a.suffixes?.length || 0)) * 0.1;

      const score = 0.45 * wellFormed + 0.35 * fit + 0.2 * novelty - 0.15 * complexity;

      return {
        id: `prose_cand_${idx}_${sha256(surface).slice(0, 10)}`,
        kind: "lexical_synthesis",
        value: surface,
        score: clamp01(score),
        provenance: { atom: a, transforms: logs },
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** ---- Code Pipeline ---- */

function codeDecompose(input) {
  const t = input.trim();
  const motifs = [];

  if (/\bmap\s*\(|\bfilter\s*\(|\breduce\s*\(/.test(t)) motifs.push("data_pipeline");
  if (/<[a-z][\s\S]*>/.test(t)) motifs.push("html_component");
  if (/:\s*root\b|--[a-z0-9-]+\s*:/.test(t)) motifs.push("css_vars");
  if (/\bfetch\s*\(|\baxios\b/.test(t)) motifs.push("network_call");
  if (/class\s+\w+/.test(t)) motifs.push("class_def");
  if (/function\s+\w+|\(\)\s*=>/.test(t)) motifs.push("fn_def");

  return { raw: t, motifs };
}

const StructuralTemplates = {
  js_map_filter: (data, transform, predicate) => `${data}.map(${transform}).filter(${predicate});`,
  html_component: (tag, className, content) => `<${tag} class="${className}">${content}</${tag}>`,
  css_variable_root: (vars) => `:root { ${vars.map((v) => `--${v.name}: ${v.value};`).join(" ")} }`,
};

function mkCodeCand(value, lang, motif, logs) {
  return {
    id: `code_cand_${sha256(lang + ":" + value).slice(0, 12)}`,
    kind: "structural_synthesis",
    lang,
    value,
    score: 0,
    provenance: { motif, transforms: logs },
  };
}

function validateCode(code, lang) {
  try {
    if (lang === "javascript") {
      new Function(code);
      return 1.0;
    }
    if (lang === "html") return /<[^>]+>/.test(code) ? 0.9 : 0.4;
    if (lang === "css") return /{[^}]*}/.test(code) ? 0.9 : 0.4;
    return 0.6;
  } catch {
    return 0.1;
  }
}

function codeSynthesize(block) {
  const cands = [];

  for (const motif of block.motifs) {
    if (motif === "data_pipeline") {
      const out = StructuralTemplates.js_map_filter("items", "x => x", "Boolean");
      cands.push(mkCodeCand(out, "javascript", motif, ["template:js_map_filter"]));
    }
    if (motif === "html_component") {
      const out = StructuralTemplates.html_component("div", "nexus-node", "");
      cands.push(mkCodeCand(out, "html", motif, ["template:html_component"]));
    }
    if (motif === "css_vars") {
      const out = StructuralTemplates.css_variable_root([{ name: "accent", value: "#eda338" }]);
      cands.push(mkCodeCand(out, "css", motif, ["template:css_variable_root"]));
    }
  }
  cands.push(mkCodeCand(block.raw, "unknown", "as_is", ["pass_through"]));

  for (const c of cands) {
    const wf = validateCode(c.value, c.lang);
    const complexity = Math.min(1, c.value.length / 400);
    c.score = clamp01(0.7 * wf + 0.3 * (1 - complexity));
  }

  return cands.sort((a, b) => b.score - a.score);
}

/** ---- EvidencePacket ---- */

function makeEvidencePacket({ runId, kind, input, stageStats, chosen, candidates }) {
  return {
    v: "1",
    runId,
    kind,
    inputHash: sha256(input),
    ts: new Date().toISOString(),
    stageStats,
    chosenId: chosen ? chosen.id : null,
    candidatesTop: candidates.slice(0, 5).map((c) => ({
      id: c.id,
      score: c.score,
      kind: c.kind,
      lang: c.lang,
    })),
  };
}

/** ---- Unified Runner (Envelope-emitting) ---- */

export function createUnifiedRunnerWithEnvelopes({
  source = "tooling.unifiedRunner",
  bus = new EnvelopeBus(),
} = {}) {
  async function run(input) {
    const kind = detectInputKind(input);
    const runHash = sha256(input).slice(0, 16);
    const runId = `run_${runHash}_${Date.now().toString(16)}`;

    const traceId = `trace_${runHash}_${Date.now().toString(16)}`;
    const env = createEnvelopeFactory({ source, traceId });

    const inputHash = sha256(input);
    const t0 = nowMs();

    // RUN STARTED
    bus.publish(env("pipeline.run.started", { runId, kind, inputHash }, { spanId: newId("span") }));

    const stageStats = [];
    let chosen = null;
    let candidates = [];

    const runSpan = newId("span");

    const stage = async (stageName, fn, statsFn) => {
      const spanId = newId("span");
      bus.publish(
        env(
          "pipeline.stage.started",
          { runId, stage: stageName },
          { spanId, parentSpanId: runSpan },
        ),
      );
      const s0 = nowMs();
      try {
        const payload = await fn();
        const ms = nowMs() - s0;

        const stats = statsFn ? statsFn(payload) : {};
        stageStats.push({ stage: stageName, ok: true, ms });

        bus.publish(
          env(
            "pipeline.stage.completed",
            { runId, stage: stageName, ok: true, ms, stats },
            { spanId, parentSpanId: runSpan },
          ),
        );
        return payload;
      } catch (e) {
        const ms = nowMs() - s0;
        stageStats.push({ stage: stageName, ok: false, ms });
        bus.publish(
          env(
            "pipeline.stage.completed",
            {
              runId,
              stage: stageName,
              ok: false,
              ms,
              stats: {},
              error: {
                code: "STAGE_FAILED",
                message: String(e?.message ?? e),
              },
            },
            { spanId, parentSpanId: runSpan, severity: "error" },
          ),
        );
        throw e;
      }
    };

    if (kind === "prose") {
      const atoms = await stage(
        "prose.decompose",
        () => proseDecompose(input),
        (p) => ({ atoms: p.length }),
      );
      const superposed = await stage(
        "prose.superpose",
        () => proseSuperpose(atoms),
        () => ({ hyps: "beam=toy" }),
      );
      const collapsed = await stage(
        "prose.collapse",
        () => proseCollapse(superposed),
        (p) => ({ collapsed: p.length }),
      );
      candidates = await stage(
        "prose.synthesize",
        () => proseSynthesize(collapsed),
        (p) => ({ candidates: p.length }),
      );
      chosen = candidates[0] ?? null;

      const evidence = await stage(
        "memory.write",
        () =>
          makeEvidencePacket({
            runId,
            kind,
            input,
            stageStats,
            chosen,
            candidates,
          }),
        () => ({ stored: true }),
      );

      const msTotal = nowMs() - t0;
      bus.publish(
        env(
          "pipeline.run.completed",
          {
            runId,
            kind,
            inputHash,
            msTotal,
            chosenId: chosen ? chosen.id : null,
          },
          { spanId: runSpan },
        ),
      );

      return { runId, kind, candidates, chosen, evidence, traceId };
    }

    // code
    const block = await stage(
      "code.decompose",
      () => codeDecompose(input),
      (p) => ({ motifs: p.motifs.length }),
    );
    candidates = await stage(
      "code.synthesize",
      () => codeSynthesize(block),
      (p) => ({ candidates: p.length }),
    );
    chosen = candidates[0] ?? null;

    const evidence = await stage(
      "memory.write",
      () =>
        makeEvidencePacket({
          runId,
          kind,
          input,
          stageStats,
          chosen,
          candidates,
        }),
      () => ({ stored: true }),
    );

    const msTotal = nowMs() - t0;
    bus.publish(
      env(
        "pipeline.run.completed",
        {
          runId,
          kind,
          inputHash,
          msTotal,
          chosenId: chosen ? chosen.id : null,
        },
        { spanId: runSpan },
      ),
    );

    return { runId, kind, candidates, chosen, evidence, traceId };
  }

  return { run, bus };
}

/** ---- CLI ---- */

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv.slice(2).join(" ").trim();
  if (!input) {
    console.error('Usage: node tooling/unified-pipeline-runner.bus.mjs "your input here"');
    process.exit(1);
  }

  const { run, bus } = createUnifiedRunnerWithEnvelopes();

  // Simple console tap: show stage envelopes
  bus.on("pipeline.stage.completed", (env) => {
    const d = env.data;
    console.log(`✔ ${d.stage} ok=${d.ok} ms=${d.ms}`);
  });

  const res = await run(input);
  console.log("\nChosen:");
  console.log(res.chosen);
  console.log("\nEvidence:");
  console.log(res.evidence);
  console.log("\nTraceId:");
  console.log(res.traceId);
}
