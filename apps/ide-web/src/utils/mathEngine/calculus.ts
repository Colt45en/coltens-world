// Calculus utilities for World Engine
// Derivatives, integration, velocity, acceleration, trajectories

export interface CalculusState {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
  formula: string;
}

export class CalculusEngine {
  // Numerical derivative using central difference
  static derivative(f: (x: number) => number, x: number, h: number = 1e-5): number {
    return (f(x + h) - f(x - h)) / (2 * h);
  }

  // Second derivative
  static secondDerivative(f: (x: number) => number, x: number, h: number = 1e-5): number {
    return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  }

  // Symbolic derivative for polynomials [c0, c1, c2, ...] = c0 + c1*x + c2*x^2 + ...
  static polynomialDerivative(coeffs: number[]): number[] {
    if (coeffs.length <= 1) return [0];
    return coeffs.slice(1).map((c, i) => c * (i + 1));
  }

  // Evaluate polynomial at x
  static evaluatePolynomial(coeffs: number[], x: number): number {
    return coeffs.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
  }

  // Kinematic equations (constant acceleration)
  static kinematics = {
    // Position: x = x0 + v0*t + 0.5*a*t^2
    position(x0: number, v0: number, a: number, t: number): number {
      return x0 + v0 * t + 0.5 * a * t * t;
    },

    // Velocity: v = v0 + a*t
    velocity(v0: number, a: number, t: number): number {
      return v0 + a * t;
    },

    // Time to reach velocity: t = (v - v0) / a
    timeToVelocity(v0: number, v: number, a: number): number {
      if (Math.abs(a) < 1e-10) return Infinity;
      return (v - v0) / a;
    },

    // Time to reach position (quadratic formula)
    timeToPosition(x0: number, v0: number, a: number, x: number): number[] {
      // Solve: 0.5*a*t^2 + v0*t + (x0 - x) = 0
      const A = 0.5 * a;
      const B = v0;
      const C = x0 - x;

      if (Math.abs(A) < 1e-10) {
        // Linear equation: v0*t = x - x0
        if (Math.abs(B) < 1e-10) return [];
        return [(x - x0) / v0];
      }

      const discriminant = B * B - 4 * A * C;
      if (discriminant < 0) return [];

      const sqrtD = Math.sqrt(discriminant);
      const t1 = (-B + sqrtD) / (2 * A);
      const t2 = (-B - sqrtD) / (2 * A);

      return [t1, t2].filter((t) => t >= 0);
    },
  };

  // Numerical integration (Simpson's rule)
  static integrate(f: (x: number) => number, a: number, b: number, n: number = 100): number {
    if (n % 2 === 1) n++; // Simpson's rule needs even number of intervals
    const h = (b - a) / n;
    let sum = f(a) + f(b);

    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      const weight = i % 2 === 0 ? 2 : 4;
      sum += weight * f(x);
    }

    return (h / 3) * sum;
  }

  // Area under curve (same as integrate, but named intuitively)
  static areaUnderCurve(
    f: (x: number) => number,
    start: number,
    end: number,
    samples: number = 100
  ): number {
    return this.integrate(f, start, end, samples);
  }
}

// Trajectory simulation for projectiles
export class TrajectorySimulation {
  private x0: number;
  private y0: number;
  private vx0: number;
  private vy0: number;
  private g: number;

  constructor(x0: number = 0, y0: number = 0, vx0: number = 10, vy0: number = 15, gravity: number = 9.8) {
    this.x0 = x0;
    this.y0 = y0;
    this.vx0 = vx0;
    this.vy0 = vy0;
    this.g = gravity;
  }

  // Position at time t
  position(t: number): { x: number; y: number } {
    return {
      x: this.x0 + this.vx0 * t,
      y: this.y0 + this.vy0 * t - 0.5 * this.g * t * t,
    };
  }

  // Velocity at time t
  velocity(t: number): { vx: number; vy: number } {
    return {
      vx: this.vx0,
      vy: this.vy0 - this.g * t,
    };
  }

  // Time when projectile hits ground (y = 0)
  flightTime(): number {
    // Solve: y0 + vy0*t - 0.5*g*t^2 = 0
    if (Math.abs(this.g) < 1e-10) return Infinity;

    const discriminant = this.vy0 * this.vy0 + 2 * this.g * this.y0;
    if (discriminant < 0) return 0;

    return (this.vy0 + Math.sqrt(discriminant)) / this.g;
  }

  // Maximum height reached
  maxHeight(): number {
    const tMax = this.vy0 / this.g;
    if (tMax < 0) return this.y0;
    return this.position(tMax).y;
  }

  // Horizontal range
  range(): number {
    const tLand = this.flightTime();
    return this.position(tLand).x - this.x0;
  }

  // Generate trajectory points
  generatePath(numPoints: number = 50): Array<{ x: number; y: number }> {
    const tEnd = this.flightTime();
    const points: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * tEnd;
      points.push(this.position(t));
    }

    return points;
  }
}

// Renderer for calculus visualizations
export class CalculusRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // Draw coordinate axes
  drawAxes(originX: number, originY: number, scaleX: number, scaleY: number) {
    this.ctx.strokeStyle = "#444";
    this.ctx.lineWidth = 1;

    // X axis
    this.ctx.beginPath();
    this.ctx.moveTo(0, originY);
    this.ctx.lineTo(this.width, originY);
    this.ctx.stroke();

    // Y axis
    this.ctx.beginPath();
    this.ctx.moveTo(originX, 0);
    this.ctx.lineTo(originX, this.height);
    this.ctx.stroke();

    // Grid lines
    this.ctx.strokeStyle = "#222";
    this.ctx.setLineDash([2, 4]);

    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;

      // Vertical grid
      const x = originX + i * scaleX;
      if (x >= 0 && x <= this.width) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
      }

      // Horizontal grid
      const y = originY - i * scaleY;
      if (y >= 0 && y <= this.height) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
        this.ctx.stroke();
      }
    }

    this.ctx.setLineDash([]);
  }

  // Draw function curve
  drawFunction(
    f: (x: number) => number,
    originX: number,
    originY: number,
    scaleX: number,
    scaleY: number,
    color: string = "#00eaff",
    lineWidth: number = 2
  ) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();

    let first = true;
    for (let screenX = 0; screenX <= this.width; screenX += 2) {
      const worldX = (screenX - originX) / scaleX;
      const worldY = f(worldX);
      const screenY = originY - worldY * scaleY;

      if (first) {
        this.ctx.moveTo(screenX, screenY);
        first = false;
      } else {
        this.ctx.lineTo(screenX, screenY);
      }
    }

    this.ctx.stroke();
  }

  // Draw tangent line at point
  drawTangent(
    x: number,
    y: number,
    slope: number,
    originX: number,
    originY: number,
    scaleX: number,
    scaleY: number,
    length: number = 100
  ) {
    const screenX = originX + x * scaleX;
    const screenY = originY - y * scaleY;

    // Tangent line equation: y - y0 = m(x - x0)
    const x1 = x - length / scaleX;
    const y1 = y + slope * (x1 - x);
    const x2 = x + length / scaleX;
    const y2 = y + slope * (x2 - x);

    const screen1X = originX + x1 * scaleX;
    const screen1Y = originY - y1 * scaleY;
    const screen2X = originX + x2 * scaleX;
    const screen2Y = originY - y2 * scaleY;

    this.ctx.strokeStyle = "#ff6b6b";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(screen1X, screen1Y);
    this.ctx.lineTo(screen2X, screen2Y);
    this.ctx.stroke();

    // Draw point
    this.ctx.fillStyle = "#ff6b6b";
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Draw trajectory path
  drawTrajectory(points: Array<{ x: number; y: number }>, originX: number, originY: number, scaleX: number, scaleY: number, color: string = "#00ff88") {
    if (points.length === 0) return;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();

    const first = points[0]!;
    const screenX = originX + first.x * scaleX;
    const screenY = originY - first.y * scaleY;
    this.ctx.moveTo(screenX, screenY);

    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      const sx = originX + p.x * scaleX;
      const sy = originY - p.y * scaleY;
      this.ctx.lineTo(sx, sy);
    }

    this.ctx.stroke();
  }
}
