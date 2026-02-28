import { z } from 'zod';

/**
 * Chat User — User Identity in Chat System
 *
 * Immutable once created. Presence state tracked separately.
 * Determinism: content-addressed ID, canonical JSON for hashing.
 */

export const ChatUserSchema = z.object({
  id: z.string().describe('Unique user ID (deterministic: content-addressed)'),
  username: z.string().min(1).max(64).describe('Display name'),
  avatar_url: z.string().url().optional().describe('Avatar image URL'),
  created_at_ms: z.number().int().nonnegative().describe('Account creation time'),
  user_hash: z.string().describe('SHA-256 of (id + username + created_at_ms)'),
});

export type ChatUser = z.infer<typeof ChatUserSchema>;

/**
 * User Snapshot — deterministic batch of user profiles
 *
 * Used for:
 * - User directory queries (stable ordering)
 * - Replay validation
 */
export const ChatUserSnapshotSchema = z.object({
  snapshot_id: z.string().describe('Content-addressed: chat:user-snap:<hash>'),
  users: ChatUserSchema.array().describe('Sorted by user_id ASC'),
  user_count: z.number().int().nonnegative(),
  snapshot_hash: z.string().describe('SHA-256 of canonical JSON'),
  snapshot_timestamp_ms: z.number().int().nonnegative(),
});

export type ChatUserSnapshot = z.infer<typeof ChatUserSnapshotSchema>;

/**
 * Chat Session — User Session Lifecycle
 *
 * Tracks when a user connects/disconnects from chat.
 * Multiple sessions per user allowed (multi-device).
 * Determinism: strictly increasing session_id, deterministic timestamps.
 */

export const ChatSessionSchema = z.object({
  id: z.string().describe('Unique session ID (content-addressed)'),
  user_id: z.string().describe('User who owns this session'),
  started_at_ms: z.number().int().nonnegative().describe('Session start time'),
  last_activity_at_ms: z.number().int().nonnegative().describe('Last heartbeat/message time'),
  ended_at_ms: z.number().int().nonnegative().optional().describe('Session end time (if closed)'),
  device_id: z.string().optional().describe('Device identifier (web, mobile, etc.)'),
  client_version: z.string().optional().describe('Client version info'),
  session_hash: z.string().describe('SHA-256 of session data'),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

/**
 * Session Lifecycle Event
 *
 * Emitted on connect/disconnect/timeout.
 */
export const ChatSessionEventSchema = z.object({
  session_id: z.string(),
  user_id: z.string(),
  event_type: z.enum(['started', 'heartbeat', 'ended', 'timeout']),
  event_timestamp_ms: z.number().int().nonnegative(),
  event_sequence: z.number().int().nonnegative().describe('Monotonic global seq#'),
});

export type ChatSessionEvent = z.infer<typeof ChatSessionEventSchema>;

/**
 * Session Snapshot — deterministic batch of active sessions
 *
 * Used for:
 * - Session recovery on server restart
 * - Replay of session lifecycle
 */
export const ChatSessionSnapshotSchema = z.object({
  snapshot_id: z.string().describe('Content-addressed: chat:sess-snap:<hash>'),
  sessions: ChatSessionSchema.array().describe('Sorted by session_id ASC'),
  session_count: z.number().int().nonnegative(),
  snapshot_hash: z.string().describe('SHA-256 of canonical JSON'),
  snapshot_timestamp_ms: z.number().int().nonnegative(),
});

export type ChatSessionSnapshot = z.infer<typeof ChatSessionSnapshotSchema>;
