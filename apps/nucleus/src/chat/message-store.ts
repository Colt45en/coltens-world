/**
 * Message Store: Maintains message history per channel
 * (Stub implementation - to be completed)
 */

import { createHash } from "node:crypto";

export interface MessageStoreState {
  messages: Map<string, any[]>;
}

export function initMessageStore(): MessageStoreState {
  return {
    messages: new Map(),
  };
}

export function ingestMessage(store: MessageStoreState, message: any): any {
  const channel_id = message.channel_id;
  const messages = store.messages;

  if (!messages.has(channel_id)) {
    messages.set(channel_id, []);
  }

  const channelMessages = messages.get(channel_id)!;
  const sequence = channelMessages.length;

  // Compute message hash canonically
  const messageHash = createHash("sha256")
    .update(
      JSON.stringify(
        {
          channel_id: message.channel_id,
          sender_id: message.sender_id,
          text: message.text,
          timestamp_ms: message.timestamp_ms,
          causal_clock: message.causal_clock,
        },
        null,
        0
      )
    )
    .digest("hex");

  const ingested = {
    ...message,
    id: `msg:${messageHash.slice(0, 16)}`,
    sequence,
    message_hash: messageHash,
  };

  channelMessages.push(ingested);
  return ingested;
}

export function createMessageSnapshot(
  store: MessageStoreState,
  channel_id: string,
  startSeq?: number,
  endSeq?: number
): any {
  const messages = store.messages.get(channel_id) || [];

  let filteredMessages = messages;
  if (startSeq !== undefined && endSeq !== undefined) {
    filteredMessages = messages.filter((m) => m.sequence >= startSeq && m.sequence <= endSeq);
  }

  // Compute snapshot hash
  const snapshotHash = require("node:crypto")
    .createHash("sha256")
    .update(JSON.stringify(filteredMessages, null, 0))
    .digest("hex");

  return {
    channel_id,
    messages: filteredMessages,
    message_count: filteredMessages.length,
    snapshot_hash: snapshotHash,
  };
}
