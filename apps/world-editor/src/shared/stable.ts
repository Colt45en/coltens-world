// src/shared/stable.ts
// Shared deterministic utilities for both client and server

import { createHash } from "node:crypto";

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

/**
 * Deterministic JSON stringify with sorted keys
 * Same object → same string always, across runs
 */
export function stableStringify(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;

  const obj = v as Record<string, Json>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k] ?? null)}`).join(",");
  return `{${body}}`;
}

/**
 * SHA256 hash → lowercase hex string
 * Deterministic: same input = same hash always
 */
export function sha256Hex(data: string | Uint8Array): string {
  const h = createHash("sha256");
  h.update(data);
  return h.digest("hex");
}
