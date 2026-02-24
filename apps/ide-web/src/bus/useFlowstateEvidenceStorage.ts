/**
 * useFlowstateEvidenceStorage — LocalStorage persistence for evidence packets
 *
 * Stores evidence packets with deduplication by sessionId
 * Max 10 packets per session (FIFO eviction)
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "world_engine_flowstate_evidence";
const MAX_PACKETS_PER_SESSION = 10;
let nexusBridgeRefCount = 0;
let detachNexusBridgeGlobal: (() => void) | null = null;

export interface StoredEvidencePacket {
  id: string; // packetHash or timestamp
  sessionId: string;
  timestamp: string;
  mode: "ring" | "orbit";
  boost: number;
  hashes: Record<string, string>;
  attachments: Record<string, any>;
  trace: Array<{ t: number; event: string; data?: any }>;
  storedAt: string;
}

export interface EvidenceIndex {
  version: "1.0";
  packets: StoredEvidencePacket[];
  lastUpdated: string;
}

export interface NexusV1EventEnvelope {
  v: 1;
  event_id: string;
  event_type: string;
  ts_ms: number;
  trace_id: string;
  seq: number;
  payload: Record<string, unknown>;
}

export interface NexusBridgeOptions {
  sessionId?: string;
  eventName?: string;
}

function getDefaultIndex(): EvidenceIndex {
  return {
    version: "1.0",
    packets: [],
    lastUpdated: new Date().toISOString(),
  };
}

function loadIndex(): EvidenceIndex {
  if (globalThis.window === undefined) return getDefaultIndex();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultIndex();
    const parsed = JSON.parse(stored);
    if (!parsed.version) return getDefaultIndex();
    return parsed;
  } catch (e) {
    console.warn("[flowstate:storage] failed to load index", e);
    return getDefaultIndex();
  }
}

function saveIndex(index: EvidenceIndex): void {
  if (globalThis.window === undefined) return;

  try {
    index.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn("[flowstate:storage] failed to save index", e);
  }
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function mapNexusEventToPacket(
  event: NexusV1EventEnvelope,
  sessionIdOverride?: string
): Omit<StoredEvidencePacket, "id" | "storedAt"> {
  const mode: "ring" | "orbit" = event.event_type.includes("world") ? "orbit" : "ring";
  const payloadString = JSON.stringify(event.payload ?? {});
  const payloadHash = simpleHash(payloadString);
  const boostBase = typeof event.payload?.C === "number" ? Number(event.payload.C) : 60;
  const boost = Math.max(0, Math.min(100, boostBase));

  return {
    sessionId: sessionIdOverride ?? event.trace_id ?? "nexus.global",
    timestamp: new Date(event.ts_ms).toISOString(),
    mode,
    boost,
    hashes: {
      eventId: event.event_id,
      traceId: event.trace_id,
      payloadHash,
      signature: simpleHash(`${event.event_type}:${event.seq}:${payloadHash}`),
    },
    attachments: {
      nexus: {
        v: event.v,
        eventType: event.event_type,
        seq: event.seq,
        payload: event.payload,
      },
    },
    trace: [
      {
        t: event.ts_ms,
        event: event.event_type,
        data: {
          seq: event.seq,
          eventId: event.event_id,
        },
      },
    ],
  };
}

export function useFlowstateEvidenceStorage() {
  const [packets, setPackets] = useState<StoredEvidencePacket[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const index = loadIndex();
    setPackets(index.packets);
    setLoaded(true);
  }, []);

  const addPacket = useCallback((packet: any) => {
    const index = loadIndex();
    const stored: StoredEvidencePacket = {
      id: packet.sessionId + "_" + Date.now(),
      sessionId: packet.sessionId,
      timestamp: packet.timestamp,
      mode: packet.mode,
      boost: packet.boost,
      hashes: packet.hashes,
      attachments: packet.attachments,
      trace: packet.trace,
      storedAt: new Date().toISOString(),
    };

    // Evict oldest if we exceed max per session
    const sessionPackets = index.packets.filter((p) => p.sessionId === packet.sessionId);
    if (sessionPackets.length >= MAX_PACKETS_PER_SESSION) {
      const toRemove = sessionPackets[0]!;
      index.packets = index.packets.filter((p) => p.id !== toRemove.id);
    }

    index.packets.push(stored);
    saveIndex(index);
    setPackets(index.packets);
  }, []);

  const addNexusEvent = useCallback(
    (event: NexusV1EventEnvelope, sessionIdOverride?: string) => {
      addPacket(mapNexusEventToPacket(event, sessionIdOverride));
    },
    [addPacket]
  );

  const registerNexusWindowBridge = useCallback(
    (options?: NexusBridgeOptions) => {
      if (globalThis.window === undefined) {
        return () => {};
      }

      const eventName = options?.eventName ?? "nexus:v1:event";
      const listener = (ev: Event) => {
        const custom = ev as CustomEvent<NexusV1EventEnvelope>;
        if (!custom.detail) return;
        addNexusEvent(custom.detail, options?.sessionId);
      };

      globalThis.addEventListener(eventName, listener as EventListener);
      return () => globalThis.removeEventListener(eventName, listener as EventListener);
    },
    [addNexusEvent]
  );

  useEffect(() => {
    nexusBridgeRefCount += 1;
    if (nexusBridgeRefCount === 1) {
      detachNexusBridgeGlobal = registerNexusWindowBridge();
    }

    return () => {
      nexusBridgeRefCount = Math.max(0, nexusBridgeRefCount - 1);
      if (nexusBridgeRefCount === 0 && detachNexusBridgeGlobal) {
        detachNexusBridgeGlobal();
        detachNexusBridgeGlobal = null;
      }
    };
  }, [registerNexusWindowBridge]);

  const removePacket = useCallback((id: string) => {
    const index = loadIndex();
    index.packets = index.packets.filter((p) => p.id !== id);
    saveIndex(index);
    setPackets(index.packets);
  }, []);

  const clearAll = useCallback(() => {
    const index = getDefaultIndex();
    saveIndex(index);
    setPackets([]);
  }, []);

  const getPacketsBySession = useCallback(
    (sessionId: string): StoredEvidencePacket[] => {
      return packets.filter((p) => p.sessionId === sessionId);
    },
    [packets]
  );

  return {
    packets,
    loaded,
    addPacket,
    addNexusEvent,
    registerNexusWindowBridge,
    removePacket,
    clearAll,
    getPacketsBySession,
  };
}
