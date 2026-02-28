import type { ChatPresence, ChatPresenceSnapshot } from '../contracts/chat';
import { hashCanonical, hashPresence, stableSortBy } from './determinism';

/**
 * Chat Presence Tracker — Deterministic Presence State Management
 *
 * Tracks user presence (online/away/offline/dnd) per channel.
 * All operations produce deterministic snapshots.
 *
 * Key properties:
 * - Presence is ephemeral (reset between sessions)
 * - Snapshots are stable-sorted by (user_id, channel_id)
 * - Multiple presence changes in same batch maintain causal order
 */

export interface PresenceTrackerState {
  presences: Map<string, ChatPresence>;
  presencesByChannel: Map<string, Map<string, ChatPresence>>;
}

/**
 * Unique key for (user_id, channel_id) presence
 */
function presenceKey(userId: string, channelId: string): string {
  return `${userId}/${channelId}`;
}

/**
 * Initialize presence tracker
 */
export function initPresenceTracker(): PresenceTrackerState {
  return {
    presences: new Map(),
    presencesByChannel: new Map(),
  };
}

/**
 * Update user presence in a channel
 *
 * Creates or updates presence record with new status.
 * Returns updated presence object.
 */
export function updatePresence(
  tracker: PresenceTrackerState,
  userId: string,
  channelId: string,
  newStatus: 'online' | 'away' | 'offline' | 'dnd',
  timestampMs: number,
): ChatPresence {
  const key = presenceKey(userId, channelId);

  // Get previous presence (if exists)
  const previous = tracker.presences.get(key);

  // Create presence hash
  const presenceHash = hashPresence(userId, channelId, newStatus, timestampMs);
  const presenceId = `chat:pres:${presenceHash}`;

  // Build new presence object
  const presence: ChatPresence = {
    id: presenceId,
    user_id: userId,
    channel_id: channelId,
    status: newStatus,
    online_since_ms: newStatus === 'online' ? timestampMs : (previous?.online_since_ms ?? timestampMs),
    last_activity_ms: timestampMs,
    presence_hash: presenceHash,
  };

  // Store
  tracker.presences.set(key, presence);

  // Also store in per-channel map
  if (!tracker.presencesByChannel.has(channelId)) {
    tracker.presencesByChannel.set(channelId, new Map());
  }
  tracker.presencesByChannel.get(channelId)!.set(userId, presence);

  return presence;
}

/**
 * Batch update presence events
 *
 * All updates processed in order, maintaining causal relationships.
 */
export function updatePresenceBatch(
  tracker: PresenceTrackerState,
  updates: Array<{
    user_id: string;
    channel_id: string;
    status: 'online' | 'away' | 'offline' | 'dnd';
    timestamp_ms: number;
  }>,
): ChatPresence[] {
  return updates.map((update) =>
    updatePresence(tracker, update.user_id, update.channel_id, update.status, update.timestamp_ms),
  );
}

/**
 * Get presence for specific user in channel
 */
export function getPresence(
  tracker: PresenceTrackerState,
  userId: string,
  channelId: string,
): ChatPresence | undefined {
  return tracker.presences.get(presenceKey(userId, channelId));
}

/**
 * Get all online users in a channel
 */
export function getChannelOnlineUsers(
  tracker: PresenceTrackerState,
  channelId: string,
): ChatPresence[] {
  const channelPresences = tracker.presencesByChannel.get(channelId) ?? new Map();
  return Array.from(channelPresences.values()).filter((p) => p.status === 'online');
}

/**
 * Get all presence records (all channels)
 */
export function getAllPresences(tracker: PresenceTrackerState): ChatPresence[] {
  return Array.from(tracker.presences.values());
}

/**
 * Create deterministic presence snapshot
 *
 * Snapshot is stable-sorted by (user_id, channel_id) for determinism.
 * Snapshot ID is content-addressed via hash.
 */
export function createPresenceSnapshot(
  tracker: PresenceTrackerState,
  channelId?: string,
): ChatPresenceSnapshot {
  let presences: ChatPresence[];

  if (channelId) {
    // Channel-specific snapshot
    presences = Array.from(tracker.presencesByChannel.get(channelId)?.values() ?? []);
  } else {
    // Global snapshot of all presences
    presences = Array.from(tracker.presences.values());
  }

  // Stable sort by (user_id, channel_id)
  const sorted = stableSortBy(presences, ['user_id', 'channel_id']);

  // Compute snapshot hash
  const snapshotHash = hashCanonical({
    channel_id: channelId,
    presences: sorted,
  });

  const snapshotId = `chat:pres-snap:${snapshotHash}`;

  return {
    snapshot_id: snapshotId,
    presences: sorted,
    channel_id: channelId,
    presence_count: sorted.length,
    snapshot_hash: snapshotHash,
    snapshot_timestamp_ms: Date.now(),
  };
}

/**
 * Get online user count in channel
 */
export function getOnlineUserCount(
  tracker: PresenceTrackerState,
  channelId: string,
): number {
  return getChannelOnlineUsers(tracker, channelId).length;
}

/**
 * Mark all users in channel as offline
 *
 * Used for cleanup on server shutdown or channel closing.
 */
export function offlineAllUsersInChannel(
  tracker: PresenceTrackerState,
  channelId: string,
  timestampMs: number,
): ChatPresence[] {
  const channelUsers = tracker.presencesByChannel.get(channelId) ?? new Map();
  const updated: ChatPresence[] = [];

  for (const [userId] of channelUsers) {
    const presence = updatePresence(tracker, userId, channelId, 'offline', timestampMs);
    updated.push(presence);
  }

  return updated;
}

/**
 * Validate presence consistency
 *
 * Ensures online_since_ms is <= last_activity_ms and status coherence.
 */
export function validatePresenceConsistency(
  tracker: PresenceTrackerState,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const presence of tracker.presences.values()) {
    if (presence.online_since_ms > presence.last_activity_ms) {
      errors.push(
        `Presence ${presence.id}: online_since_ms (${presence.online_since_ms}) > last_activity_ms (${presence.last_activity_ms})`,
      );
    }

    if (presence.status === 'offline' && presence.online_since_ms > 0) {
      // Offline users should have online_since cleared (or indicate offline time)
      errors.push(`Presence ${presence.id}: offline user has online_since_ms = ${presence.online_since_ms}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
