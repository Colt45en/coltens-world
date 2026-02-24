import {
  makeTextSignalFromAsciiLetters,
  makeDefaultRhoTable,
  textToIntervalsConverter,
  intervalsToHzConverter,
  runPipeline,
  generateStereoLissajousFromHz,
  type HzSignal,
  type ShapeSignal,
} from "@world-engine/signal-spine-contract";
import { ResonantGraph } from "@world-engine/signal-spine-resonant-graph";
import { executeQuery, buildIndexFromSnapshot } from "../index.js";

function main() {
  const g = new ResonantGraph({ graph_id_seed: "query-demo" });

  const text = makeTextSignalFromAsciiLetters("SATORAREPOTENETOPERAROTAS", { source: "demo", tags: ["palindrome"] });
  const rho = makeDefaultRhoTable();

  const hz = runPipeline(text, [
    { kind: "convert", converter: textToIntervalsConverter(rho) },
    { kind: "convert", converter: intervalsToHzConverter(528) },
  ]) as HzSignal;

  const shape = generateStereoLissajousFromHz(hz, {
    duration_seconds: 1.25,
    sample_rate_hz: 240,
    R_L: [1, 2, 3],
    R_R: [1, 2, 4],
    a: [1, 0.35, 0.2],
    b: [1, 0.35, 0.2],
  }) as ShapeSignal;

  const nText = g.upsertSignalNode(text, { label: "text:pal" });
  const nHz = g.upsertSignalNode(hz, { label: "hz:pal" });
  const nShape = g.upsertSignalNode(shape, { label: "shape:pal" });

  g.addEdge({
    kind: "convert",
    from: nText.id,
    to: nHz.id,
    name: "text->hz",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "lineage" },
  });

  g.addEdge({
    kind: "convert",
    from: nHz.id,
    to: nShape.id,
    name: "hz->shape",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "lineage" },
  });

  const snapshot = g.snapshot();
  const index = buildIndexFromSnapshot(snapshot);

  const q1 = `
FIND domain:shape
WHERE metrics.shape.symmetry_score >= 0.5
RETURN node.id,node.label,metrics.shape.symmetry_score,metrics.shape.lobe_estimate
ORDER BY metrics.shape.symmetry_score DESC
LIMIT 10
`.trim();

  const q2 = `
FIND domain:text
WHERE metadata.tags HAS "palindrome"
JOIN via edges(kind=convert) DIR=out DEPTH 4
RETURN node.id,node.domain,node.label,r_score,path
ORDER BY r_score DESC
LIMIT 25
`.trim();

  console.log(JSON.stringify({ q1: executeQuery(index, q1), q2: executeQuery(index, q2) }, null, 2));
}

main();
