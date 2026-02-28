import type { ChatChannel, ChatChannelSnapshot } from '../contracts/chat';
import { hashCanonical, stableSort } from './determinism';

/**
 * Chat Channel Manager — Deterministic Channel Lifecycle
 *
 * Manages channel creation, membership, and state.
 * All operations produce deterministic snapshots.
 *
 * Key properties:
 * - Channels are immutable once created (except participant list)
 * - Participants are stable-sorted for determinism
 * - Snapshots are content-addressed
 */

export interface ChannelManagerState {
  channelsById: Map<string, ChatChannel>;
  channelsByName: Map<string, ChatChannel>;
}

/**
 * Initialize channel manager
 */
export function initChannelManager(): ChannelManagerState {
  return {
    channelsById: new Map(),
    channelsByName: new Map(),
  };
}

/**
 * Create a new channel
 *
 * Participants are deterministically ordered.
 */
export function createChannel(
  manager: ChannelManagerState,
  id: string,
  name: string,
  creatorId: string,
  topic?: string,
  isPrivate: boolean = false,
  initialParticipants?: string[],
): ChatChannel {
  // Combine creator + initial participants, dedupe, and sort
  const participantSet = new Set([creatorId, ...(initialParticipants ?? [])]);
  const participantIds = Array.from(participantSet).sort();

  // Create channel hash (content-addressed)
  const channelHash = hashCanonical({
    id,
    name,
    created_at_ms: Date.now(),
    creator_id: creatorId,
    topic,
    is_private: isPrivate,
    participant_ids: participantIds,
  });

  const channel: ChatChannel = {
    id,
    name,
    created_at_ms: Date.now(),
    creator_id: creatorId,
    topic,
    is_private: isPrivate,
    participant_ids: participantIds,
    channel_hash: channelHash,
  };

  manager.channelsById.set(id, channel);
  manager.channelsByName.set(name.toLowerCase(), channel);

  return channel;
}

/**
 * Get channel by ID
 */
export function getChannel(manager: ChannelManagerState, channelId: string): ChatChannel | undefined {
  return manager.channelsById.get(channelId);
}

/**
 * Get channel by name (case-insensitive)
 */
export function getChannelByName(manager: ChannelManagerState, name: string): ChatChannel | undefined {
  return manager.channelsByName.get(name.toLowerCase());
}

/**
 * Add user to channel
 *
 * Returns updated channel with new participant list (sorted).
 */
export function addUserToChannel(
  manager: ChannelManagerState,
  channelId: string,
  userId: string,
): ChatChannel | undefined {
  const channel = manager.channelsById.get(channelId);
  if (!channel) return undefined;

  // Check if already in channel
  if (channel.participant_ids.includes(userId)) {
    return channel;
  }

  // Add and re-sort
  const updated: ChatChannel = {
    ...channel,
    participant_ids: [...channel.participant_ids, userId].sort(),
  };

  // Recompute hash
  updated.channel_hash = hashCanonical({
    id: updated.id,
    name: updated.name,
    creator_id: updated.creator_id,
    topic: updated.topic,
    is_private: updated.is_private,
    participant_ids: updated.participant_ids,
  });

  manager.channelsById.set(channelId, updated);
  manager.channelsByName.set(updated.name.toLowerCase(), updated);

  return updated;
}

/**
 * Remove user from channel
 *
 * Returns updated channel with removed participant.
 */
export function removeUserFromChannel(
  manager: ChannelManagerState,
  channelId: string,
  userId: string,
): ChatChannel | undefined {
  const channel = manager.channelsById.get(channelId);
  if (!channel) return undefined;

  const filtered = channel.participant_ids.filter((id) => id !== userId);

  // Only update if change occurred
  if (filtered.length === channel.participant_ids.length) {
    return channel;
  }

  const updated: ChatChannel = {
    ...channel,
    participant_ids: filtered,
  };

  // Recompute hash
  updated.channel_hash = hashCanonical({
    id: updated.id,
    name: updated.name,
    creator_id: updated.creator_id,
    topic: updated.topic,
    is_private: updated.is_private,
    participant_ids: updated.participant_ids,
  });

  manager.channelsById.set(channelId, updated);
  manager.channelsByName.set(updated.name.toLowerCase(), updated);

  return updated;
}

/**
 * Check if user can access channel
 */
export function canUserAccessChannel(
  manager: ChannelManagerState,
  channelId: string,
  userId: string,
): boolean {
  const channel = manager.channelsById.get(channelId);
  if (!channel) return false;

  if (channel.is_private) {
    return channel.participant_ids.includes(userId);
  }
  return true; // Public channels are open to all
}

/**
 * Get all channels
 */
export function getAllChannels(manager: ChannelManagerState): ChatChannel[] {
  return Array.from(manager.channelsById.values());
}

/**
 * Get channels for a user (where user is participant)
 */
export function getUserChannels(manager: ChannelManagerState, userId: string): ChatChannel[] {
  const channels: ChatChannel[] = [];
  for (const channel of manager.channelsById.values()) {
    if (channel.participant_ids.includes(userId)) {
      channels.push(channel);
    }
  }
  return channels;
}

/**
 * Create deterministic channel snapshot
 *
 * All channels stable-sorted by channel_id.
 */
export function createChannelSnapshot(manager: ChannelManagerState): ChatChannelSnapshot {
  const channels = Array.from(manager.channelsById.values());
  const sorted = stableSort(channels, 'id');

  const snapshotHash = hashCanonical({
    channels: sorted,
  });

  const snapshotId = `chat:ch-snap:${snapshotHash}`;

  return {
    snapshot_id: snapshotId,
    channels: sorted,
    channel_count: sorted.length,
    snapshot_hash: snapshotHash,
    snapshot_timestamp_ms: Date.now(),
  };
}

/**
 * Count total channels
 */
export function getChannelCount(manager: ChannelManagerState): number {
  return manager.channelsById.size;
}

/**
 * Count members in channel
 */
export function getChannelMemberCount(manager: ChannelManagerState, channelId: string): number {
  const channel = manager.channelsById.get(channelId);
  return channel?.participant_ids.length ?? 0;
}

/**
 * Validate channel consistency
 */
export function validateChannelConsistency(
  manager: ChannelManagerState,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const channel of manager.channelsById.values()) {
    // Check participant IDs are sorted
    const sorted = [...channel.participant_ids].sort();
    if (JSON.stringify(channel.participant_ids) !== JSON.stringify(sorted)) {
      errors.push(`Channel ${channel.id}: participant_ids not sorted`);
    }

    // Check creator is in participants
    if (!channel.participant_ids.includes(channel.creator_id)) {
      errors.push(`Channel ${channel.id}: creator ${channel.creator_id} not in participants`);
    }

    // Check name-to-ID consistency
    const byName = manager.channelsByName.get(channel.name.toLowerCase());
    if (byName?.id !== channel.id) {
      errors.push(`Channel ${channel.id}: name lookup mismatch for "${channel.name}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}
