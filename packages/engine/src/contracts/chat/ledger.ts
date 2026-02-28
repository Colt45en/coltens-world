import { z } from 'zod';

/**
 * Chat Ledger Events — Deterministic Audit Trail
 *
 * Every chat operation (send, presence change, membership, session) emits a ledger event.
 * Events are immutable, sequenced, and replayed for determinism validation.
 *
 * All events include deterministic_context for cross-replica validation.
 */

/**
 * Message Sent Event
 *
 * Ledger: chat:message:sent.v1
 * Emitted when chat.send.v1 is called.
 */
export const ChatMessageSentEventSchema = z.object({
  event_id: z.string().describe('Unique event ID'),
  event_type: z.literal('chat:message:sent.v1'),
  message_id: z.string(),
  channel_id: z.string(),
  sender_id: z.string(),
  text: z.string(),
  sequence: z.number().int().nonnegative(),
  message_hash: z.string(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
    input_hash: z.string().describe('SHA-256 of message content'),
    output_hash: z.string().describe('SHA-256 of persisted message'),
  }),
});

export type ChatMessageSentEvent = z.infer<typeof ChatMessageSentEventSchema>;

/**
 * Message Delivered Event
 *
 * Ledger: chat:message:delivered.v1
 * Emitted when a replica acknowledges receipt.
 */
export const ChatMessageDeliveredEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('chat:message:delivered.v1'),
  message_id: z.string(),
  channel_id: z.string(),
  receiver_user_id: z.string().optional().describe('For read receipts'),
  receipt_timestamp_ms: z.number().int().nonnegative(),
  receipt_hash: z.string(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
    replica_id: z.string().optional(),
  }),
});

export type ChatMessageDeliveredEvent = z.infer<typeof ChatMessageDeliveredEventSchema>;

/**
 * Presence Changed Event
 *
 * Ledger: chat:presence:changed.v1
 * Emitted when user presence state changes.
 */
export const ChatPresenceChangedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('chat:presence:changed.v1'),
  user_id: z.string(),
  channel_id: z.string(),
  old_status: z.enum(['online', 'away', 'offline', 'dnd']).optional(),
  new_status: z.enum(['online', 'away', 'offline', 'dnd']),
  changed_at_ms: z.number().int().nonnegative(),
  presence_hash: z.string(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
    causal_clock: z.record(z.string(), z.number()).optional(),
  }),
});

export type ChatPresenceChangedEvent = z.infer<typeof ChatPresenceChangedEventSchema>;

/**
 * Session Started Event
 *
 * Ledger: chat:session:started.v1
 * Emitted when user connects.
 */
export const ChatSessionStartedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('chat:session:started.v1'),
  session_id: z.string(),
  user_id: z.string(),
  started_at_ms: z.number().int().nonnegative(),
  device_id: z.string().optional(),
  client_version: z.string().optional(),
  session_hash: z.string(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
  }),
});

export type ChatSessionStartedEvent = z.infer<typeof ChatSessionStartedEventSchema>;

/**
 * Session Ended Event
 *
 * Ledger: chat:session:ended.v1
 * Emitted when user disconnects or times out.
 */
export const ChatSessionEndedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('chat:session:ended.v1'),
  session_id: z.string(),
  user_id: z.string(),
  ended_at_ms: z.number().int().nonnegative(),
  end_reason: z.enum(['disconnect', 'timeout', 'logout', 'server_shutdown']),
  session_hash: z.string(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
  }),
});

export type ChatSessionEndedEvent = z.infer<typeof ChatSessionEndedEventSchema>;

/**
 * Membership Changed Event
 *
 * Ledger: chat:membership:changed.v1
 * Emitted when user joins/leaves/is invited to channel.
 */
export const ChatMembershipChangedEventSchema = z.object({
  event_id: z.string(),
  event_type: z.literal('chat:membership:changed.v1'),
  channel_id: z.string(),
  user_id: z.string(),
  action: z.enum(['joined', 'left', 'invited', 'removed']),
  triggered_by_user_id: z.string().optional(),
  membership_sequence: z.number().int().nonnegative(),
  event_timestamp_ms: z.number().int().nonnegative(),
  deterministic_context: z.object({
    engine_version: z.string(),
    tool_id: z.string(),
  }),
});

export type ChatMembershipChangedEvent = z.infer<typeof ChatMembershipChangedEventSchema>;
