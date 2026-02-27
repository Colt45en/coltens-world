/**
 * Sort Keys & Deterministic Sorting
 * Builds canonical sort keys and applies stable sorting
 */

import type { Json, SortKeyEntry, SortKeyPlan } from "../contracts/formatting.js";
import { fnv1a64Hex, normalizeForKey, stableStringify } from "./canon.js";

function toFlatString(v: Json): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.map(toFlatString).filter(Boolean).join(" ");
  return stableStringify(v);
}

export interface SortKeyParts {
  raw_key: string;
  canonical_key: string;
  tie_break: string; // stable tie-break from id
}

/**
 * Build a deterministic sort key from a record.
 * Returns: { raw_key (original text), canonical_key (normalized for sorting), tie_break (stable hash from id) }
 */
export function buildSortKey(entry: SortKeyEntry, plan: SortKeyPlan): SortKeyParts {
  const includeYear = plan.includeYear ?? true;
  const yearField = plan.yearField ?? "year";

  const pieces: string[] = [];
  for (const k of plan.fieldOrder) {
    if (!includeYear && k === yearField) continue;
    const v = entry.fields[k];
    const s = toFlatString(v ?? null).trim();
    if (s) pieces.push(s);
  }

  const raw_key = pieces.join(" ");
  const canonical_key = normalizeForKey(raw_key);

  // tie-break uses stable id. If your id is already a hash, perfect.
  const tie_break = fnv1a64Hex(entry.id);

  return { raw_key, canonical_key, tie_break };
}

/**
 * Sort entries deterministically by (canonical_key, tie_break).
 * Returns entries in stable order.
 */
export function sortDeterministically(entries: SortKeyEntry[], plan: SortKeyPlan): SortKeyEntry[] {
  const decorated = entries.map((e) => ({ e, k: buildSortKey(e, plan) }));
  decorated.sort((a, b) => {
    if (a.k.canonical_key < b.k.canonical_key) return -1;
    if (a.k.canonical_key > b.k.canonical_key) return 1;
    if (a.k.tie_break < b.k.tie_break) return -1;
    if (a.k.tie_break > b.k.tie_break) return 1;
    return 0;
  });
  return decorated.map((d) => d.e);
}
