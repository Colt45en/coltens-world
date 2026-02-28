export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function canonicalizeJson(value: Json): Json {
  if (value === null) return null;
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number not allowed in canonical JSON: ${value}`);
    }
    // ECMAScript JSON number serialization is deterministic for finite numbers.
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => canonicalizeJson(v as Json));
  }
  if (!isPlainObject(value)) {
    throw new Error("Non-plain object not allowed in canonical JSON");
  }

  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: { [k: string]: Json } = {};
  for (const k of keys) {
    out[k] = canonicalizeJson(value[k] as Json);
  }
  return out;
}

export function canonicalStringify(value: Json): string {
  const canon = canonicalizeJson(value);
  return JSON.stringify(canon);
}
