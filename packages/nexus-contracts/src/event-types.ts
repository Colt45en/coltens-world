export const NEXUS_EVENT_TYPES = {
  NUCLEUS_TICK: "nucleus.tick",
  NUCLEUS_BRAIN_RUN: "nucleus.brain_run",
  NUCLEUS_TOOL_CALL: "nucleus.tool_call",
  COGNITION_STATUS: "cognition.status",
  COGNITION_WORLD_DENIED: "cognition.world_denied",
  COGNITION_WORLD_FAILED: "cognition.world_failed",
  COGNITION_WORLD_SPAWNED: "cognition.world_spawned",
  COGNITION_TOOL_RESULT: "cognition.tool_result",
} as const;

export type NexusEventType = (typeof NEXUS_EVENT_TYPES)[keyof typeof NEXUS_EVENT_TYPES];
