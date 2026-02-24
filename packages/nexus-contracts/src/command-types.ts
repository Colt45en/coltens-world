export const NEXUS_COMMAND_TYPES = {
  COGNITION_REQUEST_EMIT: "cognition.request_emit",
  NUCLEUS_TOOL_CALL: "nucleus.tool_call",
} as const;

export type NexusCommandType = (typeof NEXUS_COMMAND_TYPES)[keyof typeof NEXUS_COMMAND_TYPES];
