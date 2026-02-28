/**
 * Presence Tracker: Tracks active users in channels
 * (Stub implementation - to be completed)
 */

import { createHash } from "node:crypto";

export interface PresenceTrackerState {
  presences: Map<string, any>;
}

export function initPresenceTracker(): PresenceTrackerState {
  return {
    presences: new Map(),
  };
}

export function updatePresence(
  state: PresenceTrackerState,
  user_id: string,
  channel_id: string,
  status: "online" | "away" | "offline" | "dnd",
  timestampMs: number
): any {
  const presence_id = `pres:${user_id}:${channel_id}`;

  // Compute presence hash canonically
  const presenceHash = createHash("sha256")
    .update(
      JSON.stringify(
        {
          user_id,
          channel_id,
          status,
          timestamp_ms: timestampMs,
        },
        null,
        0
      )
    )
    .digest("hex");

  const presence = {
    id: presence_id,
    user_id,
    channel_id,
    status,
    timestamp_ms: timestampMs,
    presence_hash: presenceHash,
  };

  state.presences.set(presence_id, presence);
  return presence;
}

export function createPresenceSnapshot(state: PresenceTrackerState, channel_id: string): any {
  const channelPresences = Array.from(state.presences.values()).filter(
    (p) => p.channel_id === channel_id
  );
  return {
    channel_id,
    presences: channelPresences,
  };
}
