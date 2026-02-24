// Particle System - Procedural particle generation and animation
import { MathEngine } from "./core";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private maxParticles = 100
  ) {}

  spawn(count: number, config?: Partial<Particle>) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: config?.x ?? MathEngine.random.range(0, this.canvas.width),
        y: config?.y ?? MathEngine.random.range(0, this.canvas.height),
        vx: config?.vx ?? MathEngine.random.range(-2, 2),
        vy: config?.vy ?? MathEngine.random.range(-2, 2),
        size: config?.size ?? MathEngine.random.range(3, 10),
        color: config?.color ?? MathEngine.random.color(),
        rotation: config?.rotation ?? MathEngine.random.range(0, 360),
        rotationSpeed: config?.rotationSpeed ?? MathEngine.random.range(-5, 5),
        life: 1,
        maxLife: config?.maxLife ?? 1,
      });
    }

    // Limit total particles
    if (this.particles.length > this.maxParticles) {
      this.particles = this.particles.slice(-this.maxParticles);
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Update rotation
      p.rotation += p.rotationSpeed;

      // Apply gravity
      p.vy += 0.1;

      // Decay life
      p.life -= dt * 0.5;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }

      // Bounce off edges
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -0.8;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -0.8;

      // Clamp position
      p.x = MathEngine.lerp.clamp(p.x, 0, this.canvas.width);
      p.y = MathEngine.lerp.clamp(p.y, 0, this.canvas.height);
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.life;

      // Draw triangle
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(-p.size * 0.866, p.size * 0.5);
      ctx.lineTo(p.size * 0.866, p.size * 0.5);
      ctx.closePath();

      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }

  getCount() {
    return this.particles.length;
  }
}
