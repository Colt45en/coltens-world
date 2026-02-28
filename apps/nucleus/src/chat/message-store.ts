/**
 * Message Store: Maintains message history per channel
 * (Stub implementation - to be completed)
 */

export interface MessageStoreState {
  messages: Map<string, any[]>;
}

export function initMessageStore(): MessageStoreState {
  return {
    messages: new Map(),
  };
}

export function ingestMessage(
  store: MessageStoreState,
  channel_id: string,
  message: any
): void {
  if (!store.messages.has(channel_id)) {
    store.messages.set(channel_id, []);
  }
  store.messages.get(channel_id)!.push(message);
}

export function createMessageSnapshot(
  store: MessageStoreState,
  channel_id: string
): any {
  return {
    channel_id,
    messages: store.messages.get(channel_id) || [],
  };
}
