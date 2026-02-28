import type {
    ChatMessage,
    ChatMessageSnapshot,
} from '../contracts/chat';
import { hashCanonical, hashMessage, stableSort } from './determinism';

/**
 * Chat Message Store — Deterministic In-Memory Message Storage
 *
 * Maintains strict message ordering per channel.
 * All operations are deterministic: same inputs → same output.
 *
 * Key properties:
 * - Messages stored by (channel_id, sequence) ensuring causal order
 * - Sequence numbers are monotonically increasing per channel
 * - Batch operations produce deterministic snapshots
 */

export interface MessageStoreState {
  messagesByChannelId: Map<string, ChatMessage[]>;
  nextSequencePerChannel: Map<string, number>;
}

/**
 * Initialize message store
 */
export function initMessageStore(): MessageStoreState {
  return {
    messagesByChannelId: new Map(),
    nextSequencePerChannel: new Map(),
  };
}

/**
 * Ingest a single message into store
 *
 * Returns updated message with assigned sequence number and hash.
 */
export function ingestMessage(
  store: MessageStoreState,
  message: Omit<ChatMessage, 'sequence' | 'message_hash'>,
): ChatMessage {
  const channelId = message.channel_id;

  // Get next sequence for this channel
  const nextSeq = store.nextSequencePerChannel.get(channelId) ?? 0;
  const sequence = nextSeq;
  store.nextSequencePerChannel.set(channelId, nextSeq + 1);

  // Compute deterministic message hash
  const messageHash = hashMessage(
    message.sender_id,
    channelId,
    message.text,
    sequence,
    message.timestamp_ms,
  );

  // Create final message
  const finalMessage: ChatMessage = {
    ...message,
    sequence,
    message_hash: messageHash,
  };

  // Store in channel messages
  if (!store.messagesByChannelId.has(channelId)) {
    store.messagesByChannelId.set(channelId, []);
  }
  const channelMessages = store.messagesByChannelId.get(channelId)!;
  channelMessages.push(finalMessage);

  return finalMessage;
}

/**
 * Batch ingest messages
 *
 * All messages maintain strict ordering within each channel.
 * Returns all ingested messages with assigned sequences.
 */
export function ingestMessageBatch(
  store: MessageStoreState,
  messages: Omit<ChatMessage, 'sequence' | 'message_hash'>[],
): ChatMessage[] {
  return messages.map((msg) => ingestMessage(store, msg));
}

/**
 * Get messages from a channel by sequence range
 */
export function getMessageRange(
  store: MessageStoreState,
  channelId: string,
  startSeq: number,
  endSeq: number, // exclusive
): ChatMessage[] {
  const messages = store.messagesByChannelId.get(channelId) ?? [];
  return messages.filter((m) => m.sequence >= startSeq && m.sequence < endSeq);
}

/**
 * Get all messages from a channel
 */
export function getAllChannelMessages(store: MessageStoreState, channelId: string): ChatMessage[] {
  return store.messagesByChannelId.get(channelId) ?? [];
}

/**
 * Create deterministic snapshot of messages
 *
 * Snapshot ID is content-addressed via hash of all message data.
 * Sorting ensures identical snapshot for same messages regardless of input order.
 */
export function createMessageSnapshot(
  store: MessageStoreState,
  channelId: string,
  startSeq: number = 0,
  endSeq?: number,
): ChatMessageSnapshot {
  const messages = store.messagesByChannelId.get(channelId) ?? [];

  // Filter to range
  let filtered = messages.filter((m) => m.sequence >= startSeq);
  if (endSeq !== undefined) {
    filtered = filtered.filter((m) => m.sequence < endSeq);
  }

  // Stable sort by sequence (should already be ordered, but ensure determinism)
  const sorted = stableSort(filtered, 'sequence');

  // Compute snapshot hash from canonical JSON
  const snapshotHash = hashCanonical({
    channel_id: channelId,
    messages: sorted,
    start_sequence: startSeq,
    end_sequence: endSeq ?? (messages.length > 0 ? messages[messages.length - 1]!.sequence + 1 : 0),
  });

  const snapshotId = `chat:msg-snap:${snapshotHash}`;

  return {
    snapshot_id: snapshotId,
    channel_id: channelId,
    messages: sorted,
    start_sequence: startSeq,
    end_sequence: endSeq ?? (messages.length > 0 ? messages[messages.length - 1]!.sequence + 1 : 0),
    message_count: sorted.length,
    snapshot_hash: snapshotHash,
    snapshot_timestamp_ms: Date.now(),
  };
}

/**
 * Validate message sequence consistency
 *
 * Ensures no gaps in sequence numbers and all messages are ordered.
 */
export function validateSequenceConsistency(
  store: MessageStoreState,
  channelId: string,
): { valid: boolean; error?: string } {
  const messages = store.messagesByChannelId.get(channelId) ?? [];

  if (messages.length === 0) return { valid: true };

  // Check sequences are strictly increasing
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]!.sequence !== i) {
      return {
        valid: false,
        error: `Sequence gap at index ${i}: expected ${i}, got ${messages[i]!.sequence}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get total message count across all channels
 */
export function getTotalMessageCount(store: MessageStoreState): number {
  let total = 0;
  for (const messages of store.messagesByChannelId.values()) {
    total += messages.length;
  }
  return total;
}

/**
 * Batch replay messages from snapshot
 *
 * Used for determinism testing: replay message sequence produces identical snapshot.
 */
export function replayMessagesFromSnapshot(
  previousSnapshot: ChatMessageSnapshot,
  newMessages: Omit<ChatMessage, 'sequence' | 'message_hash'>[],
): ChatMessageSnapshot {
  const store = initMessageStore();

  // Replay all messages from previous snapshot
  for (const msg of previousSnapshot.messages) {
    store.messagesByChannelId.set(previousSnapshot.channel_id, [
      ...(store.messagesByChannelId.get(previousSnapshot.channel_id) ?? []),
      msg,
    ]);
    store.nextSequencePerChannel.set(
      previousSnapshot.channel_id,
      (store.nextSequencePerChannel.get(previousSnapshot.channel_id) ?? 0) + 1,
    );
  }

  // Ingest new messages
  ingestMessageBatch(store, newMessages);

  // Create new snapshot
  return createMessageSnapshot(
    store,
    previousSnapshot.channel_id,
    0,
  );
}
