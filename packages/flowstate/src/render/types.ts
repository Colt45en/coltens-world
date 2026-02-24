/**
 * Render types - Visualization state
 */

export type FlowVizNode = {
  label: string;
  weight: number;
  a: number;     // angle (radians)
  rN: number;    // normalized radius (0..1)
  sp: number;    // angular speed (radians/frame)
  bob: number;   // phase offset for bobbing
};

export type FlowVizFrame = {
  t: number;                 // time scalar
  energySmooth: number;      // smoothed energy (0..1.5)
  tempoSmooth: number;       // smoothed tempo (0..1)
  boost: number;             // temporary boost multiplier
  tension: number;           // raw tension (int)
  nodes: FlowVizNode[];      // orbit nodes
};

export type CanvasFit = {
  ctx: CanvasRenderingContext2D;
  w: number;                 // CSS pixels
  h: number;                 // CSS pixels
  dpr: number;               // device pixel ratio
};
