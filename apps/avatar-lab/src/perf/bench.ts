export type FrameStats = {
  fps: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
};

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

export class RollingFrameBench {
  private readonly buffer: number[];
  private readonly capacity: number;
  private cursor = 0;
  private filled = false;

  private lastTick = performance.now();
  private lastFpsTick = performance.now();
  private frameCounter = 0;
  private fps = 0;

  constructor(capacity = 240) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(16.67);
  }

  tick(now = performance.now()): void {
    const delta = now - this.lastTick;
    this.lastTick = now;

    this.buffer[this.cursor] = delta;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.cursor === 0) this.filled = true;

    this.frameCounter += 1;
    if (now - this.lastFpsTick >= 500) {
      const seconds = (now - this.lastFpsTick) / 1000;
      this.fps = this.frameCounter / Math.max(0.001, seconds);
      this.lastFpsTick = now;
      this.frameCounter = 0;
    }
  }

  stats(): FrameStats {
    const length = this.filled ? this.capacity : this.cursor;
    const values = this.buffer.slice(0, Math.max(1, length));
    const sorted = values.slice().sort((a, b) => a - b);
    const avgMs = values.reduce((sum, v) => sum + v, 0) / values.length;

    return {
      fps: this.fps,
      avgMs,
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
    };
  }
}

export async function timeSection<T>(label: string, fn: () => Promise<T> | T): Promise<{ label: string; ms: number; out: T }> {
  const start = performance.now();
  const out = await fn();
  const end = performance.now();
  return { label, ms: end - start, out };
}
