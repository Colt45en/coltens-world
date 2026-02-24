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
import { ResonantGraph } from "../index.js";

function main() {
  const g = new ResonantGraph({ graph_id_seed: "demo" });

  const textA = makeTextSignalFromAsciiLetters("SATORAREPOTENETOPERAROTAS", { source: "demo", tags: ["palindrome"] });
  const textB = makeTextSignalFromAsciiLetters("WORLDENGINE", { source: "demo", tags: ["engine"] });

  const rho = makeDefaultRhoTable();
  const hzA = runPipeline(textA, [
    { kind: "convert", converter: textToIntervalsConverter(rho) },
    { kind: "convert", converter: intervalsToHzConverter(528) },
  ]) as HzSignal;

  const hzB = runPipeline(textB, [
    { kind: "convert", converter: textToIntervalsConverter(rho) },
    { kind: "convert", converter: intervalsToHzConverter(528) },
  ]) as HzSignal;

  const shapeA = generateStereoLissajousFromHz(hzA, {
    duration_seconds: 1.25,
    sample_rate_hz: 240,
    R_L: [1, 2, 3],
    R_R: [1, 2, 4],
    a: [1, 0.35, 0.2],
    b: [1, 0.35, 0.2],
  }) as ShapeSignal;

  const shapeB = generateStereoLissajousFromHz(hzB, {
    duration_seconds: 1.25,
    sample_rate_hz: 240,
    R_L: [1, 2, 3],
    R_R: [1, 2, 4],
    a: [1, 0.35, 0.2],
    b: [1, 0.35, 0.2],
  }) as ShapeSignal;

  const nTextA = g.upsertSignalNode(textA, { label: "text:A" });
  const nTextB = g.upsertSignalNode(textB, { label: "text:B" });
  const nHzA = g.upsertSignalNode(hzA, { label: "hz:A" });
  const nHzB = g.upsertSignalNode(hzB, { label: "hz:B" });
  const nShapeA = g.upsertSignalNode(shapeA, { label: "shape:A" });
  const nShapeB = g.upsertSignalNode(shapeB, { label: "shape:B" });

  // conversion lineage edges (r_score=1 by definition of derivation)
  g.addEdge({
    kind: "convert",
    from: nTextA.id,
    to: nHzA.id,
    name: "text->hz",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "derivation lineage" },
  });
  g.addEdge({
    kind: "convert",
    from: nTextB.id,
    to: nHzB.id,
    name: "text->hz",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "derivation lineage" },
  });

  g.addEdge({
    kind: "convert",
    from: nHzA.id,
    to: nShapeA.id,
    name: "hz->shape(lissajous)",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "generator lineage" },
  });
  g.addEdge({
    kind: "convert",
    from: nHzB.id,
    to: nShapeB.id,
    name: "hz->shape(lissajous)",
    r_score: 1,
    weights: { w_text: 0, w_spectral: 0, w_shape: 0, w_meta: 0 },
    evidence: { reason: "generator lineage" },
  });

  // resonance edges: searchable similarity
  g.linkWithResonance(nTextA.id, nTextB.id, { kind: "similarity", name: "text resonance" });
  g.linkWithResonance(nHzA.id, nHzB.id, { kind: "similarity", name: "spectral resonance" });
  g.linkWithResonance(nShapeA.id, nShapeB.id, { kind: "similarity", name: "shape resonance" });

  const snap = g.snapshot();

  // Example query: find “high symmetry” shapes
  const highSym = g.queryNodes((n) => n.domain === "shape" && (n.metrics?.shape?.symmetry_score ?? 0) >= 0.7);

  console.log(JSON.stringify({ graph_id: snap.graph_id, nodes: snap.nodes.length, edges: snap.edges.length, highSym }, null, 2));
}

main();
