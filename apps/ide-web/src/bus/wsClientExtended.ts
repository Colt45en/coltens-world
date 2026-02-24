/**
 * IDE WebSocket Bus Client Extensions for Build Evidence.
 *
 * Add these methods to your existing WsBusClient in apps/ide-web/src/bus/wsClient.ts
 * or integrate them into your existing bus client architecture.
 *
 * Example usage:
 *   const bus = new WsBusClient("ws://localhost:3000", "ide-web");
 *   bus.connect();
 *   bus.onBuildEvidenceGenerated((packet, evidencePath) => {
 *     console.log("Build Evidence:", packet.bundle_hash);
 *   });
 *   bus.requestBuildEvidence({
 *     compiler: "vite",
 *     buildRoot: "apps/ide-web",
 *     runTwice: true
 *   });
 */

import {
    AnyBuildEvidenceBusMsgSchema,
    EVT_BUILD_EVIDENCE_GENERATED,
    EVT_BUILD_EVIDENCE_REQUEST,
    type BuildEvidenceGeneratedMsg,
} from "./buildEvidenceProtocol";

/** Browser-safe sha-like id (deterministic enough for envelope ids) */
export function makeEnvelopeId(type: string, source: string, ts: string) {
    // No crypto dependency required in browser; stable-ish.
    const s = `${type}:${source}:${ts}:${Math.random().toString(16).slice(2)}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return `e_${(h >>> 0).toString(16)}_${Date.now().toString(16)}`;
}

type BusEnvelope = {
    v: "1";
    id: string;
    ts: string;
    type: string;
    source: string;
    data: any;
};

type Listener = (msg: any) => void;

export class WsBusClient {
    private ws: WebSocket | null = null;
    private listeners: Map<string, Set<Listener>> = new Map();

    constructor(private url: string, private source = "ide-web") { }

    connect() {
        if (
            this.ws &&
            (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
        )
            return;

        this.ws = new WebSocket(this.url);

        this.ws.onmessage = (ev) => {
            let raw: unknown;
            try {
                raw = JSON.parse(String(ev.data));
            } catch {
                return;
            }

            const parsed = AnyBuildEvidenceBusMsgSchema.safeParse(raw);
            if (!parsed.success) return;

            const msg = parsed.data;
            const set = this.listeners.get(msg.type);
            if (set) for (const cb of set) cb(msg);
        };
    }

    on(type: string, cb: Listener) {
        const set = this.listeners.get(type) ?? new Set<Listener>();
        set.add(cb);
        this.listeners.set(type, set);
        return () => set.delete(cb);
    }

    send(type: string, data: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            throw new Error("WebSocket not open");
        const ts = new Date().toISOString();
        const env: BusEnvelope = {
            v: "1",
            id: makeEnvelopeId(type, this.source, ts),
            ts,
            type,
            source: this.source,
            data,
        };
        this.ws.send(JSON.stringify(env));
    }

    // ---- Build Evidence API ----

    requestBuildEvidence(req: {
        compiler: "vite" | "singlefile-esbuild";
        buildRoot: string;
        outDir?: string;
        mode?: string;
        runTypecheck?: boolean;
        runTwice?: boolean;
    }) {
        this.send(EVT_BUILD_EVIDENCE_REQUEST, req);
    }

    onBuildEvidenceGenerated(
        cb: (packet: BuildEvidenceGeneratedMsg["data"]["packet"], evidencePath?: string) => void
    ) {
        return this.on(EVT_BUILD_EVIDENCE_GENERATED, (msg: BuildEvidenceGeneratedMsg) => {
            cb(msg.data.packet, msg.data.evidencePath);
        });
    }
}
