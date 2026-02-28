import { z } from 'zod';

/**
 * Chat Channel — Deterministic Channel Registry
 *
 * Channels are immutable once created (except for participant list).
 * Channel membership affects message visibility.
 * Determinism: content-addressed ID, stable participant ordering.
 */

export const ChatChannelSchema = z.object({
  id: z.string().describe('Unique channel ID (deterministic: content-addressed)'),
  name: z.string().min(1).max(128).describe('Channel display name'),
  created_at_ms: z.number().int().nonnegative().describe('Creation timestamp'),
  creator_id: z.string().describe('User who created channel'),
  topic: z.string().max(512).optional().describe('Channel topic/description'),
  is_private: z.boolean().default(false).describe('Private channels require invite'),
  participant_ids: z.string().array().describe('Stable-sorted list of active participants'),
  channel_hash: z.string().describe('SHA-256 of canonical JSON'),
});

export type ChatChannel = z.infer<typeof ChatChannelSchema>;

/**
 * Channel Create Request
 *
 * Input for chat.create_channel tool (future extension).
 */
export const ChatChannelCreateRequestSchema = z.object({
  name: z.string().min(1).max(128),
  creator_id: z.string(),
  topic: z.string().max(512).optional(),
  is_private: z.boolean().default(false),
  initial_participants: z.string().array().optional().describe('Invite these users'),
});

export type ChatChannelCreateRequest = z.infer<typeof ChatChannelCreateRequestSchema>;

/**
 * Channel Membership Event
 *
 * Tracks participant additions/removals with deterministic ordering.
 */
export const ChatChannelMembershipEventSchema = z.object({
  channel_id: z.string(),
  user_id: z.string(),
  event_type: z.enum(['joined', 'left', 'invited', 'removed']),
  triggered_by_user_id: z.string().optional().describe('User who triggered event'),
  event_timestamp_ms: z.number().int().nonnegative(),
  event_sequence: z.number().int().nonnegative().describe('Monotonic seq# per channel'),
});

export type ChatChannelMembershipEvent = z.infer<typeof ChatChannelMembershipEventSchema>;

/**
 * Channel Snapshot — deterministic batch of channel state
 *
 * Used for:
 * - Channel list queries (stable ordering by channel_id)
 * - Replay validation (hash verification)
 - Membership audits
 */
export const ChatChannelSnapshotSchema = z.object({
  snapshot_id: z.string().describe('Content-addressed: chat:ch-snap:<hash>'),
  channels: ChatChannelSchema.array().describe('Sorted by channel_id ASC'),
  channel_count: z.number().int().nonnegative(),
  snapshot_hash: z.string().describe('SHA-256 of canonical JSON'),
  snapshot_timestamp_ms: z.number().int().nonnegative(),
});

export type ChatChannelSnapshot = z.infer<typeof ChatChannelSnapshotSchema>;
