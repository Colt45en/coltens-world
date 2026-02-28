import { z } from 'zod';

/**
 * Chat Message — Deterministic, Causally-Ordered
 *
 * Key determinism properties:
 * - sequence: monotonically increasing per channel (causal ordering)
 * - hash: SHA-256 of (sender_id, channel_id, text, sequence, timestamp_ms)
 * - timestamp_ms: assigned by server at ingestion (deterministic)
 * - causal_clock: vector clock for cross-channel causality
 *
 * Replaying messages in sequence order produces identical channel state.
 */

export const ChatMessageSchema = z.object({
  id: z.string().describe('Unique message ID (deterministic: content-addressed hash)'),
  channel_id: z.string().describe('ID of channel this message belongs to'),
  sender_id: z.string().describe('User ID of sender'),
  text: z.string().min(1).max(4096).describe('Message text content'),
  sequence: z.number().int().nonnegative().describe('Monotonic seq# per channel (causal ordering)'),
  timestamp_ms: z.number().int().nonnegative().describe('Server-assigned ingestion time (ms)'),
  message_hash: z.string().describe('SHA-256(sender_id + channel_id + text + sequence + timestamp_ms)'),
  causal_clock: z.record(z.string(), z.number()).describe('Vector clock: { user_id → seq# }'),
  edited_at_ms: z.number().int().nonnegative().optional().describe('Timestamp if edited'),
  edit_hash: z.string().optional().describe('SHA-256 of edit (None if never edited)'),
  deleted: z.boolean().default(false).describe('Soft-deletion flag'),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Batch Message Input — for deterministic ingestion/replay
 *
 * Used by chat.send.v1 and for bulk message replay operations.
 */
export const BatchChatMessageInputSchema = z.object({
  messages: ChatMessageSchema.array(),
  channel_id: z.string(),
  ingestion_timestamp_ms: z.number().int().nonnegative(),
});

export type BatchChatMessageInput = z.infer<typeof BatchChatMessageInputSchema>;

/**
 * Message Receipt/Acknowledgment
 *
 * Confirms message was ingested and replicated.
 * Hash used for determinism validation across replicas.
 */
export const ChatMessageReceiptSchema = z.object({
  message_id: z.string(),
  channel_id: z.string(),
  receipt_timestamp_ms: z.number().int().nonnegative(),
  receiver_user_id: z.string().optional().describe('For user-targeted receipts (read-receipt)'),
  receipt_hash: z.string().describe('SHA-256 of message + receipt data for verification'),
});

export type ChatMessageReceipt = z.infer<typeof ChatMessageReceiptSchema>;

/**
 * Message Snapshot — deterministic batch of messages at a point in time
 *
 * Used for:
 * - Cursor-based pagination (deterministic slicing)
 * - Replay snapshots (content-addressed, hash-verified)
 * - Channel state validation
 */
export const ChatMessageSnapshotSchema = z.object({
  snapshot_id: z.string().describe('Content-addressed ID: chat:msg-snap:<hash>'),
  channel_id: z.string(),
  messages: ChatMessageSchema.array().describe('Ordered by sequence ASC'),
  start_sequence: z.number().int().nonnegative(),
  end_sequence: z.number().int().nonnegative(),
  message_count: z.number().int().nonnegative(),
  snapshot_hash: z.string().describe('SHA-256 of canonical JSON (sorted messages)'),
  snapshot_timestamp_ms: z.number().int().nonnegative(),
});

export type ChatMessageSnapshot = z.infer<typeof ChatMessageSnapshotSchema>;

/**
 * Message Query Filter — for deterministic history retrieval
 *
 * Used by chat.history.v1 to fetch messages with stable ordering.
 */
export const ChatMessageQuerySchema = z.object({
  channel_id: z.string(),
  start_sequence: z.number().int().nonnegative().optional().describe('Inclusive'),
  end_sequence: z.number().int().nonnegative().optional().describe('Exclusive'),
  limit: z.number().int().positive().default(50),
  include_deleted: z.boolean().default(false),
  sender_id_filter: z.string().optional().describe('Filter by specific sender'),
});

export type ChatMessageQuery = z.infer<typeof ChatMessageQuerySchema>;
