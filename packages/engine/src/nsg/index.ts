/**
 * NSG v1.0 — Nexus Symbol Grammar
 *
 * Public API for parser, canonicalization, and deterministic hashing.
 * Phase 19a: Parser foundation (tokenizer, AST, canonicalization, parser)
 */

// AST Schema
export type {
  Alt,
  Amp,
  ASTNode,
  Features,
  Flow,
  Fuse,
  Group,
  Link,
  NSGType,
  Payload,
  Program,
  Query,
  RingApply,
  Seal,
  Span,
  Split,
  Term,
} from "./nsg-ast";

export { NSGType as NSGTypeEnum } from "./nsg-ast";

// Tokenizer
export { NSGTokenizer, tokenize } from "./nsg-tokenizer";
export type { Token, TokenKind } from "./nsg-tokenizer";

// Canonicalization & Hashing
export type {
  CanonicalAlt,
  CanonicalAmp,
  CanonicalFlow,
  CanonicalFuse,
  CanonicalGroup,
  CanonicalLink,
  CanonicalNode,
  CanonicalQuery,
  CanonicalRingApply,
  CanonicalSeal,
  CanonicalSplit,
  CanonicalTerm,
} from "./nsg-canon";

export {
  canonicalize,
  getHashTag,
  hashAST,
  hashCanonical,
  hashNode,
  serializeCanonical,
  verifyHashTag,
} from "./nsg-canon";

// Parser
export { parseNSG, parseSingleExpression } from "./nsg-parser";

// Lexicon (Morphology Tables)
export {
  getAllMorphClasses,
  getLexiconStats,
  lookupLexicon,
  PREFIXES,
  ROOTS,
  SUFFIXES
} from "./nsg-lexicon";
export type { LexiconEntry } from "./nsg-lexicon";

// Type Promotion Rules
export {
  areTypesCompatible,
  COMPATIBLE_TYPES,
  getTypeName,
  isValidType,
  promote,
  promoteAmp,
  promoteFlow,
  promoteFuse,
  promoteLink,
  promoteSplit
} from "./nsg-promotion-table";
export type { PromotionRule } from "./nsg-promotion-table";

// Ring Registry (15 Linguistic Lenses)
export {
  getAllRings,
  getRingByID,
  getRingsForType,
  getRingStats,
  ringApplies,
  RINGS,
  scoreInRing
} from "./nsg-ring-registry";
export type { RingDef } from "./nsg-ring-registry";

// Query Scorer (Morphological Decomposition)
export {
  generateCandidates,
  queryDecompose,
  rankCandidates,
  scoreCandidate
} from "./nsg-query-scorer";
export type { Candidate } from "./nsg-query-scorer";
