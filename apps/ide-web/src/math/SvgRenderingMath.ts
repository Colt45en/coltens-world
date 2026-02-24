/**
 * SVG RENDERING MATHEMATICS
 * Formalizes the geometric and kinematic equations underlying SVG line rendering
 * and animated limb vectors. Pure parametric equations and state transitions.
 *
 * COORDINATE SYSTEM CONVENTION:
 * ─────────────────────────────
 * Internal math space uses MATHEMATICAL COORDINATES (y-up):
 *   - +x axis points RIGHT
 *   - +y axis points UP
 *   - Angles measured counterclockwise from +x (standard mathematical convention)
 */

type Point2D = [number, number];

/**
 * Semantic classification of drawable line segments
 */
export enum SegmentKind {
  STATIC = "static",  // Background/context geometry
  USER = "user",      // User-created edges between nodes
  LIMB = "limb",      // Animated limb vectors
}

/**
 * Frame timing configuration for mapping discrete frames to continuous time
 */
export class FrameTimingConfig {
  frameDt: number;           // Duration of one frame in seconds (default 30 Hz)
  frameIndex: number;        // Current frame counter
  phaseOffsetFrames: number; // Phase shift in frame units

  constructor(
    frameDt = 0.03,
    frameIndex = 0,
    phaseOffsetFrames = 0.0
  ) {
    this.frameDt = frameDt;
    this.frameIndex = frameIndex;
    this.phaseOffsetFrames = phaseOffsetFrames;
  }

  /**
   * Convert discrete frame configuration to continuous time parameter
   * t = (frame_index + phase_offset_frames) * frame_dt
   */
  continuousTime(): number {
    return (this.frameIndex + this.phaseOffsetFrames) * this.frameDt;
  }
}

/**
 * SVG rendering plane: axis-aligned rectangular domain
 * Domain D = {(x,y) ∈ ℝ² | 0 ≤ x ≤ W, 0 ≤ y ≤ H}
 */
export class SvgViewport {
  width: number;
  height: number;
  background: string;

  constructor(width: number, height: number, background = "white") {
    this.width = width;
    this.height = height;
    this.background = background;
  }

  get bounds(): [number, number, number, number] {
    return [0, 0, this.width, this.height];
  }

  get center(): Point2D {
    return [this.width / 2, this.height / 2];
  }

  containsPoint(point: Point2D): boolean {
    const [x, y] = point;
    return x >= 0 && x <= this.width && y >= 0 && y <= this.height;
  }
}

/**
 * SVG line styling parameters (non-geometric)
 */
export class LineAttributes {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string | null;
  opacity: number;

  constructor(
    stroke = "black",
    strokeWidth = 1.0,
    strokeDasharray: string | null = null,
    opacity = 1.0
  ) {
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
    this.strokeDasharray = strokeDasharray;
    this.opacity = opacity;
  }

  toDict(): Record<string, string> {
    const attrs: Record<string, string> = {
      stroke: this.stroke,
      "stroke-width": String(this.strokeWidth),
      opacity: String(this.opacity),
    };
    if (this.strokeDasharray) {
      attrs["stroke-dasharray"] = this.strokeDasharray;
    }
    return attrs;
  }
}

/**
 * Parametric line segment from A to B
 * L(t) = (1-t)A + tB  for t ∈ [0,1]
 */
export class LineSegment {
  start: Point2D;
  end: Point2D;
  attributes: LineAttributes;

  constructor(
    start: Point2D,
    end: Point2D,
    attributes?: LineAttributes
  ) {
    this.start = start;
    this.end = end;
    this.attributes = attributes || new LineAttributes();
  }

  /**
   * Evaluate L(t) = (1-t)A + tB for parameter t ∈ [0,1]
   */
  parametric(t: number): Point2D {
    if (t < 0 || t > 1) {
      throw new Error(`Parameter t must be in [0,1], got ${t}`);
    }

    const [x1, y1] = this.start;
    const [x2, y2] = this.end;

    const x = (1 - t) * x1 + t * x2;
    const y = (1 - t) * y1 + t * y2;

    return [x, y];
  }

  /**
   * Direction vector d = ⟨x₂-x₁, y₂-y₁⟩
   */
  get directionVector(): Point2D {
    const [x1, y1] = this.start;
    const [x2, y2] = this.end;
    return [x2 - x1, y2 - y1];
  }

  /**
   * Euclidean length: ℓ = √[(x₂-x₁)² + (y₂-y₁)²]
   */
  get length(): number {
    const [dx, dy] = this.directionVector;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Slope m = (y₂-y₁)/(x₂-x₁), or null if nearly vertical
   */
  get slope(): number | null {
    const [dx, dy] = this.directionVector;
    if (Math.abs(dx) < 1e-10) return null;
    return dy / dx;
  }

  /**
   * Angle θ = atan2(dy, dx) in radians [-π, π]
   * MATHEMATICAL coordinates (y-up)
   */
  get angle(): number {
    const [dx, dy] = this.directionVector;
    return Math.atan2(dy, dx);
  }

  /**
   * Sample evenly-spaced points along the segment
   */
  samplePoints(numSamples = 10): Point2D[] {
    if (numSamples < 2) {
      throw new Error("numSamples must be ≥ 2");
    }
    const points: Point2D[] = [];
    for (let i = 0; i < numSamples; i++) {
      points.push(this.parametric(i / (numSamples - 1)));
    }
    return points;
  }
}

/**
 * Anchored ray with harmonic angular oscillation
 * θ(t) = sin(v·t)·Aₘₐₓ
 * Endpoint: E(t) = S + L·(cos(θ(t)), sin(θ(t)))
 */
export class LimbVector {
  startX: number;
  startY: number;
  length: number;
  speed: number;
  maxSwing: number;
  phaseOffsetFrames: number;

  constructor(
    startX: number,
    startY: number,
    length: number,
    speed = 0.05,
    maxSwing = Math.PI / 6
  ) {
    this.startX = startX;
    this.startY = startY;
    this.length = length;
    this.speed = speed;
    this.maxSwing = maxSwing;
    this.phaseOffsetFrames = 0;
  }

  /**
   * Compute angle at continuous time t
   * θ(t) = sin(v·t)·Aₘₐₓ
   */
  oscillatingAngle(t: number): number {
    return Math.sin(this.speed * t) * this.maxSwing;
  }

  /**
   * Angular velocity: dθ/dt = cos(v·t)·v·Aₘₐₓ
   */
  angularVelocity(t: number): number {
    return Math.cos(this.speed * t) * this.speed * this.maxSwing;
  }

  /**
   * Endpoint for static angle θ
   * E = S + L·(cos(θ), sin(θ))
   */
  staticEndpoint(theta: number): Point2D {
    const ex = this.startX + this.length * Math.cos(theta);
    const ey = this.startY + this.length * Math.sin(theta);
    return [ex, ey];
  }

  /**
   * Endpoint at continuous time t with oscillation
   * E(t) = S + L·(cos(sin(v·t)·Aₘₐₓ), sin(sin(v·t)·Aₘₐₓ))
   */
  dynamicEndpoint(t: number): Point2D {
    const thetaT = this.oscillatingAngle(t);
    return this.staticEndpoint(thetaT);
  }

  /**
   * Endpoint at discrete frame index with automatic time mapping
   */
  dynamicEndpointAtTick(
    frameConfig: FrameTimingConfig,
    phaseOffsetFrames = 0.0
  ): Point2D {
    const tEffective =
      (frameConfig.frameIndex + phaseOffsetFrames) * frameConfig.frameDt;
    return this.dynamicEndpoint(tEffective);
  }

  /**
   * Create line segment from anchor to current endpoint at time t
   */
  instantaneousSegment(t: number): LineSegment {
    const endpoint = this.dynamicEndpoint(t);
    return new LineSegment(
      [this.startX, this.startY],
      endpoint,
      new LineAttributes("cyan", 2.0)
    );
  }

  /**
   * Create line segment using frame timing
   */
  instantaneousSegmentAtTick(
    frameConfig: FrameTimingConfig,
    phaseOffsetFrames = 0.0
  ): LineSegment {
    const endpoint = this.dynamicEndpointAtTick(frameConfig, phaseOffsetFrames);
    return new LineSegment(
      [this.startX, this.startY],
      endpoint,
      new LineAttributes("cyan", 2.0)
    );
  }
}

/**
 * Configuration for multi-limb array with independent length and phase control
 */
export class LimbProfile {
  lengthFn: (i: number) => number;
  phaseFn: (i: number) => number;
  numLimbs: number;
  anchorX: number;
  anchorY: number;
  speed: number;
  maxSwing: number;

  constructor(
    lengthFn: (i: number) => number,
    phaseFn: (i: number) => number,
    numLimbs: number,
    anchorX: number,
    anchorY: number,
    speed = 0.05,
    maxSwing = Math.PI / 6
  ) {
    this.lengthFn = lengthFn;
    this.phaseFn = phaseFn;
    this.numLimbs = numLimbs;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.speed = speed;
    this.maxSwing = maxSwing;
  }
}

/**
 * Static line with metadata
 */
export interface RenderedLine {
  segment: LineSegment;
  isUserCreated: boolean;
  creationTime: number;
}

/**
 * User-created edge between nodes
 */
export interface ConnectedNodesPair {
  nodeAIdx: number;
  nodeBIdx: number;
  segment: LineSegment;
  userActionTime: number;
}

/**
 * Rendering snapshot output
 */
export interface RenderSnapshot {
  time: number;
  frameIndex?: number;
  lines: Array<{
    type: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    style: Record<string, string>;
    [key: string]: any;
  }>;
  focus: {
    focalNode: number | null;
    focalDistance: number;
    byNode: Record<number, { distance: number; closestLimb: number | null }>;
  };
}

/**
 * Complete SVG line rendering pipeline
 *
 * INVARIANTS:
 * 1. All static lines are viewport-safe
 * 2. User edges validated (indices, no self-edges, no duplicates)
 * 3. Dynamic limbs may extend beyond viewport
 * 4. All time-dependent state uses same FrameTimingConfig
 * 5. Coordinates in MATHEMATICAL space (y-up)
 */
export class SvgLineRenderingEngine {
  viewport: SvgViewport;
  staticLines: RenderedLine[];
  userEdges: ConnectedNodesPair[];
  limbVectors: LimbVector[];
  nodes: Point2D[];

  constructor(viewport: SvgViewport) {
    this.viewport = viewport;
    this.staticLines = [];
    this.userEdges = [];
    this.limbVectors = [];
    this.nodes = [];
  }

  /**
   * Store node positions for focal attention computation
   */
  setReferenceNodes(nodes: Point2D[]): void {
    this.nodes = nodes;
  }

  /**
   * Append static line segment (must be inside viewport)
   */
  addStaticLine(segment: LineSegment): void {
    if (!this.viewport.containsPoint(segment.start)) {
      throw new Error(`Start point ${segment.start} outside viewport`);
    }
    if (!this.viewport.containsPoint(segment.end)) {
      throw new Error(`End point ${segment.end} outside viewport`);
    }

    this.staticLines.push({
      segment,
      isUserCreated: false,
      creationTime: 0,
    });
  }

  /**
   * Record user-created edge between nodes (with validation)
   */
  addUserEdge(nodeAIdx: number, nodeBIdx: number, nodes: Point2D[]): void {
    // Validate indices
    if (nodeAIdx < 0 || nodeAIdx >= nodes.length) {
      throw new Error(`nodeAIdx ${nodeAIdx} out of range`);
    }
    if (nodeBIdx < 0 || nodeBIdx >= nodes.length) {
      throw new Error(`nodeBIdx ${nodeBIdx} out of range`);
    }

    // No self-edges
    if (nodeAIdx === nodeBIdx) {
      throw new Error(`Self-edge prohibited`);
    }

    // No duplicates
    const normalizedPair: [number, number] = [
      Math.min(nodeAIdx, nodeBIdx),
      Math.max(nodeAIdx, nodeBIdx),
    ];

    for (const edge of this.userEdges) {
      const existingPair: [number, number] = [
        Math.min(edge.nodeAIdx, edge.nodeBIdx),
        Math.max(edge.nodeAIdx, edge.nodeBIdx),
      ];
      if (
        existingPair[0] === normalizedPair[0] &&
        existingPair[1] === normalizedPair[1]
      ) {
        throw new Error(`Duplicate edge already exists`);
      }
    }

    // Add edge
    const start = nodes[nodeAIdx]!;
    const end = nodes[nodeBIdx]!;
    const segment = new LineSegment(
      start,
      end,
      new LineAttributes("cyan", 2.0)
    );

    this.userEdges.push({
      nodeAIdx,
      nodeBIdx,
      segment,
      userActionTime: 0,
    });
  }

  /**
   * Register oscillating limb vector
   */
  addLimbVector(
    startX: number,
    startY: number,
    length: number,
    speed = 0.05
  ): void {
    const limb = new LimbVector(startX, startY, length, speed);
    this.limbVectors.push(limb);
  }

  /**
   * Add multiple limbs with independent length and phase profiles
   */
  addLimbProfile(profile: LimbProfile): void {
    for (let i = 0; i < profile.numLimbs; i++) {
      const length = profile.lengthFn(i);
      const limb = new LimbVector(
        profile.anchorX,
        profile.anchorY,
        length,
        profile.speed,
        profile.maxSwing
      );
      limb.phaseOffsetFrames = profile.phaseFn(i);
      this.limbVectors.push(limb);
    }
  }

  /**
   * Compute focal attention: distance from each node to nearest limb
   */
  computeFocalAttention(limbEndpoints: Point2D[]): RenderSnapshot["focus"] {
    if (this.nodes.length === 0 || limbEndpoints.length === 0) {
      return {
        focalNode: null,
        focalDistance: Infinity,
        byNode: {},
      };
    }

    const attentionByNode: Record<
      number,
      { distance: number; closestLimb: number | null }
    > = {};
    let minGlobalDist = Infinity;
    let focalNodeIdx: number | null = null;

    for (let nodeIdx = 0; nodeIdx < this.nodes.length; nodeIdx++) {
      const nodePos = this.nodes[nodeIdx];
      if (!nodePos) continue;

      let minDist = Infinity;
      let closestLimb: number | null = null;

      for (let limbIdx = 0; limbIdx < limbEndpoints.length; limbIdx++) {
        const endpoint = limbEndpoints[limbIdx];
        if (!endpoint) continue;

        const dx = endpoint[0] - nodePos[0];
        const dy = endpoint[1] - nodePos[1];
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDist) {
          minDist = dist;
          closestLimb = limbIdx;
        }
      }

      attentionByNode[nodeIdx] = {
        distance: minDist,
        closestLimb,
      };

      if (minDist < minGlobalDist) {
        minGlobalDist = minDist;
        focalNodeIdx = nodeIdx;
      }
    }

    return {
      focalNode: focalNodeIdx,
      focalDistance: focalNodeIdx !== null ? minGlobalDist : Infinity,
      byNode: attentionByNode,
    };
  }

  /**
   * Capture rendering state at continuous time t
   * Returns pure data snapshot (serializable)
   */
  snapshotAtTime(t: number): RenderSnapshot {
    const linesOut: RenderSnapshot["lines"] = [];

    // Static lines
    for (const rendered of this.staticLines) {
      const seg = rendered.segment;
      linesOut.push({
        type: SegmentKind.STATIC,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        creationTime: rendered.creationTime,
      });
    }

    // User edges
    for (const edge of this.userEdges) {
      const seg = edge.segment;
      linesOut.push({
        type: SegmentKind.USER,
        aIndex: edge.nodeAIdx,
        bIndex: edge.nodeBIdx,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        userActionTime: edge.userActionTime,
      });
    }

    // Dynamic limb segments
    const limbEndpoints: Point2D[] = [];
    for (const limb of this.limbVectors) {
      const seg = limb.instantaneousSegment(t);
      limbEndpoints.push(seg.end);
      linesOut.push({
        type: SegmentKind.LIMB,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        length: limb.length,
        speed: limb.speed,
        maxSwing: limb.maxSwing,
      });
    }

    // Focal attention
    const focus = this.computeFocalAttention(limbEndpoints);

    return {
      time: t,
      lines: linesOut,
      focus,
    };
  }

  /**
   * Capture rendering state at discrete frame index
   */
  snapshotAtFrame(frameConfig: FrameTimingConfig): RenderSnapshot {
    const linesOut: RenderSnapshot["lines"] = [];

    // Static lines
    for (const rendered of this.staticLines) {
      const seg = rendered.segment;
      linesOut.push({
        type: SegmentKind.STATIC,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        creationTime: rendered.creationTime,
      });
    }

    // User edges
    for (const edge of this.userEdges) {
      const seg = edge.segment;
      linesOut.push({
        type: SegmentKind.USER,
        aIndex: edge.nodeAIdx,
        bIndex: edge.nodeBIdx,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        userActionTime: edge.userActionTime,
      });
    }

    // Dynamic limb segments with frame timing
    const limbEndpoints: Point2D[] = [];
    for (const limb of this.limbVectors) {
      const phaseOffset = limb.phaseOffsetFrames;
      const seg = limb.instantaneousSegmentAtTick(frameConfig, phaseOffset);
      limbEndpoints.push(seg.end);
      linesOut.push({
        type: SegmentKind.LIMB,
        x1: seg.start[0],
        y1: seg.start[1],
        x2: seg.end[0],
        y2: seg.end[1],
        style: seg.attributes.toDict(),
        length: limb.length,
        speed: limb.speed,
        maxSwing: limb.maxSwing,
      });
    }

    // Focal attention
    const focus = this.computeFocalAttention(limbEndpoints);

    return {
      time: frameConfig.continuousTime(),
      frameIndex: frameConfig.frameIndex,
      lines: linesOut,
      focus,
    };
  }
}
