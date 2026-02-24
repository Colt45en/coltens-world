import type { AxisCodexLabels } from "./types";

export const AXIS_CODEX_V1: AxisCodexLabels = {
  x: "emergence",
  y: "decision",
  z: "time_memory",
};

export const AXIS_LABELS_UI: Record<keyof AxisCodexLabels, string> = {
  x: "X / Emergence",
  y: "Y / Decision",
  z: "Z / Time-Memory",
};
