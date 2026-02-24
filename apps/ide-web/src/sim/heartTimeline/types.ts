export type AxisCodexLabels = {
  x: "emergence";
  y: "decision";
  z: "time_memory";
};

export type Vec3 = [number, number, number];

export type HeartConfig = {
  base_resonance: number;
  pulse_amplitude: number;
  pulse_frequency_hz: number;
  damping: number;
  min_capacity_scale: number;
  max_capacity_scale: number;
  resonance_to_capacity_gain: number;
};

export type HeartState = {
  resonance: number;
  capacity_scale: number;
  momentum: number;
  pulse_count: number;
};

export type VectorObject = {
  id: string;
  position: Vec3;
  velocity: Vec3;
  axis_bias: Vec3;
  energy: number;
  active: boolean;
  tags: string[];
};

export type TimelineConfig = {
  tick_count: number;
  dt_seconds: number;
  snapshot_every_ticks: number;
  base_capacity: number;
  seed: number;
  axis_codex: AxisCodexLabels;
  heart: HeartConfig;
  initial_objects: VectorObject[];
};

export type TimelineTickRecord = {
  tick: number;
  sim_time_seconds: number;
  heart: HeartState;
  capacity_budget: number;
  processed_objects: number;
  deferred_objects: number;
};

export type TimelineSnapshot = {
  tick: number;
  sim_time_seconds: number;
  heart: HeartState;
  objects: VectorObject[];
};

export type SimulationExportV1 = {
  schema: "axis-codex-sim/v1";
  metadata: {
    engine_name: "heart-timeline-engine";
    engine_version: "0.1.0";
    generated_by: "cpp" | "ts";
    generated_at_unix_ms: number;
    deterministic_seed: number;
  };
  config: TimelineConfig;
  tick_log: TimelineTickRecord[];
  snapshots: TimelineSnapshot[];
};
