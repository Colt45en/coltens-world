/**
 * Session Manager: Manages user sessions
 * (Stub implementation - to be completed)
 */

import { createHash } from "node:crypto";

export interface SessionManagerState {
  sessionsById: Map<string, any>;
  nextSessionSequence: number;
}

export function initSessionManager(): SessionManagerState {
  return {
    sessionsById: new Map(),
    nextSessionSequence: 0,
  };
}

export function startSession(
  state: SessionManagerState,
  user_id: string,
  timestampMs: number,
  device_id?: string,
  client_version?: string
): any {
  const session_id = `sess:${user_id}:${state.nextSessionSequence}`;
  state.nextSessionSequence++;

  // Compute session hash canonically
  const sessionHash = createHash("sha256")
    .update(
      JSON.stringify(
        {
          user_id,
          device_id,
          client_version,
          timestamp_ms: timestampMs,
        },
        null,
        0
      )
    )
    .digest("hex");

  const session = {
    id: session_id,
    user_id,
    device_id,
    client_version,
    started_at_ms: timestampMs,
    session_hash: sessionHash,
  };

  state.sessionsById.set(session_id, session);
  return session;
}
