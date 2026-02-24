/**
 * Capability Registry: Maps message types to required capabilities
 *
 * Server is source of truth. Client-provided caps are ignored.
 * Session is granted caps during handshake based on role.
 */

export type Capability =
  | "cap:files:read"
  | "cap:files:write"
  | "cap:pty:open"
  | "cap:pty:write"
  | "cap:pty:resize"
  | "cap:preview:stats"
  | "cap:preview:ping"
  | "cap:sim:start"
  | "cap:sim:stop"
  | "cap:sim:status"
  | "cap:uee:invoke"
  | "cap:uee:brain_train"
  | "cap:uee:brain_control";

/**
 * Maps message type → required capabilities
 * If key not in registry: reject as unknown message type
 */
export const CapabilityRegistry: Record<string, Capability[]> = {
  // Handshake (no caps required; always allowed)
  "system.hello": [],

  // File watch (IDE only)
  "files.changed": ["cap:files:read"],

  // PTY (IDE only)
  "pty.open": ["cap:pty:open"],
  "pty.resize": ["cap:pty:write"],
  "pty.input": ["cap:pty:write"],

  // Preview
  "preview.ping": ["cap:preview:ping"],
  "preview.stats": ["cap:preview:stats"],

  // Simulation control (IDE only)
  "ops.sim.start": ["cap:sim:start"],
  "ops.sim.stop": ["cap:sim:stop"],
  "ops.sim.status": ["cap:sim:status"],

  // UEE task dispatch
  uee: ["cap:uee:invoke"],
};

/**
 * Default capability sets by role
 * Server assigns these during system.hello handshake
 */
export const RoleCapabilities: Record<string, Capability[]> = {
  ide: [
    "cap:files:read",
    "cap:pty:open",
    "cap:pty:write",
    "cap:pty:resize",
    "cap:preview:stats",
    "cap:preview:ping",
    "cap:sim:start",
    "cap:sim:stop",
    "cap:sim:status",
    "cap:uee:invoke",
    "cap:uee:brain_train",
    "cap:uee:brain_control"
  ],
  preview: [
    "cap:preview:ping",
    "cap:preview:stats"
  ],
  nucleus: [] // Internal; uses direct calls
};

/**
 * Check if a capability set includes a required capability
 */
export function hasCapability(granted: Capability[], required: Capability): boolean {
  return granted.includes(required);
}

/**
 * Check if all required capabilities are granted
 */
export function hasCapabilities(
  granted: Capability[],
  required: Capability[]
): boolean {
  return required.every(cap => granted.includes(cap));
}
