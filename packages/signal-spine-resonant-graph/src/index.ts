import {
  type Domain,
  type Signal,
  type SignalMetadata,
  stableStringify,
  fnv1a64Hex,
  SignalError,
  assertSignalBase,
} from "@world-engine/signal-spine-contract";
import {
  type SpectralMetrics,
  type ShapeMetrics,
  type TextMetrics,
  spectralFromHz,
  spectralFromMusic,
  shapeMetrics,
  textMetrics,
} from "@world-engine/signal-spine-metrics";

/* ----------------------------- Graph Schema ---------------------------- */

export type NodeKind = "signal" | "artifact";

export type NodeId = string; // "node_<hex>"
export type EdgeId = string; // "edge_<hex>"

export type NodeMetrics = Readonly<{
  text?: TextMetrics;
  spectral?: SpectralMetrics;
  shape?: ShapeMetrics;
  // arbitrary extension bag
  extra?: Record<string, unknown>;
}>;

export type GraphNode = Readonly<{
  id: NodeId;
  kind: NodeKind;
  domain: Domain;
  signal_id?: string; // references sig.metadata.id if kind=="signal"
  label?: string;
  metadata: SignalMetadata;
  metrics?: NodeMetrics;
}>;

export type EdgeKind =
  | "convert"
  | "transform"
  | "derived"
  | "similarity"
  | "semantic"
  | "constraint";

export type GraphEdge = Readonly<{
  id: EdgeId;
  kind: EdgeKind;
  from: NodeId;
  to: NodeId;
  name: string;
  r_score: number; // [0..1]
  weights: Readonly<{ w_text: number; w_spectral: number; w_shape: number; w_meta: number }>;
  evidence?: Readonly<Record<string, unknown>>;
  created_at_utc: string;
}>;

export type ResonantGraphSnapshot = Readonly<{
  schema_version: "1.0.0";
  graph_id: string;
  created_at_utc: string;
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
}>;

/* ------------------------- Deterministic IDs -------------------------- */

function nodeIdFrom(input: unknown): NodeId {
  return `node_${fnv1a64Hex(stableStringify(input))}`;
}
function edgeIdFrom(input: unknown): EdgeId {
  return `edge_${fnv1a64Hex(stableStringify(input))}`;
}

/* ------------------------------ R-Score ------------------------------- */
/**
 * R-score: weighted alignment in [0..1]
 * - Text: compare entropy + palindromicity
 * - Spectral: compare centroid + spread (normalized)
 * - Shape: compare lobe, winding, symmetry
 * - Meta: tag overlap (Jaccard)
 *
 * Deterministic and explainable: evidence includes sub-scores.
 */
export type RScoreWeights = Readonly<{ w_text: number; w_spectral: number; w_shape: number; w_meta: number }>;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function safeRatioDiff(a: number, b: number, eps = 1e-9): number {
  // returns normalized similarity: 1 - |a-b|/max(|a|,|b|,eps)
  const denom = Math.max(Math.abs(a), Math.abs(b), eps);
  return clamp01(1 - Math.abs(a - b) / denom);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

export function computeRScore(a: GraphNode, b: GraphNode, weights: RScoreWeights): { r: number; evidence: any } {
  const W = weights.w_text + weights.w_spectral + weights.w_shape + weights.w_meta;
  if (W <= 0) throw new SignalError("E_RANGE", "RScoreWeights sum must be > 0");

  let sText = 0, sSpec = 0, sShape = 0, sMeta = 0;

  if (weights.w_text > 0 && a.metrics?.text && b.metrics?.text) {
    const e = safeRatioDiff(a.metrics.text.entropy_bits, b.metrics.text.entropy_bits);
    const p = safeRatioDiff(a.metrics.text.palindromicity, b.metrics.text.palindromicity);
    sText = (e + p) / 2;
  }

  if (weights.w_spectral > 0 && a.metrics?.spectral && b.metrics?.spectral) {
    const c = safeRatioDiff(a.metrics.spectral.centroid_hz, b.metrics.spectral.centroid_hz);
    const sp = safeRatioDiff(a.metrics.spectral.spread_hz, b.metrics.spectral.spread_hz);
    sSpec = (c + sp) / 2;
  }

  if (weights.w_shape > 0 && a.metrics?.shape && b.metrics?.shape) {
    const l = safeRatioDiff(a.metrics.shape.lobe_estimate, b.metrics.shape.lobe_estimate, 1);
    const w = safeRatioDiff(a.metrics.shape.winding_estimate, b.metrics.shape.winding_estimate, 1);
    const sym = safeRatioDiff(a.metrics.shape.symmetry_score, b.metrics.shape.symmetry_score, 1e-6);
    sShape = (l + w + sym) / 3;
  }

  if (weights.w_meta > 0) {
    const ta = a.metadata.tags ?? [];
    const tb = b.metadata.tags ?? [];
    sMeta = jaccard(ta, tb);
  }

  const r =
    (weights.w_text * sText +
      weights.w_spectral * sSpec +
      weights.w_shape * sShape +
      weights.w_meta * sMeta) /
    W;

  return {
    r: clamp01(r),
    evidence: {
      subscores: { text: sText, spectral: sSpec, shape: sShape, meta: sMeta },
      weights,
    },
  };
}

/* --------------------------- Graph Implementation ---------------------- */

export class ResonantGraph {
  private readonly nodes = new Map<NodeId, GraphNode>();
  private readonly edges = new Map<EdgeId, GraphEdge>();
  readonly created_at_utc: string;
  readonly schema_version: "1.0.0" = "1.0.0";
  readonly graph_id: string;

  constructor(opts?: { created_at_utc?: string; graph_id_seed?: string }) {
    this.created_at_utc = opts?.created_at_utc ?? new Date().toISOString();
    this.graph_id = `rg_${fnv1a64Hex(stableStringify({ t: this.created_at_utc, seed: opts?.graph_id_seed ?? null }))}`;
  }

  upsertSignalNode(sig: Signal<any, any, any>, opts?: { label?: string; kind?: NodeKind }): GraphNode {
    assertSignalBase(sig);
    const node: GraphNode = {
      id: nodeIdFrom({ kind: "signal", signal_id: sig.metadata.id, domain: sig.domain }),
      kind: opts?.kind ?? "signal",
      domain: sig.domain,
      signal_id: sig.metadata.id,
      label: opts?.label,
      metadata: sig.metadata,
      metrics: deriveMetrics(sig),
    };
    this.nodes.set(node.id, node);
    return node;
  }

  addEdge(params: Omit<GraphEdge, "id" | "created_at_utc">): GraphEdge {
    if (!this.nodes.has(params.from)) throw new SignalError("E_INVALID", "Edge.from missing node");
    if (!this.nodes.has(params.to)) throw new SignalError("E_INVALID", "Edge.to missing node");
    if (!Number.isFinite(params.r_score) || params.r_score < 0 || params.r_score > 1)
      throw new SignalError("E_RANGE", "Edge.r_score must be in [0,1]");

    const edge: GraphEdge = {
      ...params,
      id: edgeIdFrom({ kind: params.kind, from: params.from, to: params.to, name: params.name, r: params.r_score }),
      created_at_utc: new Date().toISOString(),
    };
    this.edges.set(edge.id, edge);
    return edge;
  }

  linkWithResonance(
    from: NodeId,
    to: NodeId,
    opts: { kind: EdgeKind; name: string; weights?: RScoreWeights; evidence_extra?: Record<string, unknown> }
  ): GraphEdge {
    const a = this.nodes.get(from);
    const b = this.nodes.get(to);
    if (!a || !b) throw new SignalError("E_INVALID", "linkWithResonance: missing nodes");

    const weights: RScoreWeights = opts.weights ?? { w_text: 1, w_spectral: 1, w_shape: 1, w_meta: 0.5 };
    const rs = computeRScore(a, b, weights);

    return this.addEdge({
      kind: opts.kind,
      from,
      to,
      name: opts.name,
      r_score: rs.r,
      weights,
      evidence: { ...rs.evidence, ...opts.evidence_extra },
    });
  }

  getNode(id: NodeId): GraphNode | undefined {
    return this.nodes.get(id);
  }

  neighbors(id: NodeId): GraphEdge[] {
    const out: GraphEdge[] = [];
    for (const e of this.edges.values()) {
      if (e.from === id || e.to === id) out.push(e);
    }
    return out;
  }

  queryNodes(pred: (n: GraphNode) => boolean): GraphNode[] {
    const out: GraphNode[] = [];
    for (const n of this.nodes.values()) if (pred(n)) out.push(n);
    return out;
  }

  queryEdges(pred: (e: GraphEdge) => boolean): GraphEdge[] {
    const out: GraphEdge[] = [];
    for (const e of this.edges.values()) if (pred(e)) out.push(e);
    return out;
  }

  snapshot(): ResonantGraphSnapshot {
    const nodes = Array.from(this.nodes.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
    const edges = Array.from(this.edges.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
    return {
      schema_version: "1.0.0",
      graph_id: this.graph_id,
      created_at_utc: this.created_at_utc,
      nodes,
      edges,
    };
  }
}

/* ---------------------------- Metric Derive ---------------------------- */

function deriveMetrics(sig: Signal<any, any, any>): NodeMetrics {
  // Only compute metrics we can compute safely.
  if (sig.domain === "text") {
    return { text: textMetrics(sig as any) };
  }
  if (sig.domain === "hz") {
    return { spectral: spectralFromHz(sig as any) };
  }
  if (sig.domain === "music") {
    return { spectral: spectralFromMusic(sig as any) };
  }
  if (sig.domain === "shape") {
    return { shape: shapeMetrics(sig as any) };
  }
  return {};
}
