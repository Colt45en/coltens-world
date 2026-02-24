import type { BusEnvelope, MessageMap } from "@world-engine/protocol";
import { nowMs, randomId } from "@world-engine/protocol";

export function env<T extends keyof MessageMap>(
    sessionId: string,
    instanceId: string,
    type: T,
    payload: MessageMap[T]
): BusEnvelope<T, MessageMap[T]> {
    return {
        v: 1,
        id: randomId("prev"),
        type,
        ts: nowMs(),
        from: { role: "preview", instanceId },
        sessionId,
        payload
    };
}
