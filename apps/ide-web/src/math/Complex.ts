/**
 * Complex Number System
 *
 * TypeScript port of the Python Complex class with full complex arithmetic,
 * polar conversions, and advanced complex analysis functions.
 *
 * MUTABILITY WARNING:
 * All methods mutate `this` and return `this` for fluent chaining.
 * Use operator-style methods (add, sub, mul, div) or pure_* variants for non-mutating ops.
 *
 * BRANCH CUTS:
 * log() and sqrt() use principal branches with cuts on negative real axis.
 */

export class Complex {
  real: number;
  imag: number;

  constructor(real: number = 0, imag: number = 0) {
    this.real = real;
    this.imag = imag;
  }

  // === Factory Methods ===

  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  static fromArray(arr: number[], offset: number = 0): Complex {
    return new Complex(arr[offset], arr[offset + 1]);
  }

  static zero(): Complex {
    return new Complex(0, 0);
  }

  static one(): Complex {
    return new Complex(1, 0);
  }

  static i(): Complex {
    return new Complex(0, 1);
  }

  // === Mutation Methods ===

  set(real: number, imag: number): Complex {
    this.real = real;
    this.imag = imag;
    return this;
  }

  clone(): Complex {
    return new Complex(this.real, this.imag);
  }

  copy(z: Complex): Complex {
    this.real = z.real;
    this.imag = z.imag;
    return this;
  }

  // === Basic Arithmetic ===

  add(z: Complex | number): Complex {
    if (typeof z === 'number') {
      this.real += z;
    } else {
      this.real += z.real;
      this.imag += z.imag;
    }
    return this;
  }

  sub(z: Complex | number): Complex {
    if (typeof z === 'number') {
      this.real -= z;
    } else {
      this.real -= z.real;
      this.imag -= z.imag;
    }
    return this;
  }

  multiply(z: Complex | number): Complex {
    if (typeof z === 'number') {
      this.real *= z;
      this.imag *= z;
    } else {
      const newReal = this.real * z.real - this.imag * z.imag;
      const newImag = this.real * z.imag + this.imag * z.real;
      this.real = newReal;
      this.imag = newImag;
    }
    return this;
  }

  divide(z: Complex | number): Complex {
    if (typeof z === 'number') {
      if (z === 0) throw new Error('Division by zero');
      this.real /= z;
      this.imag /= z;
    } else {
      const denom = z.real * z.real + z.imag * z.imag;
      if (denom === 0) throw new Error('Division by zero complex number');

      const newReal = (this.real * z.real + this.imag * z.imag) / denom;
      const newImag = (this.imag * z.real - this.real * z.imag) / denom;
      this.real = newReal;
      this.imag = newImag;
    }
    return this;
  }

  power(n: number | Complex): Complex {
    if (typeof n === 'number' && Number.isInteger(n)) {
      // Integer power using De Moivre's theorem
      if (n === 0) return this.set(1, 0);
      if (n === 1) return this;
      if (n < 0) return this.invert().power(-n);

      const r = this.magnitude();
      const theta = this.argument();

      const newR = Math.pow(r, n);
      const newTheta = n * theta;

      this.real = newR * Math.cos(newTheta);
      this.imag = newR * Math.sin(newTheta);
    } else {
      // General exponentiation: z^w = e^(w * ln(z))
      const lnZ = this.log();
      const expPart = lnZ.multiply(n);
      return this.copy(expPart.exp());
    }
    return this;
  }

  sqrt(): Complex {
    const r = this.magnitude();
    const theta = this.argument();

    const newR = Math.sqrt(r);
    const newTheta = theta / 2;

    this.real = newR * Math.cos(newTheta);
    this.imag = newR * Math.sin(newTheta);

    return this;
  }

  // === Properties ===

  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }

  magnitudeSquared(): number {
    return this.real * this.real + this.imag * this.imag;
  }

  argument(): number {
    return Math.atan2(this.imag, this.real);
  }

  conjugate(): Complex {
    this.imag = -this.imag;
    return this;
  }

  invert(): Complex {
    const magSq = this.magnitudeSquared();
    if (magSq === 0) throw new Error('Cannot invert zero');

    this.real /= magSq;
    this.imag = -this.imag / magSq;
    return this;
  }

  normalize(): Complex {
    const mag = this.magnitude();
    if (mag === 0) return this;

    this.real /= mag;
    this.imag /= mag;
    return this;
  }

  toPolar(): [number, number] {
    return [this.magnitude(), this.argument()];
  }

  fromPolar(r: number, theta: number): Complex {
    this.real = r * Math.cos(theta);
    this.imag = r * Math.sin(theta);
    return this;
  }

  // === Advanced Functions ===

  exp(): Complex {
    const expReal = Math.exp(this.real);
    this.real = expReal * Math.cos(this.imag);
    this.imag = expReal * Math.sin(this.imag);
    return this;
  }

  log(): Complex {
    if (this.magnitude() === 0) throw new Error('Cannot take log of zero');

    this.real = Math.log(this.magnitude());
    this.imag = this.argument();
    return this;
  }

  sin(): Complex {
    const sinhImag = Math.sinh(this.imag);
    const coshImag = Math.cosh(this.imag);
    const sinReal = Math.sin(this.real);
    const cosReal = Math.cos(this.real);

    this.real = sinReal * coshImag;
    this.imag = cosReal * sinhImag;
    return this;
  }

  cos(): Complex {
    const sinhImag = Math.sinh(this.imag);
    const coshImag = Math.cosh(this.imag);
    const sinReal = Math.sin(this.real);
    const cosReal = Math.cos(this.real);

    this.real = cosReal * coshImag;
    this.imag = -sinReal * sinhImag;
    return this;
  }

  tan(): Complex {
    const sinZ = this.clone().sin();
    const cosZ = this.clone().cos();
    return this.copy(sinZ.divide(cosZ));
  }

  sinh(): Complex {
    const expZ = this.clone().exp();
    const expNegZ = this.clone().multiply(-1).exp();
    return this.copy(expZ.sub(expNegZ).multiply(0.5));
  }

  cosh(): Complex {
    const expZ = this.clone().exp();
    const expNegZ = this.clone().multiply(-1).exp();
    return this.copy(expZ.add(expNegZ).multiply(0.5));
  }

  tanh(): Complex {
    const sinhZ = this.clone().sinh();
    const coshZ = this.clone().cosh();
    return this.copy(sinhZ.divide(coshZ));
  }

  // === Utility ===

  equals(z: Complex, tolerance: number = 1e-10): boolean {
    return (
      Math.abs(this.real - z.real) < tolerance &&
      Math.abs(this.imag - z.imag) < tolerance
    );
  }

  isReal(tolerance: number = 1e-10): boolean {
    return Math.abs(this.imag) < tolerance;
  }

  isImaginary(tolerance: number = 1e-10): boolean {
    return Math.abs(this.real) < tolerance;
  }

  isZero(tolerance: number = 1e-10): boolean {
    return this.magnitude() < tolerance;
  }

  // === Pure (Non-Mutating) Variants ===

  pureAdd(z: Complex | number): Complex {
    return this.clone().add(z);
  }

  pureSub(z: Complex | number): Complex {
    return this.clone().sub(z);
  }

  pureMultiply(z: Complex | number): Complex {
    return this.clone().multiply(z);
  }

  pureDivide(z: Complex | number): Complex {
    return this.clone().divide(z);
  }

  purePower(n: number | Complex): Complex {
    return this.clone().power(n);
  }

  pureSqrt(): Complex {
    return this.clone().sqrt();
  }

  pureConjugate(): Complex {
    return this.clone().conjugate();
  }

  pureInvert(): Complex {
    return this.clone().invert();
  }

  pureNormalize(): Complex {
    return this.clone().normalize();
  }

  pureExp(): Complex {
    return this.clone().exp();
  }

  pureLog(): Complex {
    return this.clone().log();
  }

  pureSin(): Complex {
    return this.clone().sin();
  }

  pureCos(): Complex {
    return this.clone().cos();
  }

  pureTan(): Complex {
    return this.clone().tan();
  }

  pureSinh(): Complex {
    return this.clone().sinh();
  }

  pureCosh(): Complex {
    return this.clone().cosh();
  }

  pureTanh(): Complex {
    return this.clone().tanh();
  }

  // === Serialization ===

  toArray(arr?: number[], offset: number = 0): number[] {
    if (!arr) arr = new Array(offset + 2);
    arr[offset] = this.real;
    arr[offset + 1] = this.imag;
    return arr;
  }

  toString(): string {
    if (Math.abs(this.imag) < 1e-10) {
      return this.real.toFixed(4);
    } else if (Math.abs(this.real) < 1e-10) {
      if (Math.abs(this.imag - 1) < 1e-10) return 'i';
      if (Math.abs(this.imag + 1) < 1e-10) return '-i';
      return `${this.imag.toFixed(4)}i`;
    } else {
      const sign = this.imag >= 0 ? '+' : '-';
      return `${this.real.toFixed(4)} ${sign} ${Math.abs(this.imag).toFixed(4)}i`;
    }
  }
}

// === Utility Functions ===

export class ComplexUtils {
  static rootsOfUnity(n: number): Complex[] {
    const roots: Complex[] = [];
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k) / n;
      roots.push(Complex.fromPolar(1, angle));
    }
    return roots;
  }

  static mandelbrotIteration(
    c: Complex,
    maxIter: number = 100,
    bailout: number = 4.0
  ): number {
    const z = Complex.zero();
    const bailoutSq = bailout * bailout;

    for (let i = 0; i < maxIter; i++) {
      if (z.magnitudeSquared() > bailoutSq) return i;
      z.power(2).add(c);
    }
    return maxIter;
  }

  static juliaIteration(
    z: Complex,
    c: Complex,
    maxIter: number = 100,
    bailout: number = 4.0
  ): number {
    const zCopy = z.clone();
    const bailoutSq = bailout * bailout;

    for (let i = 0; i < maxIter; i++) {
      if (zCopy.magnitudeSquared() > bailoutSq) return i;
      zCopy.power(2).add(c);
    }
    return maxIter;
  }

  /**
   * Domain coloring: map complex function output to color
   * Hue = argument (phase), Lightness = magnitude
   */
  static domainColor(z: Complex): [number, number, number] {
    const arg = z.argument();
    const mag = z.magnitude();

    // Hue from argument: [-π, π] → [0, 360]
    const hue = ((arg + Math.PI) / (2 * Math.PI)) * 360;

    // Lightness from magnitude (with saturation)
    const lightness = Math.min(1, mag / 2) * 100;

    return this.hslToRgb(hue, 80, lightness);
  }

  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
}

// Constants
export const I = Complex.i();
export const ONE = Complex.one();
export const ZERO = Complex.zero();
export const E = new Complex(Math.E, 0);
export const PI = new Complex(Math.PI, 0);
