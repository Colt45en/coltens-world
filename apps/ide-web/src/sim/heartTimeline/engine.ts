import { AXIS_CODEX_V1 } from "./axisCodex";
import { createInitialHeartState, stepHeart } from "./heart";
import type { SimulationExportV1, TimelineConfig, TimelineSnapshot, TimelineTickRecord, VectorObject } from "./types";

function round6(n: number): number {
  return Number(n.toFixed(6));
}

function cloneVec3(v: [number, number, number]): [number, number, number] {
  return [round6(v[0]), round6(v[1]), round6(v[2])];
}

function cloneObject(o: VectorObject): VectorObject {
  return {
    id: o.id,
    position: cloneVec3(o.position),
    velocity: cloneVec3(o.velocity),
    axis_bias: cloneVec3(o.axis_bias),
    energy: round6(o.energy),
    active: o.active,
    tags: [...o.tags],
  };
}

function sortedObjects(objs: VectorObject[]): VectorObject[] {
  return [...objs].sort((a, b) => a.id.localeCompare(b.id));
}

function stepObject(obj: VectorObject, dt: number, heartMomentum: number): VectorObject {
  if (!obj.active) return cloneObject(obj);
  const driftGain = round6(0.05 * obj.energy * heartMomentum);
  const velocity: [number, number, number] = [
    round6(obj.velocity[0] + obj.axis_bias[0] * driftGain * dt),
    round6(obj.velocity[1] + obj.axis_bias[1] * driftGain * dt),
    round6(obj.velocity[2] + obj.axis_bias[2] * driftGain * dt),
  ];
  const position: [number, number, number] = [
    round6(obj.position[0] + velocity[0] * dt),
    round6(obj.position[1] + velocity[1] * dt),
    round6(obj.position[2] + velocity[2] * dt),
  ];
  const energy = round6(Math.max(0, obj.energy - 0.0025 * dt));
  return { ...obj, position, velocity, energy, active: energy > 0.000001 };
}

export function runTimelineSimulation(config: TimelineConfig, generatedBy: "ts" | "cpp" = "ts"): SimulationExportV1 {
  const objects = sortedObjects(config.initial_objects).map(cloneObject);
  const tick_log: TimelineTickRecord[] = [];
  const snapshots: TimelineSnapshot[] = [];
  let heart = createInitialHeartState(config.heart);

  for (let tick = 0; tick < config.tick_count; tick++) {
    heart = stepHeart(config.heart, heart, config.dt_seconds, tick);
    const capacity_budget = Math.max(0, Math.round(config.base_capacity * heart.capacity_scale));
    let processed_objects = 0;
    let deferred_objects = 0;

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj || !obj.active) continue;
      if (processed_objects < capacity_budget) {
        objects[i] = stepObject(obj, config.dt_seconds, heart.momentum);
        processed_objects++;
      } else {
        deferred_objects++;
      }
    }

    const sim_time_seconds = round6((tick + 1) * config.dt_seconds);
    tick_log.push({
      tick,
      sim_time_seconds,
      heart: { ...heart },
      capacity_budget,
      processed_objects,
      deferred_objects,
    });

    if (tick % config.snapshot_every_ticks === 0 || tick === config.tick_count - 1) {
      snapshots.push({
        tick,
        sim_time_seconds,
        heart: { ...heart },
        objects: sortedObjects(objects).map(cloneObject),
      });
    }
  }

  return {
    schema: "axis-codex-sim/v1",
    metadata: {
      engine_name: "heart-timeline-engine",
      engine_version: "0.1.0",
      generated_by: generatedBy,
      generated_at_unix_ms: Date.now(),
      deterministic_seed: config.seed,
    },
    config: {
      ...config,
      axis_codex: AXIS_CODEX_V1,
      initial_objects: sortedObjects(config.initial_objects).map(cloneObject),
    },
    tick_log,
    snapshots,
  };
}
