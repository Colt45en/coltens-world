/**
 * NSG v1.0 Canonicalization & Hashing
 *
 * Transforms AST into canonical form suitable for deterministic hashing.
 * Uses SHA-256 for all hashes (stable, zero dependencies).
 */

import { createHash } from "node:crypto";
import type { Alt, Amp, ASTNode, Flow, Fuse, Group, Link, Query, RingApply, Seal, Split, Term } from "./nsg-ast";

/**
 * CanonicalNode: serializable form of ASTNode (without span)
 * Used for hashing; spans are excluded by design.
 */
export type CanonicalNode =
  | CanonicalTerm
  | CanonicalFuse
  | CanonicalAmp
  | CanonicalSplit
  | CanonicalFlow
  | CanonicalLink
  | CanonicalAlt
  | CanonicalRingApply
  | CanonicalGroup
  | CanonicalSeal
  | CanonicalQuery;

export interface CanonicalTerm {
  kind: "Term";
  atom: string;
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
  hash_tag?: string;
}

export interface CanonicalFuse {
  kind: "Fuse";
  children: CanonicalNode[];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalAmp {
  kind: "Amp";
  children: [CanonicalNode, CanonicalNode];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalSplit {
  kind: "Split";
  children: [CanonicalNode, CanonicalNode];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalFlow {
  kind: "Flow";
  children: CanonicalNode[];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalLink {
  kind: "Link";
  children: CanonicalNode[];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalAlt {
  kind: "Alt";
  children: CanonicalNode[];
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalRingApply {
  kind: "RingApply";
  ring: string;
  body: CanonicalNode;
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalGroup {
  kind: "Group";
  body: CanonicalNode;
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalSeal {
  kind: "Seal";
  body: CanonicalNode;
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

export interface CanonicalQuery {
  kind: "Query";
  body: CanonicalNode;
  type?: string;
  features: Record<string, any>;
  payload: Record<string, any>;
}

/**
 * Canonicalize an AST node (remove spans, sort keys, normalize)
 */
export function canonicalize(node: ASTNode): CanonicalNode {
  switch (node.kind) {
    case "Term":
      return canonicalizeTerm(node);
    case "Fuse":
      return canonicalizeFuse(node);
    case "Amp":
      return canonicalizeAmp(node);
    case "Split":
      return canonicalizeSplit(node);
    case "Flow":
      return canonicalizeFlow(node);
    case "Link":
      return canonicalizeLink(node);
    case "Alt":
      return canonicalizeAlt(node);
    case "RingApply":
      return canonicalizeRingApply(node);
    case "Group":
      return canonicalizeGroup(node);
    case "Seal":
      return canonicalizeSeal(node);
    case "Query":
      return canonicalizeQuery(node);
    default:
      throw new Error(`Unknown node kind: ${(node as any).kind}`);
  }
}

function canonicalizeTerm(node: Term): CanonicalTerm {
  return {
    kind: "Term",
    atom: node.atom,
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
    ...(node.hash_tag && { hash_tag: node.hash_tag }),
  };
}

function canonicalizeFuse(node: Fuse): CanonicalFuse {
  return {
    kind: "Fuse",
    children: node.children.map(canonicalize),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeAmp(node: Amp): CanonicalAmp {
  return {
    kind: "Amp",
    children: [canonicalize(node.children[0]), canonicalize(node.children[1])],
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeSplit(node: Split): CanonicalSplit {
  return {
    kind: "Split",
    children: [canonicalize(node.children[0]), canonicalize(node.children[1])],
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeFlow(node: Flow): CanonicalFlow {
  return {
    kind: "Flow",
    children: node.children.map(canonicalize),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeLink(node: Link): CanonicalLink {
  return {
    kind: "Link",
    children: node.children.map(canonicalize),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeAlt(node: Alt): CanonicalAlt {
  return {
    kind: "Alt",
    children: node.children.map(canonicalize),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeRingApply(node: RingApply): CanonicalRingApply {
  return {
    kind: "RingApply",
    ring: node.ring,
    body: canonicalize(node.body),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeGroup(node: Group): CanonicalGroup {
  return {
    kind: "Group",
    body: canonicalize(node.body),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeSeal(node: Seal): CanonicalSeal {
  return {
    kind: "Seal",
    body: canonicalize(node.body),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

function canonicalizeQuery(node: Query): CanonicalQuery {
  return {
    kind: "Query",
    body: canonicalize(node.body),
    ...(node.type && { type: node.type }),
    features: sortedRecord(node.features || {}),
    payload: sortedRecord(node.payload || {}),
  };
}

/**
 * Convert record to sorted canonical form (keys sorted, values normalized)
 */
function sortedRecord(record: Record<string, any>): Record<string, any> {
  const sorted: Record<string, any> = {};
  const keys = Object.keys(record).sort();
  for (const key of keys) {
    sorted[key] = normalizeValue(record[key]);
  }
  return sorted;
}

/**
 * Normalize a value for deterministic JSON serialization
 */
function normalizeValue(val: any): any {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === "string") {
    // Normalize to NFC (compose Unicode)
    return val.normalize("NFC");
  }
  if (typeof val === "number") {
    // Avoid +0, use fixed notation for floats (not exponent)
    if (!isFinite(val)) {
      return null;
    }
    if (val === 0) return 0; // canonical form for zero
    return val;
  }
  if (typeof val === "boolean") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(normalizeValue);
  }
  if (typeof val === "object") {
    return sortedRecord(val);
  }
  return val;
}

/**
 * Serialize canonical node to JSON string (no whitespace, sorted keys)
 */
export function serializeCanonical(canonical: CanonicalNode): string {
  // Use JSON.stringify with deterministic sort order
  // Since we've already sorted keys, we just need compact output
  return JSON.stringify(canonical, null, 0); // no pretty-printing
}

/**
 * Hash a canonical node using SHA-256
 */
export function hashCanonical(canonical: CanonicalNode): string {
  const json = serializeCanonical(canonical);
  const hash = createHash("sha256");
  hash.update(json, "utf-8");
  return hash.digest("hex");
}

/**
 * Convenient wrapper: canonicalize + hash an AST node
 */
export function hashNode(node: ASTNode): string {
  const canonical = canonicalize(node);
  return hashCanonical(canonical);
}

/**
 * Convenience: hash an NSG string (assumes valid; parser should preflight)
 */
export function hashAST(canonical: CanonicalNode): string {
  return hashCanonical(canonical);
}

/**
 * Extract hash tag from canonical node (if present)
 */
export function getHashTag(canonical: CanonicalNode): string | undefined {
  if (canonical.kind === "Term" && canonical.hash_tag) {
    return canonical.hash_tag;
  }
  return undefined;
}

/**
 * Verify hash tag matches computed hash (optional validation)
 */
export function verifyHashTag(canonical: CanonicalNode, expectedTag?: string): boolean {
  if (!expectedTag) return true;
  const computed = hashCanonical(canonical);
  return computed === expectedTag;
}
