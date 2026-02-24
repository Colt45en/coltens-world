import type { BusEnvelope, MessageMap, Role } from "@world-engine/protocol";
import { nowMs, randomId } from "@world-engine/protocol";

export type AnyEnv = BusEnvelope<string, unknown>;

/**
 * Create envelope with auth fields
 * token should come from system.welcome handshake
 */
export function makeEnv<T extends keyof MessageMap>(
  sessionId: string,
  from: { role: Role; instanceId: string },
  type: T,
  payload: MessageMap[T],
  token: string
): BusEnvelope<T, MessageMap[T]> {
  return {
    v: 2,
    id: randomId("cli"),
    nonce: randomId("n"),
    type,
    ts: nowMs(),
    from,
    sessionId,
    auth: {
      kind: "session",
      token
    },
    payload
  };
}
