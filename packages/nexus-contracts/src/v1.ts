import { createHash } from "node:crypto";

import type { NexusCommandType } from "./command-types";
import type { NexusEventType } from "./event-types";

export interface V1EventEnvelope {
  v: 1;
  event_id: string;
  event_type: NexusEventType | string;
  ts_ms: number;
  trace_id: string;
  seq: number;
  payload: Record<string, unknown>;
}

export interface V1CommandEnvelope {
  v: 1;
  command_id: string;
  command_type: NexusCommandType | string;
  ts_ms: number;
  trace_id: string;
  payload: Record<string, unknown>;
}

export function canonicalJson(value: unknown): string {
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map((entry) => walk(entry));
    const obj = input as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = walk(obj[key]);
    }
    return out;
  };

  return JSON.stringify(walk(value));
}

export function contentHashId(prefix: string, value: unknown): string {
  const digest = createHash("sha256").update(canonicalJson(value)).digest("hex");
  return `${prefix}_${digest}`;
}

export function makeV1Event(args: {
  event_type: V1EventEnvelope["event_type"];
  ts_ms: number;
  trace_id: string;
  seq: number;
  payload: Record<string, unknown>;
}): V1EventEnvelope {
  const core = {
    v: 1 as const,
    event_type: args.event_type,
    ts_ms: args.ts_ms,
    trace_id: args.trace_id,
    seq: args.seq,
    payload: args.payload,
  };
  return {
    ...core,
    event_id: contentHashId("evt", core),
  };
}

export function makeV1Command(args: {
  command_type: V1CommandEnvelope["command_type"];
  ts_ms: number;
  trace_id: string;
  payload: Record<string, unknown>;
}): V1CommandEnvelope {
  const core = {
    v: 1 as const,
    command_type: args.command_type,
    ts_ms: args.ts_ms,
    trace_id: args.trace_id,
    payload: args.payload,
  };
  return {
    ...core,
    command_id: contentHashId("cmd", core),
  };
}

export function hashChainNext(prevHashHex: string, event: V1EventEnvelope): string {
  const body = canonicalJson({
    v: event.v,
    event_id: event.event_id,
    event_type: event.event_type,
    ts_ms: event.ts_ms,
    trace_id: event.trace_id,
    seq: event.seq,
    payload: event.payload,
  });
  return createHash("sha256").update(`${prevHashHex}${body}`).digest("hex");
}
