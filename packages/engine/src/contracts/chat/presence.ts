import { z } from 'zod';

/**
 * Chat Presence — User Presence State in Channel
 *
 * Tracks online/away/offline status per user per channel.
 * Determinism: stable sort by (user_id, channel_id), deterministic timestamps.
 *
 * Presence is ephemeral but must be deterministically replayable.
 */

export const ChatPresenceSchema = z.object({
  id: z.string().describe('Unique presence ID: chat:pres:<hash>'),
  user_id: z.string(),
  channel_id: z.string(),
  status: z.enum(['online', 'away', 'offline', 'dnd']).describe('Do Not Disturb'),
  online_since_ms: z.number().int().nonnegative().describe('When user came online'),
  last_activity_ms: z.number().int().nonnegative().describe('Last message/heartbeat'),
  presence_hash: z.string().describe('SHA-256 of (user_id + channel_id + status + online_since)'),
});

export type ChatPresence = z.infer<typeof ChatPresenceSchema>;

/**
 * Presence Change Event
 *
 * Emitted when user presence changes (online → away, away → offline, etc.).
 * Determinism: monotonic event_sequence, deterministic ordering.
 */

export const ChatPresenceEventSchema = z.object({
  presence_id: z.string(),
  user_id: z.string(),
  channel_id: z.string(),
  old_status: z.enum(['online', 'away', 'offline', 'dnd']).optional(),
  new_status: z.enum(['online', 'away', 'offline', 'dnd']),
  changed_at_ms: z.number().int().nonnegative(),
  event_sequence: z.number().int().nonnegative().describe('Monotonic seq# per channel'),
  triggered_by_heartbeat: z.boolean().optional().describe('Timeout-based change?'),
});

export type ChatPresenceEvent = z.infer<typeof ChatPresenceEventSchema>;

/**
 * Presence Snapshot — deterministic batch of presence state
 *
 * Used for:
 * - User list with online indicators (who is where)
 * - Replay validation (presence consistency)
 * - Stable-sorted by (user_id, channel_id)
 */

export const ChatPresenceSnapshotSchema = z.object({
  snapshot_id: z.string().describe('Content-addressed: chat:pres-snap:<hash>'),
  presences: ChatPresenceSchema.array().describe('Sorted by (user_id, channel_id)'),
  channel_id: z.string().optional().describe('If channel-specific snapshot'),
  presence_count: z.number().int().nonnegative(),
  snapshot_hash: z.string().describe('SHA-256 of canonical JSON'),
  snapshot_timestamp_ms: z.number().int().nonnegative(),
});

export type ChatPresenceSnapshot = z.infer<typeof ChatPresenceSnapshotSchema>;

/**
 * Presence Query Filter
 *
 * For deterministic presence lookups (who is online in this channel right now).
 */

export const ChatPresenceQuerySchema = z.object({
  channel_id: z.string().optional().describe('If omitted, query all channels for user'),
  user_id: z.string().optional().describe('If omitted, query all users in channel'),
  status_filter: z.enum(['online', 'away', 'offline', 'dnd']).optional(),
});

export type ChatPresenceQuery = z.infer<typeof ChatPresenceQuerySchema>;
