/**
 * NSG v1.0 Type Promotion Table
 *
 * Defines how types combine via operators.
 * Deterministic: fixed promotion rules, no variation by input.
 */

import type { NSGType } from "./nsg-ast";

/**
 * Type promotion rule: given operand types, compute result type
 * Used for operator typing (Fuse +, Amp *, etc.)
 */
export type PromotionRule = (left: NSGType, right: NSGType) => NSGType | null;

/**
 * Promotion table for Fuse (+) operator
 *
 * Rules (in order):
 * - MOR + MOR → LEX (morpheme composition produces lexeme)
 * - LEX + LEX → LEX (lexeme composition produces lexeme: compounds)
 * - X + Y → LEX (safe default for unknown)
 * - MOR + LEX → LEX (morpheme + lexeme → lexeme)
 * - any other → error (null)
 */
export function promoteFuse(left: NSGType, right: NSGType): NSGType | null {
  // MOR + MOR -> LEX
  if (left === "MOR" && right === "MOR") return "LEX";

  // LEX + LEX -> LEX
  if (left === "LEX" && right === "LEX") return "LEX";

  // MOR + LEX -> LEX
  if (left === "MOR" && right === "LEX") return "LEX";
  if (left === "LEX" && right === "MOR") return "LEX";

  // SEM + SEM -> SEM (semantic composition)
  if (left === "SEM" && right === "SEM") return "SEM";

  // SYN + SYN -> SYN (syntax composition)
  if (left === "SYN" && right === "SYN") return "SYN";

  // For unknown combinations, default to LEX (conservative)
  if (left === "UNK" || right === "UNK") return "LEX";

  // All other combinations error out
  return null;
}

/**
 * Promotion table for Amp (*) operator
 *
 * Rules:
 * - X * _ → X (amplitude preserves left type)
 * - Default: left operand type
 */
export function promoteAmp(left: NSGType, right: NSGType): NSGType | null {
  // Amp preserves left type
  return left !== "PAIR" ? left : null;
}

/**
 * Promotion table for Split (/) operator
 *
 * Rules:
 * - X / _ → CMP (analysis produces constraint/computational result)
 */
export function promoteSplit(left: NSGType, right: NSGType): NSGType | null {
  // Split always produces CMP (analysis result)
  return "CMP";
}

/**
 * Promotion table for Flow (->) operator
 *
 * Rules:
 * - _ -> X → X (flow result type is right operand type)
 */
export function promoteFlow(left: NSGType, right: NSGType): NSGType | null {
  // Flow yields right operand type (transformation output)
  return right !== "PAIR" ? right : null;
}

/**
 * Promotion table for Link (<->) operator
 *
 * Rules:
 * - X <-> Y → PAIR (relationship/coupling object)
 */
export function promoteLink(left: NSGType, right: NSGType): NSGType | null {
  // Link produces a PAIR (relationship)
  return "PAIR";
}

/**
 * Unified promotion dispatcher
 */
export function promote(
  operator: "fuse" | "amp" | "split" | "flow" | "link" | "alt",
  left?: NSGType,
  right?: NSGType
): NSGType | null {
  if (!left || !right) return null;

  switch (operator) {
    case "fuse":
      return promoteFuse(left, right);
    case "amp":
      return promoteAmp(left, right);
    case "split":
      return promoteSplit(left, right);
    case "flow":
      return promoteFlow(left, right);
    case "link":
      return promoteLink(left, right);
    case "alt":
      // Alt doesn't promote; each alternative keeps its type
      return left;
    default:
      return null;
  }
}

/**
 * Check if a type is valid (not UNK unless explicitly allowed)
 */
export function isValidType(type: NSGType): boolean {
  return type !== "UNK" && type !== "PAIR";
}

/**
 * Get a human-readable type name
 */
export function getTypeName(type: NSGType): string {
  const names: Record<NSGType, string> = {
    PHO: "Phonetic",
    MOR: "Morpheme",
    LEX: "Lexeme",
    SYN: "Syntax",
    SEM: "Semantic",
    PRG: "Pragmatic",
    SOC: "Sociolinguistic",
    HIS: "Historical",
    TYP: "Typological",
    CMP: "Computational",
    UNK: "Unknown",
    PAIR: "Pair",
  };
  return names[type];
}

/**
 * Type compatibility matrix (can X and Y be linked?)
 */
export const COMPATIBLE_TYPES: Record<NSGType, NSGType[]> = {
  PHO: ["PHO", "MOR", "LEX", "SEM"],
  MOR: ["PHO", "MOR", "LEX", "SEM"],
  LEX: ["LEX", "SEM", "SYN", "PRG"],
  SYN: ["LEX", "SYN", "SEM"],
  SEM: ["PHO", "MOR", "LEX", "SEM", "SYN", "PRG", "SOC"],
  PRG: ["LEX", "SOC", "PRG"],
  SOC: ["PRG", "SOC"],
  HIS: ["HIS", "LEX"],
  TYP: ["TYP", "SYN", "SEM"],
  CMP: ["CMP"],
  UNK: ["UNK"],
  PAIR: ["PAIR"],
};

/**
 * Check if two types are compatible (can be linked or combined)
 */
export function areTypesCompatible(t1: NSGType, t2: NSGType): boolean {
  return COMPATIBLE_TYPES[t1]?.includes(t2) ?? false;
}
