// bus.ts
import { z } from "zod";
import { randomUUID } from "node:crypto";

export const BusEnvelopeV1Schema = z
  .object({
    v: z.literal(1),
    id: z.string().min(8),
    ts: z.string().datetime(),
    type: z.string().min(3),
    source: z.string().min(3),
    traceId: z.string().min(8),
    spanId: z.string().min(8),
    parentSpanId: z.string().min(8).optional(),
    severity: z.enum(["debug", "info", "warn", "error"]).default("info"),
    data: z.unknown(),
  })
  .strict();

export type BusEnvelopeV1 = z.infer<typeof BusEnvelopeV1Schema>;

export type BusHandler = (env: BusEnvelopeV1) => void;

export interface Bus {
  emit(env: BusEnvelopeV1): void;
  on(fn: BusHandler): () => void;
}

function newId(prefix: string) {
  // prefix + uuid without dashes (>= 8 chars always)
  const u = randomUUID().replace(/-/g, "");
  return `${prefix}_${u}`;
}

export function createEnvelopeFactory(opts: {
  source: string;
  traceId: string;
  parentSpanId?: string;
}) {
  return function makeEnvelope<TData>(
    type: string,
    data: TData,
    span?: { spanId?: string; parentSpanId?: string; severity?: BusEnvelopeV1["severity"]; id?: string }
  ): BusEnvelopeV1 {
    const env: BusEnvelopeV1 = {
      v: 1,
      id: span?.id ?? newId("msg"),
      ts: new Date().toISOString(),
      type,
      source: opts.source,
      traceId: opts.traceId,
      spanId: span?.spanId ?? newId("span"),
      parentSpanId: span?.parentSpanId ?? opts.parentSpanId,
      severity: span?.severity ?? "info",
      data,
    };
    return BusEnvelopeV1Schema.parse(env);
  };
}

export class InMemoryBus implements Bus {
  private listeners: BusHandler[] = [];

  emit(env: BusEnvelopeV1) {
    const parsed = BusEnvelopeV1Schema.parse(env);
    for (const fn of this.listeners) {
      try {
        fn(parsed);
      } catch {
        // bus should never crash a runtime
      }
    }
  }

  on(fn: BusHandler) {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }
}
