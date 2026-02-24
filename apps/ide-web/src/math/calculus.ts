
/**
 * Calculus Engine (TypeScript) — Production Class Layout
 *
 * Numerical differentiation, integration (adaptive Simpson w/ caching),
 * gradients/Hessians, Jacobians, ODE solvers (RK4 + adaptive RK45),
 * root finding (Newton + Bisection + Brent), and extrema detection.
 *
 * Design goals:
 *  - Familiar "engine-style" layout: Calculus.*, SeriesExpansions.*
 *  - Scale-aware finite differences (automatic step sizing)
 *  - Robust adaptive integration (error-controlled Simpson w/ cached evals)
 *  - Vector support: gradient, Hessian, Jacobian
 *  - Production root solving (Brent hybrid method)
 *  - Adaptive ODE solvers (RK4 + RK45 with error control)
 *
 * Notes:
 *  - TS numbers are IEEE-754 doubles (like Python float).
 *  - Numerical derivatives are ill-conditioned near discontinuities/noise.
 */

export type ScalarFn = (x: number) => number;
export type VectorFn = (x: number[]) => number; // ℝⁿ → ℝ
export type VectorValuedFn = (x: number[]) => number[]; // ℝⁿ → ℝᵐ
export type Bounds = [number, number];

export interface AdaptiveSimpsonOptions {
  /** Absolute tolerance for error control. */
  absTol?: number;
  /** Relative tolerance for error control. */
  relTol?: number;
  /** Maximum refinement depth. */
  maxDepth?: number;
  /** Minimum refinement depth before early exit allowed. */
  minDepth?: number;
}

export interface RK45Options {
  /** Absolute tolerance for error control. */
  absTol?: number;
  /** Relative tolerance for error control. */
  relTol?: number;
  /** Initial step size (if omitted, auto-estimated). */
  initialH?: number;
  /** Minimum step size floor. */
  minH?: number;
  /** Maximum step size ceiling. */
  maxH?: number;
  /** Maximum steps before termination. */
  maxSteps?: number;
}

/** IEEE-754 double epsilon ~ 2.220446049250313e-16 */
const EPS = Number.EPSILON;

const TAU = 2 * Math.PI;

function isFiniteNumber(x: number): boolean {
  return Number.isFinite(x);
}

function requireFinite(...vals: number[]): void {
  for (const v of vals) {
    if (!isFiniteNumber(v)) throw new Error("Value must be finite.");
  }
}

function validateBounds(a: number, b: number): void {
  requireFinite(a, b);
}

/**
 * Default finite-difference step size (scale-aware).
 *
 * Heuristics:
 *  - First derivative:  h ~ eps^(1/3) * max(1, |x|)
 *  - Second derivative: h ~ eps^(1/4) * max(1, |x|)
 */
function defaultStep(x: number, order: 1 | 2 = 1): number {
  const scale = Math.max(1.0, Math.abs(x));
  if (order === 1) return Math.pow(EPS, 1 / 3) * scale;
  return Math.pow(EPS, 1 / 4) * scale;
}

/** Wrap angle into [-π, π). Safe for large +/- inputs. */
function wrapPi(x: number): number {
  let r = (x + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

/**
 * Simple Simpson on a single interval using (a, m, b).
 * If you have cached f(a), f(m), f(b), use simpsonCached.
 */
function simpsonSingle(f: ScalarFn, a: number, b: number): number {
  const m = 0.5 * (a + b);
  return ((b - a) / 6) * (f(a) + 4 * f(m) + f(b));
}

function simpsonCached(a: number, b: number, fa: number, fm: number, fb: number): number {
  return ((b - a) / 6) * (fa + 4 * fm + fb);
}

export class Calculus {
  /* ============================================================
   * Differentiation (Scalar)
   * ============================================================ */

  /**
   * Numerical first derivative via finite differences.
   *
   * Methods:
   *  - "forward"    : O(h)
   *  - "backward"   : O(h)
   *  - "central"    : O(h^2) (default)
   *  - "five_point" : O(h^4) (requires 4 function evals)
   */
  static derivative(
    f: ScalarFn,
    x: number,
    h?: number,
    method: "forward" | "backward" | "central" | "five_point" = "central"
  ): number {
    requireFinite(x);
    const step = h ?? defaultStep(x, 1);

    switch (method) {
      case "forward":
        return (f(x + step) - f(x)) / step;
      case "backward":
        return (f(x) - f(x - step)) / step;
      case "central":
        return (f(x + step) - f(x - step)) / (2 * step);
      case "five_point":
        return (
          (-f(x + 2 * step) + 8 * f(x + step) - 8 * f(x - step) + f(x - 2 * step)) /
          (12 * step)
        );
      default:
        throw new Error(`Unknown differentiation method: ${String(method)}`);
    }
  }

  /** Numerical second derivative via centered second difference: O(h^2). */
  static secondDerivative(f: ScalarFn, x: number, h?: number): number {
    requireFinite(x);
    const step = h ?? defaultStep(x, 2);
    return (f(x + step) - 2 * f(x) + f(x - step)) / (step * step);
  }

  /* ============================================================
   * Differentiation (Multivariate)
   * ============================================================ */

  /**
   * Partial derivative ∂f/∂x_i for f: ℝⁿ → ℝ using central differences (O(h^2)).
   */
  static partialDerivative(f: VectorFn, variables: number[], varIndex: number, h?: number): number {
    if (varIndex < 0 || varIndex >= variables.length) throw new Error("varIndex out of range.");
    const xi = variables[varIndex]!;
    const step = h ?? defaultStep(xi, 1) ?? 1e-6;

    const vp = variables.slice();
    const vm = variables.slice();
    vp[varIndex]! += step;
    vm[varIndex]! -= step;

    return (f(vp) - f(vm)) / (2 * step);
  }

  /**
   * Gradient ∇f for f: ℝⁿ → ℝ. Returns length-n vector.
   * Each component uses scale-aware step based on its coordinate magnitude.
   */
  static gradient(f: VectorFn, variables: number[], h?: number): number[] {
    return variables.map((xi, i) => Calculus.partialDerivative(f, variables, i, h ?? (defaultStep(xi, 1) ?? 1e-6)));
  }

  /**
   * Hessian matrix H for f: ℝⁿ → ℝ. Returns n×n.
   *
   * Diagonal: centered second difference.
   * Mixed: symmetric 4-point stencil:
   *   ∂²f/∂xi∂xj ≈ [f(x+hi ei + hj ej) - f(x+hi ei - hj ej) - f(x-hi ei + hj ej) + f(x-hi ei - hj ej)] / (4 hi hj)
   *
   * IMPORTANT FIX:
   * - Denominator is 4*hi*hj (NOT 4*h^2) when steps differ by scale.
   */
  static hessian(f: VectorFn, variables: number[], h?: number): number[][] {
    const n = variables.length;
    const base = f(variables);

    const H: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    // Diagonal terms
    for (let i = 0; i < n; i++) {
      const hi = h ?? (defaultStep(variables[i]!, 2) ?? 1e-6);
      const vp = variables.slice();
      const vm = variables.slice();
      vp[i]! += hi;
      vm[i]! -= hi;
      H[i]![i] = (f(vp) - 2 * base + f(vm)) / (hi * hi);
    }

    // Mixed partials (symmetric)
    for (let i = 0; i < n; i++) {
      const hi = h ?? (defaultStep(variables[i]!, 2) ?? 1e-6);
      for (let j = i + 1; j < n; j++) {
        const hj = h ?? (defaultStep(variables[j]!, 2) ?? 1e-6);

        const vpp = variables.slice();
        const vpm = variables.slice();
        const vmp = variables.slice();
        const vmm = variables.slice();

        vpp[i]! += hi; vpp[j]! += hj;
        vpm[i]! += hi; vpm[j]! -= hj;
        vmp[i]! -= hi; vmp[j]! += hj;
        vmm[i]! -= hi; vmm[j]! -= hj;

        const val = (f(vpp) - f(vpm) - f(vmp) + f(vmm)) / (4 * hi * hj);
        H[i]![j] = val;
        H[j]![i] = val;
      }
    }

    return H;
  }

  /**
   * Jacobian J for a vector-valued function F: ℝⁿ → ℝᵐ.
   * Returns m×n where J[r][c] = ∂F_r / ∂x_c.
   *
   * Central differences per input dimension (2 evaluations per column).
   */
  static jacobian(F: VectorValuedFn, variables: number[], h?: number): number[][] {
    const n = variables.length;
    const F0 = F(variables);
    const m = F0.length;

    const J: number[][] = Array.from({ length: m }, () => Array(n).fill(0));

    for (let c = 0; c < n; c++) {
      const step = h ?? (defaultStep(variables[c]!, 1) ?? 1e-6);

      const vp = variables.slice();
      const vm = variables.slice();
      vp[c]! += step;
      vm[c]! -= step;

      const Fp = F(vp);
      const Fm = F(vm);

      if (Fp.length !== m || Fm.length !== m) {
        throw new Error("Vector-valued function returned inconsistent dimension.");
      }

      for (let r = 0; r < m; r++) {
        J[r]![c] = (Fp[r]! - Fm[r]!) / (2 * step);
      }
    }

    return J;
  }

  /* ============================================================
   * Integration
   * ============================================================ */

  /** Composite trapezoid rule: O(h^2) for smooth f. */
  static integrateTrapezoid(f: ScalarFn, a: number, b: number, n = 2000): number {
    validateBounds(a, b);
    if (n <= 0) throw new Error("n must be positive.");
    if (a === b) return 0;

    const h = (b - a) / n;
    let s = 0.5 * (f(a) + f(b));
    for (let i = 1; i < n; i++) s += f(a + i * h);
    return s * h;
  }

  /** Composite Simpson's rule: O(h^4) for smooth f. Requires even n (auto-fixed). */
  static integrateSimpson(f: ScalarFn, a: number, b: number, n = 2000): number {
    validateBounds(a, b);
    if (n <= 0) throw new Error("n must be positive.");
    if (a === b) return 0;

    if (n % 2 !== 0) n += 1;
    const h = (b - a) / n;

    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      s += (i % 2 === 1 ? 4 : 2) * f(x);
    }
    return (s * h) / 3;
  }

  /**
   * Adaptive Simpson integration (error-controlled) — CACHED + ITERATIVE.
   *
   * Key mechanics:
   * - Start with Simpson on [a,b] using cached f(a), f(m), f(b)
   * - Split into [a,m] and [m,b]
   * - Error estimate: |S_left + S_right - S| / 15
   * - Return corrected: S2 + (S2 - S)/15 when accepted
   *
   * Caching improvement:
   * - Each subdivision computes only the NEW midpoints (quarter points),
   *   reusing previously computed f values.
   */
  static integrateAdaptiveSimpson(f: ScalarFn, a: number, b: number, opts: AdaptiveSimpsonOptions = {}): number {
    validateBounds(a, b);
    if (a === b) return 0;

    const absTol = opts.absTol ?? 1e-10;
    const relTol = opts.relTol ?? 1e-10;
    const maxDepth = opts.maxDepth ?? 30;
    const minDepth = opts.minDepth ?? 0;

    if (absTol <= 0 || relTol < 0) throw new Error("Invalid tolerances.");
    if (maxDepth < 0 || minDepth < 0 || minDepth > maxDepth) throw new Error("Invalid depth limits.");

    if (b < a) return -Calculus.integrateAdaptiveSimpson(f, b, a, opts);

    const fa = f(a);
    const fb = f(b);
    const m = 0.5 * (a + b);
    const fm = f(m);
    const S = simpsonCached(a, b, fa, fm, fb);

    type Item = {
      a: number;
      b: number;
      fa: number;
      fm: number;
      fb: number;
      S: number;
      depth: number;
    };

    const stack: Item[] = [{ a, b, fa, fm, fb, S, depth: 0 }];
    let total = 0.0;

    while (stack.length > 0) {
      const it = stack.pop()!;
      const a0 = it.a;
      const b0 = it.b;
      const fa0 = it.fa;
      const fm0 = it.fm;
      const fb0 = it.fb;
      const S0 = it.S;
      const depth = it.depth;

      const m0 = 0.5 * (a0 + b0);
      const lm = 0.5 * (a0 + m0);
      const rm = 0.5 * (m0 + b0);

      const flm = f(lm);
      const frm = f(rm);

      const Sleft = simpsonCached(a0, m0, fa0, flm, fm0);
      const Sright = simpsonCached(m0, b0, fm0, frm, fb0);
      const S2 = Sleft + Sright;

      const err = Math.abs(S2 - S0) / 15;
      const tol = Math.max(absTol, relTol * Math.abs(S2));

      const mustContinue = depth < minDepth;
      const withinError = err <= tol;

      if (!mustContinue && (withinError || depth >= maxDepth)) {
        total += S2 + (S2 - S0) / 15;
        continue;
      }

      stack.push({ a: m0, b: b0, fa: fm0, fm: frm, fb: fb0, S: Sright, depth: depth + 1 });
      stack.push({ a: a0, b: m0, fa: fa0, fm: flm, fb: fm0, S: Sleft, depth: depth + 1 });
    }

    return total;
  }

  /**
   * 5-point Gauss–Legendre quadrature on [a,b].
   * High accuracy for smooth integrands; not adaptive.
   */
  static integrateGaussLegendre5(f: ScalarFn, a: number, b: number): number {
    validateBounds(a, b);
    if (a === b) return 0;
    if (b < a) return -Calculus.integrateGaussLegendre5(f, b, a);

    const nodes = [
      0.0,
      0.5384693101056831,
      -0.5384693101056831,
      0.9061798459386640,
      -0.9061798459386640,
    ];
    const weights = [
      0.5688888888888889,
      0.4786286704993665,
      0.4786286704993665,
      0.2369268850561891,
      0.2369268850561891,
    ];

    const mid = 0.5 * (a + b);
    const half = 0.5 * (b - a);

    let acc = 0.0;
    for (let i = 0; i < nodes.length; i++) {
      acc += weights[i]! * f(mid + half * nodes[i]!);
    }
    return half * acc;
  }

  /* ============================================================
   * ODE Solvers
   * ============================================================ */

  /** Euler method for dy/dx = f(x,y). */
  static solveOdeEuler(
    f: (x: number, y: number) => number,
    y0: number,
    xSpan: Bounds,
    nSteps = 1000
  ): { x: number[]; y: number[] } {
    const [x0, x1] = xSpan;
    validateBounds(x0, x1);
    if (nSteps <= 0) throw new Error("nSteps must be positive.");

    const h = (x1 - x0) / nSteps;
    const xs: number[] = [x0];
    const ys: number[] = [y0];

    let x = x0;
    let y = y0;
    for (let i = 0; i < nSteps; i++) {
      y = y + h * f(x, y);
      x = x + h;
      xs.push(x);
      ys.push(y);
    }
    return { x: xs, y: ys };
  }

  /** Classic RK4 for dy/dx = f(x,y). */
  static solveOdeRK4(
    f: (x: number, y: number) => number,
    y0: number,
    xSpan: Bounds,
    nSteps = 1000
  ): { x: number[]; y: number[] } {
    const [x0, x1] = xSpan;
    validateBounds(x0, x1);
    if (nSteps <= 0) throw new Error("nSteps must be positive.");

    const h = (x1 - x0) / nSteps;
    const xs: number[] = [x0];
    const ys: number[] = [y0];

    let x = x0;
    let y = y0;
    for (let i = 0; i < nSteps; i++) {
      const k1 = h * f(x, y);
      const k2 = h * f(x + 0.5 * h, y + 0.5 * k1);
      const k3 = h * f(x + 0.5 * h, y + 0.5 * k2);
      const k4 = h * f(x + h, y + k3);
      y = y + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
      x = x + h;
      xs.push(x);
      ys.push(y);
    }
    return { x: xs, y: ys };
  }

  /**
   * Adaptive RK45 (Dormand–Prince) for dy/dx = f(x,y).
   *
   * Error-controlled step sizing: halves on error, doubles if well-behaved.
   * Returns all accepted steps (not uniform grid).
   */
  static solveOdeRK45(
    f: (x: number, y: number) => number,
    y0: number,
    xSpan: Bounds,
    opts: RK45Options = {}
  ): { x: number[]; y: number[] } {
    const [x0, x1] = xSpan;
    validateBounds(x0, x1);

    const absTol = opts.absTol ?? 1e-8;
    const relTol = opts.relTol ?? 1e-8;
    let h = opts.initialH ?? Math.abs(x1 - x0) / 100;
    const minH = opts.minH ?? 1e-14;
    const maxH = opts.maxH ?? Math.abs(x1 - x0) / 10;
    const maxSteps = opts.maxSteps ?? 100000;

    if (absTol <= 0 || relTol < 0) throw new Error("Invalid tolerances.");
    if (x0 === x1) return { x: [x0], y: [y0] };

    const sign = x1 > x0 ? 1 : -1;
    const absH = Math.min(Math.abs(h), maxH);
    h = sign * absH;

    const xs: number[] = [x0];
    const ys: number[] = [y0];

    let x = x0;
    let y = y0;
    let steps = 0;

    while ((x1 - x) * sign > 0 && steps < maxSteps) {
      steps++;

      // Ensure we don't overshoot
      if ((x + h - x1) * sign > 0) {
        h = x1 - x;
      }

      // 5-stage Dormand-Prince (RK5 + RK4 for error estimate)
      const k1 = f(x, y);
      const k2 = f(x + 0.2 * h, y + 0.2 * h * k1);
      const k3 = f(x + 0.3 * h, y + 0.075 * h * k1 + 0.225 * h * k2);
      const k4 = f(x + 0.8 * h, y + (13440 * h * k1 - 106760 * h * k2 + 96690 * h * k3) / 11648);
      const k5 = f(
        x + h,
        y +
          ((35 * h * k1 + 500 * h * k3 + 1104 * h * k4) / 1113 -
            (140 * h * k2) / 1113)
      );

      const y5 = y + (h * (35 * k1 + 500 * k3 + 1104 * k4)) / 1113 - (h * (140 * k2)) / 1113;
      const y4 = y + (h * (6 * k1 + 375 * k3 + 552 * k4 + 35 * k5)) / 614;

      // Error estimate
      const err = Math.abs(y5 - y4);
      const scale = Math.max(Math.abs(y), Math.abs(y5));
      const tol = Math.max(absTol, relTol * scale);

      if (err <= tol) {
        // Step accepted
        x = x + h;
        y = y5;
        xs.push(x);
        ys.push(y);

        // Adaptive step growth (conservative)
        const factor = Math.pow(tol / (err + 1e-16), 0.2);
        h = h * Math.min(2.0, Math.max(0.5, 0.95 * factor));
      } else {
        // Step rejected
        h = h * Math.max(0.1, 0.95 * Math.pow(tol / (err + 1e-16), 0.25));
      }

      h = sign * Math.min(Math.abs(h), maxH);
      if (Math.abs(h) < minH) throw new Error("Step size underflow; ODE may be stiff.");
    }

    if (steps >= maxSteps) throw new Error("RK45 exceeded max step count.");
    return { x: xs, y: ys };
  }

  /* ============================================================
   * Root Finding
   * ============================================================ */

  /**
   * Newton root solve. If fPrime omitted, derivative is estimated numerically.
   */
  static rootNewton(
    f: ScalarFn,
    x0: number,
    opts: { fPrime?: ScalarFn; tol?: number; maxIter?: number } = {}
  ): number {
    const tol = opts.tol ?? 1e-10;
    const maxIter = opts.maxIter ?? 100;
    if (tol <= 0) throw new Error("tol must be positive.");
    if (maxIter <= 0) throw new Error("maxIter must be positive.");

    let x = x0;
    for (let i = 0; i < maxIter; i++) {
      const fx = f(x);
      if (Math.abs(fx) <= tol) return x;

      const dfx = opts.fPrime ? opts.fPrime(x) : Calculus.derivative(f, x, undefined, "central");
      if (Math.abs(dfx) < 1e-15) throw new Error("Derivative too small; Newton step unstable.");

      x = x - fx / dfx;
    }
    throw new Error("Newton method did not converge.");
  }

  /**
   * Bisection root solve. Requires a bracket where f(a) and f(b) have opposite signs.
   */
  static rootBisection(
    f: ScalarFn,
    a: number,
    b: number,
    opts: { tol?: number; maxIter?: number } = {}
  ): number {
    const tol = opts.tol ?? 1e-10;
    const maxIter = opts.maxIter ?? 200;
    if (tol <= 0) throw new Error("tol must be positive.");
    if (maxIter <= 0) throw new Error("maxIter must be positive.");

    let fa = f(a);
    let fb = f(b);
    if (fa === 0) return a;
    if (fb === 0) return b;
    if (fa * fb > 0) throw new Error("f(a) and f(b) must have opposite signs.");

    let lo = a, hi = b, flo = fa;
    for (let i = 0; i < maxIter; i++) {
      const mid = 0.5 * (lo + hi);
      const fmid = f(mid);

      if (Math.abs(fmid) <= tol || Math.abs(hi - lo) <= tol) return mid;

      if (flo * fmid < 0) {
        hi = mid;
      } else {
        lo = mid;
        flo = fmid;
      }
    }
    throw new Error("Bisection did not converge.");
  }

  /**
   * Brent root solve (production-grade hybrid).
   *
   * Combines bisection (robust), secant (fast), and inverse parabolic interpolation.
   * Automatically switches methods based on progress.
   *
   * Requires a bracket where f(a) and f(b) have opposite signs.
   * Faster than bisection alone, more robust than Newton for ill-conditioned roots.
   */
  static rootBrent(
    f: ScalarFn,
    a: number,
    b: number,
    opts: { tol?: number; maxIter?: number } = {}
  ): number {
    const tol = opts.tol ?? 1e-10;
    const maxIter = opts.maxIter ?? 200;
    if (tol <= 0) throw new Error("tol must be positive.");
    if (maxIter <= 0) throw new Error("maxIter must be positive.");

    let fa = f(a);
    let fb = f(b);

    if (fa === 0) return a;
    if (fb === 0) return b;
    if (fa * fb > 0) throw new Error("f(a) and f(b) must have opposite signs.");

    // Ensure |f(a)| <= |f(b)|
    if (Math.abs(fa) > Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }

    let c = a;
    let fc = fa;
    let d = b - a; // delta for secant
    let e = d; // step before last

    for (let i = 0; i < maxIter; i++) {
      if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
        c = a;
        fc = fa;
        d = b - a;
        e = d;
      }

      if (Math.abs(fc) < Math.abs(fb)) {
        [a, b] = [b, c];
        [fa, fb] = [fb, fc];
        [c, fc] = [a, fa];
      }

      const tol1 = 2 * EPS * Math.abs(b) + 0.5 * tol;
      const m = 0.5 * (c - b);

      if (Math.abs(m) <= tol1 || Math.abs(fb) <= tol) return b;

      // Try inverse parabolic interpolation
      let p = 0, q = 0;
      if (Math.abs(e) > tol1 && Math.abs(fa) > Math.abs(fb)) {
        const r = fb / fa;
        if (a === c) {
          // 2-point formula (secant)
          p = 2 * m * r;
          q = 1 - r;
        } else {
          // 3-point formula (inverse parabola)
          const sq = fb / fc;
          const t = fa / fc;
          p = sq * (2 * m * t * (t - r) - (b - a) * (r - 1));
          q = (t - 1) * (r - 1) * (sq - 1);
        }
        if (p > 0) q = -q;
        else p = -p;

        const s = Math.abs(3 * m * q - Math.abs(tol1 * q));
        if (2 * p < s) {
          e = d;
          d = p / q;
        } else {
          d = m;
          e = m;
        }
      } else {
        d = m;
        e = m;
      }

      a = b;
      fa = fb;
      if (Math.abs(d) > tol1) {
        b = b + d;
      } else {
        b = b + (m > 0 ? tol1 : -tol1);
      }

      fb = f(b);
    }

    throw new Error("Brent root solver did not converge.");
  }

  /* ============================================================
   * Extrema (grid-based)
   * ============================================================ */

  /**
   * Finds local minima/maxima by sampling a grid in [a,b].
   * Coarse detector (misses between-sample extrema).
   */
  static findExtremaGrid(
    f: ScalarFn,
    a: number,
    b: number,
    nSamples = 2000
  ): { minima: Array<[number, number]>; maxima: Array<[number, number]> } {
    validateBounds(a, b);
    if (nSamples <= 2) throw new Error("nSamples must be > 2.");
    if (a === b) {
      const v = f(a);
      return { minima: [[a, v]], maxima: [[a, v]] };
    }
    if (b < a) return Calculus.findExtremaGrid(f, b, a, nSamples);

    const h = (b - a) / nSamples;
    const minima: Array<[number, number]> = [];
    const maxima: Array<[number, number]> = [];

    for (let i = 1; i < nSamples; i++) {
      const x = a + i * h;
      const fx = f(x);
      const fl = f(x - h);
      const fr = f(x + h);

      if (fx < fl && fx < fr) minima.push([x, fx]);
      else if (fx > fl && fx > fr) maxima.push([x, fx]);
    }

    return { minima, maxima };
  }
}

export class SeriesExpansions {
  /** e^x via incremental term recurrence. */
  static expSeries(x: number, nTerms = 30): number {
    let term = 1.0;
    let s = 1.0;
    for (let n = 1; n < nTerms; n++) {
      term *= x / n;
      s += term;
    }
    return s;
  }

  /** sin(x) via incremental term recurrence. */
  static sinSeries(x: number, nTerms = 30): number {
    x = wrapPi(x);
    let term = x;
    let s = x;
    for (let n = 1; n < nTerms; n++) {
      term *= (-x * x) / ((2 * n) * (2 * n + 1));
      s += term;
    }
    return s;
  }

  /** cos(x) via incremental term recurrence. */
  static cosSeries(x: number, nTerms = 30): number {
    x = wrapPi(x);
    let term = 1.0;
    let s = 1.0;
    for (let n = 1; n < nTerms; n++) {
      term *= (-x * x) / ((2 * n - 1) * (2 * n));
      s += term;
    }
    return s;
  }

  /**
   * ln(1+x) series. Converges for -1 < x <= 1.
   */
  static ln1pSeries(x: number, nTerms = 80): number {
    if (x <= -1 || x > 1) throw new Error("ln1p series converges only for -1 < x <= 1");
    let term = x;
    let s = 0.0;
    for (let n = 1; n <= nTerms; n++) {
      s += term / n;
      term *= -x;
    }
    return s;
  }
}

/* ============================================================
 * Optional Unified Dispatcher API
 * ============================================================ */
type OpMap = Record<string, (...args: any[]) => any>;

const OPS: OpMap = {
  // derivatives
  derivative: Calculus.derivative,
  d1: Calculus.derivative,
  secondDerivative: Calculus.secondDerivative,
  d2: Calculus.secondDerivative,
  partialDerivative: Calculus.partialDerivative,
  gradient: Calculus.gradient,
  hessian: Calculus.hessian,

  // jacobian
  jacobian: Calculus.jacobian,

  // integration
  trapz: Calculus.integrateTrapezoid,
  simpson: Calculus.integrateSimpson,
  adaptiveSimpson: Calculus.integrateAdaptiveSimpson,
  gauss5: Calculus.integrateGaussLegendre5,

  // ODEs
  odeEuler: Calculus.solveOdeEuler,
  odeRK4: Calculus.solveOdeRK4,
  odeRK45: Calculus.solveOdeRK45,

  // roots
  rootNewton: Calculus.rootNewton,
  rootBisection: Calculus.rootBisection,
  rootBrent: Calculus.rootBrent,

  // extrema
  extremaGrid: Calculus.findExtremaGrid,

  // series
  expSeries: SeriesExpansions.expSeries,
  sinSeries: SeriesExpansions.sinSeries,
  cosSeries: SeriesExpansions.cosSeries,
  ln1pSeries: SeriesExpansions.ln1pSeries,
};

/**
 * Universal calculus dispatcher.
 *
 * Examples:
 *  calc("d1", Math.sin, 1.0)
 *  calc("adaptiveSimpson", Math.sin, 0, Math.PI, { absTol: 1e-12 })
 *  calc("jacobian", F, [1,2,3])
 *  calc("rootBrent", f, 0, 2, { tol: 1e-10 })
 *  calc("odeRK45", dydt, 1.0, [0, 10], { absTol: 1e-8 })
 */
export function calc(op: string, ...args: any[]): any {
  const key = op.trim();
  const fn = OPS[key];
  if (!fn) {
    throw new Error(
      `Unknown op="${op}". Available ops:\n${Object.keys(OPS)
        .sort()
        .join(", ")}`
    );
  }
  return fn(...args);
}

export default calc;
