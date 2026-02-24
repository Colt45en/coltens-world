/**
 * Wheel Curriculum Runtime (TypeScript adapter for Nucleus)
 *
 * Simple wrapper that:
 * 1. Loads plan + state from JSON
 * 2. Routes nucleus.tool_call/result events through the bus
 * 3. Automatically advances wheel on user demand
 *
 * Usage typically embedded in Nucleus initialization:
 *
 *   const wheel = new WheelCurriculumBridge(planPath, statePath, bus);
 *   bus.subscribe_event('nucleus.tool_result', (evt) => wheel.onToolResult(evt));
 *   await wheel.tickWhenReady();  // emit next tool_call
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";

export interface V1Envelope<TPayload = any> {
  v: 1;
  kind: "event" | "command";
  name: string;
  id: string;
  ts: string;  // ISO datetime
  trace?: {
    wheel_id?: string;
    rotation?: number;
    stop_id?: string;
    call_id?: string;
  };
  payload: TPayload;
}

export interface WheelPlan {
  v: 1;
  wheel_id: string;
  title: string;
  total_rotations: number;
  stop_order: string[];
  stops: Record<string, { label: string; loop1_points: string[]; lesson_pool: string[] }>;
  agent_tool: { tool_name: string; expects: string };
  mutation_policy: {
    seed: number;
    max_pool_items_per_stop_per_rotation: number;
    no_repeat_within_last_rotations: number;
  };
  guardian_invariants: string[];
}

export interface WheelState {
  v: 1;
  wheel_id: string;
  rotation: number;
  stop_index: number;
  completed: Record<string, Record<string, boolean>>;
  recent_pool_picks: Record<string, Array<{ rotation: number; item: string }>>;
  active_call: null | { call_id: string; stop_id: string; rotation: number };
  history: Array<{
    rotation: number;
    stop_id: string;
    call_id: string;
    ok: boolean;
    summary?: string;
  }>;
}

export interface BusLike {
  /**
   * Emit an event envelope (nucleus-only).
   * Implementation matches your EventBus.emit_event_nucleus_only()
   */
  emit(env: any): Promise<void>;
}

/**
 * Deterministic RNG (mulberry32)
 */
function mulberry32(seed: number) {
  let a = (seed >>> 0) >>> 0;
  return () => {
    a |= 0;
    a = ((a + 0x6d2b79f5) | 0) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tiny stable hash for deterministic seeding
 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickPoolItems(plan: WheelPlan, state: WheelState, stop_id: string): string[] {
  const stop = plan.stops[stop_id];
  if (!stop) throw new Error(`Stop not found: ${stop_id}`);

  const { seed, max_pool_items_per_stop_per_rotation: maxN, no_repeat_within_last_rotations: noRepeatK } =
    plan.mutation_policy;

  const rng = mulberry32(seed ^ hashStr(`${plan.wheel_id}:${stop_id}:${state.rotation}`));

  const recent = state.recent_pool_picks[stop_id] ?? [];
  const blocked = new Set(
    recent.filter((x) => state.rotation - x.rotation <= noRepeatK).map((x) => x.item)
  );

  const candidates = stop.lesson_pool.filter((x) => !blocked.has(x));
  const source = candidates.length > 0 ? candidates : stop.lesson_pool.slice();

  // Fisher-Yates shuffle
  const arr = source.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i];
    const other = arr[j];
    if (temp !== undefined && other !== undefined) {
      arr[i] = other;
      arr[j] = temp;
    }
  }

  return arr.slice(0, Math.min(maxN, arr.length));
}

function compileStopPayload(plan: WheelPlan, state: WheelState, stop_id: string) {
  const stop = plan.stops[stop_id];
  if (!stop) throw new Error(`Stop not found: ${stop_id}`);

  const poolPicks = state.rotation === 1 ? [] : pickPoolItems(plan, state, stop_id);
  const points = state.rotation === 1 ? stop.loop1_points : poolPicks;

  const prompt = [
    `WHEEL: ${plan.title}`,
    `wheel_id=${plan.wheel_id}`,
    `rotation=${state.rotation}/${plan.total_rotations}`,
    `stop=${stop_id} :: ${stop.label}`,
    ``,
    `TEACHING POINTS (use these exactly as the lesson anchors):`,
    ...points.map((p) => `- ${p}`),
    ``,
    `REQUIRED OUTPUT (deterministic structure):`,
    `1) 3-sentence explanation`,
    `2) 3 examples`,
    `3) 3 quick checks (Q->A)`,
    `4) 1 common mistake + correction`,
    `5) tags[] (5-10 tokens)`,
  ].join("\n");

  return { points, prompt };
}

export class WheelCurriculumBridge {
  private plan: WheelPlan;
  private state: WheelState;
  private bus: BusLike;

  constructor(plan: WheelPlan, state: WheelState, bus: BusLike) {
    this.plan = plan;
    this.state = state;
    this.bus = bus;
  }

  /**
   * Emit next nucleus.tool_call if ready (no active call)
   */
  async tick(): Promise<void> {
    if (this.state.rotation > this.plan.total_rotations) {
      // Curriculum complete
      await this.bus.emit({
        v: 1,
        kind: "event",
        name: "brain.curriculum.completed",
        id: randomUUID(),
        ts: new Date().toISOString(),
        trace: { wheel_id: this.plan.wheel_id },
        payload: {
          wheel_id: this.plan.wheel_id,
          total_rotations: this.plan.total_rotations,
          history_length: this.state.history.length,
        },
      });
      return;
    }

    if (this.state.active_call) return;

    const stop_id = this.plan.stop_order[this.state.stop_index];
    if (!stop_id) throw new Error(`No stop at index ${this.state.stop_index}`);

    const key = String(this.state.rotation);
    if (!this.state.completed[key]) this.state.completed[key] = {};

    const already = this.state.completed[key][stop_id] === true;
    if (already) {
      this.advanceStop();
      return this.tick();
    }

    const call_id = randomUUID();
    this.state.active_call = { call_id, stop_id, rotation: this.state.rotation };

    const compiled = compileStopPayload(this.plan, this.state, stop_id);

    const toolArgs = {
      contract: this.plan.agent_tool.expects,
      wheel_id: this.plan.wheel_id,
      rotation: this.state.rotation,
      stop_id,
      stop_label: this.plan.stops[stop_id]!.label,
      teaching_points: compiled.points,
      prompt: compiled.prompt,
      guardian_invariants: this.plan.guardian_invariants,
    };

    await this.bus.emit({
      v: 1,
      kind: "event",
      name: "nucleus.tool_call",
      id: randomUUID(),
      ts: new Date().toISOString(),
      trace: { wheel_id: this.plan.wheel_id, rotation: this.state.rotation, stop_id, call_id },
      payload: {
        call_id,
        tool: this.plan.agent_tool.tool_name,
        args: toolArgs,
      },
    });
  }

  async onToolResult(envelope: any): Promise<void> {
    if (envelope.name !== "nucleus.tool_result" && envelope.event_type !== "nucleus.tool_result") return;

    const { call_id, ok, result } = envelope.payload ?? {};
    const active = this.state.active_call;

    if (!active || call_id !== active.call_id) return;

    // Mark complete
    const key = String(active.rotation);
    if (!this.state.completed[key]) this.state.completed[key] = {};
    this.state.completed[key][active.stop_id] = true;

    // Track picks for anti-repeat
    if (active.rotation >= 2) {
      const picks = pickPoolItems(this.plan, this.state, active.stop_id);
      const list = (this.state.recent_pool_picks[active.stop_id] ??= []);
      for (const item of picks) list.push({ rotation: active.rotation, item });
      while (list.length > 30) list.shift();
    }

    // Record history
    this.state.history.push({
      rotation: active.rotation,
      stop_id: active.stop_id,
      call_id: active.call_id,
      ok: Boolean(ok),
      summary: typeof result?.summary === "string" ? result.summary : undefined,
    });

    this.state.active_call = null;
    this.advanceStop();

    // Emit progress
    await this.bus.emit({
      v: 1,
      kind: "event",
      name: "brain.curriculum.progress",
      id: randomUUID(),
      ts: new Date().toISOString(),
      trace: { wheel_id: this.plan.wheel_id, rotation: this.state.rotation },
      payload: {
        wheel_id: this.plan.wheel_id,
        rotation: this.state.rotation,
        stop_index: this.state.stop_index,
      },
    });
  }

  private advanceStop(): void {
    this.state.stop_index++;
    if (this.state.stop_index >= this.plan.stop_order.length) {
      this.state.stop_index = 0;
      this.state.rotation++;
    }
  }

  getState(): WheelState {
    return this.state;
  }

  saveState(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  static loadPlan(filePath: string): WheelPlan {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  static loadState(filePath: string): WheelState {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
}
