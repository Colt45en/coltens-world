// Math Engine Core - Centralized mathematical utilities for World Engine
// All systems can access these functions for consistent math operations

export class MathEngine {
  // Trigonometry utilities
  static trig = {
    degToRad(deg: number): number {
      return deg * (Math.PI / 180);
    },

    radToDeg(rad: number): number {
      return rad * (180 / Math.PI);
    },

    // Unit circle point at angle (degrees)
    unitCirclePoint(angleDeg: number): { x: number; y: number } {
      const rad = this.degToRad(angleDeg);
      return {
        x: Math.cos(rad),
        y: Math.sin(rad),
      };
    },

    // Get all trig values at once
    allValues(angleDeg: number) {
      const rad = this.degToRad(angleDeg);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const tan = Math.abs(cos) < 0.0001 ? Infinity : sin / cos;

      return { cos, sin, tan, rad, deg: angleDeg };
    },

    // Quadrant (1-4) for angle
    quadrant(angleDeg: number): number {
      const normalized = ((angleDeg % 360) + 360) % 360;
      if (normalized < 90) return 1;
      if (normalized < 180) return 2;
      if (normalized < 270) return 3;
      return 4;
    },
  };

  // Vector math
  static vector = {
    add(a: [number, number], b: [number, number]): [number, number] {
      return [a[0] + b[0], a[1] + b[1]];
    },

    sub(a: [number, number], b: [number, number]): [number, number] {
      return [a[0] - b[0], a[1] - b[1]];
    },

    scale(v: [number, number], s: number): [number, number] {
      return [v[0] * s, v[1] * s];
    },

    magnitude(v: [number, number]): number {
      return Math.hypot(v[0], v[1]);
    },

    normalize(v: [number, number]): [number, number] {
      const mag = this.magnitude(v);
      return mag === 0 ? [0, 0] : [v[0] / mag, v[1] / mag];
    },

    dot(a: [number, number], b: [number, number]): number {
      return a[0] * b[0] + a[1] * b[1];
    },

    angle(v: [number, number]): number {
      return Math.atan2(v[1], v[0]);
    },
  };

  // Random utilities
  static random = {
    range(min: number, max: number): number {
      return Math.random() * (max - min) + min;
    },

    int(min: number, max: number): number {
      return Math.floor(this.range(min, max + 1));
    },

    color(): string {
      return `hsl(${this.range(0, 360)}, 70%, 60%)`;
    },

    bool(probability = 0.5): boolean {
      return Math.random() < probability;
    },
  };

  // Interpolation
  static lerp = {
    linear(a: number, b: number, t: number): number {
      return a + (b - a) * t;
    },

    clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    },

    smoothstep(t: number): number {
      t = this.clamp(t, 0, 1);
      return t * t * (3 - 2 * t);
    },
  };

  // Physics utilities
  static physics = {
    // Friction force magnitude
    friction(normal: number, coefficient: number): number {
      return normal * coefficient;
    },

    // Gravity component along slope
    gravityComponent(mass: number, gravity: number, angleDeg: number): number {
      const rad = MathEngine.trig.degToRad(angleDeg);
      return mass * gravity * Math.sin(rad);
    },

    // Normal force on slope
    normalForce(mass: number, gravity: number, angleDeg: number): number {
      const rad = MathEngine.trig.degToRad(angleDeg);
      return mass * gravity * Math.cos(rad);
    },

    // Drag force (quadratic)
    dragForce(velocity: number, coefficient: number): number {
      return -coefficient * Math.abs(velocity) * velocity;
    },
  };
}

// Export for global access
export default MathEngine;
