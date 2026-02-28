/**
 * NSG v1.0 Abstract Syntax Tree (AST) Schema
 *
 * Canonical node definitions for Nexus Symbol Grammar.
 * All nodes are immutable, hashable, and structurally deterministic.
 */

import { z } from "zod";

/**
 * Core type system for NSG
 */
export const NSGType = z.enum([
  "PHO",   // phonetic/phonological
  "MOR",   // morpheme
  "LEX",   // lexeme (word-level)
  "SYN",   // syntax structure
  "SEM",   // semantic field
  "PRG",   // pragmatic act
  "SOC",   // sociolinguistic marker
  "HIS",   // historical transform
  "TYP",   // typological class
  "CMP",   // computational/constraint
  "UNK",   // unknown (inferred later)
  "PAIR",  // relationship (for Link)
]);

export type NSGType = z.infer<typeof NSGType>;

/**
 * Span information (source location, excluded from hash)
 */
export const Span = z.object({
  start: z.number(),
  end: z.number(),
  source: z.string().optional(),
});

export type Span = z.infer<typeof Span>;

/**
 * Feature map (always sorted keys in canonical form)
 */
export const Features = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({});

export type Features = z.infer<typeof Features>;

/**
 * Payload (structured data literal, always sorted keys)
 */
export const Payload = z.record(z.string(), z.any()).default({});

export type Payload = z.infer<typeof Payload>;

/**
 * Base node interface (recursive, lazy-loaded with z.lazy)
 */
export const ASTNode: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    Term,
    Fuse,
    Amp,
    Split,
    Flow,
    Link,
    Alt,
    RingApply,
    Group,
    Seal,
    Query,
  ])
);

export type ASTNode = z.infer<typeof ASTNode>;

/**
 * Term: terminal node (identifier, optionally typed)
 * Syntax: `atom : TYPE [features] {payload} #hash`
 */
export const Term = z.object({
  kind: z.literal("Term"),
  atom: z.string(), // namespaced: "morph.re" or "re"
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  hash_tag: z.string().optional(), // explicit "#HEX" (rare)
  span: Span.optional(),
});

export type Term = z.infer<typeof Term>;

/**
 * Fuse: binary/n-ary composition (+)
 * Syntax: A + B [+ C ...]
 * Associativity: left (A + B + C = (A + B) + C)
 */
export const Fuse = z.object({
  kind: z.literal("Fuse"),
  children: z.array(ASTNode),
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Fuse = z.infer<typeof Fuse>;

/**
 * Amp: amplification/intensification (*)
 * Syntax: A * B
 * Semantics: B modulates A's magnitude
 */
export const Amp = z.object({
  kind: z.literal("Amp"),
  children: z.tuple([ASTNode, ASTNode]), // exactly 2
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Amp = z.infer<typeof Amp>;

/**
 * Split: decomposition/analysis (/)
 * Syntax: A / B
 * Semantics: analyze A using grammar/lens B
 */
export const Split = z.object({
  kind: z.literal("Split"),
  children: z.tuple([ASTNode, ASTNode]), // exactly 2
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Split = z.infer<typeof Split>;

/**
 * Flow: directed transform (->)
 * Syntax: A -> B [-> C ...]
 * Semantics: pipeline of transformations
 */
export const Flow = z.object({
  kind: z.literal("Flow"),
  children: z.array(ASTNode).min(2), // at least 2
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Flow = z.infer<typeof Flow>;

/**
 * Link: bidirectional coupling (<->)
 * Syntax: A <-> B [<-> C ...]
 * Semantics: mutual constraint/resonance
 */
export const Link = z.object({
  kind: z.literal("Link"),
  children: z.array(ASTNode).min(2), // at least 2
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Link = z.infer<typeof Link>;

/**
 * Alt: alternatives (|)
 * Syntax: A | B [| C ...]
 * Semantics: choice (order preserved, not sorted)
 */
export const Alt = z.object({
  kind: z.literal("Alt"),
  children: z.array(ASTNode).min(2), // at least 2
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Alt = z.infer<typeof Alt>;

/**
 * RingApply: lens application (@ring: expr)
 * Syntax: @ring : expr
 * Semantics: interpret expr under ring's rules
 */
export const RingApply = z.object({
  kind: z.literal("RingApply"),
  ring: z.string(), // ring name: "morphology", "semantics", etc.
  body: ASTNode,
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type RingApply = z.infer<typeof RingApply>;

/**
 * Group: parentheses (for precedence)
 * Syntax: (expr)
 * Semantics: enforced grouping; removed in normalization
 */
export const Group = z.object({
  kind: z.literal("Group"),
  body: ASTNode,
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Group = z.infer<typeof Group>;

/**
 * Seal: finalization (!)
 * Syntax: expr!
 * Semantics: freeze node; prohibit further rewrite
 */
export const Seal = z.object({
  kind: z.literal("Seal"),
  body: ASTNode,
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Seal = z.infer<typeof Seal>;

/**
 * Query: inference/search (?)
 * Syntax: ? expr
 * Semantics: request engine to infer/propose decompositions
 */
export const Query = z.object({
  kind: z.literal("Query"),
  body: ASTNode,
  type: NSGType.optional(),
  features: Features,
  payload: Payload,
  span: Span.optional(),
});

export type Query = z.infer<typeof Query>;

/**
 * Program: top-level statements (semicolon-separated)
 */
export const Program = z.object({
  statements: z.array(ASTNode),
});

export type Program = z.infer<typeof Program>;
