/**
 * Chat Contracts - Type definitions for chat ledger events
 * (Stub implementation - to be completed)
 */

import { z } from 'zod';

/**
 * Chat event types
 */
export const ChatLedgerEventSchema = z.union([
  z.object({
    type: z.literal('message'),
    channel_id: z.string(),
    user_id: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal('presence'),
    user_id: z.string(),
    status: z.string(),
  }),
]);

export type ChatLedgerEvent = z.infer<typeof ChatLedgerEventSchema>;

/**
 * Exported schemas for nucleus routes
 */
export const ChatMessageSentEventSchema = z.object({
  type: z.literal('message'),
  channel_id: z.string(),
  user_id: z.string(),
  content: z.string(),
});

export const ChatPresenceChangedEventSchema = z.object({
  type: z.literal('presence'),
  user_id: z.string(),
  status: z.string(),
});

export const ChatSessionStartedEventSchema = z.object({
  type: z.literal('session'),
  user_id: z.string(),
  session_id: z.string(),
});
