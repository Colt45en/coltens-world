/**
 * Ring Renderer - Concentric pulse visualization
 */

import type { CanvasFit, FlowVizFrame } from "./types";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type RingParticle = {
  a: number;   // angle
  rJ: number;  // radius jitter
  sp: number;  // speed
  p: number;   // phase
};

export function makeRingParticles(count = 140): RingParticle[] {
  const out: RingParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      a: Math.random() * Math.PI * 2,
      rJ: Math.random(),
      sp: 0.004 + Math.random() * 0.01,
      p: Math.random(),
    });
  }
  return out;
}

export function drawRing(fit: CanvasFit, frame: FlowVizFrame, particles: RingParticle[]) {
  const { ctx, w, h } = fit;

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.46;

  ctx.clearRect(0, 0, w, h);

  // background halo
  ctx.save();
  ctx.globalAlpha = 0.9;
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.12);
  g.addColorStop(0, "rgba(100,255,218,0.10)");
  g.addColorStop(0.55, "rgba(52,152,219,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ring stroke
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(100,255,218,0.25)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const E = clamp(frame.energySmooth * frame.boost, 0, 1.6);
  const wobble = lerp(0.08, 0.22, clamp(frame.tension / 8, 0, 1));

  // spokes
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1;

  const spokes = 220;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const n =
      Math.sin(a * 3 + frame.t * 0.9) * 0.5 +
      Math.sin(a * 9 - frame.t * 1.3) * 0.25;
    const pulse = 0.5 + 0.5 * Math.sin(frame.t * 2.2 + a * 2);
    const amp = R * (0.02 + E * 0.1) * (1 + wobble * n);

    const inner = R - amp * (0.6 + 0.4 * pulse);
    const outer = R + amp * (0.25 + 0.75 * pulse);

    ctx.strokeStyle = `rgba(100,255,218,${0.12 + E * 0.28})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();

  // orbiting particles
  ctx.save();
  ctx.globalAlpha = 0.95;
  for (const p of particles) {
    p.a += p.sp * (0.8 + E * 2.0) * (0.6 + frame.tempoSmooth * 1.6);
    const jitter = (p.rJ - 0.5) * R * (0.05 + E * 0.08);
    const rr = R + jitter;
    const x = cx + Math.cos(p.a) * rr;
    const y = cy + Math.sin(p.a) * rr;

    const size = 1.2 + E * 2.4 + Math.sin(frame.t * 2 + p.p * 6) * 0.4;
    ctx.fillStyle = `rgba(230,241,255,${0.12 + E * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
