import type { BusEnvelopeV1, PipelineEventType } from "./busEnvelope";

function toHex32(value: number): string {
    return (value >>> 0).toString(16).padStart(8, "0");
}

function randomHex(bytes: number): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
        const data = new Uint8Array(bytes);
        cryptoObj.getRandomValues(data);
        return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    let out = "";
    for (let i = 0; i < bytes; i++) {
        out += Math.floor(Math.random() * 256)
            .toString(16)
            .padStart(2, "0");
    }
    return out;
}

export function sha256(text: string): string {
    let h1 = 0xdeadbeef ^ text.length;
    let h2 = 0x41c6ce57 ^ text.length;

    for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const seed = `${toHex32(h1)}${toHex32(h2)}`;
    return `${seed}${seed}${seed}${seed}`;
}

export function newId(prefix: string): string {
    // deterministic-ish format: prefix + random bytes
    return `${prefix}_${randomHex(8)}`;
}

export type EnvelopeFactoryOpts = {
    source: string; // "tooling.unifiedRunner" etc
    traceId: string;
};

export function createEnvelopeFactory(opts: EnvelopeFactoryOpts) {
    return function makeEnvelope<T>(
        type: PipelineEventType | string,
        data: T,
        span: {
            spanId?: string;
            parentSpanId?: string;
            severity?: BusEnvelopeV1["severity"];
        } = {}
    ): BusEnvelopeV1 {
        const spanId = span.spanId ?? newId("span");
        return {
            v: 1,
            id: newId("msg"),
            ts: new Date().toISOString(),
            type,
            source: opts.source,
            traceId: opts.traceId,
            spanId,
            parentSpanId: span.parentSpanId,
            severity: span.severity ?? "info",
            data,
        };
    };
}
