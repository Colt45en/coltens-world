import { AlertCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// --- Vector Math ---
class Vec {
  x: number;
  y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v: Vec) {
    return new Vec(this.x + v.x, this.y + v.y);
  }
  sub(v: Vec) {
    return new Vec(this.x - v.x, this.y - v.y);
  }
  scale(s: number) {
    return new Vec(this.x * s, this.y * s);
  }
  dot(v: Vec) {
    return this.x * v.x + this.y * v.y;
  }
  mag() {
    return Math.hypot(this.x, this.y);
  }
  norm() {
    const m = this.mag();
    return m > 1e-8 ? this.scale(1 / m) : new Vec();
  }
  rotate(a: number) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return new Vec(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  clamp(max: number) {
    const m = this.mag();
    return m > max ? this.scale(max / m) : this;
  }
  static from(o: { x: number; y: number }) {
    return new Vec(o.x, o.y);
  }
}

// --- Segment & Arm System ---
class Segment {
  pos: Vec;
  len: number;
  constructor(pos: Vec, len: number) {
    this.pos = Vec.from({ x: pos.x, y: pos.y });
    this.len = len;
  }
}

interface ArmSystemOpts {
  hue?: number;
  angleLimit?: number;
  elasticity?: number;
  baseLen?: number;
}

class ArmSystem {
  anchor: Vec;
  segments: Segment[];
  hue: number;
  angleLimit: number;
  elasticity: number;
  trail: Array<{ x: number; y: number }>;
  trailMax: number;

  constructor(nSegments: number, anchor: Vec, opts: ArmSystemOpts = {}) {
    this.anchor = Vec.from({ x: anchor.x, y: anchor.y });
    this.segments = [];
    this.hue = opts.hue ?? Math.floor(Math.random() * 360);
    this.angleLimit = opts.angleLimit ?? Math.PI * 0.85;
    this.elasticity = opts.elasticity ?? 0.0;
    this.trail = [];
    this.trailMax = 90;
    const baseLen = opts.baseLen ?? 70;
    for (let i = 0; i < nSegments; i++) {
      this.segments.push(new Segment(this.anchor, baseLen * Math.pow(0.9, i)));
    }
  }

  repel(obstacles: Array<{ p: Vec; r: number }>) {
    for (const o of obstacles) {
      for (const s of this.segments) {
        const d = s.pos.sub(o.p);
        const m = d.mag();
        const r = o.r + 6;
        if (m < r && m > 1e-4) {
          s.pos = o.p.add(d.scale(r / m));
        }
      }
    }
  }

  _limit(prev: Vec, cur: Vec, next: Vec) {
    const v1 = prev.sub(cur).norm();
    const v2 = next.sub(cur).norm();
    let ang = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
    if (ang > this.angleLimit) {
      const excess = ang - this.angleLimit;
      const cross = v1.x * v2.y - v1.y * v2.x >= 0 ? 1 : -1;
      const rot = v2.rotate(-cross * excess * 0.5);
      const target = cur.add(rot.scale(next.sub(cur).mag()));
      return target;
    }
    return next;
  }

  reach(target: Vec, iterations: number = 10, obstacles: Array<{ p: Vec; r: number }> = []) {
    const segs = this.segments;
    if (segs.length === 0) return;

    for (let i = 1; i < segs.length; i++) {
      const p = segs[i - 1]!;
      const c = segs[i]!;
      c.pos = p.pos.add(new Vec(c.len, 0));
    }

    for (let it = 0; it < iterations; it++) {
      const lastSeg = segs[segs.length - 1]!;
      lastSeg.pos = Vec.from({ x: target.x, y: target.y });
      for (let i = segs.length - 2; i >= 0; i--) {
        const cur = segs[i]!;
        const nxt = segs[i + 1]!;
        let dir = cur.pos.sub(nxt.pos).norm();
        let L = cur.len * (1 + this.elasticity * 0.2);
        cur.pos = nxt.pos.add(dir.scale(L));
      }

      segs[0]!.pos = Vec.from({ x: this.anchor.x, y: this.anchor.y });
      for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1]!;
        const cur = segs[i]!;
        let dir = cur.pos.sub(prev.pos).norm();
        let L = prev.len * (1 + this.elasticity * 0.2);
        cur.pos = prev.pos.add(dir.scale(L));
        if (i < segs.length - 1) {
          const limited = this._limit(prev.pos, cur.pos, segs[i + 1]!.pos);
          segs[i + 1]!.pos = limited;
        }
      }

      this.repel(obstacles);
    }

    const ee = segs[segs.length - 1]!.pos;
    this.trail.push({ x: ee.x, y: ee.y });
    if (this.trail.length > this.trailMax) this.trail.shift();
  }

  draw(ctx: CanvasRenderingContext2D, showTrail: boolean = true) {
    if (showTrail && this.trail.length > 3) {
      ctx.beginPath();
      const firstPoint = this.trail[0];
      if (firstPoint) {
        ctx.moveTo(firstPoint.x, firstPoint.y);
      }
      for (const p of this.trail) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = `hsla(${this.hue}, 80%, 60%, 0.3)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.lineCap = "round";
    for (let i = 0; i < this.segments.length; i++) {
      const a = this.segments[i]!.pos;
      const b = i === 0 ? this.anchor : this.segments[i - 1]!.pos;
      ctx.strokeStyle = `hsl(${(this.hue + i * 18) % 360}, 75%, 58%)`;
      ctx.lineWidth = Math.max(2, 10 - i * 1.2);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.2)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function LabVectorPhysicsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1.0);
  const [gravity, setGravity] = useState(12);
  const [springK, setSpringK] = useState(16);
  const [fabrikIters, setFabrikIters] = useState(10);
  const [armCount, setArmCount] = useState(4);
  const [segCount, setSegCount] = useState(5);
  const [showTrail, setShowTrail] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const [fps, setFps] = useState(0);

  const stateRef = useRef({
    pos: new Vec(500, 288),
    vel: new Vec(0, 0),
    arms: [] as ArmSystem[],
    obstacles: [] as Array<{ p: Vec; r: number }>,
    dragging: false,
    dragOff: new Vec(),
    mouse: new Vec(500, 288),
    stepping: false,
    last: performance.now(),
  });

  const buildArms = (segCount: number, armCount: number) => {
    const state = stateRef.current;
    state.arms = [];
    const R = 64;
    for (let i = 0; i < armCount; i++) {
      const a = (i / armCount) * Math.PI * 2;
      const anch = new Vec(
        state.pos.x + Math.cos(a) * R,
        state.pos.y + Math.sin(a) * R
      );
      const arm = new ArmSystem(segCount, anch, {
        baseLen: 66,
        angleLimit: Math.PI * 0.85,
        elasticity: 0.05,
      });
      arm.hue = (180 + i * 40) % 360;
      state.arms.push(arm);
    }
  };

  const presetFloat = () => {
    setTimeScale(1.0);
    setGravity(6);
    setSpringK(10);
    setFabrikIters(8);
    setArmCount(3);
    setSegCount(5);
  };

  const presetWhip = () => {
    setTimeScale(1.4);
    setGravity(4);
    setSpringK(30);
    setFabrikIters(16);
    setArmCount(1);
    setSegCount(8);
  };

  const presetWalker = () => {
    setTimeScale(1.0);
    setGravity(20);
    setSpringK(18);
    setFabrikIters(12);
    setArmCount(4);
    setSegCount(4);
  };

  const reset = () => {
    stateRef.current.pos = new Vec(500, 288);
    stateRef.current.vel = new Vec(0, 0);
    stateRef.current.obstacles = [];
    buildArms(segCount, armCount);
  };

  useEffect(() => {
    buildArms(segCount, armCount);
  }, [segCount, armCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const state = stateRef.current;

    let fpsAcc = 0;
    let fpsTime = performance.now();

    const tick = (now: number) => {
      if (paused && !state.stepping) {
        requestAnimationFrame(tick);
        return;
      }

      const rawDt = (now - state.last) / 1000;
      const dt = rawDt * timeScale;
      state.last = now;

      fpsAcc++;
      if (now - fpsTime > 500) {
        setFps(Math.round((fpsAcc * 1000) / (now - fpsTime)));
        fpsAcc = 0;
        fpsTime = now;
      }

      state.vel = state.vel.add(new Vec(0, gravity * dt));
      if (!state.dragging) {
        const toMouse = state.mouse.sub(state.pos);
        state.vel = state.vel
          .add(toMouse.scale(springK * dt * 0.06))
          .clamp(180);
      }
      state.pos = state.pos.add(state.vel.scale(dt));

      const margin = 25;
      if (state.pos.x < margin) {
        state.pos.x = margin;
        state.vel.x *= -0.6;
      }
      if (state.pos.x > W - margin) {
        state.pos.x = W - margin;
        state.vel.x *= -0.6;
      }
      if (state.pos.y < margin) {
        state.pos.y = margin;
        state.vel.y *= -0.6;
      }
      if (state.pos.y > H - margin) {
        state.pos.y = H - margin;
        state.vel.y *= -0.6;
      }

      const R = 64;
      for (let i = 0; i < state.arms.length; i++) {
        const a = (i / state.arms.length) * Math.PI * 2;
        state.arms[i]!.anchor = new Vec(
          state.pos.x + Math.cos(a) * R,
          state.pos.y + Math.sin(a) * R
        );
      }

      const target = state.pos.add(state.vel.scale(0.02));
      for (const arm of state.arms) {
        arm.reach(target, fabrikIters, state.obstacles);
      }

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(148,163,184,.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      if (showObstacles) {
        for (const o of state.obstacles) {
          ctx.fillStyle = "rgba(248, 113, 113, .15)";
          ctx.strokeStyle = "rgba(248, 113, 113, .5)";
          ctx.beginPath();
          ctx.arc(o.p.x, o.p.y, o.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      for (const arm of state.arms) {
        arm.draw(ctx, showTrail);
      }

      state.stepping = false;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    // Event handlers
    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);
      const within =
        Math.abs(p.x - state.pos.x) < 34 && Math.abs(p.y - state.pos.y) < 34;
      if (within) {
        state.dragging = true;
        state.dragOff = p.sub(state.pos);
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);
      if (state.dragging) {
        state.pos = p.sub(state.dragOff);
        state.vel = new Vec(0, 0);
      }
      state.mouse = p;
    };

    const handlePointerUp = (e: PointerEvent) => {
      state.dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);
      if (e.altKey || e.metaKey) {
        let best = -1;
        let bd = 1e9;
        for (let i = 0; i < state.obstacles.length; i++) {
          const d = state.obstacles[i]!.p.sub(p).mag();
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) state.obstacles.splice(best, 1);
      } else {
        state.obstacles.push({ p, r: 18 + Math.random() * 22 });
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("click", handleClick);
    };
  }, [paused, timeScale, gravity, springK, fabrikIters, showTrail, showObstacles]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-black text-white">Vector Physics IK</h1>
            <p className="text-white/60 text-sm mt-1">
              Inverse Kinematics with constraints, trails, and obstacle avoidance
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-cyan-400">{fps}</div>
            <div className="text-xs text-white/50 uppercase">FPS</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Speed: {timeScale.toFixed(2)}×
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="4"
                  step="0.05"
                  value={timeScale}
                  onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                  className="w-full"
                  title="Speed multiplier"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Gravity: {gravity.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="0.1"
                  value={gravity}
                  onChange={(e) => setGravity(parseFloat(e.target.value))}
                  className="w-full"
                  title="Gravity strength"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Spring: {springK.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="0.1"
                  value={springK}
                  onChange={(e) => setSpringK(parseFloat(e.target.value))}
                  className="w-full"
                  title="Spring constant"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Fabrik Iterations: {fabrikIters}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={fabrikIters}
                  onChange={(e) => setFabrikIters(parseInt(e.target.value, 10))}
                  className="w-full"
                  title="FABRIK solver iterations"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Arms: {armCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={armCount}
                  onChange={(e) => setArmCount(parseInt(e.target.value, 10))}
                  className="w-full"
                  title="Number of arms"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  Segments: {segCount}
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={segCount}
                  onChange={(e) => setSegCount(parseInt(e.target.value, 10))}
                  className="w-full"
                  title="Segments per arm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPaused(!paused)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/20 transition-colors text-sm font-medium"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 transition-colors text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={presetFloat}
              className="px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg hover:border-white/20 text-xs font-medium"
            >
              Float
            </button>
            <button
              onClick={presetWhip}
              className="px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg hover:border-white/20 text-xs font-medium"
            >
              Whip
            </button>
            <button
              onClick={presetWalker}
              className="px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg hover:border-white/20 text-xs font-medium"
            >
              Walker
            </button>

            <label className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg cursor-pointer hover:border-white/20 text-xs font-medium">
              <input
                type="checkbox"
                checked={showTrail}
                onChange={(e) => setShowTrail(e.target.checked)}
                className="w-4 h-4"
              />
              Trails
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg cursor-pointer hover:border-white/20 text-xs font-medium">
              <input
                type="checkbox"
                checked={showObstacles}
                onChange={(e) => setShowObstacles(e.target.checked)}
                className="w-4 h-4"
              />
              Obstacles
            </label>
          </div>

          <div className="text-xs text-white/50 flex items-start gap-2 p-3 bg-slate-950/30 rounded-lg border border-white/5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Drag the core to move. Click to add obstacles, Alt+Click to remove. Presets
              demonstrate different configurations.
            </span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={1000}
        height={640}
        className="w-full rounded-2xl border border-white/10 bg-slate-950"
      />
    </div>
  );
}
