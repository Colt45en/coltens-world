/**
 * @world-engine/flowstate - Deterministic code flow visualization
 *
 * Core: Pure analysis functions (no DOM, deterministic)
 * Render: Visual rendering (canvas 2D, deterministic seeding)
 * Evidence: Cryptographic packets and export utilities
 */

// Core analysis
export type { FlowMetricsInput, FlowMetricsOutput } from "./core/metrics";
export { computeFlowMetrics } from "./core/metrics";

export { tokenize } from "./core/tokenize";

export type { BraceBalance } from "./core/braceBalance";
export { braceBalance } from "./core/braceBalance";

export { hashString32, mulberry32 } from "./core/seed";

// Render types
export type { CanvasFit, FlowVizFrame, FlowVizNode } from "./render/types";
export { fitCanvasToElement } from "./render/canvasFit";

// Ring visualization
export type { RingParticle } from "./render/ringRenderer";
export { makeRingParticles, drawRing } from "./render/ringRenderer";

// Orbit visualization
export type { OrbitNode } from "./render/orbitRenderer";
export { buildOrbitNodes, drawOrbit } from "./render/orbitRenderer";

// Heatmap visualization
export type { HeatmapCell } from "./render/heatmapRenderer";
export { buildHeatmapGrid, drawHeatmap } from "./render/heatmapRenderer";

// Histogram visualization
export type { HistogramBar } from "./render/histogramRenderer";
export { buildHistogramBars, drawHistogram } from "./render/histogramRenderer";

// Evidence utilities
export { sortKeys, canonicalize } from "./evidence/canonicalJson";
export {
  sha256HexFromString,
  sha256HexFromBytes,
  bytesToBase64,
  base64ToBytes,
  dataUrlToBytes,
} from "./evidence/crypto";
export { getOrCreateSessionId, clearSessionId } from "./evidence/session";
export { downloadTextFile, downloadJsonFile, downloadBlob } from "./evidence/download";
