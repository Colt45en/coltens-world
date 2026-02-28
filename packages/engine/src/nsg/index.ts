/**
 * NSG v1.0 — Nexus Symbol Grammar
 *
 * Public API for parser, canonicalization, and deterministic hashing.
 * Phase 19a: Parser foundation (tokenizer, AST, canonicalization, parser)
 */

// AST Schema
export type {
    ASTNode, Alt, Amp, Features, Flow, Fuse, Group, Link, NSGType, Payload, Program, Query, RingApply, Seal, Span, Split, Term
} from "./nsg-ast";

export { NSGType as NSGTypeEnum } from "./nsg-ast";

// Tokenizer
export { NSGTokenizer, tokenize } from "./nsg-tokenizer";
export type { Token, TokenKind } from "./nsg-tokenizer";

// Canonicalization & Hashing
export type {
    CanonicalAlt, CanonicalAmp, CanonicalFlow, CanonicalFuse, CanonicalGroup, CanonicalLink, CanonicalNode, CanonicalQuery, CanonicalRingApply, CanonicalSeal, CanonicalSplit, CanonicalTerm
} from "./nsg-canon";

export {
    canonicalize, getHashTag, hashAST, hashCanonical,
    hashNode, serializeCanonical, verifyHashTag
} from "./nsg-canon";

// Parser
export { parseNSG, parseSingleExpression } from "./nsg-parser";
